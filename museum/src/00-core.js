/* MUSEUM: shared core. Fragments in museum/src are concatenated in file-name order by museum/build.mjs
   into one inline module (file:// cannot load module files), so later fragments see these names. */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ───────── config ───────── */
// World units are metres. The walk runs along -z, then turns +x out of the video room into the night.
const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  eye: 1.6,
  // Textures WebGL samples. build.mjs inlines them (downscaled) as data URIs so file:// does not taint the canvas.
  images: {
    garden: '%%IMG:museum/garden%%', field: '%%IMG:museum/field%%', stairs: '%%IMG:museum/stairs%%',
    orbits: '%%IMG:museum/orbits%%', mountain: '%%IMG:museum/mountain%%', kettle: '%%IMG:museum/kettle%%',
    poster: '%%IMG:video/ad5-ink%%',
  },
  video: '../assets/video/ad5-ink.mp4',
  camera: { vfov: 52, minHfov: 64, maxVfov: 92, near: 0.05, far: 900 },
  look: { yaw: 0.14, pitch: 0.08, ease: 0.07, rangeDeg: 30 },
  render: { exposure: 1.0, reflectScale: 0.5, reflectScaleMobile: 0.35, reflectStrength: 0.55, reflectRough: 0.012, shadowMap: 1024, shadowMapMobile: 512 },
  bloom: { strength: 0.62, radius: 0.55, threshold: 0.86 },
  hemi: { sky: '#8790a6', ground: '#1a1a1f', intensity: 0.35 },
  floor: { color: '#3a3d43', roughness: 0.62 },
  // Rooms in walk order. x and z are [from, to]. back: door in the far (-z) wall. mood: faint emissive tint on the walls.
  rooms: [
    { id: 'lobby', x: [-7, 7], z: [0, -16], h: 7, wall: '#1b2750', ceil: '#0a0f22', mood: '#2446ff', moodK: 0.018, back: { w: 3.4, h: 3.6 } },
    { id: 'paint', x: [-5, 5], z: [-16, -50], h: 5, wall: '#eef1f5', ceil: '#15171c', mood: '#8aa0d8', moodK: 0.012, back: { w: 2.6, h: 3.2 }, front: { w: 3.4, h: 3.6 } },
    { id: 'sculpt', x: [-8, 8], z: [-50, -70], h: 6, wall: '#5a0f1d', ceil: '#140509', mood: '#ff2a4a', moodK: 0.04, back: { w: 2.6, h: 3.2 }, front: { w: 2.6, h: 3.2 } },
    { id: 'light', x: [-8, 8], z: [-70, -90], h: 7, wall: '#07070d', ceil: '#040408', mood: '#4b2cff', moodK: 0.03, back: { w: 2.6, h: 3.2 }, front: { w: 2.6, h: 3.2 } },
    { id: 'video', x: [-7, 7], z: [-90, -106], h: 6, wall: '#062a2f', ceil: '#031416', mood: '#1fd6c8', moodK: 0.035, front: { w: 2.6, h: 3.2 }, right: { z: -97, w: 3.2, h: 3.6 } },
  ],
  wallT: 0.25,
  lobby: {
    word: 'MUSEUM', font: '700 300px Syne', wordWidth: 11, wordY: 5.05, wallZ: -15.73, glow: [0.55, 0.66, 1.25], glowGain: 1.25,
    lightOn: [0.02, 0.22], doorOpen: [0.38, 0.62], doorW: 1.7, doorH: 3.6, strips: 5,
  },
  // Paintings: side -1 = left wall, 1 = right wall. h: image height in metres, width follows the texture's real aspect.
  paintings: [
    { key: 'garden', side: -1, z: -22, h: 1.7, title: '밤의 정원', meta: '캔버스에 유채. 두껍게 긁어 올린 물감 사이로 흰 꽃이 핀다.', frame: '#15161a' },
    { key: 'field', side: 1, z: -26.5, h: 2.1, title: '푸른 문턱', meta: '캔버스에 아크릴 스테인. 해 질 녘 수평선을 세 줄의 색으로 줄였다.', frame: '#e9ecf1' },
    { key: 'stairs', side: -1, z: -32, h: 1.6, title: '물 위의 계단', meta: '캔버스에 유채. 달빛 바다에서 계단이 문으로 이어진다.', frame: '#3b2a1e' },
    { key: 'orbits', side: 1, z: -37, h: 2.0, title: '세 개의 궤도', meta: '리넨에 아크릴. 원 셋과 사선 하나.', frame: '#15161a' },
    { key: 'mountain', side: -1, z: -42.5, h: 1.55, title: '달 아래 산', meta: '장지에 수묵과 석채. 겹친 능선과 둥근 달.', frame: '#2a2622' },
    { key: 'kettle', side: 1, z: -46, h: 1.9, title: '빨간 주전자', meta: '캔버스에 실크스크린과 아크릴. 부엌의 주전자 하나.', frame: '#e9ecf1' },
  ],
  paint: { centerY: 1.72, frameW: 0.07, frameD: 0.06, spot: 60, spotAngle: 0.5, penumbra: 0.6, spotOut: 2.3, cone: 0.05 },
  sculptures: [
    { kind: 'twist', x: -3.6, z: -56, title: '비틀린 시간', meta: '스테인리스 스틸. 한 덩어리의 쇠를 천천히 돌려 감았다.' },
    { kind: 'marble', x: 3.6, z: -58.5, title: '흰 숨', meta: '대리석. 부풀었다 가라앉는 숨의 모양.' },
    { kind: 'knot', x: 0, z: -64, title: '접힌 물', meta: '청동. 흐르던 물이 스스로 매듭을 짓는다.' },
  ],
  sculpt: { plinth: [1.0, 1.05, 1.0], plinthColor: '#f2f4f7', spot: 70, spotAngle: 0.42, penumbra: 0.85, spin: 0.12, cone: 0.06 },
  lights: {
    center: [0, -80], beams: 40, top: 6.6, ringTop: 3.2, ringBottom: 3.2, twist: 1.9, twistVel: 0.012, spin: 0.05, width: 0.03,
    colors: ['#3d5bff', '#a238ff', '#ff2fb0', '#b6ff3c'], hueVel: 0.004, gain: 2.2, velEase: 0.06,
    title: '흐름에 답하는 빛', meta: '레이저, 거울, 관람객의 걸음. 걷는 속도에 따라 빛줄기가 감긴다.',
  },
  videoRoom: {
    screenW: 9.6, screenZ: -105.7, screenY: 3.2, gain: 1.15, playU: [3.55, 5.25],
    title: '푸른 잉크의 시간', meta: '단채널 영상, 무음, 반복 재생. 물속에 번지는 잉크를 오래 바라본다.',
  },
  exit: { doorOpen: [0.02, 0.2], sky: 520, stars: 2400, moonDir: [0.62, 0.36, -0.42], lamps: 6, hills: 160 },
  // Words shown on arrival in each room (no numbers). [room, in-from, in-to, out-from, out-to] in path units.
  words: [
    { text: '회화', u: [1.02, 1.08, 1.22, 1.28] },
    { text: '조각', u: [2.02, 2.08, 2.2, 2.26] },
    { text: '빛', u: [3.03, 3.09, 3.22, 3.28] },
    { text: '영상', u: [4.03, 4.09, 4.22, 4.28] },
    { text: '밤하늘', u: [5.1, 5.18, 5.4, 5.48] },
  ],
  intro: [-1, 0, 0.12, 0.2],
  finIn: [5.72, 5.84],
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
/** In, hold, out envelope over four breakpoints. */
const envelope = (p, r) => smooth(seg(p, r[0], r[1])) * (1 - smooth(seg(p, r[2], r[3])));
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const roomById = (id) => {
  const r = CONFIG.rooms.find((x) => x.id === id);
  if (!r) throw new Error(`room ${id} is not in CONFIG.rooms`);
  return r;
};

/* ───────── scroll: one path parameter u in [0, rooms] ───────── */
// u = room index + progress inside that room's runway. The last room ends when the page bottom reaches the viewport bottom.
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
const velocity = () => (lenis ? lenis.velocity : 0);
const runways = [...document.querySelectorAll('.room')];
let spans = [];
function measureRunways() {
  const last = runways.length - 1;
  spans = runways.map((el, i) => ({ top: el.offsetTop, len: Math.max(1, el.offsetHeight - (i === last ? innerHeight : 0)) }));
}
function pathU() {
  const y = scrollY;
  for (let i = spans.length - 1; i >= 0; i--) {
    if (y >= spans[i].top) return i + clamp01((y - spans[i].top) / spans[i].len);
  }
  return 0;
}
measureRunways();
addEventListener('resize', measureRunways);

/* ───────── pointer look-around and tilt (gyroscope on touch devices, pointer on desktop) ───────── */
const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });

const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
{
  const cfg = CONFIG.look, btn = $('#tilt-btn');
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
    console.info('DeviceOrientationEvent is not available, the view stays level');
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
}
function stepTilt() {
  if (reduce) return;
  const k = CONFIG.look.ease;
  tilt.x += (tilt.tx - tilt.x) * k; tilt.y += (tilt.ty - tilt.y) * k;
}

/* ───────── shared GLSL ───────── */
const HASH = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }`;
// 3D simplex noise, Ashima Arts / Stefan Gustavson (MIT).
const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
