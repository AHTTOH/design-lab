/* ───────── stage: renderer, studio table, lights, camera ───────── */
function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // saturated card stock goes muddy under filmic curves
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(CONFIG.backdrop[0]);
  scene.background = bg.clone();
  scene.fog = new THREE.Fog(bg.clone(), 10, 40);

  const cfgT = CONFIG.table;
  // table: backdrop colour times a soft radial falloff, so the book sits in a studio pool of light
  const vc = document.createElement('canvas'); vc.width = vc.height = 512;
  const vg = vc.getContext('2d'), grad = vg.createRadialGradient(256, 256, 512 * cfgT.vignetteInner, 256, 256, 512 * cfgT.vignetteOuter);
  const edge = Math.round(255 * cfgT.edge);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, `rgb(${edge},${edge},${edge})`);
  vg.fillStyle = grad; vg.fillRect(0, 0, 512, 512);
  const vTex = new THREE.CanvasTexture(vc); vTex.colorSpace = THREE.SRGBColorSpace;
  const tableMat = new THREE.MeshStandardMaterial({ color: bg.clone(), map: vTex, roughness: 1, metalness: 0 });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(cfgT.size, cfgT.size), tableMat);
  table.rotation.x = -HALF_PI; table.position.y = -0.002; table.receiveShadow = true;
  scene.add(table);

  const cfgL = CONFIG.light;
  const hemi = new THREE.HemisphereLight(0xffffff, bg.clone(), cfgL.hemi);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, cfgL.key);
  key.position.set(...cfgL.keyPos);
  key.castShadow = true;
  const map = isMobile() ? cfgL.shadowMapMobile : cfgL.shadowMap;
  key.shadow.mapSize.set(map, map);
  const s = cfgL.shadowSpan;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 30 });
  key.shadow.radius = cfgL.radius;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  scene.add(key, key.target);

  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, CONFIG.camera.near, CONFIG.camera.far);

  const fit = () => {
    renderer.setPixelRatio(dprNow());
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  fit();

  /** Blend the backdrop between spreads. */
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  function setBackdrop(t) {
    const i = clamp(Math.floor(t), 0, CONFIG.backdrop.length - 1), j = Math.min(i + 1, CONFIG.backdrop.length - 1);
    const turn = CONFIG.book.turn, k = smooth(seg(t - i, 1 + turn[0], 1 + turn[1]));
    tmp.set(CONFIG.backdrop[i]).lerp(tmp2.set(CONFIG.backdrop[j]), k);
    tableMat.color.copy(tmp);
    hemi.groundColor.copy(tmp);
    scene.background.copy(tmp).multiplyScalar(cfgT.skyScale);
    scene.fog.color.copy(scene.background);
  }
  /** Fog follows the camera distance, so a far portrait camera does not wash the book out. */
  function setFog(d) { scene.fog.near = d * cfgT.fogNear; scene.fog.far = d * cfgT.fogFar; }
  return { renderer, scene, camera, setBackdrop, setFog };
}

/* ───────── camera: keyed shots along the global timeline, pointer tilt on top ───────── */
function createCameraRig(camera) {
  const shots = CONFIG.shots, target = new THREE.Vector3(), pos = new THREE.Vector3();
  const pose = { p: [0, 0, 0], az: 0, el: 0, d: 0 };
  function sample(t) {
    let i = 0;
    while (i < shots.length - 2 && t > shots[i + 1].t) i++;
    const a = shots[i], b = shots[i + 1], k = smooth(seg(t, a.t, b.t));
    for (let n = 0; n < 3; n++) pose.p[n] = lerp(a.p[n], b.p[n], k);
    pose.az = lerp(a.az, b.az, k); pose.el = lerp(a.el, b.el, k);
    pose.d = Math.exp(lerp(Math.log(a.d), Math.log(b.d), k));
    return pose;
  }
  return function place(t, time) {
    const s = sample(t), cfg = CONFIG.tilt;
    // portrait screens back off so the open spread still fits across
    const fitK = 1 / Math.min(1, camera.aspect / CONFIG.camera.portraitFit);
    const drift = reduce ? 0 : Math.sin(time * 0.13) * 2.5;
    const az = (s.az + drift + tilt.x * cfg.yaw) * DEG, el = clamp(s.el - tilt.y * cfg.pitch, 8, 80) * DEG;
    const d = s.d * fitK;
    target.set(...s.p);
    pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target);
    camera.position.copy(pos);
    camera.lookAt(target);
    return d;
  };
}

/* ───────── the book: five hinged leaves around the spine (x = 0), pages lie in the XZ plane ───────── */
function loadImage(name) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(CONFIG.images[name], (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined,
    (e) => reject(new Error(`image ${name} failed to load: ${e?.message ?? e}`))));
}

function createBook(scene, art) {
  const cfg = CONFIG.book, N = cfg.leaves, g = cfg.leafGap;
  const thick = (k) => (k === 0 || k === N - 1 ? cfg.boardT : cfg.pageT);
  // stack heights: every leaf keeps a clearance g above the one below, so folded pieces fit between pages
  const below = (from, to) => { let y = 0; for (let j = from; j < to; j++) y += thick(j) + g; return y; };
  const root = new THREE.Group(); scene.add(root);
  const leaves = [];
  const isBoard = (k) => k === 0 || k === N - 1;

  /** Material for a printed board face: the art cropped to the board's aspect, fibre relief on top. */
  function artMat(tex, w, d, flipX) {
    const t = tex.clone(); t.needsUpdate = true;
    const aspect = (w / d) / (tex.image.width / tex.image.height);
    t.wrapS = THREE.RepeatWrapping;
    // the verso of the back board is seen after a half turn, so its art is turned 180 degrees
    t.repeat.set(aspect * (flipX ? -1 : 1), flipX ? -1 : 1);
    t.offset.set(flipX ? 0.5 + aspect / 2 : 0.5 - aspect / 2, flipX ? 1 : 0);
    t.wrapT = THREE.RepeatWrapping;
    const k = CONFIG.paper.grainRepeat, base = paperMats(COLORS.white, w * k, d * k)[0];
    return new THREE.MeshStandardMaterial({ map: t, normalMap: base.normalMap, normalScale: base.normalScale, roughnessMap: base.roughnessMap, roughness: 1, metalness: 0 });
  }

  for (let k = 0; k < N; k++) {
    const board = isBoard(k);
    const w = cfg.pageW + (board ? cfg.boardPad : 0), d = cfg.pageD + (board ? cfg.boardPad * 2 : 0), th = board ? cfg.boardT : cfg.pageT;
    const kk = CONFIG.paper.grainRepeat;
    const edgeColor = board ? (k === 0 ? cfg.board : cfg.backBoard) : cfg.recto[k];
    const edgeMat = paperMats(edgeColor, w * kk, d * kk)[1];
    const faceMat = (c, flip) => (c === 'cover' ? artMat(art.cover, w, d, false) : c === 'back' ? artMat(art.back, w, d, flip) : paperMats(c, w * kk, d * kk)[0]);
    // BoxGeometry groups: +x, -x, +y (recto), -y (verso), +z, -z
    const mats = [edgeMat, edgeMat, faceMat(cfg.recto[k]), faceMat(cfg.verso[k], true), edgeMat, edgeMat];
    const pivot = new THREE.Group(); root.add(pivot);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), mats);
    mesh.position.x = w / 2; mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh);
    // recto anchor: page surface frame while the leaf lies on the right stack
    const recto = new THREE.Group(); recto.position.y = th / 2; pivot.add(recto);
    // verso anchor: flipped so that once the leaf has turned it matches the world frame again
    const verso = new THREE.Group(); verso.position.y = -th / 2; verso.rotation.z = PI; pivot.add(verso);
    const yRight = below(k + 1, N) + th / 2, yLeft = below(0, k) + th / 2;
    leaves.push({ pivot, mesh, recto, verso, yRight, yLeft, angle: 0 });
  }

  // spine: stands only while the book is closed
  const spineH = below(0, N) - g;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(cfg.boardT, 1, cfg.pageD + cfg.boardPad * 2), paperMats(cfg.board, 1, 1)[0]);
  spine.castShadow = true; spine.receiveShadow = true;
  root.add(spine);

  const turnAngle = (k, t) => PI * smooth(seg(t, k + 1 + cfg.turn[0], k + 1 + cfg.turn[1]));

  function update(t) {
    leaves.forEach((L, k) => {
      L.angle = turnAngle(k, t);
      L.pivot.rotation.z = L.angle;
      L.pivot.position.y = lerp(L.yRight, L.yLeft, L.angle / PI);
    });
    const closedFront = 1 - leaves[0].angle / PI, closedBack = leaves[N - 1].angle / PI;
    const closed = Math.max(closedFront, closedBack);
    spine.visible = closed > 0.02;
    spine.scale.y = spineH * closed;
    spine.position.set(-cfg.boardT / 2, (spineH * closed) / 2, 0);
    spine.material = paperMats(closedBack > closedFront ? cfg.backBoard : cfg.board, 1, 1)[0];
  }
  /** Openness of spread s (1..N-1): its left leaf has turned and its right leaf has not. */
  const openness = (s) => Math.min(leaves[s - 1].angle / PI, 1 - leaves[s].angle / PI);
  /** Left and right page frames of spread s. */
  const anchors = (s) => ({ left: leaves[s - 1].verso, right: leaves[s].recto });
  return { leaves, update, openness, anchors };
}
