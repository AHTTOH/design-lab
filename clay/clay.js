/* CLAY: scroll-driven claymation. Every visible change is quantised to "steps" so the page moves like stop-motion, not like video. */
(() => {
  'use strict';

  const CONFIG = {
    dir: '../assets/clay/',
    ext: '.webp',
    framesPerScene: 7,
    scenes: ['s1', 's2', 's3', 's4', 's5', 's6'],
    // Key still per scene for prefers-reduced-motion (0-based index).
    keyFrame: { s1: 4, s2: 3, s3: 3, s4: 3, s5: 5, s6: 4 },
    // Scene progress ranges.
    frames: { default: [0.1, 0.95], s6: [0.1, 0.8] },
    card: { peel: [0.035, 0.1], peelSteps: 6, lift: 118, tilt: -7 },
    end: { scene: 's6', show: [0.84, 0.9], steps: 4 },
    // Stop-motion stepping: each keyframe is held for `hold` steps, then crossfades over `fade` steps.
    step: { hold: 7, fade: 2 },
    camera: { zoom: [1.03, 1.09], panPct: 1.4 },
    jitter: { px: 2.2, deg: 0.18, flicker: 0.035 },
    weave: { fps: 12, px: 0.9 },
    boil: { fps: 8, deg: 3.2, px: 2.2 },
    fit: { maxCrop: 0.09, portraitZoom: 1.28, matteBlur: 22, matteDim: 0.72 },
    preload: { concurrency: 4, firstPass: [0, 3, 6] },
    dprMax: 1.5,
    lenisLerp: 0.09,
    magnet: { pull: 0.4, label: 0.18 },
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const seg = (p, r) => clamp01((p - r[0]) / (r[1] - r[0]));
  const quant = (v, n) => Math.floor(v * n) / n;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const dprNow = () => Math.min(devicePixelRatio || 1, CONFIG.dprMax);
  // Deterministic pseudo random from an integer so a given step always jitters the same way.
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const signed = (n) => hash(n) * 2 - 1;

  /* ───────── scroll engine ───────── */
  gsap.registerPlugin(ScrollTrigger);
  const lenis = reduce ? null : new Lenis({ lerp: CONFIG.lenisLerp });
  if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }

  function track(el, onProgress, onVisible) {
    onProgress(0);
    ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => onProgress(s.progress) });
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => onVisible(s.isActive) });
  }

  /* ───────── clay letters ───────── */
  function splitLetters(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = [...text].map((c) => `<span class="lt" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    return $$('.lt', el);
  }
  const boilers = [];
  $$('[data-letters]').forEach((el) => boilers.push({ el, letters: splitLetters(el), on: false }));
  function boil(b, tick) {
    b.letters.forEach((l, i) => {
      const k = tick * 31 + i * 7;
      l.style.transform = `translate(${signed(k) * CONFIG.boil.px}px, ${signed(k + 3) * CONFIG.boil.px}px) rotate(${signed(k + 5) * CONFIG.boil.deg}deg)`;
    });
  }
  boilers.forEach((b) => boil(b, 0));

  /* ───────── frame store: progressive preload, nearest loaded frame ───────── */
  const loadEl = $('#load');
  const store = (() => {
    const frames = Object.fromEntries(CONFIG.scenes.map((id) => [id, new Array(CONFIG.framesPerScene).fill(null)]));
    const listeners = new Set();
    const url = (id, i) => `${CONFIG.dir}${id}/${String(i + 1).padStart(2, '0')}${CONFIG.ext}`;
    let done = 0, total = 0;
    const loadOne = async ([id, i]) => {
      const img = new Image();
      img.src = url(id, i);
      try { await img.decode(); frames[id][i] = img; listeners.forEach((f) => f(id)); }
      catch (e) { console.error(`clay frame ${url(id, i)} failed to load`, e); }
      done++;
      loadEl.style.setProperty('--k', done / total);
      if (done === total) loadEl.classList.add('done');
    };
    const load = (list) => {
      total = list.length;
      let k = 0;
      const worker = async () => { while (k < list.length) await loadOne(list[k++]); };
      return Promise.all(Array.from({ length: CONFIG.preload.concurrency }, worker));
    };
    const nearest = (id, i) => {
      const f = frames[id];
      if (f[i]) return f[i];
      for (let d = 1; d < f.length; d++) { if (f[i - d]) return f[i - d]; if (f[i + d]) return f[i + d]; }
      return null;
    };
    const order = () => {
      const list = [], seen = new Set();
      const add = (id, i) => { const key = `${id}/${i}`; if (!seen.has(key)) { seen.add(key); list.push([id, i]); } };
      CONFIG.preload.firstPass.forEach((i) => CONFIG.scenes.forEach((id) => add(id, i)));
      CONFIG.scenes.forEach((id) => { for (let i = 0; i < CONFIG.framesPerScene; i++) add(id, i); });
      return list;
    };
    return { loadAll: () => load(order()), loadKeys: () => load(CONFIG.scenes.map((id) => [id, CONFIG.keyFrame[id]])), nearest, onLoad: (f) => listeners.add(f) };
  })();

  /* ───────── fitting: keep the whole character in view ───────── */
  // Landscape: cover, but never crop more than maxCrop per axis; the rest is a blurred matte of the same frame.
  // Portrait: width fit times portraitZoom, matte above and below.
  function frameRect(W, H, iw, ih) {
    const cover = Math.max(W / iw, H / ih), contain = Math.min(W / iw, H / ih);
    let s;
    if (W >= H) {
      const limit = Math.min(W / (iw * (1 - 2 * CONFIG.fit.maxCrop)), H / (ih * (1 - 2 * CONFIG.fit.maxCrop)));
      s = Math.max(contain, Math.min(cover, limit));
    } else s = (W / iw) * CONFIG.fit.portraitZoom;
    const w = iw * s, h = ih * s;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h, covers: w >= W && h >= H };
  }

  /* ───────── one stop-motion player per scene ───────── */
  function createPlayer(section) {
    const id = section.dataset.scene;
    const canvas = $('canvas', section), ctx = canvas.getContext('2d');
    const stage = $('.stage', section);
    const bg = getComputedStyle(section).getPropertyValue('--bg').trim();
    let want = { a: 0, b: 0, alpha: 0, step: 0, zoom: 1, pan: 0 }, drawnKey = '', active = false;

    const fit = () => { const d = dprNow(); canvas.width = Math.round(canvas.clientWidth * d); canvas.height = Math.round(canvas.clientHeight * d); drawnKey = ''; };

    function drawImage(img, W, H, alpha) {
      const r = frameRect(W, H, img.naturalWidth, img.naturalHeight);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
      return r;
    }
    function drawMatte(img, W, H) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.1;
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.save();
      ctx.filter = `blur(${CONFIG.fit.matteBlur * dprNow()}px) brightness(${CONFIG.fit.matteDim})`;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      ctx.restore();
    }

    function draw() {
      if (!active) return;
      const imgA = store.nearest(id, want.a), imgB = want.alpha > 0 ? store.nearest(id, want.b) : null;
      const key = `${imgA && imgA.src}|${imgB && imgB.src}|${want.alpha}|${want.step}|${canvas.width}x${canvas.height}`;
      if (key === drawnKey) return;
      drawnKey = key;
      const W = canvas.width, H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      if (!imgA) return;
      const probe = frameRect(W, H, imgA.naturalWidth, imgA.naturalHeight);
      if (!probe.covers) drawMatte(imgA, W, H);
      // camera: slow stepped push-in and pan, plus per-step replacement jitter
      const j = CONFIG.jitter, n = want.step + id.charCodeAt(1) * 1000;
      const jx = reduce ? 0 : signed(n) * j.px * dprNow(), jy = reduce ? 0 : signed(n + 1) * j.px * dprNow();
      const rot = reduce ? 0 : (signed(n + 2) * j.deg * Math.PI) / 180;
      ctx.translate(W / 2 + jx + (want.pan / 100) * W, H / 2 + jy);
      ctx.rotate(rot);
      ctx.scale(want.zoom, want.zoom);
      ctx.translate(-W / 2, -H / 2);
      drawImage(imgA, W, H, 1);
      if (imgB && imgB !== imgA) drawImage(imgB, W, H, want.alpha);
      ctx.globalAlpha = 1;
      canvas.style.filter = reduce ? 'none' : `brightness(${1 + signed(n + 4) * j.flicker})`;
    }

    fit();
    addEventListener('resize', () => { fit(); draw(); });
    store.onLoad((sid) => { if (sid === id) draw(); });
    gsap.ticker.add(draw);

    return {
      id, stage,
      set(next) { want = next; },
      show(on) { active = on; if (on) draw(); },
    };
  }

  /** Scene progress to stepped keyframe state (hold, then at most `fade` crossfade steps). */
  function frameState(id, p) {
    const range = CONFIG.frames[id] || CONFIG.frames.default;
    const last = CONFIG.framesPerScene - 1;
    const per = CONFIG.step.hold + CONFIG.step.fade;
    const totalSteps = last * per;
    const t = seg(p, range);
    const step = Math.min(totalSteps, Math.floor(t * totalSteps));
    const a = Math.min(last, Math.floor(step / per));
    const inKey = step - a * per;
    const alpha = a < last && inKey >= CONFIG.step.hold ? (inKey - CONFIG.step.hold + 1) / (CONFIG.step.fade + 1) : 0;
    // camera moves in the same steps as the frames, so nothing glides smoothly
    const camT = step / totalSteps;
    const dir = id.charCodeAt(1) % 2 ? 1 : -1;
    const zoom = CONFIG.camera.zoom[0] + (CONFIG.camera.zoom[1] - CONFIG.camera.zoom[0]) * camT;
    return { a, b: Math.min(last, a + 1), alpha, step, zoom, pan: dir * CONFIG.camera.panPct * (camT - 0.5) };
  }

  /* ───────── wire scenes ───────── */
  const weaving = new Set();
  $$('.scene').forEach((section) => {
    const id = section.dataset.scene;
    const player = createPlayer(section);
    const card = $('.card', section);
    const cardBoil = card ? boilers.find((b) => card.contains(b.el)) : null;
    const endEl = id === CONFIG.end.scene ? $('#end') : null;
    const endBoil = endEl ? boilers.find((b) => endEl.contains(b.el)) : null;

    const render = (p) => {
      if (reduce) { const k = CONFIG.keyFrame[id]; player.set({ a: k, b: k, alpha: 0, step: 0, zoom: 1, pan: 0 }); return; }
      player.set(frameState(id, p));
      if (card) {
        const k = quant(seg(p, CONFIG.card.peel), CONFIG.card.peelSteps);
        card.style.transform = k ? `translateY(${-k * CONFIG.card.lift}%) rotate(${k * CONFIG.card.tilt}deg)` : '';
        card.style.visibility = k >= 1 ? 'hidden' : 'visible';
        if (cardBoil) cardBoil.on = k < 1;
      }
      if (endEl) {
        const k = quant(seg(p, CONFIG.end.show), CONFIG.end.steps);
        endEl.style.opacity = k;
        endEl.style.transform = `translateY(${(1 - k) * 6}vh) scale(${0.9 + k * 0.1})`;
        endEl.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
        if (endBoil) endBoil.on = k > 0;
      }
    };
    track(section, render, (on) => {
      player.show(on);
      if (on) weaving.add(player); else weaving.delete(player);
      if (!on) { if (cardBoil) cardBoil.on = false; if (endBoil) endBoil.on = false; }
    });
  });

  /* ───────── gate weave + letter boil, only while something is on screen ───────── */
  if (!reduce) {
    let lastWeave = 0, lastBoil = 0, weaveTick = 0, boilTick = 0;
    gsap.ticker.add((time) => {
      if (time - lastWeave >= 1 / CONFIG.weave.fps && weaving.size) {
        lastWeave = time; weaveTick++;
        weaving.forEach((pl) => {
          const n = weaveTick * 13 + pl.id.charCodeAt(1);
          pl.stage.style.transform = `translate(${signed(n) * CONFIG.weave.px}px, ${signed(n + 1) * CONFIG.weave.px}px)`;
        });
      }
      if (time - lastBoil >= 1 / CONFIG.boil.fps) {
        lastBoil = time; boilTick++;
        boilers.forEach((b) => { if (b.on) boil(b, boilTick); });
      }
    });
  }

  /* ───────── magnetic button ───────── */
  const magnet = $('#magnet'), label = $('span', magnet);
  if (!reduce) {
    magnet.addEventListener('pointermove', (e) => {
      const r = magnet.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(magnet, { x: dx * CONFIG.magnet.pull, y: dy * CONFIG.magnet.pull, duration: 0.4, ease: 'power3.out' });
      gsap.to(label, { x: dx * CONFIG.magnet.label, y: dy * CONFIG.magnet.label, duration: 0.4, ease: 'power3.out' });
    });
    magnet.addEventListener('pointerleave', () => gsap.to([magnet, label], { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .4)' }));
  }

  /* ───────── start loading ───────── */
  if (reduce) { loadEl.hidden = true; store.loadKeys(); } else store.loadAll();
})();
