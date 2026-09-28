/* ───────── spread 2: city. Parallel-fold buildings, windows that swing open, a bus on a pull-tab track ───────── */
const CITY = {
  back: { z: -0.9, d: 0.45, list: [ // [x, w, h, colour]
    [-2.6, 0.7, 2.0, COLORS.cobalt], [-1.75, 0.75, 2.3, COLORS.teal], [-0.85, 0.6, 1.75, COLORS.pink],
    [0.8, 0.65, 2.2, COLORS.tomato], [1.65, 0.8, 1.8, COLORS.cobalt], [2.55, 0.7, 2.35, COLORS.emerald],
  ] },
  front: { z: 0.2, d: 0.35, list: [
    [-2.2, 0.8, 1.1, COLORS.tomato], [-1.2, 0.7, 1.3, COLORS.white], [1.2, 0.75, 1.0, COLORS.teal], [2.3, 0.8, 1.25, COLORS.pink],
  ] },
  window: { w: 0.12, h: 0.16, gapX: 0.2, gapY: 0.27, top: 0.2, bottom: 0.3, open: 1.95 },
  windows: [0.28, 0.66], // u window over which all shutters open, each at its own moment
  sun: { x: -1.3, z: -1.35, h: 2.45, r: 0.36 },
  road: { z: 1.2, x0: 0.12, x1: 3.08, w: 0.5 },
  bus: { rise: [0.1, 0.22], go: [0.2, 0.46], back: [0.62, 0.84], x: [0.72, 2.45] },
  lollies: [[-2.7, 1.1, 0.55, COLORS.emerald], [-2.25, 1.25, 0.42, COLORS.sun], [-0.55, 1.05, 0.5, COLORS.pink]],
  word: { x: -1.95, z: 1.5 },
};

function createCity(book, font) {
  return makeSpread(book, 2, (kit) => {
    const C = CITY, pieces = [], shutters = [], rnd = mulberry32(21);
    const add = (piece, rule) => { kit.track(piece.hinge ?? piece.group); pieces.push({ piece, rule }); return piece; };
    const W = C.window, t = CONFIG.paper.thick;

    function building(x, w, h, color, z, d, layer, delay) {
      const b = add(box(kit.side(x), { x, z, dir: -1, layer, w, h, d, color, side: shade(color, 0.22), roof: shade(color, 0.4) }), { d: delay });
      const cols = Math.max(1, Math.floor((w - 0.1) / W.gapX)), rows = Math.max(1, Math.floor((h - W.top - W.bottom) / W.gapY));
      const x0 = -((cols - 1) * W.gapX) / 2, lights = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = x0 + c * W.gapX - W.w / 2, wy = W.bottom + r * W.gapY;
        lights.push(rectShape(W.w, W.h, wx, wy));
        const hg = new THREE.Group(); hg.position.set(wx, wy, t / 2 + 0.005); b.body.add(hg);
        const sh = cut(rectShape(W.w, W.h, 0, 0), shade(color, 0.35), 0.006);
        sh.castShadow = false; hg.add(sh);
        shutters.push({ hg, at: rnd() });
      }
      b.body.add(glue(lights, color === COLORS.white ? COLORS.sun : COLORS.white));
      b.body.add(glue(rectShape(0.16, 0.24, -0.08, 0), COLORS.ink));
      return b;
    }
    // sun on a stalk behind the skyline
    const sun = add(flap(kit.side(C.sun.x), { x: C.sun.x, z: C.sun.z, dir: -1, layer: 0 }), { d: 0.3 });
    sun.body.add(cut(rectShape(0.035, C.sun.h - C.sun.r), COLORS.white));
    sun.body.add(cut(circleShape(C.sun.r, 0, C.sun.h - C.sun.r), COLORS.pink));
    sun.body.add(glue(circleShape(C.sun.r * 0.62, 0, C.sun.h - C.sun.r), COLORS.tomato));
    C.back.list.forEach(([x, w, h, color], i) => building(x, w, h, color, C.back.z, C.back.d, 1 + (i % 2), 0.18 + (i % 3) * 0.06));
    C.front.list.forEach(([x, w, h, color], i) => building(x, w, h, color, C.front.z, C.front.d, 4 + (i % 2), 0.02 + (i % 2) * 0.06));
    C.lollies.forEach(([x, z, h, color], i) => {
      const f = add(flap(kit.left, { x, z, dir: -1, layer: 7 }), { d: 0.1 + i * 0.05 });
      f.body.add(cut(rectShape(0.04, h), COLORS.teal));
      f.body.add(cut(circleShape(0.16, 0, h), color));
    });

    // road, slot and the bus
    const R = C.road, road = new THREE.Group(); road.position.set(0, lift(1), R.z); road.rotation.x = -HALF_PI; kit.right.add(road); kit.track(road);
    road.add(cut(rectShape(R.x1 - R.x0, R.w, R.x0, -R.w / 2), COLORS.ink));
    road.add(glue(rectShape(R.x1 - R.x0 - 0.2, 0.03, R.x0 + 0.1, -0.015), '#050a2a'));
    for (let x = R.x0 + 0.1; x < R.x1 - 0.2; x += 0.34) road.add(glue(rectShape(0.16, 0.025, x, R.w / 2 - 0.07), COLORS.white));
    const bus = add(flap(kit.right, { x: C.bus.x[0], z: R.z, dir: 1, layer: 6 }), { ev: C.bus.rise });
    bus.body.add(cut(roundRectShape(1.0, 0.5, 0.1, -0.5, 0.07), COLORS.tomato));
    bus.body.add(glue(roundRectShape(0.82, 0.16, 0.04, -0.44, 0.33), COLORS.white));
    for (let k = 1; k < 5; k++) bus.body.add(glue(rectShape(0.025, 0.16, -0.44 + k * 0.164, 0.33), COLORS.tomato, t / 2 + 0.003));
    bus.body.add(glue(rectShape(0.9, 0.04, -0.45, 0.22), COLORS.sun));
    bus.body.add(glue(circleShape(0.035, -0.46, 0.17), COLORS.sun));
    const wheels = [-0.3, 0.3].map((wx) => {
      const wg = new THREE.Group(); wg.position.set(wx, 0.1, t); bus.body.add(wg);
      wg.add(cut(circleShape(0.1, 0, 0), COLORS.ink));
      wg.add(glue(rectShape(0.13, 0.03, -0.065, -0.015), COLORS.white));
      return wg;
    });
    const tab = new THREE.Group(); tab.position.set(R.x1 - 0.55, lift(3), R.z); tab.rotation.x = -HALF_PI; kit.right.add(tab); kit.track(tab);
    tab.add(cut(roundRectShape(0.8, 0.26, 0.1, 0, -0.13), COLORS.pink));
    tab.add(glue(circleShape(0.055, 0.68, 0), COLORS.white));
    kit.track(flatWord(kit.left, font, 'CITY', { x: C.word.x, z: C.word.z, size: 0.3, color: COLORS.cobalt, layer: 3 }));

    return (o, u, time) => {
      for (const { piece, rule } of pieces) piece.set(rule.ev ? eventRise(u, rule.ev[0], rule.ev[1], o) : baseRise(o, rule.d));
      const gate = seg(o, 0.5, 1);
      const [w0, w1] = C.windows;
      shutters.forEach(({ hg, at }) => {
        const a = lerp(w0, w1 - 0.08, at);
        hg.rotation.y = -W.open * backOut(Math.min(win(u, a, a + 0.08), gate));
      });
      const go = win(u, C.bus.go[0], C.bus.go[1]) - win(u, C.bus.back[0], C.bus.back[1]);
      const bx = lerp(C.bus.x[0], C.bus.x[1], go * gate);
      bus.hinge.position.x = bx;
      wheels.forEach((wg) => { wg.rotation.z = -(bx - C.bus.x[0]) / 0.1; });
      tab.position.x = R.x1 - 0.55 + (0.1 + go * 0.5) * gate;
      if (!reduce) bus.body.position.y = Math.abs(Math.sin(time * 9)) * 0.012 * (go > 0.02 && go < 0.98 ? 1 : 0);
    };
  });
}
