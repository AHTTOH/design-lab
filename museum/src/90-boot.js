/* ───────── boot and the single frame loop ───────── */
function loadTexture(name) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(CONFIG.images[name], (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined,
    (e) => reject(new Error(`texture ${name} failed to load: ${e?.message ?? e}`))));
}

async function boot() {
  const names = Object.keys(CONFIG.images);
  const [list] = await Promise.all([
    Promise.all(names.map(loadTexture)),
    // The neon word is drawn into a canvas, so its face must be loaded first.
    document.fonts.load(CONFIG.lobby.font).then((faces) => { if (!faces.length) console.error('MUSEUM: display font did not load:', CONFIG.lobby.font); }),
  ]);
  const textures = Object.fromEntries(names.map((n, i) => [n, list[i]]));

  const world = createWorld($('#gl'));
  const { scene, camera, composer, renderer } = world;
  const h = CONFIG.hemi;
  scene.add(new THREE.HemisphereLight(h.sky, h.ground, h.intensity));
  buildFloorReflection(world);
  buildRooms(world, concreteTexture());
  const env = metalEnvironment(renderer);
  const parts = [initLobby(world), initSculptures(world, env), initLightRoom(world), initVideoRoom(world, textures), initExit(world)];
  initPaintings(world, textures);
  const walk = createWalk();
  const hud = createHud(walk.holds);
  world.fit();
  addEventListener('resize', measureRunways);

  // Inspection hook for the Playwright checks only.
  if (new URLSearchParams(location.search).has('debug')) window.__museum = { THREE, world, walk };
  let lastU = -1, dirty = true, prev = performance.now();
  addEventListener('resize', () => { dirty = true; });
  if (reduce) addEventListener('scroll', () => { dirty = true; }, { passive: true });

  function frame(now) {
    requestAnimationFrame(frame);
    if (lenis) lenis.raf(now);
    if (document.hidden) return;                 // paused while the tab is hidden
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    const time = now / 1000, u = pathU();
    if (reduce && !dirty && u === lastU) return;  // reduced motion: draw only when the view changes
    dirty = false; lastU = u;
    stepTilt();
    const v = reduce ? walk.still(u) : walk.at(u);
    camera.position.copy(v.pos);
    camera.rotation.set(v.pitch - tilt.y * CONFIG.look.pitch, v.yaw - tilt.x * CONFIG.look.yaw, 0);
    for (const p of parts) p.update(u, time, dt);
    hud(u);
    composer.render(dt);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { dirty = true; parts.forEach((p) => p.update(pathU(), performance.now() / 1000, 0)); });
}
boot().catch((e) => console.error('MUSEUM failed to start', e));
