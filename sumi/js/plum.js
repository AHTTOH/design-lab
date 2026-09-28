/* Scene 5: an old plum branch grows with scroll (recursive zigzag branching, seeded), then red blossoms open
   in growth order and a few petals fall. Canvas 2D, redrawn only when progress changes. */

function growPlum(aspect, cfg) {
  const rnd = mulberry32(cfg.seed + Math.round(aspect * 10));
  const bw = 1000 * aspect, bh = 1000, branches = [], flowers = [];
  const target = aspect < 1 ? [0.9 * bw, 0.1 * bh] : [0.8 * bw, 0.2 * bh];
  const root = [-0.03 * bw, 1.04 * bh];
  const reach = Math.hypot(target[0] - root[0], target[1] - root[1]);
  const aim = Math.atan2(target[1] - root[1], target[0] - root[0]);
  // Breadth first, so the trunk and main limbs exist before twigs use up the budget.
  const queue = [
    { x: root[0], y: root[1], ang: aim, w: cfg.trunkWidth, len: reach * 1.12, depth: 0, dist: 0 },
    { x: root[0] + 0.02 * bw, y: root[1] - 0.16 * bh, ang: aim - 0.75, w: cfg.trunkWidth * 0.42, len: reach * 0.5, depth: 1, dist: 90 },
  ];
  let maxDist = 0, segCount = 0;
  while (queue.length && segCount < cfg.maxSegments) {
    let { x, y, ang, w, len, depth, dist } = queue.shift();
    const pts = [{ x, y, w, d: dist }];
    const knots = [];
    while (len > 0 && w > 0.7) {
      const sl = Math.max(9, Math.min(44, w * 1.5 + 9)) * (0.7 + rnd() * 0.6);
      // Plum wood is angular: sudden turns at nodes, pulled toward the open side of the paper.
      ang += (rnd() - 0.5) * (w > 6 ? cfg.jitterThick : cfg.jitterThin) * (rnd() < 0.25 ? 2.4 : 1);
      if (depth <= 1) ang = lerp(ang, Math.atan2(target[1] - y, target[0] - x), 0.16);
      ang = Math.min(cfg.angleMax, Math.max(cfg.angleMin, ang));
      x += Math.cos(ang) * sl; y += Math.sin(ang) * sl; w *= cfg.taper - rnd() * 0.02; dist += sl; len -= sl; segCount++;
      pts.push({ x, y, w, d: dist });
      if (w < 3.6 && rnd() < 0.2) flowers.push({ x, y, d: dist, r: 10 + rnd() * 7, rot: rnd() * 6.3, bud: rnd() < 0.35 });
      if (depth < cfg.maxDepth && w > 1.4 && rnd() < cfg.branchChance[Math.min(depth, cfg.branchChance.length - 1)]) {
        const side = rnd() < 0.5 ? -1 : 1;
        queue.push({ x, y, ang: ang + side * (0.45 + rnd() * 0.55), w: w * (0.48 + rnd() * 0.2), len: Math.max(60, len * (0.35 + rnd() * 0.35) + 50) * Math.pow(0.85, depth), depth: depth + 1, dist });
        if (w > 8) knots.push({ x, y, r: w * 0.14, d: dist });
      }
    }
    if (w <= 3.6) flowers.push({ x, y, d: dist, r: 9 + rnd() * 6, rot: rnd() * 6.3, bud: rnd() < 0.5 });
    branches.push({ pts, knots, depth, dash: [6 + rnd() * 26, 2 + rnd() * 7, 3 + rnd() * 34, 1 + rnd() * 5] });
    maxDist = Math.max(maxDist, dist);
  }
  flowers.forEach((f) => { f.t = f.d / maxDist; });
  flowers.sort((a, b) => a.t - b.t);
  return { branches, flowers, maxDist };
}

{
  const cfg = CONFIG.plum, canvas = $('#plum'), ctx = canvas.getContext('2d');
  const ghost = $('#plum-ghost'), title = $('#plum-title'), titleChars = charsOf('#plum-title');
  const cache = document.createElement('canvas'), cctx = cache.getContext('2d');
  const [br, bg, bb] = cfg.blossom;
  let tree = null, scale = 1, progress = 0, visible = false, petals = [], lastT = 0;

  const fit = () => {
    const d = dprNow();
    canvas.width = cache.width = Math.round(innerWidth * d);
    canvas.height = cache.height = Math.round(innerHeight * d);
    scale = (innerHeight / 1000) * d;
    tree = growPlum(innerWidth / innerHeight, cfg);
    paint();
  };

  function drawFlower(c, f, b) {
    const r = f.r * b;
    if (f.bud) {
      c.fillStyle = `rgba(${br},${bg},${bb},.9)`;
      c.beginPath(); c.ellipse(f.x, f.y, r * 0.42, r * 0.55, f.rot, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.85)';
      c.beginPath(); c.arc(f.x + Math.cos(f.rot + 1.57) * r * 0.45, f.y + Math.sin(f.rot + 1.57) * r * 0.45, r * 0.18, 0, Math.PI * 2); c.fill();
      return;
    }
    for (let j = 0; j < 5; j++) {
      const a = f.rot + (j / 5) * Math.PI * 2;
      c.fillStyle = `rgba(${br},${bg},${bb},${0.62 + 0.25 * ((j * 37) % 5) / 5})`;
      c.beginPath(); c.arc(f.x + Math.cos(a) * r * 0.5, f.y + Math.sin(a) * r * 0.5, r * 0.46, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.fillStyle = 'rgba(0,0,0,.85)'; c.lineWidth = 0.8;
    for (let j = 0; j < 7; j++) {
      const a = f.rot * 2 + (j / 7) * Math.PI * 2, ex = f.x + Math.cos(a) * r * 0.55, ey = f.y + Math.sin(a) * r * 0.55;
      c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(ex, ey); c.stroke();
      c.beginPath(); c.arc(ex, ey, 1.1, 0, Math.PI * 2); c.fill();
    }
  }


  /** Visible part of a branch up to growth distance G, as one continuous tapered polygon plus dry streaks. */
  function drawBranch(c, b, G) {
    const pts = [];
    for (let i = 0; i < b.pts.length; i++) {
      const q = b.pts[i];
      if (q.d <= G) { pts.push(q); continue; }
      const a = b.pts[i - 1];
      if (a) { const f = (G - a.d) / (q.d - a.d); pts.push({ x: lerp(a.x, q.x, f), y: lerp(a.y, q.y, f), w: lerp(a.w, q.w, f) * 0.6, d: G }); }
      break;
    }
    if (pts.length < 2) return;
    const side = (k, grow) => pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], z = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(z.y - a.y), ny = z.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = (q.w / 2) * grow * k;
      return [q.x + nx * h, q.y + ny * h];
    });
    const poly = (grow) => { const L = side(1, grow), R = side(-1, grow).reverse(); c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const p of L) c.lineTo(p[0], p[1]); for (const p of R) c.lineTo(p[0], p[1]); c.closePath(); };
    const thick = pts[0].w > 5;
    if (thick) { c.fillStyle = 'rgba(0,0,0,.06)'; poly(1.9); c.fill(); }
    c.fillStyle = `rgba(0,0,0,${pts[0].w > 14 ? 0.7 : 0.9})`; poly(1); c.fill();
    if (pts[0].w > 7) {
      c.setLineDash(b.dash); c.lineCap = 'round';
      for (const o of [-0.4, -0.15, 0.12, 0.38]) {
        const line = side(o * 2, 1);
        c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(1, pts[0].w * 0.1);
        c.beginPath(); line.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
      }
      c.setLineDash([]);
    }
    c.fillStyle = 'rgba(0,0,0,.92)';
    for (const k of b.knots) { if (k.d > G) continue; c.beginPath(); c.ellipse(k.x, k.y, k.r * 1.3, k.r, 0.4, 0, Math.PI * 2); c.fill(); }
  }

  function paint() {
    if (!tree) return;
    const p = reduce ? 1 : progress;
    const G = lerp(cfg.growStart, 1, smooth(segR(p, cfg.grow))) * tree.maxDist * 1.02;
    const c = cctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cache.width, cache.height);
    c.setTransform(scale, 0, 0, scale, 0, 0);
    for (const b of tree.branches) drawBranch(c, b, G);
    const [b0, b1] = cfg.bloom, n = tree.flowers.length;
    tree.flowers.forEach((f, i) => {
      if (f.d > G) return;
      const at = lerp(b0, b1 - 0.06, i / Math.max(1, n - 1)), b = reduce ? 1 : smooth(seg(p, at, at + 0.06));
      if (b > 0) drawFlower(c, f, b);
    });
    blit();
  }

  function blit() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    if (!petals.length) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const q of petals) {
      ctx.fillStyle = `rgba(${br},${bg},${bb},${0.8 * q.life})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 4.2, 2.6, q.rot, 0, Math.PI * 2); ctx.fill();
    }
  }

  function spawnPetals() {
    const open = tree.flowers.filter((f) => !f.bud);
    const rnd = mulberry32(cfg.seed + 99);
    lastT = 0;
    petals = Array.from({ length: Math.min(cfg.petals, open.length) }, (_, i) => {
      const f = open[Math.floor(rnd() * open.length)];
      return { x: f.x, y: f.y, vx: 8 + rnd() * 18, vy: 16 + rnd() * 26, rot: rnd() * 6, spin: (rnd() - 0.5) * 2, sway: rnd() * 6, delay: i * 0.35, life: 0, on: false };
    });
  }

  fit();
  addEventListener('resize', fit);

  track('#s-plum', (p) => {
    progress = p;
    ghost.style.opacity = lerp(cfg.ghostFrom, cfg.ghostTo, smooth(segR(p, cfg.ghostFade)));
    const t = smooth(segR(p, cfg.titleIn));
    title.style.opacity = t > 0 ? 1 : 0;
    inkChars(titleChars, t);
    if (p >= cfg.fall && !petals.length && !reduce) spawnPetals();
    if (p < cfg.fall && petals.length) petals = [];
    paint();
  }, (on) => { visible = on; });

  gsap.ticker.add((time, deltaMs) => {
    if (!visible || !petals.length) return;
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    lastT += dt;
    for (const q of petals) {
      if (lastT < q.delay) continue;
      if (!q.on) { q.on = true; q.life = 1; }
      q.x += (q.vx + Math.sin(lastT * 1.3 + q.sway) * 14) * dt; q.y += q.vy * dt; q.rot += q.spin * dt;
      if (q.y > 1000) q.life = Math.max(0, q.life - dt);
    }
    blit();
  });
}
