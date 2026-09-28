/* Scene 5, tape eject: the arcade tape degrades. Glitch blocks copy the picture onto itself, columns melt downward
   leaving smeared colour, then the picture is replaced block by block with colour bars and the VCR ejects. */
'use strict';

const EJECT = {
  glitch: [0.02, 0.4],
  melt: [0.16, 0.62], meltMax: 0.8, colW: 0.014,           // column width, share of width
  bars: [0.5, 0.82], grid: [16, 9],
  blocksMax: 70, blockSize: [0.03, 0.16], blockTickMs: 90,
  tint: ['#ff2fd0', '#1fe6ff', '#ffe81a', '#2bff5a'], tintShare: 0.25,
  splitMax: 0.02, glitchStress: 0.45,
  words: [[0, '재생'], [0.18, '트래킹'], [0.46, '테이프 늘어짐'], [0.8, '꺼내기']],
  big: [0.8, 0.86, 1.1, 1.2],
};

function initEject(picture) {
  const word = $('#eject-word'), big = $('#eject-big');
  const rnd = mulberry32(11);
  const cols = Array.from({ length: 200 }, () => rnd());
  const cells = Array.from({ length: EJECT.grid[0] * EJECT.grid[1] }, () => rnd());
  let p = 0, lastWord = '';

  // Neighbouring columns melt at similar speeds so the drips read as curtains, not barcode.
  const meltSpeed = (i) => 0.35 + 0.65 * (0.6 * cols[i % cols.length] + 0.4 * (0.5 + 0.5 * Math.sin(i * 0.33)));

  function glitchBlocks(g, src, w, h, amount) {
    const n = Math.round(amount * EJECT.blocksMax);
    if (!n) return;
    const r = mulberry32(Math.floor(performance.now() / EJECT.blockTickMs));
    for (let i = 0; i < n; i++) {
      const bw = w * lerp(...EJECT.blockSize, r()), bh = h * lerp(...EJECT.blockSize, r()) * 0.5;
      const dx = r() * w, dy = r() * h;
      if (r() < EJECT.tintShare) {
        g.globalCompositeOperation = 'color';
        g.fillStyle = EJECT.tint[Math.floor(r() * EJECT.tint.length)];
        g.fillRect(dx, dy, bw, bh);
        g.globalCompositeOperation = 'source-over';
      } else g.drawImage(src, r() * w, r() * h, bw, bh, dx, dy, bw, bh);
    }
  }

  function melt(g, src, w, h, m) {
    const cw = Math.max(2, Math.round(w * EJECT.colW));
    for (let x = 0, i = 0; x < w; x += cw, i++) {
      const off = Math.round(m * EJECT.meltMax * h * meltSpeed(i));
      if (off < 1) { g.drawImage(src, x, 0, cw, h, x, 0, cw, h); continue; }
      g.drawImage(src, x, 0, cw, h - off, x, off, cw, h - off);
      g.drawImage(src, x, 0, cw, 2, x, 0, cw, off);    // the top row smears down into the gap
    }
  }

  function barsInBlocks(g, w, h, k) {
    if (k <= 0) return;
    const bars = buffer('eject-bars', w, h);
    if (!bars.ready || bars.ready !== `${w}x${h}`) { colourBars(bars.ctx, w, h); bars.ready = `${w}x${h}`; }
    const [gx, gy] = EJECT.grid, cw = w / gx, ch = h / gy;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      if (cells[j * gx + i] > k) continue;
      const x = Math.floor(i * cw), y = Math.floor(j * ch);
      g.drawImage(bars, x, y, Math.ceil(cw), Math.ceil(ch), x, y, Math.ceil(cw), Math.ceil(ch));
    }
  }

  function updateDom() {
    const text = EJECT.words.reduce((acc, [at, t]) => (p >= at ? t : acc), EJECT.words[0][1]);
    if (text !== lastWord) { word.textContent = text; lastWord = text; }
    big.style.opacity = reduce ? (p >= EJECT.big[1] ? 1 : 0) : envelope(p, EJECT.big);
  }

  scene(picture, {
    section: '#s-eject', pin: '#eject-pin',
    progress: (x) => { p = x; updateDom(); },
    visible: (on) => want(clips.arcade, 'eject', on),
    draw: (ctx, w, h, t) => {
      const src = frameOf(clips.arcade);
      if (!src) return;
      const g1 = smooth(segR(p, EJECT.glitch)), m = smooth(segR(p, EJECT.melt)), k = segR(p, EJECT.bars);
      const base = buffer('eject-base', w, h);
      base.ctx.fillStyle = '#000'; base.ctx.fillRect(0, 0, w, h);
      drawFramed(base.ctx, src, w, h);
      const work = buffer('eject-work', w, h), g = work.ctx;
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      melt(g, base, w, h, m);
      glitchBlocks(g, base, w, h, reduce ? 0 : Math.max(g1, m) * (1 - k));
      barsInBlocks(g, w, h, k);
      const stress = Math.max(tapeStress.value, g1 * EJECT.glitchStress * (1 - m * 0.6) * (1 - k));
      tapeFrame(ctx, work, w, h, tapeFx(stress, { split: Math.max(stress * TAPE.splitStress, g1 * EJECT.splitMax * (1 - k)), bandY: fract(t * 0.15) }), t);
      raiseFX('band', stress * 0.6);
    },
  });
}
