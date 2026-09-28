/* ───────── renderer, camera, post ───────── */
function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.render.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const cc = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(cc.vfov, 1, cc.near, cc.far);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const b = CONFIG.bloom;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), b.strength, b.radius, b.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resizers = [];
  function fit() {
    const W = innerWidth, H = innerHeight, dpr = dprNow();
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    camera.aspect = W / H;
    // Portrait screens: widen the vertical FOV so the horizontal view never drops below minHfov.
    const needV = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cc.minHfov) / 2) / camera.aspect);
    camera.fov = clamp(Math.max(cc.vfov, THREE.MathUtils.radToDeg(needV)), cc.vfov, cc.maxVfov);
    camera.updateProjectionMatrix();
    resizers.forEach((f) => f(W, H, dpr));
  }
  addEventListener('resize', fit);
  return { renderer, scene, camera, composer, fit, onResize: (f) => resizers.push(f) };
}

/* ───────── polished concrete: lit floor + additive planar reflection ───────── */
function concreteTexture() {
  const size = 512, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), rnd = mulberry32(7);
  const base = new THREE.Color(CONFIG.floor.color);
  g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, size, size);
  // Soft mottling, then fine aggregate specks.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size, y = rnd() * size, r = 20 + rnd() * 90, a = 0.025 + rnd() * 0.05;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() < 0.5 ? '255,255,255' : '0,0,0';
    grad.addColorStop(0, `rgba(${tone},${a})`); grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.14)';
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const REFLECT_VS = `
uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
void main() { vUv = textureMatrix * vec4(position, 1.); vWorld = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const REFLECT_FS = `
uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStrength, uRough;
varying vec4 vUv; varying vec3 vWorld;
${HASH}
void main() {
  // Jitter the projected lookup with two octaves of noise: a clean mirror reads as glass, a jittered one as polished concrete.
  vec2 n = vec2(fbm(vWorld.xz * 3.1), fbm(vWorld.xz * 3.1 + 17.3)) - .5;
  vec4 uv = vUv; uv.xy += n * uRough * uv.w;
  vec3 r = texture2DProj(tDiffuse, uv).rgb;
  float blotch = .75 + .5 * fbm(vWorld.xz * .35);
  gl_FragColor = vec4(r * color * uStrength * blotch, 1.);
}`;

function buildFloorReflection(world) {
  const cfg = CONFIG.render;
  const geo = new THREE.PlaneGeometry(60, 140);
  const reflector = new Reflector(geo, {
    textureWidth: 512, textureHeight: 512, color: 0xffffff, multisample: 0,
    shader: { name: 'ConcreteReflection', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: cfg.reflectStrength }, uRough: { value: cfg.reflectRough } },
      vertexShader: REFLECT_VS, fragmentShader: REFLECT_FS },
  });
  // Additive on top of the lit floor: dark concrete stays dark, bright things (spots, neon, screen) mirror into it.
  Object.assign(reflector.material, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(15, 0.004, -60);
  reflector.renderOrder = 1;
  world.scene.add(reflector);
  world.onResize((W, H, dpr) => {
    const k = (isMobile() ? cfg.reflectScaleMobile : cfg.reflectScale) * dpr;
    reflector.getRenderTarget().setSize(Math.round(W * k), Math.round(H * k));
  });
  return reflector;
}

/* ───────── rooms: floor, ceiling, walls with door openings ───────── */
function wallMaterial(room) {
  return new THREE.MeshStandardMaterial({ color: room.wall, roughness: 0.92, metalness: 0, emissive: new THREE.Color(room.mood).multiplyScalar(room.moodK) });
}

/** A wall along one axis with an optional rectangular opening. along: 'x' (runs across x at fixed z) or 'z'. */
function addWall(group, mat, { along, fixed, from, to, h, opening }) {
  const T = CONFIG.wallT;
  const piece = (a, b, y0, y1) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return;
    const len = b - a, mid = (a + b) / 2;
    const geo = along === 'x' ? new THREE.BoxGeometry(len, y1 - y0, T) : new THREE.BoxGeometry(T, y1 - y0, len);
    const m = new THREE.Mesh(geo, mat);
    if (along === 'x') m.position.set(mid, (y0 + y1) / 2, fixed); else m.position.set(fixed, (y0 + y1) / 2, mid);
    m.receiveShadow = true;
    group.add(m);
  };
  const lo = Math.min(from, to), hi = Math.max(from, to);
  if (!opening) { piece(lo, hi, 0, h); return; }
  const c = opening.c ?? 0;
  piece(lo, c - opening.w / 2, 0, h);
  piece(c + opening.w / 2, hi, 0, h);
  piece(c - opening.w / 2, c + opening.w / 2, opening.h, h);
}

function buildRooms(world, floorMap) {
  const T = CONFIG.wallT, groups = {};
  for (const room of CONFIG.rooms) {
    const g = new THREE.Group(); g.name = room.id;
    const [x0, x1] = room.x, [z0, z1] = room.z, w = x1 - x0, d = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const fm = floorMap.clone(); fm.needsUpdate = true; fm.repeat.set(w / 5, d / 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: fm, roughness: CONFIG.floor.roughness, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; g.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: room.ceil, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, room.h, cz); g.add(ceil);
    const mat = wallMaterial(room);
    addWall(g, mat, { along: 'x', fixed: z0 - T / 2, from: x0, to: x1, h: room.h, opening: room.front });
    addWall(g, mat, { along: 'x', fixed: z1 + T / 2, from: x0, to: x1, h: room.h, opening: room.back });
    addWall(g, mat, { along: 'z', fixed: x0 + T / 2, from: z0, to: z1, h: room.h });
    addWall(g, mat, { along: 'z', fixed: x1 - T / 2, from: z0, to: z1, h: room.h, opening: room.right && { c: room.right.z, w: room.right.w, h: room.right.h } });
    world.scene.add(g);
    groups[room.id] = g;
  }
  return groups;
}

/* ───────── gallery spotlights with additive light cones ───────── */
const CONE_VS = `
varying vec2 vUv; varying vec3 vN, vV;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const CONE_FS = `
uniform vec3 uColor; uniform float uStrength;
varying vec2 vUv; varying vec3 vN, vV;
void main() {
  float t = 1. - vUv.y;                        // 0 at the lamp, 1 at the far end
  // pow() bases are kept above zero: ANGLE computes pow as exp2(y * log2(x)), and log2(0) turned into NaN pixels
  // that the bloom pass then smeared into large black blocks (2026-09-28).
  float along = smoothstep(0., .08, t) * pow(max(1. - t, 1e-4), 1.6);
  float edge = pow(max(abs(dot(vN, vV)), 1e-4), 2.2);   // soft rim: the cone fades where we look along its surface
  gl_FragColor = vec4(uColor * uStrength * along * edge, 1.);
}`;

function addSpot(parent, { pos, target, color = '#fff2df', intensity, angle, penumbra, cone = 0.05, shadow = false, shadowSize = 1024 }) {
  const light = new THREE.SpotLight(color, intensity, 0, angle, penumbra, 2);
  light.position.set(...pos);
  light.target.position.set(...target);
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02; light.shadow.radius = 6;
    light.shadow.camera.near = 0.5; light.shadow.camera.far = 14;
  }
  parent.add(light, light.target);

  // The lamp body: a short dark can so the cone visibly starts somewhere.
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.26, 16), new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.5, metalness: 0.6 }));
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false }));
  glowDisc.position.y = -0.131; glowDisc.rotation.x = Math.PI / 2;
  can.add(glowDisc);
  const from = new THREE.Vector3(...pos), to = new THREE.Vector3(...target), dir = to.clone().sub(from).normalize();
  can.position.copy(from);
  can.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  parent.add(can);

  let mesh = null;
  if (cone > 0) {
    // Stops short of the lit surface: a cone that pierces the wall draws a dotted seam where they meet.
    const L = from.distanceTo(to) * 0.94, r = L * Math.tan(angle * 0.92);
    const geo = new THREE.ConeGeometry(r, L, 40, 1, true);
    geo.translate(0, -L / 2, 0);
    mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: CONE_VS, fragmentShader: CONE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: cone } },
    }));
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    mesh.renderOrder = 2;
    parent.add(mesh);
  }
  return { light, cone: mesh, base: intensity };
}

/** Dim metal environment for the sculptures only (walls stay lit by real lamps, not by an environment). */
function metalEnvironment(renderer) {
  const env = new RoomEnvironment(renderer);
  env.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.color.set('#2a1418'); }
    else if (o.material.isMeshBasicMaterial) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.6); }
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
