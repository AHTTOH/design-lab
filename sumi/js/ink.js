/* Scene 1: WebGL2 ink on wet hanji. Stable fluids for the push, a paper-guided bleed pass for the slow soak,
   and a display pass that turns density into grey washes with darker drying edges. */

const INK_VS = `#version 300 es
in vec2 aPos; uniform vec2 texel; out vec2 vUv, vL, vR, vT, vB;
void main(){ vUv=aPos*.5+.5; vL=vUv-vec2(texel.x,0.); vR=vUv+vec2(texel.x,0.); vT=vUv+vec2(0.,texel.y); vB=vUv-vec2(0.,texel.y); gl_Position=vec4(aPos,0.,1.); }`;
const INK_HEAD = '#version 300 es\nprecision highp float; precision highp sampler2D; in vec2 vUv, vL, vR, vT, vB; out vec4 o;\n';
const INK_FS = {
  splat: `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
    void main(){ vec2 p=vUv-point; p.x*=aspect; o=vec4(texture(uTarget,vUv).xyz+exp(-dot(p,p)/radius)*color,1.); }`,
  advect: `uniform sampler2D uVelocity, uSource; uniform vec2 texel; uniform float dt, dissipation;
    void main(){ vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texel; o=texture(uSource,c)/(1.+dissipation*dt); o.a=1.; }`,
  divergence: `uniform sampler2D uVelocity;
    void main(){ float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x, T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y; vec2 C=texture(uVelocity,vUv).xy;
      if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
  curl: `uniform sampler2D uVelocity;
    void main(){ float L=texture(uVelocity,vL).y, R=texture(uVelocity,vR).y, T=texture(uVelocity,vT).x, B=texture(uVelocity,vB).x; o=vec4(.5*(R-L-T+B),0.,0.,1.); }`,
  vorticity: `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
    void main(){ float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x, T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;
      vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=curl*C; f.y*=-1.;
      o=vec4(clamp(texture(uVelocity,vUv).xy+f*dt,-1000.,1000.),0.,1.); }`,
  pressure: `uniform sampler2D uPressure, uDivergence;
    void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
      o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*.25,0.,0.,1.); }`,
  gradient: `uniform sampler2D uPressure, uVelocity;
    void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
      o=vec4(texture(uVelocity,vUv).xy-vec2(R-L,T-B),0.,1.); }`,
  scale: `uniform sampler2D uTexture; uniform float value; void main(){ o=value*texture(uTexture,vUv); }`,
  // Ink creeps from wet to dry along the fibres: diffusion rate follows the paper texture.
  bleed: `uniform sampler2D uTexture, uPaper; uniform float rate; uniform vec2 paperScale;
    void main(){ float C=texture(uTexture,vUv).r, L=texture(uTexture,vL).r, R=texture(uTexture,vR).r, T=texture(uTexture,vT).r, B=texture(uTexture,vB).r;
      float fib=1.-texture(uPaper,vUv*paperScale).r; float k=rate*(.55+fib*6.);
      float avg=(L+R+T+B)*.25; o=vec4(C+(avg-C)*min(k,.9),0.,0.,1.); }`,
  // Wet ink has a crisp, ragged boundary (threshold jittered by noise and fibres), a darker rim where it dries,
  // and a faint grey halo that has crept past the edge.
  display: `uniform sampler2D uTexture, uPaper; uniform float gain, edge, fiber, wash, th; uniform vec2 paperScale, px;
    float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
    void main(){ float d=texture(uTexture,vUv).r;
      float fib=1.-texture(uPaper,vUv*paperScale).r;
      vec2 q=vUv*px; float n=vn(q/7.)*.3+vn(q/26.)*.3+vn(q/80.)*.28+vn(q/2.5)*.12;
      float t=th*(.35+n*1.3)-fib*.02;
      float body=smoothstep(t,t+.012,d);
      float pool=.72+.5*vn(q/48.+3.)*vn(q/13.+7.);
      float tone=1.-exp(-d*gain*pool*(1.+fib*fiber));
      float ring=body*(1.-smoothstep(t,t+edge,d))*.32;
      float halo=(1.-exp(-d*gain*.6))*.14*(.6+n*.8);
      float ink=clamp(max(halo,body*(.42+.58*tone))+ring,0.,1.)*(1.-wash);
      o=vec4(vec3(1.-ink*.97)*(1.-fib*.18),1.); }`,
};

function createInk(canvas, cfg, paperImg) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL2 context unavailable');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable, cannot render to half-float targets');

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const vs = compile(gl.VERTEX_SHADER, INK_VS);
  const programs = Object.fromEntries(Object.entries(INK_FS).map(([name, body]) => {
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, INK_HEAD + body));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`ink program ${name}: ${gl.getProgramInfoLog(p)}`);
    const u = {}; for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return [name, { p, u }];
  }));

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const paper = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, paper);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paperImg);
  [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));

  const target = (w, h) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('ink framebuffer incomplete');
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h, texel: [1 / w, 1 / h] };
  };
  const doubleTarget = (w, h) => { const d = { read: target(w, h), write: target(w, h), swap() { [d.read, d.write] = [d.write, d.read]; } }; return d; };
  const gridSize = (res) => { const a = canvas.width / canvas.height, lo = Math.round(res), hi = Math.round(res * Math.max(a, 1 / a)); return a > 1 ? [hi, lo] : [lo, hi]; };

  let vel, dye, pres, div, curlT;
  const alloc = () => {
    const [sw, sh] = gridSize(cfg.simRes), [dw, dh] = gridSize(isNarrow() ? cfg.dyeResMobile : cfg.dyeRes);
    vel = doubleTarget(sw, sh); pres = doubleTarget(sw, sh); div = target(sw, sh); curlT = target(sw, sh); dye = doubleTarget(dw, dh);
  };
  const fit = () => { const d = dprNow(); canvas.width = Math.round(innerWidth * d); canvas.height = Math.round(innerHeight * d); alloc(); };
  fit();
  const paperScale = () => [innerWidth / cfg.paperTile, innerHeight / cfg.paperTile];

  let unit = 0;
  const use = (name) => { const prog = programs[name]; gl.useProgram(prog.p); unit = 0; return prog.u; };
  const tex = (loc, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex ?? t); gl.uniform1i(loc, unit++); };
  const blit = (dst) => {
    if (dst) { gl.viewport(0, 0, dst.w, dst.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); }
    else { gl.viewport(0, 0, canvas.width, canvas.height); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const splatInto = (t, x, y, r, c) => {
    const u = use('splat');
    gl.uniform1f(u.aspect, canvas.width / canvas.height); gl.uniform2f(u.point, x, y); gl.uniform1f(u.radius, r); gl.uniform2fv(u.texel, t.read.texel);
    tex(u.uTarget, t.read); gl.uniform3f(u.color, c[0], c[1], c[2]); blit(t.write); t.swap();
  };

  /** x, y in uv (y up), radius in px, ink amount, push velocity in px/s. */
  function splat(x, y, px, amount, vx = 0, vy = 0) {
    const r = Math.pow(px / innerHeight, 2);
    if (vx || vy) splatInto(vel, x, y, r * 2.2, [vx, vy, 0]);
    splatInto(dye, x, y, r, [amount, 0, 0]);
  }

  function step(dt) {
    let u = use('curl'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uVelocity, vel.read); blit(curlT);
    u = use('vorticity'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uVelocity, vel.read); tex(u.uCurl, curlT); gl.uniform1f(u.curl, cfg.curl); gl.uniform1f(u.dt, dt); blit(vel.write); vel.swap();
    u = use('divergence'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uVelocity, vel.read); blit(div);
    u = use('scale'); gl.uniform2fv(u.texel, pres.read.texel); tex(u.uTexture, pres.read); gl.uniform1f(u.value, cfg.pressureDecay); blit(pres.write); pres.swap();
    for (let i = 0; i < cfg.pressureIters; i++) { u = use('pressure'); gl.uniform2fv(u.texel, pres.read.texel); tex(u.uPressure, pres.read); tex(u.uDivergence, div); blit(pres.write); pres.swap(); }
    u = use('gradient'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uPressure, pres.read); tex(u.uVelocity, vel.read); blit(vel.write); vel.swap();
    u = use('advect'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uVelocity, vel.read); tex(u.uSource, vel.read); gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, cfg.velocityDissipation); blit(vel.write); vel.swap();
    u = use('advect'); gl.uniform2fv(u.texel, vel.read.texel); tex(u.uVelocity, vel.read); tex(u.uSource, dye.read); gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, cfg.dyeDissipation); blit(dye.write); dye.swap();
    u = use('bleed'); gl.uniform2fv(u.texel, dye.read.texel); tex(u.uTexture, dye.read); tex(u.uPaper, paper); gl.uniform1f(u.rate, cfg.bleed); gl.uniform2fv(u.paperScale, paperScale()); blit(dye.write); dye.swap();
  }

  function render(wash) {
    const u = use('display');
    gl.uniform2fv(u.texel, dye.read.texel); tex(u.uTexture, dye.read); tex(u.uPaper, paper);
    gl.uniform1f(u.gain, cfg.gain); gl.uniform1f(u.edge, cfg.edge); gl.uniform1f(u.fiber, cfg.paperFiber); gl.uniform1f(u.wash, wash); gl.uniform1f(u.th, cfg.threshold); gl.uniform2fv(u.paperScale, paperScale()); gl.uniform2f(u.px, innerWidth, innerHeight);
    blit(null);
  }

  return { splat, step, render, fit };
}

{
  const cfg = CONFIG.ink, canvas = $('#ink');
  const title = $('#hero-title'), lineChars = charsOf('#hero-line'), titleChars = charsOf('#hero-title'), cue = $('#cue');
  let sim = null, visible = true, wash = 0, lastP = 0, dirty = true;

  // A drop lands: dye in the middle, a ring of outward pushes so it blooms instead of sitting as a dot.
  const drop = (d, gain = 1) => {
    if (!sim) return;
    const x = d.x, y = 1 - d.y, px = d.px * Math.min(1, innerWidth / 900 + 0.35);
    sim.splat(x, y, px, 1.4 * gain);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + d.x * 7, r = px / innerHeight * 0.5;
      sim.splat(x + Math.cos(a) * r * innerHeight / innerWidth, y + Math.sin(a) * r, px * 0.5, 0.12 * gain, Math.cos(a) * cfg.dropForce * gain, Math.sin(a) * cfg.dropForce * gain);
    }
    dirty = true;
  };

  const img = new Image();
  img.onload = () => {
    try { sim = createInk(canvas, cfg, img); }
    catch (e) { console.error('ink simulation disabled:', e); canvas.hidden = true; return; }
    cfg.intro.forEach((d) => drop(d, 0.8));
    if (reduce) {
      cfg.drops.slice(0, 5).forEach((d) => drop(d, 0.8));
      for (let i = 0; i < cfg.reduceSteps; i++) sim.step(1 / 30);
    }
    sim.render(wash);
    addEventListener('resize', () => { sim.fit(); cfg.intro.forEach((d) => drop(d, 0.8)); });
  };
  img.onerror = () => console.error('paper texture failed to load');
  img.src = TEX.paper;

  // The pointer is a wet brush: ink is laid along the path in small steps so fast strokes stay continuous.
  let last = null;
  canvas.addEventListener('pointermove', (e) => {
    if (!sim) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!last) { last = { x, y }; return; }
    const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
    const n = Math.min(24, Math.ceil(dist / cfg.brushStepPx));
    const thin = 1 / (1 + dist * 0.02);
    for (let i = 1; i <= n; i++) {
      const px = last.x + (dx * i) / n, py = last.y + (dy * i) / n;
      sim.splat(px / r.width, 1 - py / r.height, cfg.brushPx * (0.6 + thin * 0.8), cfg.brushInk * thin, (dx / Math.max(1, dist)) * cfg.brushForce * 0.2, (-dy / Math.max(1, dist)) * cfg.brushForce * 0.2);
    }
    last = { x, y }; dirty = true;
  });
  canvas.addEventListener('pointerleave', () => { last = null; });

  track('#s-ink', (p) => {
    // Scripted drops fall once as the reader scrolls forward past each mark.
    cfg.drops.forEach((d) => { if (!reduce && lastP < d.at && p >= d.at) drop(d); });
    lastP = p;
    wash = smooth(segR(p, cfg.wash)) * cfg.washMax;
    const out = smooth(segR(p, cfg.titleOut));
    title.style.opacity = 1 - out;
    title.style.filter = out > 0 ? `blur(${out * 14}px)` : 'none';
    title.style.letterSpacing = `${-0.04 + out * 0.3}em`;
    const k = segR(p, cfg.lineIn) * (1 - segR(p, cfg.lineOut));
    inkChars(lineChars, k);
    cue.style.opacity = 1 - seg(p, 0.005, 0.03);
    dirty = true;
  }, (on) => { visible = on; });

  if (!reduce) gsap.from(titleChars, { opacity: 0, filter: 'blur(18px)', scale: 1.08, stagger: 0.35, duration: 2.2, ease: 'power2.out', delay: 0.2 });

  gsap.ticker.add((time, deltaMs) => {
    if (!sim || !visible) return;
    if (reduce) { if (dirty) { sim.step(1 / 60); sim.render(wash); dirty = false; } return; }
    const v = velocity();
    if (Math.abs(v) > 2) sim.splat(Math.random(), Math.random(), 220, 0, 0, -Math.sign(v) * Math.min(Math.abs(v), cfg.scrollVelCap) * cfg.scrollForce);
    sim.step(Math.min(deltaMs / 1000, cfg.maxDt));
    sim.render(wash);
  });
}
