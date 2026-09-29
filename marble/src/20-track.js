/* ───────── rails and actors ───────── */

/** Curve through marble-center points, arc length mapped finely so getPointAt is even. */
function pathCurve(points, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal', tension);
  c.arcLengthDivisions = Math.max(400, Math.round(c.getLength() * 60));
  c.updateArcLengths();
  return c;
}

/** Two round rails under a marble path, cross ties, and optional posts down to a floor height. */
function buildRails(curve, mats, { gauge = 0.25, drop = 0.13, tieEvery = 0.42, postEvery = 1.6, postTo = 0, postMat, railR = 0.035, skipPosts = () => false } = {}) {
  const group = new THREE.Group();
  const len = curve.getLength(), steps = Math.max(24, Math.round(len * 14));
  const left = [], right = [], frames = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const nrm = new THREE.Vector3().crossVectors(side, tan).normalize();
    const base = p.clone().addScaledVector(nrm, -drop);
    left.push(base.clone().addScaledVector(side, gauge / 2));
    right.push(base.clone().addScaledVector(side, -gauge / 2));
    frames.push({ u, base, side, nrm });
  }
  for (const pts of [left, right]) {
    const rc = new THREE.CatmullRomCurve3(pts);
    solid(new THREE.TubeGeometry(rc, steps * 2, railR, 8, false), mats.chrome, group);
  }
  // ties: small brass bars across the gauge, slightly below the rails
  const tieGeo = new THREE.BoxGeometry(gauge + 0.1, 0.03, 0.05);
  const ties = Math.floor(len / tieEvery);
  const tieMesh = new THREE.InstancedMesh(tieGeo, mats.brass, ties);
  tieMesh.castShadow = tieMesh.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), basis = new THREE.Matrix4();
  for (let i = 0; i < ties; i++) {
    const f = frames[Math.round(((i + 0.5) / ties) * steps)];
    const tan = new THREE.Vector3().crossVectors(f.nrm, f.side);
    basis.makeBasis(f.side, f.nrm, tan); q.setFromRotationMatrix(basis);
    m4.compose(f.base.clone().addScaledVector(f.nrm, -0.035), q, new THREE.Vector3(1, 1, 1));
    tieMesh.setMatrixAt(i, m4);
  }
  group.add(tieMesh);
  if (postEvery > 0) {
    const posts = Math.max(2, Math.floor(len / postEvery));
    for (let i = 0; i <= posts; i++) {
      const f = frames[Math.round((i / posts) * steps)];
      if (skipPosts(f.base)) continue;
      const top = f.base.clone().addScaledVector(f.nrm, -0.05);
      if (top.y - postTo < 0.15) continue;
      rod(top, V(top.x, postTo, top.z), 0.045, postMat ?? mats.sun, group, 8);
      solid(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 14), mats.brass, group, top.x, postTo + 0.03, top.z);
    }
  }
  return group;
}

/** A glass marble with a coloured twisted vane inside, so the rolling rotation reads clearly. */
function makeMarble(mats, { glass, vane, r = CONFIG.marble.r }) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({
    color: glass, transmission: 0.82, thickness: r * 1.6, roughness: 0.02, ior: 1.52, clearcoat: 1, clearcoatRoughness: 0.01,
    attenuationColor: glass, attenuationDistance: r * 1.4, envMapIntensity: 1.8, specularIntensity: 1,
  }));
  shell.castShadow = true;
  g.add(shell);
  const vaneMat = new THREE.MeshStandardMaterial({ color: vane, roughness: 0.35, emissive: vane, emissiveIntensity: 0.55, side: THREE.DoubleSide });
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.PlaneGeometry(r * 1.5, r * 1.55, 1, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { // twist the petal along its length
      const x = pos.getX(i), y = pos.getY(i), a = (y / r) * 1.1;
      pos.setXYZ(i, x * Math.cos(a) * (1 - Math.abs(y) / (r * 1.1)) , y, x * Math.sin(a) * (1 - Math.abs(y) / (r * 1.1)));
    }
    geo.computeVertexNormals();
    const petal = new THREE.Mesh(geo, vaneMat);
    petal.rotation.y = (k / 3) * PI;
    g.add(petal);
  }
  return g;
}

/**
 * An actor is anything that travels: a marble or the steel ball. Its path is a list of legs,
 * each { t0, t1, at(t) → Vector3, mode: 'roll' | 'fly' | 'carry' }. Positions are pure functions of t.
 * Rotation is integrated once at load (roll: angle = distance / radius about up × velocity; fly keeps the
 * last spin; carry keeps orientation), then looked up, so rewinding lands on the very same pose.
 */
function createActor(object, radius, legs) {
  const L = [...legs].sort((a, b) => a.t0 - b.t0);
  const t0 = L[0].t0, t1 = L[L.length - 1].t1, dt = CONFIG.sampleDt;
  const n = Math.ceil((t1 - t0) / dt) + 1;
  const pos = new Float32Array(n * 3), quat = new Float32Array(n * 4);
  const legAt = (t) => {
    for (let i = L.length - 1; i >= 0; i--) if (t >= L[i].t0) return t <= L[i].t1 ? { leg: L[i], t } : { leg: L[i], t: L[i].t1, hold: true };
    return { leg: L[0], t: L[0].t0, hold: true };
  };
  const q = new THREE.Quaternion(), dq = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0), d = new THREE.Vector3();
  let prev = L[0].at(t0).clone(), spin = 0;
  for (let i = 0; i < n; i++) {
    const t = Math.min(t1, t0 + i * dt), { leg, t: lt, hold } = legAt(t);
    const p = leg.at(lt);
    d.subVectors(p, prev);
    const dist = d.length();
    if (!hold && leg.mode === 'roll' && dist > 1e-7) {
      axis.crossVectors(UP, d).normalize();
      if (axis.lengthSq() > 0.5) { const ang = dist / radius; dq.setFromAxisAngle(axis, ang); q.premultiply(dq); spin = ang / dt; }
    } else if (!hold && leg.mode === 'fly' && spin) {
      dq.setFromAxisAngle(axis, spin * dt * 0.85); q.premultiply(dq);
    } else if (hold || leg.mode === 'carry') spin *= 0.9;
    pos.set([p.x, p.y, p.z], i * 3); quat.set([q.x, q.y, q.z, q.w], i * 4);
    prev.copy(p);
  }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), out = new THREE.Vector3();
  const update = (t) => {
    const f = clamp((t - t0) / dt, 0, n - 1), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
    out.set(lerp(pos[i * 3], pos[j * 3], k), lerp(pos[i * 3 + 1], pos[j * 3 + 1], k), lerp(pos[i * 3 + 2], pos[j * 3 + 2], k));
    qa.fromArray(quat, i * 4); qb.fromArray(quat, j * 4);
    object.position.copy(out);
    object.quaternion.slerpQuaternions(qa, qb, k);
    return out;
  };
  /** Position at any t without touching the mesh (camera focus). */
  const peek = (t) => {
    const f = clamp((t - t0) / dt, 0, n - 1), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
    return V(lerp(pos[i * 3], pos[j * 3], k), lerp(pos[i * 3 + 1], pos[j * 3 + 1], k), lerp(pos[i * 3 + 2], pos[j * 3 + 2], k));
  };
  return { object, update, peek, t0, t1 };
}

/** Leg helpers */
const along = (curve, t0, t1, ease = (x) => x) => ({ t0, t1, mode: 'roll', at: (t) => curve.getPointAt(clamp01(ease(seg(t, t0, t1)))) });
const lineLeg = (a, b, t0, t1, ease = (x) => x) => ({ t0, t1, mode: 'roll', at: (t) => a.clone().lerp(b, ease(seg(t, t0, t1))) });
/** Ballistic hop from a to b with a peak `h` above the higher end. Horizontal speed is constant. */
const hopLeg = (a, b, h, t0, t1, mode = 'fly') => ({ t0, t1, mode, at: (t) => {
  const u = seg(t, t0, t1), top = Math.max(a.y, b.y) + h;
  // parabola through a (u=0), b (u=1) and apex height top: y = a + (b-a)u + c u(1-u)
  const c = 2 * (top - (a.y + b.y) / 2) + 2 * Math.sqrt(Math.max(0, (top - a.y) * (top - b.y)));
  return V(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + c * u * (1 - u), lerp(a.z, b.z, u));
} });
/** Rolling starts slowly and gathers speed. */
const gather = (k) => (x) => k * x * x + (1 - k) * x;
