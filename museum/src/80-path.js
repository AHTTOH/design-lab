/* ───────── the walk: keys in path units u (room index + progress), cubic Hermite in time ───────── */
// A hold becomes two stop keys with zero velocity, so the camera eases in, stands still, then eases out.
// Pass keys get Catmull-Rom tangents so walking between holds never jerks at a doorway.
// label: wall text shown while standing at that hold.
function walkEntries() {
  const e = CONFIG.eye, P = CONFIG.paintings, S = CONFIG.sculptures, L = CONFIG.lights, V = CONFIG.videoRoom;
  const paintView = (p) => ({ pos: [p.side * 0.85, e, p.z], look: [p.side * 4.7, CONFIG.paint.centerY - 0.04, p.z] });
  const paintHolds = [[1.06, 1.17], [1.22, 1.33], [1.38, 1.49], [1.54, 1.65], [1.7, 1.81], [1.86, 1.93]];
  const moon = new THREE.Vector3(...CONFIG.exit.moonDir).normalize();
  const endPos = [19, 1.5, -98];
  const endLook = new THREE.Vector3(...endPos).addScaledVector(moon, 30).add(new THREE.Vector3(0, -6, 0));
  return [
    { hold: [0, 0.12], pos: [0, e, -1.2], look: [0, 4.5, -15.8] },
    { u: 0.27, pos: [0.5, e, -5.2], look: [0, 4.1, -15.8] },
    { hold: [0.38, 0.6], pos: [0, e, -8.6], look: [0, 2.9, -15.8] },
    { u: 0.8, pos: [0, e, -13.4], look: [0, 1.9, -24] },
    { u: 0.98, pos: [0, e, -18.4], look: [-2.2, 1.7, -24] },
    ...P.map((p, i) => ({ hold: paintHolds[i], ...paintView(p), label: p })),
    // Turn to face the doorway before passing it, so the view never fills with the door jamb.
    { u: 1.97, pos: [0.2, e, -49], look: [0, 1.7, -60] },
    { u: 2.03, pos: [-0.3, e, -52.6], look: [-2, 1.6, -58] },
    { hold: [2.1, 2.24], pos: [S[0].x + 2.3, 1.55, S[0].z + 2.7], look: [S[0].x, 1.75, S[0].z], label: S[0] },
    { hold: [2.34, 2.48], pos: [S[1].x - 2.3, 1.55, S[1].z + 2.3], look: [S[1].x, 1.6, S[1].z], label: S[1] },
    // Diagonal view of the knot: straight on, the lit laser room sits in the doorway behind it.
    { hold: [2.58, 2.72], pos: [S[2].x - 2.5, e, S[2].z + 2.4], look: [S[2].x, 1.6, S[2].z], label: S[2] },
    { u: 2.86, pos: [-1.6, e, -67.4], look: [0, 2.4, -80] },
    { u: 3.0, pos: [0, e, -71.2], look: [0, 2.6, -80] },
    { hold: [3.08, 3.2], pos: [0, e, -73.6], look: [0, 3.2, -80], label: L },
    { u: 3.36, pos: [-5, 1.5, -77], look: [0, 3.3, -80] },
    { hold: [3.5, 3.66], pos: [0, 1.4, -80], look: [0.4, 7, -80.7] },
    { u: 3.8, pos: [5.3, e, -84.6], look: [0, 2.8, -80] },
    { u: 4.0, pos: [0, e, -91.4], look: [0, 3, -106] },
    { hold: [4.12, 4.6], pos: [0, 1.55, -95], look: [0, 3.1, -106], label: V },
    { u: 4.76, pos: [1.6, e, -97.1], look: [8, 1.8, -97] },
    { u: 5.0, pos: [6.4, e, -97], look: [14, 1.9, -97] },
    { u: 5.24, pos: [11, e, -97], look: [22, 3, -99] },
    { hold: [5.45, 5.6], pos: [16, e, -97.5], look: [40, 6, -106] },
    { hold: [5.78, 6], pos: endPos, look: endLook.toArray() },
  ];
}

/** View angles from a position toward a look point. Camera rotation order is YXZ: yaw about y, then pitch. */
function viewAngles(pos, look) {
  const d = look.clone().sub(pos);
  return new THREE.Vector3(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)), 0);
}

function createWalk() {
  const keys = [];
  const holds = [];
  for (const en of walkEntries()) {
    const pos = new THREE.Vector3(...en.pos), ang = viewAngles(pos, new THREE.Vector3(...en.look));
    if (en.hold) {
      keys.push({ u: en.hold[0], pos, ang, stop: true }, { u: en.hold[1], pos, ang, stop: true });
      holds.push({ u0: en.hold[0], u1: en.hold[1], pos, ang, label: en.label ?? null });
    } else keys.push({ u: en.u, pos, ang, stop: false });
  }
  keys.forEach((k, i) => { if (i && k.u <= keys[i - 1].u) throw new Error(`walk keys out of order at u=${k.u}`); });
  // The view is interpolated as angles, not as a look point: a look point swept from one wall to the other
  // passes through the camera and lookAt() flips to the ceiling (seen 2026-09-28 between two paintings).
  // Yaw is unwrapped so every turn takes the short way round.
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1].ang.x, a = keys[i].ang.clone();
    while (a.x - prev > Math.PI) a.x -= Math.PI * 2;
    while (a.x - prev < -Math.PI) a.x += Math.PI * 2;
    keys[i].ang = a;
  }
  // Tangents per unit u.
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.stop || i === 0 || i === keys.length - 1) { k.mp = new THREE.Vector3(); k.ma = new THREE.Vector3(); continue; }
    const a = keys[i - 1], b = keys[i + 1], du = b.u - a.u;
    k.mp = b.pos.clone().sub(a.pos).divideScalar(du);
    k.ma = b.ang.clone().sub(a.ang).divideScalar(du);
  }
  const herm = (out, p0, m0, p1, m1, dt, s) => {
    const s2 = s * s, s3 = s2 * s;
    return out.copy(p0).multiplyScalar(2 * s3 - 3 * s2 + 1).addScaledVector(m0, (s3 - 2 * s2 + s) * dt)
      .addScaledVector(p1, -2 * s3 + 3 * s2).addScaledVector(m1, (s3 - s2) * dt);
  };
  const pos = new THREE.Vector3(), ang = new THREE.Vector3();
  const view = () => ({ pos, yaw: ang.x, pitch: ang.y });
  function at(u) {
    const last = keys[keys.length - 1];
    if (u <= keys[0].u) { pos.copy(keys[0].pos); ang.copy(keys[0].ang); return view(); }
    if (u >= last.u) { pos.copy(last.pos); ang.copy(last.ang); return view(); }
    let i = 0;
    while (keys[i + 1].u < u) i++;
    const a = keys[i], b = keys[i + 1], dt = b.u - a.u, s = (u - a.u) / dt;
    herm(pos, a.pos, a.mp, b.pos, b.mp, dt, s);
    herm(ang, a.ang, a.ma, b.ang, b.ma, dt, s);
    return view();
  }
  /** Reduced motion: still views only. The view of the latest hold reached (or the first). */
  function still(u) {
    let h = holds[0];
    for (const x of holds) if (u >= x.u0 - 0.04) h = x;
    pos.copy(h.pos); ang.copy(h.ang);
    return view();
  }
  return { at, still, holds };
}
