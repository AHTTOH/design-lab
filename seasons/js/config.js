/* SEASONS config. Every tunable number lives here. Colours are sRGB hex, converted to linear by THREE.Color. */
const CONFIG = {
  dprMax: 1.5, mobileBreak: 760, lenisLerp: 0.08, seed: 20260929,

  hill: { h: 1.6, s: 11, ground: 170, segs: 160 },
  /* distant rolling hills ring that fades into the horizon */
  far: { r: [70, 150], h: [3, 11], segs: 220 },

  tree: {
    attractors: 3200, attractorsMobile: 2400,
    crown: { y: 7.3, rx: 6.1, ry: 3.5, rz: 5.7, shell: 0.42 },
    trunkLean: [0.18, 0.06], step: 0.24, influence: 2.0, kill: 0.45, maxIter: 320, tropism: 0.16, jitter: 0.22,
    smoothPasses: 3, minTwig: 4, tipR: 0.014, pipeExp: 2.3, flareR: 1.55, flareH: 0.9,
    rings: [[0.16, 12], [0.05, 8], [0, 5]],
    bark: '#9a8472', barkDark: '#5e4d42', moss: '#7d8c52',
  },

  leaves: { count: 14000, countMobile: 7000, size: [0.3, 0.46], tipDepth: 5, spread: 0.1 },
  blossoms: { count: 16000, countMobile: 7000, size: [0.2, 0.28], budSize: 0.11, tipDepth: 4, spread: 0.22 },
  petals: { count: 2600, countMobile: 1400, size: 0.075 },
  grass: { count: 30000, countMobile: 13000, r: [1.2, 26], h: [0.22, 0.55] },
  rain: { count: 2600, countMobile: 1300, box: [26, 18, 26] },
  snow: { count: 4200, countMobile: 2200, box: [34, 20, 34] },
  fireflies: { count: 140, countMobile: 80 },
  puddles: [[3.5, -4.6, 1.5], [1.8, -6.6, 0.9], [5.4, -5.6, 1.0]],
  house: { pos: [-7.4, 4.2], yaw: 0.95, w: 2.4, d: 2.0, h: 1.5, roof: 1.05 },
  birds: { count: 9 },

  /* leaf colour ramp (per-instance progress 0..1), plus young spring green and fallen brown */
  leafRamp: ['#4f9a2f', '#b3c93a', '#f2c83a', '#f08526', '#d0392a'],
  leafYoung: '#9ad64a', leafDead: '#8a5a33',
  blossom: { petal: '#fff1f5', blush: '#f7a8c2', heart: '#c9406c', bud: '#b8445f' },

  /* season keys along the year clock t (0 = late winter bare, 4 wraps). */
  year: {
    bud: [-0.1, 0.16], bloom: [0.2, 0.44], shed: [0.52, 0.8], petal: [0.44, 0.58, 0.8, 0.95],
    leaf: [0.56, 1.05], autumn: [1.95, 2.65], fall: [2.35, 3.08],
    snowIn: [3.14, 3.55], snowOut: [3.86, 4.02], flowers: [0.3, 0.6, 1.3, 1.7],
  },
  /* year clock at each scene's start and end */
  sceneYear: { spring: [-0.12, 0.85], summer: [0.85, 1.9], autumn: [1.9, 3.08], winter: [3.08, 3.8], year: [3.8, 11.8], finale: [3.8, 4.45] },

  /* sky palette keyed on the year clock: [t, zenith, horizon, sun colour, sun elevation (rad), grass, grass tip] */
  skyKeys: [
    [0.0, '#5b93d0', '#d3e6f6', '#fff3e2', 0.62, '#7f9a55', '#b9c982'],
    [0.5, '#3b86d6', '#c6e3fa', '#fff4df', 0.78, '#5fae3c', '#b4e070'],
    [1.4, '#2272d0', '#b5dcfb', '#fffaf0', 0.95, '#3f8f30', '#8fcf52'],
    [2.3, '#3f82cc', '#c3dbee', '#ffc271', 0.3, '#8d9a3c', '#d7c46a'],
    [2.9, '#4a86c6', '#c9dbeb', '#ffcb80', 0.27, '#8a7f45', '#c7ad6a'],
    [3.4, '#3f7fcc', '#b4cfea', '#fff1e0', 0.4, '#7d8f64', '#aab98a'],
    [4.0, '#5b93d0', '#d3e6f6', '#fff3e2', 0.62, '#7f9a55', '#b9c982'],
  ],
  rainSky: { zenith: '#6f8497', horizon: '#aebcc7', dim: 0.32 },
  duskSky: { zenith: '#2f4f8e', horizon: '#f4a66a', sun: '#ff9a55', el: 0.06 },
  nightSky: { zenith: '#0c1a33', horizon: '#2c4467', moon: '#9fb8e6', el: 0.9 },
  snowColor: '#f6f9ff', wetDark: 0.55,
  light: { sun: 3.1, hemi: 1.35, moon: 0.55, hemiNight: 0.35, window: '#ffb45c', exposure: 1.05 },
  shadow: { map: 2048, mapMobile: 1024, extent: 17, bias: 0.0016 },

  /* per-scene overlays on scene progress: [start, full, fadeStart, end] */
  overlay: {
    summerRain: [0.3, 0.38, 0.56, 0.64], summerWet: [0.34, 0.45, 0.8, 0.95], summerDusk: [0.68, 0.84],
    fireflies: [0.8, 0.92], autumnDuskOut: [0, 0.12],
    winterSnow: [0.04, 0.14, 0.86, 0.98], winterNight: [0.5, 0.66], yearNightOut: [0, 0.08],
    birdsIn: [0.36, 0.7], birdsOut: [0.5, 0.78], finaleBirds: [0.3, 0.7],
  },

  /* camera keys per scene: [progress, target x, y, z, azimuth, elevation, distance, fov] */
  cam: {
    spring: [[0, 0, 7.6, 0, 0.4, 0.06, 12, 42], [0.3, 0.4, 8.2, 0.4, 0.75, 0.12, 9.5, 40], [0.56, 0, 7, 0, 1.05, 0.13, 21, 40], [0.8, 0.3, 8.6, 0.3, 1.5, -0.42, 8.6, 58], [1, 0, 6.6, 0, 1.9, 0.1, 22, 40]],
    summer: [[0, 0, 6.6, 0, 1.9, 0.1, 22, 40], [0.26, 0, 6.8, 0, 2.3, 0.15, 21, 40], [0.4, 3.4, 2.4, -4.9, 2.62, 0.3, 8.5, 46], [0.6, 3.4, 2.6, -5.1, 2.74, 0.26, 9, 46], [0.78, 0, 5.4, 0, 2.95, 0.06, 20, 46], [1, 0, 5.2, 0, 3.25, 0.05, 18, 46]],
    autumn: [[0, 0, 5.2, 0, 3.25, 0.05, 18, 46], [0.3, 1.0, 8.2, 1.0, 3.6, 0.1, 14, 38], [0.58, 0, 6.4, 0, 4.0, 0.12, 20, 40], [0.86, 0, 2.8, 0, 4.4, 0.2, 12.5, 46], [1, 0, 5.4, 0, 4.75, 0.12, 22, 40]],
    winter: [[0, 0, 5.4, 0, 4.75, 0.12, 22, 40], [0.36, 0, 6.2, 0, 5.0, 0.34, 24, 40], [0.62, -3.2, 4.0, 1.8, 5.75, 0.12, 24, 40], [0.9, -5.6, 2.9, 3.4, 5.95, 0.08, 10, 42], [1, -2.8, 4.6, 1.4, 6.1, 0.12, 23, 40]],
    finale: [[0, 0, 5.6, 0, 6.1, 0.16, 23, 40], [0.5, 0, 6.6, 0, 6.5, 0.14, 21, 40], [1, 0, 7.2, 0, 6.8, 0.2, 26, 40]],
  },
  yearCam: { target: [0, 5.6, 0], el: 0.16, dist: 23, fov: 40, turns: 2, blendIn: 0.07, blendOut: 0.93 },
  /* scroll velocity (px per frame from Lenis) feeds gusts and the montage */
  velocity: { gust: 0.018, gustMax: 1.6, spin: 0.0009, yearPush: 0.004, yearPushMax: 0.9, stiffness: 0.08, damping: 0.82 },
  wind: { base: 0.3, pointer: 0.8, ease: 0.04 },

  /* reduced motion: one still per scene at these progress points */
  stills: { spring: 0.58, summer: 0.22, autumn: 0.42, winter: 0.72, year: 0.2, finale: 0.95 },
  words: { in: [0.04, 0.2], out: [0.72, 0.92], titleOut: [0.06, 0.16] },
};
