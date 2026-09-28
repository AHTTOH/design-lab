/* ───────── lobby: MUSEUM as a light installation on the far wall, doors that slide open ───────── */
const WORD_FS = `
uniform sampler2D uMap; uniform float uEdge[7]; uniform float uOn[6]; uniform vec3 uGlow; uniform float uGain;
varying vec2 vUv;
void main() {
  float on = 0.;
  for (int i = 0; i < 6; i++) { if (vUv.x >= uEdge[i] && vUv.x < uEdge[i + 1]) on = uOn[i]; }
  vec2 s = texture2D(uMap, vUv).rg;            // r: the tube, g: its halo
  vec3 tube = mix(uGlow, vec3(1.), .55) * s.r * uGain;
  vec3 halo = uGlow * s.g * .55;
  gl_FragColor = vec4((tube + halo) * on, 1.);
}`;
const WORD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/** Draws the word as neon tubes: red channel is the sharp tube, green is a wide blurred halo. Returns letter edges in uv. */
function neonWordTexture(word, font) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 520;
  const g = c.getContext('2d');
  g.font = font;
  const widths = [...word].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, (c.width * 0.9) / total);
  g.setTransform(scale, 0, 0, scale, (c.width - total * scale) / 2, c.height / 2);
  g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';
  const pass = (color, lw, blur) => {
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = color; g.lineWidth = lw; g.shadowColor = color; g.shadowBlur = blur;
    let x = 0;
    [...word].forEach((ch, i) => { g.strokeText(ch, x, 0); x += widths[i]; });
  };
  g.fillStyle = '#000'; g.fillRect(-1e4, -1e4, 2e4, 2e4);
  pass('rgb(0,255,0)', 34, 60);
  pass('rgb(0,160,0)', 20, 22);
  pass('rgb(255,0,0)', 9, 0);
  const x0 = (c.width - total * scale) / 2;
  const edges = [0];
  let acc = 0;
  widths.forEach((w, i) => { acc += w * scale; edges.push(i === widths.length - 1 ? 1 : (x0 + acc) / c.width); });
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return { tex, edges, aspect: c.height / c.width };
}

function initLobby(world) {
  const cfg = CONFIG.lobby, room = roomById('lobby'), g = new THREE.Group();
  world.scene.add(g);

  const { tex, edges, aspect } = neonWordTexture(cfg.word, cfg.font);
  if (edges.length !== 7) throw new Error('lobby word must have six letters for the per-letter switch');
  const on = new Array(6).fill(reduce ? 1 : 0);
  const glow = new THREE.Vector3(...cfg.glow);
  const word = new THREE.Mesh(new THREE.PlaneGeometry(cfg.wordWidth, cfg.wordWidth * aspect), new THREE.ShaderMaterial({
    vertexShader: WORD_VS, fragmentShader: WORD_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: tex }, uEdge: { value: edges }, uOn: { value: on }, uGlow: { value: glow }, uGain: { value: cfg.glowGain } },
  }));
  word.position.set(0, cfg.wordY, cfg.wallZ + 0.05);
  g.add(word);
  // The installation lights its own wall and floor.
  const wash = new THREE.PointLight('#8fa6ff', 0, 22, 2);
  wash.position.set(0, cfg.wordY - 0.6, cfg.wallZ + 2.2);
  g.add(wash);
  const WASH = 26;

  // Grazing lamps either side of the word.
  [-1, 1].forEach((s) => addSpot(g, { pos: [s * 5.6, room.h - 0.2, -11.5], target: [s * 3.6, 4.4, cfg.wallZ], color: '#cfd9ff', intensity: 38, angle: 0.34, penumbra: 0.9, cone: 0.035 }));
  // Ceiling light strips, dim, so the lobby has a ceiling line in the dark.
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fb2ff').multiplyScalar(1.4), toneMapped: false });
  for (let i = 0; i < cfg.strips; i++) {
    const z = -2.5 - i * 2.6;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.04, 0.08), stripMat);
    strip.position.set(0, room.h - 0.03, z);
    g.add(strip);
  }
  // Benches.
  const benchMat = new THREE.MeshStandardMaterial({ color: '#1d2233', roughness: 0.6, metalness: 0.2 });
  [-1, 1].forEach((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 3.2), benchMat);
    b.position.set(s * 4.4, 0.225, -8.5); b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  });

  // Doors: two dark glass panels in the far-wall opening, with a seam of gallery light between them.
  const doorMat = new THREE.MeshStandardMaterial({ color: '#0b1022', roughness: 0.18, metalness: 0.75 });
  const doorZ = room.z[1] + CONFIG.wallT + 0.04;
  const doors = [-1, 1].map((s) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(cfg.doorW, cfg.doorH, 0.06), doorMat);
    d.position.set(s * cfg.doorW / 2, cfg.doorH / 2, doorZ);
    g.add(d);
    return d;
  });
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.03, cfg.doorH), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e2').multiplyScalar(3), toneMapped: false, transparent: true }));
  seam.position.set(0, cfg.doorH / 2, doorZ + 0.04);
  g.add(seam);

  const start = performance.now();
  const rnd = mulberry32(21);
  const order = [0, 1, 2, 3, 4, 5].map((i) => ({ i, at: 0.25 + i * 0.22 + rnd() * 0.1 }));
  return {
    update(u, time) {
      const secs = (performance.now() - start) / 1000;
      let lit = 0;
      for (const { i, at } of order) {
        // Letters switch on one by one after load, stuttering like a starter until they hold.
        const k = reduce ? 1 : clamp01((secs - at) / 0.5);
        const stutter = k > 0 && k < 1 ? (Math.sin(time * 70 + i * 13) > 0.1 ? 1 : 0.15) : k;
        on[i] = stutter; lit += on[i];
      }
      wash.intensity = WASH * (lit / 6);
      const open = reduce ? (u > 0.5 ? 1 : 0) : smooth(seg(u, ...cfg.doorOpen));
      doors.forEach((d, j) => { d.position.x = (j ? 1 : -1) * (cfg.doorW / 2 + open * (cfg.doorW - 0.05)); });
      seam.material.opacity = 1 - open;
      // Groups holding lights are never hidden: a changed light count recompiles every material mid-walk.
    },
  };
}
