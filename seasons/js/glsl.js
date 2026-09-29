/* SEASONS shared shader uniforms and GLSL helpers. Every material points at the same uniform objects. */
const U = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector3(0.3, 0, 0.1) },
  uGust: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uHemiSky: { value: new THREE.Color(0.5, 0.6, 0.7) },
  uHemiGround: { value: new THREE.Color(0.3, 0.3, 0.2) },
  uSnow: { value: 0 },
  uSnowCol: { value: new THREE.Color(CONFIG.snowColor) },
  uWet: { value: 0 },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
  uShadowOn: { value: 0 },
  uWindowGlow: { value: 0 },
  uWindowPos: { value: new THREE.Vector3() },
  uWindowCol: { value: new THREE.Color(CONFIG.light.window) },
  /* season state, written once per frame by applySeason() */
  uGrow: { value: 0 }, uAutumn: { value: 0 }, uFall: { value: 0 },
  uBud: { value: 0 }, uBloom: { value: 0 }, uShed: { value: 0 }, uPetal: { value: 0 },
  uPetalGround: { value: 0 }, uLitter: { value: 0 }, uFlowers: { value: 0 },
  uGrass: { value: new THREE.Color() }, uGrassTip: { value: new THREE.Color() },
  uRain: { value: 0 }, uSnowFall: { value: 0 }, uFire: { value: 0 }, uNight: { value: 0 },
  uCamTarget: { value: new THREE.Vector3() },
};

const f3 = (v) => v.toFixed(4);

const GLSL_COMMON = /* glsl */ `
#define HILL_H ${f3(CONFIG.hill.h)}
#define HILL_S ${f3(CONFIG.hill.s)}
uniform float uTime;
uniform vec3 uWind;
uniform float uGust;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform float uSnow;
uniform vec3 uSnowCol;
uniform float uWet;
uniform float uWindowGlow;
uniform vec3 uWindowPos;
uniform vec3 uWindowCol;
uniform float uGrow, uAutumn, uFall, uBud, uBloom, uShed, uPetal, uPetalGround, uLitter, uFlowers;
uniform vec3 uGrass, uGrassTip;
uniform float uRain, uSnowFall, uFire, uNight;
uniform vec3 uCamTarget;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), u.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float hillH(vec2 xz) { float r = length(xz) / HILL_S; return HILL_H * exp(-r * r * r); }

/* branch sway: stronger for flexible wood, phase shifts across the crown so it ripples */
vec3 swayOffset(vec3 p, float flex) {
  float ph = dot(p.xz, vec2(.23, .17)) + p.y * .11;
  float s = sin(uTime * 1.25 + ph) * .6 + sin(uTime * 2.6 + ph * 1.7) * .28 + sin(uTime * 5.1 + ph * 3.1) * .12;
  float strength = length(uWind) * .55 + uGust;
  vec3 w = uWind + vec3(1e-4, 0., 0.);
  return (w * (.55 + .45 * s) * .55 + normalize(w) * uGust * (.35 + .3 * s)) * flex + vec3(0., -abs(s) * .05 * strength * flex, 0.);
}

/* warm light from the cottage window, a soft falloff for nearby surfaces */
vec3 windowLight(vec3 wp) {
  float d = distance(wp, uWindowPos);
  return uWindowCol * uWindowGlow * 2.2 / (1. + d * d * .35);
}
`;

/* manual shadow lookup for custom shaders: packed depth from the sun's shadow map, 3x3 PCF */
const GLSL_SHADOW = /* glsl */ `
uniform sampler2D uShadowMap;
uniform vec2 uShadowTexel;
uniform float uShadowOn;
float shadowAt(vec4 sc, float bias) {
  vec3 c = sc.xyz / sc.w;
  if (uShadowOn < .5 || c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1. || c.z > 1.) return 1.;
  float s = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    float d = unpackRGBAToDepth(textureLod(uShadowMap, c.xy + vec2(float(i), float(j)) * uShadowTexel * 1.4, 0.));
    s += step(c.z - bias, d);
  }
  return s / 9.;
}
`;

/* simple lit colour for card-like foliage: hemisphere + sun + translucency, with shadow and window glow */
const GLSL_FOLIAGE_LIGHT = /* glsl */ `
vec3 foliageLight(vec3 albedo, vec3 N, float ao, float sh, float trans, vec3 wp) {
  float ndl = dot(N, uSunDir);
  vec3 hemi = mix(uHemiGround, uHemiSky, N.y * .5 + .5);
  vec3 lit = hemi * ao * 1.35 + uSunCol * (max(ndl, 0.) + max(-ndl, 0.) * trans) * sh;
  return albedo * lit * ${f3(1 / Math.PI)} + albedo * windowLight(wp) * .35;
}
`;

/** Adds the common helpers and sway to a built-in material (bark, house). */
let patchSerial = 0;
function patchStandard(material, { sway = false, snow = false, colorCode = '' } = {}) {
  /* three caches programs by onBeforeCompile source; every patch variant needs its own key */
  const key = `seasons-${patchSerial++}-${sway}-${snow}`;
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${sway ? 'attribute float aFlex;' : ''}\nvarying vec3 vWP;\nvarying vec3 vWN;`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);\n${sway ? 'transformed += swayOffset(position, aFlex);' : ''}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec3 vWP;\nvarying vec3 vWN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${colorCode}
        ${snow ? `float snowN = fbm(vWP.xz * 2.1 + vWP.y * 1.3) * .5 + vnoise(vWP.xz * 9.) * .12;
        float snowM = smoothstep(.97 - uSnow * .75, 1.05 - uSnow * .5, vWN.y + (snowN - .3) * .45) * step(.01, uSnow);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol, snowM);` : ''}
        diffuseColor.rgb *= mix(1., ${f3(CONFIG.wetDark)}, uWet * .6);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * windowLight(vWP) * .3;');
  };
  return material;
}

/** Depth material for shadows of swaying bark, so shadows follow the wind. */
function swayDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nattribute float aFlex;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + swayOffset(position, aFlex);');
  };
  return m;
}

/** Fog uniforms a custom ShaderMaterial needs when `fog: true`. */
const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
