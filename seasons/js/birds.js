/* SEASONS birds: small songbirds fly in along arcs, perch on outer branches, fly off in autumn. */
const birds = (() => {
  const rnd = mulberry32(CONFIG.seed + 81), count = CONFIG.birds.count;
  const bodyM = new THREE.MeshStandardMaterial({ color: '#46505f', roughness: 0.75 });
  const bellyM = new THREE.MeshStandardMaterial({ color: '#d9895a', roughness: 0.8 });
  const beakM = new THREE.MeshStandardMaterial({ color: '#e8b04a', roughness: 0.6 });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.07, 0, 0, -0.08, 0.3, 0.01, -0.1, 0.22, 0.01, 0.02], 3));
  wingGeo.setIndex([0, 1, 2, 0, 2, 3]);
  wingGeo.computeVertexNormals();
  const wingM = new THREE.MeshStandardMaterial({ color: '#39414e', roughness: 0.8, side: THREE.DoubleSide });

  /* perches: medium outer branches in the upper crown */
  const perches = [];
  for (let i = 0; i < SK.n; i++) {
    const p = SK.pos[i], q = new THREE.Vector3((p.x - SK.cc.x) / CONFIG.tree.crown.rx, (p.y - SK.cc.y) / CONFIG.tree.crown.ry, (p.z - SK.cc.z) / CONFIG.tree.crown.rz);
    if (SK.r[i] > 0.035 && SK.r[i] < 0.09 && q.length() > 0.55 && q.y > -0.4) perches.push(i);
  }

  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bodyM);
    body.scale.set(0.85, 0.85, 1.5);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bellyM);
    belly.scale.set(0.9, 0.8, 1.3); belly.position.set(0, -0.025, 0.02);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bodyM);
    head.position.set(0, 0.06, 0.12);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), beakM);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.055, 0.19);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.13), bodyM);
    tail.position.set(0, 0.01, -0.17); tail.rotation.x = -0.35;
    const wl = new THREE.Mesh(wingGeo, wingM), wr = new THREE.Mesh(wingGeo, wingM);
    wr.scale.x = -1;
    wl.position.set(0.05, 0.03, 0); wr.position.set(-0.05, 0.03, 0);
    g.add(body, belly, head, beak, tail, wl, wr);
    g.scale.setScalar(1.7);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const perch = SK.pos[perches[Math.floor(rnd() * perches.length)]].clone().add(new THREE.Vector3(0, 0.14, 0));
    const a0 = rnd() * Math.PI * 2, a1 = a0 + Math.PI * (0.6 + rnd() * 0.8);
    list.push({
      g, wl, wr, head, perch,
      from: new THREE.Vector3(Math.sin(a0) * 60, 16 + rnd() * 10, Math.cos(a0) * 60),
      to: new THREE.Vector3(Math.sin(a1) * 70, 24 + rnd() * 10, Math.cos(a1) * 70),
      lift: 5 + rnd() * 5, phase: rnd() * 10, lag: i / count,
    });
    g.visible = false;
    scene.add(g);
  }

  const bez = (a, c, b, t, out) => out.copy(a).multiplyScalar((1 - t) ** 2).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t);
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), C = new THREE.Vector3();

  /** arrive and leave are 0..1 for the whole flock; each bird takes its own slice. */
  function update(arrive, leave, time) {
    for (const b of list) {
      const ai = smooth(seg(arrive, b.lag * 0.45, b.lag * 0.45 + 0.55));
      const li = smooth(seg(leave, b.lag * 0.4, b.lag * 0.4 + 0.6));
      b.g.visible = ai > 0 && li < 1;
      if (!b.g.visible) continue;
      let t, A, B;
      if (li > 0) { t = li; A = b.perch; B = b.to; } else { t = ai; A = b.from; B = b.perch; }
      C.copy(A).lerp(B, 0.5).add(new THREE.Vector3(0, b.lift, 0));
      bez(A, C, B, t, P);
      bez(A, C, B, Math.min(1, t + 0.01), Q);
      const perched = li === 0 && ai >= 1;
      b.g.position.copy(P);
      if (!perched) {
        if (Q.distanceToSquared(P) > 1e-8) b.g.lookAt(Q);
        const flap = Math.sin(time * 16 + b.phase) * 0.9;
        b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
        b.wl.scale.x = 1; b.wr.scale.x = -1;
      } else {
        b.g.rotation.set(0, b.phase + Math.sin(time * 0.5 + b.phase) * 0.4, 0);
        b.g.position.y += Math.abs(Math.sin(time * 3 + b.phase)) < 0.08 ? 0.02 : 0;
        b.wl.rotation.z = -0.45; b.wr.rotation.z = 0.45;
        b.wl.scale.x = 0.4; b.wr.scale.x = -0.4;
        b.head.rotation.y = Math.sin(time * 1.7 + b.phase * 3) * 0.6;
      }
    }
  }
  return { update };
})();
