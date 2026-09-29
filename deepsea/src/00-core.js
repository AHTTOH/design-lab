/* DEEP SEA: shared core. Fragments in deepsea/src are concatenated in file-name order by deepsea/build.mjs
   into one inline module (file:// cannot load module files), so later fragments see these names. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ───────── config ───────── */
// Scroll maps to one dive parameter u in [0, zones]. Zone i owns u in [i, i + 1]; neighbours dissolve into each other
// inside CONFIG.blend of every boundary. Colours are linear-ish hex, the OutputPass applies ACES and sRGB.
const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  blend: 0.045,
  // Scroll velocity: |lenis.velocity| * scale, clamped, eased. Drives bubbles, streaks, plankton flashes, aberration.
  vel: { scale: 0.022, max: 1.6, ease: 0.07 },
  look: { yaw: 0.1, pitch: 0.06, ease: 0.06 },
  camera: { vfov: 55, minHfov: 62, maxVfov: 96, near: 0.05, far: 700 },
  bloom: { strength: 0.72, radius: 0.6, threshold: 0.78 },
  exposure: 1.05,
  msaa: 4,
  final: { vignette: 0.42, grain: 0.035, aberration: 0.0018, aberrationVel: 0.0035 },

  surface: {
    title: 'DEEP SEA', font: '900 400px Unbounded', titleColor: [0.002, 0.018, 0.06],
    depth: [2.5, 20], pitch: [0.78, 0.36], sun: [0.18, 0.93, -0.32], ior: 1.33,
    water: '#0a8fb4', deep: '#032a5e', sky: '#48c4e4', zenith: '#0f7fb8', sunColor: [2.6, 2.8, 2.7],
    titleOut: [0.2, 0.5], rays: 0.55,
    manta: { span: [0.36, 0.98], from: [1.45, 0.8], to: [-0.45, 0.6], scale: 0.34, opacity: 0.92 },
  },
  reef: {
    fog: '#0b8fb0', fogDensity: 0.024, domeTop: '#39d9ef', domeBottom: '#05518a',
    sand: '#3aa6b4', rock: '#135b73', caustic: 1.35, causticScale: 0.21,
    // Camera glides over the reef along -z and tips over the drop-off at the end.
    path: [
      { p: 0, pos: [0, 9.5, 46], yaw: 0, pitch: -0.28 },
      { p: 0.45, pos: [-2.5, 6.5, 10], yaw: 0.12, pitch: -0.2 },
      { p: 0.8, pos: [1.5, 5.5, -20], yaw: -0.08, pitch: -0.3 },
      { p: 1, pos: [0, 6, -33], yaw: 0, pitch: -0.5 },
    ],
    kelp: 70, kelpMobile: 44, rocks: 90, sponges: 60, fans: 18, edge: 48, dropZ: [-30, -44],
    sponge: ['#ff4fa3', '#8b5bff', '#ff7a4a', '#00e0c6'], fan: ['#c04bff', '#ff3d8b'],
  },
  fish: {
    count: 300, countMobile: 150, length: 0.62,
    maxSpeed: 5.2, minSpeed: 2.2, fleeSpeed: 11, sep: 0.9, sepK: 2.6, align: 2.2, alignK: 1.1, coh: 3.2, cohK: 0.7,
    homeK: 0.9, scareR: 4.2, scareK: 26, lead: 14, spread: [8, 3.5, 6], neighbours: 7,
    colors: ['#1e7cff', '#1e7cff', '#1e7cff', '#ff3fa8'], stripe: '#ffe14a',
  },
  twilight: {
    domeTop: '#0b4d9a', domeBottom: '#020a26', fog: '#062a66', fogDensity: 0.016,
    darkTop: '#06275a', darkBottom: '#01040f', fall: 130, snow: 5000, snowMobile: 2600,
    jellies: [
      { x: -5, y: -18, z: -16, s: 2.3, c: '#63f4ff', c2: '#8f7bff' },
      { x: 6, y: -34, z: -22, s: 3.1, c: '#b78bff', c2: '#ff5fd8' },
      { x: -2, y: -52, z: -11, s: 1.6, c: '#ff6fe0', c2: '#63f4ff' },
      { x: 3.5, y: -66, z: -30, s: 4.2, c: '#63f4ff', c2: '#6bffb8' },
      { x: -7, y: -82, z: -24, s: 2.6, c: '#8f7bff', c2: '#63f4ff' },
      { x: 1.2, y: -98, z: -14, s: 2.0, c: '#6bffb8', c2: '#ff6fe0' },
      { x: 8, y: -112, z: -34, s: 3.6, c: '#ff5fd8', c2: '#b78bff' },
      { x: -4, y: -126, z: -20, s: 2.2, c: '#63f4ff', c2: '#ff5fd8' },
    ],
    tentacles: 22, segs: 26,
  },
  midnight: {
    domeTop: '#020a1f', domeBottom: '#000106', travel: 150, lureAhead: 7.5, lureLight: 3.5,
    lure: '#5dffd8', flash: { intensity: 200, closeK: 0.22, angle: 0.34, penumbra: 0.55, distance: 60, idleMs: 1800 },
    plankton: 1800, planktonMobile: 1000, hatchet: 46, chains: 10, lantern: 64, hideBack: 22,
    reveal: [0.66, 0.9],
    angler: { at: [0.6, -1.2, -4.4], turn: 0.4, skin: '#6a5c80', head: [2.1, 1.7, 2.5], jaw: [2.2, 1.35, 2.95], gape: 0.22, teeth: 15 }, neon: ['#00f0ff', '#ff2fd0', '#b6ff3c', '#8a5bff'],
  },
  abyss: {
    domeTop: '#2a1c52', domeBottom: '#281b4a', vent: '#ff2f6d', ventHot: '#ff7ac8', haze: '#2a1470',
    vents: [[-6, -16], [4.5, -22], [-1.5, -30], [9, -34], [-10, -38]],
    ventH: [5.5, 7.5, 4.8, 6.2, 5], worms: 160, plume: 700, plumeMobile: 420,
    giant: [0.3, 0.74], comb: [0.7, 1], wallFrom: 60,
  },
  resurface: { bubbles: 700, bubblesMobile: 360, climb: 160, colors: ['#000106', '#031a44', '#0a6fa8', '#39d9ef'] },
  drift: {
    count: 520, countMobile: 300, scroll: 0.0011,
    // Per zone: [colour, strength, bubble look 0..1, idle rise speed]
    looks: [['#e8fdff', 0.8, 1, 0.05], ['#d8fbff', 0.55, 0.6, 0.03], ['#bfe6ff', 0.45, 0.2, 0.01], ['#6fdcff', 0.2, 0, 0.005], ['#b39bff', 0.25, 0, 0.01], ['#e8fdff', 0.9, 1, 0.12]],
  },
  // Big words per zone, [in-from, in-to, out-from, out-to] in u. Placement is a class on the element.
  words: [
    { text: '빛이 닿는 곳', u: [1.05, 1.12, 1.3, 1.38], place: 'top' },
    { text: '푸른 어스름', u: [2.06, 2.13, 2.32, 2.4], place: 'low right' },
    { text: '한밤의 바다', u: [3.05, 3.12, 3.28, 3.36], place: 'top' },
    { text: '심연', u: [4.05, 4.12, 4.26, 4.34], place: 'low' },
  ],
  finIn: [5.8, 5.9],
};

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < CONFIG.mobileBreak;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s) => document.querySelector(s);
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
const envelope = (p, r) => smooth(seg(p, r[0], r[1])) * (1 - smooth(seg(p, r[2], r[3])));
const col = (hex) => new THREE.Color(hex);
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Smooth 2D value noise on the CPU (terrain heights, rock bumps). Range about 0..1. */
function noise2(x, y) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
const fbm2 = (x, y) => noise2(x, y) * 0.5 + noise2(x * 2.03, y * 2.03) * 0.25 + noise2(x * 4.1, y * 4.1) * 0.125;
/** Still pose for reduced motion: each zone shows one moment, chosen per zone. */
const STILL = { surface: 0.08, reef: 0.42, twilight: 0.45, midnight: 0.82, abyss: 0.55, resurface: 0.9 };
const STILL_TIME = 7.3;
/** Count for this screen: mobile variant when the key exists. */
const countFor = (cfg, key) => (isMobile() && cfg[key + 'Mobile'] !== undefined ? cfg[key + 'Mobile'] : cfg[key]);

/* ───────── scroll: one dive parameter u in [0, zones] ───────── */
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
const runways = [...document.querySelectorAll('.zone')];
let spans = [];
function measureRunways() {
  const last = runways.length - 1;
  spans = runways.map((el, i) => ({ top: el.offsetTop, len: Math.max(1, el.offsetHeight - (i === last ? innerHeight : 0)) }));
}
function diveU() {
  const y = scrollY;
  for (let i = spans.length - 1; i >= 0; i--) {
    if (y >= spans[i].top) return i + clamp01((y - spans[i].top) / spans[i].len);
  }
  return 0;
}
measureRunways();
addEventListener('resize', measureRunways);

/** Eased, signed scroll speed. vel.k is its magnitude in [0, CONFIG.vel.max]. */
const vel = { v: 0, k: 0 };
function stepVelocity() {
  const c = CONFIG.vel, raw = lenis ? clamp(lenis.velocity * c.scale, -c.max, c.max) : 0;
  vel.v += (raw - vel.v) * c.ease;
  vel.k = Math.abs(vel.v);
}

/* ───────── pointer: look-around, flashlight, fish scare ───────── */
// pointer.nx, ny are -1..1 with +y up. lastMove lets the flashlight wander by itself when nobody steers it.
const pointer = { nx: 0, ny: 0, has: false, lastMove: -1e9 };
addEventListener('pointermove', (e) => {
  pointer.nx = (e.clientX / innerWidth) * 2 - 1; pointer.ny = -((e.clientY / innerHeight) * 2 - 1);
  pointer.has = true; pointer.lastMove = performance.now();
});
const look = { x: 0, y: 0 };
function stepLook() {
  if (reduce) return;
  const k = CONFIG.look.ease, tx = coarse ? 0 : pointer.nx, ty = coarse ? 0 : pointer.ny;
  look.x += (tx - look.x) * k; look.y += (ty - look.y) * k;
}
/** Apply the pointer look offset on top of a zone camera pose. */
function aim(camera, pos, yaw, pitch) {
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.rotation.set(pitch + look.y * CONFIG.look.pitch, yaw - look.x * CONFIG.look.yaw, 0);
}

/** Camera path through keyed poses {p, pos, yaw, pitch}, smoothstep between keys. */
function poseAt(keys, p) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1], t = smooth(seg(p, a.p, b.p));
  return {
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t),
  };
}
