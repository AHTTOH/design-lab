/* ───────── camera: keyed dolly and crane moves that follow the action point ───────── */
/**
 * sources: [{ from, at(t) }] in time order. The action point hands over from one source to the next
 * across a short window around `from`, so the follow target never jumps.
 */
function createFocus(sources, blend = 0.02) {
  return (t) => {
    const out = sources[0].at(t).clone();
    for (let k = 1; k < sources.length; k++) {
      const w = win(t, sources[k].from - blend, sources[k].from + blend);
      if (w > 0) out.lerp(sources[k].at(t), w);
    }
    return out;
  };
}

function createCameraRig(camera, focus) {
  const C = CONFIG.camera, shots = CONFIG.shots;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse && !reduce) addEventListener('pointermove', (e) => { pointer.tx = (e.clientX / innerWidth) * 2 - 1; pointer.ty = (e.clientY / innerHeight) * 2 - 1; });
  const targetOf = (shot, t, act) => (shot.p ? V(...shot.p).lerp(act, shot.follow) : act.clone());
  const pose = (t) => {
    if (reduce) return { target: V(...CONFIG.still.p), az: CONFIG.still.az, el: CONFIG.still.el, d: CONFIG.still.d, fov: CONFIG.still.fov };
    const act = focus(t);
    let i = shots.length - 2;
    for (let k = 0; k < shots.length - 1; k++) if (t < shots[k + 1].t) { i = k; break; }
    const a = shots[i], b = shots[i + 1], u = smooth(seg(t, a.t, b.t));
    return {
      target: targetOf(a, t, act).lerp(targetOf(b, t, act), u),
      az: lerp(a.az, b.az, u), el: lerp(a.el, b.el, u),
      d: Math.exp(lerp(Math.log(a.d), Math.log(b.d), u)), fov: lerp(a.fov, b.fov, u),
    };
  };
  /** Wider lens on portrait screens: keep most of the landscape horizontal view instead of cropping it. */
  const fovFor = (vfov, d) => {
    const aspect = innerWidth / innerHeight;
    if (aspect >= 1.2) return vfov;
    // close shots keep most of the width; wide shots of the whole table accept a crop so the machine stays large
    const keep = lerp(C.portraitHfovScale, C.portraitWideScale, seg(d, C.portraitNear, C.portraitFar));
    const hfov = 2 * Math.atan(Math.tan((vfov * DEG) / 2) * (16 / 9)) * keep;
    return Math.min(C.portraitMaxFov, (2 * Math.atan(Math.tan(hfov / 2) / aspect)) / DEG);
  };
  return (t) => {
    pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
    const p = pose(t);
    const portrait = innerWidth / innerHeight < 1.2;
    const d = p.d * (portrait ? C.portraitDist : 1);
    const az = (p.az + pointer.x * 3) * DEG, el = clamp(p.el - pointer.y * 2, 3, 85) * DEG;
    camera.position.set(p.target.x + d * Math.sin(az) * Math.cos(el), p.target.y + d * Math.sin(el), p.target.z + d * Math.cos(az) * Math.cos(el));
    camera.lookAt(p.target);
    const fov = fovFor(p.fov, p.d);
    if (Math.abs(camera.fov - fov) > 1e-3 || camera.aspect !== innerWidth / innerHeight) {
      camera.fov = fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    }
    const settling = Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > 0.002;
    return { target: p.target, d, settling };
  };
}
