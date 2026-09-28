/* ───────── shared spread helpers ───────── */
/** Base layer: rises with the page opening, each piece starting at its own openness delay d. */
const baseRise = (o, d) => backOut(seg(o, d, Math.min(1, d + 0.45)));
/** Later event inside the spread (u window), collapsing again as soon as the page starts to close. */
const eventRise = (u, a, b, o) => backOut(Math.min(win(u, a, b), seg(o, 0.45, 0.95)));
/** Spring-like settle for springs and spouts: 0 at k = 0, rings a little, then 1. */
const elastic = (k) => (k <= 0 ? 0 : 1 - Math.cos(k * PI * 3.5) * Math.exp(-k * 4.5) * (1 - k * 0.02));
/** Darker tone of a card colour for shutters, backings and shading layers. */
const shade = (c, k = 0.3) => '#' + new THREE.Color(c).lerp(new THREE.Color(COLORS.ink), k).getHexString();
const tint = (c, k = 0.3) => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k).getHexString();

/** Wraps a spread builder: pieces hide while the spread is fully closed. */
function makeSpread(book, s, build) {
  const { left, right } = book.anchors(s);
  const groups = [];
  const kit = {
    left, right,
    side: (x) => (x < 0 ? left : right),
    track(g) { groups.push(g); return g; },
  };
  const update = build(kit);
  let shown = true;
  return (t, time) => {
    const o = book.openness(s), vis = o > 0.001;
    if (vis !== shown) { groups.forEach((g) => { g.visible = vis; }); shown = vis; }
    if (vis) update(o, t - s, time);
  };
}

/* ───────── cover: pop-up title standing on the closed book ───────── */
function createCover(book, font) {
  const cfg = CONFIG.cover, bk = CONFIG.book;
  const anchor = book.leaves[0].recto;
  const size = cfg.titleSize, res = font.data.resolution;
  const text = 'POP-UP', colors = [COLORS.sun, COLORS.white, COLORS.sun, COLORS.pink, COLORS.sun, COLORS.white];
  const adv = [...text].map((ch) => (font.data.glyphs[ch].ha / res) * size);
  const total = adv.reduce((a, b) => a + b, 0);
  let x = (bk.pageW + bk.boardPad) / 2 - total / 2;
  const letters = [...text].map((ch, i) => {
    const f = flap(anchor, { x, z: cfg.titleZ, layer: 1 + i });
    const shapes = font.generateShapes(ch, size);
    const face = cut(shapes, colors[i]);
    const backing = cut(shapes, COLORS.ink);
    backing.position.set(size * 0.06, -size * 0.05, -CONFIG.paper.thick * 1.1);
    // a small V-fold wedge behind each letter, like a real pop-up title
    const wedge = cut(rectShape(adv[i] * 0.35, size * 0.55, adv[i] * 0.3, 0), COLORS.white);
    wedge.position.z = -CONFIG.paper.thick * 2.4;
    f.body.add(face, backing, wedge);
    x += adv[i];
    // the wedge opens with the letter and lies flat against it when folded
    return { set(e) { f.set(e); wedge.rotation.y = 0.9 * clamp01(e); } };
  });

  const intro = { k: reduce ? 1 : 0 };
  if (!reduce) gsap.to(intro, { k: 1, duration: cfg.introMs / 1000, ease: 'none', delay: 0.25 });
  const cue = $('#cue');

  return (t) => {
    const fold = 1 - win(t, cfg.fold[0], cfg.fold[1]);
    letters.forEach((f, i) => {
      const n = letters.length, stag = i / n;
      const up = backOut(seg(intro.k, stag * 0.45, stag * 0.45 + 0.55), 2.4);
      const down = seg(fold, stag * 0.3, stag * 0.3 + 0.7);
      f.set(Math.min(up, backOut(down)));
    });
    cue.style.opacity = reduce ? 1 : 1 - win(t, cfg.cueOut[0], cfg.cueOut[1]);
  };
}

/* ───────── back cover: the book shuts, the magnetic button comes in ───────── */
function createBackCover() {
  const cfg = CONFIG.back, fin = $('#fin-copy'), magnet = $('#magnet'), label = magnet.querySelector('span');
  if (!reduce) {
    magnet.addEventListener('pointermove', (e) => {
      const r = magnet.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(magnet, { x: dx * 0.45, y: dy * 0.45, duration: 0.4, ease: 'power3.out' });
      gsap.to(label, { x: dx * 0.2, y: dy * 0.2, duration: 0.4, ease: 'power3.out' });
    });
    magnet.addEventListener('pointerleave', () => gsap.to([magnet, label], { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }));
  }
  return (t) => {
    const k = reduce ? 1 : win(t - 5, cfg.finIn[0], cfg.finIn[1]);
    fin.style.opacity = k;
    fin.style.transform = `translateY(${(1 - k) * 40}px) scale(${0.7 + 0.3 * backOut(k)})`;
    fin.classList.toggle('on', k > 0.5);
  };
}
