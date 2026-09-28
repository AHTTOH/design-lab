/* VHS boot: builds the picture and the glass, wires the scenes, and adds the channel-change static between scenes. */
'use strict';

const picture = createPicture($('#picture'));
const crt = createCRT($('#crt'));

initPower(picture);
initHome(picture);
initRewind(picture);
initSurf(picture);
initEject(picture);
initOff(picture);

// Reduced motion redraws only when something changes, and posters arrive after the first draw.
[...Object.values(clips).map((c) => c.poster), ...Object.values(stills)].forEach((img) => img.addEventListener('load', () => { picture.markDirty(); if (crt) crt.markDirty(); }));

/* Channel-change static where one scene hands over to the next: peaks when both pins share the screen. */
const sections = [...document.querySelectorAll('.scene')];
let seams = [];
const measureSeams = () => { seams = sections.slice(0, -1).map((s) => s.offsetTop + s.offsetHeight); };
ScrollTrigger.addEventListener('refresh', measureSeams);
measureSeams();

function seamStatic() {
  const y = scrollY, vh = innerHeight, cfg = CONFIG.boundary;
  let k = 0;
  for (const seam of seams) k = Math.max(k, 1 - smooth(clamp01(Math.abs(y - (seam - vh / 2)) / (vh * cfg.width))));
  return k;
}

// Registered last so every scene has drawn and raised its FX before the glass reads them.
gsap.ticker.add((time, deltaMs) => {
  resetFX();
  const dt = Math.min(0.1, deltaMs / 1000);
  picture.frame(time, dt);
  const seam = reduce ? 0 : seamStatic();
  raiseFX('static', seam * CONFIG.boundary.static);
  raiseFX('band', tapeStress.value * 0.5);
  if (FX.band > 0.02 && FX.bandY === 0.5) FX.bandY = fract(time * 0.13);
  if (crt) crt.frame(time, FX);
});
