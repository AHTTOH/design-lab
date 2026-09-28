/* Scene 6, power off: colour bars collapse to a bright line, the line to a dot, the dot fades. What stays on the
   dark glass is burn-in: faint bars and a green afterimage of the title. Then a magnetic button leads back to ../ */
'use strict';

const OFF = {
  collapseY: [0.06, 0.24], collapseX: [0.24, 0.34], dot: [0.34, 0.46],
  lineMin: 0.006, whiten: 0.85, dotR: [0.05, 0.004],
  burn: [0.14, 0.34], burnAlpha: 0.24,     // burn-in shows through while the picture folds, so the tube never goes flat black
  ghost: [0.3, 0.46], ghostOpacity: 0.36,
  osdOut: [0.06, 0.12],
  button: [0.46, 0.56],
  magnet: { radius: 170, pull: 0.35, inner: 0.2, ease: 0.15 },
};

function initOff(picture) {
  const ghost = $('#off-ghost'), copy = $('#off-copy'), osd = $('#off-osd'), magnet = $('#magnet');
  let p = 0;

  function updateDom() {
    osd.style.opacity = 1 - smooth(segR(p, OFF.osdOut));
    ghost.style.opacity = smooth(segR(p, OFF.ghost)) * OFF.ghostOpacity;
    const k = reduce ? (p >= OFF.button[0] ? 1 : 0) : smooth(segR(p, OFF.button));
    copy.style.opacity = k;
    copy.style.visibility = k > 0.01 ? 'visible' : 'hidden';
  }

  function bars(w, h) {
    const b = buffer('off-bars', w, h);
    if (b.ready !== `${w}x${h}`) { colourBars(b.ctx, w, h); b.ready = `${w}x${h}`; }
    return b;
  }

  /** Burn-in: bars drawn through a tiny buffer so they come back blurred. */
  function burnIn(ctx, w, h, a) {
    if (a <= 0.01) return;
    const tiny = buffer('off-burn', 28, 16);
    colourBars(tiny.ctx, 28, 16);
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tiny, 0, 0, w, h);
    ctx.restore();
  }

  function collapse(ctx, w, h) {
    const cy = smooth(segR(p, OFF.collapseY)), cx = smooth(segR(p, OFF.collapseX)), d = segR(p, OFF.dot);
    if (cx < 1) {
      const sy = lerp(1, OFF.lineMin, cy), sx = lerp(1, OFF.lineMin * h / w, cx);
      const bw = w * sx, bh = Math.max(1, h * sy);
      const x = (w - bw) / 2, y = (h - bh) / 2;
      ctx.drawImage(bars(w, h), x, y, bw, bh);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(220, 235, 255, ${cy * OFF.whiten})`;
      ctx.fillRect(x, y, bw, bh);
      ctx.restore();
    }
    if (cx > 0.6 && d < 1) {
      const r = h * lerp(OFF.dotR[0], OFF.dotR[1], d), a = (1 - d) * smooth(seg(cx, 0.6, 1));
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r * 3);
      grad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      grad.addColorStop(0.25, `rgba(170, 200, 255, ${a * 0.8})`);
      grad.addColorStop(1, 'rgba(60, 90, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(w / 2 - r * 3, h / 2 - r * 3, r * 6, r * 6);
    }
  }

  // Magnetic button: pulled toward the pointer inside a radius, the label a little further.
  const pull = { x: 0, y: 0, tx: 0, ty: 0 };
  const label = magnet.querySelector('span');
  addEventListener('pointermove', (e) => {
    const r = magnet.getBoundingClientRect(), mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
    const inside = Math.hypot(mx, my) < OFF.magnet.radius;
    pull.tx = inside ? mx * OFF.magnet.pull : 0; pull.ty = inside ? my * OFF.magnet.pull : 0;
  });
  if (!reduce) gsap.ticker.add(() => {
    pull.x += (pull.tx - pull.x) * OFF.magnet.ease; pull.y += (pull.ty - pull.y) * OFF.magnet.ease;
    if (Math.abs(pull.x) + Math.abs(pull.y) < 0.05 && !pull.tx && !pull.ty) return;
    magnet.style.transform = `translate(${pull.x}px, ${pull.y}px)`;
    label.style.transform = `translate(${pull.x * OFF.magnet.inner}px, ${pull.y * OFF.magnet.inner}px)`;
  });

  scene(picture, {
    section: '#s-off', pin: '#off-pin',
    progress: (x) => { p = x; updateDom(); },
    draw: (ctx, w, h) => {
      burnIn(ctx, w, h, smooth(segR(p, OFF.burn)) * OFF.burnAlpha);
      collapse(ctx, w, h);
    },
  });
}
