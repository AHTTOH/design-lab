/* ───────── zone 4: midnight, bioluminescence and the lure ───────── */
// No sunlight reaches here. Everything self-lit blinks (siphonophore chains, photophores, plankton that flare when the
// scroll is fast). Everything else is dark MeshStandard that only the flashlight (a SpotLight along the pointer ray)
// and the lure's point light can reveal. An anglerfish swims ahead with its lure; near the end it stops and the
// beam swings onto its face.

const GLOW_VERT = `
  uniform float uTime, uDpr, uVel; attribute vec3 aColor; attribute float aSeed, aOrder, aSize, aMode;
  varying vec3 vC; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    float d = -mv.z;
    gl_Position = projectionMatrix * mv;
    float a;
    if (aMode < .5) a = .25 + .75 * smoothstep(.55, 1., sin(aOrder * 26. - uTime * 3.2 + aSeed * 6.));   // chain wave
    else if (aMode < 1.5) a = .35 + .65 * smoothstep(.2, .9, sin(uTime * (.6 + aSeed) + aSeed * 40.)); // photophores breathe
    else a = .12 + .9 * smoothstep(.96 - uVel * .5, 1., sin(uTime * (1.3 + aSeed * 2.) + aSeed * 90.)); // plankton spark
    a *= 1. + uVel * (aMode > 1.5 ? 2.2 : .6);
    vA = a * smoothstep(70., 12., d);
    vC = aColor;
    gl_PointSize = aSize * uDpr * 40. / max(d, .6);
  }`;
const GLOW_FRAG = `varying vec3 vC; varying float vA;
  void main() { vec2 q = gl_PointCoord - .5; float r = dot(q, q); if (r > .25) discard;
    float core = exp(-r * 40.), halo = (1. - r * 4.) * .35;
    gl_FragColor = vec4(vC * vA * (core * 2.2 + halo), 1.); }`;

/** The anglerfish behind its lure (the group origin): lumpy head, dropped underbite jaw with long lower fangs,
    short upper teeth, small eyes, and the stalk from the forehead to the lure. Turned a little for a three-quarter view. */
function buildAngler(d) {
  const A = CONFIG.midnight.angler;
  const body = new THREE.Group();
  body.position.set(...A.at); body.rotation.y = A.turn;
  const skin = new THREE.MeshStandardMaterial({ color: A.skin, roughness: 0.48, metalness: 0.08 });
  const inside = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide });
  const H = A.head;
  const head = new THREE.Mesh(lumpyHead(), skin); head.scale.set(...H);
  // Dark gape on the lower front of the head. SphereGeometry faces +z at phi = pi/2.
  const MOUTH = { phi: [Math.PI / 2 - 0.85, 1.7], theta: [Math.PI / 2 - 0.05, 0.6] };
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 12, MOUTH.phi[0], MOUTH.phi[1], MOUTH.theta[0], MOUTH.theta[1]), new THREE.MeshBasicMaterial({ color: '#000000' }));
  mouth.scale.set(H[0] * 1.012, H[1] * 1.012, H[2] * 1.012);
  // Lower jaw: the bottom half of a longer ellipsoid, hinged open.
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.55, 0.25); jaw.rotation.x = A.gape;
  const J = A.jaw, jawGeo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const jawOut = new THREE.Mesh(jawGeo, skin), jawIn = new THREE.Mesh(jawGeo, inside);
  jawOut.scale.set(...J); jawIn.scale.set(J[0] * 0.985, J[1] * 0.985, J[2] * 0.985);
  jaw.add(jawOut, jawIn);
  const toothMat = new THREE.MeshStandardMaterial({ color: '#b8d4da', roughness: 0.3, metalness: 0.05, emissive: '#051216' });
  const toothGeo = new THREE.ConeGeometry(0.07, 1, 8); toothGeo.translate(0, 0.5, 0);   // base at the gum
  const N = A.teeth, lower = new THREE.InstancedMesh(toothGeo, toothMat, N), upper = new THREE.InstancedMesh(toothGeo, toothMat, N);
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), phi = MOUTH.phi[0] + 0.05 + k * (MOUTH.phi[1] - 0.1), centre = 1 - Math.abs(k - 0.5) * 2, jitter = ((i * 7) % 3) * 0.1;
    // Lower fangs on the jaw rim, raked forward.
    d.position.set(-Math.cos(phi) * J[0] * 0.97, 0, Math.sin(phi) * J[2] * 0.97);
    d.rotation.set(0.35, 0, Math.cos(phi) * 0.3); d.scale.set(1.1, 0.5 + centre * 0.75 + jitter, 1.1);
    d.updateMatrix(); lower.setMatrixAt(i, d.matrix);
    // Upper teeth hang from the top edge of the gape.
    const th = MOUTH.theta[0] + 0.02;
    d.position.set(-Math.cos(phi) * Math.sin(th) * H[0], Math.cos(th) * H[1], Math.sin(phi) * Math.sin(th) * H[2]);
    d.rotation.set(Math.PI - 0.25, 0, 0); d.scale.set(0.85, 0.25 + centre * 0.35 + jitter * 0.6, 0.85);
    d.updateMatrix(); upper.setMatrixAt(i, d.matrix);
  }
  jaw.add(lower);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0a1a1f', roughness: 0.05, metalness: 0.9, emissive: '#0c3b3a', emissiveIntensity: 0.4 });
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeMat); e.position.set(s * 1.05, 1.1, 1.55); return e; });
  body.add(head, mouth, jaw, upper, ...eyes);
  body.updateMatrix();
  const F = new THREE.Vector3(0, H[1] * 0.98, 0.9).applyMatrix4(body.matrix);
  const stalkCurve = new THREE.CatmullRomCurve3([F, F.clone().add(new THREE.Vector3(0, 1.4, 0.8)), new THREE.Vector3(F.x * 0.4, 1.6, -1), new THREE.Vector3(0, 0.5, -0.1), new THREE.Vector3(0, 0, 0)]);
  const stalk = new THREE.Mesh(new THREE.TubeGeometry(stalkCurve, 48, 0.045, 6), skin);
  return { body, stalk, focus: new THREE.Vector3(0, -0.4, 1).applyMatrix4(body.matrix) };
}

/** Anglerfish head: a sphere with lumps and a heavy brow, so the flashlight has shape to rake across. */
function lumpyHead() {
  const geo = new THREE.SphereGeometry(1, 64, 48), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const lumps = (fbm2(v.x * 3 + 5, v.y * 3 + v.z * 2) - 0.45) * 0.14;
    const brow = Math.max(0, v.y - 0.35) * Math.max(0, v.z) * 0.35;
    v.multiplyScalar(1 + lumps + brow);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function initMidnight(gfx) {
  const m = CONFIG.midnight, neon = m.neon;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000104, 0.045);
  const camera = createZoneCamera();
  scene.add(camera);
  const dome = createDome(m.domeTop, m.domeBottom);
  scene.add(dome);
  const rnd = mulberry32(404);
  const Z_END = -m.travel;

  // Glowing points: one geometry for chains, photophores and plankton.
  const gp = [], gc = [], gs = [], go = [], gz = [], gm = [];
  const addGlow = (x, y, z, color, seed, order, size, mode) => { gp.push(x, y, z); const c = col(color); gc.push(c.r, c.g, c.b); gs.push(seed); go.push(order); gz.push(size); gm.push(mode); };

  // Siphonophore chains: long curved strings of beads.
  for (let c = 0; c < m.chains; c++) {
    const x0 = (c % 2 ? -1 : 1) * (1.5 + rnd() * 4), y0 = (rnd() - 0.5) * 6, z0 = -12 - (c / m.chains) * (m.travel - 16) - rnd() * 6;
    const pts = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(x0 + Math.sin(i * 1.3 + c) * 3, y0 + (i - 2.5) * 2.4 + Math.cos(i + c) * 1.2, z0 + Math.sin(i * 0.9) * 4));
    const curve = new THREE.CatmullRomCurve3(pts), color = neon[c % neon.length], seed = rnd();
    for (let i = 0; i < 90; i++) { const q = curve.getPoint(i / 89); addGlow(q.x, q.y, q.z, color, seed, i / 89, 1.3 + (i % 5 === 0 ? 1.1 : 0), 0); }
  }

  // Dark creatures only the light reveals.
  const dark = new THREE.MeshStandardMaterial({ color: '#34414f', roughness: 0.55, metalness: 0.15 });
  const silver = new THREE.MeshStandardMaterial({ color: '#8aa6b3', roughness: 0.4, metalness: 0.6 });
  const d = new THREE.Object3D(), v = new THREE.Vector3();
  const hatchGeo = new THREE.SphereGeometry(0.5, 16, 12); hatchGeo.scale(0.14, 0.85, 1);
  const hatch = new THREE.InstancedMesh(hatchGeo, silver, m.hatchet);
  for (let i = 0; i < m.hatchet; i++) {
    d.position.set((rnd() - 0.5) * 18, (rnd() - 0.5) * 9, -4 - rnd() * (m.travel - 6));
    d.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.2); d.scale.setScalar(0.35 + rnd() * 0.35);
    d.updateMatrix(); hatch.setMatrixAt(i, d.matrix);
    for (let k = 0; k < 5; k++) { v.set(0, -0.42, -0.35 + k * 0.17).applyMatrix4(d.matrix); addGlow(v.x, v.y, v.z, '#4fb8ff', rnd(), 0, 0.35, 1); }
  }
  hatch.frustumCulled = false;
  const lanternGeo = new THREE.CapsuleGeometry(0.11, 0.8, 4, 10); lanternGeo.rotateX(Math.PI / 2);
  const lantern = new THREE.InstancedMesh(lanternGeo, dark, m.lantern);
  for (let i = 0; i < m.lantern; i++) {
    d.position.set((rnd() - 0.5) * 12, (rnd() - 0.5) * 6, -6 - rnd() * (m.travel - 8));
    d.rotation.set(0, rnd() * 6.28, 0); d.scale.setScalar(0.8 + rnd() * 0.6);
    d.updateMatrix(); lantern.setMatrixAt(i, d.matrix);
    for (let k = 0; k < 7; k++) { v.set(0, -0.1, -0.4 + k * 0.13).applyMatrix4(d.matrix); addGlow(v.x, v.y, v.z, '#6bffd8', rnd(), 0, 0.5, 1); }
  }
  lantern.frustumCulled = false;
  scene.add(hatch, lantern);

  // Plankton: dim sparks that flare when the water is disturbed (fast scrolling).
  for (let i = 0, n = countFor(m, 'plankton'); i < n; i++) {
    addGlow((rnd() - 0.5) * 30, (rnd() - 0.5) * 18, 6 - rnd() * (m.travel + 16), rnd() < 0.7 ? '#3fe0ff' : neon[Math.floor(rnd() * neon.length)], rnd(), 0, 0.28 + rnd() * 0.3, 2);
  }
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  glowGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(gc, 3));
  glowGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(gs, 1));
  glowGeo.setAttribute('aOrder', new THREE.Float32BufferAttribute(go, 1));
  glowGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(gz, 1));
  glowGeo.setAttribute('aMode', new THREE.Float32BufferAttribute(gm, 1));
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uVel: { value: 0 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
  });
  const glows = new THREE.Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  scene.add(glows);

  // Marine snow that only shows inside the beam.
  const snow = createWrapPoints({ count: 1600, box: [30, 20, 30], size: 0.55, color: '#bfefff', seed: 29, opacity: 0.12, flash: true });
  snow.material.uniforms.uFall.value = 0.2;
  scene.add(snow);

  // The anglerfish. Group origin is the lure; the body waits in the dark behind it, facing the camera (+z).
  const angler = new THREE.Group();
  const lureColor = col(m.lure);
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: lureColor.clone().multiplyScalar(4) }));
  const lureGlow = glowSprite(m.lure, 1.7, 0.85);
  const lureLight = new THREE.PointLight(lureColor, m.lureLight, 6, 2);
  angler.add(lure, lureGlow, lureLight);
  const { body, stalk, focus: anglerFocus } = buildAngler(d);
  angler.add(body, stalk);
  scene.add(angler);

  // Flashlight.
  const flash = new THREE.SpotLight('#cff6ff', m.flash.intensity, m.flash.distance, m.flash.angle, m.flash.penumbra, 1.6);
  scene.add(flash, flash.target);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), aimNdc = new THREE.Vector2(), fishNdc = new THREE.Vector3();

  gfx.onResize((W, H, dpr) => { fitCamera(camera, W / H); glowMat.uniforms.uDpr.value = dpr; snow.material.uniforms.uDpr.value = dpr; });

  const lureAt = (p) => {
    const travelK = seg(p, 0, m.reveal[0]);
    return { x: Math.sin(travelK * 8.5) * 2.2, y: Math.sin(travelK * 5.3) * 1.4, z: lerp(-m.lureAhead, Z_END, travelK) };
  };
  const state = { flashScreen: new THREE.Vector3(0.5, 0.5, 0) };

  return {
    id: 'midnight', scene, camera, state, mats: [glowMat, snow.material, dome.material],
    update(p, time) {
      const L = lureAt(p), Lb = lureAt(p - 0.035);
      const bob = reduce ? 0 : Math.sin(time * 1.2) * 0.18;
      angler.position.set(L.x, L.y + bob, L.z);
      angler.rotation.y = Math.sin(time * 0.4) * 0.08;
      // The body waits far back in the dark while the lure leads, then swims up behind it for the reveal.
      const arrive = smooth(seg(p, m.reveal[0] - 0.04, m.reveal[0] + 0.1));
      body.position.z = m.angler.at[2] - m.hideBack * (1 - arrive);
      stalk.visible = arrive > 0.98;
      angler.updateMatrixWorld(true);
      lureLight.intensity = m.lureLight * (0.85 + 0.15 * Math.sin(time * 3.1));
      // Camera trails the lure, then closes in during the reveal.
      const close = smooth(seg(p, m.reveal[0], m.reveal[1]));
      const gap = lerp(m.lureAhead, 3.1, close);
      const cx = lerp(Lb.x, L.x, 0.6), cy = lerp(Lb.y, L.y, 0.6) + lerp(0.5, 0.25, close);
      const cz = L.z + gap;
      const yaw = Math.atan2(-(L.x - cx), -(L.z - cz)) * 0.8;
      const pitch = Math.atan2(L.y - cy - close * 0.6, Math.abs(L.z - cz)) * 0.7;
      aim(camera, [cx, cy, cz], yaw, pitch);
      camera.updateMatrixWorld();
      dome.position.copy(camera.position);

      // Where the beam points: pointer when steered recently, otherwise a slow wander; the reveal pulls it to the face.
      const idle = reduce || coarse || !pointer.has || performance.now() - pointer.lastMove > m.flash.idleMs;
      const wander = [Math.sin(time * 0.37) * 0.5 + Math.sin(time * 0.91) * 0.12, Math.cos(time * 0.29) * 0.32];
      aimNdc.set(idle ? wander[0] : pointer.nx, idle ? wander[1] : pointer.ny);
      fishNdc.copy(anglerFocus).applyMatrix4(angler.matrixWorld).project(camera);
      const pull = smooth(seg(p, m.reveal[0] + 0.04, m.reveal[1] - 0.02)) * (idle ? 1 : 0.7);
      ndc.set(lerp(aimNdc.x, fishNdc.x, pull), lerp(aimNdc.y, fishNdc.y, pull));
      ray.setFromCamera(ndc, camera);
      flash.position.copy(camera.position);
      flash.intensity = m.flash.intensity * lerp(1, m.flash.closeK, close);
      flash.target.position.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 12);
      flash.target.updateMatrixWorld();
      state.flashScreen.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, 1);

      glowMat.uniforms.uTime.value = time; glowMat.uniforms.uVel.value = vel.k;
      const su = snow.material.uniforms;
      su.uCam.value.copy(camera.position); su.uTime.value = time; su.uVel.value = vel.k;
      su.uFlashDir.value.copy(ray.ray.direction); su.uFlashK.value = 1;
    },
    render(renderer) { renderer.render(scene, camera); },
  };
}
