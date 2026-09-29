/* SEASONS foliage: canvas-drawn leaf and blossom cards, instanced, animated entirely in the vertex shader. */

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  /* canvas pixels are premultiplied; keep them so, mipmaps then average without dark fringes, shader divides */
  t.premultiplyAlpha = true;
  return t;
}

/** Leaf: stem at the bottom, pointed tip at the top, light body with darker midrib and veins (tinted per instance). */
const leafTex = canvasTexture(128, 128, (x) => {
  x.translate(64, 0);
  const outline = () => {
    x.beginPath();
    x.moveTo(0, 114);
    x.bezierCurveTo(-50, 96, -46, 34, 0, 5);
    x.bezierCurveTo(46, 34, 50, 96, 0, 114);
    x.closePath();
  };
  const g = x.createLinearGradient(-40, 0, 40, 0);
  g.addColorStop(0, '#dcdcdc'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#cfcfcf');
  outline(); x.fillStyle = g; x.fill();
  x.save(); outline(); x.clip();
  x.strokeStyle = 'rgba(120,120,120,.55)'; x.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const y = 100 - i * 13;
    x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(-16, y - 10, -38, y - 22); x.stroke();
    x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(16, y - 10, 38, y - 22); x.stroke();
  }
  x.restore();
  x.strokeStyle = 'rgba(95,95,95,.8)'; x.lineWidth = 2.4;
  x.beginPath(); x.moveTo(0, 127); x.lineTo(0, 12); x.stroke();
});

/** Atlas: [bud | five-petal blossom | single petal], drawn in colour. */
const blossomTex = canvasTexture(384, 128, (x) => {
  const B = CONFIG.blossom;
  /* bud: plump pink oval in green sepals, stem at the bottom */
  x.save(); x.translate(64, 0);
  x.fillStyle = '#6f8f3a';
  x.beginPath(); x.moveTo(0, 126); x.lineTo(-3, 88); x.lineTo(3, 88); x.fill();
  x.beginPath(); x.ellipse(0, 84, 15, 14, 0, 0, Math.PI * 2); x.fill();
  const bg = x.createRadialGradient(-6, 52, 2, 0, 60, 30);
  bg.addColorStop(0, B.blush); bg.addColorStop(1, B.bud);
  x.fillStyle = bg; x.beginPath(); x.ellipse(0, 60, 17, 28, 0, 0, Math.PI * 2); x.fill();
  x.restore();

  /* petal path with the cherry notch at the tip; origin at the flower centre, pointing up */
  const petal = (s) => {
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(-30 * s, -14 * s, -34 * s, -44 * s, -9 * s, -56 * s);
    x.lineTo(0, -49 * s);
    x.lineTo(9 * s, -56 * s);
    x.bezierCurveTo(34 * s, -44 * s, 30 * s, -14 * s, 0, 0);
    x.closePath();
  };
  const petalFill = (s) => {
    const g = x.createRadialGradient(0, 0, 2, 0, -20 * s, 58 * s);
    g.addColorStop(0, B.blush); g.addColorStop(0.35, B.petal); g.addColorStop(1, '#ffffff');
    return g;
  };
  x.save(); x.translate(192, 64);
  for (let i = 0; i < 5; i++) {
    x.save(); x.rotate((i / 5) * Math.PI * 2 + 0.2);
    petal(1.02); x.fillStyle = petalFill(1.02); x.fill();
    x.strokeStyle = 'rgba(230,150,175,.35)'; x.lineWidth = 1; x.stroke();
    x.restore();
  }
  x.fillStyle = B.heart; x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#e07aa0'; x.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, l = 15 + (i % 3) * 3;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * l, Math.sin(a) * l); x.stroke();
    x.fillStyle = '#f2c14e'; x.beginPath(); x.arc(Math.cos(a) * l, Math.sin(a) * l, 1.9, 0, Math.PI * 2); x.fill();
  }
  x.restore();

  x.save(); x.translate(320, 118);
  petal(1.9); x.fillStyle = petalFill(1.9); x.fill();
  x.restore();
});

/** Shared vertex header for instanced cards: attributes, shadow coord, fog. */
const CARD_HEAD = /* glsl */ `
  ${GLSL_COMMON}
  uniform mat4 uShadowMatrix;
  uniform vec3 uCrownC, uCrownR, uR0, uR1, uR2, uR3, uR4, uYoung, uDead;
  uniform vec2 uSize;
  uniform float uBudSize, uPSize;
  attribute vec3 aPos;
  attribute vec3 aDir;
  attribute vec4 aRnd;
  attribute float aFlex;
  varying vec2 vUv;
  varying vec3 vCol;
  varying vec3 vN;
  varying float vAO;
  varying vec3 vWP;
  varying vec4 vSC;
  #include <fog_pars_vertex>
  /* card basis around the facing direction n, spun by ang */
  void cardBasis(vec3 n, float ang, out vec3 T, out vec3 B) {
    vec3 up = abs(n.y) > .95 ? vec3(1., 0., 0.) : vec3(0., 1., 0.);
    vec3 t = normalize(cross(up, n)), b = cross(n, t);
    T = t * cos(ang) + b * sin(ang);
    B = b * cos(ang) - t * sin(ang);
  }
`;
const CARD_TAIL = /* glsl */ `
  vWP = pos;
  vSC = uShadowMatrix * vec4(pos, 1.);
  vec4 mvPosition = viewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
`;

const CARD_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  #include <packing>
  ${GLSL_SHADOW}
  ${GLSL_FOLIAGE_LIGHT}
  #include <fog_pars_fragment>
  uniform sampler2D uTex;
  uniform float uTrans;
  uniform float uSelf;
  varying vec2 vUv;
  varying vec3 vCol;
  varying vec3 vN;
  varying float vAO;
  varying vec3 vWP;
  varying vec4 vSC;
  void main() {
    vec4 tx = texture2D(uTex, vUv);
    if (tx.a < .42) discard;
    tx.rgb /= max(tx.a, 1e-3);
    vec3 N = normalize(vN);
    if (dot(N, cameraPosition - vWP) < 0.) N = -N;
    float sh = shadowAt(vSC, .0022);
    vec3 c = foliageLight(vCol * tx.rgb, N, vAO, sh, uTrans, vWP);
    c += vCol * tx.rgb * (uHemiSky + uSunCol * .25) * uSelf * .12;
    gl_FragColor = vec4(c, smoothstep(.42, .7, tx.a));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
const CARD_DEPTH_FRAG = /* glsl */ `
  #include <packing>
  uniform sampler2D uTex;
  varying vec2 vUv;
  void main() {
    if (texture2D(uTex, vUv).a < .42) discard;
    gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
  }
`;

/** Builds an instanced card mesh from per-instance arrays and a vertex body. */
function cardMesh({ attrs, count, body, tex, extraUniforms = {}, trans, self, center = false }) {
  const plane = new THREE.PlaneGeometry(1, 1);
  if (!center) plane.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = plane.index;
  g.setAttribute('position', plane.getAttribute('position'));
  g.setAttribute('uv', plane.getAttribute('uv'));
  for (const [name, [arr, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
  g.instanceCount = count;
  const uniforms = { ...U, ...fogUniforms(), uTex: { value: tex }, uTrans: { value: trans }, uSelf: { value: self }, ...extraUniforms };
  const vertexShader = `${CARD_HEAD}\nvoid main() {\n${body}\n${CARD_TAIL}\n}`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader: CARD_FRAG, side: THREE.DoubleSide, fog: true, alphaToCoverage: true });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader: CARD_DEPTH_FRAG, side: THREE.DoubleSide });
  return mesh;
}

/** Scatters per-instance data around tip nodes. */
function scatterOnTips(count, maxDepth, spread, seed) {
  const rnd = mulberry32(seed), tips = tipNodes(maxDepth);
  const pos = new Float32Array(count * 3), dir = new Float32Array(count * 3), rn = new Float32Array(count * 4), flex = new Float32Array(count);
  const C = CONFIG.tree.crown, cc = SK.cc, v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    /* anchor on the twig itself, somewhere between a tip node and its parent */
    const k = tips[Math.floor(rnd() * tips.length)], pk = SK.parent[k] >= 0 ? SK.parent[k] : k, u = rnd();
    const p = SK.pos[k].clone().lerp(SK.pos[pk], u);
    const o = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(spread * 2);
    pos.set([p.x + o.x, p.y + o.y, p.z + o.z], i * 3);
    v.set((p.x - cc.x) / C.rx, (p.y - cc.y) / C.ry, (p.z - cc.z) / C.rz).normalize()
      .add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5 + 0.35, rnd() - 0.5).multiplyScalar(1.6)).normalize();
    dir.set([v.x, v.y, v.z], i * 3);
    rn.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    flex[i] = lerp(SK.flex[k], SK.flex[pk], u);
  }
  return { pos, dir, rn, flex };
}

const crownUniforms = {
  uCrownC: { value: SK.cc.clone() },
  uCrownR: { value: new THREE.Vector3(CONFIG.tree.crown.rx, CONFIG.tree.crown.ry, CONFIG.tree.crown.rz) },
};

/* ───────── leaves: grow, turn, fall, lie on the ground, vanish under snow ───────── */
const leaves = (() => {
  const L = CONFIG.leaves, count = pick(L.count, L.countMobile);
  const d = scatterOnTips(count, L.tipDepth, L.spread, CONFIG.seed + 11);
  const ramp = CONFIG.leafRamp.map((c) => ({ value: new THREE.Color(c) }));
  return cardMesh({
    count, tex: leafTex, trans: 0.85, self: 0.15,
    attrs: { aPos: [d.pos, 3], aDir: [d.dir, 3], aRnd: [d.rn, 4], aFlex: [d.flex, 1] },
    extraUniforms: {
      ...crownUniforms, uR0: ramp[0], uR1: ramp[1], uR2: ramp[2], uR3: ramp[3], uR4: ramp[4],
      uYoung: { value: new THREE.Color(CONFIG.leafYoung) }, uDead: { value: new THREE.Color(CONFIG.leafDead) },
      uSize: { value: new THREE.Vector2(...L.size) },
    },
    body: /* glsl */ `
      float g = smoothstep(aRnd.x * .45, aRnd.x * .45 + .55, uGrow);
      float f = clamp((uFall - aRnd.w * .86) / .14, 0., 1.);
      float landed = step(.999, f);
      vec3 n = normalize(aDir), T, B;
      float ang = aRnd.z * 6.2831;
      cardBasis(n, ang, T, B);
      float flut = sin(uTime * (2.5 + aRnd.y * 4.) + aRnd.z * 40.) * (.14 + .45 * uGust + .3 * length(uWind));
      B = normalize(B + n * flut);
      vec3 N = normalize(cross(T, B));
      vec3 pos = aPos + swayOffset(aPos, aFlex);
      if (f > 0.) {
        float da = aRnd.y * 6.2831;
        vec2 landXZ = aPos.xz + vec2(cos(da), sin(da)) * (.3 + 2.4 * aRnd.x) + vec2(1.1, .5) * aRnd.z;
        float landY = hillH(landXZ) + .02 + aRnd.w * .03;
        float e = f * f * (3. - 2. * f), air = sin(3.1416 * f);
        pos.xz = mix(pos.xz, landXZ, e) + vec2(cos(f * 9. + aRnd.z * 6.), sin(f * 9. + aRnd.z * 6.)) * .7 * air + (uWind.xz * 2.2 + normalize(uWind.xz + 1e-4) * uGust * 2.) * air;
        pos.y = mix(pos.y, landY, f);
        float tum = f * 11. * (.5 + aRnd.x), k = smoothstep(.86, 1., f);
        vec3 Ta = normalize(T * cos(tum) + N * sin(tum));
        T = normalize(mix(Ta, vec3(cos(ang), 0., sin(ang)), k));
        B = normalize(mix(B, vec3(-sin(ang), 0., cos(ang)), k));
        N = normalize(cross(T, B));
      }
      float size = mix(uSize.x, uSize.y, aRnd.x) * g * (1. - smoothstep(.25, .6, uSnow) * landed);
      pos += (T * position.x + B * position.y) * size;
      /* each leaf turns quickly at its own moment and stops at its own peak: some yellow, some orange, some red */
      float a = smoothstep(aRnd.y * .68, aRnd.y * .68 + .32, uAutumn) * mix(.5, 1., fract(aRnd.x * 7.31));
      float r4 = a * 4.;
      vec3 turned = r4 < 1. ? mix(uR0, uR1, r4) : (r4 < 2. ? mix(uR1, uR2, r4 - 1.) : (r4 < 3. ? mix(uR2, uR3, r4 - 2.) : mix(uR3, uR4, r4 - 3.)));
      vec3 col = a > 0. ? turned : mix(uYoung, uR0, smoothstep(.5, 1., uGrow));
      col *= .8 + .4 * fract(aRnd.z * 13.7);
      col = mix(col, uDead, landed * (.3 + .4 * uSnow));
      vCol = col;
      vec3 q = (aPos - uCrownC) / uCrownR;
      vAO = mix(.3, 1., smoothstep(.2, 1.05, length(q))) * mix(.72, 1., smoothstep(-.8, .6, q.y));
      vAO = mix(vAO, .85, step(.001, f));
      vN = N;
      vUv = uv;`,
  });
})();

/* ───────── blossoms: buds swell, open, shed ───────── */
const blossoms = (() => {
  const Bc = CONFIG.blossoms, count = pick(Bc.count, Bc.countMobile);
  const d = scatterOnTips(count, Bc.tipDepth, Bc.spread, CONFIG.seed + 21);
  return {
    data: d,
    mesh: cardMesh({
      count, tex: blossomTex, trans: 0.95, self: 1,
      attrs: { aPos: [d.pos, 3], aDir: [d.dir, 3], aRnd: [d.rn, 4], aFlex: [d.flex, 1] },
      extraUniforms: { ...crownUniforms, uSize: { value: new THREE.Vector2(...Bc.size) }, uBudSize: { value: Bc.budSize } },
      body: /* glsl */ `
        float open = smoothstep(aRnd.x * .5, aRnd.x * .5 + .38, uBloom);
        float shed = smoothstep(aRnd.w * .62, aRnd.w * .62 + .32, uShed);
        float bud = smoothstep(aRnd.y * .45, aRnd.y * .45 + .5, uBud);
        float flower = step(.3, open);
        float size = mix(uBudSize * bud * (.7 + .5 * aRnd.z), mix(uSize.x, uSize.y, aRnd.x) * mix(.45, 1., smoothstep(.3, 1., open)), flower) * (1. - shed);
        vec3 n = normalize(aDir), T, B;
        cardBasis(n, aRnd.z * 6.2831, T, B);
        float flut = sin(uTime * (2. + aRnd.y * 3.) + aRnd.z * 30.) * (.08 + .3 * uGust);
        B = normalize(B + n * flut);
        vec3 pos = aPos + swayOffset(aPos, aFlex);
        vec2 c = position.xy - vec2(0., .5 * flower);
        pos += (T * c.x + B * c.y) * size;
        vUv = vec2((uv.x + flower) / 3., uv.y);
        vCol = mix(vec3(1., .96, .98), vec3(1., .76, .86), aRnd.y);
        vec3 q = (aPos - uCrownC) / uCrownR;
        vAO = mix(.45, 1., smoothstep(.2, 1., length(q)));
        vN = normalize(cross(T, B));`,
    }),
  };
})();

/* ───────── petals adrift: spawn at blossoms, fall with the wind, fade on the grass ───────── */
const petals = (() => {
  const count = pick(CONFIG.petals.count, CONFIG.petals.countMobile), rnd = mulberry32(CONFIG.seed + 31);
  const src = blossoms.data, nSrc = src.pos.length / 3;
  const pos = new Float32Array(count * 3), dir = new Float32Array(count * 3), rn = new Float32Array(count * 4), flex = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rnd() * nSrc);
    pos.set(src.pos.subarray(k * 3, k * 3 + 3), i * 3);
    dir.set([rnd() - 0.5, rnd(), rnd() - 0.5], i * 3);
    rn.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  return cardMesh({
    count, tex: blossomTex, trans: 0.95, self: 1, center: true,
    attrs: { aPos: [pos, 3], aDir: [dir, 3], aRnd: [rn, 4], aFlex: [flex, 1] },
    extraUniforms: { uPSize: { value: CONFIG.petals.size } },
    body: /* glsl */ `
      float on = step(aRnd.z, uPetal);
      float life = fract(uTime * (.045 + .05 * aRnd.x) + aRnd.y);
      float fl = min(life, .8);
      vec3 pos = aPos;
      float ground = hillH(pos.xz) + .03;
      vec2 wind = vec2(.9, .35) + uWind.xz * 1.6 + normalize(uWind.xz + 1e-4) * uGust * 2.;
      pos.xz += wind * fl * 5. + vec2(sin(fl * 20. + aRnd.w * 9.), cos(fl * 17. + aRnd.w * 5.)) * .45;
      pos.y = max(ground, aPos.y - fl * 1.25 * (aPos.y - ground));
      float spin = uTime * (2. + aRnd.x * 3.) * step(life, .8) + aRnd.w * 6.28;
      vec3 n = normalize(aDir + vec3(sin(spin), cos(spin * .7), 0.)), T, B;
      cardBasis(n, spin * .5, T, B);
      float size = uPSize * on * smoothstep(1., .9, life) * smoothstep(0., .03, life);
      pos += (T * position.x + B * position.y) * size;
      vUv = vec2((uv.x + 2.) / 3., uv.y);
      vCol = vec3(1.);
      vAO = .9;
      vN = normalize(cross(T, B));`,
  });
})();

scene.add(leaves, blossoms.mesh, petals);
