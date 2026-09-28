/* Scene 3, rewind: the night-drive tape is scrubbed by the scroll position (video.currentTime on an all-intra
   re-encode). Scrolling down fast-forwards, up rewinds, stopping pauses; search noise bars and streaks follow speed. */
'use strict';

const REWIND = {
  scrub: [0.04, 0.96],
  tailSec: 0.05,               // stay clear of the very last frame, some decoders show black there
  seekEpsilon: 0.02,
  deadband: 0.6,               // |lenis.velocity| below this counts as stopped
  pauseHoldMs: 260,
  searchGain: 0.03, searchEase: 0.2,
  bars: 3, barSpeed: 0.9, barH: [0.035, 0.09], barAlpha: 0.85,
  streaksMax: 34, streakAlpha: 0.32,
  pauseBarY: 0.86, pauseBarH: 0.028, pauseJitterPx: 1.5,
  splitGain: 0.009,
  words: { ff: '빨리감기', rew: '되감기', pause: '일시정지' },
  glyphs: { ff: 'g-ff', rew: 'g-rew', pause: 'g-pause' },
};

/** Blob URL over http(s) so seeking never depends on server range support; file:// already seeks natively. */
function loadScrubVideo() {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.addEventListener('error', () => console.error('VHS: scrub video failed to load', v.error));
  const url = assetUrl(CONFIG.scrub.video);
  if (location.protocol === 'file:') { v.src = url; return v; }
  fetch(url)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
    .then((blob) => { v.src = URL.createObjectURL(blob); })
    .catch((e) => console.error(`VHS: scrub video fetch failed ${url}`, e));
  return v;
}

function initRewind(picture) {
  const bigWord = $('#rew-big-word'), bigGlyph = $('#rew-big-glyph'), big = $('#rew-big');
  const poster = loadImage(CONFIG.scrub.poster);
  let video = null, p = 0, target = 0, state = 'pause', stillSince = 0, search = 0, barPhase = 0;

  const setState = (next) => {
    if (next === state) return;
    state = next;
    bigWord.textContent = REWIND.words[next];
    bigGlyph.className = `g ${REWIND.glyphs[next]}`;
    if (!reduce) gsap.fromTo(big, { scale: 1.08 }, { scale: 1, yPercent: -50, duration: 0.35, ease: 'power3.out', overwrite: true });
  };

  function seek() {
    if (!video || video.readyState < 1 || video.seeking || !video.duration) return;
    const t = seg(p, ...REWIND.scrub) * Math.max(0, video.duration - REWIND.tailSec);
    target = t;
    if (Math.abs(video.currentTime - target) > REWIND.seekEpsilon) video.currentTime = target;
  }

  function updateState(now) {
    const v = velocity();
    if (Math.abs(v) >= REWIND.deadband) { stillSince = now; setState(v > 0 ? 'ff' : 'rew'); }
    else if (now - stillSince > REWIND.pauseHoldMs) setState('pause');
  }

  function drawSearch(ctx, w, h, dt) {
    const dir = state === 'rew' ? -1 : 1;
    barPhase = fract(barPhase + dir * search * REWIND.barSpeed * dt);
    for (let i = 0; i < REWIND.bars; i++) {
      const bh = h * lerp(REWIND.barH[0], REWIND.barH[1], search);
      noiseBar(ctx, fract(i / REWIND.bars + barPhase) * (h + bh) - bh, bh, w, REWIND.barAlpha * Math.min(1, search * 1.6));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(170, 200, 255, ${REWIND.streakAlpha})`;
    const n = Math.round(search * REWIND.streaksMax);
    for (let i = 0; i < n; i++) {
      const len = w * (0.3 + Math.random() * 0.7);
      ctx.fillRect(dir > 0 ? Math.random() * w * 0.3 : w - len - Math.random() * w * 0.3, Math.random() * h, len, Math.max(1, h * 0.003));
    }
    ctx.restore();
  }

  scene(picture, {
    section: '#s-rewind', pin: '#rewind-pin',
    progress: (x) => { p = x; seek(); },
    visible: (on) => { if (on && !video && !reduce) { video = loadScrubVideo(); video.addEventListener('seeked', seek); video.addEventListener('loadedmetadata', seek); } },
    draw: (ctx, w, h, t, dt) => {
      if (!reduce) updateState(performance.now());
      search += (clamp01(Math.abs(velocity()) * REWIND.searchGain) - search) * REWIND.searchEase;
      seek();
      const src = video && video.readyState >= 2 ? video : drawable(poster);
      if (!src) return;
      const paused = state === 'pause';
      const roll = paused && !reduce ? Math.round(Math.sin(t * 60) * REWIND.pauseJitterPx) : 0;
      const fx = tapeFx(Math.max(tapeStress.value * 0.5, search * 0.6), { roll, split: search * REWIND.splitGain, band: search, bandY: fract(barPhase + 0.5) });
      tapeFrame(ctx, src, w, h, fx, t);
      if (search > 0.03) drawSearch(ctx, w, h, dt);
      if (paused) noiseBar(ctx, h * REWIND.pauseBarY, h * REWIND.pauseBarH, w, 0.7);
      raiseFX('band', search * 0.8);
      if (search > 0.03) FX.bandY = fract(barPhase + 0.5);
    },
  });
}
