/* ───────── zone 6: rising back to the light ───────── */
// Bubbles carry the camera up. The water behind them is the same rippling-surface shader as zone 1, starting dark and
// deep and brightening as the diver climbs, so the dive ends where it began.

const BUBBLE_VERT = `
  uniform float uTime, uClimb, uSpan; attribute vec3 aBase; attribute float aSize, aSpeed;
  varying vec3 vN, vV;
  void main() {
    vec3 b = aBase;
    b.y = mod(b.y + uTime * aSpeed + uClimb * (.6 + aSpeed * .2), uSpan) - uSpan * .5;
    b.x += sin(uTime * 2.1 * aSpeed + aBase.z) * .25 * aSize;
    b.z += cos(uTime * 1.7 * aSpeed + aBase.x) * .25 * aSize;
    vec3 p = position * aSize;
    p.y *= .85 + .15 * sin(uTime * 6. + aBase.x * 9.);   // wobble
    vec4 mv = viewMatrix * vec4(b + p, 1.);
    vN = normalize(mat3(viewMatrix) * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const BUBBLE_FRAG = `
  uniform vec3 uTint; uniform float uK; varying vec3 vN, vV;
  void main() {
    vec3 n = normalize(vN);
    float f = 1. - abs(dot(n, normalize(vV)));
    float rim = f * f * f * 1.4;
    float spec = max(dot(n, normalize(vec3(-.4, .7, .6))), 0.); spec = spec * spec; spec = spec * spec; spec = spec * spec; spec = spec * spec;
    gl_FragColor = vec4((uTint * rim + vec3(1.) * spec * 1.6) * uK, 1.);
  }`;

function initResurface(gfx, titleTexture) {
  const r = CONFIG.resurface;
  const scene = new THREE.Scene();
  const camera = createZoneCamera();
  const bgScene = new THREE.Scene(), bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const surface = createSurfaceQuad(titleTexture);
  bgScene.add(surface);
  const su = surface.material.uniforms;

  const N = countFor(r, 'bubbles'), rnd = mulberry32(808);
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.SphereGeometry(1, 18, 14));
  const base = new Float32Array(N * 3), size = new Float32Array(N), speed = new Float32Array(N);
  const SPAN = 40;
  for (let i = 0; i < N; i++) {
    const small = rnd() < 0.8;
    base[i * 3] = (rnd() - 0.5) * 26; base[i * 3 + 1] = (rnd() - 0.5) * SPAN; base[i * 3 + 2] = -2 - rnd() * 26;
    size[i] = small ? 0.04 + rnd() * 0.12 : 0.2 + rnd() * 0.5; speed[i] = small ? 1.4 + rnd() * 1.6 : 0.7 + rnd() * 0.8;
  }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uClimb: { value: 0 }, uSpan: { value: SPAN }, uTint: { value: col('#9ff6ff') }, uK: { value: 1 } },
    vertexShader: BUBBLE_VERT, fragmentShader: BUBBLE_FRAG,
  });
  const bubbles = new THREE.Mesh(geo, mat);
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  const colors = r.colors.map(col);

  gfx.onResize((W, H) => {
    fitCamera(camera, W / H);
    su.uAspect.value = W / H;
    su.uTanHalf.value = Math.tan(THREE.MathUtils.degToRad(W / H < 1 ? 74 : CONFIG.camera.vfov) / 2);
  });
  const s = CONFIG.surface;
  return {
    id: 'resurface', scene, camera, mats: [mat, surface.material],
    update(p, time) {
      aim(camera, [0, 0, 6], 0, lerp(0.1, 0.55, smooth(p)));
      camera.updateMatrixWorld();
      mat.uniforms.uTime.value = time;
      mat.uniforms.uClimb.value = p * r.climb;
      // Background: the surface from far below, climbing; dark at first, bright at the end.
      const light = smooth(seg(p, 0.05, 0.95));
      su.uTime.value = time;
      su.uDepth.value = lerp(60, 2.2, Math.pow(light, 0.8));
      su.uPitch.value = lerp(0.5, 0.95, light) + look.y * CONFIG.look.pitch;
      su.uYaw.value = -look.x * CONFIG.look.yaw * 1.5;
      su.uDark.value = 1 - light;
      su.uTitleK.value = 0;
      su.uRays.value = s.rays * light * (1 + vel.k * 0.3);
      // Bubble rim tint follows the water colour from navy to turquoise.
      const k = light * (colors.length - 1), i = Math.min(colors.length - 2, Math.floor(k));
      mat.uniforms.uTint.value.copy(colors[i]).lerp(colors[i + 1], k - i).lerp(col('#dffcff'), 0.45);
      mat.uniforms.uK.value = 0.7 + light * 0.6;
    },
    render(renderer) {
      renderer.render(bgScene, bgCam);
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = auto;
    },
  };
}
