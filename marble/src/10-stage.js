/* ───────── stage: renderer, studio sweep, lights, bloom, material kit ───────── */
function makeWoodTexture() {
  const n = CONFIG.table.grainPx, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d'), rnd = mulberry32(7);
  g.fillStyle = COLOR.woodA; g.fillRect(0, 0, n, n);
  // long grain lines that wobble, drawn twice for seamless wrap across the top edge
  for (let i = 0; i < 260; i++) {
    const y0 = rnd() * n, amp = 2 + rnd() * 10, freq = (1 + Math.floor(rnd() * 3)) * TAU / n, ph = rnd() * TAU;
    g.strokeStyle = rnd() < 0.7 ? COLOR.woodB : '#d4622e';
    g.globalAlpha = 0.08 + rnd() * 0.22; g.lineWidth = 0.6 + rnd() * 2.6;
    for (const off of [0, n, -n]) {
      g.beginPath();
      for (let x = 0; x <= n; x += 8) { const y = y0 + off + Math.sin(x * freq + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  return tex;
}

function createMaterials() {
  const lacquer = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: CONFIG.light.env });
  const acrylic = (color, transmission = 0.55) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transmission, thickness: 0.25, ior: 1.49,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: CONFIG.light.env, side: THREE.DoubleSide });
  const wood = makeWoodTexture();
  return {
    lacquer, acrylic,
    tomato: lacquer(COLOR.tomato), sun: lacquer(COLOR.sun), emerald: lacquer(COLOR.emerald), cobalt: lacquer(COLOR.cobalt), pink: lacquer(COLOR.pink), ink: lacquer(COLOR.ink),
    wood: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.28, envMapIntensity: 0.6 }),
    woodTex: wood,
    brass: new THREE.MeshStandardMaterial({ color: COLOR.brass, metalness: 1, roughness: 0.22, envMapIntensity: 2.1 }),
    chrome: new THREE.MeshStandardMaterial({ color: COLOR.chrome, metalness: 1, roughness: 0.16, envMapIntensity: 1.25 }),
    rope: new THREE.MeshStandardMaterial({ color: COLOR.rope, roughness: 0.9 }),
  };
}

function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dprNow());
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, CONFIG.camera.near, CONFIG.camera.far);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // studio sweep: a gradient dome that ignores lights, fog matches its horizon so the floor melts into it
  const horizon = new THREE.Color(COLOR.studioHorizon);
  scene.fog = new THREE.Fog(horizon, 60, 190);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(COLOR.studioTop) }, bottom: { value: horizon } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.);\n#include <colorspace_fragment>\n}',
  }));
  scene.add(dome);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(230, 64), new THREE.MeshStandardMaterial({ color: COLOR.floor, roughness: 0.92 }));
  floor.rotation.x = -PI / 2; floor.position.y = -CONFIG.table.thick - 2.4; floor.receiveShadow = true;
  scene.add(floor);

  const L = CONFIG.light;
  scene.add(new THREE.HemisphereLight('#bfe8ff', COLOR.floor, L.hemi));
  const key = new THREE.DirectionalLight('#fff4e6', L.key);
  const keyDir = V(...L.keyDir).normalize();
  key.castShadow = true;
  key.shadow.mapSize.setScalar(isMobile() ? L.shadowMapMobile : L.shadowMap);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const sc = key.shadow.camera; sc.near = 1; sc.far = 120;
  scene.add(key, key.target);
  let lastSpan = 0;
  /** The shadow box follows the camera target and shrinks for close shots, so close-ups keep crisp shadows. */
  const aimShadow = (target, dist) => {
    const span = clamp(dist * L.shadowPerDist, L.shadowMin, L.shadowMax);
    key.target.position.copy(target);
    key.position.copy(target).addScaledVector(keyDir, 50);
    if (Math.abs(span - lastSpan) > 0.01) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.updateProjectionMatrix(); lastSpan = span;
    }
  };

  const size = new THREE.Vector2(innerWidth, innerHeight);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const B = CONFIG.bloom;
  const bloom = new UnrealBloomPass(size, B.strength, B.radius, B.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    renderer.setPixelRatio(dprNow());
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setPixelRatio(dprNow());
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
  };
  addEventListener('resize', resize);
  resize();
  return { renderer, scene, camera, composer, aimShadow, render: () => composer.render() };
}

/** Adds a mesh that casts and receives shadows. */
function solid(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A cylinder between two points (posts, rods, ropes). */
function rod(a, b, r, mat, parent, seg = 10) {
  const len = a.distanceTo(b);
  const m = solid(new THREE.CylinderGeometry(r, r, len, seg), mat, parent);
  placeRod(m, a, b);
  return m;
}
const _rodDir = new THREE.Vector3();
function placeRod(m, a, b) {
  const len = a.distanceTo(b);
  _rodDir.subVectors(b, a).normalize();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, _rodDir);
  m.scale.set(1, len / m.geometry.parameters.height, 1);
}
