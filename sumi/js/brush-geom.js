/* Brush strokes as SVG: a variable-width ink body plus bristle streaks, revealed by a dashoffset mask per stroke. */

const BRUSH = {
  headLen: 0.12, headPress: 0.3, wobble: 0.08, edgeRough: 0.1, entryLean: 0.42, entryDir: [-0.71, -0.71],
  tail: { needle: [0.58, 0.92], dew: [0.8, 0.14], fly: [0.55, 0.5] },
  flyCore: 0.8, bristleInset: 0.92, gapGain: 0.9, maskScale: 1.9,
  coreAlpha: 0.9, bristleAlpha: [0.35, 0.85],
};

let measureSvg = null;
/** Sample a centreline path string into evenly spaced points. SVG geometry needs the path in the document. */
function samplePath(d, step) {
  if (!measureSvg) {
    measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measureSvg.setAttribute('aria-hidden', 'true');
    measureSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(measureSvg);
  }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  measureSvg.appendChild(p);
  const len = p.getTotalLength();
  if (!(len > 0)) throw new Error(`brush centreline has no length: ${d}`);
  const n = Math.max(24, Math.min(260, Math.round(len / step)));
  const pts = [];
  for (let i = 0; i <= n; i++) { const q = p.getPointAtLength((i / n) * len); pts.push([q.x, q.y]); }
  p.remove();
  return { pts, len };
}

function widthAt(t, style, n) {
  let w = 1 + BRUSH.headPress * Math.pow(1 - seg(t, 0, BRUSH.headLen), 2);
  w *= 1 + BRUSH.wobble * (n(t * 6) - 0.5) * 2;
  const [from, drop] = BRUSH.tail[style];
  return w * (1 - drop * smooth(seg(t, from, 1)));
}

const fmt = (v) => v.toFixed(1);
const polyD = (pts) => 'M' + pts.map((q) => `${fmt(q[0])},${fmt(q[1])}`).join('L') + 'Z';
const lineD = (runs) => runs.filter((r) => r.length > 1).map((r) => 'M' + r.map((q) => `${fmt(q[0])},${fmt(q[1])}`).join('L')).join('');

/** Geometry for one stroke: body polygon and bristle streak paths. */
function strokeGeometry(spec, bristles) {
  const { pts } = samplePath(spec.d, 5);
  const W = spec.w, style = spec.end, rnd = mulberry32(spec.seed);
  const nW = noise1(spec.seed), nL = noise1(spec.seed + 101), nR = noise1(spec.seed + 202), nB = noise1(spec.seed + 303);
  const n = pts.length - 1;
  const frame = pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const t = i / n;
    return { x: q[0], y: q[1], tx, ty, nx: -ty, ny: tx, t, w: W * widthAt(t, style, nW) };
  });

  const coreEnd = style === 'fly' ? BRUSH.flyCore : 1;
  const body = frame.filter((f) => f.t <= coreEnd);
  const left = body.map((f) => { const h = f.w / 2 * (1 + BRUSH.edgeRough * (nL(f.t * 40) - 0.5) * 2); return [f.x + f.nx * h, f.y + f.ny * h]; });
  const right = body.map((f) => { const h = f.w / 2 * (1 + BRUSH.edgeRough * (nR(f.t * 40) - 0.5) * 2); return [f.x - f.nx * h, f.y - f.ny * h]; }).reverse();
  const cap = (f, dir, r) => {
    const out = [];
    for (let a = 1; a < 12; a++) {
      const th = (a / 12) * Math.PI, rr = r * (0.92 + 0.16 * rnd());
      out.push([f.x + f.nx * Math.cos(th) * rr * dir + f.tx * Math.sin(th) * rr * 0.9 * dir, f.y + f.ny * Math.cos(th) * rr * dir + f.ty * Math.sin(th) * rr * 0.9 * dir]);
    }
    return out;
  };
  const f0 = body[0], fe = body[body.length - 1];
  // Start cap swings behind the first point (right side back to left side), end cap bulges forward for a dew drop.
  // The brush enters from the upper left (역입), so the start blob leans that way instead of being a round capsule.
  const startCap = cap(f0, -1, f0.w / 2).map((q, i, a) => { const k = Math.sin(((i + 1) / (a.length + 1)) * Math.PI) * f0.w * BRUSH.entryLean; return [q[0] + BRUSH.entryDir[0] * k, q[1] + BRUSH.entryDir[1] * k]; });
  const endCap = style === 'dew' ? cap(fe, 1, fe.w / 2) : [];
  const core = polyD([...left, ...endCap, ...right, ...startCap]);

  const streaks = [];
  for (let k = 0; k < bristles; k++) {
    const o = ((k + 0.5) / bristles) * 2 - 1 + (rnd() - 0.5) * 0.08;
    const ink = 0.3 + 0.7 * rnd();
    const tEnd = 1 - (1 - ink) * (style === 'fly' ? 0.2 : 0.05);
    const runs = []; let run = [];
    for (const f of frame) {
      if (f.t > tEnd) break;
      const dry = style === 'fly' ? smooth(seg(f.t, 0.42, 1)) * (1.25 - ink) : smooth(seg(f.t, 0.7, 1)) * (0.55 - ink * 0.4);
      const gap = nB(f.t * 22 + k * 13.7) < dry * BRUSH.gapGain;
      if (gap) { if (run.length) runs.push(run); run = []; continue; }
      const h = f.w / 2 * BRUSH.bristleInset * o;
      run.push([f.x + f.nx * h, f.y + f.ny * h]);
    }
    if (run.length) runs.push(run);
    streaks.push({ d: lineD(runs), sw: (W / bristles) * (0.9 + 0.7 * ink), a: lerp(BRUSH.bristleAlpha[0], BRUSH.bristleAlpha[1], ink) });
  }
  return { core, streaks, maxW: W * (1 + BRUSH.headPress) };
}

/**
 * Build an SVG of brush strokes into `host`. Each stroke is hidden until set(i, t) draws it to fraction t.
 * `extra` is raw SVG appended before the strokes (e.g. filters for a bleed copy).
 */
function buildBrushSvg(host, { viewBox, strokes, id, bristles, extra = '' }) {
  const [vw, vh] = viewBox;
  const geos = strokes.map((s) => strokeGeometry(s, bristles));
  const masks = strokes.map((s, i) => `<mask id="${id}-m${i}" maskUnits="userSpaceOnUse" x="${-vw}" y="${-vh}" width="${vw * 3}" height="${vh * 3}">
      <path d="${s.d}" fill="none" stroke="#fff" stroke-width="${(geos[i].maxW * BRUSH.maskScale).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" visibility="hidden"/></mask>`).join('');
  const groups = geos.map((g, i) => `<g mask="url(#${id}-m${i})"><path d="${g.core}" fill="currentColor" fill-opacity="${BRUSH.coreAlpha}"/>${g.streaks.map((s) => `<path d="${s.d}" fill="none" stroke="currentColor" stroke-opacity="${s.a.toFixed(2)}" stroke-width="${s.sw.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</g>`).join('');
  host.innerHTML = `<svg viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>${masks}</defs>${extra}${groups}</svg>`;
  const reveal = $$(`#${host.id} mask path`);
  const last = new Float32Array(strokes.length).fill(-1);
  return {
    count: strokes.length,
    lengths: strokes.map((s) => samplePath(s.d, 20).len),
    set(i, t) {
      if (last[i] === t) return;
      last[i] = t;
      const m = reveal[i];
      m.setAttribute('visibility', t > 0 ? 'visible' : 'hidden');
      m.setAttribute('stroke-dashoffset', (1 - t).toFixed(4));
    },
  };
}

/** Spread drawing of all strokes across [from, to] by length, with a pause share between strokes. */
function strokeSchedule(lengths, from, to, gapShare) {
  const total = lengths.reduce((a, b) => a + b, 0), gap = ((to - from) * gapShare) / Math.max(1, lengths.length - 1);
  const drawSpan = (to - from) * (1 - gapShare);
  let at = from;
  return lengths.map((l) => { const a = at, b = at + (l / total) * drawSpan; at = b + gap; return [a, b]; });
}
