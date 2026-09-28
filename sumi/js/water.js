/* Scene 4: ink in water. Flow videos seen through a brush-stroke mask that is painted on (wipe),
   swells until it is the whole screen, then closes back into a stroke. Plain <video> so file:// works. */
{
  const cfg = CONFIG.water, water = $('#water');
  const vids = ['#v-cloud', '#v-plume', '#v-bloom'].map((s) => $(s));
  const players = vids.map(manageVideo);
  const l1 = charsOf('#water-line'), l2 = charsOf('#water-line2');
  const ghost = $('#water-ghost');
  let visible = false, progress = 0;

  // Which clips are on screen right now, so only those decode.
  const sync = () => {
    const x1 = segR(progress, cfg.cross), x2 = segR(progress, cfg.cross2);
    const want = [x1 < 1, x1 > 0 && x2 < 1, x2 > 0];
    players.forEach((pl, i) => pl.set(visible && want[i]));
  };

  track('#s-water', (p) => {
    progress = p;
    const base = isNarrow() ? cfg.strokeVwNarrow : cfg.strokeVw;
    const grow = Math.pow(smooth(segR(p, cfg.grow)), 2.4), shrink = smooth(segR(p, cfg.shrink));
    const g = grow * (1 - shrink);
    // Mask width in vw: the stroke itself, then large enough that its solid middle covers the viewport.
    const size = base + (cfg.growMax - base) * g;
    const wipe = smooth(segR(p, cfg.wipe)) * 115 - 15;
    const unwipe = smooth(segR(p, cfg.unwipe)) * cfg.unwipeMax;
    // A pale still of the ink cloud holds the paper while the stroke is small, and again as it closes.
    ghost.style.opacity = cfg.ghostFrom * (1 - smooth(segR(p, cfg.ghostOut))) + cfg.ghostEndTo * smooth(segR(p, cfg.ghostEnd));
    water.classList.toggle('bare', g > 0.995);
    water.style.setProperty('--ms', `${size.toFixed(2)}vw`);
    // Closing: the gradient edge travels left to right again, so the stroke dries off from its start.
    water.style.setProperty('--wipe', `${(unwipe > 0 ? 100 : wipe).toFixed(2)}%`);
    water.style.webkitMaskImage = unwipe > 0 ? `var(--brush-mask), linear-gradient(90deg, transparent ${(unwipe * 115 - 15).toFixed(2)}%, #000 ${(unwipe * 115).toFixed(2)}%)` : '';
    water.style.maskImage = water.style.webkitMaskImage;
    vids[1].style.opacity = smooth(segR(p, cfg.cross));
    vids[2].style.opacity = smooth(segR(p, cfg.cross2));
    inkChars(l1, segR(p, cfg.lineIn) * (1 - segR(p, cfg.lineOut)));
    inkChars(l2, segR(p, cfg.line2In) * (1 - segR(p, cfg.line2Out)));
    sync();
  }, (on) => { visible = on; sync(); });
}
