/* SEASONS camera: keyed orbit poses per scene, a velocity-driven spin during the year montage. */
const spinVel = spring(CONFIG.velocity.stiffness, CONFIG.velocity.damping);
let spinOffset = 0;

/** Interpolated pose [p, tx, ty, tz, az, el, dist, fov] from a key list. */
function poseAt(keys, p) {
  let k = 0;
  while (k < keys.length - 2 && p > keys[k + 1][0]) k++;
  const a = keys[k], b = keys[k + 1], m = smooth(seg(p, a[0], b[0]));
  return a.map((v, i) => lerp(v, b[i], m));
}
const lastPose = (keys) => keys[keys.length - 1];

function yearPose(p) {
  const Y = CONFIG.yearCam, from = lastPose(CONFIG.cam.winter), to = CONFIG.cam.finale[0];
  const turn = from[4] + p * Y.turns * TAU;
  const mid = [p, ...Y.target, turn, Y.el, Y.dist, Y.fov];
  const inK = smooth(seg(p, 0, Y.blendIn)), outK = smooth(seg(p, Y.blendOut, 1));
  /* azimuth needs no blend: winter ends and the finale starts on the same angle, a whole number of turns apart */
  return mid.map((v, i) => (i === 4 ? v : lerp(lerp(from[i], v, inK), to[i], outK)));
}

function updateCamera(st, dt, montage) {
  const P = st.id === 'year' ? yearPose(st.world) : poseAt(CONFIG.cam[st.id], st.world);
  /* scroll speed spins the tree while the montage runs; the extra angle unwinds outside it */
  const V = CONFIG.velocity;
  const w = spinVel.step(reduce ? 0 : Math.abs(velocity()) * V.spin * montage);
  spinOffset = montage > 0 ? spinOffset + w * dt * 60 : spinOffset * Math.pow(0.02, dt);
  const [, tx, ty, tz, az0, el, dist0, fov] = P;
  const az = az0 + spinOffset * montage;
  const portrait = clamp(0.95 / camera.aspect, 1, 1.75);
  const dist = dist0 * portrait;
  camera.position.set(tx + dist * Math.sin(az) * Math.cos(el), ty + dist * Math.sin(el), tz + dist * Math.cos(az) * Math.cos(el));
  const floor = hillY(camera.position.x, camera.position.z) + 0.45;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(tx, ty + (portrait - 1) * 1.5, tz);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  U.uCamTarget.value.set(tx, ty, tz).lerp(camera.position, 0.45);
  sky.position.copy(camera.position);
}
