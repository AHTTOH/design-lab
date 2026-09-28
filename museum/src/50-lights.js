/* ───────── light room: a hyperboloid of laser strings that winds tighter with walking speed ───────── */
const BEAM_VS = `
varying vec3 vN, vV; varying float vY;
void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BEAM_FS = `
uniform vec3 uColor; uniform float uGain, uTime, uPhase;
varying vec3 vN, vV; varying float vY;
void main() {
  float core = pow(max(abs(dot(vN, vV)), 1e-4), 3.);                          // bright centre line, soft sides
  float pulse = .8 + .2 * sin(vY * 40. - uTime * 3. + uPhase);      // light travelling down the string
  gl_FragColor = vec4(uColor * uGain * core * pulse, 1.);
}`;

function initLightRoom(world) {
  const cfg = CONFIG.lights, room = roomById('light'), g = new THREE.Group();
  world.scene.add(g);
  const [cx, cz] = cfg.center;
  const palette = cfg.colors.map((c) => new THREE.Color(c));
  const up = new THREE.Vector3(0, 1, 0);

  const beamGeo = new THREE.CylinderGeometry(cfg.width, cfg.width, 1, 8, 1, true);
  const dotGeo = new THREE.CircleGeometry(0.07, 16);
  const beams = [];
  for (let i = 0; i < cfg.beams; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: palette[i % palette.length].clone() }, uGain: { value: cfg.gain }, uTime: { value: 0 }, uPhase: { value: i * 0.7 } },
    });
    const beam = new THREE.Mesh(beamGeo, mat);
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: palette[i % palette.length].clone().multiplyScalar(1.4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2;
    g.add(beam, dot);
    beams.push({ beam, dot, mat, a: (i / cfg.beams) * Math.PI * 2 });
  }
  // Rings the strings hang between.
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#aab8ff').multiplyScalar(1.3), toneMapped: false });
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(cfg.ringTop, 0.025, 8, 160), ringMat);
  topRing.rotation.x = Math.PI / 2; topRing.position.set(cx, cfg.top, cz);
  g.add(topRing);
  // A faint violet wash so the dark room still has walls and a floor.
  const wash = new THREE.PointLight('#7b5cff', 18, 20, 2);
  wash.position.set(cx, 3.5, cz);
  g.add(wash);
  // Picture-rail glow lines along the side walls, low and dim.
  const railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a46ff').multiplyScalar(1.3), toneMapped: false });
  [-1, 1].forEach((s) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, Math.abs(room.z[1] - room.z[0]) - 2), railMat);
    rail.position.set(s * (room.x[1] - CONFIG.wallT - 0.02), 0.25, cz);
    g.add(rail);
  });

  let vel = 0;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
  function pose(u, time) {
    const local = clamp01(u - 3);
    const spin = reduce ? 0.6 : time * cfg.spin;
    const twist = cfg.twist + local * 1.1 + vel * 2.4;
    const hueShift = reduce ? 0 : vel * 2 + time * 0.05;
    beams.forEach((b, i) => {
      const a0 = b.a + spin, a1 = a0 + twist;
      from.set(cx + Math.cos(a0) * cfg.ringTop, cfg.top, cz + Math.sin(a0) * cfg.ringTop);
      to.set(cx + Math.cos(a1) * cfg.ringBottom, 0.02, cz + Math.sin(a1) * cfg.ringBottom);
      dir.subVectors(to, from);
      const len = dir.length();
      b.beam.position.addVectors(from, to).multiplyScalar(0.5);
      b.beam.quaternion.setFromUnitVectors(up, dir.normalize());
      b.beam.scale.set(1, len, 1);
      b.dot.position.copy(to).setY(0.012);
      const c = (i / palette.length + hueShift) % palette.length, k = Math.floor(c), f = c - k;
      b.mat.uniforms.uColor.value.copy(palette[k % palette.length]).lerp(palette[(k + 1) % palette.length], f);
      b.mat.uniforms.uGain.value = cfg.gain * (1 + vel * 1.5);
      b.mat.uniforms.uTime.value = time;
    });
  }
  pose(3, 0);
  return {
    update(u, time) {
      if (u < 2.3 || u > 4.6) return;          // not visible from further away
      const target = clamp(Math.abs(velocity()) * cfg.twistVel, 0, 1);
      vel += (target - vel) * cfg.velEase;
      pose(u, time);
    },
  };
}
