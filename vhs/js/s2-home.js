/* Scene 2, home video: the beach tape plays inside the tube. Scrolling fast strains the tape (wobble, tracking tear,
   RGB split, dropouts); the tape also wears slowly across the scene. Camcorder titler lettering comes and goes. */
'use strict';

const HOME = {
  titleA: [0.08, 0.16, 0.4, 0.48],
  titleB: [0.56, 0.64, 0.86, 0.94],
  wear: [0.45, 1], wearMax: 0.35,      // baseline stress the tape reaches by the end of the scene
  bandSpeed: 0.11,                     // tracking band drift, screens per second
};

function initHome(picture) {
  const a = $('#home-title-a'), b = $('#home-title-b');
  let p = 0;
  const show = (el, r) => { el.style.opacity = reduce ? (envelope(p, r) > 0.5 ? 1 : 0) : envelope(p, r); };

  scene(picture, {
    section: '#s-home', pin: '#home-pin',
    progress: (x) => { p = x; show(a, HOME.titleA); show(b, HOME.titleB); },
    visible: (on) => want(clips.beach, 'home', on),
    draw: (ctx, w, h, t) => {
      const src = frameOf(clips.beach);
      if (!src) return;
      const wear = smooth(segR(p, HOME.wear)) * HOME.wearMax;
      const stress = Math.max(tapeStress.value, wear);
      const bandY = fract(t * HOME.bandSpeed);
      tapeFrame(ctx, src, w, h, tapeFx(stress, { band: stress, bandY }), t);
      raiseFX('band', stress * 0.7);
      if (stress > 0.02) FX.bandY = bandY;
    },
  });
}
