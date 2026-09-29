/* SEASONS timeline: scroll state -> year clock -> every season uniform, light and sky colour. */
const TAU = Math.PI * 2;
const wrap4 = (t) => ((t % 4) + 4) % 4;

/** Foliage and ground state along the year clock. */
function yearState(t) {
  const Y = CONFIG.year, tt = wrap4(t);
  return {
    /* buds start swelling before the clock wraps, so measure them on a clock shifted into late winter */
    bud: smooth(seg(tt > 3.5 ? tt - 4 : tt, Y.bud[0], Y.bud[1])) * (tt < 2 || tt > 3.5 ? 1 : 0),
    bloom: smooth(seg(tt, Y.bloom[0], Y.bloom[1])),
    shed: smooth(seg(tt, Y.shed[0], Y.shed[1])),
    petal: plateau(tt, Y.petal),
    /* fallen leaves rot away under the snow, so they are gone before it melts */
    grow: smooth(seg(tt, Y.leaf[0], Y.leaf[1])) * (1 - smooth(seg(tt, 3.5, 3.78))),
    autumn: smooth(seg(tt, Y.autumn[0], Y.autumn[1])),
    fall: seg(tt, Y.fall[0], Y.fall[1]),
    snow: smooth(seg(tt, Y.snowIn[0], Y.snowIn[1])) * (1 - smooth(seg(tt, Y.snowOut[0], Y.snowOut[1]))),
    flowers: plateau(tt, Y.flowers),
    petalGround: plateau(tt, [0.55, 0.8, 0.95, 1.15]),
    litter: plateau(tt, [2.45, 3.0, 3.5, 3.8]),
    snowFall: plateau(tt, [3.1, 3.2, 3.62, 3.8]),
  };
}

/** Sky, sun and grass colours interpolated between the season keys. */
const SKY_KEYS = CONFIG.skyKeys.map(([t, zen, hor, sunC, el, gr, tip]) => ({
  t, zen: new THREE.Color(zen), hor: new THREE.Color(hor), sun: new THREE.Color(sunC), el, grass: new THREE.Color(gr), tip: new THREE.Color(tip),
}));
function skyAt(t) {
  const tt = wrap4(t);
  let k = 0;
  while (k < SKY_KEYS.length - 2 && tt > SKY_KEYS[k + 1].t) k++;
  const a = SKY_KEYS[k], b = SKY_KEYS[k + 1], m = smooth(seg(tt, a.t, b.t));
  return {
    zen: a.zen.clone().lerp(b.zen, m), hor: a.hor.clone().lerp(b.hor, m), sun: a.sun.clone().lerp(b.sun, m),
    el: lerp(a.el, b.el, m), grass: a.grass.clone().lerp(b.grass, m), tip: a.tip.clone().lerp(b.tip, m),
  };
}

const RAIN = { zen: new THREE.Color(CONFIG.rainSky.zenith), hor: new THREE.Color(CONFIG.rainSky.horizon) };
const DUSK = { zen: new THREE.Color(CONFIG.duskSky.zenith), hor: new THREE.Color(CONFIG.duskSky.horizon), sun: new THREE.Color(CONFIG.duskSky.sun) };
const NIGHT = { zen: new THREE.Color(CONFIG.nightSky.zenith), hor: new THREE.Color(CONFIG.nightSky.horizon), moon: new THREE.Color(CONFIG.nightSky.moon) };

/** Scene overlays (rain, dusk, night, birds) on top of the year clock. */
function overlays(id, p) {
  const O = CONFIG.overlay;
  const o = { rain: 0, wet: 0, dusk: 0, night: 0, fire: 0, snowFall: 0, arrive: 0, leave: 0, montage: 0 };
  if (id === 'spring') o.arrive = seg(p, ...O.birdsIn);
  if (id === 'summer') {
    o.arrive = 1;
    o.rain = plateau(p, O.summerRain);
    o.wet = plateau(p, O.summerWet);
    o.dusk = smooth(seg(p, ...O.summerDusk));
    o.fire = smooth(seg(p, ...O.fireflies));
  }
  if (id === 'autumn') {
    o.arrive = 1;
    o.leave = seg(p, ...O.birdsOut);
    o.dusk = 1 - smooth(seg(p, ...O.autumnDuskOut));
    o.fire = o.dusk * o.dusk;
  }
  if (id === 'winter') {
    o.snowFall = plateau(p, O.winterSnow);
    o.night = smooth(seg(p, ...O.winterNight));
  }
  if (id === 'year') {
    o.night = 1 - smooth(seg(p, ...O.yearNightOut));
    o.montage = plateau(p, [0, CONFIG.yearCam.blendIn, CONFIG.yearCam.blendOut, 1]);
  }
  if (id === 'finale') o.arrive = seg(p, ...O.finaleBirds);
  return o;
}

const CONFIG_SNOW = new THREE.Color(CONFIG.snowColor);
const yearPush = spring(CONFIG.velocity.stiffness, CONFIG.velocity.damping);
const env = { t: 0, montage: 0, night: 0 };
const tmpDir = new THREE.Vector3();

/** Writes the whole season into uniforms, lights and sky. */
function applySeason(st) {
  const [t0, t1] = CONFIG.sceneYear[st.id];
  const o = overlays(st.id, st.world);
  const V = CONFIG.velocity;
  const push = yearPush.step(reduce ? 0 : clamp(Math.abs(velocity()) * V.yearPush, 0, V.yearPushMax) * o.montage);
  const t = lerp(t0, t1, st.world) + push;
  const y = yearState(t), s = skyAt(t);
  env.t = t; env.montage = o.montage; env.night = o.night;

  U.uBud.value = y.bud; U.uBloom.value = y.bloom; U.uShed.value = y.shed; U.uPetal.value = y.petal;
  U.uGrow.value = y.grow; U.uAutumn.value = y.autumn; U.uFall.value = y.fall;
  U.uSnow.value = y.snow; U.uFlowers.value = y.flowers; U.uPetalGround.value = y.petalGround; U.uLitter.value = y.litter;
  U.uSnowFall.value = Math.max(o.snowFall, st.id === 'year' ? y.snowFall : 0);
  U.uRain.value = o.rain; U.uWet.value = o.wet; U.uFire.value = o.fire; U.uNight.value = o.night;

  /* sky: season key, then rain, dusk and night on top */
  const zen = s.zen.clone().lerp(RAIN.zen, o.rain * 0.85).lerp(DUSK.zen, o.dusk).lerp(NIGHT.zen, o.night);
  const hor = s.hor.clone().lerp(RAIN.hor, o.rain * 0.85).lerp(DUSK.hor, o.dusk).lerp(NIGHT.hor, o.night);
  SKY.uZen.value.copy(zen); SKY.uHor.value.copy(hor);
  PUDDLE.uZen.value.copy(zen); PUDDLE.uHor.value.copy(hor);
  scene.fog.color.copy(hor);
  scene.fog.near = lerp(30, 18, o.rain);
  scene.fog.far = lerp(210, 110, o.rain) * lerp(1, 0.7, o.night);

  /* sun: season elevation, sweeping round during the montage, low and behind the tree at dusk */
  const sunAz = 0.9 + (st.id === 'year' ? (t - t0) * Math.PI : 0);
  const el = lerp(lerp(s.el, CONFIG.duskSky.el, o.dusk), CONFIG.nightSky.el, o.night);
  const az = lerp(sunAz, 0.05, o.dusk);
  tmpDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  U.uSunDir.value.copy(tmpDir);
  const sunCol = s.sun.clone().lerp(DUSK.sun, o.dusk).lerp(NIGHT.moon, o.night);
  const L = CONFIG.light;
  const sunI = lerp(L.sun * (1 - o.rain * CONFIG.rainSky.dim * 2) * lerp(1, 0.75, o.dusk), L.moon, o.night);
  sun.color.copy(sunCol); sun.intensity = sunI;
  sun.position.copy(sun.target.position).addScaledVector(tmpDir, 50);
  U.uSunCol.value.copy(sunCol).multiplyScalar(sunI);

  const hemiSky = zen.clone().lerp(hor, 0.45).lerp(new THREE.Color(1, 1, 1), 0.25 * (1 - o.night));
  const hemiGround = s.grass.clone().multiplyScalar(0.55).lerp(CONFIG_SNOW, y.snow * 0.8);
  const hemiI = lerp(L.hemi, L.hemiNight, o.night) * lerp(1, 0.8, o.dusk);
  hemi.color.copy(hemiSky); hemi.groundColor.copy(hemiGround); hemi.intensity = hemiI;
  U.uHemiSky.value.copy(hemiSky).multiplyScalar(hemiI);
  U.uHemiGround.value.copy(hemiGround).multiplyScalar(hemiI);

  SKY.uSunDisc.value.copy(sunCol).multiplyScalar((1 - o.rain * 0.9) * (1 - o.night * 0.85));
  SKY.uGlow.value = lerp(1, 1.8, o.dusk);
  SKY.uCloud.value = clamp(lerp(wrap4(t) > 1 && wrap4(t) < 2 ? 0.52 : 0.4, 0.95, o.rain) - o.night * 0.25, 0, 1);
  SKY.uCloudLit.value.set(1, 1, 1).lerp(DUSK.sun, o.dusk * 0.7).lerp(NIGHT.hor, o.night).lerp(RAIN.hor, o.rain * 0.7);
  SKY.uCloudShade.value.copy(hor).multiplyScalar(0.72).lerp(RAIN.zen, o.rain * 0.8);
  SKY.uStars.value = Math.max(o.night, o.dusk * 0.12);

  /* skip both render passes for anything the season has switched off */
  blossoms.mesh.visible = y.bud > 0 || (y.bloom > 0 && y.shed < 1);
  petals.visible = y.petal > 0;
  leaves.visible = y.grow > 0;
  rain.visible = o.rain > 0;
  snowfall.visible = U.uSnowFall.value > 0;
  fireflies.visible = o.fire > 0;
  for (const m of puddles) m.visible = o.wet > 0;

  U.uGrass.value.copy(s.grass); U.uGrassTip.value.copy(s.tip);
  house.set(smooth(seg(o.night, 0.25, 0.8)) + o.dusk * 0.55);
  birds.update(o.arrive, st.id === 'year' ? 1 : o.leave, U.uTime.value);
  return o;
}
