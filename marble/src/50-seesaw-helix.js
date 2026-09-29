/* ───────── seesaw launch, helix rail around a chrome column, chute to the funnel ───────── */
function seesawAngle(t) {
  const S = CONFIG.layout.seesaw, T = CONFIG.time, u = seg(t, T.seesaw[0], T.seesaw[1]);
  const settle = t > T.seesaw[1] ? 0.05 * Math.exp(-(t - T.seesaw[1]) / 0.012) * Math.sin((t - T.seesaw[1]) / 0.004) : 0;
  return -S.tilt + 2 * S.tilt * u * u - settle;
}

function helixChuteCurve() {
  const H = CONFIG.layout.helix, F = CONFIG.layout.funnel, pts = [];
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, a = H.a0 + H.turns * TAU * u;
    pts.push(V(H.c[0] + H.R * Math.cos(a), lerp(H.top, H.bottom, u), H.c[1] + H.R * Math.sin(a)));
  }
  const end = pts[pts.length - 1], aEnd = H.a0 + H.turns * TAU;
  const tanEnd = V(-Math.sin(aEnd), 0, Math.cos(aEnd));
  const entry = funnelEntry(end);
  const entryY = funnelSurfaceY(F.entryR) + CONFIG.marble.r * 1.2;
  const dirIn = entry.tan;
  pts.push(end.clone().addScaledVector(tanEnd, 0.9).setY(H.bottom - 0.06));
  const mid = end.clone().addScaledVector(tanEnd, 0.9).lerp(entry.p.clone().addScaledVector(dirIn, -1.1), 0.5);
  pts.push(mid.setY(lerp(H.bottom, entryY, 0.55)));
  pts.push(entry.p.clone().addScaledVector(dirIn, -1.1).setY(entryY + 0.14));
  pts.push(entry.p.clone().setY(entryY));
  return { curve: pathCurve(pts), helixFrac: 0, entry };
}

function createSeesawHelix(scene, mats) {
  const S = CONFIG.layout.seesaw, H = CONFIG.layout.helix, T = CONFIG.time, r = CONFIG.marble.r;
  const g = new THREE.Group(); scene.add(g);

  // seesaw: brass A-frame stand, lacquered beam, a pad where the tall domino lands, a cup that holds marble B
  const [px, py, pz] = S.pivot;
  for (const dz of [-0.32, 0.32]) {
    rod(V(px - 0.45, 0, pz + dz), V(px, py, pz + dz), 0.05, mats.brass, g, 10);
    rod(V(px + 0.45, 0, pz + dz), V(px, py, pz + dz), 0.05, mats.brass, g, 10);
  }
  rod(V(px, py, pz - 0.4), V(px, py, pz + 0.4), 0.06, mats.chrome, g, 14);
  const beam = new THREE.Group(); beam.position.set(px, py, pz); g.add(beam);
  solid(new RoundedBoxGeometry(S.half * 2 + 0.3, 0.14, 0.5, 2, 0.05), mats.sun, beam);
  solid(new RoundedBoxGeometry(0.5, 0.1, 0.56, 2, 0.04), mats.tomato, beam, -S.half + 0.2, 0.1, 0);
  const cup = solid(new THREE.TorusGeometry(0.14, 0.04, 10, 28), mats.brass, beam, S.half - 0.15, 0.1, 0);
  cup.rotation.x = PI / 2;
  const cupLocal = V(S.half - 0.15, 0.1 + 0.125, 0);
  const onBeam = (t) => cupLocal.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), seesawAngle(t)).add(V(px, py, pz));

  // helix: chrome column, rails, spokes, a brass catch cone at the top
  const { curve, entry } = helixChuteCurve();
  const isHelix = (p) => Math.hypot(p.x - H.c[0], p.z - H.c[1]) < H.R + 0.4;
  g.add(buildRails(curve, mats, { gauge: 0.25, drop: 0.13, postEvery: 1.1, postMat: mats.emerald, skipPosts: isHelix }));
  solid(new THREE.CylinderGeometry(0.22, 0.26, H.top + 0.9, 32), mats.chrome, g, H.c[0], (H.top + 0.9) / 2, H.c[1]);
  solid(new THREE.SphereGeometry(0.34, 24, 16), mats.tomato, g, H.c[0], H.top + 0.95, H.c[1]);
  solid(new THREE.CylinderGeometry(0.7, 0.8, 0.14, 32), mats.brass, g, H.c[0], 0.07, H.c[1]);
  const spokes = Math.round(H.turns * 7);
  for (let i = 0; i <= spokes; i++) {
    const u = i / spokes, a = H.a0 + H.turns * TAU * u, y = lerp(H.top, H.bottom, u) - 0.2;
    rod(V(H.c[0] + 0.2 * Math.cos(a), y, H.c[1] + 0.2 * Math.sin(a)), V(H.c[0] + (H.R) * Math.cos(a), y, H.c[1] + (H.R) * Math.sin(a)), 0.025, mats.brass, g, 6);
  }
  const top = curve.getPointAt(0);
  // catch cup: a brass-rimmed acrylic bowl the flying marble drops into before it joins the rails
  const bowl = solid(new THREE.SphereGeometry(0.42, 32, 12, 0, TAU, PI * 0.55, PI * 0.45), mats.acrylic(COLOR.aqua, 0.5), g, top.x, top.y + 0.3, top.z);
  bowl.castShadow = false;
  const lip = solid(new THREE.TorusGeometry(0.41, 0.035, 8, 40), mats.brass, g, top.x, top.y + 0.3 + 0.42 * Math.cos(PI * 0.55), top.z);
  lip.rotation.x = PI / 2;

  const legs = [
    { t0: 0, t1: T.launch, mode: 'carry', at: onBeam },
    hopLeg(onBeam(T.launch), top.clone(), 1.4, T.flight[0], T.flight[1]),
    along(curve, T.helix[0], T.helix[1], gather(0.25)),
  ];
  const update = (t) => { beam.rotation.z = seesawAngle(t); };
  const focus = () => V(px - 0.3, py + 0.4, pz);
  return { update, legs, focus, entry };
}
