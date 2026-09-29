/* SEASONS main loop: wind from the pointer, gusts from scroll speed, one render per frame. */
const gust = spring(CONFIG.velocity.stiffness, CONFIG.velocity.damping);
const windNow = new THREE.Vector3(CONFIG.wind.base, 0, 0);
const windGoal = new THREE.Vector3();
const camRight = new THREE.Vector3(), camFwd = new THREE.Vector3();

/** Pointer x steers wind across the view, pointer y pushes it toward or away from the camera. */
function updateWind() {
  const W = CONFIG.wind;
  camera.getWorldDirection(camFwd); camFwd.y = 0; camFwd.normalize();
  camRight.crossVectors(camFwd, camera.up).normalize();
  const nx = pointer.active ? pointer.nx : 0.35, ny = pointer.active ? pointer.ny : 0;
  const strength = W.base + W.pointer * Math.min(1, Math.hypot(nx, ny));
  windGoal.copy(camRight).multiplyScalar(nx).addScaledVector(camFwd, -ny * 0.6);
  if (windGoal.lengthSq() < 1e-4) windGoal.copy(camRight);
  windGoal.normalize().multiplyScalar(strength);
  windNow.lerp(windGoal, W.ease);
  U.uWind.value.copy(windNow);
  const V = CONFIG.velocity;
  U.uGust.value = Math.max(0, gust.step(Math.min(V.gustMax, Math.abs(velocity()) * V.gust)));
}

let clock = 0, last = performance.now(), stillKey = '';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  if (lenis) lenis.raf(now);

  if (reduce) {
    const st = stillState(), key = `${st.id}:${innerWidth}x${innerHeight}`;
    if (key === stillKey) return;
    stillKey = key;
    U.uTime.value = 12;
    const o = applySeason(st);
    updateCamera(st, 0, o.montage);
    updateWind();
    renderFrame();
    return;
  }

  clock += dt;
  U.uTime.value = clock;
  const st = scrollState();
  const o = applySeason(st);
  SKY.uCloudTime.value += dt * (1 + o.montage * 18 + Math.abs(velocity()) * 0.05 * o.montage);
  updateCamera(st, dt, o.montage);
  updateWind();
  updateWords(st);
  updateMagnet();
  renderFrame();
}

function renderFrame() {
  renderer.render(scene, camera);
  if (sun.shadow.map && !U.uShadowMap.value) {
    U.uShadowMap.value = sun.shadow.map.texture;
    U.uShadowMatrix.value = sun.shadow.matrix;
    U.uShadowOn.value = 1;
    stillKey = '';
  }
}

function onResize() {
  resize();
  measureScenes();
  stillKey = '';
}
addEventListener('resize', onResize);
onResize();
document.fonts.ready.then(measureScenes);
requestAnimationFrame(frame);
