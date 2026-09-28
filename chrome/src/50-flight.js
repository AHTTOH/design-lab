/* ───────── 05 sky flight: camera path through chrome shapes, rings and clouds, with bloom ───────── */
function starShape(points = 5, outer = 1, inner = .48) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : outer;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** Soft cloud puff drawn once into a canvas (same origin, so file:// is fine). */
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), rnd = mulberry32(17);
  for (let i = 0; i < 16; i++) {
    const x = 128 + (rnd() - .5) * 120, y = 140 + (rnd() - .5) * 60, r = 40 + rnd() * 50;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function initFlight(stage, env, textures) {
  const cfg = CONFIG.flight, pin = $('#flight-pin'), word = $('#fly-word'), kor = $('#fly-kor');
  const mobile = isMobile(), rnd = mulberry32(29);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(cfg.fov, 1, .1, 400);
  textures.sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = textures.sky;
  scene.environment = env;
  scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);
  const pathAt = (t, out = new THREE.Vector3()) => out.set(Math.sin(t * cfg.freqX) * cfg.swayX, Math.sin(t * cfg.freqY + 1) * cfg.swayY, -t * cfg.length);

  const iri = { iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 650] };
  const kinds = [
    { geo: new THREE.TorusGeometry(.9, .34, 32, 96), mat: chromeMaterial(env, { roughness: .06, ...iri }) },
    { geo: new THREE.TorusGeometry(1.4, .06, 16, 128), mat: chromeMaterial(env, { roughness: .04 }) },
    { geo: new THREE.ExtrudeGeometry(starShape(), { depth: .28, bevelEnabled: true, bevelThickness: .14, bevelSize: .1, bevelSegments: 6, curveSegments: 4 }).center(),
      mat: chromeMaterial(env, { color: 0xdfe3ff, roughness: .12, ...iri }) },
    { geo: new THREE.SphereGeometry(.8, 48, 32), mat: chromeMaterial(env, { roughness: .03 }) },
    { geo: new THREE.CapsuleGeometry(.38, .9, 12, 24), mat: chromeMaterial(env, { color: 0xffd9f4, roughness: .08, ...iri }) },
  ];
  const per = mobile ? cfg.shapesPerMobile : cfg.shapesPer, dummy = new THREE.Object3D(), tmp = new THREE.Vector3();
  const sets = kinds.map(({ geo, mat }) => {
    const mesh = new THREE.InstancedMesh(geo, mat, per);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const items = Array.from({ length: per }, () => {
      const t = lerp(-.02, 1.08, rnd()), a = rnd() * Math.PI * 2, r = lerpR(cfg.radial, Math.sqrt(rnd()));
      const pos = pathAt(t).add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * .7, (rnd() - .5) * 6));
      return { pos, rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), spin: new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(1.4), scale: .6 + rnd() * 1.1 };
    });
    return { mesh, items };
  });
  // Big rings the camera flies through.
  const ringCount = Math.floor(cfg.length / cfg.ringEvery);
  const gates = new THREE.InstancedMesh(new THREE.TorusGeometry(cfg.ringRadius, .13, 24, 180), chromeMaterial(env, { roughness: .05, ...iri }), ringCount);
  gates.frustumCulled = false;
  for (let i = 0; i < ringCount; i++) {
    const t = (i + .6) * cfg.ringEvery / cfg.length;
    pathAt(t, dummy.position); pathAt(t + .003, tmp);
    dummy.lookAt(tmp); dummy.scale.setScalar(1); dummy.updateMatrix();
    gates.setMatrixAt(i, dummy.matrix);
  }
  scene.add(gates);
  // Clouds, each with its own material so it can fade as the camera passes.
  const puff = cloudTexture();
  const clouds = Array.from({ length: mobile ? cfg.cloudsMobile : cfg.clouds }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: cfg.cloudOpacity }));
    const t = lerp(-.02, 1.05, rnd()), side = rnd() < .5 ? -1 : 1;
    s.position.copy(pathAt(t)).add(new THREE.Vector3(side * lerp(3, 26, rnd()), lerp(-9, 7, rnd()), 0));
    s.scale.setScalar(lerpR(cfg.cloudSize, rnd()));
    scene.add(s);
    return s;
  });

  const composer = new EffectComposer(stage.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? cfg.samplesMobile : cfg.samples }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), cfg.bloom.strength, cfg.bloom.radius, cfg.bloom.threshold));
  composer.addPass(new OutputPass());
  let prog = 0, fov = cfg.fov;
  const resize = (W, H) => { camera.aspect = W / H; camera.updateProjectionMatrix(); composer.setPixelRatio(dprNow()); composer.setSize(W, H); };
  const draw = (time, dt) => {
    const t = reduce ? cfg.reduceAt : segR(prog, cfg.fly), clock = reduce ? 0 : time;
    pathAt(t, camera.position);
    pathAt(t + .02, tmp);
    tmp.x += tilt.x * cfg.tiltYaw * 10; tmp.y -= tilt.y * cfg.tiltPitch * 10;
    camera.lookAt(tmp);
    const target = reduce ? cfg.fov : cfg.fov + Math.min(cfg.fovKick, Math.abs(velocity()) * cfg.fovVelGain);
    fov += (target - fov) * cfg.fovEase;
    camera.fov = fov; camera.updateProjectionMatrix();
    sets.forEach(({ mesh, items }) => {
      items.forEach((it, i) => {
        dummy.position.copy(it.pos);
        dummy.rotation.set(it.rot.x + clock * it.spin.x + t * 8 * it.spin.y, it.rot.y + clock * it.spin.y, it.rot.z + t * 6 * it.spin.z);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
    clouds.forEach((c) => {
      const d = camera.position.z - c.position.z;
      c.material.opacity = cfg.cloudOpacity * smooth(segR(d, cfg.cloudFade));
      c.visible = d > cfg.cloudFade[0];
    });
    composer.render(dt);
  };
  const mode = stage.add({ pin, draw, resize });
  track('#s-flight', (p) => {
    prog = p;
    const k = reduce ? 1 : envelope(p, cfg.word);
    word.style.opacity = k;
    word.style.transform = `translate(-50%, -50%) scale(${reduce ? 1 : lerp(.8, 1.6, seg(p, cfg.word[0], cfg.word[3]))})`;
    showBy(kor, p, cfg.kor, -5, 0);
    stage.markDirty();
  }, (on) => { mode.on = on; stage.markDirty(); });
}
