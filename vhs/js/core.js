/* VHS core: config, helpers, scroll engine, media, and the shared 2D picture canvas.
   Classic scripts (not modules) so file:// can load them; top-level names are shared across the files in load order. */
'use strict';

const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  // The picture is drawn small and scaled up: tape resolution is soft anyway and the slice effects stay cheap.
  picture: { maxWidth: 960, backdropW: 48, backdropAlpha: 0.5 },
  assets: '../assets/vhs/',
  clips: {
    beach: { video: 'beach.mp4', poster: 'beach.webp' },
    drive: { video: 'drive.mp4', poster: 'drive.webp' },
    arcade: { video: 'arcade.mp4', poster: 'arcade.webp' },
    fireworks: { video: 'fireworks.mp4', poster: 'fireworks.webp' },
  },
  // All-intra re-encode (ffmpeg -g 1) so every seek lands on a keyframe.
  scrub: { video: 'drive-scrub.mp4', poster: 'drive.webp' },
  stills: { aquarium: 'aquarium.webp', bowling: 'bowling.webp' },
  // "Tape stress": |lenis.velocity| * gain, clamped to 0..1, eased up fast and down slow.
  stress: { gain: 0.035, rise: 0.25, fall: 0.06 },
  // Static between scenes: peaks when two pins share the screen half and half, width in screen heights.
  boundary: { static: 0.85, width: 0.55, rollPx: 0.6 },
};

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < CONFIG.mobileBreak;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const segR = (p, r) => seg(p, r[0], r[1]);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const $ = (s) => document.querySelector(s);
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
/** In, hold, out envelope over four breakpoints. */
const envelope = (p, r) => smooth(seg(p, r[0], r[1])) * (1 - smooth(seg(p, r[2], r[3])));
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Stateless hash for per-row, per-frame noise. */
const hash1 = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/* ───────── scroll engine ───────── */
gsap.registerPlugin(ScrollTrigger);
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
const velocity = () => (lenis ? lenis.velocity : 0);

/** Eased tape stress 0..1 from scroll speed. Everything that "breaks" under fast scrolling reads this. */
const tapeStress = { value: 0 };
gsap.ticker.add(() => {
  const cfg = CONFIG.stress, target = clamp01(Math.abs(velocity()) * cfg.gain);
  tapeStress.value += (target - tapeStress.value) * (target > tapeStress.value ? cfg.rise : cfg.fall);
});

/** Per-frame requests to the glass (crt.js). Scenes raise values, the glass reads the maximum, then it is reset. */
const FX = { static: 0, band: 0, bandY: 0.5, scan: 0, dim: 0, roll: 0 };
function resetFX() { FX.static = 0; FX.band = 0; FX.bandY = 0.5; FX.scan = 0; FX.dim = 0; FX.roll = 0; }
function raiseFX(k, v) { FX[k] = Math.max(FX[k], v); }

/* ───────── media ───────── */
function assetUrl(file) { return CONFIG.assets + file; }

function loadImage(file) {
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('error', () => console.error(`VHS: image failed to load ${file}`));
  img.src = assetUrl(file);
  return img;
}

/** Off-DOM muted video. Nothing plays until a scene asks for it (want). */
function makeVideo(file, { preload = 'none', loop = true } = {}) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.loop = loop; v.preload = preload;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.addEventListener('error', () => console.error(`VHS: video failed to load ${file}`, v.error));
  v.src = assetUrl(file);
  return v;
}

/** A clip is a video plus its poster; reduced motion never touches the video. */
const clips = Object.fromEntries(Object.entries(CONFIG.clips).map(([name, c]) => [name, {
  name, video: reduce ? null : makeVideo(c.video), poster: loadImage(c.poster), owners: new Set(),
}]));
const stills = Object.fromEntries(Object.entries(CONFIG.stills).map(([name, f]) => [name, loadImage(f)]));

/** Several scenes can want the same clip; it plays while anyone wants it. */
function want(clip, owner, on) {
  if (!clip.video) return;
  if (on) clip.owners.add(owner); else clip.owners.delete(owner);
  const v = clip.video;
  if (clip.owners.size && v.paused) v.play().catch((e) => { if (e.name !== 'AbortError') console.error(`VHS: play ${clip.name}`, e); });
  else if (!clip.owners.size && !v.paused) v.pause();
}

/** What can be drawn right now: the moving frame once it has data, the poster before that. */
function frameOf(clip) {
  const v = clip.video;
  if (v && v.readyState >= 2) return v;
  const p = clip.poster;
  return p.complete && p.naturalWidth ? p : null;
}
const drawable = (img) => (img.complete && img.naturalWidth ? img : null);

/* ───────── scenes ───────── */
/** Progress of a sticky scene plus a visibility flag while any part of it is on screen. */
function track(el, onProgress, onVisible) {
  onProgress(0);
  ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => onProgress(s.progress) });
  if (onVisible) ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => onVisible(s.isActive) });
}

/* ───────── the picture tube: one 2D canvas, each scene clipped to its own pin ───────── */
function createPicture(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const layers = [];
  let W = 1, H = 1, S = 1, dirty = true;
  const fit = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    S = Math.min(dprNow(), CONFIG.picture.maxWidth / cw);
    W = Math.max(1, Math.round(cw * S)); H = Math.max(1, Math.round(ch * S));
    canvas.width = W; canvas.height = H;
    dirty = true;
  };
  function frame(time, dt) {
    if (reduce && !dirty) return;
    dirty = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const layer of layers) {
      if (!layer.on) continue;
      const r = layer.pin.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) continue;
      const top = Math.max(0, r.top) * S, bottom = Math.min(innerHeight, r.bottom) * S;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
      ctx.translate(0, Math.round(r.top * S));
      layer.draw(ctx, W, Math.round(r.height * S), time, dt, S);
      ctx.restore();
    }
  }
  /** layer: { pin, draw(ctx, w, h, time, dt, scale) } */
  const add = (layer) => { const l = { on: false, ...layer }; layers.push(l); return l; };
  addEventListener('resize', fit);
  if (reduce) addEventListener('scroll', () => { dirty = true; }, { passive: true });
  fit();
  return { add, frame, markDirty: () => { dirty = true; } };
}

/** Wires a scene: progress + visibility + a picture layer. Returns the layer so the scene can read `on`. */
function scene(picture, { section, pin, progress, visible, draw }) {
  const layer = picture.add({ pin: $(pin), draw });
  track($(section), progress, (on) => { layer.on = on; picture.markDirty(); if (visible) visible(on); });
  return layer;
}
