/* ───────── gear train, spool and drum, flag on a pulley mast, tiny catapult with the steel ball ───────── */
function gearGeometry(n, module, depth) {
  const r = (n * module) / 2, ro = r + module, rr = r - 1.25 * module, p = TAU / n;
  const shape = new THREE.Shape();
  for (let k = 0; k < n; k++) {
    const a = k * p;
    const pts = [[rr, a - 0.5 * p], [rr, a - 0.27 * p], [ro, a - 0.13 * p], [ro, a + 0.13 * p], [rr, a + 0.27 * p]];
    pts.forEach(([rad, ang], i) => {
      const x = rad * Math.cos(ang), y = rad * Math.sin(ang);
      if (k === 0 && i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  // lightening holes read as crafted parts and show the gear turning even without teeth in view
  const holes = n >= 12 ? 5 : 0, hr = rr * 0.22, hc = rr * 0.58;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * TAU, h = new THREE.Path();
    h.absarc(hc * Math.cos(a), hc * Math.sin(a), hr, 0, TAU, true);
    shape.holes.push(h);
  }
  const axle = new THREE.Path(); axle.absarc(0, 0, module * 0.9, 0, TAU, true); shape.holes.push(axle);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Gear angles for the whole train from the first gear's angle; each mesh keeps teeth interleaved. */
function trainAngles(theta1) {
  const list = CONFIG.layout.gears.list, out = [theta1];
  for (let j = 1; j < list.length; j++) {
    const a = list[j - 1], b = list[j];
    const alpha = Math.atan2(b.c[1] - a.c[1], b.c[0] - a.c[0]);
    out.push(alpha + PI + (alpha - out[j - 1]) * (a.n / b.n) - PI / b.n);
  }
  return out;
}

function catapultAngle(t) {
  const C = CONFIG.layout.catapult, T = CONFIG.time, u = seg(t, T.fire[0], T.fire[1]);
  const s = t - T.fire[1];
  const wobble = s > 0 ? 0.14 * Math.exp(-s / 0.01) * Math.sin(s / 0.0028) : 0;
  return lerp(C.cocked, C.stop, u * u) - wobble;
}
function catapultRelease() {
  const C = CONFIG.layout.catapult, T = CONFIG.time;
  return T.fire[0] + Math.sqrt((C.releaseAt - C.cocked) / (C.stop - C.cocked)) * (T.fire[1] - T.fire[0]);
}

function createGears(scene, mats) {
  const G = CONFIG.layout.gears, K = CONFIG.layout.bucket, M = CONFIG.layout.mast, C = CONFIG.layout.catapult, T = CONFIG.time;
  const g = new THREE.Group(); scene.add(g);

  // board: navy lacquer panel on two posts
  const bx = [G.list[0].c[0] - 1.4, G.list[3].c[0] + 1.0], by = [0.3, 5.3];
  const board = solid(new RoundedBoxGeometry(bx[1] - bx[0], by[1] - by[0], 0.14, 3, 0.05), mats.lacquer('#0d2a8a'), g, (bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2, G.board);
  for (const x of bx) rod(V(x + 0.2 * Math.sign((bx[0] + bx[1]) / 2 - x), 0, G.board - 0.12), V(x + 0.2 * Math.sign((bx[0] + bx[1]) / 2 - x), by[1] - 0.2, G.board - 0.12), 0.08, mats.tomato, g, 12);
  board.castShadow = true;

  const gearMats = [mats.brass, mats.acrylic(COLOR.tomato, 0.35), mats.brass, mats.acrylic(COLOR.emerald, 0.35)];
  const gears = G.list.map((gd, i) => {
    const mesh = solid(gearGeometry(gd.n, G.module, 0.16), gearMats[i], g, gd.c[0], gd.c[1], G.z);
    solid(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 14), mats.chrome, g, gd.c[0], gd.c[1], G.z + 0.05).rotation.x = PI / 2;
    solid(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20), mats.brass, g, gd.c[0], gd.c[1], G.z + 0.18).rotation.x = PI / 2;
    return mesh;
  });
  // spool on the first gear (rope to the bucket) and drum on the last (rope to the flag)
  const g1 = G.list[0], g4 = G.list[3];
  const spoolLen = Math.abs(K.z - G.z) + 0.15;
  const spool = solid(new THREE.CylinderGeometry(G.spoolR, G.spoolR, spoolLen, 24), mats.sun, g, g1.c[0], g1.c[1], (K.z + G.z) / 2);
  spool.rotation.x = PI / 2;
  const drumZ = M.z;
  const drum = solid(new THREE.CylinderGeometry(G.drumR, G.drumR, 0.3, 32), mats.pink, g, g4.c[0], g4.c[1], drumZ);
  drum.rotation.x = PI / 2;
  solid(new THREE.CylinderGeometry(0.05, 0.05, Math.abs(drumZ - G.z) + 0.1, 10), mats.chrome, g, g4.c[0], g4.c[1], (drumZ + G.z) / 2).rotation.x = PI / 2;

  // mast with a pulley wheel on top, rope from the drum over the wheel down to the flag
  rod(V(M.x, 0, M.z - 0.25), V(M.x, M.h, M.z - 0.25), 0.07, mats.chrome, g, 14);
  solid(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 24), mats.brass, g, M.x, 0.06, M.z - 0.25);
  const pulleyC = V((g4.c[0] + G.drumR + M.x - 0.2) / 2, M.h - 0.35, M.z);
  const pulleyR = (M.x - 0.2 - (g4.c[0] + G.drumR)) / 2;
  const wheel = solid(new THREE.TorusGeometry(pulleyR, 0.05, 10, 32), mats.brass, g, pulleyC.x, pulleyC.y, pulleyC.z);
  rod(pulleyC.clone().setX(pulleyC.x), V(M.x, pulleyC.y, M.z - 0.25), 0.03, mats.chrome, g, 8);
  const ropeUp = rod(V(g4.c[0] + G.drumR, g4.c[1], drumZ), V(g4.c[0] + G.drumR, pulleyC.y, drumZ), 0.018, mats.rope, g, 6);
  const ropeDown = rod(V(M.x - 0.2, pulleyC.y, drumZ), V(M.x - 0.2, 1, drumZ), 0.018, mats.rope, g, 6);
  ropeUp.castShadow = false;

  // flag: a pennant that rides the rope up
  const flag = new THREE.Group(); g.add(flag);
  const pennantGeo = new THREE.BufferGeometry();
  const segs = 10, fl = 1.25, fh = 0.7, pp = [];
  for (let i = 0; i <= segs; i++) { const x = (i / segs) * fl, hh = fh * (1 - i / segs) / 2; pp.push(x, hh, 0, x, -hh, 0); }
  pennantGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  const idx = []; for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  pennantGeo.setIndex(idx); pennantGeo.computeVertexNormals();
  const pennant = solid(pennantGeo, new THREE.MeshPhysicalMaterial({ color: COLOR.tomato, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffd0c0'), side: THREE.DoubleSide }), flag, 0.05, 0, 0);
  solid(new THREE.SphereGeometry(0.07, 14, 10), mats.brass, flag);
  const flagY = (t) => lerp(M.flagLow, pulleyC.y - pulleyR - 0.5, (K.top - bucketRim(t)) / K.drop);

  // catapult: base, uprights, arm with cup, trigger cord from the mast top
  const [cx, cy, cz] = C.pivot;
  solid(new RoundedBoxGeometry(1.8, 0.18, 0.9, 3, 0.05), mats.sun, g, cx + 0.3, 0.09, cz);
  const stopP = V(cx + 0.55 * Math.cos(C.stop + 0.12), cy + 0.55 * Math.sin(C.stop + 0.12), cz);
  for (const dz of [-0.3, 0.3]) {
    solid(new RoundedBoxGeometry(0.16, cy + 0.1, 0.1, 2, 0.03), mats.tomato, g, cx, (cy + 0.1) / 2, cz + dz);
    rod(V(cx, cy, cz + dz), V(stopP.x, stopP.y, cz + dz), 0.04, mats.tomato, g, 8);
  }
  rod(V(cx, cy, cz - 0.38), V(cx, cy, cz + 0.38), 0.05, mats.chrome, g, 12);
  rod(V(stopP.x, stopP.y, cz - 0.36), V(stopP.x, stopP.y, cz + 0.36), 0.06, mats.ink, g, 12);
  const arm = new THREE.Group(); arm.position.set(cx, cy, cz); g.add(arm);
  solid(new RoundedBoxGeometry(C.arm + 0.1, 0.1, 0.12, 2, 0.04), mats.wood, arm, C.arm / 2, 0, 0);
  const cup = solid(new THREE.SphereGeometry(0.2, 20, 10, 0, TAU, PI / 2, PI / 2), new THREE.MeshStandardMaterial({ color: COLOR.brass, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }), arm, C.arm, 0.2, 0);
  cup.castShadow = true;
  const latch = solid(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 10), mats.brass, g, cx + 0.95, 0.3, cz + 0.2);
  const cord = rod(V(M.x, M.h - 0.2, M.z - 0.25), V(cx + 0.95, 0.45, cz + 0.2), 0.012, mats.rope, g, 5);
  cord.castShadow = false;

  // steel ball C: rides the cup, released at the arm angle in CONFIG, flies to the bell (leg added in finale)
  const ballR = CONFIG.marble.ballR;
  const cupLocal = V(C.arm, 0.2 - (0.2 - ballR) + 0.01, 0);
  const onArm = (t) => cupLocal.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), catapultAngle(t)).add(V(cx, cy, cz));
  const release = catapultRelease();

  const update = (t) => {
    const drop = K.top - bucketRim(t);
    const angles = trainAngles(-drop / G.spoolR);
    gears.forEach((m, i) => { m.rotation.z = angles[i]; });
    spool.rotation.y = angles[0];
    drum.rotation.y = angles[3];
    const fy = flagY(t);
    flag.position.set(M.x - 0.2, fy, drumZ);
    placeRod(ropeDown, V(M.x - 0.2, pulleyC.y, drumZ), V(M.x - 0.2, fy + 0.05, drumZ));
    const pos = pennantGeo.attributes.position, flap = 0.05 + 0.1 * win(t, T.bucket[0], T.flagTop);
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * fl, z = Math.sin(x * 3.2 - t * 260) * flap * (x / fl);
      pos.setZ(i * 2, z); pos.setZ(i * 2 + 1, z);
    }
    pos.needsUpdate = true;
    latch.position.y = 0.3 + 0.3 * win(t, T.flagTop + 0.06, T.fire[0]);
    arm.rotation.z = catapultAngle(t);
  };
  const focus = (t) => {
    const k = win(t, T.bucket[0] + 0.1, T.flagTop);
    const gearMid = V((G.list[0].c[0] + G.list[3].c[0]) / 2, 3.2, G.z);
    const bucketP = V(K.x, bucketRim(t), K.z);
    const flagP = V(M.x + 0.4, flagY(t), drumZ);
    return k < 0.5 ? bucketP.lerp(gearMid, smooth(k * 2)) : gearMid.lerp(flagP, smooth(k * 2 - 1));
  };
  const catapultFocus = () => V(cx + 0.4, cy + 0.4, cz);
  return { update, focus, catapultFocus, onArm, release };
}
