/* Scene 6: one ensō in a single breath, the seal pressed beside it, and a magnetic way back to the gallery. */
const ENSO = {
  viewBox: [1000, 1000],
  strokes: [{ d: 'M468,132 C690,118 872,288 868,504 C864,712 700,872 492,866 C290,860 132,700 136,498 C140,340 238,214 372,160', w: 98, end: 'fly', seed: 41 }],
};

{
  const cfg = CONFIG.end;
  const enso = buildBrushSvg($('#enso'), { ...ENSO, id: 'en', bristles: 16 });
  const seal = $('#seal-big'), sealBleed = $('#seal-bleed'), magnet = $('#magnet'), label = magnet.querySelector('span'), pin = $('#s-end .pin');

  track('#s-end', (p) => {
    enso.set(0, reduce ? 1 : lerp(cfg.ensoStart, 1, smooth(segR(p, cfg.enso))));
    const k = reduce ? 1 : segR(p, cfg.press);
    // Lift, hover, press: the seal drops fast at the end, like a hand.
    const drop = Math.pow(k, 3);
    seal.style.opacity = smooth(seg(k, 0, 0.3));
    seal.style.transform = `translateY(${(1 - drop) * -6}vh) scale(${(1.7 - drop * 0.7).toFixed(4)}) rotate(${((1 - drop) * -8).toFixed(2)}deg)`;
    seal.style.filter = k < 1 ? `drop-shadow(0 ${(1 - drop) * 30}px ${(1 - drop) * 24}px rgba(0,0,0,${0.18 * (1 - drop)}))` : 'none';
    const thump = !reduce && k > 0.94 && k < 1 ? (1 - k) * 0.12 : 0;
    pin.style.transform = thump ? `scale(${1 - thump})` : '';
    // Cinnabar soaks a hair past the carved edge after the press.
    const b = reduce ? 1 : smooth(segR(p, cfg.bleed));
    sealBleed.style.opacity = 0.35 * b;
    sealBleed.style.transform = `scale(${1 + b * 0.035})`;
    const m = reduce ? 1 : smooth(segR(p, cfg.button));
    magnet.style.opacity = m;
    magnet.style.pointerEvents = m > 0.5 ? 'auto' : 'none';
    magnet.tabIndex = m > 0.5 ? 0 : -1;
  });

  magnet.addEventListener('pointermove', (e) => {
    if (reduce) return;
    const r = magnet.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    gsap.to(magnet, { x: dx * 0.4, y: dy * 0.4, duration: 0.4, ease: 'power3.out' });
    gsap.to(label, { x: dx * 0.18, y: dy * 0.18, duration: 0.4, ease: 'power3.out' });
  });
  magnet.addEventListener('pointerleave', () => gsap.to([magnet, label], { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .4)' }));
}
