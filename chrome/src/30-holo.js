/* ───────── 03 holo cards: rounded cards with a view-dependent rainbow foil, sparkles and a moving glare ───────── */
const CARD_VS = `
varying vec2 vUv; varying vec3 vN, vW;
void main() {
  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CARD_FS = `
uniform sampler2D uArt, uFoil, uSky;
uniform float uTime, uCorner, uBorder, uHolo;
uniform vec2 uTilt, uSize;
varying vec2 vUv; varying vec3 vN, vW;
${EQUI}
${FILM}
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = (vUv - .5) * uSize;
  float d = sdBox(p, uSize * .5, uCorner), aa = fwidth(d);
  float alpha = 1. - smoothstep(-aa, aa, d);
  if (alpha <= 0.) discard;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.);
  vec3 v = normalize(cameraPosition - vW);
  float c = clamp(dot(n, v), 0., 1.);
  vec3 sky = texture2D(uSky, equi(reflect(-v, n))).rgb;
  // The foil shifts with the card's angle to the eye plus the pointer or gyro tilt.
  vec2 shift = uTilt + n.xy * .7;
  vec3 foil = texture2D(uFoil, vUv * vec2(.7, .9) + shift * .22 + vec2(uTime * .01, 0.)).rgb;
  vec3 rain = film(vUv.x * .9 + vUv.y * .7 + shift.x * 1.3 - shift.y * .9 + uTime * .04);
  float inner = sdBox(p, uSize * .5 - uBorder, uCorner * .6);
  vec3 frame = sky * (.75 + .45 * rain) + pow(1. - c, 3.) * .4;
  vec3 col;
  if (gl_FrontFacing) {
    vec2 win = uSize - 2. * uBorder;
    vec2 wuv = p / win + .5;
    vec3 art = texture2D(uArt, vec2((wuv.x - .5) * win.x / win.y + .5, wuv.y)).rgb;
    float lum = dot(art, vec3(.299, .587, .114));
    col = art + foil * rain * (.16 + .6 * smoothstep(.5, 1., lum)) * uHolo;
    float glare = exp(-pow((vUv.x * .8 + vUv.y * .5 - .65 - shift.x * .9 + shift.y * .6) * 5., 2.));
    col += glare * .32 * (rain * .5 + .5);
    // Round four-point glints on a grid; each twinkles at its own tilt phase.
    vec2 gp = vUv * vec2(26., 36.), cell = floor(gp), fc = fract(gp) - .5;
    float s = h2(cell), sz = .05 + .12 * h2(cell + 7.);
    float glint = smoothstep(sz, 0., length(fc)) + smoothstep(.02, 0., abs(fc.x) * abs(fc.y) * 40.) * smoothstep(.45, 0., length(fc)) * .6;
    col += glint * pow(max(0., sin(s * 40. + shift.x * 14. + shift.y * 9. + uTime * 1.5)), 24.) * step(.8, s) * 1.3 * uHolo;
    col *= 1. - .22 * smoothstep(-.03, 0., inner);
    col = mix(col, frame, step(0., inner));
  } else {
    float ring = .5 + .5 * sin(length(p) * 42. - uTime * .6);
    col = foil * rain * (.8 + .3 * ring) + sky * .2;
    col = mix(col, frame, step(0., inner));
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function initHolo(stage, textures) {
  const cfg = CONFIG.holo, pin = $('#holo-pin'), word = $('#holo-word'), kor = $('#holo-kor');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(cfg.fov, 1, .1, 100);
  const geo = new THREE.PlaneGeometry(cfg.cardW, cfg.cardH);
  const time = { value: 0 };
  const cards = cfg.cards.map((name, i) => {
    const uniforms = { uArt: { value: textures[name] }, uFoil: { value: textures.foil }, uSky: { value: textures.sky }, uTime: time,
      uCorner: { value: cfg.corner }, uBorder: { value: cfg.border }, uHolo: { value: 1 }, uTilt: { value: new THREE.Vector2() },
      uSize: { value: new THREE.Vector2(cfg.cardW, cfg.cardH) } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: CARD_VS, fragmentShader: CARD_FS, uniforms, side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    scene.add(mesh);
    return { mesh, uniforms, i };
  });
  textures.foil.wrapS = textures.foil.wrapT = THREE.MirroredRepeatWrapping;
  textures.foil.needsUpdate = true;
  let prog = 0, fanX = cfg.fanX;

  const resize = (W, H) => {
    camera.aspect = W / H; camera.position.set(0, 0, fitDistance(camera, cfg.camZ, cfg.portraitFit)); camera.updateProjectionMatrix();
    fanX = cfg.fanX * Math.min(1, camera.aspect / 1.1 + .25);
  };
  /** Focus amount for one card: rises, holds, falls inside its window. Returns [amount, local progress]. */
  const focusOf = (p, j) => { const [a, b] = cfg.focus[j], l = seg(p, a, b); return [smooth(seg(l, 0, .22)) * (1 - smooth(seg(l, .78, 1))), l]; };
  const pose = (p, t) => {
    const exit = smooth(segR(p, cfg.exit));
    const anyFocus = cfg.focus.reduce((m, _, j) => Math.max(m, focusOf(p, j)[0]), 0);
    cards.forEach(({ mesh, uniforms, i }) => {
      const o = i - 1, e = smooth(seg(p, cfg.enter[0] + i * .025, cfg.enter[1]));
      const [f, l] = focusOf(p, i);
      const others = anyFocus * (1 - f);
      let x = o * fanX * (1 + others * .55), y = -Math.abs(o) * .12, z = -Math.abs(o) * .3 - others * cfg.backPush;
      let ry = o * .28, rz = -o * cfg.fanRot;
      x = lerp(x, 0, f); y = lerp(y, 0, f); z = lerp(z, 1.1, f); ry = lerp(ry, 0, f); rz = lerp(rz, 0, f);
      ry += Math.PI * 2 * smooth(seg(l, .25, .75)) * (f > 0 ? 1 : 0);
      y = lerp(-2.3 - i * .45, y, e) + exit * (5 + i * .7);
      ry += (1 - e) * Math.PI * 3;
      mesh.position.set(x, y + Math.sin(t * .8 + i) * .04, z);
      mesh.rotation.set(tilt.y * cfg.tiltGain * .7 + (1 - e) * .6, ry + tilt.x * cfg.tiltGain, rz + exit * o * .5);
      mesh.scale.setScalar(lerp(1, cfg.focusScale * .82, f));
      uniforms.uTilt.value.set(tilt.x, tilt.y);
    });
  };
  const draw = (t) => {
    time.value = reduce ? 0 : t;
    pose(reduce ? cfg.reduceAt : prog, reduce ? 0 : t);
    stage.renderer.render(scene, camera);
  };
  const mode = stage.add({ pin, draw, resize });
  track('#s-holo', (p) => {
    prog = p;
    showBy(word, p, cfg.word, -5, 0);
    showBy(kor, p, cfg.kor, 5, 0);
    stage.markDirty();
  }, (on) => { mode.on = on; stage.markDirty(); });
}
