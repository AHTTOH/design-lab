/* VHS glass: a full-page WebGL layer over the picture and the type. It samples nothing (no video, no image textures),
   so file:// cannot taint it. It paints what a tube adds on top: scanlines bent by a barrel curve, the dark curved
   bezel, vignette, a glass reflection, static and the tracking band. */
'use strict';

const CRT = {
  scan: 0.3,          // scanline darkness at rest
  scanPx: 3,          // CSS px per scanline
  curve: 0.05,        // barrel strength; the edges it pushes past the tube become bezel
  corner: 0.1,        // bezel corner radius, share of height
  vignette: 0.55,
  reflect: 0.06,
  hum: 0.05,          // slow rolling hum bar
  staticPx: 2,        // CSS px per static grain
  bezel: [0.004, 0.005, 0.012],
};

const CRT_VS = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0., 1.); }`;
const CRT_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime, uDpr;
uniform float uStatic, uBand, uBandY, uScan, uScanPx, uCurve, uCorner, uVig, uReflect, uHum, uStaticPx, uDim;
uniform vec3 uBezel;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void over(inout vec4 d, vec3 c, float a) { a = clamp(a, 0., 1.); d.rgb = c * a + d.rgb * (1. - a); d.a = a + d.a * (1. - a); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 c = uv * 2. - 1.;
  vec2 cb = c * (1. + uCurve * dot(c, c));
  float by = cb.y * .5 + .5;
  vec4 o = vec4(0.);

  // The per-frame offset stays small (fract) so the hash keeps its precision; large offsets turned grain into stripes.
  vec2 cell = floor(gl_FragCoord.xy / (uStaticPx * uDpr));
  float grain = hash(cell * .0137 + fract(uTime * 7.31) * vec2(3.17, 7.91));
  over(o, vec3(grain * .9, grain * .95, grain), uStatic * (.55 + .45 * grain));

  float row = floor(gl_FragCoord.y / (2. * uDpr));
  float band = smoothstep(.08, 0., abs(by - uBandY));
  float streak = step(.5, hash(vec2(row * .0213, fract(uTime * 3.7))));
  over(o, vec3(.9, .95, 1.), uBand * band * (.12 + .55 * streak * grain));

  over(o, vec3(0.), uDim);

  float lines = uRes.y / (uScanPx * uDpr);
  float s = .5 + .5 * cos(by * lines * 6.2831853);
  over(o, vec3(0.), uScan * s);
  over(o, vec3(0.), uHum * (.5 + .5 * sin(by * 6.2831853 - uTime * .8)));

  vec2 vq = cb * vec2(.92, 1.);
  float v = dot(vq, vq);
  over(o, vec3(0.), uVig * v * v * .55);

  float r = smoothstep(1., 0., length((c - vec2(-.5, .62)) * vec2(1., 1.7)));
  over(o, vec3(.8, .88, 1.), uReflect * r * r);

  vec2 p = cb * vec2(aspect, 1.);
  vec2 q = abs(p) - vec2(aspect, 1.) + uCorner;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uCorner;
  float px = 2. / uRes.y;
  over(o, uBezel, smoothstep(-px, px, d));
  over(o, vec3(.25, .3, .4), .18 * smoothstep(-6. * px, 0., d) * (1. - smoothstep(0., px, d)));
  gl_FragColor = o;
}`;

function createCRT(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) { console.error('VHS: WebGL is unavailable, the CRT glass (scanlines, static, curvature) is off'); return null; }
  const compile = (type, srcText) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, srcText); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('VHS glass shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, CRT_VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, CRT_FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('VHS glass link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  ['uRes', 'uTime', 'uDpr', 'uStatic', 'uBand', 'uBandY', 'uScan', 'uScanPx', 'uCurve', 'uCorner', 'uVig', 'uReflect', 'uHum', 'uStaticPx', 'uDim', 'uBezel']
    .forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });

  let dpr = 1, dirty = true;
  const fit = () => {
    dpr = dprNow();
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    dirty = true;
  };
  addEventListener('resize', fit);
  if (reduce) addEventListener('scroll', () => { dirty = true; }, { passive: true });
  fit();

  /** fx: the FX request object from core.js. */
  function frame(time, fx) {
    if (reduce && !dirty) return;
    dirty = false;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, reduce ? 0 : time);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uStatic, fx.static);
    gl.uniform1f(u.uBand, fx.band);
    gl.uniform1f(u.uBandY, 1 - fx.bandY);  // fx is top-down, gl_FragCoord is bottom-up
    gl.uniform1f(u.uScan, CRT.scan + fx.scan);
    gl.uniform1f(u.uScanPx, CRT.scanPx);
    gl.uniform1f(u.uCurve, CRT.curve);
    gl.uniform1f(u.uCorner, CRT.corner);
    gl.uniform1f(u.uVig, CRT.vignette);
    gl.uniform1f(u.uReflect, CRT.reflect);
    gl.uniform1f(u.uHum, reduce ? 0 : CRT.hum);
    gl.uniform1f(u.uStaticPx, CRT.staticPx);
    gl.uniform1f(u.uDim, fx.dim);
    gl.uniform3fv(u.uBezel, CRT.bezel);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { frame, markDirty: () => { dirty = true; } };
}
