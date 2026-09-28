/* ───────── boot ───────── */
const stage = createStage($('#gl'));
const names = Object.keys(CONFIG.images);
Promise.all(names.map(loadTexture)).then((list) => {
  const textures = Object.fromEntries(names.map((n, i) => [n, list[i]]));
  const env = skyEnvironment(stage.renderer, textures.sky);
  initHero(stage, env);
  initBubbles(stage, textures);
  initHolo(stage, textures);
  initMelt(stage, env);
  initFlight(stage, env, textures);
  initFinale(stage, env);
  ScrollTrigger.refresh();
  stage.setReady();
}).catch((e) => console.error('CHROME failed to start', e));
// Registered last so every scene has updated its state before the shared renderer draws.
gsap.ticker.add((time, deltaMs) => stage.frame(time, deltaMs / 1000));
