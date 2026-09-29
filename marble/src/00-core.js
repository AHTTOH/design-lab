/* MARBLE RUN: shared core. Fragments in marble/src are concatenated in file-name order by marble/build.mjs
   into one inline module (file:// cannot load module files), so later fragments see these names.
   Everything on screen is a pure function of one scroll timeline t (segment index + progress inside it),
   so scrolling back up rewinds every part exactly. Only the fan idle spin and cloth flutter use a clock. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ───────── config ───────── */
const COLOR = {
  studioTop: '#0a2a9e', studioHorizon: '#0a6a80', floor: '#07566a',
  tomato: '#ff3b2f', sun: '#ffc21a', emerald: '#00c070', cobalt: '#1f4bff', pink: '#ff2f8e', violet: '#7a3cff', orange: '#ff7a1a', aqua: '#00c4d6',
  white: '#ffffff', ink: '#04143d',
  woodA: '#8f2a10', woodB: '#4a1205', brass: '#ffd45e', chrome: '#ffffff', rope: '#15277a',
};

const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  // actor sampling step in timeline units (rolling rotation is integrated once at load, then looked up)
  sampleDt: 0.0004,
  marble: { r: 0.18, ballR: 0.16 },
  light: { exposure: 1.05, key: 2.6, keyDir: [-0.55, 1, 0.62], hemi: 0.7, env: 0.85, shadowMap: 2048, shadowMapMobile: 1024,
    shadowMin: 5, shadowMax: 26, shadowPerDist: 0.62 },
  bloom: { strength: 0.32, radius: 0.45, threshold: 1.05 },
  table: { x: [-19, 22.5], z: [-6.6, 8.2], top: 0, thick: 0.7, grainPx: 1024 },
  camera: { fov: 34, near: 0.1, far: 400, portraitHfovScale: 0.92, portraitWideScale: 0.64, portraitNear: 9, portraitFar: 24, portraitMaxFov: 96, portraitDist: 1.08 },
  // One timeline: t = segment index + progress inside that segment. Every event below is a t value.
  time: {
    gate: [0.3, 0.34], rampA: [0.34, 0.95], rollA: [0.95, 1.04],
    snake: [1.04, 1.66], wave: [1.66, 1.84], big: [1.84, 1.99], seesaw: [1.97, 2.05], launch: 2.04, flight: [2.04, 2.22],
    helix: [2.22, 2.96], funnel: [2.97, 3.46], drop: [3.46, 3.52], xylo: [3.52, 3.93], toBucket: [3.93, 3.99],
    bucket: [4.0, 4.46], flagTop: 4.46, fire: [4.58, 4.63], release: 4.605, fly: [4.605, 4.94], bounce: [4.94, 5.02],
    fan: [4.99, 5.12], banner: [5.1, 5.56], finIn: [5.72, 5.84],
  },
  layout: {
    tower: [-16.4, -4.6],
    zig: { y0: 6.4, xa: -16.0, xb: -11.8, z0: -4.6, zStep: 1.1, legs: 5, turnDrop: 0.22, gauge: 0.25, drop: 0.13 },
    snake: { rows: [-0.2, 1.2, 2.6], x: [-10.6, -4.1], turnR: 0.7, spacing: 0.3 },
    wave: { rows: 5, cols: 10, x0: -3.55, dx: 0.33, dz: 0.5 },
    domino: { w: 0.36, h: 0.72, t: 0.1, chainTilt: 1.18, lastTilt: 1.46 },
    big: { x: -0.35, h: 1.5, w: 0.6, t: 0.2 },
    seesaw: { pivot: [2.8, 0.62, 2.6], half: 2.1, tilt: 0.26 },
    helix: { c: [6.8, 0.2], R: 1.4, top: 7.4, bottom: 3.9, a0: 2.24, turns: 2.3 },
    funnel: { c: [10.4, -2.6], rimR: 1.5, rimY: 3.2, holeR: 0.26, holeY: 2.35, entryR: 1.25, turns: 3.4 },
    xylo: { x0: 10.4, dx: 0.58, y0: 1.72, dy: 0.13, bars: 8, z: -2.6, len: [1.5, 0.95], w: 0.42, hop: 0.34 },
    bucket: { x: 15.1, z: -2.6, top: 1.2, drop: 0.95, r: 0.32 },
    gears: { z: -3.4, board: -3.62, spoolR: 0.2, drumR: 0.5, module: 0.1,
      list: [{ c: [14.9, 4.0], n: 18 }, { c: [16.13, 3.14], n: 12 }, { c: [17.6, 3.99], n: 22 }, { c: [18.83, 2.96], n: 10 }] },
    mast: { x: 20.0, z: -2.9, h: 6.8, flagLow: 0.8 },
    catapult: { pivot: [17.2, 0.58, 0.9], arm: 1.3, cocked: -0.14, releaseAt: 0.9, stop: 1.8 },
    bell: { pivot: [5.9, 4.1, -4.9], h: 0.95, r: 0.5, dish: [6.9, -3.7] },
    banner: { poles: [-4.6, 3.6], z: -5.5, roller: 0.95, top: 5.4, fan: [-0.5, -4.5] },
  },
  // Camera keys. p is the anchor for wide shots, follow blends toward the action point.
  // az/el in degrees (az 0 looks from +z), d distance, fov vertical degrees on a landscape screen.
  shots: [
    { t: 0.00, p: [1.5, 1.2, 0.5], follow: 0, az: -22, el: 24, d: 44, fov: 30 },
    { t: 0.14, p: [1.5, 1.5, 0.5], follow: 0, az: 8, el: 30, d: 38, fov: 30 },
    { t: 0.27, follow: 1, az: -38, el: 20, d: 6.8, fov: 36 },
    { t: 0.36, follow: 1, az: -52, el: 22, d: 5.6, fov: 38 },
    { t: 0.52, follow: 1, az: -78, el: 30, d: 6.6, fov: 38 },
    { t: 0.7, follow: 1, az: -30, el: 36, d: 7.6, fov: 38 },
    { t: 0.88, follow: 1, az: 12, el: 22, d: 6.2, fov: 38 },
    { t: 1.04, follow: 1, az: -18, el: 26, d: 5.2, fov: 38 },
    { t: 1.2, follow: 1, az: -58, el: 34, d: 6.4, fov: 38 },
    { t: 1.36, p: [-6.5, 0.2, 1.3], follow: 0.35, az: -24, el: 62, d: 17, fov: 36 },
    { t: 1.52, follow: 1, az: 14, el: 38, d: 7.4, fov: 38 },
    { t: 1.7, follow: 1, az: -38, el: 30, d: 7.2, fov: 38 },
    { t: 1.88, follow: 1, az: -8, el: 15, d: 6.6, fov: 38 },
    { t: 2.03, follow: 1, az: 18, el: 12, d: 7.4, fov: 38 },
    { t: 2.13, p: [4.8, 2.6, 1.4], follow: 0.6, az: 30, el: 16, d: 12.5, fov: 40 },
    { t: 2.24, follow: 1, az: 16, el: 30, d: 6.2, fov: 38 },
    { t: 2.46, follow: 1, az: -24, el: 20, d: 5.8, fov: 38 },
    { t: 2.66, follow: 1, az: -70, el: 12, d: 6.2, fov: 38 },
    { t: 2.84, p: [3, 2.2, 0], follow: 0.3, az: -10, el: 26, d: 26, fov: 34 },
    { t: 2.98, follow: 1, az: 28, el: 30, d: 6.4, fov: 38 },
    { t: 3.12, follow: 1, az: 12, el: 58, d: 5.6, fov: 38 },
    { t: 3.34, follow: 1, az: -28, el: 46, d: 4.8, fov: 38 },
    { t: 3.5, follow: 1, az: 0, el: 20, d: 5.4, fov: 38 },
    { t: 3.7, follow: 1, az: 26, el: 24, d: 5.8, fov: 38 },
    { t: 3.92, follow: 1, az: 44, el: 20, d: 6.2, fov: 38 },
    { t: 4.06, follow: 1, az: 4, el: 10, d: 10.5, fov: 36 },
    { t: 4.28, follow: 1, az: -18, el: 16, d: 9.5, fov: 36 },
    { t: 4.46, follow: 1, az: 28, el: 18, d: 8.4, fov: 36 },
    { t: 4.54, p: [4, 2.4, 0.5], follow: 0.2, az: 18, el: 28, d: 34, fov: 32 },
    { t: 4.6, follow: 1, az: -42, el: 14, d: 6.2, fov: 38 },
    { t: 4.74, p: [11.5, 2.4, -1.5], follow: 0.55, az: 48, el: 20, d: 15, fov: 40 },
    { t: 4.93, follow: 1, az: -36, el: 14, d: 6.8, fov: 38 },
    { t: 5.06, follow: 1, az: 0, el: 20, d: 9.5, fov: 38 },
    { t: 5.32, follow: 1, az: -8, el: 10, d: 13.5, fov: 38 },
    { t: 5.62, p: [2.4, 2.4, 1.5], follow: 0.35, az: 2, el: 16, d: 25, fov: 34 },
    { t: 6.0, p: [2.4, 2.2, 0.5], follow: 0.2, az: 12, el: 22, d: 40, fov: 32 },
  ],
  // reduced motion: one still of the finished machine from this pose
  still: { p: [2.2, 2.0, 0.8], az: 10, el: 26, d: 40, fov: 32 },
};

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < CONFIG.mobileBreak;
const PI = Math.PI, TAU = Math.PI * 2, DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const win = (p, a, b) => smooth(seg(p, a, b));
const lerp = (a, b, t) => a + (b - a) * t;
const backOut = (x, s = 1.7) => { const k = x - 1; return 1 + (s + 1) * k * k * k + s * k * k; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ───────── scroll: one continuous timeline t = segment index + progress inside that segment ───────── */
if (reduce) document.documentElement.classList.add('reduce');
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });

const timeline = (() => {
  const sections = $$('.scene');
  let tops = [], ends = [];
  const measure = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    tops = sections.map((s) => s.offsetTop);
    ends = tops.slice(1).concat([max]);
  };
  const at = (y) => {
    if (reduce) return sections.length; // the finished machine
    for (let i = sections.length - 1; i >= 0; i--) {
      if (y >= tops[i]) return i + clamp01((y - tops[i]) / Math.max(1, ends[i] - tops[i]));
    }
    return 0;
  };
  addEventListener('resize', measure);
  measure();
  return { now: () => at(scrollY), count: sections.length, measure };
})();

/* ───────── overlay: title, segment words, scroll cue, finale button ───────── */
function createOverlay() {
  const title = $('#title'), cue = $('#cue'), fin = $('#fin-copy'), magnet = $('#magnet');
  const words = $$('[data-word]').map((el) => {
    const [a, b] = el.dataset.word.split(',').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`bad data-word on ${el.textContent}`);
    const segIndex = $$('.scene').indexOf(el.closest('.scene'));
    return { el, a: segIndex + a, b: segIndex + b };
  });
  // magnetic pull on the finale button (pointer devices only)
  const mag = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse && !reduce) {
    addEventListener('pointermove', (e) => {
      const r = magnet.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < r.width * 1.3;
      mag.tx = near ? dx * 0.32 : 0; mag.ty = near ? dy * 0.32 : 0;
    });
  }
  return (t) => {
    if (reduce) return;
    const out = win(t, 0.05, 0.15);
    title.style.opacity = String(1 - out);
    title.style.transform = `translate3d(0, ${-out * 8}vh, 0)`;
    cue.style.opacity = String(1 - win(t, 0.01, 0.05));
    for (const w of words) {
      const span = w.b - w.a, fade = Math.min(0.08, span * 0.3);
      const o = win(t, w.a, w.a + fade) * (1 - win(t, w.b - fade, w.b));
      w.el.style.opacity = String(o);
      w.el.style.transform = `translate3d(0, ${(1 - o) * 3}vh, 0)`;
    }
    const f = win(t, CONFIG.time.finIn[0], CONFIG.time.finIn[1]);
    fin.style.opacity = String(f);
    fin.style.transform = `translate3d(0, ${(1 - f) * 4}vh, 0)`;
    fin.classList.toggle('on', f > 0.5);
    mag.x += (mag.tx - mag.x) * 0.15; mag.y += (mag.ty - mag.y) * 0.15;
    magnet.style.transform = `translate3d(${mag.x}px, ${mag.y}px, 0)`;
    magnet.firstElementChild.style.transform = `translate3d(${mag.x * 0.35}px, ${mag.y * 0.35}px, 0)`;
  };
}
