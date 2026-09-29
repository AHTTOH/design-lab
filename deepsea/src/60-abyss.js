/* ───────── zone 5: the abyss ───────── */
// A trench floor with hydrothermal chimneys. Their mouths glow, plumes rise and the final pass bends the water above
// them (heat shimmer). A giant whale silhouette crosses in front of the glow, then everything dims around one comb
// jelly whose rows of cilia run with travelling rainbow light.

function trenchFloor(x, z) {
  const wall = Math.max(0, Math.abs(x) - CONFIG.abyss.wallFrom);
  return (fbm2(x * 0.12, z * 0.12) - 0.5) * 2.4 + wall * wall * 0.05 + fbm2(x * 0.4 + 7, z * 0.4) * wall * 0.8;
}

const ROCK_FRAG = `${GLSL_NOISE}
  uniform vec3 uVentColor, uHot; uniform vec4 uVents[5]; uniform float uTime, uGlowK;
  varying vec3 vWorld, vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = vec3(.05, .05, .08) * (.6 + fbm(vWorld.xz * .8) * .8);
    vec3 c = base * (.25 + max(n.y, 0.) * .3);
    // Glow from each vent mouth, with a flicker. Near the vents, mineral veins in the rock glow too.
    float near = 0.;
    for (int i = 0; i < 5; i++) {
      vec3 d = vWorld - uVents[i].xyz;
      float r2 = dot(d, d);
      float fl = .8 + .2 * sin(uTime * 7. + float(i) * 2.1) * sin(uTime * 3.1 + float(i));
      c += uVentColor * uVents[i].w * fl * .7 / (1. + r2 * 1.1) * (.4 + .6 * max(dot(n, -normalize(d)), 0.));
      c += uHot * uVents[i].w * fl * 1.2 * exp(-r2 * 4.);
      near += uVents[i].w * exp(-r2 * .07);
    }
    vec2 vp = vWorld.xz * 1.1 + vec2(vWorld.y * .9, -vWorld.y * .6);
    float vein = 1. - smoothstep(0., .07, cellEdge(vp, uTime * .15));
    float pulse = .6 + .4 * sin(uTime * 1.3 + vWorld.y * 1.7 + vWorld.x);
    c += uVentColor * vein * pulse * near * .9 + uVentColor * vein * .02 * uGlowK;
    float dist = length(vWorld - cameraPosition);
    c = mix(c, vec3(.02, .012, .07), 1. - exp(-dist * .03));
    gl_FragColor = vec4(c, 1.);
  }`;
const ROCK_VERT = `varying vec3 vWorld, vNormal;
  void main() { mat4 im = mat4(1.);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    vec4 w = modelMatrix * im * vec4(position, 1.); vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix * im) * normal);
    gl_Position = projectionMatrix * viewMatrix * w; }`;

function chimneyGeometry(h, seed) {
  const rnd = mulberry32(seed), pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, r = lerp(1.7, 0.4, Math.pow(t, 0.6)) * (0.75 + rnd() * 0.5) + (rnd() < 0.2 ? 0.25 + rnd() * 0.3 : 0);
    pts.push(new THREE.Vector2(r, t * h));
  }
  pts.push(new THREE.Vector2(0.22, h), new THREE.Vector2(0.01, h - 0.3));
  const geo = new THREE.LatheGeometry(pts, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (fbm2(x * 1.8 + y * 0.7, z * 1.8 - y * 0.9 + seed) - 0.5) * 0.9;
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Whale silhouette: a lathe body along +z with a blunt head and flukes, undulating in the vertex shader. */
function whaleGeometry() {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;                                 // 0 tail, 1 head
    const r = t < 0.6 ? lerp(0.12, 1.2, smooth(t / 0.6)) : lerp(1.2, 1.05, (t - 0.6) / 0.4) - (t > 0.96 ? (t - 0.96) * 8 : 0);
    pts.push(new THREE.Vector2(Math.max(r, 0.02), (t - 0.55) * 14));
  }
  const body = new THREE.LatheGeometry(pts, 24);
  body.rotateX(Math.PI / 2);          // lathe axis y -> z (head toward +z)
  body.scale(1, 1.15, 1);
  const fluke = new THREE.BufferGeometry();
  fluke.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -7.4, 2.8, 0.1, -8.9, 1.2, 0, -7.8, 0, 0, -7.4, -2.8, 0.1, -8.9, -1.2, 0, -7.8], 3));
  fluke.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  fluke.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  return mergeGeometries([body.toNonIndexed(), fluke]);
}

const COMB_VERT = `varying vec3 vN, vV, vL; uniform float uTime;
  void main() { vec3 p = position; p *= 1. + sin(uTime * 1.3 + p.y * 2.) * .03; vL = position;
    vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const COMB_FRAG = `uniform float uTime, uK; varying vec3 vN, vV, vL;
  vec3 hue(float h) { return clamp(abs(fract(h + vec3(0., .667, .333)) * 6. - 3.) - 1., 0., 1.); }
  void main() {
    float f = 1. - abs(dot(normalize(vN), normalize(vV)));
    float ang = atan(vL.z, vL.x);
    float band = fract(ang / 6.2831 * 8.);                  // eight comb rows, one per sector border
    float row = 1. - smoothstep(0., .06, min(band, 1. - band));
    float wave = .5 + .5 * sin(vL.y * 14. - uTime * 6.);
    vec3 rainbow = hue(vL.y * .6 - uTime * .35 + ang * .05);
    vec3 c = vec3(.25, .55, 1.) * f * f * .9 + rainbow * row * (.35 + wave * wave * 2.4) * smoothstep(1.05, .75, abs(vL.y));
    c += vec3(.2, .4, .9) * .04;
    gl_FragColor = vec4(c * uK, 1.);
  }`;

function initAbyss(gfx) {
  const a = CONFIG.abyss;
  const scene = new THREE.Scene();
  const camera = createZoneCamera();
  const dome = createDome(a.domeTop, a.domeBottom);
  scene.add(dome);
  const ventColor = col(a.vent), hot = col(a.ventHot);
  const vents = a.vents.map(([x, z], i) => new THREE.Vector4(x, trenchFloor(x, z) + a.ventH[i], z, 1));
  const rockMat = new THREE.ShaderMaterial({
    uniforms: { uVentColor: { value: ventColor }, uHot: { value: hot }, uVents: { value: vents }, uTime: { value: 0 }, uGlowK: { value: 1 } },
    vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
  });
  const floorGeo = new THREE.PlaneGeometry(120, 140, 160, 180); floorGeo.rotateX(-Math.PI / 2); floorGeo.translate(0, 0, -40);
  const fp = floorGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, trenchFloor(fp.getX(i), fp.getZ(i)));
  floorGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(floorGeo, rockMat));
  a.vents.forEach(([x, z], i) => {
    // A main chimney and two shorter spires beside it.
    [[0, 0, 1], [1.5, 0.8, 0.55], [-1.1, -1.2, 0.4]].forEach(([dx, dz, k], j) => {
      const m = new THREE.Mesh(chimneyGeometry(a.ventH[i] * k, 60 + i * 3 + j), rockMat);
      m.position.set(x + dx, trenchFloor(x + dx, z + dz) - 0.2, z + dz);
      if (j) m.scale.set(0.6, 1, 0.6);
      scene.add(m);
    });
    const g = glowSprite(a.vent, 3.2, 0.5); g.position.set(x, vents[i].y + 0.3, z); scene.add(g);
    const g2 = glowSprite(a.ventHot, 0.8, 0.55); g2.position.copy(g.position); scene.add(g2);
  });

  // Tube worms around the vents: white stalks with red plumes.
  const wormGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 6); wormGeo.translate(0, 0.5, 0);
  const worms = new THREE.InstancedMesh(wormGeo, rockMat, a.worms);
  const tips = [], rnd = mulberry32(606), d = new THREE.Object3D();
  for (let i = 0; i < a.worms; i++) {
    const [vx, vz] = a.vents[i % a.vents.length], r = 1.6 + rnd() * 2.6, t = rnd() * 6.28;
    const x = vx + Math.cos(t) * r, z = vz + Math.sin(t) * r, h = 0.6 + rnd() * 1.4;
    d.position.set(x, trenchFloor(x, z), z); d.rotation.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); d.scale.set(1, h, 1);
    d.updateMatrix(); worms.setMatrixAt(i, d.matrix);
    const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(d.matrix); tips.push(tip.x, tip.y, tip.z);
  }
  scene.add(worms);
  const tipGeo = new THREE.BufferGeometry(); tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(tips, 3));
  const tipMat = new THREE.PointsMaterial({ color: col('#ff2a55').multiplyScalar(2.2), size: 0.28, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: GLOW });
  scene.add(new THREE.Points(tipGeo, tipMat));

  // Plumes: particles rising from every mouth, widening and cooling.
  const PN = countFor(a, 'plume'), pp = new Float32Array(PN * 3), pr = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { const v = vents[i % vents.length]; pp[i * 3] = v.x; pp[i * 3 + 1] = v.y; pp[i * 3 + 2] = v.z; pr[i] = rnd(); }
  const plumeGeo = new THREE.BufferGeometry();
  plumeGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); plumeGeo.setAttribute('aRand', new THREE.BufferAttribute(pr, 1));
  const plumeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uHot: { value: hot }, uCool: { value: col('#6a2bd8') }, uK: { value: 1 } },
    vertexShader: `uniform float uTime, uDpr; attribute float aRand; varying float vT;
      void main() { float t = fract(uTime * (.06 + aRand * .05) + aRand * 7.); vT = t;
        vec3 p = position; float h = t * 16.; float w = .2 + t * 2.6;
        p += vec3(sin(aRand * 91. + uTime * .5) * w, h, cos(aRand * 57. + uTime * .4) * w);
        p.x += t * t * 3.;                              // the current bends the plume
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.2 + t * 7.) * uDpr * 30. / max(-mv.z, .5); }`,
    fragmentShader: `uniform vec3 uHot, uCool; uniform float uK; varying float vT;
      void main() { vec2 q = gl_PointCoord - .5; float r = dot(q, q); if (r > .25) discard;
        vec3 c = mix(uHot * 2.2, uCool * .5, smoothstep(0., .35, vT)) * (1. - vT) * (1. - r * 4.) * .22;
        gl_FragColor = vec4(c * uK, 1.); }`,
  });
  const plumes = new THREE.Points(plumeGeo, plumeMat); plumes.frustumCulled = false;
  scene.add(plumes);

  // Violet haze far behind the vents: the backdrop the giant is seen against.
  const haze = glowSprite(a.haze, 170, 0.55); haze.position.set(0, 9, -120); scene.add(haze);
  const sparks = createWrapPoints({ count: 1400, box: [60, 30, 60], size: 0.5, color: '#9d7bff', seed: 55, opacity: 0.55, twinkle: 1 });
  scene.add(sparks);

  // The giant.
  const whaleMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uRim: { value: col('#5a7cff') } },
    vertexShader: `uniform float uTime; varying vec3 vN, vV;
      void main() { vec3 p = position; float t = clamp((4. - p.z) / 13., 0., 1.);
        p.y += sin(uTime * .7 - p.z * .25) * t * t * 1.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uRim; varying vec3 vN, vV;
      void main() { float f = 1. - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(vec3(.004, .006, .014) + uRim * f * f * f * .3, 1.); }`,
  });
  const whale = new THREE.Mesh(whaleGeometry(), whaleMat);
  whale.scale.setScalar(2.1);
  scene.add(whale);

  // The last light: a comb jelly.
  const comb = new THREE.Group();
  const combMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uK: { value: 0 } }, vertexShader: COMB_VERT, fragmentShader: COMB_FRAG });
  const combGeo = new THREE.SphereGeometry(1, 64, 48); combGeo.scale(0.72, 1, 0.72);
  comb.add(new THREE.Mesh(combGeo, combMat));
  const combGlow = glowSprite('#6f9bff', 7, 0);
  comb.add(combGlow);
  scene.add(comb);

  gfx.onResize((W, H, dpr) => { fitCamera(camera, W / H); plumeMat.uniforms.uDpr.value = dpr; sparks.material.uniforms.uDpr.value = dpr; });
  const proj = new THREE.Vector3();
  const state = { vents: vents.map(() => new THREE.Vector4()), heat: 1 };
  return {
    id: 'abyss', scene, camera, state, mats: [rockMat, plumeMat, whaleMat, combMat, sparks.material],
    update(p, time) {
      // Glide down the trench, low over the floor; at the end, drift up toward the comb jelly.
      const z = lerp(12, -4, smooth(seg(p, 0, 0.8))), y = lerp(9.5, 7.5, smooth(seg(p, 0, 0.5)));
      const endK = smooth(seg(p, a.comb[0], a.comb[1]));
      aim(camera, [Math.sin(p * 4) * 2, y + endK * 3, z], Math.sin(p * 3.3) * 0.18, lerp(-0.2, 0.04, endK));
      camera.updateMatrixWorld();
      dome.position.copy(camera.position);
      // The giant crosses right to left in front of the haze, far ahead.
      const g = seg(p, a.giant[0], a.giant[1]);
      whale.position.set(lerp(75, -75, g), y - 1 + Math.sin(g * 3) * 1.5, z - 42);
      whale.rotation.set(0.05, -Math.PI / 2, Math.sin(time * 0.3) * 0.04);
      whale.visible = g > 0 && g < 1;
      // Everything dims around the comb jelly.
      const dim = 1 - endK * 0.8;
      rockMat.uniforms.uGlowK.value = dim;
      vents.forEach((v) => { v.w = dim; });
      plumeMat.uniforms.uK.value = dim;
      comb.position.set(camera.position.x * 0.3, y + 3.2 + endK * 3 + Math.sin(time * 0.6) * 0.25, z - lerp(16, 6.5, endK));
      comb.rotation.set(0.25, time * 0.2, 0.1);
      combMat.uniforms.uK.value = smooth(seg(p, a.comb[0] - 0.08, a.comb[0] + 0.08));
      combGlow.material.opacity = combMat.uniforms.uK.value * 0.35;
      for (const m of [rockMat, plumeMat, whaleMat, combMat]) m.uniforms.uTime.value = time;
      const su = sparks.material.uniforms;
      su.uCam.value.copy(camera.position); su.uTime.value = time; su.uVel.value = vel.k;
      // Heat shimmer columns in screen space for the final pass.
      vents.forEach((v, i) => {
        proj.set(v.x, v.y, v.z);
        const dist = camera.position.distanceTo(proj);
        proj.project(camera);
        const inFront = proj.z > -1 && proj.z < 1 ? 1 : 0;
        state.vents[i].set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5, 1.4 / Math.max(2, dist), inFront * dim);
      });
    },
    render(renderer) { renderer.render(scene, camera); },
  };
}
