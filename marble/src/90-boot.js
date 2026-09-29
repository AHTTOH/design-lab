/* ───────── boot ───────── */
function boot() {
  const T = CONFIG.time;
  const stage = createStage($('#gl'));
  const mats = createMaterials();
  createTable(stage.scene, mats);
  const start = createStart(stage.scene, mats);
  const dominoes = createDominoes(stage.scene, mats);
  const helix = createSeesawHelix(stage.scene, mats);
  const funnel = createFunnelXylo(stage.scene, mats, helix.entry);
  const gears = createGears(stage.scene, mats);
  const finale = createFinale(stage.scene, mats, gears);

  const marbleB = makeMarble(mats, { glass: '#ff3d6e', vane: COLOR.white });
  stage.scene.add(marbleB);
  const B = createActor(marbleB, CONFIG.marble.r, [...helix.legs, ...funnel.legs]);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.marble.ballR, 40, 28), mats.chrome);
  ball.castShadow = true;
  stage.scene.add(ball);
  const Cb = createActor(ball, CONFIG.marble.ballR, finale.legs);

  const focus = createFocus([
    { from: 0, at: start.A.peek },
    { from: T.rollA[1], at: dominoes.focus },
    { from: T.seesaw[0], at: helix.focus },
    { from: T.launch + 0.01, at: B.peek },
    { from: T.bucket[0] + 0.02, at: gears.focus },
    { from: T.flagTop + 0.06, at: gears.catapultFocus },
    { from: gears.release, at: Cb.peek },
    { from: T.bounce[0] + 0.03, at: finale.focus },
  ]);
  const place = createCameraRig(stage.camera, focus);
  const overlay = createOverlay();
  timeline.measure();

  let lastT = -1, lastW = 0, lastH = 0, settling = false;
  addEventListener('pointermove', () => { settling = !reduce; });
  const frame = (ms) => {
    const t = timeline.now(), clockSec = reduce ? 0 : ms / 1000;
    overlay(t);
    // draw only when something changed: scroll, size, pointer parallax easing, or the running fan and cloth
    const live = !reduce && (finale.needsClock(t) || settling);
    if (t === lastT && innerWidth === lastW && innerHeight === lastH && !live) return;
    lastT = t; lastW = innerWidth; lastH = innerHeight;
    start.update(t);
    dominoes.update(t);
    helix.update(t);
    funnel.update(t);
    gears.update(t);
    finale.update(t, clockSec);
    B.update(t);
    Cb.update(t);
    const view = place(t);
    settling = view.settling;
    stage.aimShadow(view.target, view.d);
    stage.render();
  };
  const loop = (ms) => {
    requestAnimationFrame(loop);
    if (lenis) lenis.raf(ms);
    if (document.hidden) return; // paused while the tab is hidden
    frame(ms);
  };
  requestAnimationFrame(loop);
  addEventListener('resize', () => { lastT = -1; timeline.measure(); });
}

document.fonts.load('800 100px Unbounded')
  .catch((e) => console.error('display font failed to load', e))
  .then(() => {
    try { boot(); } catch (e) { console.error('MARBLE RUN failed to start', e); }
  });
