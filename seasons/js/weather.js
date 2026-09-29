/* SEASONS weather and ground cover: grass blades, rain streaks, rippling puddles, snowfall, fireflies. */

/* ───────── grass: instanced tapered blades, bend with wind, sink under snow ───────── */
const grass = (() => {
  const G = CONFIG.grass, count = pick(G.count, G.countMobile), rnd = mulberry32(CONFIG.seed + 41);
  const blade = new THREE.BufferGeometry();
  const bx = [-1, 1, -0.75, 0.75, -0.42, 0.42, 0], by = [0, 0, 0.35, 0.35, 0.7, 0.7, 1];
  blade.setAttribute('position', new THREE.Float32BufferAttribute(bx.flatMap((x, i) => [x, by[i], 0]), 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  const g = new THREE.InstancedBufferGeometry();
  g.index = blade.index;
  g.setAttribute('position', blade.getAttribute('position'));
  const pos = new Float32Array(count * 3), rn = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const near = rnd() < 0.7;
    const r0 = near ? G.r[0] : 13, r1 = near ? 13 : G.r[1];
    const r = Math.sqrt(lerp(r0 * r0, r1 * r1, rnd())), a = rnd() * Math.PI * 2;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    pos.set([x, hillY(x, z), z], i * 3);
    rn.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rn, 4));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: { ...U, ...fogUniforms() },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform mat4 uShadowMatrix;
      attribute vec3 aPos;
      attribute vec4 aRnd;
      varying vec3 vCol;
      varying vec3 vWP;
      varying vec4 vSC;
      varying float vY;
      #include <fog_pars_vertex>
      void main() {
        float h = mix(${f3(G.h[0])}, ${f3(G.h[1])}, aRnd.x) * (1. - smoothstep(.12, .6, uSnow + (aRnd.y - .5) * .25));
        float flower = step(.94, aRnd.w) * uFlowers;
        h *= mix(1., .75, flower);
        float yaw = aRnd.y * 6.2831, y = position.y;
        vec3 side = vec3(cos(yaw), 0., sin(yaw));
        vec3 pos = aPos + side * position.x * .028 * (1. + flower * 1.6 * step(.9, y));
        pos.y += y * h;
        vec2 lean = vec2(cos(yaw * 1.7), sin(yaw * 1.7)) * .3;
        vec2 wind = uWind.xz * .9 + normalize(uWind.xz + 1e-4) * uGust * .9;
        lean += wind * (.6 + .4 * sin(uTime * 2.3 + aPos.x * .7 + aPos.z * .5));
        pos.xz += lean * y * y * h;
        pos.y -= dot(lean, lean) * y * y * h * .25;
        vec3 col = mix(uGrass * .45, uGrassTip, y) * (.78 + .44 * aRnd.z);
        vec3 fc = aRnd.z > .5 ? vec3(1., .97, .92) : vec3(1., .82, .2);
        vCol = mix(col, fc, flower * step(.9, y));
        vY = y;
        vWP = pos;
        vSC = uShadowMatrix * vec4(pos, 1.);
        vec4 mvPosition = viewMatrix * vec4(pos, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      #include <packing>
      ${GLSL_SHADOW}
      #include <fog_pars_fragment>
      varying vec3 vCol;
      varying vec3 vWP;
      varying vec4 vSC;
      varying float vY;
      void main() {
        float sh = shadowAt(vSC, .002);
        vec3 N = normalize(vec3(0., 1., 0.) + (cameraPosition - vWP) * .02);
        vec3 lit = mix(uHemiGround, uHemiSky, .8) * mix(.45, 1., vY) + uSunCol * (max(dot(N, uSunDir), 0.) * .8 + .25) * sh;
        vec3 c = vCol * lit * ${f3(1 / Math.PI)} + vCol * windowLight(vWP) * .3;
        c *= mix(1., ${f3(CONFIG.wetDark)}, uWet * .5);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
})();
scene.add(grass);

/* ───────── rain: streaks in a box that wraps around the camera target ───────── */
const rain = (() => {
  const R = CONFIG.rain, count = pick(R.count, R.countMobile), rnd = mulberry32(CONFIG.seed + 51);
  const pos = new Float32Array(count * 6), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = rnd() * R.box[0], y = rnd() * R.box[1], z = rnd() * R.box[2];
    pos.set([x, y, z, x, y, z], i * 6);
    end.set([0, 1], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...U, ...fogUniforms(), uBox: { value: new THREE.Vector3(...R.box) } },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uBox;
      attribute float aEnd;
      varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * 16., uBox.y);
        vec3 wrapped = mod(p - uCamTarget + uBox * .5, uBox) - uBox * .5 + uCamTarget;
        wrapped.y = uCamTarget.y - 6. + p.y;
        vec3 fallDir = normalize(vec3(uWind.x * .5, -1., uWind.z * .5));
        wrapped -= fallDir * aEnd * .55;
        vA = uRain * (1. - aEnd * .7) * step(hillH(wrapped.xz), wrapped.y);
        vec4 mvPosition = viewMatrix * vec4(wrapped, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vA;
      void main() {
        gl_FragColor = vec4(vec3(.82, .88, .95), vA * .55);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.LineSegments(g, mat);
  m.frustumCulled = false;
  return m;
})();
scene.add(rain);

/* ───────── puddles: sky reflection plus expanding ripple rings while it rains ───────── */
const PUDDLE = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } };
const puddles = CONFIG.puddles.map(([px, pz, rad], i) => {
  const geo = new THREE.CircleGeometry(1, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...U, ...PUDDLE, ...fogUniforms(), uC: { value: new THREE.Vector3(px, 0, pz) }, uRad: { value: rad }, uSeed: { value: i * 7.3 } },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uC;
      uniform float uRad;
      varying vec2 vL;
      varying vec3 vWP;
      #include <fog_pars_vertex>
      void main() {
        float wob = 1. + .18 * sin(atan(position.z, position.x) * 3. + uC.x) + .1 * sin(atan(position.z, position.x) * 5. + uC.z);
        vec3 p = uC + vec3(position.x * uRad * wob, 0., position.z * uRad * .72 * wob);
        p.y = hillH(p.xz) + .025;
        vL = position.xz * wob;
        vWP = p;
        vec4 mvPosition = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uZen, uHor;
      uniform float uSeed;
      varying vec2 vL;
      varying vec3 vWP;
      #include <fog_pars_fragment>
      void main() {
        float edge = smoothstep(1., .72, length(vL / vec2(1., 1.)));
        vec2 q = vWP.xz * 1.6;
        float ring = 0.;
        for (int k = 0; k < 4; k++) {
          vec2 cell = floor(q + float(k) * .37);
          vec2 f = fract(q + float(k) * .37) - .5;
          float h = hash12(cell + uSeed + float(k) * 11.);
          vec2 c0 = vec2(hash12(cell + 2.3), hash12(cell + 5.9)) - .5;
          float t = fract(uTime * (.9 + h * .6) + h);
          float d = length(f - c0 * .5);
          ring += smoothstep(.035, 0., abs(d - t * .5)) * (1. - t) * step(.35, h);
        }
        ring *= uRain;
        vec3 V = normalize(cameraPosition - vWP);
        float fres = pow(1. - max(V.y, 0.), 3.);
        vec3 refl = mix(uZen, uHor, fres);
        vec3 col = refl * (.8 + ring * .8) + windowLight(vWP) * .4;
        gl_FragColor = vec4(col, edge * uWet * (.75 + ring * .25));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  scene.add(m);
  return m;
});

/* ───────── snowfall and fireflies share one soft point sprite shader ───────── */
function pointField({ count, box, seed, vertexBody, color, additive, sizePx }) {
  const rnd = mulberry32(seed), pos = new Float32Array(count * 3), rn = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos.set([rnd() * box[0], rnd() * box[1], rnd() * box[2]], i * 3);
    rn.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { ...U, ...fogUniforms(), uBox: { value: new THREE.Vector3(...box) }, uCol: { value: new THREE.Color(color) }, uPx: { value: sizePx } },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uBox;
      uniform float uPx;
      attribute vec4 aRnd;
      varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vec3 p; float a;
        ${vertexBody}
        vA = a;
        vec4 mvPosition = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uPx * (.6 + aRnd.w * .8) * ${f3(1)} / max(-mvPosition.z, .5) * (a > .001 ? 1. : 0.);
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      varying float vA;
      #include <fog_pars_fragment>
      void main() {
        float d = length(gl_PointCoord - .5);
        float m = smoothstep(.5, .1, d);
        gl_FragColor = vec4(uCol * (1. + smoothstep(.2, 0., d) * .6), m * vA);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Points(g, mat);
  m.frustumCulled = false;
  return m;
}

const snowfall = pointField({
  count: pick(CONFIG.snow.count, CONFIG.snow.countMobile), box: CONFIG.snow.box, seed: CONFIG.seed + 61,
  color: '#ffffff', additive: false, sizePx: 55,
  vertexBody: /* glsl */ `
    p = position;
    p.y = mod(p.y - uTime * (.7 + aRnd.x * .6), uBox.y);
    p.x += sin(uTime * (.6 + aRnd.y) + aRnd.z * 9.) * .6 + uWind.x * p.y * .25;
    p.z += cos(uTime * (.5 + aRnd.x) + aRnd.w * 9.) * .6 + uWind.z * p.y * .25;
    p = mod(p - uCamTarget + uBox * .5, uBox) - uBox * .5 + uCamTarget;
    p.y = uCamTarget.y - 8. + mod(position.y - uTime * (.7 + aRnd.x * .6), uBox.y);
    a = uSnowFall * step(hillH(p.xz), p.y) * .95;`,
});
const fireflies = pointField({
  count: pick(CONFIG.fireflies.count, CONFIG.fireflies.countMobile), box: [1, 1, 1], seed: CONFIG.seed + 71,
  color: '#e6f57a', additive: true, sizePx: 150,
  vertexBody: /* glsl */ `
    float ang = aRnd.x * 6.2831 + uTime * .05 * (aRnd.y - .5), rad = 2.5 + aRnd.y * 11.;
    p = vec3(sin(ang) * rad, 0., cos(ang) * rad);
    p.x += sin(uTime * (.3 + aRnd.z * .4) + aRnd.w * 20.) * 1.1;
    p.z += cos(uTime * (.25 + aRnd.w * .4) + aRnd.z * 20.) * 1.1;
    p.y = hillH(p.xz) + .3 + aRnd.z * 2.6 + sin(uTime * .8 + aRnd.x * 30.) * .35;
    a = uFire * pow(max(sin(uTime * (1.2 + aRnd.w * 1.5) + aRnd.y * 40.), 0.), 4.);`,
});
scene.add(snowfall, fireflies);
