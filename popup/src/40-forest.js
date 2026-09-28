/* ───────── spread 1: forest. Layered trees fold up, a deer rises on a V-fold, birds flap on pull-tabs ───────── */
const FOREST = {
  pines: [ // back row, lies forward. [x, width, height, colour]
    [-2.7, 0.9, 2.2, COLORS.teal], [-1.95, 1.0, 2.55, COLORS.leaf], [-1.1, 0.85, 2.05, COLORS.teal], [-0.45, 0.7, 1.7, COLORS.leaf],
    [0.55, 0.75, 2.3, COLORS.teal], [1.35, 0.9, 1.9, COLORS.leaf], [2.1, 1.0, 2.6, COLORS.teal], [2.8, 0.66, 2.0, COLORS.leaf],
  ],
  pineZ: -1.2,
  rounds: [ // middle row. [x, canopy radius, trunk height, colour]
    [-2.4, 0.42, 0.75, COLORS.emerald], [-1.5, 0.36, 0.95, COLORS.sun], [-0.65, 0.3, 0.6, COLORS.pink],
    [0.72, 0.34, 0.7, COLORS.orange], [1.75, 0.4, 0.9, COLORS.emerald], [2.65, 0.32, 0.65, COLORS.sun],
  ],
  roundZ: -0.3,
  hillZ: 1.0,
  deer: { x: 1.3, z: 0.45, rise: [0.04, 0.2] },
  birds: [ // stalk x, z, stalk height, colour, facing
    { x: -1.4, z: 0.35, h: 1.9, color: COLORS.pink, face: 1 },
    { x: -0.6, z: 0.7, h: 1.45, color: COLORS.cobalt, face: -1 },
    { x: 2.35, z: 0.6, h: 2.05, color: COLORS.sun, face: -1 },
  ],
  birdRise: [0.18, 0.3], pull: [0.3, 0.74], word: { x: -3.0, z: 1.48 },
};

const DEER_BODY = [[-0.36, 0], [-0.29, 0], [-0.24, 0.42], [-0.18, 0.42], [-0.16, 0], [-0.09, 0], [-0.06, 0.5], [0.28, 0.5], [0.33, 0], [0.4, 0], [0.42, 0.44], [0.47, 0.44],
  [0.5, 0], [0.57, 0], [0.58, 0.6], [0.66, 0.8], [0.62, 0.86], [0.5, 0.84], [-0.18, 0.86], [-0.28, 1.02], [-0.3, 1.18], [-0.2, 1.3], [-0.3, 1.27], [-0.38, 1.24],
  [-0.62, 1.1], [-0.64, 1.03], [-0.42, 1.01], [-0.36, 0.92], [-0.36, 0.62], [-0.3, 0.5]];
const DEER_ANTLER = [[-0.35, 1.22], [-0.32, 1.46], [-0.44, 1.58], [-0.4, 1.62], [-0.29, 1.52], [-0.24, 1.7], [-0.19, 1.68], [-0.25, 1.48], [-0.12, 1.53], [-0.11, 1.48], [-0.26, 1.4], [-0.29, 1.22]];
const BIRD_BODY = [[-0.2, 0.02], [0.08, -0.02], [0.2, 0.04], [0.28, 0.1], [0.22, 0.14], [0.12, 0.12], [-0.06, 0.14], [-0.22, 0.16], [-0.32, 0.24], [-0.28, 0.1]];
const BIRD_WING = [[-0.1, 0], [0.1, 0], [0.02, 0.32], [-0.08, 0.26]];

function createForest(book, font) {
  return makeSpread(book, 1, (kit) => {
    const F = FOREST, pieces = [];
    const add = (piece, rule) => { kit.track(piece.hinge ?? piece.group); pieces.push({ piece, rule }); return piece; };

    // front hills per page, highest layer so they lie on top when folded
    [[-1.62, -3.1, -0.08], [1.62, 0.08, 3.1]].forEach(([, x0, x1], i) => {
      const f = add(flap(kit.side(x0), { z: F.hillZ, dir: -1, layer: 8 }), { d: 0 });
      f.body.add(cut(waveShape(x0, x1, 0.34, 0.08, 2.5, i * 1.7), COLORS.leaf));
      f.body.add(glue(waveShape(x0 + 0.05, x1 - 0.05, 0.18, 0.05, 3.5, i * 2.1 + 1), COLORS.emerald));
    });
    F.rounds.forEach(([x, r, th, color], i) => {
      const f = add(flap(kit.side(x), { x, z: F.roundZ, dir: -1, layer: 5 + (i % 2) }), { d: 0.08 + (i % 3) * 0.05 });
      f.body.add(cut(rectShape(0.1, th + r * 0.5), COLORS.teal));
      const crown = cut(circleShape(r, 0, th + r * 0.7), color);
      crown.position.z = 0.004; f.body.add(crown);
      const inner = cut(circleShape(r * 0.62, r * 0.12, th + r * 0.58), shade(color, 0.16)); inner.position.z = 0.004 + CONFIG.paper.thick; f.body.add(inner);
    });
    F.pines.forEach(([x, w, h, color], i) => {
      const f = add(flap(kit.side(x), { x, z: F.pineZ, dir: -1, layer: i % 3 }), { d: 0.2 + (i % 4) * 0.07 });
      f.body.add(cut(pineShape(w, h, 4 + (i % 2)), color));
    });

    // deer on a V-fold, rises after the page has settled
    const deer = add(vfold(kit.right, { x: F.deer.x, z: F.deer.z, w: 0.34, h: 0.8, layer: 10 }), { ev: F.deer.rise });
    deer.body.add(cut(polyShape(DEER_BODY), COLORS.tomato));
    const antler = cut(polyShape(DEER_ANTLER), COLORS.sun); antler.position.z = -0.006; deer.body.add(antler);
    const antler2 = cut(polyShape(DEER_ANTLER.map(([px, py]) => [px + 0.12, py])), shade(COLORS.sun, 0.15)); antler2.position.z = -0.012; deer.body.add(antler2);
    [[0.1, 0.72], [0.28, 0.68], [0.2, 0.6], [0.02, 0.62], [0.38, 0.76]].forEach(([dx, dy]) => deer.body.add(glue(circleShape(0.03, dx, dy), COLORS.white)));
    deer.body.add(glue(circleShape(0.028, -0.47, 1.12), COLORS.ink));

    // birds on stalks, driven by pull-tabs sticking out of the front edge
    const birds = F.birds.map((b, i) => {
      const f = add(flap(kit.side(b.x), { x: b.x, z: b.z, dir: 1, layer: 12 }), { ev: [F.birdRise[0] + i * 0.03, F.birdRise[1] + i * 0.03] });
      const sway = new THREE.Group(); f.body.add(sway);
      sway.add(cut(rectShape(0.035, b.h), COLORS.white));
      const bird = new THREE.Group(); bird.position.y = b.h; bird.scale.x = b.face; sway.add(bird);
      bird.add(cut(polyShape(BIRD_BODY), b.color));
      bird.add(glue(circleShape(0.018, 0.17, 0.08), COLORS.ink));
      const beak = cut(polyShape([[0.27, 0.08], [0.36, 0.1], [0.27, 0.12]]), COLORS.orange); bird.add(beak);
      const wings = [1, -1].map((s) => {
        const hg = new THREE.Group(); hg.position.set(0, 0.13, 0); bird.add(hg);
        hg.add(cut(polyShape(BIRD_WING), s > 0 ? tint(b.color, 0.35) : shade(b.color, 0.25)));
        return { hg, s };
      });
      // pull tab: lies on the page and slides out past the front edge
      const tabRoot = kit.side(b.x);
      const tab = new THREE.Group(); tab.position.set(b.x, lift(2), CONFIG.book.pageD / 2 - 0.5); tab.rotation.x = -HALF_PI; tabRoot.add(tab);
      tab.add(cut(roundRectShape(0.28, 0.72, 0.1, -0.14, -0.72), COLORS.tomato));
      tab.add(glue(circleShape(0.06, 0, -0.62), COLORS.white));
      kit.track(tab);
      return { f, sway, wings, tab, i };
    });
    kit.track(flatWord(kit.left, font, 'FOREST', { x: F.word.x, z: F.word.z, size: 0.26, color: COLORS.tomato, layer: 3 }));

    return (o, u, time) => {
      for (const { piece, rule } of pieces) piece.set(rule.ev ? eventRise(u, rule.ev[0], rule.ev[1], o) : baseRise(o, rule.d));
      const live = reduce ? 0 : time;
      const gate = seg(o, 0.5, 1);
      birds.forEach(({ sway, wings, tab, i }) => {
        const p = seg(u, F.pull[0] + i * 0.02, F.pull[1]);
        const pull = (0.5 - 0.5 * Math.cos(p * PI * 4)) * gate; // out and back twice
        tab.position.z = CONFIG.book.pageD / 2 - 0.5 + pull * 0.42 + 0.14 * gate;
        sway.rotation.z = (pull - 0.3) * 0.35 * (i % 2 ? -1 : 1) + Math.sin(live * 0.9 + i) * 0.03;
        const beat = 0.25 + 0.75 * pull + 0.15;
        const a = 0.35 + Math.sin(live * (6 + i) + i * 1.3) * 0.75 * beat;
        wings.forEach(({ hg, s }) => { hg.rotation.x = s * a; });
      });
    };
  });
}
