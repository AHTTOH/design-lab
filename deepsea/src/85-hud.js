/* ───────── overlay: scroll cue, zone words, the way back ───────── */
function createHud() {
  const cue = $('#cue'), word = $('#word'), fin = $('#fin'), magnet = $('#magnet'), magnetText = magnet.querySelector('span');
  const show = (el, k, dy = 0, blur = 0) => {
    el.style.opacity = k.toFixed(3);
    el.style.transform = dy ? `translateY(${((1 - k) * dy).toFixed(1)}px)` : '';
    el.style.filter = blur && k < 0.999 ? `blur(${((1 - k) * blur).toFixed(1)}px)` : '';
  };
  const pick = (k) => (reduce ? (k > 0.001 ? 1 : 0) : k);
  let wordText = '', finOn = null;

  // Magnetic button: pulls toward the pointer inside a radius, the label inside moves less.
  const mag = { x: 0, y: 0, tx: 0, ty: 0 };
  const RADIUS = 160, PULL = 0.38, INNER = 0.45;
  addEventListener('pointermove', (e) => {
    const r = magnet.getBoundingClientRect(), cx = r.left + r.width / 2 - mag.x, cy = r.top + r.height / 2 - mag.y;
    const dx = e.clientX - cx, dy = e.clientY - cy, near = Math.hypot(dx, dy) < RADIUS && finOn;
    mag.tx = near ? dx * PULL : 0; mag.ty = near ? dy * PULL : 0;
  });
  const setFin = (on) => {
    if (on === finOn) return;
    finOn = on;
    fin.classList.toggle('on', on);
    fin.setAttribute('aria-hidden', String(!on));
    magnet.tabIndex = on ? 0 : -1;
  };

  return function update(u) {
    show(cue, reduce ? 0 : 1 - smooth(seg(u, 0, 0.03)));
    const w = CONFIG.words.find((x) => u >= x.u[0] && u <= x.u[3]);
    if (w && w.text !== wordText) { wordText = w.text; word.textContent = wordText; word.className = `word fade ${w.place}`; }
    show(word, w ? pick(envelope(u, w.u)) : 0, 30, 14);

    const fk = reduce ? (u >= CONFIG.finIn[0] ? 1 : 0) : smooth(seg(u, ...CONFIG.finIn));
    show(fin, fk, 30);
    setFin(fk > 0.5);
    if (!reduce) {
      mag.x += (mag.tx - mag.x) * 0.14; mag.y += (mag.ty - mag.y) * 0.14;
      magnet.style.transform = `translate(${mag.x.toFixed(1)}px, ${mag.y.toFixed(1)}px)`;
      magnetText.style.transform = `translate(${(mag.x * INNER).toFixed(1)}px, ${(mag.y * INNER).toFixed(1)}px)`;
    }
  };
}
