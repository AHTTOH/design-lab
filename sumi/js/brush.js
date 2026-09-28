/* Scene 3: 여백 written stroke by stroke. Centrelines are hand-placed in a 1000×2100 box (여 on top, 백 below),
   in Korean stroke order. A blurred twin of the same strokes underneath reads as ink soaking into the paper. */

const BRUSH_WORD = {
  viewBox: [1000, 2100],
  strokes: [
    // 여: ㅇ, then ㅕ short bars top and bottom, then the long vertical
    { d: 'M332,262 C205,248 108,356 112,478 C118,610 218,690 322,680 C436,668 504,580 492,466 C482,356 410,284 300,272', w: 66, end: 'fly', seed: 3 },
    { d: 'M548,372 C602,362 650,360 712,368', w: 54, end: 'needle', seed: 5 },
    { d: 'M544,566 C600,556 650,556 710,564', w: 56, end: 'needle', seed: 7 },
    { d: 'M760,112 C770,352 772,622 756,936', w: 86, end: 'needle', seed: 9 },
    // 백: ㅂ (left, right, middle bar, bottom bar), ㅐ (vertical, tick, vertical), ㄱ
    { d: 'M170,1172 C176,1330 178,1480 172,1622', w: 62, end: 'dew', seed: 11 },
    { d: 'M470,1162 C478,1330 480,1480 474,1622', w: 62, end: 'dew', seed: 13 },
    { d: 'M176,1390 C280,1382 380,1382 468,1388', w: 48, end: 'needle', seed: 15 },
    { d: 'M166,1628 C280,1620 390,1620 486,1628', w: 56, end: 'fly', seed: 17 },
    { d: 'M640,1132 C646,1330 648,1530 640,1742', w: 68, end: 'dew', seed: 19 },
    { d: 'M646,1420 C690,1416 730,1416 776,1420', w: 48, end: 'needle', seed: 21 },
    { d: 'M842,1102 C850,1342 852,1562 842,1782', w: 78, end: 'needle', seed: 23 },
    { d: 'M190,1872 C380,1860 580,1856 760,1868 C800,1872 812,1882 806,1912 C796,1962 780,2012 758,2072', w: 68, end: 'needle', seed: 25 },
  ],
};

{
  const cfg = CONFIG.brush;
  const word = { ...BRUSH_WORD, strokes: BRUSH_WORD.strokes.map((s) => ({ ...s, w: s.w * cfg.widthGain })) };
  const ink = buildBrushSvg($('#brush-ink'), { ...word, id: 'bw', bristles: cfg.bristles });
  const bleed = buildBrushSvg($('#brush-bleed'), { ...word, id: 'bb', bristles: 4 });
  const ghost = $('#brush-ghost');
  $('#brush-bleed').style.filter = `blur(${cfg.bleedBlurPx}px)`;
  const plan = strokeSchedule(ink.lengths, cfg.strokeFrom, cfg.strokeTo, cfg.gapShare);
  const cap = $('#brush-cap'), inkEl = $('#brush-ink'), bleedEl = $('#brush-bleed');

  track('#s-brush', (p) => {
    plan.forEach(([a, b], i) => {
      const t = reduce ? 1 : smooth(seg(p, a, b));
      ink.set(i, t);
      // The soak trails the brush: it keeps spreading a little after the stroke lands.
      bleed.set(i, reduce ? 1 : smooth(seg(p, a + (b - a) * 0.3, b + (b - a) * 0.8)));
    });
    // The far range of the previous scene stays behind the writing as a pale painting.
    ghost.style.opacity = lerp(cfg.ghostFrom, cfg.ghostTo, smooth(segR(p, cfg.ghostOut))) * (1 - smooth(segR(p, cfg.zoom)) * 0.5);
    fadeEl(cap, smooth(segR(p, cfg.capIn)) * (1 - smooth(segR(p, cfg.zoom))));
    // Finish by diving into the last stroke of 백 until the white of the paper fills the screen.
    const z = reduce ? 0 : Math.pow(smooth(segR(p, cfg.zoom)), 2.2);
    const s = 1 + z * (cfg.zoomScale - 1), [ox, oy] = cfg.zoomOrigin;
    const tf = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
    [inkEl, bleedEl].forEach((el) => { el.style.transformOrigin = `${ox * 100}% ${oy * 100}%`; el.style.transform = tf; el.style.opacity = el === bleedEl ? cfg.bleedAlpha * (1 - z * 0.5) : 1 - (1 - cfg.zoomFadeTo) * smooth(seg(z, 0.4, 1)); });
  });
}
