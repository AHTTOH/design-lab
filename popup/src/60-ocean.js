/* ───────── spread 3: ocean. Stacked wave strips rock, a whale rises through a slot, boats bob ───────── */
const OCEAN = {
  rows: [ // z, height, colour. back to front, all lie forward
    [-1.2, 1.25, COLORS.navy], [-0.6, 1.02, COLORS.teal], [0.0, 0.84, COLORS.cobalt], [0.6, 0.62, COLORS.aqua], [1.18, 0.4, COLORS.navy],
  ],
  amp: 0.12, waves: 3.2, rock: 0.075, rockSpeed: 1.25,
  whale: { x: 0.2, z: -0.3, scale: 1.3, rise: [0.08, 0.3], sink: 1.2, leap: 0.55, spout: [0.34, 0.44] },
  boats: [ // row index, side (-1 left, 1 right), x, hull colour, sail colour
    [2, -1, -1.9, COLORS.tomato, COLORS.white], [3, 1, 2.1, COLORS.sun, COLORS.pink], [4, -1, -0.9, COLORS.pink, COLORS.sun], [1, 1, 1.4, COLORS.white, COLORS.tomato],
  ],
  boatRise: [0.36, 0.52],
  clouds: [[-2.1, -1.45, 2.25, 0.9], [1.25, -1.45, 2.5, 1.0]],
  sun: { x: 2.65, z: -1.5, h: 2.7, r: 0.3 },
  word: { x: -3.0, z: 1.52 },
};
const WHALE = [[-1.0, 0.35], [-0.95, 0.55], [-0.7, 0.75], [-0.2, 0.82], [0.3, 0.7], [0.65, 0.5], [0.8, 0.52], [0.95, 0.8], [1.05, 0.78], [0.98, 0.5],
  [1.12, 0.3], [1.02, 0.26], [0.85, 0.38], [0.6, 0.25], [0.2, 0.08], [-0.4, 0.02], [-0.8, 0.12]];
const WHALE_BELLY = [[-0.95, 0.3], [-0.8, 0.13], [-0.4, 0.03], [0.2, 0.09], [0.5, 0.2], [0.2, 0.22], [-0.4, 0.22], [-0.8, 0.3]];

/** Wave crest height: sharp peaks, round troughs, like cut theatre waves. */
function crestY(x, x0, x1, h, amp, waves, phase) {
  const s = ((x - x0) / (x1 - x0)) * waves + phase / (PI * 2);
  return h - amp + 2 * amp * Math.pow(1 - Math.abs(Math.sin(PI * s)), 1.6);
}
const CREST_STEPS = 120;
function crestShape(x0, x1, h, amp, waves, phase) {
  const pts = [[x0, 0], [x1, 0]];
  for (let i = CREST_STEPS; i >= 0; i--) { const x = lerp(x0, x1, i / CREST_STEPS); pts.push([x, crestY(x, x0, x1, h, amp, waves, phase)]); }
  return polyShape(pts);
}
/** Foam band: the top edge of a wave strip, a finger wide. */
function foamShape(x0, x1, h, amp, waves, phase, band) {
  const pts = [];
  for (let i = 0; i <= CREST_STEPS; i++) { const x = lerp(x0, x1, i / CREST_STEPS); pts.push([x, crestY(x, x0, x1, h, amp, waves, phase) - band]); }
  for (let i = CREST_STEPS; i >= 0; i--) { const x = lerp(x0, x1, i / CREST_STEPS); pts.push([x, crestY(x, x0, x1, h, amp, waves, phase) + 0.001]); }
  return polyShape(pts);
}

function createOcean(book, font) {
  return makeSpread(book, 3, (kit) => {
    const O = OCEAN, pieces = [], rows = [];
    const add = (piece, rule) => { kit.track(piece.hinge ?? piece.group); pieces.push({ piece, rule }); return piece; };
    const t = CONFIG.paper.thick;

    const sun = add(flap(kit.side(O.sun.x), { x: O.sun.x, z: O.sun.z, dir: -1, layer: 0 }), { d: 0.35 });
    sun.body.add(cut(rectShape(0.035, O.sun.h - O.sun.r), COLORS.white));
    sun.body.add(cut(circleShape(O.sun.r, 0, O.sun.h - O.sun.r), COLORS.sun));
    O.clouds.forEach(([x, z, h, w], i) => {
      const f = add(flap(kit.side(x), { x, z, dir: -1, layer: 1 }), { d: 0.3 + i * 0.06 });
      f.body.add(cut(rectShape(0.035, h - 0.1), COLORS.white));
      f.body.add(cut(cloudShape(w, w * 0.5), COLORS.white));
      f.body.children[1].position.y = h - 0.15;
    });
    O.rows.forEach(([z, h, color], r) => {
      [[-3.1, -0.06], [0.06, 3.1]].forEach(([x0, x1], side) => {
        const f = add(flap(side ? kit.right : kit.left, { z, dir: -1, layer: 2 + r }), { d: 0.25 - r * 0.05 });
        const phase = r * 1.3 + side * PI * 0.5;
        f.body.add(cut(crestShape(x0, x1, h, O.amp, O.waves, phase), color));
        f.body.add(glue(foamShape(x0, x1, h, O.amp, O.waves, phase, 0.05), COLORS.white));
        rows.push({ f, r, side, h, x0, x1, phase });
      });
    });

    // whale: V-fold support plus a slot, so it climbs out of the sea as it stands
    const whale = add(vfold(kit.right, { x: O.whale.x, z: O.whale.z, w: 0.5, h: 0.6, layer: 9 }), { ev: O.whale.rise });
    const wBody = new THREE.Group(); wBody.scale.setScalar(O.whale.scale); whale.body.add(wBody);
    wBody.add(cut(polyShape(WHALE), COLORS.pink));
    wBody.add(glue(polyShape(WHALE_BELLY), COLORS.white));
    for (let k = 0; k < 5; k++) wBody.add(glue(rectShape(0.3, 0.012, -0.72 + k * 0.1, 0.12 + k * 0.012), shade(COLORS.pink, 0.2), t / 2 + 0.003));
    wBody.add(glue(circleShape(0.035, -0.68, 0.5), COLORS.ink));
    const spout = new THREE.Group(); spout.position.set(-0.55, 0.78, 0.004); wBody.add(spout);
    [[-0.14, 0.26, 0.3], [0, 0.34, 0], [0.14, 0.26, -0.3]].forEach(([sx, sy, rot]) => {
      const drop = cut(polyShape([[-0.03, 0], [0.03, 0], [0.06, sy * 0.8], [0, sy], [-0.06, sy * 0.8]]), COLORS.white);
      drop.rotation.z = rot; drop.position.x = sx * 0.2; spout.add(drop);
    });

    // boats ride on their wave strip
    const boats = O.boats.map(([row, side, x, hull, sail], i) => {
      const host = rows.find((w) => w.r === row && w.side === (side > 0 ? 1 : 0));
      const y = crestY(x, host.x0, host.x1, host.h, O.amp, O.waves, host.phase) - 0.08;
      const g = new THREE.Group(); g.position.set(x, y, t * 2.2); host.f.body.add(g);
      const inner = new THREE.Group(); g.add(inner);
      inner.add(cut(polyShape([[-0.3, 0.1], [0.3, 0.1], [0.2, -0.04], [-0.22, -0.04]]), hull));
      inner.add(cut(rectShape(0.025, 0.46, -0.0125, 0.1), COLORS.ink));
      inner.add(cut(polyShape([[0.03, 0.18], [0.26, 0.2], [0.03, 0.54]]), sail));
      inner.add(cut(polyShape([[-0.03, 0.2], [-0.2, 0.2], [-0.03, 0.44]]), tint(sail, 0.2)));
      return { g, inner, i };
    });
    kit.track(flatWord(kit.left, font, 'OCEAN', { x: O.word.x, z: O.word.z, size: 0.26, color: COLORS.pink, layer: 3 }));

    return (o, u, time) => {
      for (const { piece, rule } of pieces) piece.set(rule.ev ? eventRise(u, rule.ev[0], rule.ev[1], o) : baseRise(o, rule.d));
      const live = reduce ? 0 : time, gate = seg(o, 0.5, 1);
      rows.forEach(({ f, r, side }) => { f.hinge.rotation.x += Math.sin(live * O.rockSpeed + r * 0.9 + side * 0.5) * O.rock * gate; });
      // whale climbs out of its slot as it stands, then breathes
      const up = Math.min(win(u, O.whale.rise[0], O.whale.rise[1] + 0.06), gate);
      wBody.position.y = lerp(-O.whale.sink, O.whale.leap, up) + Math.sin(live * 0.8) * 0.04 * up;
      wBody.rotation.z = Math.sin(live * 0.6) * 0.03 * up;
      const sp = win(u, O.whale.spout[0], O.whale.spout[1]) * gate;
      const puff = 1 + Math.sin(live * 2.6) * 0.1;
      spout.scale.set(elastic(sp) * puff, elastic(sp) * (2 - puff), 1);
      spout.visible = sp > 0.01;
      const bob = win(u, O.boatRise[0], O.boatRise[1]) * gate;
      boats.forEach(({ g, inner, i }) => {
        g.scale.setScalar(Math.max(0.001, elastic(seg(bob, i * 0.12, 0.6 + i * 0.12))));
        inner.rotation.z = Math.sin(live * 1.7 + i * 1.9) * 0.14;
        inner.position.y = Math.sin(live * 1.7 + i * 1.9 + 1) * 0.03;
      });
    };
  });
}
