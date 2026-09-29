/* ───────── table, start tower, zigzag ramp, marble A ───────── */
function createTable(scene, mats) {
  const T = CONFIG.table, w = T.x[1] - T.x[0], d = T.z[1] - T.z[0];
  const g = new THREE.Group(); scene.add(g);
  mats.woodTex.repeat.set(w / 9, d / 9);
  const top = solid(new RoundedBoxGeometry(w, T.thick, d, 4, 0.18), mats.wood, g, (T.x[0] + T.x[1]) / 2, T.top - T.thick / 2, (T.z[0] + T.z[1]) / 2);
  top.castShadow = false;
  // lacquered legs down to the studio floor
  const legH = 2.4, legGeo = new THREE.CylinderGeometry(0.45, 0.32, legH, 24);
  for (const x of [T.x[0] + 1.6, T.x[1] - 1.6]) for (const z of [T.z[0] + 1.4, T.z[1] - 1.4]) {
    solid(legGeo, mats.tomato, g, x, -T.thick - legH / 2, z);
  }
  // a brass edge band makes the slab read as a crafted board
  const band = solid(new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), mats.brass, g, (T.x[0] + T.x[1]) / 2, -T.thick + 0.06, (T.z[0] + T.z[1]) / 2);
  band.castShadow = false;
  return g;
}

function zigPoints() {
  const Z = CONFIG.layout.zig, r = CONFIG.marble.r;
  const legDrop = (Z.y0 - r - (Z.legs - 1) * Z.turnDrop) / Z.legs;
  const pts = [];
  let y = Z.y0, z = Z.z0;
  pts.push(V(Z.xa - 0.9, y + 0.05, z));
  for (let k = 0; k < Z.legs; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const xs = dir > 0 ? Z.xa : Z.xb, xe = dir > 0 ? Z.xb : Z.xa;
    const last = k === Z.legs - 1;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      // the last leg flattens onto the table so the marble lands softly
      const yy = last ? y - legDrop * (1 - (1 - u) * (1 - u)) : y - legDrop * u;
      if (i || k === 0) pts.push(V(lerp(xs, xe, u), yy, z));
    }
    y -= legDrop;
    if (last) break;
    const R = Z.zStep / 2, cx = xe, cz = z + R;
    for (let i = 1; i < 8; i++) {
      const a = -PI / 2 + (i / 8) * PI;
      pts.push(V(cx + dir * (Math.cos(a) * R + 0.35), y - Z.turnDrop * (i / 8), cz + Math.sin(a) * R));
    }
    y -= Z.turnDrop; z += Z.zStep;
  }
  return pts;
}

function createStart(scene, mats) {
  const Z = CONFIG.layout.zig, T = CONFIG.time, r = CONFIG.marble.r;
  const g = new THREE.Group(); scene.add(g);
  const pts = zigPoints();
  const ramp = pathCurve(pts);
  const rampEnd = pts[pts.length - 1];
  g.add(buildRails(ramp, mats, { gauge: Z.gauge, drop: Z.drop, postMat: mats.sun, postEvery: 1.3 }));

  // start tower: lacquered posts under a small platform, with a brass gate arm
  const [tx, tz] = CONFIG.layout.tower, platY = Z.y0 - r - 0.16;
  solid(new RoundedBoxGeometry(1.5, 0.2, 1.2, 3, 0.06), mats.cobalt, g, tx, platY, tz);
  for (const dx of [-0.6, 0.6]) for (const dz of [-0.45, 0.45]) rod(V(tx + dx, platY, tz + dz), V(tx + dx, 0, tz + dz), 0.07, mats.tomato, g, 12);
  for (const y of [1.6, 3.4]) solid(new THREE.BoxGeometry(1.3, 0.07, 0.07), mats.brass, g, tx, y, tz - 0.45);
  // gate: a boom across the track hinged at the side, it lifts like a barrier
  const gatePivot = new THREE.Group(); gatePivot.position.set(pts[1].x - 0.05, Z.y0 + 0.02, tz + 0.42); g.add(gatePivot);
  rod(V(pts[1].x - 0.05, platY, tz + 0.42), V(pts[1].x - 0.05, Z.y0 + 0.02, tz + 0.42), 0.05, mats.brass, g, 12);
  solid(new THREE.SphereGeometry(0.08, 16, 12), mats.brass, gatePivot);
  solid(new RoundedBoxGeometry(0.09, 0.09, 0.8, 2, 0.035), mats.tomato, gatePivot, 0, 0, -0.4);

  const marble = makeMarble(mats, { glass: '#2f64ff', vane: COLOR.sun });
  scene.add(marble);
  // the first domino stands just beyond the landing; A stops against it
  const firstDomino = V(CONFIG.layout.snake.x[0], r, CONFIG.layout.snake.rows[0]);
  const stopAt = firstDomino.clone().setX(firstDomino.x - CONFIG.layout.domino.t / 2 - r - 0.01);
  const A = createActor(marble, r, [
    along(ramp, T.rampA[0], T.rampA[1], gather(0.45)),
    lineLeg(rampEnd.clone().setY(r), stopAt, T.rollA[0], T.rollA[1], (x) => 1 - (1 - x) * (1 - x)),
  ]);
  const update = (t) => {
    gatePivot.rotation.x = 1.35 * win(t, T.gate[0], T.gate[1]);
    return A.update(t);
  };
  return { update, A };
}
