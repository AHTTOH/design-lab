/* SEASONS words and the magnetic button. */

/** Wrap each glyph so words can rise out of a blur one letter at a time. */
function splitWord(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => `<span class="c" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  return [...el.querySelectorAll('.c')];
}

/* per word: which scene pin drives it and its in/out windows on that pin's progress */
const WORDS = [
  { sel: '#title', scene: 0, in: null, out: [0.05, 0.14] },
  { sel: '#w-spring', scene: 0, in: [0.18, 0.32], out: [0.74, 0.9] },
  { sel: '#w-summer', scene: 1, in: [0.03, 0.18], out: [0.28, 0.4] },
  { sel: '#w-autumn', scene: 2, in: [0.06, 0.22], out: [0.7, 0.86] },
  { sel: '#w-winter', scene: 3, in: [0.08, 0.24], out: [0.8, 0.94] },
  { sel: '#w-year', scene: 4, in: [0.06, 0.18], out: [0.5, 0.68] },
  { sel: '#w-finale', scene: 5, in: [0.06, 0.26], out: null },
].map((w) => ({ ...w, el: $(w.sel), chars: splitWord($(w.sel)) }));

function drawWord(w, p) {
  const n = w.chars.length;
  const kIn = w.in ? p : 1, kOut = w.out ? seg(p, w.out[0], w.out[1]) : 0;
  w.chars.forEach((c, i) => {
    const off = (i / Math.max(1, n)) * 0.35;
    const a = w.in ? smooth(seg(kIn, w.in[0] + off * (w.in[1] - w.in[0]), w.in[1])) : 1;
    const b = smooth(clamp01(kOut * 1.3 - off * 0.3));
    const v = a * (1 - b);
    c.style.opacity = v.toFixed(3);
    c.style.transform = `translate3d(0, ${((1 - a) * 0.35 - b * 0.25).toFixed(3)}em, 0)`;
    c.style.filter = v >= 0.999 || v <= 0.001 ? 'none' : `blur(${((1 - v) * 10).toFixed(1)}px)`;
  });
}

const cue = $('#cue'), fin = $('#fin'), magnet = $('#magnet'), magnetLabel = magnet.querySelector('span');

function updateWords(st) {
  if (reduce) return;
  for (const w of WORDS) drawWord(w, st.pins[w.scene]);
  cue.style.opacity = (1 - seg(st.pins[0], 0.005, 0.03)).toFixed(3);
  const f = smooth(seg(st.pins[5], 0.4, 0.55));
  fin.style.opacity = f.toFixed(3);
  fin.style.pointerEvents = f > 0.5 ? 'auto' : 'none';
  fin.style.visibility = f > 0.01 ? 'visible' : 'hidden';
}

/* magnet: the disc leans toward the pointer, the label a little further, both spring back */
const mag = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0 };
if (!reduce) {
  magnet.addEventListener('pointermove', (e) => {
    const r = magnet.getBoundingClientRect();
    mag.tx = (e.clientX - (r.left + r.width / 2)) * 0.42;
    mag.ty = (e.clientY - (r.top + r.height / 2)) * 0.42;
  });
  magnet.addEventListener('pointerleave', () => { mag.tx = 0; mag.ty = 0; });
}
function updateMagnet() {
  if (reduce) return;
  mag.vx = (mag.vx + (mag.tx - mag.x) * 0.12) * 0.78;
  mag.vy = (mag.vy + (mag.ty - mag.y) * 0.12) * 0.78;
  mag.x += mag.vx; mag.y += mag.vy;
  magnet.style.transform = `translate3d(${mag.x.toFixed(2)}px, ${mag.y.toFixed(2)}px, 0)`;
  magnetLabel.style.transform = `translate3d(${(mag.x * 0.35).toFixed(2)}px, ${(mag.y * 0.35).toFixed(2)}px, 0)`;
}
