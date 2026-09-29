/* SEASONS world: renderer, camera, lights, sky dome with clouds and stars, hill, far hills, cottage. */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.dprMax));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.light.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe6f7, 45, 260);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);

/* ───────── lights ───────── */
const sun = new THREE.DirectionalLight(0xffffff, CONFIG.light.sun);
sun.castShadow = true;
{
  const S = CONFIG.shadow, m = pick(S.map, S.mapMobile);
  sun.shadow.mapSize.set(m, m);
  Object.assign(sun.shadow.camera, { left: -S.extent, right: S.extent, top: S.extent, bottom: -S.extent, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  U.uShadowTexel.value.set(1 / m, 1 / m);
}
sun.target.position.set(0, CONFIG.hill.h + 4, 0);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfdcff, 0x55663a, CONFIG.light.hemi);
scene.add(hemi);

/* ───────── sky ───────── */
const SKY = {
  uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDisc: { value: new THREE.Color() },
  uCloud: { value: 0.45 }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.6, 0.66, 0.74) },
  uCloudTime: { value: 0 }, uStars: { value: 0 }, uGlow: { value: 1 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { ...U, ...SKY },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uZen, uHor, uSunDisc, uCloudLit, uCloudShade;
      uniform float uCloud, uCloudTime, uStars, uGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uZen, pow(smoothstep(-.02, .45, h), .6));
        col = mix(col, uHor * .92, smoothstep(0., -.08, h));
        float sd = max(dot(d, uSunDir), 0.);
        col += uSunDisc * (smoothstep(.9994, .9998, sd) * 6. + pow(sd, 14.) * .32 * uGlow + pow(sd, 3.) * .1 * uGlow);
        if (h > -.02) {
          vec2 cp = d.xz / (max(h, 0.) + .1) * 1.35 + vec2(uCloudTime * .018, uCloudTime * .006);
          float n = fbm(cp * .8);
          float th = mix(.78, .36, uCloud);
          float dens = smoothstep(th, th + .2, n) * smoothstep(-.02, .16, h);
          float n2 = fbm(cp * .8 + uSunDir.xz * .09);
          float lit = clamp((n - n2) * 5. + .55, 0., 1.);
          vec3 cc = mix(uCloudShade, uCloudLit, lit);
          cc += uSunDisc * pow(sd, 6.) * .35 * (1. - dens);
          col = mix(col, cc, dens * .96);
          // stars on a spherical grid, twinkling, hidden behind clouds
          vec2 sp = vec2(atan(d.z, d.x) * 95., asin(clamp(h, -1., 1.)) * 95.);
          vec2 cell = floor(sp), f = fract(sp) - .5;
          float r = hash12(cell);
          vec2 off = vec2(hash12(cell + 7.1), hash12(cell + 3.7)) - .5;
          float star = step(.965, r) * smoothstep(.16, 0., length(f - off * .6)) * (0.55 + .45 * sin(uTime * (1. + r * 3.) + r * 40.));
          col += vec3(.9, .94, 1.) * star * uStars * smoothstep(.02, .2, h) * (1. - dens) * (.4 + (r - .965) * 18.);
        }
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -1;
scene.add(sky);

/* ───────── hill ground: radial rings dense near the tree ───────── */
function radialGround(R, rings, segs, heightAt) {
  const pos = [], idx = [];
  pos.push(0, heightAt(0, 0), 0);
  for (let i = 1; i <= rings; i++) {
    const r = R * Math.pow(i / rings, 2.1);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
      pos.push(x, heightAt(x, z), z);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segs));
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs, a1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(a0 + j, a1 + j, a1 + j1, a0 + j, a1 + j1, a0 + j1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const GROUND_COLOR = /* glsl */ `
  float gn = fbm(vWP.xz * .32), gn2 = vnoise(vWP.xz * 3.3), rr = length(vWP.xz);
  vec3 g = mix(uGrass * .72, uGrassTip * .95, gn * .75 + gn2 * .25);
  float pet = uPetalGround * smoothstep(8., 3., rr + (gn - .5) * 5.) * smoothstep(.62, .85, vnoise(vWP.xz * 11.) + gn * .35);
  g = mix(g, vec3(.95, .5, .62), pet * .75);
  float lit = uLitter * smoothstep(10., 2.5, rr + (gn - .5) * 5.5) * smoothstep(.25, .6, vnoise(vWP.xz * 6.) * .7 + gn * .5);
  g = mix(g, mix(vec3(.62, .26, .06), vec3(.78, .5, .1), gn2), lit * .8);
  g = mix(g, vec3(.2, .15, .1), smoothstep(1.4, .5, rr) * .55);
  diffuseColor.rgb = g;
  float snowEdge = gn * .8 + vnoise(vWP.xz * 1.7) * .2;
  float snowG = smoothstep(snowEdge - .05, snowEdge + .05, uSnow * 1.3 - .2);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol * (.94 + gn2 * .06), snowG);
`;
const ground = new THREE.Mesh(
  radialGround(CONFIG.hill.ground, 90, CONFIG.hill.segs, hillY),
  patchStandard(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }), { colorCode: GROUND_COLOR }),
);
ground.receiveShadow = true;
scene.add(ground);

/* distant hills: a noisy ring, coloured with the season and faded by fog */
function farHills() {
  const F = CONFIG.far, rnd = mulberry32(CONFIG.seed + 5), segs = F.segs;
  const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
  const heightAt = (a, ring) => {
    const base = F.h[0] + (F.h[1] - F.h[0]) * (0.5 + 0.28 * Math.sin(a * 3 + ph[0]) + 0.15 * Math.sin(a * 7 + ph[1]) + 0.07 * Math.sin(a * 17 + ph[2]));
    return ring === 0 ? -1 : base * (ring === 1 ? 0.55 : 1);
  };
  const pos = [], idx = [];
  const radii = [F.r[0], lerp(F.r[0], F.r[1], 0.4), F.r[1]];
  for (let k = 0; k < 3; k++) for (let j = 0; j <= segs; j++) {
    const a = (j / segs) * Math.PI * 2;
    pos.push(Math.sin(a) * radii[k], heightAt(a, k), Math.cos(a) * radii[k]);
  }
  for (let k = 0; k < 2; k++) for (let j = 0; j < segs; j++) {
    const a = k * (segs + 1) + j, b = a + segs + 1;
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = patchStandard(new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), {
    colorCode: /* glsl */ `
      float fn = fbm(vWP.xz * .05 + vWP.y * .1);
      vec3 hc = mix(uGrass * .5, uGrass * .85, fn);
      hc = mix(hc, hc * .55, smoothstep(.5, .7, fbm(vWP.xz * .09)));
      diffuseColor.rgb = mix(hc, uSnowCol * .92, smoothstep(.2, .6, uSnow + (fn - .5) * .3));`,
  });
  return new THREE.Mesh(g, m);
}
scene.add(farHills());

/* ───────── cottage with a warm window ───────── */
function cottage() {
  const H = CONFIG.house, grp = new THREE.Group();
  const y0 = hillY(H.pos[0], H.pos[1]);
  grp.position.set(H.pos[0], y0 - 0.05, H.pos[1]);
  grp.rotation.y = H.yaw;
  const wall = patchStandard(new THREE.MeshStandardMaterial({ color: '#a4402f', roughness: 0.85 }));
  const trim = patchStandard(new THREE.MeshStandardMaterial({ color: '#f2f5f7', roughness: 0.7 }));
  const roofM = patchStandard(new THREE.MeshStandardMaterial({ color: '#3a4250', roughness: 0.8, side: THREE.DoubleSide }), { snow: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(H.w, H.h, H.d), wall);
  body.position.y = H.h / 2;
  const shape = new THREE.Shape([new THREE.Vector2(-H.w / 2 - 0.2, 0), new THREE.Vector2(H.w / 2 + 0.2, 0), new THREE.Vector2(0, H.roof)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: H.d + 0.4, bevelEnabled: false }), roofM);
  roof.position.set(0, H.h, -H.d / 2 - 0.2);
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-H.w / 2, 0), new THREE.Vector2(H.w / 2, 0), new THREE.Vector2(0, H.roof - 0.12)]), { depth: H.d - 0.02, bevelEnabled: false }), wall);
  gable.position.set(0, H.h, -H.d / 2 + 0.01);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), trim);
  chimney.position.set(H.w * 0.24, H.h + H.roof * 0.62, 0.3);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.06), trim);
  door.position.set(-0.55, 0.48, H.d / 2 + 0.02);
  const glass = new THREE.MeshStandardMaterial({ color: '#56708f', roughness: 0.25, emissive: new THREE.Color(CONFIG.light.window), emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.06), glass);
  win.position.set(0.5, 0.9, H.d / 2 + 0.02);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.66, 0.04), trim);
  frame.position.set(0.5, 0.9, H.d / 2 + 0.005);
  const win2 = win.clone();
  win2.position.set(H.w / 2 + 0.02, 0.9, 0.1);
  win2.rotation.y = Math.PI / 2;
  grp.add(body, roof, gable, chimney, door, frame, win, win2);
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  grp.updateMatrixWorld(true);
  U.uWindowPos.value.copy(win.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.4, 0));

  /* a soft glow card in front of the window, visible at night */
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,200,130,1)'); g.addColorStop(0.3, 'rgba(255,170,90,.45)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
  glow.scale.setScalar(3.4);
  glow.position.copy(win.getWorldPosition(new THREE.Vector3()));
  scene.add(glow);
  return {
    grp,
    set(glowK) {
      glass.emissiveIntensity = glowK * 2.6;
      glow.material.opacity = glowK * 0.85;
      U.uWindowGlow.value = glowK;
    },
  };
}
const house = cottage();
scene.add(house.grp);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.dprMax));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
