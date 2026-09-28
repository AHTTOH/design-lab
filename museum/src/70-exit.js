/* ───────── exit: glass doors, a terrace, lamps, hills and the night sky ───────── */
const SKY_VS = `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`;
const SKY_FS = `
uniform vec3 uMoon; uniform float uTime;
varying vec3 vDir;
${HASH}
float star(vec3 d, float scale, float thresh) {
  vec3 c = floor(d * scale); vec3 f = fract(d * scale) - .5;
  float h = hash12(c.xy + c.z * 17.13);
  if (h < thresh) return 0.;
  float tw = .65 + .35 * sin(uTime * (1. + h * 3.) + h * 40.);
  return smoothstep(.16, 0., length(f)) * (h - thresh) / (1. - thresh) * tw;
}
void main() {
  vec3 d = normalize(vDir);
  float y = max(d.y, 0.);
  vec3 col = mix(vec3(.05, .07, .16), vec3(.004, .007, .022), pow(max(y, 1e-4), .45));
  col += vec3(.2, .1, .34) * exp(-y * 9.) * .5;                              // violet dusk band on the horizon
  // A tilted milky band.
  vec3 axis = normalize(vec3(.3, .75, .58));
  float bx = dot(d, axis) * 3.2;
  float band = exp(-bx * bx);                     // not pow(): a negative base is NaN in GLSL and bloom spreads it into black blocks
  float neb = fbm(vec2(atan(d.z, d.x) * 3., d.y * 6.) + 3.1);
  col += vec3(.16, .17, .3) * band * neb * .7;
  float s = star(d, 150., .985) * 1.4 + star(d, 330., .992) * .9 + band * star(d, 520., .97) * .6;
  col += vec3(.85, .9, 1.) * s * smoothstep(-.02, .12, d.y);
  // Moon: a lit disc with a soft halo.
  float m = dot(d, normalize(uMoon));
  col += vec3(.55, .62, .85) * pow(max(m, 1e-4), 900.) * .9 + vec3(.25, .3, .5) * pow(max(m, 1e-4), 60.) * .35;
  col += vec3(1.6, 1.62, 1.7) * smoothstep(.99955, .99972, m);
  gl_FragColor = vec4(col, 1.);
}`;

function initExit(world) {
  const cfg = CONFIG.exit, room = roomById('video'), g = new THREE.Group();
  world.scene.add(g);
  const moon = new THREE.Vector3(...cfg.moonDir).normalize();

  const sky = new THREE.Mesh(new THREE.SphereGeometry(cfg.sky, 48, 24), new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: { uMoon: { value: moon }, uTime: { value: 0 } },
  }));
  sky.renderOrder = -1; sky.frustumCulled = false;
  g.add(sky);
  // Moonlight for the terrace (the only directional light, dim and cold).
  const moonLight = new THREE.DirectionalLight('#9fb4ff', 0.5);
  moonLight.position.copy(moon).multiplyScalar(60).add(new THREE.Vector3(20, 0, -97));
  moonLight.target.position.set(20, 0, -97);
  g.add(moonLight, moonLight.target);

  // Terrace ground, just below the room floors so they never fight.
  const groundTex = concreteTexture();
  groundTex.repeat.set(80, 80);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#4b5160', map: groundTex, roughness: 0.55 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.03, -97); ground.receiveShadow = true;
  g.add(ground);

  // Hills: a jagged ring of near-black silhouettes around the terrace.
  const rnd = mulberry32(99), N = cfg.hills, R = 240, pos = [];
  const heights = Array.from({ length: N + 1 }, (_, i) => 10 + 26 * Math.abs(Math.sin(i * 0.19) * Math.sin(i * 0.071 + 1)) + rnd() * 6);
  heights[N] = heights[0];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p = (a, h) => [20 + Math.cos(a) * R, h, -97 + Math.sin(a) * R];
    pos.push(...p(a0, -2), ...p(a1, -2), ...p(a1, heights[i + 1]), ...p(a0, -2), ...p(a1, heights[i + 1]), ...p(a0, heights[i]));
  }
  const hillGeo = new THREE.BufferGeometry();
  hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Mesh(hillGeo, new THREE.MeshBasicMaterial({ color: '#070a16', side: THREE.DoubleSide })));

  // Path lamps: glowing heads with a light pool painted on the ground.
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const postMat = new THREE.MeshStandardMaterial({ color: '#191b21', roughness: 0.5, metalness: 0.5 });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a8').multiplyScalar(3), toneMapped: false });
  for (let i = 0; i < cfg.lamps; i++) {
    const x = 12 + i * 5.5, z = -97 + (i % 2 ? 3.2 : -3.2);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3, 8), postMat);
    post.position.set(x, 1.5, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), headMat);
    head.position.set(x, 3.05, z);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color('#ffcf94').multiplyScalar(0.28), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.006, z);
    g.add(post, head, pool);
  }

  // Exit doors: two glass panels in the video room's right wall that slide apart.
  const d = room.right, wallX = room.x[1] - CONFIG.wallT - 0.04;
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8fb0d8', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#c8ccd4', roughness: 0.3, metalness: 0.9 });
  const panels = [-1, 1].map((s) => {
    const p = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, d.h, d.w / 2), glassMat);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, d.h, 0.05), frameMat);
    edge.position.z = -s * d.w / 4;
    p.add(glass, edge);
    p.position.set(wallX, d.h / 2, d.z + s * d.w / 4);
    g.add(p);
    return { p, s };
  });

  return {
    update(u, time) {
      sky.material.uniforms.uTime.value = reduce ? 0 : time;
      const open = reduce ? (u > 4.75 ? 1 : 0) : smooth(seg(u, 4.62, 4.86));
      panels.forEach(({ p, s }) => { p.position.z = d.z + s * (d.w / 4 + open * (d.w / 2 - 0.08)); });
    },
  };
}
