/* ───────── zone 1: under the sunlit surface ───────── */
// A single full-screen shader. Each pixel is a view ray from a diver at depth d. Rays that reach the surface are refracted
// through a rippling height field (Snell's window). Past the critical angle they reflect back into dark water.
// Screen-space god rays fan down from the sun spot. The title is a canvas texture seen through the same ripples.

const SURFACE_FRAG = `${GLSL_NOISE}
  uniform float uTime, uDepth, uPitch, uYaw, uAspect, uTanHalf, uIor, uRays, uTitleK, uTitleLift, uDark;
  uniform vec4 uManta;
  uniform vec3 uSun, uWater, uDeep, uSky, uZenith, uSunColor, uTitleColor;
  uniform sampler2D uTitle; varying vec2 vUv;

  float height(vec2 p, float t) {
    float h = sin(p.x * .9 + t * 1.1) * .22 + sin(p.y * 1.3 - t * .9 + p.x * .4) * .18;
    h += sin((p.x + p.y) * 2.3 + t * 1.7) * .08 + (fbm(p * .7 + t * .12) - .5) * .9;
    return h;
  }
  vec3 surfaceNormal(vec2 p, float t) {
    float e = .05, h = height(p, t);
    // Normal facing down into the water.
    return normalize(vec3((height(p + vec2(e, 0.), t) - h) / e * .55, -1., (height(p + vec2(0., e), t) - h) / e * .55));
  }
  // Manta ray seen from below as a soft silhouette. Local x spans the wings, +y is the head. Negative = inside.
  float manta(vec2 uv, float t) {
    vec2 q = (uv - uManta.xy) * vec2(uAspect, 1.) / uManta.z;
    vec2 p = vec2(q.y, -q.x);                       // swimming toward screen left
    float flap = sin(t * 1.25);
    float ax = abs(p.x);
    p.y -= flap * .1 * ax * ax;
    ax /= 1. - .07 * flap;
    float front = .3 - .5 * pow(max(ax, 1e-4), 1.2);
    float back = -.2 + .03 * ax + .1 * sin(min(ax, 1.) * 3.1416);
    float wing = max(max(p.y - front, back - p.y), ax - 1.);
    float body = length((p - vec2(0., .04)) / vec2(.15, .3)) - 1.;
    float horns = length((vec2(ax, p.y) - vec2(.1, .34)) / vec2(.03, .07)) - 1.;
    float tail = max(ax - .012, max(p.y + .15, -.9 - p.y));
    return min(min(wing, body * .15), min(horns * .03, tail));
  }
  vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
  vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }

  void main() {
    vec2 ndc = vUv * 2. - 1.;
    vec3 dir = normalize(vec3(ndc.x * uAspect * uTanHalf, ndc.y * uTanHalf, -1.));
    dir = rotY(rotX(dir, uPitch), uYaw);
    float t = uTime;
    vec3 cam = vec3(0., -uDepth, -t * .35);
    vec3 c;
    float absorb = .045 + uDark * .05;
    if (dir.y > .001) {
      float dist = uDepth / dir.y;
      vec2 hit = cam.xz + dir.xz * dist;
      vec3 n = surfaceNormal(hit * .35, t);
      vec3 r = refract(dir, n, uIor);
      if (dot(r, r) < .001) {
        // Total internal reflection: the underside mirrors the dark water below, with a sheen.
        vec3 rf = reflect(dir, n);
        c = mix(uDeep, uWater, .35 + .25 * rf.y) * .55;
      } else {
        float sky = clamp(r.y, 0., 1.);
        c = mix(uSky, uZenith, sky);
        float s = max(dot(r, uSun), 0.);
        c += uSunColor * (s * s * s * s * s * s * s * s * s * s * s * s * s * s * s * s) * 2.2 + uSunColor * .06 * s * s * s * s;
        // Bright rim of Snell's window.
        float rim = 1. - sky; c += uSky * rim * rim * rim * .45;
      }
      float fall = exp(-dist * absorb);
      c = mix(uWater * .8, c, fall);
      // Caustic glints on the underside.
      c += uSky * caustic(hit * .3, t * .8) * .14 * fall;
    } else {
      float k = clamp(-dir.y, 0., 1.);
      c = mix(uWater * .9, uDeep * .6, sqrt(k));
    }
    // God rays: fan of shafts from the sun spot, stronger below it.
    vec3 sunDir = rotX(rotY(normalize(vec3(uSun.x * .5, 1., uSun.z * .5)), -uYaw), -uPitch);
    vec2 sunUv = vec2(sunDir.x / max(-sunDir.z, .05) / (uAspect * uTanHalf), sunDir.y / max(-sunDir.z, .05) / uTanHalf) * .5 + .5;
    if (sunDir.z > 0.) sunUv = vec2(.5, 2.4);
    vec2 d = (vUv - sunUv) * vec2(uAspect, 1.);
    float ang = atan(d.x, -d.y), rad = length(d);
    float shafts = fbm(vec2(ang * 7.5, t * .12)) * fbm(vec2(ang * 17. + 3., t * .2));
    shafts = shafts * shafts * 6.;
    float below = smoothstep(.1, -.4, (vUv.y - sunUv.y));
    c += uSky * shafts * uRays * exp(-rad * .9) * (.35 + below * .65) * (1. - uDark);

    if (uManta.w > 0.) {
      float m = smoothstep(.015, -.01, manta(vUv, t));
      c = mix(c, mix(uDeep * .18, uWater * .25, .3), m * uManta.w);
    }
    // Title seen through the ripples.
    if (uTitleK > 0.) {
      vec2 tuv = vUv + vec2(0., -uTitleLift);
      tuv += (vec2(vnoise(vUv * 9. + t * .6), vnoise(vUv * 9. - t * .5)) - .5) * .012;
      float a = texture2D(uTitle, tuv).a;
      float glow = texture2D(uTitle, tuv + vec2(.004, -.006)).a;
      // Dark letters against the light, with a soft shadow so they read over the bright window too.
      c = mix(c, c * .35, glow * .5 * uTitleK);
      c = mix(c, uTitleColor, a * uTitleK);
    }
    c = mix(c, c * .12 + uDeep * .05, uDark);
    gl_FragColor = vec4(c, 1.);
  }`;

/** The rippling-surface quad. Used by zone 1, and by zone 6 as the light waiting above. */
function createSurfaceQuad(titleTexture) {
  const s = CONFIG.surface;
  const mat = new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: {
      uTime: { value: 0 }, uDepth: { value: s.depth[0] }, uPitch: { value: s.pitch[0] }, uYaw: { value: 0 }, uAspect: { value: 1 },
      uTanHalf: { value: Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.vfov) / 2) }, uIor: { value: s.ior }, uRays: { value: s.rays },
      uTitleK: { value: 0 }, uTitleLift: { value: 0 }, uDark: { value: 0 },
      uSun: { value: new THREE.Vector3(...s.sun).normalize() }, uWater: { value: col(s.water) }, uDeep: { value: col(s.deep) },
      uSky: { value: col(s.sky) }, uZenith: { value: col(s.zenith) }, uSunColor: { value: new THREE.Vector3(...s.sunColor) },
      uTitleColor: { value: new THREE.Vector3(...s.titleColor) }, uTitle: { value: titleTexture }, uManta: { value: new THREE.Vector4(0, 0, 1, 0) },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: SURFACE_FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** Title texture sized to the screen: DEEP over SEA, left aligned, low on the page. */
function createTitleTexture() {
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  function draw(W, H) {
    const scale = Math.min(1, 1600 / Math.max(W, H));
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    const g = canvas.getContext('2d'), cw = canvas.width, ch = canvas.height;
    g.clearRect(0, 0, cw, ch);
    const portrait = ch > cw;
    const gutter = Math.max(16 * scale, cw * 0.04);
    const words = CONFIG.surface.title.split(' ');
    g.font = CONFIG.surface.font;
    const widest = Math.max(...words.map((w) => g.measureText(w).width));
    const target = (cw - gutter * 2) * (portrait ? 1 : 0.78);
    const size = 400 * target / widest;
    g.font = CONFIG.surface.font.replace('400px', `${size.toFixed(1)}px`);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    const lh = size * 0.9, base = ch * (portrait ? 0.8 : 0.86);
    words.forEach((w, i) => g.fillText(w, gutter - size * 0.04, base - (words.length - 1 - i) * lh));
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

function initSurface(gfx) {
  const s = CONFIG.surface;
  const title = createTitleTexture();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = createSurfaceQuad(title.tex);
  scene.add(quad);
  const u = quad.material.uniforms;
  gfx.onResize((W, H) => {
    title.draw(W, H);
    u.uAspect.value = W / H;
    const vfov = W / H < 1 ? 74 : CONFIG.camera.vfov;
    u.uTanHalf.value = Math.tan(THREE.MathUtils.degToRad(vfov) / 2);
  });
  return {
    id: 'surface', scene, camera, surfaceTitle: title,
    update(p, time) {
      u.uTime.value = time;
      const e = Math.pow(p, 1.25);
      u.uDepth.value = lerp(s.depth[0], s.depth[1], e);
      u.uPitch.value = lerp(s.pitch[0], s.pitch[1], smooth(seg(p, 0.12, 1))) + look.y * CONFIG.look.pitch;
      u.uYaw.value = -look.x * CONFIG.look.yaw * 1.5;
      u.uTitleK.value = 1 - smooth(seg(p, s.titleOut[0], s.titleOut[1]));
      u.uTitleLift.value = smooth(seg(p, 0.04, s.titleOut[1])) * 0.35;
      u.uDark.value = smooth(seg(p, 0.55, 1)) * 0.35;
      u.uRays.value = s.rays * (1 + vel.k * 0.3);
      const mk = seg(p, s.manta.span[0], s.manta.span[1]);
      u.uManta.value.set(lerp(s.manta.from[0], s.manta.to[0], mk), lerp(s.manta.from[1], s.manta.to[1], mk) + Math.sin(time * 0.4) * 0.01,
        s.manta.scale * (u.uAspect.value < 1 ? 1.6 : 1), mk > 0 && mk < 1 ? s.manta.opacity : 0);
    },
    render(renderer) { renderer.render(scene, camera); },
  };
}
