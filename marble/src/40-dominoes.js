/* ───────── dominoes: a snake of acrylic tiles, then a five-row wave, then one tall domino ───────── */
function snakeCurve() {
  const S = CONFIG.layout.snake, [xa, xb] = S.x, pts = [];
  S.rows.forEach((z, k) => {
    const dir = k % 2 === 0 ? 1 : -1, xs = dir > 0 ? xa : xb, xe = dir > 0 ? xb : xa;
    for (let i = 0; i <= 6; i++) pts.push(V(lerp(xs, xe, i / 6), 0, z));
    if (k === S.rows.length - 1) return;
    const zn = S.rows[k + 1], R = (zn - z) / 2;
    for (let i = 1; i < 10; i++) {
      const a = -PI / 2 + (i / 10) * PI;
      pts.push(V(xe + dir * Math.cos(a) * R * 1.1, 0, z + R + Math.sin(a) * R));
    }
  });
  return pathCurve(pts, 0.5);
}

const DOMINO_HUES = [COLOR.tomato, COLOR.orange, COLOR.sun, COLOR.emerald, COLOR.aqua, COLOR.cobalt, COLOR.violet, COLOR.pink];
function paletteAt(u) {
  const f = clamp01(u) * (DOMINO_HUES.length - 1), i = Math.floor(f), j = Math.min(DOMINO_HUES.length - 1, i + 1);
  return new THREE.Color(DOMINO_HUES[i]).lerp(new THREE.Color(DOMINO_HUES[j]), f - i);
}

function createDominoes(scene, mats) {
  const D = CONFIG.layout.domino, W = CONFIG.layout.wave, T = CONFIG.time;
  const curve = snakeCurve(), len = curve.getLength();
  const tiles = [];
  // snake
  const nSnake = Math.floor(len / CONFIG.layout.snake.spacing) + 1;
  const snakeSpan = T.snake[1] - T.snake[0], snakeStep = snakeSpan / nSnake;
  for (let i = 0; i < nSnake; i++) {
    const u = (i * CONFIG.layout.snake.spacing) / len;
    const p = curve.getPointAt(Math.min(1, u)), d = curve.getTangentAt(Math.min(1, u)).setY(0).normalize();
    tiles.push({ p, d, fs: T.snake[0] + i * snakeStep, fd: snakeStep * 4.5, tilt: D.chainTilt, hue: (i / nSnake) * 0.62 });
  }
  // wave: the middle row continues the snake, outer rows lag by row distance so the front is a V
  const zMid = CONFIG.layout.snake.rows[CONFIG.layout.snake.rows.length - 1];
  const lag = 0.9, units = W.cols - 1 + lag * Math.floor(W.rows / 2), waveSpan = T.wave[1] - T.wave[0];
  for (let c = 0; c < W.cols; c++) for (let r = 0; r < W.rows; r++) {
    const off = Math.abs(r - (W.rows - 1) / 2);
    const fs = T.wave[0] + ((c + off * lag) / (units + 3)) * waveSpan;
    tiles.push({ p: V(W.x0 + c * W.dx, 0, zMid + (r - (W.rows - 1) / 2) * W.dz), d: V(1, 0, 0), fs, fd: (waveSpan / (units + 3)) * 3.2,
      tilt: c === W.cols - 1 ? D.lastTilt : D.chainTilt, hue: 0.64 + (c / W.cols) * 0.36 });
  }

  const geo = new RoundedBoxGeometry(D.w, D.h, D.t, 2, 0.025);
  geo.translate(0, D.h / 2, 0);
  const mat = mats.acrylic('#ffffff', 0.35);
  const mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
  mesh.castShadow = mesh.receiveShadow = true;
  tiles.forEach((tile, i) => mesh.setColorAt(i, paletteAt(tile.hue)));
  scene.add(mesh);

  // tall brass-capped domino that tips the seesaw
  const B = CONFIG.layout.big;
  const bigPivot = new THREE.Group(); bigPivot.position.set(B.x + B.t / 2, 0, zMid); scene.add(bigPivot);
  solid(new RoundedBoxGeometry(B.t, B.h, B.w, 3, 0.04), mats.lacquer(COLOR.pink), bigPivot, -B.t / 2, B.h / 2, 0);
  solid(new THREE.BoxGeometry(B.t + 0.02, 0.14, B.w + 0.02), mats.brass, bigPivot, -B.t / 2, B.h - 0.07, 0);

  const m4 = new THREE.Matrix4(), yaw = new THREE.Quaternion(), fall = new THREE.Quaternion(), qq = new THREE.Quaternion();
  const axis = new THREE.Vector3(), pivot = new THREE.Vector3(), rel = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Z = new THREE.Vector3(0, 0, 1);
  const tiltOf = (tile, t) => { const u = seg(t, tile.fs, tile.fs + tile.fd); return tile.tilt * u * u; };
  let lastT = -1;
  const update = (t) => {
    const bu = seg(t, T.big[0], T.seesaw[0]);
    bigPivot.rotation.z = -(0.82 * bu * bu + 0.6 * win(t, T.seesaw[0], T.seesaw[1] + 0.01));
    if (t === lastT) return;
    lastT = t;
    tiles.forEach((tile, i) => {
      yaw.setFromUnitVectors(Z, tile.d);
      axis.crossVectors(UP, tile.d).normalize();
      fall.setFromAxisAngle(axis, tiltOf(tile, t));
      pivot.copy(tile.p).addScaledVector(tile.d, D.t / 2);
      // rotate the base point about the front edge, then orient the tile
      rel.subVectors(tile.p, pivot).applyQuaternion(fall).add(pivot);
      qq.multiplyQuaternions(fall, yaw);
      m4.compose(rel, qq, one);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  /** The action point: the tile that is falling right now. */
  const focus = (t) => {
    if (t < T.wave[0]) {
      const i = clamp((t - T.snake[0]) / snakeStep, 0, nSnake - 1);
      return curve.getPointAt(Math.min(1, (i * CONFIG.layout.snake.spacing) / len)).setY(0.35);
    }
    const c = clamp(((t - T.wave[0]) / waveSpan) * (units + 3), 0, W.cols - 1);
    const p = V(W.x0 + c * W.dx, 0.35, zMid);
    // slide on to the tall domino as the wave finishes
    return p.lerp(V(B.x + 0.4, 0.8, zMid), win(t, T.wave[1] - 0.02, T.big[1]));
  };
  return { update, focus, tiles };
}
