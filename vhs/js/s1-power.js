/* Scene 1, power on: the tube warms up from a single line (time based, on load), then the VCR blue screen,
   a tracking band rolls through, static rises and the first tape shows through it. */
'use strict';

const POWER = {
  bootMs: 1400,
  line: [0, 0.38], open: [0.38, 0.78], titleIn: [0.7, 1],   // shares of the boot time
  blueTop: '#1d34e6', blueBottom: '#08137e',
  band: [0.14, 0.24, 0.5, 0.6],                               // tracking band envelope over scene progress
  bandTurns: 5,
  staticIn: [0.5, 0.82], staticMax: 0.75, staticOut: [0.88, 1], staticKeep: 0.45,
  peek: [0.58, 0.96], peekMax: 0.9,
  titleOut: [0.8, 0.96],
  words: [[0, '외부입력'], [0.3, '테이프 넣는 중'], [0.62, '재생']],
  caBase: 0.02, caStress: 0.14, caBand: 0.06, jitterPx: 18,
};

function initPower(picture) {
  const title = $('#power-title'), word = $('#power-osd-word');
  const bootStart = performance.now();
  let p = 0, boot = reduce ? 1 : 0, lastWord = '';

  const setWord = (text) => { if (text !== lastWord) { word.textContent = text; lastWord = text; } };
  const wordAt = (x) => POWER.words.reduce((w, [at, text]) => (x >= at ? text : w), POWER.words[0][1]);
  const bandEnv = () => envelope(p, POWER.band);

  function updateDom() {
    const stress = tapeStress.value, b = bandEnv();
    const inK = reduce ? 1 : smooth(seg(boot, ...POWER.titleIn));
    title.style.opacity = inK * (1 - smooth(segR(p, POWER.titleOut)));
    title.style.setProperty('--ca', `${POWER.caBase + stress * POWER.caStress + b * POWER.caBand}em`);
    const jx = reduce ? 0 : (Math.random() - 0.5) * POWER.jitterPx * (stress + b * 0.5);
    title.style.translate = `${jx}px 0`;
    setWord(boot < 1 ? '전원' : wordAt(p));
  }

  function blueScreen(w, h, t) {
    const buf = buffer('power-blue', w, h), g = buf.ctx;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, POWER.blueTop); grad.addColorStop(1, POWER.blueBottom);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const peek = smooth(segR(p, POWER.peek)) * POWER.peekMax, src = frameOf(clips.beach);
    if (peek > 0.01 && src) { g.globalAlpha = peek; drawFramed(g, src, w, h); g.globalAlpha = 1; }
    const st = smooth(segR(p, [POWER.staticIn[0], POWER.staticIn[1]])) * POWER.staticMax * (1 - smooth(segR(p, POWER.staticOut)) * (1 - POWER.staticKeep));
    staticFill(g, 0, 0, w, h, st);
    return buf;
  }

  /** The warm-up: a bright line grows, then opens into the picture with a flash. */
  function bootMask(ctx, w, h) {
    if (boot >= 1) return;
    const a = smooth(segR(boot, POWER.line)), b = smooth(segR(boot, POWER.open));
    const openH = Math.max(2, h * b), y0 = (h - openH) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, y0); ctx.fillRect(0, y0 + openH, w, h - y0 - openH);
    if (b < 0.02) { ctx.fillRect(0, y0, w, openH); }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - b) * 0.9;
    ctx.fillStyle = '#cfe0ff';
    const lw = w * a;
    ctx.fillRect((w - lw) / 2, y0 - 1, lw, openH + 2);
    ctx.shadowColor = '#8fb4ff'; ctx.shadowBlur = 30;
    ctx.fillRect((w - lw) / 2, h / 2 - 1, lw, 2);
    ctx.restore();
  }

  scene(picture, {
    section: '#s-power', pin: '#power-pin',
    progress: (x) => { p = x; want(clips.beach, 'power', x > POWER.peek[0] - 0.05); updateDom(); },
    visible: (on) => { if (!on) want(clips.beach, 'power', false); },
    draw: (ctx, w, h, t) => {
      if (!reduce) boot = clamp01((performance.now() - bootStart) / POWER.bootMs);
      updateDom();
      const b = bandEnv();
      const fx = tapeFx(tapeStress.value, { band: Math.max(tapeStress.value, b), bandY: fract(p * POWER.bandTurns) });
      tapeFrame(ctx, blueScreen(w, h, t), w, h, fx, t);
      bootMask(ctx, w, h);
      raiseFX('band', b * 0.8);
      if (b > 0.01) FX.bandY = fract(p * POWER.bandTurns);
    },
  });
}
