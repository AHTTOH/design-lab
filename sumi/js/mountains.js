/* Scene 2: procedural ink-wash ranges. Each ridge is painted once into its own canvas (wash, contour,
   texture strokes, moss dots, pines), then the camera flies through them with a pinhole projection. */

/** Ridge height profile in [0, 1]: a few sharp peaks (half gaussian, half laplacian) plus fbm detail. */
function ridgeProfile(L, rnd) {
  const n = noise1(L.seed), peaks = Array.from({ length: L.peaks }, () => ({ c: rnd() * 1.1 - 0.05, h: 0.55 + rnd() * 0.45, s: 0.06 + rnd() * 0.12 }));
  return (u) => {
    let v = 0;
    for (const k of peaks) { const d = (u - k.c) / k.s; v = Math.max(v, k.h * (0.5 * Math.exp(-d * d) + 0.5 * Math.exp(-Math.abs(d)))); }
    const fbm = 0.5 * n(u * 7) + 0.3 * n(u * 19 + 3) + 0.2 * n(u * 53 + 9);
    return v * 0.74 + fbm * 0.26;
  };
}

function drawPine(ctx, x, y, h, a, rnd) {
  ctx.strokeStyle = `rgba(0,0,0,${a})`; ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.lineWidth = Math.max(1, h * 0.05); ctx.lineCap = 'round';
  const lean = (rnd() - 0.5) * h * 0.3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.5, x + lean, y - h); ctx.stroke();
  // Needle clumps: each tier is a loose cloud of small blots, not a solid disc.
  const tiers = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < tiers; i++) {
    const t = 0.4 + (i / tiers) * 0.6, cx = x + lean * t + (rnd() - 0.5) * h * 0.3, cy = y - h * t;
    const w = h * (0.5 - t * 0.25) * (0.7 + rnd() * 0.5), blots = 8 + Math.floor(rnd() * 8);
    for (let k = 0; k < blots; k++) {
      const u = (rnd() - 0.5) * 2, bx = cx + u * w, by = cy + (rnd() - 0.5) * h * 0.09 + Math.abs(u) * h * 0.04;
      ctx.globalAlpha = 0.45 + rnd() * 0.55;
      ctx.beginPath(); ctx.ellipse(bx, by, h * (0.025 + rnd() * 0.04), h * (0.015 + rnd() * 0.025), rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Paint one range into a canvas W×H (CSS px, dpr 1: ink wash is soft and the layers are many). */
function paintRange(L, W, H, cfg) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.className = 'mnt-layer';
  canvas.style.width = W + 'px'; canvas.style.marginLeft = -W / 2 + 'px';
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(L.seed), prof = ridgeProfile(L, rnd), n1 = noise1(L.seed + 5), n2 = noise2(L.seed + 7);
  const ridge = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) ridge[x] = H * L.base - H * L.amp * prof(x / W);
  const depthLen = (x) => H * (0.1 + 0.22 * n1(x * 0.004));

  // Wash at reduced resolution, drawn up with smoothing: the gradient under each ridge is what reads as mist.
  const s = cfg.washScale, ww = Math.ceil(W * s), wh = Math.ceil(H * s);
  const wash = document.createElement('canvas'); wash.width = ww; wash.height = wh;
  const wctx = wash.getContext('2d'), img = wctx.createImageData(ww, wh), px = img.data;
  for (let x = 0; x < ww; x++) {
    const X = x / s, r = ridge[Math.min(W, Math.round(X))], dl = depthLen(X);
    for (let y = Math.max(0, Math.floor(r * s)); y < wh; y++) {
      const d = y / s - r;
      if (d < 0) continue;
      const f = Math.exp((-d / dl) * 1.7);
      if (f < 0.01) break;
      const tex = 0.62 + 0.38 * n2(X * 0.011, y / s * 0.018), streak = 0.9 + 0.1 * n2(X * 0.05, y / s * 0.008);
      px[(y * ww + x) * 4 + 3] = Math.min(255, 255 * L.tone * f * tex * streak);
    }
  }
  wctx.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(wash, 0, 0, W, H);

  // Contour: a brush dragged along the ridge, pressure wandering.
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 0.8 + L.tone * 1.4; ctx.strokeStyle = `rgba(0,0,0,${L.tone * 0.5})`;
  ctx.beginPath(); ctx.moveTo(0, ridge[0]);
  for (let x = 2; x <= W; x += 2) ctx.lineTo(x, ridge[x]);
  ctx.stroke();
  // Texture strokes (cun) follow the slope downward.
  const cun = Math.round((W / 14) * L.tone);
  for (let i = 0; i < cun; i++) {
    const x = Math.floor(rnd() * W), r = ridge[x], d = Math.pow(rnd(), 2) * depthLen(x) * 0.45, slope = (ridge[Math.min(W, x + 4)] - ridge[Math.max(0, x - 4)]) / 8;
    const len = 4 + rnd() * 12;
    ctx.lineWidth = 0.6 + rnd() * 1.2; ctx.strokeStyle = `rgba(0,0,0,${L.tone * (0.12 + rnd() * 0.22) * Math.exp(-d / 80)})`;
    ctx.beginPath(); ctx.moveTo(x, r + d); ctx.quadraticCurveTo(x - slope * len * 0.4, r + d + len * 0.5, x - slope * len, r + d + len); ctx.stroke();
  }
  // Moss dots sit on the ridge line.
  const dots = Math.round((W / 70) * L.tone);
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(rnd() * W);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, L.tone * (0.6 + rnd() * 0.5))})`;
    ctx.beginPath(); ctx.ellipse(x, ridge[x] + rnd() * 5, 1 + rnd() * 2.2 * L.tone, 0.8 + rnd() * 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Pines on the higher parts of the nearer ranges.
  for (let i = 0; i < (L.trees || 0); i++) {
    let x = Math.floor(rnd() * W);
    for (let k = 0; k < 6; k++) { const c = Math.floor(rnd() * W); if (ridge[c] < ridge[x]) x = c; }
    drawPine(ctx, x, ridge[x] + 3, H * (0.035 + rnd() * 0.03), Math.min(1, L.tone * 1.05), rnd);
  }
  return canvas;
}

{
  const cfg = CONFIG.mountains, stage = $('#mnt-stage'), far = $('#mnt-far');
  const lineChars = charsOf('#mnt-line'), seal = $('#mnt-seal'), veil = $('#mnt-veil');
  let items = [], progress = 0, visible = false, pnx = 0, built = false;

  function build() {
    stage.querySelectorAll('.mnt-layer, .mist').forEach((el) => el.remove());
    const W = Math.round(innerWidth * cfg.widthFactor), H = innerHeight;
    const layers = cfg.layers.map((L) => ({ z: L.z, el: paintRange(L, W, H, cfg) }));
    const mists = cfg.mists.map((m) => {
      const el = document.createElement('div'); el.className = 'mist'; el.innerHTML = '<i></i>';
      el.style.top = `${(m.y - cfg.mistHalf) * 100}vh`;
      el.style.transformOrigin = `50% ${(cfg.horizon - m.y + cfg.mistHalf) * 100}vh`;
      return { z: m.z, el };
    });
    // Everything scales about the horizon line so nearer ranges slide down and out as the camera advances.
    layers.forEach((l) => { l.el.style.transformOrigin = `50% ${cfg.horizon * 100}vh`; });
    items = [{ z: cfg.farZ, el: far }, ...layers, ...mists].sort((a, b) => b.z - a.z);
    items.forEach((it, i) => { it.el.style.zIndex = String(i + 1); if (it.el !== far) stage.appendChild(it.el); });
    built = true;
  }

  function place() {
    const c = seg(progress, 0.02, 0.95), camZ = cfg.camEnd * Math.pow(c, cfg.camCurve);
    const camX = Math.sin(c * Math.PI * 1.2) * cfg.driftVw + pnx * cfg.pointerVw;
    for (const it of items) {
      const dist = it.z - camZ;
      if (dist <= 0.15) { it.el.style.opacity = 0; continue; }
      const s = it.z / dist, x = -camX * (2 / dist);
      let a = smooth(seg(dist, cfg.fadeNear[0], cfg.fadeNear[1]));
      if (it.el === far) a *= smooth(segR(progress, cfg.farIn)) * 0.9 + 0.1;
      it.el.style.opacity = a;
      it.el.style.transform = `translate3d(${x.toFixed(3)}vw, 0, 0) scale(${s.toFixed(4)})`;
    }
  }

  // Painting takes a few hundred ms, so it waits until the scene is close.
  const ensureBuilt = () => { if (!built) { build(); place(); } };
  ScrollTrigger.create({ trigger: '#s-mnt', start: 'top 300%', end: 'bottom top', onToggle: (s) => { if (s.isActive) ensureBuilt(); } });
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (built) { build(); place(); } }, 250); });

  // The seal sits under the last character of the poem line, wherever the line wraps to.
  const placeSeal = () => { const l = $('#mnt-line'); seal.style.left = `${l.offsetLeft + l.offsetWidth / 2 - seal.offsetWidth / 2}px`; seal.style.top = `${l.offsetTop + l.offsetHeight + 14}px`; };
  addEventListener('resize', placeSeal);
  document.fonts.ready.then(placeSeal);
  placeSeal();

  track('#s-mnt', (p) => {
    progress = p;
    veil.style.opacity = 1 - smooth(segR(p, cfg.veilIn)) + smooth(segR(p, cfg.veilOut)) * cfg.veilOutMax;
    const out = 1 - smooth(segR(p, cfg.textOut));
    inkChars(lineChars, segR(p, cfg.lineIn) * out);
    const k = smooth(segR(p, cfg.sealIn));
    seal.style.opacity = k * out;
    seal.style.transform = `scale(${1.5 - k * 0.5}) rotate(${(1 - k) * -6}deg)`;
    if (built) place();
  }, (on) => { visible = on; if (on) ensureBuilt(); });

  gsap.ticker.add(() => {
    if (!visible || !built || reduce) return;
    const target = pointer.nx;
    if (Math.abs(target - pnx) < 0.001) return;
    pnx += (target - pnx) * 0.05;
    place();
  });
}
