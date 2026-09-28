/* ───────── 04 liquid type: extruded chrome letters that drip in the vertex shader, driven by progress and scroll speed ───────── */
// Drip columns come from the same function in GLSL and JS, so falling drops leave from the tips of the drips.
const dripColumn = (x) => Math.pow(.5 + .5 * Math.sin(x * 5.3 + 1.7) * Math.sin(x * 2.1 + 4), 3);
const MELT_HEAD = `
#define DRIP_BASE ${CONFIG.melt.dripBase.toFixed(3)}
#define DRIP_GAIN ${CONFIG.melt.dripColGain.toFixed(3)}
uniform float uMelt, uWobble, uTime, uTop, uBottom;
float dripColumn(float x) { return pow(.5 + .5 * sin(x * 5.3 + 1.7) * sin(x * 2.1 + 4.), 3.); }`;
const MELT_VERTEX = `
vec3 transformed = vec3(position);
float mh = clamp((uTop - transformed.y) / (uTop - uBottom), 0., 1.);
float col = dripColumn(transformed.x);
transformed.y -= uMelt * mh * mh * (DRIP_BASE + DRIP_GAIN * col);
transformed.x += sin(transformed.y * 3. + uTime * 2.) * uWobble * mh * .12;
transformed.z *= 1. + uMelt * mh * .25 * col;`;

function initMelt(stage, env) {
  const cfg = CONFIG.melt, pin = $('#melt-pin'), kor = $('#melt-kor');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(cfg.fov, 1, .1, 100);
  const uniforms = { uMelt: { value: 0 }, uWobble: { value: 0 }, uTime: { value: 0 }, uTop: { value: 1 }, uBottom: { value: 0 } };
  const material = chromeMaterial(env, { roughness: cfg.roughness, iridescence: .35, iridescenceIOR: 1.5, iridescenceThicknessRange: [150, 500] });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${MELT_HEAD}`).replace('#include <begin_vertex>', MELT_VERTEX);
  };
  const group = new THREE.Group();
  scene.add(group);
  const dropGeo = new THREE.SphereGeometry(1, 24, 16);
  const drops = new THREE.InstancedMesh(dropGeo, chromeMaterial(env, { roughness: .03 }), cfg.drops);
  drops.frustumCulled = false;
  group.add(drops);
  const rnd = mulberry32(3), dummy = new THREE.Object3D();
  let text = null, bounds = null, dropDefs = [], prog = 0, on = false;
  const spring = { x: 0, v: 0 };

  new FontLoader().load(cfg.fontUrl, (font) => {
    let geo = new TextGeometry(cfg.word, { font, size: cfg.size, height: cfg.depth, curveSegments: cfg.curveSegments,
      bevelEnabled: true, bevelThickness: cfg.bevelThickness, bevelSize: cfg.bevelSize, bevelSegments: cfg.bevelSegments });
    geo.center();
    geo = new TessellateModifier(cfg.tessEdge, cfg.tessIterations).modify(geo);
    geo.computeBoundingBox();
    bounds = geo.boundingBox;
    uniforms.uTop.value = bounds.max.y; uniforms.uBottom.value = bounds.min.y;
    text = new THREE.Mesh(geo, material);
    text.frustumCulled = false;
    group.add(text);
    // Drops leave from the strongest drip columns.
    const xs = Array.from({ length: 200 }, (_, i) => lerp(bounds.min.x, bounds.max.x, i / 199)).filter((x) => dripColumn(x) > .45);
    dropDefs = Array.from({ length: cfg.drops }, () => ({ x: xs[Math.floor(rnd() * xs.length)], start: lerpR(cfg.dropStart, rnd()), size: lerpR(cfg.dropSize, rnd()) }));
    stage.markDirty();
  }, undefined, (e) => console.error('MELT font failed to load', e));

  const resize = (W, H) => { camera.aspect = W / H; camera.position.set(0, 0, fitDistance(camera, cfg.camDist, cfg.portraitFit)); camera.updateProjectionMatrix(); };
  const layoutDrops = (p, melt) => {
    dropDefs.forEach((d, i) => {
      const local = (p - d.start) / cfg.dropLife, visible = local > 0 && local < 1.8 && melt > .2;
      const tip = bounds.min.y - melt * (cfg.dripBase + cfg.dripColGain * dripColumn(d.x));
      const form = smooth(clamp01(local / .25));
      dummy.position.set(d.x, tip - Math.max(0, local - .25) ** 2 * cfg.dropFall, 0);
      dummy.scale.set(d.size * form, d.size * form * (1 + (1 - form) * 1.5), d.size * form);
      if (!visible) dummy.scale.setScalar(1e-4);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
  };
  const draw = (time) => {
    if (!text) return;
    const p = reduce ? .4 : prog;
    const base = cfg.meltMax * smooth(segR(p, cfg.meltIn)) * (1 - smooth(segR(p, cfg.meltOut)));
    const s = Math.min(1, Math.abs(spring.x));
    const melt = base + s * cfg.dripGain;
    uniforms.uMelt.value = reduce ? cfg.meltMax * .45 : melt;
    uniforms.uWobble.value = reduce ? 0 : .15 + s * cfg.wobbleGain;
    uniforms.uTime.value = reduce ? 0 : time;
    group.scale.setScalar(1.5);
    group.position.y = cfg.lift;
    group.rotation.y = Math.sin(p * Math.PI * 2) * cfg.turns + tilt.x * cfg.tiltYaw;
    group.rotation.x = tilt.y * cfg.tiltPitch - .08;
    layoutDrops(p, uniforms.uMelt.value);
    stage.renderer.render(scene, camera);
  };
  const mode = stage.add({ pin, draw, resize });
  track('#s-melt', (p) => { prog = p; showBy(kor, p, cfg.kor, 0, -3); stage.markDirty(); }, (v) => { on = v; mode.on = v; stage.markDirty(); });
  if (reduce) return;
  gsap.ticker.add(() => {
    if (!on) return;
    const target = clamp(velocity() * cfg.velGain, -1, 1);
    spring.v += (target - spring.x) * cfg.stiffness;
    spring.v *= cfg.damping;
    spring.x += spring.v;
  });
}
