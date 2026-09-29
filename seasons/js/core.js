/* SEASONS core: math helpers, seeded random, scroll engine, scene progress, pointer. */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) document.documentElement.classList.add('reduce');

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
/** 0 before a, rises to 1 at b, holds, falls back to 0 between c and d. */
const plateau = (p, r) => smooth(seg(p, r[0], r[1])) * (1 - smooth(seg(p, r[2], r[3])));
const $ = (s) => document.querySelector(s);
const isNarrow = () => innerWidth < CONFIG.mobileBreak;
const NARROW_AT_LOAD = isNarrow();
const pick = (desk, mob) => (NARROW_AT_LOAD ? mob : desk);

/** Seeded PRNG so the tree grows the same on every visit. */
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

/** Hill height, mirrored by hillH() in GLSL. */
const hillY = (x, z) => {
  const r = Math.hypot(x, z) / CONFIG.hill.s;
  return CONFIG.hill.h * Math.exp(-r * r * r);
};

/* ───────── scroll engine ───────── */
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
const velocity = () => (lenis ? lenis.velocity : 0);

const SCENE_IDS = ['spring', 'summer', 'autumn', 'winter', 'year', 'finale'];
const sceneEls = SCENE_IDS.map((id) => $(`#s-${id}`));
let sceneTops = [], docEnd = 1;
function measureScenes() {
  sceneTops = sceneEls.map((el) => el.offsetTop);
  docEnd = document.documentElement.scrollHeight - innerHeight;
}

/**
 * Where the scroll sits. `world` runs from one scene's top to the next scene's top, so the 3D state never
 * pauses between pins. `pin` is the sticky-pin progress used for words.
 */
function scrollState() {
  const y = window.scrollY, n = sceneTops.length;
  let i = 0;
  for (let k = 0; k < n; k++) if (y >= sceneTops[k] - 1) i = k;
  const top = sceneTops[i], next = i < n - 1 ? sceneTops[i + 1] : docEnd;
  const world = clamp01((y - top) / Math.max(1, next - top));
  const pins = sceneEls.map((el, k) => clamp01((y - sceneTops[k]) / Math.max(1, el.offsetHeight - innerHeight)));
  return { index: i, id: SCENE_IDS[i], world, pins };
}

/** Reduced motion: the scene whose screen holds the viewport centre. */
function stillState() {
  const mid = window.scrollY + innerHeight / 2;
  let i = 0;
  for (let k = 0; k < sceneTops.length; k++) if (mid >= sceneTops[k]) i = k;
  const id = SCENE_IDS[i];
  return { index: i, id, world: CONFIG.stills[id], pins: SCENE_IDS.map(() => 1) };
}

/* ───────── pointer ───────── */
const pointer = { nx: 0, ny: 0, active: false };
addEventListener('pointermove', (e) => {
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.active = true;
});

/** Critically damped-ish spring used for gusts and montage push. */
function spring(stiffness, damping) {
  let x = 0, v = 0;
  return {
    step(target) { v = (v + (target - x) * stiffness) * damping; x += v; return x; },
    get value() { return x; },
    reset() { x = 0; v = 0; },
  };
}
