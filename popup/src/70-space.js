/* ───────── spread 4: space. A rocket pops out of a slot, planets bounce on paper springs, stars swing on threads ───────── */
const SPACE = {
  frame: { z: -1.35, w: 2.9, h: 2.55, bar: 0.24, post: 0.2, color: COLORS.navy },
  stars: [ // per frame: x offset from frame centre, thread length, size, colour, shape
    [-1.05, 0.55, 0.16, COLORS.sun, 'star'], [-0.55, 1.05, 0.13, COLORS.white, 'star'], [-0.05, 0.4, 0.2, COLORS.sun, 'moon'],
    [0.45, 0.85, 0.14, COLORS.pink, 'star'], [0.95, 0.6, 0.17, COLORS.white, 'star'],
  ],
  rocket: { x: -1.05, z: -0.15, rise: [0.06, 0.24], sink: 1.3 },
  planets: [ // x, z, radius, colours, ring colour, spring segments
    [1.0, 0.55, 0.3, [COLORS.sun, COLORS.orange], COLORS.pink, 9],
    [2.2, -0.2, 0.22, [COLORS.emerald, COLORS.teal], null, 11],
    [2.65, 0.95, 0.17, [COLORS.tomato, COLORS.pink], null, 7],
    [-2.45, 0.85, 0.2, [COLORS.pink, COLORS.white], COLORS.sun, 8],
  ],
  springs: [0.3, 0.5], swing: [0.14, 0.26],
  confetti: 22, word: { x: -1.2, z: 1.5 },
};
const ROCKET_BODY = [[-0.24, 0.35], [0.24, 0.35], [0.26, 1.2], [0.2, 1.5], [0.08, 1.72], [0, 1.78], [-0.08, 1.72], [-0.2, 1.5], [-0.26, 1.2]];
const ROCKET_NOSE = [[-0.21, 1.46], [0.21, 1.46], [0.08, 1.72], [0, 1.78], [-0.08, 1.72]];

function moonShape(r) {
  const s = new THREE.Shape(); s.absarc(0, -r, r, HALF_PI * 0.2, PI * 2 - HALF_PI * 0.2, false);
  s.absarc(r * 0.45, -r, r * 0.78, PI * 2 - HALF_PI * 0.45, HALF_PI * 0.45, true);
  return s;
}

function createSpace(book, font) {
  return makeSpread(book, 4, (kit) => {
    const S = SPACE, pieces = [], hangers = [], rnd = mulberry32(44);
    const add = (piece, rule) => { kit.track(piece.hinge ?? piece.group); pieces.push({ piece, rule }); return piece; };
    const t = CONFIG.paper.thick, F = S.frame;

    // printed confetti stars glued flat on both cobalt pages
    for (let i = 0; i < S.confetti; i++) {
      const side = i % 2 ? 1 : -1, x = side * (0.25 + rnd() * 2.75), z = -1.45 + rnd() * 2.8;
      const st = glue(starShape(0.07 + rnd() * 0.06, 0.03 + rnd() * 0.02), [COLORS.sun, COLORS.white, COLORS.pink][i % 3], lift(0));
      st.rotation.set(-HALF_PI, 0, rnd() * PI); st.position.set(x, lift(0), z);
      kit.side(x).add(st); kit.track(st);
    }
    // proscenium frames with stars and moons on threads
    [-1.6, 1.6].forEach((cx, fi) => {
      const f = add(flap(kit.side(cx), { x: cx, z: F.z, dir: -1, layer: 0 }), { d: 0.3 + fi * 0.06 });
      // one piece: two posts, a top bar and a low sill
      const s = rectShape(F.w, F.h), hole = new THREE.Path(), sill = 0.12;
      hole.moveTo(-F.w / 2 + F.post, sill); hole.lineTo(F.w / 2 - F.post, sill); hole.lineTo(F.w / 2 - F.post, F.h - F.bar); hole.lineTo(-F.w / 2 + F.post, F.h - F.bar); hole.closePath();
      s.holes.push(hole);
      f.body.add(cut(s, F.color));
      for (let k = 0; k < 7; k++) f.body.add(glue(starShape(0.045, 0.02), COLORS.sun, t / 2 + 0.002).translateX(-F.w / 2 + 0.25 + k * 0.4).translateY(F.h - F.bar / 2));
      S.stars.forEach(([ox, len, size, color, kind], i) => {
        const piv = new THREE.Group(); piv.position.set(ox * (fi ? -1 : 1), F.h - F.bar, t * 2); f.body.add(piv);
        piv.add(thread(len));
        const orn = new THREE.Group(); orn.position.y = -len - size; piv.add(orn);
        orn.add(cut(kind === 'moon' ? moonShape(size * 1.3) : starShape(size, size * 0.45), color));
        if (kind === 'moon') orn.children[0].position.y = size * 1.3;
        hangers.push({ piv, orn, i: i + fi * 5 });
      });
    });

    // rocket through a slot, flame flickers
    const rocket = add(vfold(kit.left, { x: S.rocket.x, z: S.rocket.z, w: 0.3, h: 0.7, layer: 6, color: COLORS.cobalt }), { ev: S.rocket.rise });
    const rBody = new THREE.Group(); rocket.body.add(rBody);
    rBody.add(cut(polyShape(ROCKET_BODY), COLORS.white));
    const nose = cut(polyShape(ROCKET_NOSE), COLORS.tomato); nose.position.z = t; rBody.add(nose);
    [-1, 1].forEach((s) => rBody.add(cut(polyShape([[0.2 * s, 0.35], [0.46 * s, 0.22], [0.44 * s, 0.6], [0.24 * s, 0.8]]), COLORS.tomato)));
    rBody.add(cut(ringShape(0.13, 0.09), COLORS.tomato).translateY(1.08).translateZ(t));
    rBody.add(glue(circleShape(0.09, 0, 1.08), COLORS.cobalt, t * 1.2));
    rBody.add(glue(rectShape(0.3, 0.05, -0.15, 0.62), COLORS.tomato));
    const flame = new THREE.Group(); flame.position.y = 0.36; rBody.add(flame);
    flame.add(cut(polyShape([[-0.18, 0], [0.18, 0], [0.1, -0.3], [0, -0.52], [-0.1, -0.3]]), COLORS.orange));
    const core = cut(polyShape([[-0.1, 0], [0.1, 0], [0.05, -0.2], [0, -0.32], [-0.05, -0.2]]), COLORS.sun); core.position.z = t; flame.add(core);

    // planets on accordion springs
    const planets = S.planets.map(([x, z, r, colors, ring, segs], i) => {
      const sp = spring(kit.side(x), { x, z, segs, colors: [COLORS.white, i % 2 ? COLORS.sun : COLORS.pink] });
      kit.track(sp.group);
      const pl = paperPlanet(r, colors, ring); pl.position.y = r * 0.9; sp.top.add(pl);
      return { sp, pl, i };
    });
    kit.track(flatWord(kit.right, font, 'SPACE', { x: S.word.x + 1.5, z: S.word.z, size: 0.26, color: COLORS.sun, layer: 3 }));

    return (o, u, time) => {
      for (const { piece, rule } of pieces) piece.set(rule.ev ? eventRise(u, rule.ev[0], rule.ev[1], o) : baseRise(o, rule.d));
      const live = reduce ? 0 : time, gate = seg(o, 0.5, 1);
      const up = Math.min(win(u, S.rocket.rise[0], S.rocket.rise[1] + 0.08), gate);
      rBody.position.y = -S.rocket.sink * (1 - backOut(up, 1.2)) + Math.sin(live * 1.4) * 0.05 * up;
      flame.scale.set(1 + Math.sin(live * 23) * 0.08, (0.8 + Math.sin(live * 17) * 0.25) * up, 1);
      const swing = win(u, S.swing[0], S.swing[1]) * gate;
      hangers.forEach(({ piv, orn, i }) => {
        piv.rotation.z = Math.sin(live * (0.9 + (i % 4) * 0.12) + i) * 0.16 * swing + (1 - swing) * 0.5 * (i % 2 ? 1 : -1);
        orn.rotation.y = Math.sin(live * 0.7 + i * 1.3) * 0.9;
        piv.visible = swing > 0.01;
      });
      planets.forEach(({ sp, pl, i }) => {
        const k = win(u, S.springs[0] + i * 0.035, S.springs[1] + i * 0.035);
        const ext = Math.min(elastic(k), gate * 1.1) + Math.sin(live * 2.2 + i * 1.7) * 0.045 * k;
        sp.set(ext);
        pl.visible = ext > 0.02;
        pl.rotation.y = live * 0.45 + i;
      });
    };
  });
}
