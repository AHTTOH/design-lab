/* ───────── boot and the single frame loop ───────── */
/** Which zones draw at dive position u, with their local progress and the dissolve amount between them. */
function zonesAt(u, count) {
  const b = Math.round(u), w = CONFIG.blend;
  if (!reduce && b > 0 && b < count && Math.abs(u - b) < w) {
    return { a: b - 1, pa: 1, b, pb: 0, mix: smooth((u - (b - w)) / (2 * w)) };
  }
  const i = clamp(Math.floor(u), 0, count - 1);
  return { a: i, pa: clamp01(u - i), b: -1, pb: 0, mix: 0 };
}

async function boot() {
  // The title is drawn into a canvas, so its face must be loaded first.
  const faces = await document.fonts.load(CONFIG.surface.font);
  if (!faces.length) console.error('DEEP SEA: display font did not load:', CONFIG.surface.font);

  const gfx = createRenderer($('#gl'));
  const surface = initSurface(gfx);
  const zones = [surface, initReef(gfx), initTwilight(gfx), initMidnight(gfx), initAbyss(gfx), initResurface(gfx, surface.surfaceTitle.tex)];
  if (zones.length !== runways.length) throw new Error(`zones (${zones.length}) and scroll runways (${runways.length}) differ`);
  const drift = createDrift(gfx);
  gfx.zonePass.overlay = drift;
  const hud = createHud();
  gfx.fit();
  for (const z of zones) gfx.renderer.compile(z.scene, z.camera);
  const byId = Object.fromEntries(zones.map((z) => [z.id, z]));
  const fin = gfx.finalPass.uniforms;

  if (new URLSearchParams(location.search).has('debug')) window.__deepsea = { THREE, gfx, zones, diveU, lenis };
  let lastU = -1, dirty = true, prev = performance.now();
  addEventListener('resize', () => { dirty = true; });
  if (reduce) addEventListener('scroll', () => { dirty = true; }, { passive: true });

  function frame(now) {
    requestAnimationFrame(frame);
    if (lenis) lenis.raf(now);
    if (document.hidden) return;                 // paused while the tab is hidden
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    const u = diveU();
    if (reduce && !dirty && u === lastU) return; // reduced motion: draw only when the view changes
    dirty = false; lastU = u;
    const time = reduce ? STILL_TIME : now / 1000;
    stepVelocity();
    stepLook();

    const s = zonesAt(u, zones.length);
    const A = zones[s.a], B = s.b >= 0 ? zones[s.b] : null;
    A.update(reduce ? STILL[A.id] : s.pa, time, dt);
    if (B) B.update(s.pb, time, dt);
    gfx.zonePass.a = A; gfx.zonePass.b = B; gfx.zonePass.mix = s.mix; gfx.zonePass.time = time;
    drift.update(u, time);

    const weight = (z) => (z === A ? 1 - s.mix : z === B ? s.mix : 0);
    const mid = byId.midnight, abyss = byId.abyss;
    const fw = weight(mid);
    if (fw > 0) fin.uFlash.value.set(mid.state.flashScreen.x, mid.state.flashScreen.y, fw);
    else fin.uFlash.value.z = 0;
    const hw = weight(abyss);
    fin.uHeat.value = hw;
    if (hw > 0) abyss.state.vents.forEach((v, i) => fin.uVents.value[i].copy(v));
    fin.uTime.value = time; fin.uVel.value = vel.k;

    hud(u);
    gfx.composer.render(dt);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { dirty = true; prev = performance.now(); });
}
boot().catch((e) => console.error('DEEP SEA failed to start', e));
