/* ───────── drift overlay: bubbles and streaks that answer scroll speed ───────── */
// Screen-space quads drawn over every zone. Scrolling down moves them up past the lens (the diver sinks through them).
// Scroll velocity stretches them into streaks and brightens them; near the surface they draw as bubble rings.

function createDrift(gfx) {
  const N = countFor(CONFIG.drift, 'count'), rnd = mulberry32(1203);
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const base = new Float32Array(N * 3), rand = new Float32Array(N);
  for (let i = 0; i < N; i++) { base[i * 3] = rnd() * 2.2 - 1.1; base[i * 3 + 1] = rnd() * 2.4 - 1.2; base[i * 3 + 2] = rnd() * rnd(); rand[i] = rnd(); }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uScroll: { value: 0 }, uTime: { value: 0 }, uVel: { value: 0 }, uAspect: { value: 1 }, uK: { value: 0.5 },
      uBubble: { value: 1 }, uRise: { value: 0.05 }, uColor: { value: new THREE.Color() }, uPx: { value: 1 },
    },
    vertexShader: `
      uniform float uScroll, uTime, uVel, uAspect, uRise, uPx; attribute vec3 aBase; attribute float aRand;
      varying vec2 vUv; varying float vStretch, vNear;
      void main() {
        float near = mix(.25, 1., aBase.z);
        float y = aBase.y + uScroll * near + uTime * uRise * near * (.6 + aRand);
        y = mod(y + 1.2, 2.4) - 1.2;
        float x = aBase.x + sin(uTime * .6 + aRand * 20.) * .015 * near;
        float sz = (6. + aRand * 16.) * near * uPx;                 // size in pixels
        float stretch = 1. + abs(uVel) * 22. * near;
        vec2 q = position.xy;
        gl_Position = vec4(x + q.x * sz * 2. / (uAspect * 900.), y + q.y * sz * stretch * 2. / 900., 0., 1.);
        vUv = q + .5; vStretch = stretch; vNear = near;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uK, uBubble, uVel; varying vec2 vUv; varying float vStretch, vNear;
      void main() {
        vec2 d = (vUv - .5) * 2.;
        float r = length(d);
        if (r > 1.) discard;
        float disc = 1. - r;
        float ring = smoothstep(.62, .86, r) * (1. - smoothstep(.86, 1., r)) + smoothstep(.35, 0., length(d - vec2(-.35, .35))) * .8;
        float look = mix(disc * disc, ring, uBubble / vStretch);
        float a = look * uK * (.35 + abs(uVel) * .9) * vNear / sqrt(vStretch);
        gl_FragColor = vec4(uColor * a, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  gfx.onResize((W, H, dpr) => { mat.uniforms.uAspect.value = W / H; mat.uniforms.uPx.value = 900 / H; });
  const looks = CONFIG.drift.looks.map(([c, k, b, r]) => ({ c: col(c), k, b, r }));
  const tmp = new THREE.Color();
  return {
    scene, camera,
    update(u, time) {
      const i = Math.min(looks.length - 1, Math.floor(u)), j = Math.min(looks.length - 1, i + 1), t = smooth(seg(u - i, 0.85, 1));
      const A = looks[i], B = looks[j], U = mat.uniforms;
      U.uColor.value.copy(A.c).lerp(tmp.copy(B.c), t);
      U.uK.value = lerp(A.k, B.k, t); U.uBubble.value = lerp(A.b, B.b, t); U.uRise.value = lerp(A.r, B.r, t);
      U.uTime.value = time; U.uVel.value = reduce ? 0 : vel.v;
      U.uScroll.value = scrollY * CONFIG.drift.scroll;
    },
  };
}
