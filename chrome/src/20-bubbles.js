/* ───────── 02 bubbles: instanced soap bubbles with thin-film colour, sky reflection and a noisy pop ───────── */
const BUBBLE_VS = `
attribute float aPop, aSeed;
varying vec3 vN, vW, vLocal;
varying float vPop, vSeed;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(m) * normal); vLocal = position; vPop = aPop; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const BUBBLE_FS = `
uniform sampler2D uSky;
uniform float uTime;
varying vec3 vN, vW, vLocal;
varying float vPop, vSeed;
${EQUI}
${FILM}
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.);
  vec3 v = normalize(cameraPosition - vW);
  float c = clamp(dot(n, v), 0., 1.), fres = pow(1. - c, 2.4);
  // Film gets thinner at the top and swirls with time, so colour bands drift over the shell.
  float th = vLocal.y * 1.1 + sin(vLocal.x * 3.5 + uTime * .9 + vSeed * 12.) * .3 + vnoise(vLocal * 2.4 + uTime * .15 + vSeed * 9.) * .8;
  vec3 irid = film(th + c * 1.4);
  vec3 r = reflect(-v, n);
  vec3 sky = texture2D(uSky, equi(r)).rgb;
  float spec = pow(max(dot(r, normalize(vec3(-.45, .7, .55))), 0.), 90.) * 2.2 + pow(max(dot(r, normalize(vec3(.6, -.25, .75))), 0.), 40.) * .5;
  vec3 col = sky * fres * .95 + irid * (.18 + .8 * fres) + spec;
  float alpha = clamp(.05 + fres * .88 + spec, 0., 1.);
  // Pop: the film tears along noise, the torn edge flashes iridescent.
  float tear = vnoise(vLocal * 7. + vSeed * 31.);
  if (tear < vPop) discard;
  float rim = 1. - smoothstep(0., .07, tear - vPop);
  col = mix(col, irid * 1.6 + .2, rim * step(.001, vPop));
  alpha = max(alpha, rim * step(.001, vPop) * .9);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function initBubbles(stage, textures) {
  const cfg = CONFIG.bubbles, pin = $('#bub-pin'), popWord = $('#pop'), kor = $('#bub-kor');
  const count = isMobile() ? cfg.countMobile : cfg.count;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(cfg.fov, 1, .1, 100);
  camera.position.set(0, 0, cfg.camZ);
  const uniforms = { uSky: { value: textures.sky }, uTime: { value: 0 } };
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pops = new Float32Array(count), seeds = new Float32Array(count);
  const rnd = mulberry32(7);
  const bubbles = Array.from({ length: count }, (_, i) => {
    const big = rnd() < cfg.bigShare;
    seeds[i] = rnd();
    return {
      z: lerpR(cfg.spreadZ, rnd()), r: big ? lerp(.6, cfg.radius[1], rnd()) : lerp(cfg.radius[0], .5, rnd() * rnd()),
      life: lerpR(cfg.life, rnd()), offset: rnd(), phase: rnd() * 6.28, seed: rnd() * 1000, poked: 0,
    };
  });
  geo.setAttribute('aPop', new THREE.InstancedBufferAttribute(pops, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: BUBBLE_VS, fragmentShader: BUBBLE_FS, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const dummy = new THREE.Object3D(), proj = new THREE.Vector3();
  let prog = 0, viewH = 1, viewW = 1;

  const resize = (W, H) => {
    camera.aspect = W / H; camera.updateProjectionMatrix();
    viewH = 2 * Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2)) * cfg.camZ; viewW = viewH * camera.aspect;
  };
  /** Pointer pops the bubble under it; it grows back after a while. */
  const poke = (rect, now) => {
    if (reduce || now - pointer.moved > 120) return;
    const px = pointer.x - rect.left, py = pointer.y - rect.top;
    bubbles.forEach((b, i) => {
      if (b.poked || pops[i] > 0) return;
      dummy.matrix.fromArray(mesh.instanceMatrix.array, i * 16);
      proj.setFromMatrixPosition(dummy.matrix).project(camera);
      const sx = (proj.x * .5 + .5) * rect.width, sy = (-proj.y * .5 + .5) * rect.height;
      const rPx = b.r / (2 * Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2)) * (cfg.camZ - b.z)) * rect.height;
      if (Math.hypot(px - sx, py - sy) < rPx * cfg.pointerPopPx) b.poked = now;
    });
  };
  /** Hash of (bubble, life) so every life starts at a new x and pops at a new height, the same on every load. */
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const layout = (p, time, now) => {
    const pp = reduce ? cfg.reduceAt : p;
    bubbles.forEach((b, i) => {
      // Each bubble lives several times across the scene: born below the screen, rises, pops part way up.
      const t = pp / b.life + b.offset, k = Math.floor(t), f = t - k;
      const depth = (cfg.camZ - b.z) / cfg.camZ;
      const y = lerpR(cfg.rise, f) * viewH * depth;
      const x = (hash(b.seed, k) * 2 - 1) * cfg.spreadX * viewW / 2 * depth + Math.sin(time * .6 + b.phase + pp * 9) * cfg.wobble;
      const popAt = lerpR(cfg.popAt, hash(b.seed + 7, k));
      let pop = reduce ? 0 : clamp01((f - popAt) / (cfg.popLen / b.life));
      if (b.poked) {
        const age = now - b.poked;
        const out = clamp01(age / cfg.popAnimMs), back = clamp01((age - cfg.regrowMs) / cfg.popAnimMs);
        pop = Math.max(pop, out * (1 - back));
        if (back >= 1) b.poked = 0;
      }
      pops[i] = pop;
      const s = b.r * (1 + pop * .12) * (pop >= 1 ? 0 : 1);
      dummy.position.set(x, y, b.z);
      dummy.rotation.set(time * .1 + b.phase, time * .13, 0);
      dummy.scale.setScalar(Math.max(s, 1e-4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    geo.attributes.aPop.needsUpdate = true;
  };
  const draw = (time, dt, rect) => {
    const now = performance.now();
    uniforms.uTime.value = reduce ? 0 : time;
    layout(prog, reduce ? 0 : time, now);
    poke(rect, now);
    stage.renderer.render(scene, camera);
  };
  const mode = stage.add({ pin, draw, resize });
  track('#s-bubbles', (p) => {
    prog = p;
    const k = reduce ? 1 : envelope(p, cfg.popWord);
    popWord.style.opacity = k;
    popWord.style.transform = `translate(-50%, -50%) scale(${reduce ? 1 : lerp(.86, 1.08, p)})`;
    showBy(kor, p, cfg.kor, 5, 0);
    stage.markDirty();
  }, (on) => { mode.on = on; stage.markDirty(); });
}
