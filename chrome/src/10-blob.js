/* ───────── liquid chrome blob: a subdivided sphere displaced by noise in the vertex shader ───────── */
// Normals are rebuilt from two neighbouring displaced points, so the chrome reflection follows the liquid surface.
const BLOB_HEAD = `
uniform float uTime, uAmp, uFreq, uTwist, uPull, uStretch;
uniform vec3 uPointer;
${SNOISE}
float blobDisp(vec3 p) {
  vec3 q = p * uFreq + vec3(0., uTime * .22, uTime * .07);
  float n = snoise(q) * .7 + snoise(q * 2.13 + 3.7) * .3;
  float pull = pow(max(dot(p, uPointer), 0.), 5.) * uPull;
  return n * uAmp + pull;
}
vec3 blobWarp(vec3 p) {
  float a = p.y * uTwist, c = cos(a), s = sin(a);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z) * (1. + blobDisp(p));
  q.y *= 1. + uStretch;
  return q;
}`;
const BLOB_NORMAL = `
vec3 bp = normalize(position);
vec3 bt1 = normalize(abs(bp.y) > .99 ? cross(bp, vec3(1., 0., 0.)) : cross(bp, vec3(0., 1., 0.)));
vec3 bt2 = cross(bp, bt1);
vec3 blobP = blobWarp(bp);
vec3 objectNormal = normalize(cross(blobWarp(normalize(bp + bt1 * .012)) - blobP, blobWarp(normalize(bp + bt2 * .012)) - blobP));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`;

function createBlob(env, detail) {
  const uniforms = { uTime: { value: 0 }, uAmp: { value: .08 }, uFreq: { value: 1.2 }, uTwist: { value: 0 }, uPull: { value: 0 }, uStretch: { value: 0 },
    uPointer: { value: new THREE.Vector3(0, 0, 1) } };
  const material = chromeMaterial(env, { roughness: CONFIG.hero.roughness });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BLOB_HEAD}`)
      .replace('#include <beginnormal_vertex>', BLOB_NORMAL)
      .replace('#include <begin_vertex>', 'vec3 transformed = blobP;');
  };
  // Unit sphere; blobWarp works on the normalised position, so detail only sets smoothness.
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Pointer direction in the blob's local space, eased so the bulge flows instead of snapping. */
function pointerBulge(blob, rect, ease) {
  const idle = performance.now() - blob.lastMove > 2500;
  const t = performance.now() / 1000;
  const nx = idle ? Math.sin(t * .4) * .6 : (pointer.x / rect.width) * 2 - 1;
  const ny = idle ? Math.cos(t * .31) * .4 : 1 - ((pointer.y - rect.top) / rect.height) * 2;
  const target = new THREE.Vector3(nx, ny, .9).normalize().applyQuaternion(blob.mesh.quaternion.clone().invert());
  blob.uniforms.uPointer.value.lerp(target, ease).normalize();
}

/* ───────── 01 hero ───────── */
function initHero(stage, env) {
  const cfg = CONFIG.hero, pin = $('#hero-pin'), chars = $$('#hero-title .ch'), kor = $('#hero-kor');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(cfg.fov, 1, .1, 100);
  const blob = createBlob(env, isMobile() ? cfg.detailMobile : cfg.detail);
  blob.lastMove = -1e9;
  addEventListener('pointermove', () => { blob.lastMove = performance.now(); });
  blob.mesh.scale.setScalar(cfg.radius);
  scene.add(blob.mesh);
  const rnd = mulberry32(11);
  const vec = chars.map(() => ({ x: (rnd() - .5) * 60, y: -105 - rnd() * 50, r: (rnd() - .5) * 50 }));
  let prog = 0;

  const pose = (p, time) => {
    const liq = smooth(segR(p, cfg.liquefy)), tw = smooth(segR(p, cfg.twist)) * (1 - smooth(segR(p, cfg.settle)));
    const settle = smooth(segR(p, cfg.settle)), exit = smooth(segR(p, cfg.exit));
    const u = blob.uniforms;
    u.uTime.value = time * cfg.flow * 4;
    u.uAmp.value = lerp(lerpR(cfg.amp, liq), cfg.amp[0] * 1.4, settle);
    u.uFreq.value = lerpR(cfg.freq, liq * (1 - settle));
    u.uTwist.value = tw * cfg.twistMax;
    u.uPull.value = (coarse ? .25 : 1) * cfg.pullMax * (1 - exit);
    u.uStretch.value = settle * .18 - exit * .3;
    blob.mesh.rotation.y = p * cfg.orbitTurns * Math.PI * 2 + tilt.x * cfg.tiltYaw;
    blob.mesh.rotation.x = tilt.y * cfg.tiltPitch;
    blob.mesh.position.y = .15 + exit * 3.2;
    blob.mesh.scale.setScalar(cfg.radius * (1 + liq * .12 - exit * .5));
  };
  const resize = (W, H) => { camera.aspect = W / H; camera.position.set(0, 0, fitDistance(camera, cfg.camDist, cfg.portraitFit)); camera.updateProjectionMatrix(); };
  const draw = (time, dt, rect) => {
    pose(reduce ? cfg.reduceAt : prog, reduce ? 3 : time);
    if (!reduce) pointerBulge(blob, rect, cfg.pointerEase);
    stage.renderer.render(scene, camera);
  };
  const mode = stage.add({ pin, draw, resize });
  if (!reduce) gsap.from(chars, { yPercent: 110, opacity: 0, stagger: .06, duration: 1.3, ease: 'expo.out', delay: .15 });
  track('#s-hero', (p) => {
    prog = p;
    const k = reduce ? 0 : smooth(segR(p, cfg.title));
    chars.forEach((c, i) => { const v = vec[i]; c.style.transform = `translate(${v.x * k}vw, ${v.y * k}vh) rotate(${v.r * k}deg)`; });
    showBy(kor, p, cfg.kor, -4, 0);
    stage.markDirty();
  }, (on) => { mode.on = on; stage.markDirty(); });
}

/* ───────── 06 finale: blob and a chrome ring lock-up with the title and a magnetic button ───────── */
function initFinale(stage, env) {
  const cfg = CONFIG.finale, pin = $('#fin-pin'), chars = $$('#fin-title .ch'), copy = $('#fin-copy');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(CONFIG.hero.fov, 1, .1, 100);
  const blob = createBlob(env, isMobile() ? CONFIG.hero.detailMobile : CONFIG.hero.detail);
  blob.lastMove = -1e9;
  addEventListener('pointermove', () => { blob.lastMove = performance.now(); });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, .05, 24, 160), chromeMaterial(env, { roughness: .08, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700] }));
  const group = new THREE.Group();
  group.add(blob.mesh, ring);
  group.position.y = .95;
  scene.add(group);
  const rnd = mulberry32(21);
  const vec = chars.map(() => ({ x: (rnd() - .5) * 70, y: (rnd() - .5) * 60, r: (rnd() - .5) * 90 }));
  let prog = 0;
  const resize = (W, H) => { camera.aspect = W / H; camera.position.set(0, 0, fitDistance(camera, CONFIG.hero.camDist + .6, CONFIG.hero.portraitFit)); camera.updateProjectionMatrix(); };
  const draw = (time, dt, rect) => {
    const t = reduce ? 3 : time, g = reduce ? 1 : smooth(segR(prog, cfg.blobIn));
    const u = blob.uniforms;
    u.uTime.value = t; u.uAmp.value = .1; u.uFreq.value = 1.4; u.uTwist.value = 0; u.uPull.value = coarse ? .15 : .4; u.uStretch.value = 0;
    blob.mesh.scale.setScalar(.62 * g);
    ring.scale.setScalar(lerp(2.2, 1, g));
    ring.rotation.set(cfg.ringTilt + tilt.y * .2, t * cfg.ringSpin, .25 + tilt.x * .2);
    group.rotation.y = tilt.x * .3;
    if (!reduce) pointerBulge(blob, rect, CONFIG.hero.pointerEase);
    stage.renderer.render(scene, camera);
  };
  const mode = stage.add({ pin, draw, resize });
  track('#s-finale', (p) => {
    prog = p;
    const k = reduce ? 0 : 1 - smooth(segR(p, cfg.titleIn));
    chars.forEach((c, i) => { const v = vec[i]; c.style.transform = `translate(${v.x * k}vw, ${v.y * k}vh) rotate(${v.r * k}deg)`; c.style.opacity = 1 - k; });
    const c = reduce ? 1 : segR(p, cfg.copyIn);
    copy.style.opacity = c; copy.style.transform = `translateY(${(1 - c) * 40}px)`;
    copy.style.pointerEvents = c > .5 ? 'auto' : 'none';
    stage.markDirty();
  }, (on) => { mode.on = on; stage.markDirty(); });

  const magnet = $('#magnet'), label = magnet.querySelector('span');
  magnet.addEventListener('pointermove', (e) => {
    const r = magnet.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    gsap.to(magnet, { x: dx * .45, y: dy * .45, duration: .4, ease: 'power3.out' });
    gsap.to(label, { x: dx * .2, y: dy * .2, duration: .4, ease: 'power3.out' });
  });
  magnet.addEventListener('pointerleave', () => gsap.to([magnet, label], { x: 0, y: 0, duration: .8, ease: 'elastic.out(1, .4)' }));
  if (!reduce) gsap.to(magnet, { '--spin': '360deg', duration: 6, repeat: -1, ease: 'none' });
}
