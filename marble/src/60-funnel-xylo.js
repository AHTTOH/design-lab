/* ───────── funnel vortex, xylophone bars, the hop into the bucket ───────── */
function funnelSurfaceY(rad) {
  const F = CONFIG.layout.funnel;
  return F.holeY + ((rad - F.holeR) / (F.rimR - F.holeR)) * (F.rimY - F.holeY);
}
/** Where a marble coming from `from` meets the funnel tangentially, turning counter-clockwise seen from above. */
function funnelEntry(from) {
  const F = CONFIG.layout.funnel;
  const toC = V(F.c[0] - from.x, 0, F.c[1] - from.z).normalize();
  // tangent (-sin psi, cos psi) in (x, z) must equal the approach direction
  const psi = Math.atan2(-toC.x, toC.z);
  return { psi, tan: toC, p: V(F.c[0] + F.entryR * Math.cos(psi), 0, F.c[1] + F.entryR * Math.sin(psi)) };
}
/** Marble centre height above the cone wall at radius rad. */
const funnelRide = (rad) => funnelSurfaceY(rad) + CONFIG.marble.r * 1.2;

function barTop(i) { const X = CONFIG.layout.xylo; return V(X.x0 + i * X.dx, X.y0 - i * X.dy, X.z); }
function barHitTimes() {
  const X = CONFIG.layout.xylo, T = CONFIG.time, hop = (T.xylo[1] - T.xylo[0]) / (X.bars - 1);
  return Array.from({ length: X.bars }, (_, i) => T.drop[1] + i * hop);
}
/** Rim height of the hanging bucket; it sinks once marble B is inside. */
function bucketRim(t) {
  const K = CONFIG.layout.bucket, T = CONFIG.time, u = seg(t, T.bucket[0], T.bucket[1]);
  return K.top - K.drop * u * u * (3 - 2 * u);
}
const bucketDepth = 0.42;

function createFunnelXylo(scene, mats, entry) {
  const F = CONFIG.layout.funnel, X = CONFIG.layout.xylo, K = CONFIG.layout.bucket, T = CONFIG.time, r = CONFIG.marble.r;
  const g = new THREE.Group(); scene.add(g);

  // funnel: acrylic cone on three brass legs
  const prof = [];
  for (let i = 0; i <= 16; i++) { const rad = lerp(F.holeR, F.rimR, i / 16); prof.push(new THREE.Vector2(rad, funnelSurfaceY(rad) - F.holeY)); }
  prof.push(new THREE.Vector2(F.rimR + 0.08, F.rimY - F.holeY + 0.04));
  const cone = solid(new THREE.LatheGeometry(prof, 64), mats.acrylic(COLOR.cobalt, 0.6), g, F.c[0], F.holeY, F.c[1]);
  cone.castShadow = false;
  const rim = solid(new THREE.TorusGeometry(F.rimR + 0.06, 0.05, 10, 64), mats.brass, g, F.c[0], F.rimY + 0.03, F.c[1]);
  rim.rotation.x = PI / 2;
  const collar = solid(new THREE.TorusGeometry(F.holeR + 0.02, 0.05, 10, 32), mats.brass, g, F.c[0], F.holeY, F.c[1]);
  collar.rotation.x = PI / 2;
  for (let k = 0; k < 3; k++) {
    const a = PI / 6 + (k / 3) * TAU;
    rod(V(F.c[0] + (F.rimR + 0.06) * Math.cos(a), F.rimY, F.c[1] + (F.rimR + 0.06) * Math.sin(a)),
      V(F.c[0] + (F.rimR + 0.5) * Math.cos(a), 0, F.c[1] + (F.rimR + 0.5) * Math.sin(a)), 0.05, mats.brass, g, 10);
  }

  // xylophone: bars on two sloped brass rails, rainbow acrylic that flashes when struck
  const bars = [];
  const lenAt = (i) => lerp(X.len[0], X.len[1], i / (X.bars - 1));
  for (let i = 0; i < X.bars; i++) {
    const p = barTop(i), mat = mats.acrylic(DOMINO_HUES[i % DOMINO_HUES.length], 0.25);
    mat.emissive = new THREE.Color(DOMINO_HUES[i % DOMINO_HUES.length]);
    mat.emissiveIntensity = 0;
    const bar = solid(new RoundedBoxGeometry(X.w, 0.1, lenAt(i), 2, 0.035), mat, g, p.x, p.y - 0.05, p.z);
    bars.push({ mesh: bar, y: p.y - 0.05, mat });
    for (const s of [-1, 1]) {
      const zz = p.z + s * (lenAt(i) / 2 - 0.16);
      solid(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), mats.chrome, g, p.x, p.y - 0.12, zz);
    }
  }
  for (const s of [-1, 1]) {
    const a = barTop(0), b = barTop(X.bars - 1);
    const za = a.z + s * (lenAt(0) / 2 - 0.16), zb = b.z + s * (lenAt(X.bars - 1) / 2 - 0.16);
    rod(V(a.x - 0.3, a.y - 0.16, za), V(b.x + 0.3, b.y - 0.16, zb), 0.04, mats.brass, g, 10);
    rod(V(a.x - 0.3, a.y - 0.16, za), V(a.x - 0.3, 0, za), 0.045, mats.pink, g, 10);
    rod(V(b.x + 0.3, b.y - 0.16, zb), V(b.x + 0.3, 0, zb), 0.045, mats.pink, g, 10);
  }

  // bucket hanging from the spool rope
  const bucket = new THREE.Group(); g.add(bucket);
  const bprof = [new THREE.Vector2(0.001, -bucketDepth), new THREE.Vector2(K.r * 0.82, -bucketDepth), new THREE.Vector2(K.r, 0), new THREE.Vector2(K.r + 0.03, 0.02)];
  solid(new THREE.LatheGeometry(bprof, 40), new THREE.MeshPhysicalMaterial({ color: COLOR.brass, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }), bucket);
  const handle = solid(new THREE.TorusGeometry(K.r, 0.02, 8, 32, PI), mats.chrome, bucket);
  handle.rotation.y = PI / 2;
  const ropeTop = V(K.x, CONFIG.layout.gears.list[0].c[1], K.z);
  const rope = rod(V(K.x, 2, K.z), ropeTop, 0.018, mats.rope, g, 6);

  // B legs: vortex, drop, bar hops, into the bucket, ride the bucket down
  const psiEnd = entry.psi + F.turns * TAU;
  const spiral = {
    t0: T.funnel[0], t1: T.funnel[1], mode: 'roll', at: (t) => {
      const u = seg(t, T.funnel[0], T.funnel[1]), s = Math.pow(u, 1.45);
      const rad = lerp(F.entryR, F.holeR * 0.7, Math.pow(u, 0.9)), psi = lerp(entry.psi, psiEnd, s);
      return V(F.c[0] + rad * Math.cos(psi), funnelRide(Math.max(rad, F.holeR)), F.c[1] + rad * Math.sin(psi));
    },
  };
  const spiralEnd = spiral.at(T.funnel[1]);
  const hits = barHitTimes();
  const onBar = (i) => barTop(i).add(V(0, r, 0));
  const inBucket = (t) => V(K.x, bucketRim(t) - bucketDepth + r + 0.03, K.z);
  const legs = [
    spiral,
    { t0: T.drop[0], t1: T.drop[1], mode: 'fly', at: (t) => { const u = seg(t, T.drop[0], T.drop[1]); return spiralEnd.clone().lerp(onBar(0), u * u); } },
  ];
  for (let i = 0; i < X.bars - 1; i++) legs.push(hopLeg(onBar(i), onBar(i + 1), X.hop, hits[i], hits[i + 1]));
  legs.push(hopLeg(onBar(X.bars - 1), inBucket(T.toBucket[1]), X.hop + 0.25, T.toBucket[0], T.toBucket[1]));
  legs.push({ t0: T.toBucket[1], t1: T.bucket[1], mode: 'carry', at: inBucket });

  const update = (t) => {
    bars.forEach((b, i) => {
      const s = t - hits[i];
      const ring = s >= 0 ? Math.exp(-s / 0.012) : 0;
      b.mesh.position.y = b.y - 0.045 * ring * Math.abs(Math.cos(s / 0.0035));
      b.mat.emissiveIntensity = s >= 0 ? 0.25 + 2.2 * Math.exp(-s / 0.03) : 0;
    });
    const rimY = bucketRim(t);
    bucket.position.set(K.x, rimY, K.z);
    placeRod(rope, V(K.x, rimY + K.r, K.z), ropeTop);
  };
  return { update, legs, bucketRim };
}
