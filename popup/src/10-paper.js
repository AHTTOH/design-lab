/* ───────── paper: procedural fibre texture, card stock materials, cut shapes and fold mechanisms ───────── */

/** Tileable paper fibre height field drawn in a canvas: thousands of short strokes plus fine speckle. */
function makeGrain() {
  const cfg = CONFIG.paper, size = cfg.grainPx, rnd = mulberry32(7);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  for (let i = 0; i < cfg.fibres; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * PI, l = 3 + rnd() * 16, v = rnd() < 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.035 + rnd() * 0.075})`;
    g.lineWidth = 0.5 + rnd() * 1.3;
    const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    // draw the stroke in all 9 tiles around the canvas so the texture wraps without a seam
    for (let ox = -size; ox <= size; ox += size) for (let oy = -size; oy <= size; oy += size) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + dx, y + oy + dy); g.stroke();
    }
  }
  const img = g.getImageData(0, 0, size, size), h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = (img.data[i * 4] + (rnd() - 0.5) * 14) / 255;

  const colour = document.createElement('canvas'), normal = document.createElement('canvas'), rough = document.createElement('canvas');
  [colour, normal, rough].forEach((cv) => { cv.width = cv.height = size; });
  const ci = colour.getContext('2d').createImageData(size, size), ni = normal.getContext('2d').createImageData(size, size), ri = rough.getContext('2d').createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const [r0, r1] = cfg.roughness;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, v = at(x, y);
    const tone = clamp(246 + (v - 0.5) * 50, 0, 255);
    ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = tone; ci.data[i + 3] = 255;
    const dx = (at(x + 1, y) - at(x - 1, y)) * 4, dy = (at(x, y + 1) - at(x, y - 1)) * 4;
    const len = Math.hypot(dx, dy, 1);
    ni.data[i] = (-dx / len * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / len * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = lerp(r0, r1, clamp01(v * 1.4 - 0.2)) * 255; ri.data[i + 3] = 255;
  }
  colour.getContext('2d').putImageData(ci, 0, 0); normal.getContext('2d').putImageData(ni, 0, 0); rough.getContext('2d').putImageData(ri, 0, 0);
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(colour, true), normal: tex(normal, false), rough: tex(rough, false) };
}

const paperKit = { grain: null, cache: new Map() };

function grainCopy(tex, rx, ry) {
  const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t;
}

/** Face and cut-edge materials for one card colour. UVs are in world units, so the grain has one scale everywhere. */
function paperMats(color, rx = CONFIG.paper.grainRepeat, ry = rx) {
  const key = `${color}|${rx.toFixed(3)}|${ry.toFixed(3)}`;
  if (paperKit.cache.has(key)) return paperKit.cache.get(key);
  const cfg = CONFIG.paper, g = paperKit.grain;
  const face = new THREE.MeshStandardMaterial({
    color, map: grainCopy(g.map, rx, ry), normalMap: grainCopy(g.normal, rx, ry), normalScale: new THREE.Vector2(cfg.normal, cfg.normal),
    roughnessMap: grainCopy(g.rough, rx, ry), roughness: 1, metalness: 0,
  });
  // A scissor cut shows the card's core a little lighter than its face.
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), cfg.edgeLift), roughness: 0.95, metalness: 0 });
  const mats = [face, edge];
  paperKit.cache.set(key, mats);
  return mats;
}

/* shapes (all in the XY plane, base on y = 0 unless noted) */
function rectShape(w, h, x0 = -w / 2, y0 = 0) {
  const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x0 + w, y0); s.lineTo(x0 + w, y0 + h); s.lineTo(x0, y0 + h); s.closePath(); return s;
}
function roundRectShape(w, h, r, x0 = -w / 2, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0); return s;
}
function circleShape(r, cx = 0, cy = r) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, PI * 2, false); return s; }
function ringShape(ro, ri) { const s = circleShape(ro, 0, 0); const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, PI * 2, true); s.holes.push(hole); return s; }
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; }
function starShape(ro, ri, n = 5, cy = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = HALF_PI + (i * PI) / n, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return polyShape(pts);
}
/** Pine silhouette: stacked jagged tiers on a short trunk. */
function pineShape(w, h, tiers = 4) {
  const trunk = h * 0.12, tw = w * 0.14, pts = [[-tw / 2, 0], [tw / 2, 0], [tw / 2, trunk]];
  const right = [], step = (h - trunk) / tiers;
  for (let i = 0; i < tiers; i++) {
    const y = trunk + i * step, k = 1 - i / tiers, half = (w / 2) * (0.35 + 0.65 * k);
    right.push([half, y], [half * 0.45, y + step * 0.85]);
  }
  pts.push(...right, [0, h]);
  pts.push(...right.slice().reverse().map(([x, y]) => [-x, y]));
  pts.push([-tw / 2, trunk]);
  return polyShape(pts);
}
/** Strip whose top edge is a wave, spanning x0..x1. */
function waveShape(x0, x1, h, amp, waves, phase) {
  const s = new THREE.Shape(), n = 48;
  s.moveTo(x0, 0); s.lineTo(x1, 0);
  for (let i = n; i >= 0; i--) {
    const x = lerp(x0, x1, i / n), a = ((x - x0) / (x1 - x0)) * waves * PI * 2 + phase;
    s.lineTo(x, h + Math.sin(a) * amp + Math.sin(a * 2.3 + 1) * amp * 0.25);
  }
  s.closePath(); return s;
}
/** Cloud from overlapping bumps on a flat base. */
function cloudShape(w, h) {
  const s = new THREE.Shape(), bumps = [[-0.36, 0.42], [-0.1, 0.62], [0.18, 0.55], [0.38, 0.38]];
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
  s.quadraticCurveTo(w / 2 + 0.02, h * 0.3, w * 0.42, h * 0.38);
  bumps.slice().reverse().forEach(([bx, by], i, arr) => {
    const nx = i + 1 < arr.length ? arr[i + 1][0] : -0.46;
    s.quadraticCurveTo(w * (bx + nx) / 2 + w * 0.02, h * (by + 0.5), w * nx, h * by * 0.8);
  });
  s.quadraticCurveTo(-w / 2 - 0.02, h * 0.3, -w / 2, 0);
  return s;
}

/* meshes */
function cut(shape, color, depth = CONFIG.paper.thick) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, paperMats(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/** Flat printed or glued shape without its own thickness (windows, stripes). */
function glue(shape, color, z = CONFIG.paper.thick / 2 + 0.0015) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), paperMats(color)[0]);
  m.position.z = z; m.receiveShadow = true;
  return m;
}

/* fold mechanisms. Each returns { hinge, body, set(e) } where e 0 = folded flat, 1 = standing, > 1 overshoot. */
function lift(layer) { return CONFIG.paper.thick / 2 + 0.0015 + layer * CONFIG.paper.layerLift; }

/** Single hinged flap. dir 1 lies back (top away from the reader), -1 lies forward. */
function flap(parent, { x = 0, z = 0, y = 0, dir = 1, layer = 0 } = {}) {
  const hinge = new THREE.Group(); hinge.position.set(x, y + lift(layer), z); parent.add(hinge);
  const body = new THREE.Group(); hinge.add(body);
  return { hinge, body, set(e) { hinge.rotation.x = -dir * HALF_PI * (1 - e); } };
}

/** Figure glued to a V-fold support: two card wings behind it open like a book as it stands. */
function vfold(parent, { x = 0, z = 0, y = 0, dir = 1, layer = 0, w = 0.5, h = 0.8, color = COLORS.white, open = 0.95 } = {}) {
  const f = flap(parent, { x, z, y, dir, layer });
  const back = -CONFIG.paper.thick * 1.2;
  const L = new THREE.Group(), R = new THREE.Group();
  L.position.z = R.position.z = back;
  L.add(cut(rectShape(w, h, -w, 0), color)); R.add(cut(rectShape(w, h, 0, 0), color));
  f.body.add(L, R);
  return { ...f, set(e) { f.set(e); const a = open * clamp01(e); L.rotation.y = -a; R.rotation.y = a; } };
}

/** Parallel-fold box: the front stands, the roof and both sides swing out from behind it. */
function box(parent, { x = 0, z = 0, dir = 1, layer = 0, w = 0.6, h = 1.2, d = 0.4, color, side, roof } = {}) {
  const f = flap(parent, { x, z, dir, layer });
  const t = CONFIG.paper.thick;
  f.body.add(cut(rectShape(w, h), color));
  const top = new THREE.Group(); top.position.set(0, h, -t); top.add(cut(rectShape(w, d), roof ?? side ?? color));
  const sl = new THREE.Group(); sl.position.set(-w / 2, 0, -t); sl.add(cut(rectShape(d, h, -d, 0), side ?? color));
  const sr = new THREE.Group(); sr.position.set(w / 2, 0, -t); sr.add(cut(rectShape(d, h, 0, 0), side ?? color));
  f.body.add(top, sl, sr);
  return { ...f, w, h, set(e) {
    f.set(e);
    const k = clamp01(e), a = PI - HALF_PI * k;
    top.rotation.x = -a; sl.rotation.y = -a; sr.rotation.y = a;
  } };
}

/** Accordion paper spring standing on the page. set(ext) 0 = flat, 1 = extended; returns the top point. */
function spring(parent, { x = 0, z = 0, segs = 9, len = 0.15, w = 0.22, colors = [COLORS.white, COLORS.sun], maxAngle = 1.1 } = {}) {
  const g = new THREE.Group(); g.position.set(x, lift(0), z); parent.add(g);
  const t = CONFIG.paper.thick * 0.8;
  const parts = [];
  for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, t), paperMats(colors[i % colors.length])[0]);
    m.castShadow = true; m.receiveShadow = true; g.add(m); parts.push(m);
  }
  const top = new THREE.Group(); g.add(top);
  return { group: g, top, set(ext) {
    const th = maxAngle * Math.max(0, ext), hh = len * Math.sin(th), c = len * Math.cos(th);
    for (let i = 0; i < segs; i++) {
      const z0 = (i % 2 ? -c : 0) + c / 2, z1 = ((i + 1) % 2 ? -c : 0) + c / 2;
      const m = parts[i];
      m.position.set(0, (i + 0.5) * hh, (z0 + z1) / 2);
      m.rotation.x = Math.atan2(z1 - z0, hh);
    }
    top.position.set(0, segs * hh, ((segs % 2 ? -c : 0) + c / 2));
  } };
}

/** Paper ornament planet: three discs slotted through each other at 60 degrees. */
function paperPlanet(r, colors, ring) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const d = cut(circleShape(r, 0, 0), colors[i % colors.length]);
    d.rotation.y = (i * PI) / 3; g.add(d);
  }
  if (ring) { const rg = cut(ringShape(r * 1.75, r * 1.28), ring); rg.rotation.x = -HALF_PI + 0.35; rg.rotation.y = 0.25; g.add(rg); }
  return g;
}

/** Thin paper thread hanging down from the origin. */
function thread(len, color = COLORS.white) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 5), paperMats(color)[1]);
  m.position.y = -len / 2; m.castShadow = true;
  return m;
}

/** Cut-paper word lying flat on the page, readable from the reader's side. */
function flatWord(parent, font, text, { x = 0, z = 0, size = 0.3, color = COLORS.tomato, shadow = COLORS.ink, layer = 0 } = {}) {
  const g = new THREE.Group(); g.position.set(x, lift(layer), z); g.rotation.x = -HALF_PI; parent.add(g);
  const shapes = font.generateShapes(text, size);
  const back = cut(shapes, shadow); back.position.set(size * 0.05, -size * 0.05, -CONFIG.paper.thick * 0.9);
  g.add(back, cut(shapes, color));
  return g;
}
