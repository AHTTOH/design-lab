/* POP-UP: shared core. Fragments in popup/src are concatenated in file-name order by popup/build.mjs
   into one inline module (file:// cannot load module files), so later fragments see these names. */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

/* ───────── config ───────── */
const COLORS = {
  tomato: '#ff4b33', cobalt: '#1f4bff', emerald: '#10b566', sun: '#ffc619', pink: '#ff3d9a', teal: '#00707a',
  white: '#ffffff', ink: '#0d1b5c', aqua: '#00b3b8', leaf: '#0a8f56', navy: '#132a9e', orange: '#ff8a1f',
};

const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  images: { cover: '%%IMG:cover%%', back: '%%IMG:back%%' },
  fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
  tilt: { rangeDeg: 30, ease: 0.08, yaw: 7, pitch: 4 },
  book: {
    pageW: 3.2, pageD: 3.2, pageT: 0.022, boardT: 0.055, boardPad: 0.09, leafGap: 0.05, leaves: 5,
    // leaf k turns while the global timeline t runs k + 1 + turn[0] .. k + 1 + turn[1]
    turn: [-0.22, 0.08],
    // leaf 0 is the front cover, 4 the back cover. recto faces up on the right stack, verso faces up once turned.
    recto: ['cover', COLORS.white, COLORS.sun, COLORS.white, COLORS.cobalt],
    verso: [COLORS.white, COLORS.sun, COLORS.white, COLORS.cobalt, 'back'],
    board: COLORS.tomato, backBoard: COLORS.cobalt,
    coverCrop: 0.66,
  },
  paper: {
    thick: 0.014, grainPx: 512, grainRepeat: 0.85, fibres: 7000, normal: 0.55, edgeLift: 0.28, roughness: [0.78, 1],
    layerLift: 0.0025,
  },
  // Spread background (studio gradient on the table). One colour per spread, blended during page turns.
  backdrop: ['#07505c', '#16237f', '#640f4b', '#083a6e', '#170f4a', '#0a5a41'],
  table: { size: 90, vignetteInner: 0.06, vignetteOuter: 0.5, edge: 0.42, skyScale: 0.42, fogNear: 1.6, fogFar: 4.2 },
  light: { key: 2.7, keyPos: [-5, 9, 9], hemi: 1.75, shadowMap: 2048, shadowMapMobile: 1024, shadowSpan: 6.5, radius: 3 },
  camera: { fov: 34, portraitFit: 0.95, near: 0.1, far: 200 },
  // Global timeline keys: t = spread index + progress inside the spread. az/el in degrees, d is distance.
  shots: [
    { t: 0.0, p: [1.65, 0.45, 0.2], az: -30, el: 28, d: 6.6 },
    { t: 0.3, p: [1.65, 0.5, 0.2], az: 16, el: 38, d: 6.2 },
    { t: 0.6, p: [1.3, 0.3, 0.3], az: -6, el: 58, d: 8.2 },
    { t: 0.9, p: [0, 0.4, 0], az: 0, el: 58, d: 10.4 },
    { t: 1.12, p: [0, 0.7, 0], az: -8, el: 42, d: 9.8 },
    { t: 1.34, p: [0.9, 0.9, 0.3], az: -26, el: 28, d: 6.8 },
    { t: 1.54, p: [-1.3, 1.2, 0.1], az: 20, el: 22, d: 7.2 },
    { t: 1.72, p: [0, 0.8, 0], az: 8, el: 38, d: 9.4 },
    { t: 1.9, p: [0, 0.4, 0], az: 0, el: 58, d: 10.4 },
    { t: 2.12, p: [0, 0.9, 0], az: 10, el: 38, d: 9.8 },
    { t: 2.34, p: [1.6, 0.6, 0.8], az: 30, el: 24, d: 6.6 },
    { t: 2.56, p: [-1.5, 1.1, 0.2], az: -22, el: 20, d: 7 },
    { t: 2.74, p: [0, 0.9, 0], az: -6, el: 34, d: 9.4 },
    { t: 2.9, p: [0, 0.4, 0], az: 0, el: 58, d: 10.4 },
    { t: 3.12, p: [0, 0.6, 0], az: -10, el: 36, d: 9.8 },
    { t: 3.34, p: [0.3, 0.8, -0.2], az: 12, el: 18, d: 7.6 },
    { t: 3.56, p: [-1.4, 0.5, 0.5], az: -28, el: 26, d: 6.6 },
    { t: 3.74, p: [0, 0.7, 0], az: 6, el: 36, d: 9.4 },
    { t: 3.9, p: [0, 0.4, 0], az: 0, el: 58, d: 10.4 },
    { t: 4.12, p: [0, 0.9, 0], az: 8, el: 32, d: 9.8 },
    { t: 4.34, p: [-1.1, 1.2, 0.2], az: -22, el: 22, d: 7.4 },
    { t: 4.56, p: [1.4, 1.0, 0.3], az: 26, el: 26, d: 7.4 },
    { t: 4.74, p: [0, 1.1, 0], az: 0, el: 26, d: 9.4 },
    { t: 4.9, p: [-0.8, 0.4, 0], az: 0, el: 58, d: 10.4 },
    { t: 5.15, p: [-1.65, 0.2, 1.0], az: 34, el: 30, d: 7.6 },
    { t: 5.55, p: [-1.65, 0.2, 1.0], az: -30, el: 40, d: 7.0 },
    { t: 6.0, p: [-1.65, 0.2, 1.1], az: 4, el: 56, d: 8.6 },
  ],
  cover: { titleSize: 0.6, titleZ: 0.55, fold: [0.42, 0.62], introMs: 1700, cueOut: [0.02, 0.08] },
  back: { finIn: [0.3, 0.42] },
  reduceAt: [0.25, 1.62, 2.62, 3.62, 4.66, 5.7],
};

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < CONFIG.mobileBreak;
const PI = Math.PI, HALF_PI = Math.PI / 2, DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const win = (p, a, b) => smooth(seg(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;
/** Overshooting ease used for every fold: paper snaps a little past its rest angle and settles. */
const backOut = (x, s = 1.9) => { const k = x - 1; return 1 + (s + 1) * k * k * k + s * k * k; };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ───────── scroll: one continuous timeline t = spread index + progress inside that spread ───────── */
if (reduce) document.documentElement.classList.add('reduce');
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
if (lenis) { gsap.ticker.add((time) => lenis.raf(time * 1000)); gsap.ticker.lagSmoothing(0); }

const timeline = (() => {
  const sections = $$('.scene');
  let tops = [], ends = [];
  const measure = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    tops = sections.map((s) => s.offsetTop);
    ends = tops.slice(1).concat([max]);
  };
  const at = (y) => {
    if (reduce) {
      // one finished spread per screen: snap to the spread whose screen is mostly in view
      const i = clamp(Math.round(y / innerHeight), 0, sections.length - 1);
      return CONFIG.reduceAt[i];
    }
    for (let i = sections.length - 1; i >= 0; i--) {
      if (y >= tops[i]) return i + clamp01((y - tops[i]) / Math.max(1, ends[i] - tops[i]));
    }
    return 0;
  };
  addEventListener('resize', measure);
  measure();
  return { now: () => at(scrollY), count: sections.length, measure };
})();

/* ───────── pointer and tilt (gyroscope on touch devices, pointer on desktop) ───────── */
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
{
  const cfg = CONFIG.tilt, btn = $('#tilt-btn');
  let baseBeta = null;
  const onOrient = (e) => {
    if (e.gamma === null || e.beta === null) return;
    if (baseBeta === null) baseBeta = e.beta;
    tilt.tx = clamp(e.gamma / cfg.rangeDeg, -1, 1);
    tilt.ty = clamp((e.beta - baseBeta) / cfg.rangeDeg, -1, 1);
  };
  const listen = () => addEventListener('deviceorientation', onOrient);
  if (!coarse) {
    addEventListener('pointermove', (e) => { tilt.tx = (e.clientX / innerWidth) * 2 - 1; tilt.ty = (e.clientY / innerHeight) * 2 - 1; });
  } else if (typeof DeviceOrientationEvent === 'undefined') {
    console.info('DeviceOrientationEvent is not available, tilt stays level');
  } else if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS grants motion access only from a user gesture, so the button exists only where that API exists.
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      btn.hidden = true;
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') listen(); else console.error('device orientation permission', state);
      } catch (e) { console.error('device orientation permission failed', e); }
    });
  } else listen();
  gsap.ticker.add(() => { if (reduce) return; tilt.x += (tilt.tx - tilt.x) * cfg.ease; tilt.y += (tilt.ty - tilt.y) * cfg.ease; });
}
