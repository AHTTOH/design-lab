/* Scene 4, channel surf: the scene is cut into channels. Crossing into the next one bursts static, the new picture
   rolls in from below and the OSD names the channel. Only the channel on screen plays. */
'use strict';

const SURF = {
  channels: [
    { name: '바다', clip: 'beach' },
    { name: '밤길', clip: 'drive' },
    { name: '오락실', clip: 'arcade' },
    { name: '수족관', still: 'aquarium' },
    { name: '불꽃놀이', clip: 'fireworks' },
    { name: '볼링장', still: 'bowling' },
  ],
  span: [0.02, 0.98],
  burst: 0.1,          // share of a channel either side of a cut that carries static
  staticMax: 0.95,
  rollIn: 0.14,        // share of a channel the new picture takes to roll into place
  rollScreens: 0.7,
  stillDrift: 0.03,    // stills breathe a little so they do not read as frozen
};

function initSurf(picture) {
  const nameEl = $('#surf-name'), N = SURF.channels.length;
  let p = 0, idx = 0, f = 0, on = false;

  const locate = () => {
    const x = seg(p, ...SURF.span) * N;
    idx = Math.min(N - 1, Math.floor(x));
    f = x - idx;
  };
  const staticAt = () => {
    const toNext = idx < N - 1 ? 1 - f : Infinity, fromPrev = idx > 0 ? f : Infinity;
    return 1 - smooth(clamp01(Math.min(toNext, fromPrev) / SURF.burst));
  };
  const syncPlayback = () => SURF.channels.forEach((c, i) => { if (c.clip) want(clips[c.clip], 'surf', on && i === idx); });

  scene(picture, {
    section: '#s-surf', pin: '#surf-pin',
    progress: (x) => {
      p = x;
      const before = idx;
      locate();
      if (idx !== before || nameEl.textContent !== SURF.channels[idx].name) { nameEl.textContent = SURF.channels[idx].name; syncPlayback(); }
    },
    visible: (v) => { on = v; syncPlayback(); },
    draw: (ctx, w, h, t) => {
      const ch = SURF.channels[idx];
      const src = ch.clip ? frameOf(clips[ch.clip]) : drawable(stills[ch.still]);
      const st = reduce ? 0 : staticAt();
      const roll = idx > 0 && !reduce ? (1 - smooth(clamp01(f / SURF.rollIn))) * h * SURF.rollScreens : 0;
      if (src) {
        const fx = tapeFx(Math.max(tapeStress.value, st * 0.6), { roll, bandY: fract(t * 0.2) });
        if (ch.still && !reduce) {
          const k = 1 + SURF.stillDrift * Math.sin(t * 0.4);
          const buf = buffer('surf-still', w, h);
          buf.ctx.fillStyle = '#000'; buf.ctx.fillRect(0, 0, w, h);
          buf.ctx.save(); buf.ctx.translate(w / 2, h / 2); buf.ctx.scale(k, k); buf.ctx.translate(-w / 2, -h / 2);
          drawFramed(buf.ctx, src, w, h);
          buf.ctx.restore();
          tapeFrame(ctx, buf, w, h, fx, t);
        } else tapeFrame(ctx, src, w, h, fx, t);
      }
      staticFill(ctx, 0, 0, w, h, st * SURF.staticMax);
      raiseFX('static', st * 0.5);
      raiseFX('band', st);
    },
  });
}
