/* ───────── sculpture room: procedural works on plinths, shadow-casting spots ───────── */
/** A flat steel ribbon twisted about its axis and bent slightly, displaced once on the CPU. */
function twistGeometry() {
  const H = 1.9, geo = new THREE.BoxGeometry(0.62, H, 0.12, 12, 220, 2), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = v.y / H + 0.5, a = t * 3.6, c = Math.cos(a), s = Math.sin(a);
    const taper = 1 - 0.35 * Math.abs(t - 0.45);
    const x = v.x * taper, z = v.z;
    p.setXYZ(i, x * c - z * s + 0.1 * Math.sin(v.y * 1.8), v.y, x * s + z * c);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A breathing marble pebble: a merged sphere pushed out by layered sines and pinched at the waist. */
function marbleGeometry() {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(0.5, 40)), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const f = 0.16 * Math.sin(2.1 * n.x * 3 + 0.4) * Math.sin(1.7 * n.y * 3 + 1.1) * Math.sin(2.3 * n.z * 3)
      + 0.08 * Math.sin(4.3 * n.x + 1.7 * n.y * 3) + 0.05 * Math.sin(5.1 * n.z - 3.2 * n.y + 0.7);
    const pinch = 1 - 0.2 * Math.exp(-(((n.y + 0.1) * 2.6) ** 2));
    const r = 0.5 * (1 + f) * pinch;
    p.setXYZ(i, n.x * r, n.y * r * 1.5, n.z * r);
  }
  geo.computeVertexNormals();
  return geo;
}

function marbleMaterial(env) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#f1f3f6', roughness: 0.32, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMap: env, envMapIntensity: 0.35 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vObj;\n${SNOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float vn = snoise(vObj * 2.4) + .5 * snoise(vObj * 5.3);
        float vein = 1. - smoothstep(0., .07, abs(sin(vObj.y * 5. + vObj.x * 2.4 + vn * 2.3)));
        float fine = 1. - smoothstep(0., .03, abs(sin(vObj.z * 11. + vn * 4.)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.36, .39, .47), vein * .75 + fine * .18);`);
  };
  return m;
}

function initSculptures(world, env) {
  const cfg = CONFIG.sculpt, room = roomById('sculpt'), g = new THREE.Group();
  world.scene.add(g);
  const plinthMat = new THREE.MeshStandardMaterial({ color: cfg.plinthColor, roughness: 0.8 });
  const [pw, ph, pd] = cfg.plinth;
  const makers = {
    twist: () => ({ geo: twistGeometry(), mat: new THREE.MeshStandardMaterial({ color: '#a9afb9', metalness: 1, roughness: 0.42, envMap: env, envMapIntensity: 0.55 }), y: 0.97 }),
    marble: () => ({ geo: marbleGeometry(), mat: marbleMaterial(env), y: 0.74 }),
    knot: () => ({ geo: new THREE.TorusKnotGeometry(0.4, 0.12, 300, 36, 2, 5), mat: new THREE.MeshStandardMaterial({ color: '#b07a45', metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1.2 }), y: 0.72 }),
  };
  const works = CONFIG.sculptures.map((s, i) => {
    const maker = makers[s.kind];
    if (!maker) throw new Error(`unknown sculpture kind ${s.kind}`);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), plinthMat);
    plinth.position.set(s.x, ph / 2, s.z); plinth.castShadow = true; plinth.receiveShadow = true;
    g.add(plinth);
    const { geo, mat, y } = maker();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.x, ph + y, s.z); mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    addSpot(g, { pos: [s.x + 1.1, room.h - 0.2, s.z + 1.9], target: [s.x, ph + 0.5, s.z], intensity: cfg.spot, angle: cfg.spotAngle, penumbra: cfg.penumbra, cone: cfg.cone,
      shadow: true, shadowSize: isMobile() ? CONFIG.render.shadowMapMobile : CONFIG.render.shadowMap, color: '#fff0e0' });
    return { mesh, phase: i * 2.1 };
  });
  return {
    update(u, time) {
      if (reduce) return;
      for (const w of works) w.mesh.rotation.y = w.phase + time * cfg.spin + u * 0.8;
    },
  };
}
