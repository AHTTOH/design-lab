/* ───────── zone 3: twilight, jellyfish in marine snow ───────── */
// The blue drains out as the camera sinks. Each jellyfish is a lathe bell that contracts and relaxes (the swim stroke),
// a fresnel shell that glows at grazing angles, faint radial canals inside, and line tentacles whose waves lag the bell.

/** Bell profile from apex to rim, flared at the margin. */
function bellGeometry() {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * Math.PI * 0.5;
    const r = Math.sin(a) * (1 + 0.12 * t * t * t), y = Math.cos(a) * 0.82 - t * t * 0.12;
    pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  // Fold the margin inward a little (the velum).
  pts.push(new THREE.Vector2(0.9, -0.2));
  const geo = new THREE.LatheGeometry(pts, 56);
  return geo;
}

const BELL_VERT = `
  uniform float uTime, uPhase, uPulse; varying vec3 vN, vV, vL;
  float stroke(float t) { float c = fract(t); return smoothstep(0., .18, c) * (1. - smoothstep(.18, .75, c)); }
  void main() {
    vec3 p = position;
    float s = stroke(uTime * uPulse + uPhase);
    float rimK = smoothstep(.2, .82, 1. - p.y);           // margin moves most
    p.xz *= 1. - s * .22 * rimK;
    p.y += s * .1 * rimK;
    vL = position;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const BELL_FRAG = `
  uniform vec3 uColor, uColor2; uniform float uK, uTime, uPhase; varying vec3 vN, vV, vL;
  void main() {
    float f = 1. - abs(dot(normalize(vN), normalize(vV)));
    float rim = f * f * 1.6 + f * .2;
    float ang = atan(vL.z, vL.x);
    float canals = pow(max(cos(ang * 4.), 1e-4), 18.) * smoothstep(.85, .2, vL.y) * .8;
    float gonads = smoothstep(.55, .25, length(vec2(cos(ang * 2.) * .5, vL.y - .45))) * .35;
    float margin = smoothstep(.1, -.15, vL.y) * .9;
    float shimmer = .75 + .25 * sin(uTime * 3. + ang * 8. + uPhase);
    vec3 c = uColor * (rim + margin * shimmer) + uColor2 * (canals + gonads) * shimmer;
    gl_FragColor = vec4(c * uK, 1.);
  }`;

function tentacleGeometry(count, segs, seed) {
  const rnd = mulberry32(seed), pos = [], at = [], aa = [], al = [];
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + rnd() * 0.2;
    const oral = k % 6 === 0;                        // a few heavier oral arms from the centre
    const r0 = oral ? 0.15 : 0.88, len = oral ? 1.6 + rnd() * 0.6 : 2.8 + rnd() * 3.4;
    for (let s = 0; s < segs; s++) {
      for (const e of [s, s + 1]) {
        const t = e / segs;
        pos.push(Math.cos(ang) * r0, -0.18, Math.sin(ang) * r0);
        at.push(t); aa.push(ang); al.push(len);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  g.setAttribute('aAng', new THREE.Float32BufferAttribute(aa, 1));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(al, 1));
  return g;
}
const TENT_VERT = `
  uniform float uTime, uPhase, uPulse; attribute float aT, aAng, aLen; varying float vT;
  float stroke(float t) { float c = fract(t); return smoothstep(0., .18, c) * (1. - smoothstep(.18, .75, c)); }
  void main() {
    vec3 p = position;
    float s = stroke(uTime * uPulse + uPhase - aT * .6);  // tentacles lag the bell
    p.xz *= 1. - s * .2;
    p.y -= aT * aLen;
    p.x += sin(uTime * 1.1 + aT * 5. + aAng * 3.) * aT * aT * .55 + cos(aAng) * aT * .25 * (1. - s);
    p.z += cos(uTime * .9 + aT * 4.3 + aAng * 2.) * aT * aT * .55 + sin(aAng) * aT * .25 * (1. - s);
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;
const TENT_FRAG = `uniform vec3 uColor; uniform float uK; varying float vT;
  void main() { gl_FragColor = vec4(uColor * (1. - vT) * (1. - vT) * .9 * uK, 1.); }`;

function createJelly(j, cfg, bellGeo, index) {
  const group = new THREE.Group();
  const common = { uTime: { value: 0 }, uPhase: { value: index * 1.37 }, uPulse: { value: 0.38 + (index % 3) * 0.07 }, uK: { value: 1 } };
  const bell = new THREE.Mesh(bellGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...common, uColor: { value: col(j.c) }, uColor2: { value: col(j.c2) } },
    vertexShader: BELL_VERT, fragmentShader: BELL_FRAG,
  }));
  const tent = new THREE.LineSegments(tentacleGeometry(cfg.tentacles, cfg.segs, 100 + index), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...common, uColor: { value: col(j.c).lerp(col(j.c2), 0.35) } },
    vertexShader: TENT_VERT, fragmentShader: TENT_FRAG,
  }));
  tent.frustumCulled = false;
  const glow = glowSprite(j.c, 5, 0.22);
  glow.position.y = 0.2;
  group.add(glow, bell, tent);
  group.scale.setScalar(j.s);
  group.position.set(j.x, j.y, j.z);
  group.userData = { base: new THREE.Vector3(j.x, j.y, j.z), common, tilt: (index % 2 ? 1 : -1) * 0.2 };
  return group;
}

function initTwilight(gfx) {
  const t = CONFIG.twilight;
  const scene = new THREE.Scene();
  const camera = createZoneCamera();
  const dome = createDome(t.domeTop, t.domeBottom);
  dome.material.uniforms.uShaft.value = 0.5;
  scene.add(dome);
  const bellGeo = bellGeometry();
  const jellies = t.jellies.map((j, i) => createJelly(j, t, bellGeo, i));
  jellies.forEach((j) => scene.add(j));
  const snow = createWrapPoints({ count: countFor(t, 'snow'), box: [46, 34, 46], size: 0.75, color: '#cfefff', seed: 17, opacity: 0.85 });
  snow.material.uniforms.uFall.value = 0.35;
  scene.add(snow);

  const topA = col(t.domeTop), topB = col(t.darkTop), botA = col(t.domeBottom), botB = col(t.darkBottom);
  gfx.onResize((W, H, dpr) => { fitCamera(camera, W / H); snow.material.uniforms.uDpr.value = dpr; });
  return {
    id: 'twilight', scene, camera, mats: [dome.material, snow.material],
    update(p, time) {
      // Sink straight down past the jellies, drifting sideways a little.
      const y = -4 - p * t.fall;
      aim(camera, [Math.sin(p * 3.1) * 2.4, y, 4 + Math.sin(p * 2) * 2], Math.sin(p * 2.3) * 0.22, -0.12 - Math.sin(p * 3.14) * 0.1);
      camera.updateMatrixWorld();
      dome.position.copy(camera.position);
      const k = smooth(p);
      dome.material.uniforms.uTop.value.copy(topA).lerp(topB, k);
      dome.material.uniforms.uBottom.value.copy(botA).lerp(botB, k);
      dome.material.uniforms.uShaft.value = 0.5 * (1 - k);
      dome.material.uniforms.uTime.value = time;
      jellies.forEach((g, i) => {
        const d = g.userData;
        d.common.uTime.value = time;
        // Slow rise with each stroke, plus a lazy tilt.
        g.position.set(d.base.x + Math.sin(time * 0.2 + i) * 0.6, d.base.y + Math.sin(time * 0.35 + i) * 0.5, d.base.z);
        g.rotation.set(Math.sin(time * 0.3 + i) * 0.12 + d.tilt, time * 0.05 * (i % 2 ? 1 : -1), Math.cos(time * 0.25 + i) * 0.1);
        // Glow a touch brighter as the water darkens.
        d.common.uK.value = 0.85 + k * 0.5;
      });
      const su = snow.material.uniforms;
      su.uCam.value.copy(camera.position); su.uTime.value = time; su.uVel.value = vel.k;
    },
    render(renderer) { renderer.render(scene, camera); },
  };
}
