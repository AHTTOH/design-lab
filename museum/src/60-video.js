/* ───────── video room: a projected screen with a projector beam ───────── */
// Over http the screen is a VideoTexture. On file:// a video frame taints the canvas, so the screen keeps the poster
// (inlined by build.mjs) and says so in the console. Reduced motion also keeps the poster.
function initVideoRoom(world, textures) {
  const cfg = CONFIG.videoRoom, room = roomById('video'), g = new THREE.Group();
  world.scene.add(g);
  const poster = textures.poster;
  const aspect = poster.image.width / poster.image.height;
  const W = cfg.screenW, H = W / aspect;
  const screenMat = new THREE.MeshBasicMaterial({ map: poster, color: new THREE.Color(cfg.gain, cfg.gain, cfg.gain) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), screenMat);
  screen.position.set(0, cfg.screenY, cfg.screenZ);
  g.add(screen);
  // A thin black border reads as a projection surface.
  const border = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.16, H + 0.16), new THREE.MeshBasicMaterial({ color: '#000' }));
  border.position.set(0, cfg.screenY, cfg.screenZ - 0.01);
  g.add(border);

  // Projector beam: a four-sided frustum from the back wall to the screen, additive and faint.
  const proj = new THREE.Vector3(0, room.h - 0.5, room.z[0] - 0.6);
  const L = proj.distanceTo(screen.position);
  const beamGeo = new THREE.CylinderGeometry(0.04, 1, L, 4, 1, true);
  beamGeo.rotateY(Math.PI / 4); beamGeo.translate(0, -L / 2, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    vertexShader: CONE_VS, fragmentShader: CONE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#8fc7ff') }, uStrength: { value: 0.07 } },
  }));
  beam.position.copy(proj);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), screen.position.clone().sub(proj).normalize());
  beam.scale.set((W / 2) * Math.SQRT2, 1, (H / 2) * Math.SQRT2);
  beam.renderOrder = 2;
  g.add(beam);
  // Spill from the screen onto the floor and the benches.
  const spill = new THREE.PointLight('#5f8dff', 16, 18, 2);
  spill.position.set(0, 2.2, cfg.screenZ + 2);
  g.add(spill);
  const benchMat = new THREE.MeshStandardMaterial({ color: '#10383e', roughness: 0.7 });
  [-1, 1].forEach((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.42, 0.6), benchMat);
    b.position.set(s * 2.6, 0.21, -99.5); b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  });

  let video = null, playing = false;
  if (reduce) {
    // Poster only.
  } else if (location.protocol === 'file:') {
    console.warn('MUSEUM: file:// cannot upload video frames to WebGL (tainted canvas), the screen shows the poster still.');
  } else {
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none', crossOrigin: 'anonymous' });
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.src = CONFIG.video;
    video.addEventListener('error', () => console.error('MUSEUM: video failed to load', CONFIG.video, video.error));
    const vt = new THREE.VideoTexture(video);
    vt.colorSpace = THREE.SRGBColorSpace;
    video.addEventListener('playing', () => { screenMat.map = vt; screenMat.needsUpdate = true; }, { once: true });
  }
  return {
    update(u) {
      if (!video) return;
      const want = u >= cfg.playU[0] && u <= cfg.playU[1] && !document.hidden;
      if (want === playing) return;
      playing = want;
      if (want) video.play().catch((e) => { playing = false; console.error('MUSEUM: video play() was refused', e); });
      else video.pause();
    },
  };
}
