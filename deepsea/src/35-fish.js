/* ───────── reef fish: boids on the CPU, one InstancedMesh ───────── */
// Separation, alignment and cohesion over the nearest flock mates, a pull toward a home point ahead of the diver,
// and a flee force away from the pointer ray. The tail wiggle lives in the vertex shader.

function fishGeometry(len) {
  const body = new THREE.SphereGeometry(0.5, 14, 10);
  body.scale(0.17, 0.36, 1);
  body.translate(0, 0, 0.1);
  // Forked tail: two fins behind the body.
  const t = new THREE.BufferGeometry();
  const v = [0, 0, -0.34, 0, 0.26, -0.72, 0, 0.04, -0.52, 0, 0, -0.34, 0, -0.04, -0.52, 0, -0.26, -0.72];
  t.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  t.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
  t.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  const bodyN = body.toNonIndexed();
  const geo = mergeGeometries([bodyN, t]);
  geo.scale(len, len, len);
  return geo;
}

const FISH_VERT = `
  uniform float uTime, uLen; attribute float aPhase; attribute float aBeat;
  varying vec3 vLocal, vNormal, vWorld, vColor;
  void main() {
    vec3 p = position;
    float z = p.z / uLen;                       // +0.6 head, -0.72 tail tip
    float bend = max(.45 - z, 0.);
    p.x += sin(uTime * aBeat + aPhase - z * 5.) * .075 * uLen * bend * bend * 2.2;
    vLocal = position / uLen;
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vColor = instanceColor;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FISH_FRAG = `
  uniform vec3 uFog, uStripe; uniform float uFogDensity;
  varying vec3 vLocal, vNormal, vWorld, vColor;
  void main() {
    vec3 n = normalize(vNormal); if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);
    float back = smoothstep(-.02, .08, vLocal.y);
    vec3 base = mix(vec3(.75, .95, 1.) * .9, vColor * .55, back);           // pale belly, coloured back
    float stripe = (1. - smoothstep(.0, .035, abs(vLocal.y - .02))) * step(-.3, vLocal.z);
    base = mix(base, uStripe, stripe * .9);
    base = mix(base, uStripe, smoothstep(-.4, -.55, vLocal.z) * .85);     // bright tail
    float light = max(dot(n, normalize(vec3(.3, 1., .2))), 0.) * .7 + .35;
    float fres = 1. - abs(dot(n, v));
    vec3 c = base * light + vec3(.6, .95, 1.) * fres * fres * .6;
    float dist = length(vWorld - cameraPosition);
    c = mix(c, uFog, 1. - exp(-uFogDensity * uFogDensity * dist * dist));
    gl_FragColor = vec4(c, 1.);
  }`;

function createSchool(scene) {
  const f = CONFIG.fish, N = countFor(f, 'count');
  const geo = fishGeometry(f.length);
  const rnd = mulberry32(77);
  const phase = new Float32Array(N), beat = new Float32Array(N);
  for (let i = 0; i < N; i++) { phase[i] = rnd() * 6.28; beat[i] = 9 + rnd() * 5; }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aBeat', new THREE.InstancedBufferAttribute(beat, 1));
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uLen: { value: f.length }, uFog: { value: col(CONFIG.reef.fog) }, uFogDensity: { value: CONFIG.reef.fogDensity },
      uStripe: { value: col(f.stripe) },
    },
    vertexShader: FISH_VERT, fragmentShader: FISH_FRAG,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < N; i++) mesh.setColorAt(i, col(f.colors[i % f.colors.length]).multiplyScalar(0.8 + rnd() * 0.4));
  scene.add(mesh);

  const pos = new Float32Array(N * 3), velo = new Float32Array(N * 3);
  let placed = false;
  function place(target) {
    const r = mulberry32(5);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = target.x + (r() - 0.5) * f.spread[0] * 1.6;
      pos[i * 3 + 1] = target.y + (r() - 0.5) * f.spread[1] * 1.6;
      pos[i * 3 + 2] = target.z + (r() - 0.5) * f.spread[2] * 1.6;
      velo[i * 3] = 1 + (r() - 0.5) * 0.4; velo[i * 3 + 1] = (r() - 0.5) * 0.2; velo[i * 3 + 2] = -2 + (r() - 0.5) * 0.4;
    }
    placed = true;
  }

  const d = new THREE.Object3D(), look = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const nearD = new Float32Array(f.neighbours), nearI = new Int32Array(f.neighbours);

  function steer(i, dt, target, scare) {
    const ix = i * 3, px = pos[ix], py = pos[ix + 1], pz = pos[ix + 2];
    // k nearest neighbours (insertion into a tiny sorted list).
    let found = 0;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = pos[j * 3] - px, dy = pos[j * 3 + 1] - py, dz = pos[j * 3 + 2] - pz, dd = dx * dx + dy * dy + dz * dz;
      if (dd > f.coh * f.coh) continue;
      if (found < nearD.length) { nearD[found] = dd; nearI[found] = j; found++; }
      else {
        let worst = 0; for (let k = 1; k < found; k++) if (nearD[k] > nearD[worst]) worst = k;
        if (dd < nearD[worst]) { nearD[worst] = dd; nearI[worst] = j; }
      }
    }
    let ax = 0, ay = 0, az = 0;
    if (found) {
      let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
      for (let k = 0; k < found; k++) {
        const j = nearI[k] * 3, dx = px - pos[j], dy = py - pos[j + 1], dz = pz - pos[j + 2], dist = Math.sqrt(nearD[k]) + 1e-4;
        cx += pos[j]; cy += pos[j + 1]; cz += pos[j + 2];
        vx += velo[j]; vy += velo[j + 1]; vz += velo[j + 2];
        if (dist < f.sep) { const s = f.sepK * (f.sep - dist) / dist; ax += dx * s; ay += dy * s; az += dz * s; }
      }
      ax += (cx / found - px) * f.cohK; ay += (cy / found - py) * f.cohK; az += (cz / found - pz) * f.cohK;
      ax += (vx / found - velo[ix]) * f.alignK; ay += (vy / found - velo[ix + 1]) * f.alignK; az += (vz / found - velo[ix + 2]) * f.alignK;
    }
    // Home: soft pull, stronger outside the school's box.
    const hx = target.x - px, hy = target.y - py, hz = target.z - pz;
    const out = Math.max(Math.abs(hx) / f.spread[0], Math.abs(hy) / f.spread[1], Math.abs(hz) / f.spread[2]);
    const hk = f.homeK * (out > 1 ? out * out : 0.25);
    ax += hx * hk; ay += hy * hk * 1.4; az += hz * hk;
    let flee = 0;
    if (scare) {
      // Distance to the pointer ray; push away from the ray and forward.
      const ox = px - scare.o.x, oy = py - scare.o.y, oz = pz - scare.o.z;
      const t = Math.max(0, ox * scare.d.x + oy * scare.d.y + oz * scare.d.z);
      const qx = ox - scare.d.x * t, qy = oy - scare.d.y * t, qz = oz - scare.d.z * t, qd = Math.hypot(qx, qy, qz) + 1e-4;
      if (qd < f.scareR) {
        flee = 1 - qd / f.scareR;
        const s = f.scareK * flee / qd;
        ax += qx * s; ay += qy * s; az += qz * s;
      }
    }
    let vx = velo[ix] + ax * dt, vy = velo[ix + 1] + ay * dt, vz = velo[ix + 2] + az * dt;
    const sp = Math.hypot(vx, vy, vz) + 1e-5, maxS = lerp(f.maxSpeed * (1 + vel.k * 0.4), f.fleeSpeed, flee);
    const k = sp > maxS ? maxS / sp : sp < f.minSpeed ? f.minSpeed / sp : 1;
    velo[ix] = vx * k; velo[ix + 1] = vy * k; velo[ix + 2] = vz * k;
    pos[ix] += velo[ix] * dt; pos[ix + 1] += velo[ix + 1] * dt; pos[ix + 2] += velo[ix + 2] * dt;
  }

  return {
    mesh,
    update(dt, time, target, camera) {
      mat.uniforms.uTime.value = time;
      if (!placed || reduce) place(target);
      // A far jump (entering the zone, reduced-motion stills) re-seeds the school at home.
      const dx = pos[0] - target.x, dz = pos[2] - target.z;
      if (dx * dx + dz * dz > 900) place(target);
      let scare = null;
      if (pointer.has && !reduce) {
        ndc.set(pointer.nx, pointer.ny);
        ray.setFromCamera(ndc, camera);
        scare = { o: ray.ray.origin, d: ray.ray.direction };
      }
      if (!reduce) {
        const step = Math.min(dt, 1 / 30);
        for (let i = 0; i < N; i++) steer(i, step, target, scare);
      }
      for (let i = 0; i < N; i++) {
        const ix = i * 3;
        d.position.set(pos[ix], pos[ix + 1], pos[ix + 2]);
        look.set(pos[ix] + velo[ix], pos[ix + 1] + velo[ix + 1], pos[ix + 2] + velo[ix + 2]);
        d.lookAt(look);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
