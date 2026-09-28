/* ───────── boot ───────── */
function loadFont() {
  return new Promise((resolve, reject) => new FontLoader().load(CONFIG.fontUrl, resolve, undefined,
    (e) => reject(new Error(`font failed to load: ${e?.message ?? e}`))));
}

const stage = createStage($('#gl'));
const place = createCameraRig(stage.camera);
paperKit.grain = makeGrain();

Promise.all([loadFont(), loadImage('cover'), loadImage('back')]).then(([font, cover, back]) => {
  const book = createBook(stage.scene, { cover, back });
  const updaters = [
    createCover(book, font),
    createForest(book, font),
    createCity(book, font),
    createOcean(book, font),
    createSpace(book, font),
    createBackCover(),
  ];
  timeline.measure();

  let lastT = -1, lastW = 0;
  function frame(time) {
    const t = timeline.now();
    // reduced motion draws only when the snapped spread or the viewport changes
    if (reduce && t === lastT && innerWidth === lastW) return;
    lastT = t; lastW = innerWidth;
    const clock = reduce ? 0 : time;
    book.update(t);
    updaters.forEach((u) => u(t, clock));
    stage.setBackdrop(t);
    stage.setFog(place(t, clock));
    stage.renderer.render(stage.scene, stage.camera);
  }
  gsap.ticker.add((time) => { if (!document.hidden) frame(time); });
  addEventListener('resize', () => { lastT = -1; });
}).catch((e) => console.error('POP-UP failed to start', e));
