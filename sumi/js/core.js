/* SUMI core: helpers, scroll engine, scene tracking, pointer, shared noise. Classic script, globals on purpose. */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const segR = (p, r) => seg(p, r[0], r[1]);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
const isNarrow = () => innerWidth < CONFIG.mobileBreak;

/** Seeded PRNG so procedural paintings come out the same on every visit. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1D value noise in [0, 1] with smooth interpolation, one lattice per seed. */
function noise1(seed) {
  const rnd = mulberry32(seed), lat = Float32Array.from({ length: 512 }, rnd);
  return (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(lat[i & 511], lat[(i + 1) & 511], u);
  };
}

/** 2D value noise in [0, 1]. */
function noise2(seed) {
  const rnd = mulberry32(seed), N = 256, lat = Float32Array.from({ length: N * N }, rnd);
  const at = (x, y) => lat[(y & (N - 1)) * N + (x & (N - 1))];
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(ix, iy), at(ix + 1, iy), ux), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), ux), uy);
  };
}

/* ───────── scroll engine ───────── */
gsap.registerPlugin(ScrollTrigger);
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const velocity = () => (lenis ? lenis.velocity : 0);

/** Progress of a sticky scene plus an optional visibility flag while any part of it is on screen. */
function track(sel, onProgress, onVisible) {
  const el = $(sel);
  onProgress(0);
  ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => onProgress(s.progress) });
  if (onVisible) ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => onVisible(s.isActive) });
}

/** Wrap each character of [data-chars] elements so they can fade in one by one. */
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => (c === ' ' ? '<span class="c" aria-hidden="true">&nbsp;</span>' : `<span class="c" aria-hidden="true">${c}</span>`)).join('');
  return [...el.querySelectorAll('.c')];
}
const CHARS = new Map($$('[data-chars]').map((el) => [el, splitChars(el)]));
const charsOf = (sel) => CHARS.get($(sel));

/** Ink-like character reveal: each glyph sharpens out of a blur in reading order. k in [0, 1]. */
function inkChars(chars, k, spread = 0.6) {
  const n = chars.length;
  chars.forEach((c, i) => {
    const a = (i / Math.max(1, n - 1)) * spread, t = smooth(seg(k, a, a + (1 - spread)));
    c.style.opacity = t;
    c.style.filter = t >= 1 ? 'none' : `blur(${(1 - t) * 8}px)`;
  });
}

/** Whole-element fade used for scene copy. */
function fadeEl(el, k, blurPx = 6) {
  el.style.opacity = k;
  el.style.filter = k >= 1 || k <= 0 ? 'none' : `blur(${(1 - k) * blurPx}px)`;
}

/* ───────── pointer ───────── */
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, moved: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.moved = performance.now();
});

/* ───────── video: play only while visible, posters only for reduced motion ───────── */
function manageVideo(v) {
  if (reduce) { v.pause(); return { set() {} }; }
  let want = false;
  const sync = () => {
    if (want && v.paused) v.play().catch((e) => { if (e.name !== 'AbortError') console.warn('video play blocked:', e.name); });
    else if (!want && !v.paused) v.pause();
  };
  return { set(on) { if (on !== want) { want = on; sync(); } } };
}
