/* VHS tape: 2D picture effects. Everything here draws with drawImage and composite modes only (no pixel reads),
   so video frames from file:// work too; the canvas is merely tainted, which nothing here cares about. */
'use strict';

const TAPE = {
  slice: 3,                 // internal px per horizontal slice
  wobble: 0.0012,           // base horizontal wobble, share of width
  wobbleStress: 0.012,      // extra wobble at full stress
  wobbleFreq: 0.045, wobbleSpeed: 7,
  bandH: 0.07,              // tracking band half height, share of height
  bandShift: 0.07,          // max horizontal tear inside the band, share of width
  bleedRes: 0.14,           // chroma carried at this share of the width (VHS colour is low bandwidth)
  bleedShift: 0.006,        // colour trails right of luma
  bleedAlpha: 0.85,
  splitStress: 0.012,       // RGB split at full stress, share of width
  dropoutsStress: 26,       // white dropout streaks per frame at full stress
  noiseSize: 256,
  colours: {
    bars: ['#c0c0c0', '#ffe81a', '#1fe6ff', '#2bff5a', '#ff2fd0', '#ff3a2e', '#1426ff'],
    mid: ['#1426ff', '#000', '#ff2fd0', '#000', '#1fe6ff', '#000', '#c0c0c0'],
    low: ['#08215e', '#fff', '#3a0a7a', '#000', '#000', '#111', '#000'],
  },
};

const buffers = new Map();
/** Named offscreen canvas, resized on demand. */
function buffer(name, w, h) {
  let c = buffers.get(name);
  if (!c) { c = document.createElement('canvas'); c.ctx = c.getContext('2d'); buffers.set(name, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
function sizeOf(src) { return [src.videoWidth || src.naturalWidth || src.width, src.videoHeight || src.naturalHeight || src.height]; }

/** Grey noise tile, made once. Stretched horizontally it becomes the streaky VHS noise bar. */
const noiseTile = (() => {
  const n = TAPE.noiseSize, c = document.createElement('canvas');
  c.width = n; c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), rnd = mulberry32(7);
  for (let i = 0; i < n * n; i++) { const v = rnd() * 255; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 1.05; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
})();

/** The whole frame, never cropped (the Flow mark in the corner stays), over a blurred cover copy of itself. */
function drawFramed(ctx, src, w, h) {
  const [sw, sh] = sizeOf(src);
  if (!sw || !sh) return;
  const bw = CONFIG.picture.backdropW, tiny = buffer('backdrop', bw, Math.max(1, Math.round(bw * sh / sw)));
  tiny.ctx.drawImage(src, 0, 0, tiny.width, tiny.height);
  const cover = Math.max(w / sw, h / sh) * 1.1;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = CONFIG.picture.backdropAlpha;
  ctx.drawImage(tiny, (w - sw * cover) / 2, (h - sh * cover) / 2, sw * cover, sh * cover);
  ctx.globalAlpha = 1;
  const k = Math.min(w / sw, h / sh);
  ctx.drawImage(src, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
}

/** Static over an area: noise tiles at random offsets. */
function staticFill(ctx, x, y, w, h, alpha) {
  if (alpha <= 0.01) return;
  const n = TAPE.noiseSize;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const ox = Math.random() * n, oy = Math.random() * n;
  for (let ty = y - oy; ty < y + h; ty += n) for (let tx = x - ox; tx < x + w; tx += n) ctx.drawImage(noiseTile, tx, ty);
  ctx.restore();
}

/** One horizontal VHS noise bar: noise stretched sideways, brighter in the middle. */
function noiseBar(ctx, y, hgt, w, alpha) {
  const n = TAPE.noiseSize;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(noiseTile, Math.random() * (n - 40), Math.random() * (n - 12), 40, 12, 0, y, w, hgt);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#b8c8ff';
  ctx.fillRect(0, y + hgt * 0.35, w, hgt * 0.3);
  ctx.restore();
}

/** Studio colour bars in saturated tape colours. */
function colourBars(ctx, w, h) {
  const col = TAPE.colours, n = col.bars.length, bw = w / n;
  col.bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(Math.floor(i * bw), 0, Math.ceil(bw), h * 0.67); });
  col.mid.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(Math.floor(i * bw), h * 0.67, Math.ceil(bw), h * 0.08); });
  col.low.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(Math.floor(i * bw), h * 0.75, Math.ceil(bw), h * 0.25); });
}

/** Tape effects for a stress level, plus scene-specific extras. */
function tapeFx(stress, extra = {}) {
  return {
    wobble: TAPE.wobble + stress * TAPE.wobbleStress,
    band: stress,
    bandY: 0.5,
    split: stress * TAPE.splitStress,
    dropouts: stress * TAPE.dropoutsStress,
    roll: 0,
    ...extra,
  };
}

/**
 * Plays a source through the tape: framed, sliced with wobble and a tracking tear, chroma bled to the right,
 * optionally RGB split, dropouts on top. fx fields are shares of the width or height, roll in px.
 */
function tapeFrame(ctx, src, w, h, fx, t) {
  const base = buffer('base', w, h);
  base.ctx.fillStyle = '#000'; base.ctx.fillRect(0, 0, w, h);
  drawFramed(base.ctx, src, w, h);

  const out = buffer('out', w, h), o = out.ctx;
  o.fillStyle = '#000'; o.fillRect(0, 0, w, h);
  const sl = TAPE.slice, roll = ((Math.round(fx.roll || 0) % h) + h) % h;
  const bandY = fx.bandY * h, bandH = TAPE.bandH * h, tick = Math.floor(t * 30);
  for (let y = 0; y < h; y += sl) {
    const sy = (y + roll) % h, sh = Math.min(sl, h - sy);
    let dx = fx.wobble * w * (Math.sin(y * TAPE.wobbleFreq + t * TAPE.wobbleSpeed) + 0.5 * Math.sin(y * 0.011 - t * 3.1));
    if (fx.band > 0.01) {
      const d = Math.abs(y - bandY) / bandH;
      if (d < 1) dx += (hash1(y * 0.37 + tick) - 0.3) * fx.band * TAPE.bandShift * w * (1 - d * d);
    }
    o.drawImage(base, 0, sy, w, sh, dx, y, w, sh);
  }

  // Chroma bleed: luma stays sharp, colour comes from a narrow copy stretched back and nudged right.
  const cw = Math.max(8, Math.round(w * TAPE.bleedRes)), chroma = buffer('chroma', cw, Math.max(8, Math.round(h / 2)));
  chroma.ctx.filter = 'saturate(1.7)';
  chroma.ctx.drawImage(out, 0, 0, chroma.width, chroma.height);
  chroma.ctx.filter = 'none';
  o.globalCompositeOperation = 'color';
  o.globalAlpha = TAPE.bleedAlpha;
  o.drawImage(chroma, TAPE.bleedShift * w, 0, w, h);
  o.globalCompositeOperation = 'source-over';
  o.globalAlpha = 1;

  const d = fx.split * w;
  if (d >= 1) splitChannels(ctx, out, w, h, d);
  else ctx.drawImage(out, 0, 0);

  if (fx.dropouts >= 1) {
    ctx.fillStyle = 'rgba(235, 240, 255, .75)';
    for (let i = 0; i < Math.round(fx.dropouts); i++) ctx.fillRect(Math.random() * w, Math.random() * h, (0.02 + Math.random() * 0.12) * w, Math.max(1, h * 0.002));
  }
}

/** Red right, blue left, green in place, added back together. */
function splitChannels(ctx, src, w, h, d) {
  const chans = [['r', '#f00', d], ['g', '#0f0', 0], ['b', '#00f', -d]];
  for (const [name, colour] of chans) {
    const c = buffer('ch-' + name, w, h), g = c.ctx;
    g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = colour; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (const [name, , dx] of chans) ctx.drawImage(buffers.get('ch-' + name), dx, 0);
  ctx.globalCompositeOperation = 'source-over';
}
