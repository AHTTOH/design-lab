/* ───────── renderer, zone dissolve pass, post ───────── */
// One renderer, one fixed canvas. Each zone owns a scene and a camera. The ZonePass renders the current zone (and the
// next one while crossing a boundary) into half-float targets, dissolves them with an fbm threshold that rises from the
// bottom of the screen like water closing over, then draws the velocity drift overlay on top.

const MIX_SHADER = {
  uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `${GLSL_NOISE}
    uniform sampler2D tA, tB; uniform float uMix, uTime; varying vec2 vUv;
    void main() {
      if (uMix <= 0.) { gl_FragColor = texture2D(tA, vUv); return; }
      float n = fbm(vUv * vec2(3.2, 2.2) + vec2(0., uTime * .06));
      float th = uMix * 1.34 - .17;
      float m = 1. - smoothstep(th - .13, th + .13, n * .72 + vUv.y * .28);
      float edge = m * (1. - m) * 4.;
      vec2 w = (vec2(vnoise(vUv * 14. + uTime * .4), vnoise(vUv * 14. - uTime * .35)) - .5) * .045 * edge;
      vec3 a = texture2D(tA, vUv + w).rgb, b = texture2D(tB, vUv - w).rgb;
      vec3 c = mix(a, b, m) + edge * edge * vec3(.05, .16, .2);
      gl_FragColor = vec4(c, 1.);
    }`,
};

class ZonePass extends Pass {
  constructor(samples) {
    super();
    this.needsSwap = true;
    const opts = { type: THREE.HalfFloatType, samples };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ ...MIX_SHADER, uniforms: THREE.UniformsUtils.clone(MIX_SHADER.uniforms), depthTest: false, depthWrite: false }));
    this.a = null; this.b = null; this.mix = 0; this.time = 0; this.overlay = null;
  }
  setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); }
  renderZone(renderer, zone, rt) {
    renderer.setRenderTarget(rt);
    renderer.clear();
    zone.render(renderer);
  }
  render(renderer, writeBuffer) {
    if (!this.a) throw new Error('ZonePass has no zone to draw');
    this.renderZone(renderer, this.a, this.rtA);
    const blending = this.b && this.mix > 0;
    if (blending) this.renderZone(renderer, this.b, this.rtB);
    const u = this.quad.material.uniforms;
    u.tA.value = this.rtA.texture; u.tB.value = (blending ? this.rtB : this.rtA).texture;
    u.uMix.value = blending ? this.mix : 0; u.uTime.value = this.time;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    if (this.overlay) {
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(this.overlay.scene, this.overlay.camera);
      renderer.autoClear = auto;
    }
  }
}

const FINAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVel: { value: 0 }, uAspect: { value: 1 },
    uVignette: { value: CONFIG.final.vignette }, uGrain: { value: CONFIG.final.grain }, uAberr: { value: CONFIG.final.aberration },
    uHeat: { value: 0 }, uVents: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uFlash: { value: new THREE.Vector3(0.5, 0.5, 0) }, uFlashColor: { value: col('#3fe0ff') },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `${GLSL_NOISE}
    uniform sampler2D tDiffuse; uniform float uTime, uVel, uAspect, uVignette, uGrain, uAberr, uHeat;
    uniform vec4 uVents[5]; uniform vec3 uFlash, uFlashColor; varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      // Heat shimmer: columns rising above each vent mouth (x, y in uv, w width, k strength).
      if (uHeat > 0.) {
        float m = 0.;
        for (int i = 0; i < 5; i++) {
          vec4 v = uVents[i];
          float dx = (uv.x - v.x) / max(v.z, 1e-3);
          float up = uv.y - v.y;
          m += v.w * exp(-dx * dx) * smoothstep(-.02, .04, up) * (1. - smoothstep(.05, .5, up));
        }
        vec2 q = uv * vec2(34., 14.);
        vec2 o = vec2(vnoise(q + vec2(0., -uTime * 3.2)), vnoise(q * 1.3 + vec2(7., -uTime * 2.7))) - .5;
        uv += o * .018 * clamp(m, 0., 1.5) * uHeat;
      }
      vec2 d = uv - .5;
      float amt = uAberr + uVel * ${CONFIG.final.aberrationVel.toFixed(4)};
      vec3 c = vec3(texture2D(tDiffuse, uv + d * amt).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * amt).b);
      // Flashlight halo: scattered light in the water around the beam.
      if (uFlash.z > 0.) {
        vec2 f = (uv - uFlash.xy) * vec2(uAspect, 1.);
        c += uFlashColor * uFlash.z * (exp(-dot(f, f) * 9.) * .1 + exp(-dot(f, f) * 60.) * .06);
      }
      float r = length(d * vec2(uAspect, 1.) / max(uAspect, 1.)) * 1.35;
      c *= 1. - uVignette * r * r;
      c = max(c + (hash12(uv * 1931. + fract(uTime) * 97.) - .5) * uGrain * (.15 + c), 0.);
      gl_FragColor = vec4(c, 1.);
    }`,
};

function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  const zonePass = new ZonePass(isMobile() ? 0 : CONFIG.msaa);
  composer.addPass(zonePass);
  const b = CONFIG.bloom;
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), b.strength, b.radius, b.threshold));
  const finalPass = new ShaderPass(FINAL_SHADER);
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());

  const resizers = [];
  function fit() {
    const W = innerWidth, H = innerHeight, dpr = dprNow();
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    finalPass.uniforms.uAspect.value = W / H;
    resizers.forEach((f) => f(W, H, dpr));
  }
  addEventListener('resize', fit);
  return { renderer, composer, zonePass, finalPass, fit, onResize: (f) => resizers.push(f) };
}
