/* ───────── shared GLSL and scene helpers ───────── */
const GLSL_NOISE = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }
// Animated Voronoi edge distance (F2 - F1). Thin bright webs between cells read as caustics.
float cellEdge(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p); float f1 = 8., f2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 h = hash22(i + g);
    vec2 o = .5 + .42 * sin(t + 6.2831 * h);
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return f2 - f1;
}
float caustic(vec2 p, float t) {
  p += (vec2(vnoise(p * .6 + t * .1), vnoise(p * .6 - t * .1 + 4.)) - .5) * .9;   // bend the cells into organic webs
  float a = cellEdge(p, t), b = cellEdge(p * 1.7 + 3.1, t * 1.3 + 1.7);
  float ca = 1. - smoothstep(0., .16, a), cb = 1. - smoothstep(0., .12, b);
  return ca * ca * .75 + cb * cb * .55 + ca * cb * 1.2;
}`;

/** Big inverted sphere with a vertical gradient: downwelling light above, dark water below. Follows its camera. */
function createDome(top, bottom, radius = 400) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: col(top) }, uBottom: { value: col(bottom) }, uShaft: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `${GLSL_NOISE}
      uniform vec3 uTop, uBottom; uniform float uShaft, uTime; varying vec3 vDir;
      void main() {
        float y = vDir.y * .5 + .5;
        vec3 c = mix(uBottom, uTop, smoothstep(.12, .95, y));
        // Faint light shafts from above, fixed in world so they parallax with the camera.
        float a = atan(vDir.x, vDir.z);
        float s = fbm(vec2(a * 5., uTime * .05)) * smoothstep(.45, 1., y);
        c += uTop * uShaft * s * s * 1.6;
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** A zone camera: perspective, YXZ so yaw/pitch compose like a diver's head. */
function createZoneCamera(fov = CONFIG.camera.vfov) {
  const c = CONFIG.camera;
  const cam = new THREE.PerspectiveCamera(fov, 1, c.near, c.far);
  cam.rotation.order = 'YXZ';
  cam.userData.baseFov = fov;
  return cam;
}
/** Portrait screens widen the vertical FOV so the horizontal view never drops below minHfov. */
function fitCamera(cam, aspect) {
  const c = CONFIG.camera, base = cam.userData.baseFov;
  const needV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(c.minHfov) / 2) / aspect));
  cam.aspect = aspect;
  cam.fov = clamp(Math.max(base, needV), base, c.maxVfov);
  cam.updateProjectionMatrix();
}

/** Soft round sprite texture for glows, drawn once. */
function glowTexture() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.12)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  return t;
}
const GLOW = glowTexture();
function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: col(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size);
  return s;
}

/** Points that wrap inside a box around the camera, so a finite cloud reads as endless water. */
function createWrapPoints({ count, box, size, color, seed, opacity = 1, twinkle = 0, flash = false }) {
  const rnd = mulberry32(seed), pos = new Float32Array(count * 3), rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * box[0]; pos[i * 3 + 1] = (rnd() - 0.5) * box[1]; pos[i * 3 + 2] = (rnd() - 0.5) * box[2];
    rand[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) }, uSize: { value: size }, uColor: { value: col(color) },
      uTime: { value: 0 }, uOpacity: { value: opacity }, uTwinkle: { value: twinkle }, uFall: { value: 0.25 }, uDpr: { value: 1 },
      uFlashDir: { value: new THREE.Vector3(0, 0, -1) }, uFlashK: { value: 0 }, uVel: { value: 0 },
    },
    vertexShader: `
      uniform vec3 uCam, uBox, uFlashDir; uniform float uSize, uTime, uFall, uDpr, uFlashK, uVel, uTwinkle;
      attribute float aRand; varying float vA;
      void main() {
        vec3 p = position; p.y -= uTime * uFall * (.5 + aRand); p.x += sin(uTime * .3 + aRand * 40.) * .3;
        p = mod(p - uCam + uBox * .5, uBox) - uBox * .5;   // wrap around the camera
        vec3 w = uCam + p;
        vec4 mv = viewMatrix * vec4(w, 1.);
        float d = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uDpr * (.6 + aRand) * 30. / max(d, .5);
        float edge = 1. - smoothstep(.36, .5, max(max(abs(p.x) / uBox.x, abs(p.y) / uBox.y), abs(p.z) / uBox.z));
        float tw = mix(1., .5 + .5 * sin(uTime * (1.5 + aRand * 3.) + aRand * 60.), uTwinkle);
        // Specks inside the flashlight cone light up.
        float beam = smoothstep(.93, .985, dot(normalize(p), uFlashDir)) * uFlashK * 5.;
        vA = edge * (tw + beam) * smoothstep(40., 6., d) * (1. + uVel * .8);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main() { vec2 q = gl_PointCoord - .5; float r = dot(q, q); if (r > .25) discard;
        gl_FragColor = vec4(uColor * uOpacity * vA * (1. - r * 4.), 1.); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.flash = flash;
  return pts;
}
