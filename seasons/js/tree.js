/* SEASONS tree: space colonisation growth, pipe-model radii, parallel-transport tubes with bark. */

/** Grows the branch skeleton. Returns flat node arrays; parents always have a lower index than children. */
function growSkeleton() {
  const C = CONFIG.tree, rnd = mulberry32(CONFIG.seed);
  const y0 = CONFIG.hill.h;
  const cc = new THREE.Vector3(0, y0 + C.crown.y, 0);

  /* attractors: a dome-shaped crown, denser toward its shell so leaves sit on the outside */
  const A = [];
  const nA = pick(C.attractors, C.attractorsMobile);
  while (A.length < nA) {
    const u = rnd() * 2 - 1, v = rnd() * 2 - 1, w = rnd() * 2 - 1, d2 = u * u + v * v + w * w;
    if (d2 > 1) continue;
    if (Math.sqrt(d2) < C.crown.shell && rnd() > 0.2) continue;
    if (v < -0.55 && rnd() > 0.25) continue;
    A.push({ p: new THREE.Vector3(cc.x + u * C.crown.rx, cc.y + v * C.crown.ry, cc.z + w * C.crown.rz), alive: true });
  }

  const pos = [], parent = [], children = [];
  const add = (p, par) => { pos.push(p); parent.push(par); children.push([]); if (par >= 0) children[par].push(pos.length - 1); return pos.length - 1; };

  /* trunk: leaning, gently curving, grows until the crown is within reach */
  let cur = add(new THREE.Vector3(0, y0 - 0.4, 0), -1);
  const lean = new THREE.Vector3(C.trunkLean[0], 1, C.trunkLean[1]).normalize();
  const nearAny = (p) => A.some((a) => a.p.distanceTo(p) < C.influence);
  for (let k = 0; k < 60 && !nearAny(pos[cur]); k++) {
    const d = lean.clone().add(new THREE.Vector3(Math.sin(k * 0.45) * 0.12, 0, Math.cos(k * 0.3) * 0.1)).normalize();
    cur = add(pos[cur].clone().addScaledVector(d, C.step), cur);
  }

  /* spatial hash of nodes, cell size = influence radius */
  const cell = C.influence, grid = new Map();
  const keyOf = (x, y, z) => ((Math.floor(x / cell) + 512) * 1024 + (Math.floor(y / cell) + 512)) * 1024 + (Math.floor(z / cell) + 512);
  const insert = (i) => { const p = pos[i], k = keyOf(p.x, p.y, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); };
  pos.forEach((_, i) => insert(i));
  const nearest = (p) => {
    let best = -1, bd = C.influence;
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(((cx + dx + 512) * 1024 + (cy + dy + 512)) * 1024 + (cz + dz + 512));
      if (!list) continue;
      for (const i of list) { const d = pos[i].distanceTo(p); if (d < bd) { bd = d; best = i; } }
    }
    return [best, bd];
  };

  const up = new THREE.Vector3(0, 1, 0);
  for (let iter = 0; iter < C.maxIter; iter++) {
    const pull = new Map();
    for (const a of A) {
      if (!a.alive) continue;
      const [i, d] = nearest(a.p);
      if (i < 0) continue;
      if (d < C.kill) { a.alive = false; continue; }
      const v = a.p.clone().sub(pos[i]).normalize();
      if (!pull.has(i)) pull.set(i, new THREE.Vector3());
      pull.get(i).add(v);
    }
    if (!pull.size) break;
    let grew = 0;
    for (const [i, sum] of pull) {
      const d = sum.normalize().addScaledVector(up, C.tropism)
        .add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(C.jitter)).normalize();
      const np = pos[i].clone().addScaledVector(d, C.step);
      if (children[i].some((c) => pos[c].distanceTo(np) < C.step * 0.35)) continue;
      insert(add(np, i));
      grew++;
    }
    if (!grew) break;
  }

  /* pipe model radii, trunk flare near the ground */
  const n = pos.length, r = new Float32Array(n), depth = new Int16Array(n), size = new Int32Array(n).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    const ch = children[i];
    if (!ch.length) { r[i] = C.tipR; depth[i] = 0; continue; }
    let s = 0, dmin = 999;
    for (const c of ch) { s += Math.pow(r[c], C.pipeExp); dmin = Math.min(dmin, depth[c]); size[i] += size[c]; }
    r[i] = Math.pow(s, 1 / C.pipeExp);
    depth[i] = dmin + 1;
  }
  for (let i = 0; i < n; i++) {
    const h = (pos[i].y - (y0 - 0.4)) / C.flareH;
    if (h < 1) r[i] *= 1 + (C.flareR - 1) * Math.pow(1 - Math.max(h, 0), 2);
  }

  /* main child = thickest; used for chains and for smoothing */
  const main = children.map((ch) => (ch.length ? ch.reduce((m, c) => (r[c] > r[m] ? c : m), ch[0]) : -1));
  for (let pass = 0; pass < C.smoothPasses; pass++) {
    const next = pos.map((p) => p.clone());
    for (let i = 1; i < n; i++) {
      if (main[i] < 0 || parent[i] < 0) continue;
      next[i].copy(pos[i]).multiplyScalar(0.5).addScaledVector(pos[parent[i]], 0.25).addScaledVector(pos[main[i]], 0.25);
    }
    for (let i = 0; i < n; i++) pos[i].copy(next[i]);
  }

  const rMax = r[0];
  const flex = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const thin = Math.pow(clamp01(1 - r[i] / 0.32), 2.2);
    flex[i] = thin * smooth(seg(pos[i].y, y0 + 2.5, y0 + C.crown.y + C.crown.ry)) + 0.04 * smooth(seg(pos[i].y, y0, y0 + 6));
  }
  return { pos, parent, children, main, r, depth, size, flex, rMax, cc, n };
}

/** Bark canvas: grey-brown with horizontal lenticels (cherry-like) and faint vertical fissures. */
function barkTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d'), rnd = mulberry32(CONFIG.seed + 1);
  x.fillStyle = '#e4ded6'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = `rgba(70,55,45,${0.08 + rnd() * 0.14})`; x.lineWidth = 1 + rnd() * 2.5;
    const px = rnd() * 256; x.beginPath(); x.moveTo(px, 0);
    for (let y = 0; y <= 256; y += 16) x.lineTo(px + Math.sin(y * 0.05 + i) * 4, y);
    x.stroke();
  }
  for (let i = 0; i < 140; i++) {
    x.fillStyle = `rgba(${rnd() < 0.5 ? '60,45,38' : '235,228,220'},${0.35 + rnd() * 0.35})`;
    const w = 8 + rnd() * 22;
    x.fillRect(rnd() * 256, rnd() * 256, w, 1.5 + rnd() * 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One tube per chain (follows the thickest child), rings oriented with parallel transport. */
function barkGeometry(sk) {
  const C = CONFIG.tree, rnd = mulberry32(CONFIG.seed + 2);
  const chains = [], stack = [[0, -1]];
  sk.drawn = new Uint8Array(sk.n);
  while (stack.length) {
    const [start, from] = stack.pop();
    const pts = from >= 0 ? [from] : [];
    let i = start;
    for (;;) {
      pts.push(i);
      /* side shoots of only a node or two read as thorns; leave them out of the wood (foliage still uses them) */
      for (const c of sk.children[i]) if (c !== sk.main[i] && sk.size[c] >= C.minTwig) stack.push([c, i]);
      if (sk.main[i] < 0) break;
      i = sk.main[i];
    }
    if (pts.length >= 2) { chains.push(pts); for (const k of pts) sk.drawn[k] = 1; }
  }

  const P = [], N = [], UV = [], F = [], COL = [], I = [];
  const bark = new THREE.Color(C.bark), dark = new THREE.Color(C.barkDark), moss = new THREE.Color(C.moss), young = new THREE.Color('#7b4a3c');
  const tmp = new THREE.Color();
  for (const ch of chains) {
    const r0 = sk.r[ch[1]];
    const segs = C.rings.find(([lim]) => r0 > lim)[1];
    const radius = ch.map((k, j) => (j === 0 && ch.length > 1 ? sk.r[ch[1]] * 1.08 : sk.r[k]) * (j === ch.length - 1 && !sk.children[k].length ? 0.3 : 1));
    const pts = ch.map((k) => sk.pos[k]);
    const tangents = pts.map((p, j) => pts[Math.min(j + 1, pts.length - 1)].clone().sub(pts[Math.max(j - 1, 0)]).normalize());
    let normal = new THREE.Vector3(1, 0, 0);
    if (Math.abs(tangents[0].x) > 0.9) normal.set(0, 0, 1);
    normal.sub(tangents[0].clone().multiplyScalar(normal.dot(tangents[0]))).normalize();
    const base = P.length / 3;
    let len = 0;
    const twist = rnd() * Math.PI * 2;
    for (let j = 0; j < pts.length; j++) {
      if (j > 0) {
        const axis = new THREE.Vector3().crossVectors(tangents[j - 1], tangents[j]);
        const s = axis.length();
        if (s > 1e-5) normal.applyAxisAngle(axis.normalize(), Math.asin(Math.min(1, s)));
        len += pts[j].distanceTo(pts[j - 1]);
      }
      const T = tangents[j], B = new THREE.Vector3().crossVectors(T, normal).normalize();
      const rr = radius[j], k = ch[j];
      const thin = clamp01(1 - rr / 0.12);
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2 + twist;
        const dir = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const wob = 1 + 0.06 * Math.sin(a * 3 + len * 2.3) * (1 - thin);
        const p = pts[j].clone().addScaledVector(dir, rr * wob);
        P.push(p.x, p.y, p.z); N.push(dir.x, dir.y, dir.z);
        UV.push(s / segs * Math.max(1, Math.round(rr * 9)), len / Math.max(0.25, rr * 4.5));
        F.push(sk.flex[k]);
        tmp.copy(bark).lerp(dark, 0.35 * (0.5 - 0.5 * dir.y)).lerp(young, thin * 0.7);
        if (rr > 0.14) tmp.lerp(moss, clamp01(-dir.z * 0.7 + 0.1) * 0.45 * smooth(seg(p.y - CONFIG.hill.h, 3.2, 0.6)));
        COL.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const ring = segs + 1;
    for (let j = 0; j < pts.length - 1; j++) for (let s = 0; s < segs; s++) {
      const a = base + j * ring + s, b = a + ring;
      I.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  g.setAttribute('aFlex', new THREE.Float32BufferAttribute(F, 1));
  g.setIndex(I);
  return g;
}

const SK = growSkeleton();
const barkMap = barkTexture();
const tree = new THREE.Mesh(
  barkGeometry(SK),
  patchStandard(new THREE.MeshStandardMaterial({ vertexColors: true, map: barkMap, bumpMap: barkMap, bumpScale: 2.2, roughness: 0.92 }), { sway: true, snow: true }),
);
tree.castShadow = true;
tree.receiveShadow = true;
tree.customDepthMaterial = swayDepthMaterial();
tree.frustumCulled = false;
scene.add(tree);

/** Picks skeleton nodes near branch tips, above the trunk, weighted toward thinner wood. */
function tipNodes(maxDepth) {
  const out = [];
  for (let i = 0; i < SK.n; i++) if (SK.drawn[i] && SK.depth[i] <= maxDepth && SK.pos[i].y > CONFIG.hill.h + 3.2) out.push(i);
  return out;
}
