/* ───────── bell, pull cord, floor fan, rising MARBLE RUN banner ───────── */
function bellAngle(t) {
  const s = t - CONFIG.time.fly[1];
  return s > 0 ? -0.42 * Math.exp(-s / 0.1) * Math.sin(s / 0.016) : 0;
}
/** Fan angle: spins up over T.fan, then keeps turning with scroll; clock adds an idle spin once it runs. */
function fanAngle(t, clockSec) {
  const T = CONFIG.time, w = T.fan[1] - T.fan[0], x = seg(t, T.fan[0], T.fan[1]);
  const run = w * (x * x * x - (x * x * x * x) / 2) + Math.max(0, t - T.fan[1]);
  return 420 * run + clockSec * 14 * x;
}

function makeBannerTexture() {
  const Bn = CONFIG.layout.banner, w = 2048, h = Math.round(w * (Bn.top - Bn.roller) / (Bn.poles[1] - Bn.poles[0]));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = COLOR.tomato; g.fillRect(0, 0, w, h);
  g.strokeStyle = COLOR.sun; g.lineWidth = 16; g.setLineDash([54, 26]); g.strokeRect(46, 46, w - 92, h - 92);
  const font = (px) => `800 ${px}px Unbounded`;
  if (!document.fonts.check(font(100))) console.error('Unbounded is not loaded, the banner will use a system face');
  const fit = (text, maxW, px) => { g.font = font(px); const m = g.measureText(text).width; return Math.min(px, (px * maxW) / m); };
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const s1 = fit('MARBLE', w * 0.84, 520), s2 = fit('RUN', w * 0.84, s1);
  g.fillStyle = COLOR.ink;
  g.font = font(s1); g.fillText('MARBLE', w / 2 + 10, h * 0.47 + 14);
  g.font = font(s2); g.fillText('RUN', w / 2 + 10, h * 0.87 + 14);
  g.fillStyle = COLOR.white; g.font = font(s1); g.fillText('MARBLE', w / 2, h * 0.47);
  g.fillStyle = COLOR.sun; g.font = font(s2); g.fillText('RUN', w / 2, h * 0.87);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function createFinale(scene, mats, gears) {
  const Bl = CONFIG.layout.bell, Bn = CONFIG.layout.banner, T = CONFIG.time, ballR = CONFIG.marble.ballR;
  const g = new THREE.Group(); scene.add(g);

  // gallows and bell
  const [bx, by, bz] = Bl.pivot;
  for (const dz of [-0.9, 0.9]) {
    rod(V(bx, 0, bz + dz), V(bx, by + 0.25, bz + dz), 0.07, mats.chrome, g, 14);
    solid(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 20), mats.brass, g, bx, 0.04, bz + dz);
  }
  rod(V(bx, by + 0.25, bz - 0.98), V(bx, by + 0.25, bz + 0.98), 0.08, mats.cobalt, g, 14);
  const bell = new THREE.Group(); bell.position.set(bx, by + 0.2, bz); g.add(bell);
  const bp = [[0.001, 0], [0.1, 0], [0.19, -0.06], [0.24, -0.2], [0.27, -0.45], [0.33, -0.7], [0.44, -0.86], [0.5, -0.95], [0.47, -0.95]]
    .map(([x, y]) => new THREE.Vector2(x * Bl.r / 0.5, y * Bl.h / 0.95));
  solid(new THREE.LatheGeometry(bp, 48), new THREE.MeshStandardMaterial({ color: COLOR.brass, metalness: 1, roughness: 0.18, side: THREE.DoubleSide, envMapIntensity: 1.4 }), bell);
  rod(V(0, -0.05, 0), V(0, -0.72, 0), 0.02, mats.chrome, bell, 6);
  solid(new THREE.SphereGeometry(0.1, 16, 12), mats.ink, bell, 0, -0.76, 0);
  solid(new THREE.TorusGeometry(0.08, 0.025, 8, 20), mats.brass, bell, 0, 0.05, 0);
  const hit = V(bx + Bl.r * 0.82 + ballR, by + 0.2 - Bl.h * 0.72, bz);

  // dish that catches the steel ball
  const dp = [[0.001, 0], [0.4, 0.02], [0.5, 0.1], [0.54, 0.14]].map(([x, y]) => new THREE.Vector2(x, y));
  solid(new THREE.LatheGeometry(dp, 32), new THREE.MeshStandardMaterial({ color: COLOR.brass, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }), g, Bl.dish[0], 0.01, Bl.dish[1]);
  const rest = V(Bl.dish[0] + 0.12, 0.03 + ballR, Bl.dish[1]);

  // floor fan pointing up under the banner
  const [fx, fz] = Bn.fan, hubY = 0.62;
  solid(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 32), mats.brass, g, fx, 0.06, fz);
  rod(V(fx, 0.1, fz), V(fx, hubY - 0.08, fz), 0.06, mats.chrome, g, 12);
  const cage = solid(new THREE.TorusGeometry(0.74, 0.03, 8, 48), mats.brass, g, fx, hubY + 0.06, fz);
  cage.rotation.x = PI / 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    rod(V(fx, hubY + 0.25, fz), V(fx + 0.74 * Math.cos(a), hubY + 0.06, fz + 0.74 * Math.sin(a)), 0.012, mats.brass, g, 4);
  }
  const rotor = new THREE.Group(); rotor.position.set(fx, hubY, fz); g.add(rotor);
  solid(new THREE.SphereGeometry(0.11, 16, 12), mats.tomato, rotor);
  const bladeMat = mats.acrylic(COLOR.cobalt, 0.45);
  for (let k = 0; k < 5; k++) {
    const blade = solid(new THREE.SphereGeometry(0.3, 16, 8), bladeMat, rotor);
    blade.scale.set(1, 0.08, 0.45);
    const holder = new THREE.Group(); holder.rotation.y = (k / 5) * TAU; rotor.add(holder);
    holder.add(blade); blade.position.x = 0.36; blade.rotation.x = 0.45;
  }
  const lever = new THREE.Group(); lever.position.set(fx + 0.5, 0.14, fz); g.add(lever);
  solid(new RoundedBoxGeometry(0.06, 0.3, 0.06, 2, 0.02), mats.tomato, lever, 0, 0.15, 0);

  // pull cord: bell rim, a floor eye, the fan switch
  const eye = V(bx - 0.2, 0.12, bz + 0.95);
  solid(new THREE.TorusGeometry(0.06, 0.02, 8, 16), mats.brass, g, eye.x, eye.y, eye.z);
  const cordA = rod(V(bx, 3, bz), eye, 0.012, mats.rope, g, 5), cordB = rod(eye, V(fx + 0.5, 0.42, fz), 0.012, mats.rope, g, 5);
  cordA.castShadow = cordB.castShadow = false;

  // banner: chrome poles, brass roller, a rod that rises with the cloth
  const [x0, x1] = Bn.poles, cxB = (x0 + x1) / 2, W = x1 - x0 - 0.2, Hmax = Bn.top - Bn.roller;
  for (const x of [x0, x1]) {
    rod(V(x, 0, Bn.z), V(x, Bn.top + 0.45, Bn.z), 0.07, mats.chrome, g, 14);
    solid(new THREE.SphereGeometry(0.13, 16, 12), mats.sun, g, x, Bn.top + 0.5, Bn.z);
    solid(new THREE.CylinderGeometry(0.26, 0.3, 0.08, 20), mats.brass, g, x, 0.04, Bn.z);
  }
  const roller = solid(new THREE.CylinderGeometry(0.13, 0.13, W + 0.1, 24), mats.brass, g, cxB, Bn.roller, Bn.z);
  roller.rotation.z = PI / 2;
  const topRod = solid(new THREE.CylinderGeometry(0.05, 0.05, x1 - x0 + 0.1, 12), mats.chrome, g, cxB, Bn.roller, Bn.z);
  topRod.rotation.z = PI / 2;
  const cols = 48, rows = 18, verts = (cols + 1) * (rows + 1);
  const clothGeo = new THREE.BufferGeometry();
  clothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  clothGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
  const ci = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1;
    ci.push(a, b, a + 1, b, b + 1, a + 1);
  }
  clothGeo.setIndex(ci);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: makeBannerTexture(), roughness: 0.86, side: THREE.DoubleSide, envMapIntensity: 0.5 }));
  cloth.castShadow = cloth.receiveShadow = true;
  cloth.position.set(cxB, 0, Bn.z);
  g.add(cloth);

  const rodY = (t) => Bn.roller + 0.06 + (Hmax - 0.06) * clamp(backOut(seg(t, T.banner[0], T.banner[1]), 1.2), 0, 1.03);
  const legs = [
    { t0: 0, t1: gears.release, mode: 'carry', at: gears.onArm },
    hopLeg(gears.onArm(gears.release), hit, 3.2, gears.release, T.fly[1]),
    hopLeg(hit, rest, 0.45, T.bounce[0], T.bounce[1]),
  ];

  const bellPoint = V();
  const update = (t, clockSec) => {
    bell.rotation.z = bellAngle(t);
    bellPoint.set(0, -Bl.h, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), bell.rotation.z).add(bell.position);
    placeRod(cordA, bellPoint, eye);
    lever.rotation.z = 0.9 * win(t, T.fan[0] - 0.02, T.fan[0] + 0.01);
    rotor.rotation.y = fanAngle(t, clockSec);
    const top = rodY(t), h = top - Bn.roller, vis = h / Hmax;
    topRod.position.y = top;
    roller.rotation.y = 0;
    roller.rotation.x = -h / 0.13;
    const full = seg(t, T.fan[0], T.fan[1]);
    const pos = clothGeo.attributes.position, uv = clothGeo.attributes.uv;
    for (let j = 0; j <= rows; j++) {
      const v = j / rows, y = top - v * h, belly = Math.sin(PI * v);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols, x = (u - 0.5) * W;
        const edge = Math.sin(PI * u) * 0.6 + 0.4;
        const z = belly * edge * (-0.28 * full * vis + 0.07 * full * Math.sin(x * 1.1 + y * 1.6 + clockSec * 5.5));
        const k = j * (cols + 1) + i;
        pos.setXYZ(k, x, y, z);
        uv.setXY(k, u, 1 - v * vis);
      }
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
    clothGeo.computeVertexNormals();
    cloth.visible = h > 0.02;
  };
  const focus = (t) => {
    const k = win(t, T.fan[0], T.banner[1]);
    return V(fx, hubY, fz).lerp(V(cxB, (Bn.roller + rodY(t)) / 2, Bn.z), k);
  };
  const needsClock = (t) => t > T.fan[0];
  return { update, legs, focus, needsClock };
}
