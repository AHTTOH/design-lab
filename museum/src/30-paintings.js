/* ───────── painting hall: framed works lit by ceiling spots ───────── */
function initPaintings(world, textures) {
  const cfg = CONFIG.paint, room = roomById('paint'), g = new THREE.Group();
  world.scene.add(g);
  const wallIn = (side) => side * (room.x[1] - CONFIG.wallT);   // inner wall face, x
  const views = [];

  for (const p of CONFIG.paintings) {
    const tex = textures[p.key];
    if (!tex) throw new Error(`painting texture ${p.key} is missing`);
    tex.anisotropy = 8;
    const aspect = tex.image.width / tex.image.height;
    const h = p.h, w = h * aspect;
    const art = new THREE.Group();
    art.position.set(wallIn(p.side) - p.side * (cfg.frameD / 2 + 0.01), cfg.centerY, p.z);
    art.rotation.y = -p.side * Math.PI / 2;                     // left wall faces +x, right wall faces -x
    g.add(art);

    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0 }));
    canvasMesh.position.z = cfg.frameD / 2 - 0.012;
    art.add(canvasMesh);
    const fw = cfg.frameW, fd = cfg.frameD;
    const frameMat = new THREE.MeshStandardMaterial({ color: p.frame, roughness: 0.45, metalness: 0.15 });
    [[w + 2 * fw, fw, 0, h / 2 + fw / 2], [w + 2 * fw, fw, 0, -h / 2 - fw / 2], [fw, h, -w / 2 - fw / 2, 0], [fw, h, w / 2 + fw / 2, 0]].forEach(([bw, bh, x, y]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, fd), frameMat);
      bar.position.set(x, y, 0); bar.castShadow = true;
      art.add(bar);
    });
    // A small printed placard to the viewer's right, as in a real hall.
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: '#f4f6f9', roughness: 0.7 }));
    plaque.position.set(w / 2 + fw + 0.34, 1.42 - cfg.centerY, -fd / 2 + 0.005);
    art.add(plaque);

    const lampX = wallIn(p.side) - p.side * cfg.spotOut;
    addSpot(g, { pos: [lampX, room.h - 0.2, p.z], target: [wallIn(p.side), cfg.centerY - 0.05, p.z], intensity: cfg.spot, angle: cfg.spotAngle, penumbra: cfg.penumbra, cone: cfg.cone });
    views.push({ ...p, w, h });
  }
  // Ceiling tracks the lamps hang from.
  const trackMat = new THREE.MeshStandardMaterial({ color: '#1a1b1f', roughness: 0.4, metalness: 0.6 });
  [-1, 1].forEach((s) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Math.abs(room.z[1] - room.z[0]) - 1), trackMat);
    t.position.set(wallIn(s) - s * cfg.spotOut, room.h - 0.06, (room.z[0] + room.z[1]) / 2);
    g.add(t);
  });
  return { views };
}
