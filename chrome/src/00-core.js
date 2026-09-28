/* CHROME: shared core. Fragments in chrome/src are concatenated in file-name order by chrome/build.mjs
   into one inline module (file:// cannot load module files), so later fragments see these names. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

/* ───────── config ───────── */
const CONFIG = {
  dprMax: 1.5,
  lenisLerp: 0.08,
  mobileBreak: 760,
  // Textures WebGL samples. build.mjs inlines them as data URIs so file:// does not taint the canvas.
  images: { sky: '%%IMG:sky%%', foil: '%%IMG:foil%%', player: '%%IMG:player%%', star: '%%IMG:star%%', butterfly: '%%IMG:butterfly%%' },
  tilt: { rangeDeg: 30, ease: 0.08 },
  env: { skyRadius: 45, ground: '#2a45a8', groundSky: [0.42, 0.52, 0.95], horizon: '#f2f4ff', horizonWidth: 0.05, groundFrom: -0.02, groundTo: -0.35, lightScale: 0.22, blur: 0.015 },
  hero: {
    detail: 72, detailMobile: 40, radius: 1.15, fov: 32, camDist: 6.4, portraitFit: 0.85,
    amp: [0.07, 0.34], freq: [1.1, 2.3], twistMax: 2.4, pullMax: 0.55,
    liquefy: [0.08, 0.34], twist: [0.36, 0.62], settle: [0.66, 0.9], exit: [0.95, 1], reduceAt: 0.04,
    orbitTurns: 0.5, tiltYaw: 0.5, tiltPitch: 0.3, flow: 0.25, pointerEase: 0.06,
    title: [0.12, 0.4], kor: [0.42, 0.5, 0.78, 0.86],
    roughness: 0.05,
  },
  bubbles: {
    // life: share of the scene one bubble takes to cross the screen. rise: start and end height in screen heights.
    // popAt: point in its life where it pops. popLen: scene share the pop takes.
    count: 56, countMobile: 34, radius: [0.14, 0.95], bigShare: 0.12, spreadX: 1.05, spreadZ: [-5, 1.5],
    life: [0.22, 0.42], rise: [-0.85, 0.85], wobble: 0.3, popAt: [0.4, 0.78], popLen: 0.012, reduceAt: 0.37,
    fov: 40, camZ: 9, pointerPopPx: 1, regrowMs: 2600, popAnimMs: 380,
    popWord: [0, 0.08, 0.7, 0.95], kor: [0.3, 0.38, 0.62, 0.7],
  },
  holo: {
    fov: 34, camZ: 6.2, portraitFit: 0.95, cardW: 1, cardH: 1.4, corner: 0.075, border: 0.045,
    cards: ['player', 'star', 'butterfly'],
    enter: [0, 0.07], fan: [0.07, 0.3], focus: [[0.3, 0.5], [0.5, 0.7], [0.7, 0.9]], exit: [0.95, 1],
    fanX: 1.25, fanRot: 0.22, focusScale: 1.55, backPush: 1.6, tiltGain: 0.45, reduceAt: 0.22,
    word: [-1, 0, 0.26, 0.34], kor: [0.34, 0.42, 0.86, 0.94],
  },
  melt: {
    fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
    word: 'MELT', size: 1, depth: 0.42, curveSegments: 10, bevelThickness: 0.14, bevelSize: 0.07, bevelSegments: 8,
    tessEdge: 0.045, tessIterations: 10, fov: 30, camDist: 9, portraitFit: 1.4,
    meltIn: [0.1, 0.55], meltOut: [0.8, 0.95], meltMax: 0.8, lift: 0.35, dripBase: 0.2, dripColGain: 1.25,
    velGain: 0.018, stiffness: 0.08, damping: 0.82, wobbleGain: 1.4, dripGain: 0.55,
    drops: 26, dropStart: [0.3, 0.78], dropLife: 0.1, dropFall: 2.4, dropSize: [0.07, 0.14],
    turns: 0.35, tiltYaw: 0.45, tiltPitch: 0.25, kor: [0.02, 0.1, 0.84, 0.94], roughness: 0.04,
  },
  flight: {
    length: 320, fov: 58, fovKick: 16, fovVelGain: 0.35, fovEase: 0.08, swayX: 3.2, swayY: 1.4, freqX: 5, freqY: 3.2,
    fog: '#b7c3ff', fogNear: 18, fogFar: 95,
    shapesPer: 34, shapesPerMobile: 20, radial: [2.6, 15], ringEvery: 36, ringRadius: 4.2,
    clouds: 46, cloudsMobile: 28, cloudSize: [9, 22], cloudOpacity: 0.7, cloudFade: [6, 30],
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.92 }, samples: 4, samplesMobile: 0,
    fly: [0.02, 0.98], reduceAt: 0.08, word: [-1, 0, 0.12, 0.2], kor: [0.55, 0.62, 0.8, 0.88], tiltYaw: 0.18, tiltPitch: 0.1,
  },
  finale: { titleIn: [0.06, 0.36], blobIn: [0, 0.4], copyIn: [0.45, 0.55], ringTilt: 1.1, ringSpin: 0.35 },
};

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < CONFIG.mobileBreak;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const segR = (p, r) => seg(p, r[0], r[1]);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpR = (r, t) => lerp(r[0], r[1], t);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
/** In, hold, out envelope over four breakpoints. */
const envelope = (p, r) => smooth(seg(p, r[0], r[1])) * (1 - smooth(seg(p, r[2], r[3])));
/** Deterministic PRNG so layouts are the same on every load. */
function mulberry32(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ───────── scroll engine ───────── */
gsap.registerPlugin(ScrollTrigger);
const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
const velocity = () => (lenis ? lenis.velocity : 0);

/** Progress of a sticky scene plus a visibility flag while any part of it is on screen. */
function track(sel, onProgress, onVisible) {
  const el = $(sel);
  onProgress(0);
  ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => onProgress(s.progress) });
  if (onVisible) ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => onVisible(s.isActive) });
}

/** Split text into .ch spans (one per letter) and return them. */
function split(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = `<span class="ln" aria-hidden="true">${[...text].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`;
  return [...el.querySelectorAll('.ch')];
}
$$('[data-split]').forEach(split);

/** Fade and slide a DOM element with an in-hold-out envelope. */
function showBy(el, p, range, dx = 0, dy = 0) {
  const k = reduce ? 1 : envelope(p, range);
  el.style.opacity = k;
  el.style.translate = `${(1 - k) * dx}vw ${(1 - k) * dy}vh`;
}

/* ───────── pointer and tilt (gyroscope on touch devices, pointer on desktop) ───────── */
const pointer = { x: innerWidth / 2, y: innerHeight / 2, moved: -1e9 };
addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = performance.now(); });

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

/* ───────── one transparent WebGL renderer shared by every scene ───────── */
// Each mode draws only inside its own sticky pin rectangle (viewport + scissor). The canvas is transparent,
// so the CSS sky and type of each pin show through wherever no chrome is drawn.
function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const modes = [];
  let W = 1, H = 1, dirty = true, painted = false, ready = false;
  const fit = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setPixelRatio(dprNow()); renderer.setSize(W, H, false);
    modes.forEach((m) => m.resize && m.resize(W, m.pin.clientHeight));
    dirty = true;
  };
  const clearAll = () => { renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear(); };
  function frame(time, dt) {
    if (!ready) return;
    const live = modes.filter((m) => m.on);
    if (!live.length) { if (painted) { clearAll(); painted = false; } return; }
    if (reduce && !dirty) return;
    dirty = false;
    clearAll();
    for (const m of live) {
      const r = m.pin.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= H) continue;
      const top = Math.max(0, r.top), bottom = Math.min(H, r.bottom);
      renderer.setViewport(0, H - r.bottom, W, r.height);
      renderer.setScissor(0, H - bottom, W, bottom - top);
      renderer.setScissorTest(true);
      m.draw(time, dt, r);
    }
    renderer.setScissorTest(false);
    painted = true;
  }
  const add = (mode) => { const m = { on: false, ...mode }; modes.push(m); if (m.resize) m.resize(W, m.pin.clientHeight); return m; };
  addEventListener('resize', fit);
  if (reduce) addEventListener('scroll', () => { dirty = true; }, { passive: true });
  fit();
  return { renderer, add, frame, markDirty: () => { dirty = true; }, setReady: () => { ready = true; dirty = true; }, size: () => [W, H] };
}

/* ───────── textures and the shared sky environment ───────── */
function loadTexture(name) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(CONFIG.images[name], (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined,
    (e) => reject(new Error(`texture ${name} failed to load: ${e?.message ?? e}`))));
}

const SKY_DOME_FS = `
uniform sampler2D uSky; uniform vec3 uGround, uGroundSky, uHorizon; uniform float uHorizonWidth, uGroundFrom, uGroundTo;
varying vec3 vDir;
vec2 equi(vec3 d) { return vec2(atan(d.z, d.x) / 6.2831853 + .5, asin(clamp(d.y, -1., 1.)) / 3.14159265 + .5); }
void main() {
  vec3 d = normalize(vDir);
  vec3 sky = texture2D(uSky, equi(d)).rgb;
  float ground = smoothstep(uGroundFrom, uGroundTo, d.y);
  vec3 below = texture2D(uSky, equi(vec3(d.x, -d.y, d.z))).rgb * uGroundSky + uGround * .35;
  vec3 col = mix(sky, below, ground);
  col += uHorizon * exp(-abs(d.y - uGroundFrom) / uHorizonWidth) * .8;
  gl_FragColor = vec4(col, 1.);
}`;
const SKY_DOME_VS = `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/** Chrome needs contrast: generated sky above, a deep blue ground below a bright horizon line, plus RoomEnvironment softboxes for sparkle. */
function skyEnvironment(renderer, sky) {
  const cfg = CONFIG.env, env = new RoomEnvironment(renderer);
  env.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isMeshStandardMaterial) o.visible = false;
    else if (o.material.isMeshBasicMaterial) { o.material = o.material.clone(); o.material.color.multiplyScalar(cfg.lightScale); }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(cfg.skyRadius, 64, 32), new THREE.ShaderMaterial({
    vertexShader: SKY_DOME_VS, fragmentShader: SKY_DOME_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: { uSky: { value: sky }, uGround: { value: new THREE.Color(cfg.ground) }, uGroundSky: { value: new THREE.Vector3(...cfg.groundSky) }, uHorizon: { value: new THREE.Color(cfg.horizon) },
      uHorizonWidth: { value: cfg.horizonWidth }, uGroundFrom: { value: cfg.groundFrom }, uGroundTo: { value: cfg.groundTo } },
  }));
  env.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, cfg.blur).texture;
  pmrem.dispose();
  return tex;
}

/** Chrome body material shared by the blob, the lettering and the flight shapes. */
function chromeMaterial(env, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, envMap: env, envMapIntensity: 1.15, ...extra });
}

/* ───────── shared GLSL ───────── */
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
const EQUI = `vec2 equi(vec3 d) { return vec2(atan(d.z, d.x) / 6.2831853 + .5, asin(clamp(d.y, -1., 1.)) / 3.14159265 + .5); }`;
/** Thin-film interference approximated by phase-shifted cosines: the classic soap and foil rainbow. */
const FILM = `vec3 film(float t) { return .5 + .5 * cos(6.2831853 * (t + vec3(0., .33, .67))); }`;

/** Camera distance that keeps a subject of the given width in frame on portrait screens. */
function fitDistance(camera, base, portraitFit) {
  return base / Math.min(1, camera.aspect / portraitFit);
}
