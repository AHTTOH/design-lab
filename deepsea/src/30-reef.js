/* ───────── zone 2: the sunlit reef ───────── */
// Seabed, rocks, tube sponges, sea fans and kelp share one shader: sun diffuse + animated Voronoi caustics on up-facing
// surfaces + exponential-squared water fog + height-weighted sway. Fish live in 35-fish.js.

const REEF_VERT = `
  uniform float uTime, uSway, uSwayFreq, uHeight;
  varying vec3 vWorld, vNormal, vColor; varying vec2 vUv; varying float vH;
  void main() {
    mat4 im = mat4(1.);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    vec4 w = modelMatrix * im * vec4(position, 1.);
    float h = clamp(position.y / uHeight, 0., 1.);
    float seed = im[3].x * .37 + im[3].z * .21;
    w.x += sin(uTime * uSwayFreq + seed + w.y * .35) * uSway * h * h;
    w.z += cos(uTime * uSwayFreq * .8 + seed * 1.3 + w.y * .3) * uSway * .6 * h * h;
    vNormal = normalize(mat3(modelMatrix * im) * normal);
    vColor = vec3(1.);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
    vWorld = w.xyz; vH = h; vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const REEF_FRAG = `${GLSL_NOISE}
  uniform vec3 uBase, uFog, uDeep, uSunDir, uLight; uniform float uFogDensity, uCaustic, uCScale, uTime, uEmissive, uTipGlow;
  varying vec3 vWorld, vNormal, vColor; varying vec2 vUv; varying float vH;
  void main() {
    #ifdef FAN
      // Sea fan: a lattice of veins inside a rounded fan outline.
      vec2 q = vUv - vec2(.5, 0.);
      float outline = length(q * vec2(1., .85));
      if (outline > .5 || vUv.y < .02) discard;
      float vein = cellEdge(vUv * vec2(13., 15.), 1.3);
      float trunk = 1. - smoothstep(.0, .02, abs(q.x)) ;
      if (vein > .06 && trunk < .5) discard;
    #endif
    vec3 n = normalize(vNormal); if (!gl_FrontFacing) n = -n;
    float diff = max(dot(n, uSunDir), 0.) * .75 + .32;
    float up = clamp(n.y * .5 + .5, 0., 1.);
    float cs = caustic(vWorld.xz * uCScale + vec2(vWorld.y * .07), uTime * .9) * uCaustic * up * up * smoothstep(-6., -.5, vWorld.y);
    vec3 albedo = uBase * vColor;
    vec3 c = albedo * uLight * (diff + cs) + albedo * uEmissive + albedo * uTipGlow * vH * vH * vH;
    float dist = length(vWorld - cameraPosition);
    float f = 1. - exp(-uFogDensity * uFogDensity * dist * dist);
    // Deeper surfaces sit in bluer, darker water.
    float depthK = clamp(-vWorld.y / 60., 0., 1.);
    c = mix(c, mix(uFog, uDeep, depthK), clamp(f + depthK * .6, 0., 1.));
    gl_FragColor = vec4(c, 1.);
  }`;

function reefMaterial({ base = '#ffffff', sway = 0, swayFreq = 0.8, height = 1, emissive = 0.04, tipGlow = 0, caustic = 1, side = THREE.FrontSide, defines = {} }) {
  const r = CONFIG.reef;
  return new THREE.ShaderMaterial({
    side, defines,
    uniforms: {
      uTime: { value: 0 }, uSway: { value: sway }, uSwayFreq: { value: swayFreq }, uHeight: { value: height },
      uBase: { value: col(base) }, uFog: { value: col(r.fog) }, uDeep: { value: col(r.domeBottom) }, uSunDir: { value: new THREE.Vector3(0.3, 1, 0.2).normalize() },
      uLight: { value: new THREE.Vector3(1.05, 1.18, 1.2) }, uFogDensity: { value: r.fogDensity }, uCaustic: { value: r.caustic * caustic },
      uCScale: { value: r.causticScale }, uEmissive: { value: emissive }, uTipGlow: { value: tipGlow },
    },
    vertexShader: REEF_VERT, fragmentShader: REEF_FRAG,
  });
}

/** Seabed height: low dunes and ridges, then the reef wall drops into the blue. */
function reefFloor(x, z) {
  const r = CONFIG.reef;
  let y = (fbm2(x * 0.06 + 10, z * 0.06) - 0.45) * 5 + Math.sin(x * 0.25 + z * 0.08) * 0.35;
  // Gentle valley along the camera path so the sides rise into the view.
  y += Math.min(1, Math.abs(x) / 30) ** 2 * 6;
  const drop = smooth(seg(z, r.dropZ[0], r.dropZ[1]));
  y -= drop * 70 + drop * (fbm2(x * 0.2, z * 0.2) - 0.5) * 6;
  return y;
}

function buildSeabed(scene, mats) {
  const geo = new THREE.PlaneGeometry(200, 200, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, reefFloor(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const m = reefMaterial({ base: CONFIG.reef.sand, emissive: 0.03 });
  mats.push(m);
  scene.add(new THREE.Mesh(geo, m));
}

function bumpyRock(seed) {
  const geo = mergeVerticesSafe(new THREE.IcosahedronGeometry(1, 3));
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.72 + fbm2(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.3) * 0.7;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
/** Icosahedron faces are not shared, so bumps would crack. Weld by position first. */
function mergeVerticesSafe(geo) {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const pos = geo.attributes.position, map = new Map(), verts = [], index = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let id = map.get(key);
    if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(pos.getX(i), pos.getY(i), pos.getZ(i)); }
    index.push(id);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((verts.length / 3) * 2).fill(0), 2));
  out.setIndex(index);
  return out;
}

function scatter(scene, mats, { geo, mat, count, seed, place, colors }) {
  const mesh = new THREE.InstancedMesh(geo, mat, count), rnd = mulberry32(seed), d = new THREE.Object3D();
  mats.push(mat);
  for (let i = 0; i < count; i++) {
    place(rnd, d);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    if (colors) mesh.setColorAt(i, col(colors[Math.floor(rnd() * colors.length)]).multiplyScalar(0.75 + rnd() * 0.5));
  }
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/** Tall additive light shafts that hang from the surface and sway a little. */
function buildShafts(scene, count, seed) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: col('#9ff6ff') }, uK: { value: 0.16 } },
    vertexShader: `varying vec2 vUv; varying float vSeed; void main() { vUv = uv; vSeed = modelMatrix[3].x * .13 + modelMatrix[3].z * .07;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `${GLSL_NOISE} uniform float uTime, uK; uniform vec3 uColor; varying vec2 vUv; varying float vSeed;
      void main() { float x = abs(vUv.x - .5) * 2.; float s = (1. - x * x) * smoothstep(0., .7, vUv.y);
        s *= .55 + .45 * vnoise(vec2(vUv.x * 6. + vSeed * 9., uTime * .25 + vSeed));
        gl_FragColor = vec4(uColor * s * uK, 1.); }`,
  });
  const rnd = mulberry32(seed), group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const w = 2 + rnd() * 5, m = new THREE.Mesh(new THREE.PlaneGeometry(w, 70), mat);
    m.position.set((rnd() - 0.5) * 50, 14, 40 - rnd() * 90);
    m.rotation.z = (rnd() - 0.5) * 0.35;
    group.add(m);
  }
  scene.add(group);
  return { group, mat };
}

function initReef(gfx) {
  const r = CONFIG.reef;
  const scene = new THREE.Scene();
  const camera = createZoneCamera();
  const dome = createDome(r.domeTop, r.domeBottom);
  dome.material.uniforms.uShaft.value = 0.35;
  scene.add(dome);
  const mats = [];
  buildSeabed(scene, mats);

  // Rocks and boulders, some crusted with colour.
  const rockColors = [r.rock, r.rock, r.rock, '#1b6f7c', '#7a2d86', '#b8336a'];
  scatter(scene, mats, {
    geo: bumpyRock(3), mat: reefMaterial({ base: '#ffffff', emissive: 0.05 }), count: r.rocks, seed: 11, colors: rockColors,
    place(rnd, d) {
      const x = (rnd() - 0.5) * 60, z = 50 - rnd() * 82, s = 0.6 + rnd() * rnd() * 3.2;
      d.position.set(x, reefFloor(x, z) + s * 0.1, z); d.scale.set(s * (1 + rnd() * 0.6), s * (0.45 + rnd() * 0.4), s); d.rotation.set(0, rnd() * 6.28, 0);
    },
  });
  // Tube sponges in small clusters.
  const tube = new THREE.CylinderGeometry(0.28, 0.2, 1.8, 14, 6, true); tube.translate(0, 0.9, 0);
  scatter(scene, mats, {
    geo: tube, mat: reefMaterial({ sway: 0.12, height: 1.8, emissive: 0.1, tipGlow: 0.9, side: THREE.DoubleSide }), count: r.sponges, seed: 23, colors: r.sponge,
    place(rnd, d) {
      const c = Math.floor(rnd() * 14), cx = Math.sin(c * 12.9) * 16, cz = 44 - (c / 14) * 74;
      const x = cx + (rnd() - 0.5) * 2.2, z = cz + (rnd() - 0.5) * 2.2, s = 0.6 + rnd() * 0.9;
      d.position.set(x, reefFloor(x, z) - 0.1, z); d.scale.set(s, s * (0.7 + rnd() * 0.9), s); d.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6.28, (rnd() - 0.5) * 0.4);
    },
  });
  // Sea fans: flat lattices standing across the current.
  const fan = new THREE.PlaneGeometry(2.6, 2.4, 6, 8); fan.translate(0, 1.2, 0);
  scatter(scene, mats, {
    geo: fan, mat: reefMaterial({ sway: 0.35, height: 2.4, emissive: 0.18, tipGlow: 0.5, side: THREE.DoubleSide, defines: { FAN: 1 } }), count: r.fans, seed: 31, colors: r.fan,
    place(rnd, d) {
      const x = (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 14), z = 46 - rnd() * 76, s = 0.8 + rnd() * 1.2;
      d.position.set(x, reefFloor(x, z) - 0.05, z); d.scale.setScalar(s); d.rotation.set(0, (rnd() - 0.5) * 0.8, 0);
    },
  });
  // Kelp: crossed ribbons in groves on both sides of the path.
  const ribbon = new THREE.PlaneGeometry(0.55, 12, 1, 28); ribbon.translate(0, 6, 0);
  const ribbon2 = ribbon.clone(); ribbon2.rotateY(Math.PI / 2);
  const kelpGeo = mergeGeometries([ribbon, ribbon2]);
  scatter(scene, mats, {
    geo: kelpGeo, mat: reefMaterial({ sway: 1.5, swayFreq: 0.7, height: 12, emissive: 0.06, side: THREE.DoubleSide, caustic: 0.6 }),
    count: countFor(r, 'kelp'), seed: 41, colors: ['#1d9a70', '#2eb57a', '#12806c', '#46c08a'],
    place(rnd, d) {
      const side = rnd() < 0.5 ? -1 : 1, x = side * (5 + rnd() * rnd() * 20), z = 48 - rnd() * 76, s = 0.6 + rnd() * 0.8;
      d.position.set(x, reefFloor(x, z) - 0.2, z); d.scale.set(1, s, 1); d.rotation.set(0, rnd() * 3.14, 0);
    },
  });

  // The reef edge: a dense band of sponges and fans right where the floor drops away.
  scatter(scene, mats, {
    geo: tube, mat: reefMaterial({ sway: 0.12, height: 1.8, emissive: 0.14, tipGlow: 1.2, side: THREE.DoubleSide }), count: r.edge, seed: 57, colors: r.sponge,
    place(rnd, d) {
      const x = (rnd() - 0.5) * 36, z = r.dropZ[0] + 4 - rnd() * 7, s = 0.7 + rnd() * 1.3;
      d.position.set(x, reefFloor(x, z) - 0.1, z); d.scale.set(s, s * (0.8 + rnd()), s); d.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5);
    },
  });
  scatter(scene, mats, {
    geo: fan, mat: reefMaterial({ sway: 0.35, height: 2.4, emissive: 0.22, tipGlow: 0.6, side: THREE.DoubleSide, defines: { FAN: 1 } }), count: Math.round(r.edge / 6), seed: 59, colors: r.fan,
    place(rnd, d) {
      const x = (rnd() - 0.5) * 34, z = r.dropZ[0] + 3 - rnd() * 6, s = 0.7 + rnd() * 0.8;
      d.position.set(x, reefFloor(x, z) - 0.05, z); d.scale.setScalar(s); d.rotation.set(0, (rnd() - 0.5) * 0.8, 0);
    },
  });
  const shafts = buildShafts(scene, 14, 5);
  const school = createSchool(scene);
  const snow = createWrapPoints({ count: 900, box: [40, 24, 40], size: 0.6, color: '#bff8ff', seed: 9, opacity: 0.5 });
  scene.add(snow);

  gfx.onResize((W, H, dpr) => { fitCamera(camera, W / H); snow.material.uniforms.uDpr.value = dpr; });
  const fwd = new THREE.Vector3(), target = new THREE.Vector3();
  return {
    id: 'reef', scene, camera, mats: [...mats, shafts.mat],
    update(p, time, dt) {
      const pose = poseAt(r.path, p);
      aim(camera, pose.pos, pose.yaw, pose.pitch);
      camera.updateMatrixWorld();
      dome.position.copy(camera.position);
      for (const m of mats) m.uniforms.uTime.value = time;
      shafts.mat.uniforms.uTime.value = time;
      shafts.group.children.forEach((s) => { s.rotation.y = camera.rotation.y; });
      dome.material.uniforms.uTime.value = time;
      const su = snow.material.uniforms;
      su.uCam.value.copy(camera.position); su.uTime.value = time; su.uVel.value = vel.k;
      // The school swims ahead of the diver, above the seabed.
      camera.getWorldDirection(fwd);
      fwd.y = Math.max(fwd.y, -0.25); fwd.normalize();
      target.copy(camera.position).addScaledVector(fwd, CONFIG.fish.lead);
      target.y = Math.max(target.y, reefFloor(target.x, target.z) + 2.5);
      school.update(dt, time, target, camera);
    },
    render(renderer) { renderer.render(scene, camera); },
  };
}
