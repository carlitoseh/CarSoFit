// CarSofit · visor 3D de ejercicios con personas realistas (hombre para Carlos, mujer para Sofía).
// Los modelos (modelos/*.glb) tienen esqueleto humanoide estándar; aquí se mueven sus huesos con las posturas de cada ejercicio.
// El músculo trabajado brilla en rojo, se ve el material (mancuernas, banda, cajón, toalla, silla, esterilla, pared) y se gira arrastrando.
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";

const D = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Posturas ----------
// Ángulos en grados, en los ejes del cuerpo de pie mirando al frente:
// pitch: inclinación del cuerpo entero (90 boca abajo, -90 boca arriba) · roll: de lado (90 = tumbado sobre el costado derecho)
// spine: flexión del tronco (repartida en 3 vértebras) · tw: giro del tronco · head: flexión de cuello y cabeza
// sh: flexión de hombro · ab: abducción de hombro · el: flexión de codo · elz: antebrazo hacia arriba con el brazo abierto
// hip: flexión de cadera · hab: abducción de cadera · knee: flexión de rodilla · ank: flexión plantar (si falta, pie plano en el suelo)
const KEYS = ["pitch", "roll", "yaw", "spine", "tw", "head", "shL", "shR", "abL", "abR", "elL", "elR", "elzL", "elzR",
  "hipL", "hipR", "habL", "habR", "kneeL", "kneeR", "ankL", "ankR"];
const STAND = { abL: 6, abR: 6 };
const SUPINE_KNEES = { pitch: -90, hipL: 60, hipR: 60, kneeL: 108, kneeR: 108, abL: 12, abR: 12 };
const QUAD = { pitch: 90, shL: 90, shR: 90, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, ankL: 90, ankR: 90 };
const DEADBUG = { pitch: -90, shL: 90, shR: 90, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, ankL: 0, ankR: 0 };
const GOBLET = { shL: 30, shR: 30, elL: 120, elR: 120, abL: -14, abR: -14 };
// Pilates: tumbada con cabeza y hombros despegados y pies en punta
const CURL = { pitch: -90, spine: 30, head: 15, ankL: 30, ankR: 30, abL: 8, abR: 8 };
// Tumbada de lado (sobre el costado derecho), cabeza apoyada en el brazo de abajo
const SIDE = { roll: 90, shR: 175, elR: 20, shL: 85, elL: 15, abL: 5, ankL: 10, ankR: 10 };
// Sentada con piernas estiradas
const SEAT = { hipL: 90, hipR: 90, ankL: -15, ankR: -15 };

const ANIMS = {
  squat: { frames: [GOBLET, { ...GOBLET, hipL: 100, hipR: 100, kneeL: 112, kneeR: 112, spine: 34, habL: 10, habR: 10 }], db: "chest", anchor: "feet" },
  squatbw: { frames: [{ shL: 80, shR: 80, abL: 6, abR: 6 }, { shL: 85, shR: 85, abL: 6, abR: 6, hipL: 95, hipR: 95, kneeL: 100, kneeR: 100, spine: 30, habL: 10, habR: 10 }], chair: true, anchor: "feet", az: 70 },
  floorpress: { frames: [{ ...SUPINE_KNEES, abL: 65, abR: 65, elL: 90, elR: 90 }, { ...SUPINE_KNEES, shL: 90, shR: 90, abL: 8, abR: 8 }], db: "hands", mat: true, az: 78 },
  row: {
    frames: [
      { pitch: 55, hipL: 70, hipR: 70, kneeL: 25, kneeR: 25, spine: 5, head: -25, shL: 62, elL: 15, shR: 55, elR: 5, abL: 6, abR: 6 },
      { pitch: 55, hipL: 70, hipR: 70, kneeL: 25, kneeR: 25, spine: 5, head: -25, shL: 62, elL: 15, shR: -5, elR: 75, abL: 6, abR: 10 },
    ], db: "right", bench: true, anchor: "feet", az: 62,
  },
  rowband: { frames: [{ shL: 78, shR: 78, abL: 4, abR: 4 }, { shL: -12, shR: -12, elL: 95, elR: 95, abL: 4, abR: 4 }], band: [0, 1.1, 1.3], anchor: "feet", az: 60 },
  bridge: {
    frames: [
      { pitch: -90, hipL: 60, hipR: 60, kneeL: 110, kneeR: 110, abL: 12, abR: 12, habL: 6, habR: 6 },
      { pitch: -115, hipL: 0, hipR: 0, kneeL: 115, kneeR: 115, head: 25, shL: -25, shR: -25, abL: 12, abR: 12, habL: 9, habR: 9 },
    ], mat: true, kneeBand: true, anchor: "feet", az: 70,
  },
  plank: {
    frames: [
      { pitch: 84, shL: 84, shR: 84, elL: 90, elR: 90, ankL: 0, ankR: 0 },
      { pitch: 84, spine: -3, head: -4, shL: 84, shR: 84, elL: 90, elR: 90, ankL: 5, ankR: 5 },
    ], mat: true, anchor: "feet", az: 80, dur: 1.8,
  },
  heel: { frames: [STAND, { ...STAND, ankL: 38, ankR: 38 }], step: 0.16, towelRoll: true, ground: "toes", anchor: "toes", az: 65, dur: 1.6 },
  lunge: { frames: [{ abL: 8, abR: 8 }, { hipL: 85, kneeL: 90, hipR: -15, kneeR: 78, ankR: -30, spine: 5, abL: 8, abR: 8 }], db: "hands", anchor: "footL", az: 75 },
  rdl: { frames: [{ kneeL: 5, kneeR: 5, abL: 4, abR: 4 }, { pitch: 72, hipL: 82, hipR: 82, kneeL: 20, kneeR: 20, shL: 72, shR: 72, head: -20, abL: 4, abR: 4 }], db: "hands", anchor: "feet", az: 72 },
  press: { frames: [{ abL: 80, abR: 80, elzL: 95, elzR: 95 }, { abL: 168, abR: 168, elzL: 8, elzR: 8 }], db: "hands", anchor: "feet", az: 30 },
  facepull: { frames: [{ shL: 88, shR: 88, abL: 6, abR: 6 }, { shL: 15, shR: 15, abL: 80, abR: 80, elzL: 105, elzR: 105 }], band: [0, 1.55, 1.3], anchor: "feet", az: 40 },
  curl: { frames: [{ abL: 5, abR: 5 }, { elL: 140, elR: 140, abL: 5, abR: 5 }], db: "hands", anchor: "feet", az: 40 },
  deadbug: {
    frames: [DEADBUG, { ...DEADBUG, shR: 175, hipL: 15, kneeL: 5 }, DEADBUG, { ...DEADBUG, shL: 175, hipR: 15, kneeR: 5 }],
    cycle: true, mat: true, az: 70, dur: 1.1,
  },
  birddog: {
    frames: [QUAD, { ...QUAD, shR: 180, hipL: 0, kneeL: 0, ankL: 30 }, QUAD, { ...QUAD, shL: 180, hipR: 0, kneeR: 0, ankR: 30 }],
    cycle: true, mat: true, az: 65, dur: 1.2,
  },
  mob: { frames: [{ ...QUAD, spine: -10, shL: 80, shR: 80, head: -25 }, { ...QUAD, spine: 12, shL: 102, shR: 102, head: 35 }], mat: true, az: 75, dur: 1.6 },
  breath: { frames: [SUPINE_KNEES, { ...SUPINE_KNEES, spine: -3, head: 3 }], mat: true, az: 78, dur: 2.4 },
  stretch: { frames: [STAND, { pitch: 78, hipL: 82, hipR: 82, kneeL: 4, kneeR: 4, shL: 84, shR: 84, head: -10, abL: 4, abR: 4 }], anchor: "feet", az: 75, dur: 2 },
  fascia: { frames: [STAND, { pitch: 18, hipL: 45, kneeL: 50, hipR: -8, kneeR: 0, shL: 105, shR: 105, abL: 6, abR: 6 }], anchor: "footL", wall: true, az: 80, dur: 1.8 },
  towel: {
    frames: [
      { ...SEAT, spine: 18, head: 10, shL: 62, shR: 62, elL: 25, elR: 25, abL: -6, abR: -6, ankL: 5 },
      { ...SEAT, spine: 24, head: 12, shL: 55, shR: 55, elL: 50, elR: 50, abL: -6, abR: -6, ankL: -25 },
    ], mat: true, strap: true, az: 60, dur: 1.8,
  },
  walk: {
    frames: [
      { hipL: 25, kneeL: 5, hipR: -15, kneeR: 12, shL: -22, shR: 22, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipL: 5, kneeL: 8, hipR: 25, kneeR: 55, shL: 0, shR: 0, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipR: 25, kneeR: 5, hipL: -15, kneeL: 12, shR: -22, shL: 22, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipR: 5, kneeR: 8, hipL: 25, kneeL: 55, shL: 0, shR: 0, elL: 20, elR: 20, abL: 5, abR: 5 },
    ],
    cycle: true, linear: true, az: 80, dur: 0.42,
  },
  // ---- Pilates ----
  hundred: {
    frames: [
      { ...CURL, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, shL: 24, shR: 24 },
      { ...CURL, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, shL: 8, shR: 8 },
    ], mat: true, az: 72, dur: 0.4,
  },
  rollup: {
    frames: [
      { pitch: -90, shL: 175, shR: 175, abL: 8, abR: 8, ankL: -15, ankR: -15 },
      { pitch: -58, spine: 30, head: 25, hipL: 32, hipR: 32, shL: 100, shR: 100, abL: 8, abR: 8, ankL: -15, ankR: -15 },
      { pitch: -8, spine: 42, head: 20, hipL: 82, hipR: 82, shL: 78, shR: 78, abL: 6, abR: 6, ankL: -15, ankR: -15 },
    ], mat: true, az: 78, dur: 1.5,
  },
  single: {
    frames: [
      { ...CURL, hipL: 120, kneeL: 115, hipR: 45, kneeR: 0, shL: 62, elL: 55, shR: 55, elR: 40 },
      { ...CURL, hipR: 120, kneeR: 115, hipL: 45, kneeL: 0, shR: 62, elR: 55, shL: 55, elL: 40 },
    ], mat: true, az: 72, dur: 0.9,
  },
  double: {
    frames: [
      { ...CURL, hipL: 120, hipR: 120, kneeL: 120, kneeR: 120, shL: 58, shR: 58, elL: 60, elR: 60 },
      { ...CURL, hipL: 45, hipR: 45, kneeL: 0, kneeR: 0, shL: 172, shR: 172 },
    ], mat: true, az: 72, dur: 1.3,
  },
  crisscross: {
    frames: [
      { ...CURL, tw: 30, shL: 160, shR: 160, elL: 125, elR: 125, abL: 40, abR: 40, hipL: 115, kneeL: 105, hipR: 45, kneeR: 0 },
      { ...CURL, tw: -30, shL: 160, shR: 160, elL: 125, elR: 125, abL: 40, abR: 40, hipR: 115, kneeR: 105, hipL: 45, kneeL: 0 },
    ], mat: true, az: 60, dur: 1,
  },
  swim: {
    frames: [
      { pitch: 90, spine: -12, head: -15, shL: 196, shR: 166, abL: 12, abR: 12, hipL: -3, hipR: -18, ankL: 50, ankR: 50 },
      { pitch: 90, spine: -12, head: -15, shR: 196, shL: 166, abL: 12, abR: 12, hipR: -3, hipL: -18, ankL: 50, ankR: 50 },
    ], mat: true, az: 65, dur: 0.45,
  },
  clam: {
    frames: [
      { ...SIDE, hipL: 45, hipR: 45, kneeL: 90, kneeR: 90 },
      { ...SIDE, hipL: 45, hipR: 45, kneeL: 90, kneeR: 90, habL: 38 },
    ], mat: true, kneeBand: true, az: 25, el: 16, dur: 1.3,
  },
  sidekick: {
    frames: [
      { ...SIDE, hipR: 20, habL: 8, hipL: 75 },
      { ...SIDE, hipR: 20, habL: 8, hipL: -22 },
    ], mat: true, az: 25, el: 16, dur: 1.1,
  },
  legcircle: {
    frames: [
      { pitch: -90, abL: 20, abR: 20, hipR: 88, ankR: 20 },
      { pitch: -90, abL: 20, abR: 20, hipR: 74, habR: 20, ankR: 20 },
      { pitch: -90, abL: 20, abR: 20, hipR: 60, ankR: 20 },
      { pitch: -90, abL: 20, abR: 20, hipR: 74, habR: -14, ankR: 20 },
    ], cycle: true, mat: true, az: 55, dur: 0.6,
  },
  spinestretch: {
    frames: [
      { ...SEAT, habL: 22, habR: 22, shL: 90, shR: 90, abL: 10, abR: 10 },
      { ...SEAT, habL: 22, habR: 22, spine: 48, head: 25, shL: 80, shR: 80, abL: 10, abR: 10 },
    ], mat: true, az: 70, dur: 1.8,
  },
  saw: {
    frames: [
      { ...SEAT, habL: 25, habR: 25, abL: 88, abR: 88 },
      { ...SEAT, habL: 25, habR: 25, abL: 88, abR: 88, tw: 40, spine: 35, head: 10 },
      { ...SEAT, habL: 25, habR: 25, abL: 88, abR: 88 },
      { ...SEAT, habL: 25, habR: 25, abL: 88, abR: 88, tw: -40, spine: 35, head: 10 },
    ], cycle: true, mat: true, az: 45, dur: 1.2,
  },
};
ANIMS.pilates = ANIMS.hundred;

function resolve(p) {
  const o = {};
  KEYS.forEach((k) => (o[k] = p[k] ?? 0));
  for (const L of ["L", "R"]) if (p["ank" + L] === undefined) o["ank" + L] = clamp(o["hip" + L] - o["knee" + L] - o.pitch, -35, 60);
  return o;
}
function period(A) { const n = A.R.length; return (A.cycle ? n : Math.max(2, 2 * n - 2)) * (A.dur || 1.3); }
function sample(A, t) {
  const F = A.R, n = F.length, dur = A.dur || 1.3;
  let a, b, u;
  if (A.cycle) {
    const x = (t / dur) % n, s = Math.floor(x); u = x - s; a = F[s]; b = F[(s + 1) % n];
  } else {
    const path = [...F.keys(), ...[...F.keys()].reverse().slice(1, -1)], m = path.length;
    const x = (t / dur) % m, s = Math.floor(x); u = x - s; a = F[path[s]]; b = F[path[(s + 1) % m]];
  }
  if (!A.linear) u = u * u * (3 - 2 * u);
  const o = {};
  KEYS.forEach((k) => (o[k] = a[k] + (b[k] - a[k]) * u));
  return o;
}

// ---------- Personas realistas ----------
// Aspecto de cada uno: altura, complexión y peinado
const MODEL = {
  carlos: { file: "modelos/carlos.glb", h: 1.83, wide: 1.05, hair: "rizos", beard: true },
  sofia: { file: "modelos/sofia.glb", h: 1.6, wide: 1.02, hair: "coleta", glasses: true, strip: true },
};
const buffers = {};
function modelBuffer(who) {
  if (!buffers[who]) buffers[who] = fetch(new URL(MODEL[who].file, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error("No se pudo descargar el modelo");
    return r.arrayBuffer();
  }).catch((e) => { delete buffers[who]; throw e; });
  return buffers[who];
}

const _v = new THREE.Vector3();
const W = (o) => o.getWorldPosition(new THREE.Vector3());
function meshBox(meshes, stride, box = new THREE.Box3()) {
  box.makeEmpty();
  for (const m of meshes) {
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += stride) { m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld); box.expandByPoint(_v); }
  }
  return box;
}
// Gira un hueso para que apunte en una dirección (en ejes del cuerpo)
function aim(root, bone, child, dir) {
  if (!bone || !child) return;
  root.updateMatrixWorld(true);
  const cur = W(child).sub(W(bone)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, dir);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(q.multiply(wq)));
  root.updateMatrixWorld(true);
}

function rigHuman(gltf, who) {
  const scene3 = gltf.scene, root = new THREE.Group(), holder = new THREE.Group();
  root.add(holder); holder.add(scene3);
  const B = {}, meshes = [];
  // Ropa de deporte: fuera el sombrero; camiseta, pantalón y zapatillas en colores lisos
  const sport = { Outfit_Top: 0x2E67D3, Outfit_Bottom: 0x2B3036, Outfit_Footwear: 0xEDEDEA };
  scene3.traverse((o) => {
    if (o.isBone) B[o.name.replace(/^mixamorig:?/, "")] = o;
    if (!o.isMesh) return;
    const mn = o.material?.name || "";
    if (/Headwear/.test(mn)) { o.visible = false; return; }
    const c = Object.entries(sport).find(([k]) => mn.includes(k));
    if (c) { o.material.map = null; o.material.color.setHex(c[1]); o.material.roughness = 0.85; o.material.metalness = 0; o.material.needsUpdate = true; }
    o.castShadow = true; o.frustumCulled = false; if (o.isSkinnedMesh) meshes.push(o);
  });
  // Tamaño real, mirando al frente (+z) y con la cadera en el origen
  root.updateMatrixWorld(true);
  const bb = meshBox(meshes, 2);
  holder.scale.setScalar(MODEL[who].h / (bb.max.y - bb.min.y));
  root.updateMatrixWorld(true);
  const f = W(B.LeftToeBase).sub(W(B.LeftFoot));
  holder.rotation.y = -Math.atan2(f.x, f.z);
  root.updateMatrixWorld(true);
  holder.position.sub(W(B.Hips));
  root.updateMatrixWorld(true);
  // Postura de referencia: de pie, brazos y piernas rectos hacia abajo, columna vertical
  const down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
  for (const s of ["Left", "Right"]) {
    aim(root, B[s + "Arm"], B[s + "ForeArm"], down); aim(root, B[s + "ForeArm"], B[s + "Hand"], down);
    aim(root, B[s + "Hand"], B[s + "HandMiddle1"], down);
    aim(root, B[s + "UpLeg"], B[s + "Leg"], down); aim(root, B[s + "Leg"], B[s + "Foot"], down);
  }
  aim(root, B.Spine, B.Spine1, up); aim(root, B.Spine1, B.Spine2, up); aim(root, B.Spine2, B.Neck, up);
  aim(root, B.Neck, B.Head, up); aim(root, B.Head, B.HeadTop_End, up);
  const M = MODEL[who];
  const headMesh = meshes.find((m) => /Wolf3D_Head/.test(m.name)) || meshes[0];
  const head = headGeom(root, B, headMesh, M.strip);
  const bb2 = meshBox(meshes, 2), f2 = M.h / (bb2.max.y - bb2.min.y);
  holder.scale.set(holder.scale.x * f2 * M.wide, holder.scale.y * f2, holder.scale.z * f2 * M.wide);
  root.updateMatrixWorld(true);
  holder.position.sub(W(B.Hips));
  root.updateMatrixWorld(true);

  const ctl = (bone) => {
    const P = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    return { bone, q0: bone.quaternion.clone(), P, Pi: P.clone().invert() };
  };
  const J = { sp: [ctl(B.Spine), ctl(B.Spine1), ctl(B.Spine2)], neck: ctl(B.Neck), head: ctl(B.Head), fingers: [] };
  for (const [L, s, sg] of [["L", "Left", 1], ["R", "Right", -1]]) {
    J["sh" + L] = ctl(B[s + "Arm"]); J["el" + L] = ctl(B[s + "ForeArm"]);
    J["hip" + L] = ctl(B[s + "UpLeg"]); J["knee" + L] = ctl(B[s + "Leg"]); J["ank" + L] = ctl(B[s + "Foot"]);
    for (const fn of ["Index", "Middle", "Ring", "Pinky"]) for (const k of [1, 2, 3]) {
      const b = B[`${s}Hand${fn}${k}`]; if (b) J.fingers.push({ ...ctl(b), sg });
    }
  }
  const rest = meshBox(meshes, 1);
  const toeR = Math.min(W(B.LeftToeBase).y, W(B.RightToeBase).y) - rest.min.y;
  const H = { root, B, J, meshes, toeR, k: MODEL[who].h / 1.76, grip: 18, headMesh };
  H.head = headGeom(root, B, headMesh, false);
  return H;
}

// ---------- Cabeza: pelo, barba y gafas a medida ----------
function restPos(mesh) {
  const n = mesh.geometry.attributes.position.count, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, _v); _v.applyMatrix4(mesh.matrixWorld); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; }
  return out;
}
function headWeight(mesh, bones) {
  const ids = bones.filter(Boolean).map((b) => mesh.skeleton.bones.indexOf(b));
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  return (i) => { let w = 0; for (let c = 0; c < 4; c++) if (ids.includes(si.getComponent(i, c))) w += sw.getComponent(i, c); return w; };
}
// Nariz, centro y medidas del cráneo (en reposo). Con strip, quita el pelo y los auriculares del modelo original.
function headGeom(root, B, mesh, strip) {
  root.updateMatrixWorld(true);
  const P = restPos(mesh), wH = headWeight(mesh, [B.Head, B.HeadTop_End, B.LeftEye, B.RightEye]), n = P.length / 3;
  const hy = W(B.Head).y, used = new Uint8Array(n), idx = mesh.geometry.index;
  for (let t = 0; t < idx.count; t++) used[idx.getX(t)] = 1;
  const head = []; for (let i = 0; i < n; i++) if (used[i] && wH(i) > 0.5) head.push(i);
  let N = null;
  for (const i of head) { const y = P[i * 3 + 1], z = P[i * 3 + 2]; if (y > hy && Math.abs(P[i * 3] - W(B.Head).x) < 0.03 && (!N || z > N.z)) N = { x: P[i * 3], y, z }; }
  const C = new THREE.Vector3(W(B.Head).x, N.y + 0.035, N.z - 0.1);
  if (strip) {
    const out = new Uint8Array(n);
    for (const i of head) {
      const x = P[i * 3] - C.x, y = P[i * 3 + 1] - C.y, z = P[i * 3 + 2] - C.z;
      if (P[i * 3 + 1] > N.y - 0.01 && (x / 0.086) ** 2 + (y / 0.118) ** 2 + (z / 0.112) ** 2 > 1) out[i] = 1;
      if (Math.abs(x) > 0.09 && P[i * 3 + 1] > N.y - 0.08) out[i] = 1;
    }
    // Gafas de sol del modelo original: triángulos rojos delante de los ojos
    const img = mesh.material?.map?.image, uv = mesh.geometry.attributes.uv;
    if (img && uv) {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, cv.width, cv.height).data;
      for (const i of head) {
        const x = P[i * 3] - C.x, y = P[i * 3 + 1], z = P[i * 3 + 2];
        if (Math.abs(x) > 0.085 || y < N.y - 0.01 || y > N.y + 0.075 || z < N.z - 0.05) continue;
        const u = clamp(Math.floor(uv.getX(i) * cv.width), 0, cv.width - 1), v = clamp(Math.floor(uv.getY(i) * cv.height), 0, cv.height - 1), k = (v * cv.width + u) * 4;
        if (px[k] > 110 && px[k] - px[k + 1] > 40 && px[k] - px[k + 2] > 55) out[i] = 1;
      }
    }
    const keep = [];
    for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (!(out[a] || out[b] || out[c])) keep.push(a, b, c); }
    mesh.geometry.setIndex(keep);
    return null;
  }
  // Medidas reales del cráneo por encima de la nariz
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, top = -1e9;
  for (const i of head) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (y > N.y + 0.02) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); top = Math.max(top, y); }
  }
  const rx = Math.max(0.07, (x1 - x0) / 2), rz = Math.max(0.09, (z1 - z0) / 2);
  if (z1 - z0 > 0.17) C.z = (z0 + z1) / 2;
  C.x = (x0 + x1) / 2;
  return { N: new THREE.Vector3(N.x, N.y, N.z), C, rx, rz, ry: Math.max(0.09, top - C.y), P, head };
}
const HAIR = 0x2B1C12;
// Casquete del cráneo con el corte inclinado (más alto en la frente, más bajo en la nuca)
function cap(g, grow, theta, tilt, mat) {
  const geo = new THREE.SphereGeometry(1, 48, 28, 0, Math.PI * 2, 0, theta * D);
  geo.rotateX(-tilt * D);
  const m = new THREE.Mesh(geo, mat); m.scale.set(g.rx * grow, g.ry * grow, g.rz * grow); m.position.copy(g.C); m.castShadow = true;
  return m;
}
function styleHead(H, who) {
  const M = MODEL[who], g = H.head, B = H.B, parts = [];
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.95 });
  if (M.hair === "rizos") {
    // Degradado: laterales y nuca muy cortos (semitransparentes), arriba rizos
    parts.push(cap(g, 1.02, 100, 60, new THREE.MeshStandardMaterial({ color: HAIR, roughness: 1, transparent: true, opacity: 0.72, depthWrite: false })));
    parts.push(cap(g, 1.045, 62, 18, hairMat));
    const curls = [];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 280; k++) {
      const th = Math.acos(1 - rnd() * (1 - Math.cos(64 * D))), ph = rnd() * Math.PI * 2;
      const d = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -18 * D);
      const r = 0.013 + rnd() * 0.008, lift = 1.07 + rnd() * 0.05;
      const sg = new THREE.SphereGeometry(r, 7, 5);
      sg.translate(g.C.x + d.x * g.rx * lift, g.C.y + d.y * g.ry * lift, g.C.z + d.z * g.rz * lift);
      curls.push(sg);
    }
    const cm = new THREE.Mesh(mergeGeometries(curls), hairMat); cm.castShadow = true; parts.push(cm);
  }
  if (M.hair === "coleta") {
    parts.push(cap(g, 1.04, 106, 42, hairMat));
    const base = g.C.clone().add(new THREE.Vector3(0, g.ry * 0.3, -g.rz * 1.02));
    const dir = new THREE.Vector3(0, -1, -0.35).normalize(), len = 0.2;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.01, len, 16), hairMat);
    tail.position.copy(base).addScaledVector(dir, len / 2 + 0.01); tail.quaternion.setFromUnitVectors(UP, dir.clone().negate()); tail.castShadow = true;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), hairMat); knot.position.copy(base);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: 0xCF3F73, roughness: 0.6 }));
    tie.position.copy(base).addScaledVector(dir, 0.03); tie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    parts.push(tail, knot, tie);
  }
  if (M.glasses) {
    const frame = new THREE.MeshStandardMaterial({ color: 0x1D1F24, roughness: 0.4, metalness: 0.3 });
    const lensM = new THREE.MeshStandardMaterial({ color: 0xBFD8F0, transparent: true, opacity: 0.18, roughness: 0.1 });
    const ey = g.N.y + 0.034, ray = new THREE.Raycaster(), rims = [];
    for (const sx of [1, -1]) {
      const ex = g.C.x + sx * 0.032;
      ray.set(new THREE.Vector3(ex, ey, g.C.z + 0.4), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObjects(H.meshes, false)[0];
      const z = (hit ? hit.point.z : g.N.z - 0.025) + 0.014;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0024, 8, 32), frame); rim.position.set(ex, ey, z); rim.scale.y = 0.85;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 24), lensM); lens.position.set(ex, ey, z); lens.scale.y = 0.85;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6), frame);
      between(arm, new THREE.Vector3(ex + sx * 0.02, ey, z), new THREE.Vector3(g.C.x + sx * (g.rx + 0.004), ey - 0.004, g.C.z - 0.01));
      rims.push(rim); parts.push(rim, lens, arm);
      // Ojos detrás del cristal (el modelo original llevaba gafas de sol)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0118, 20, 14), new THREE.MeshStandardMaterial({ color: 0xF1ECE4, roughness: 0.35 }));
      eye.position.set(ex, ey - 0.001, z - 0.02); eye.scale.set(1.15, 0.8, 0.55);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0058, 20), new THREE.MeshStandardMaterial({ color: 0x3B2415, roughness: 0.3 }));
      iris.position.set(ex, ey - 0.001, z - 0.0131);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 16), new THREE.MeshBasicMaterial({ color: 0x080808 }));
      pupil.position.set(ex, ey - 0.001, z - 0.013);
      parts.push(eye, iris, pupil);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6), frame);
    between(bridge, rims[0].position.clone().add(new THREE.Vector3(-0.02, 0.004, 0)), rims[1].position.clone().add(new THREE.Vector3(0.02, 0.004, 0)));
    parts.push(bridge);
  }
  if (M.beard) {
    // Media barba: capa oscura semitransparente sobre la mandíbula, mentón, bigote y patillas (se mueve con la cara)
    H.meshes.forEach((m) => { if (/Beard/.test(m.material?.name || "")) m.visible = false; });
    // Máscara suave por vértice: línea de barba desde debajo de la nariz hasta la patilla, sin labios
    const hm = H.headMesh, P = g.P, idx = hm.geometry.index, n = P.length / 3;
    const ss = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const col = new Float32Array(n * 4), alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ax = Math.abs(P[i * 3] - g.C.x), dy = P[i * 3 + 1] - g.N.y, z = P[i * 3 + 2], fz = z - g.C.z;
      const U = ax < 0.045 ? -0.012 - 0.4 * ax : -0.03 + (ax - 0.045) * 2.6;
      let m = ss(-0.004, 0.006, U - dy) * ss(-0.118, -0.104, dy) * ss(-0.03, -0.015, fz);
      if (ax < 0.025 && dy < -0.021 && dy > -0.046 && z > g.N.z - 0.04) m *= 0.15;
      alpha[i] = m; col.set([0.018, 0.011, 0.007, 0.72 * m], i * 4);
    }
    const keep = [];
    for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (alpha[a] + alpha[b] + alpha[c] > 0.01) keep.push(a, b, c); }
    const bg = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(hm.geometry.attributes)) bg.setAttribute(k, v);
    bg.setAttribute("color", new THREE.BufferAttribute(col, 4));
    bg.setIndex(keep);
    const bm = new THREE.SkinnedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, vertexColors: true, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    bm.position.copy(hm.position); bm.quaternion.copy(hm.quaternion); bm.scale.copy(hm.scale);
    hm.parent.add(bm); bm.bind(hm.skeleton, hm.bindMatrix); bm.frustumCulled = false;
  }
  parts.forEach((m) => { H.root.add(m); B.Head.attach(m); });
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function setRot(j, x, y, z) {
  _q.setFromEuler(_e.set(x * D, y * D, z * D));
  j.bone.quaternion.copy(j.Pi).multiply(_q).multiply(j.P).multiply(j.q0);
}
function pose(H, p) {
  H.root.rotation.set(p.pitch * D, p.yaw * D, p.roll * D, "YXZ");
  H.J.sp.forEach((j) => setRot(j, p.spine / 3, p.tw / 3, 0));
  setRot(H.J.neck, p.head / 2, 0, 0); setRot(H.J.head, p.head / 2, 0, 0);
  for (const [L, s] of [["L", 1], ["R", -1]]) {
    setRot(H.J["sh" + L], -p["sh" + L], 0, s * p["ab" + L]);
    setRot(H.J["el" + L], -p["el" + L], 0, s * p["elz" + L]);
    setRot(H.J["hip" + L], -p["hip" + L], 0, s * p["hab" + L]);
    setRot(H.J["knee" + L], p["knee" + L], 0, 0);
    setRot(H.J["ank" + L], p["ank" + L], 0, 0);
  }
  H.J.fingers.forEach((j) => setRot(j, 0, 0, -j.sg * H.grip));
}
function anchorPos(H, a) {
  const B = H.B;
  if (a === "feet") return W(B.LeftFoot).add(W(B.RightFoot)).multiplyScalar(0.5);
  if (a === "toes") return W(B.LeftToeBase).add(W(B.RightToeBase)).multiplyScalar(0.5);
  return W(B.LeftFoot);
}

// ---------- Músculos que brillan ----------
// Punto interior del músculo + dirección hacia la piel: se busca la superficie real del modelo (hombre o mujer)
function muscleSpots(H, name) {
  const B = H.B, P = (b, off = [0, 0, 0]) => W(B[b]).add(new THREE.Vector3(...off));
  const L = (a, b, t) => W(B[a]).lerp(W(B[b]), t);
  const both = (fn) => [["Left", 1], ["Right", -1]].map(([s, sg]) => fn(s, sg));
  switch (name) {
    case "cuadriceps": return both((s) => ({ bone: s + "UpLeg", at: L(s + "UpLeg", s + "Leg", 0.45), dir: [0, 0, 1], size: [0.055, 0.15, 0.035] }));
    case "isquios": return both((s) => ({ bone: s + "UpLeg", at: L(s + "UpLeg", s + "Leg", 0.45), dir: [0, 0, -1], size: [0.055, 0.14, 0.035] }));
    case "gluteos": return both((s) => ({ bone: "Hips", at: L("Hips", s + "UpLeg", 0.85).add(new THREE.Vector3(0, -0.04, 0)), dir: [0, 0, -1], size: [0.075, 0.08, 0.05] }));
    case "gemelos": return both((s) => ({ bone: s + "Leg", at: L(s + "Leg", s + "Foot", 0.28), dir: [0, 0, -1], size: [0.042, 0.09, 0.03] }));
    case "fascia": return both((s) => ({ bone: s + "Foot", at: L(s + "Foot", s + "ToeBase", 0.55), dir: [0, -1, 0], size: [0.035, 0.012, 0.08] }));
    case "pecho": return both((s, sg) => ({ bone: "Spine2", at: P("Spine2", [sg * 0.075, 0.02, 0]), dir: [0, 0, 1], size: [0.07, 0.055, 0.03] }));
    case "abdomen": return [{ bone: "Spine1", at: L("Spine", "Spine1", 0.7), dir: [0, 0, 1], size: [0.075, 0.11, 0.03] }];
    case "espalda": return both((s, sg) => ({ bone: "Spine2", at: P("Spine2", [sg * 0.08, -0.02, 0]), dir: [0, 0, -1], size: [0.065, 0.13, 0.03] }));
    case "lumbar": return both((s, sg) => ({ bone: "Spine", at: P("Spine", [sg * 0.045, 0.02, 0]), dir: [0, 0, -1], size: [0.03, 0.07, 0.022] }));
    case "hombros": return both((s, sg) => ({ bone: s + "Arm", at: P(s + "Arm", [0, -0.02, 0]), dir: [sg, 0, 0], size: [0.05, 0.07, 0.06] }));
    case "biceps": return both((s) => ({ bone: s + "Arm", at: L(s + "Arm", s + "ForeArm", 0.5), dir: [0, 0, 1], size: [0.03, 0.07, 0.025] }));
    case "triceps": return both((s) => ({ bone: s + "Arm", at: L(s + "Arm", s + "ForeArm", 0.5), dir: [0, 0, -1], size: [0.03, 0.07, 0.025] }));
  }
  return [];
}
function addMuscles(H, list) {
  const ray = new THREE.Raycaster(), mats = [], halos = [];
  const geo = new THREE.SphereGeometry(1, 24, 16);
  H.root.updateMatrixWorld(true);
  list.forEach((name) => muscleSpots(H, name).forEach(({ bone, at, dir, size }) => {
    const d = new THREE.Vector3(...dir).normalize(), s = size.map((x) => x * H.k);
    ray.set(at.clone().addScaledVector(d, 0.6), d.clone().negate()); ray.far = 0.6;
    const hit = ray.intersectObjects(H.meshes, false)[0];
    const depth = Math.abs(d.x) * s[0] + Math.abs(d.y) * s[1] + Math.abs(d.z) * s[2];
    const c = hit ? hit.point.clone().addScaledVector(d, -depth * 0.45) : at.clone().addScaledVector(d, 0.06);
    const mat = new THREE.MeshStandardMaterial({ color: 0xE53935, emissive: 0xFF2211, emissiveIntensity: 0.8, roughness: 0.4, transparent: true, opacity: 0.88 });
    const m = new THREE.Mesh(geo, mat); m.position.copy(c); m.scale.set(...s); m.renderOrder = 2;
    const hm = new THREE.MeshBasicMaterial({ color: 0xFF3B30, transparent: true, opacity: 0.22, depthWrite: false, depthTest: false });
    const h = new THREE.Mesh(geo, hm); h.scale.setScalar(1.5); h.renderOrder = 3; m.add(h);
    H.root.add(m); H.B[bone].attach(m);
    mats.push(mat); halos.push(hm);
  }));
  return { mats, halos };
}

// ---------- Material ----------
function dumbbell(mat, k) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26 * k, 12), mat); bar.rotation.x = Math.PI / 2; g.add(bar);
  for (const z of [-0.1 * k, 0.1 * k]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20), mat); p.rotation.x = Math.PI / 2; p.position.z = z; g.add(p);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}
// Silla o banco con el asiento a la altura indicada (y opcionalmente respaldo detrás)
function chair(color, x, seat, z, back) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const part = (w, h, d, px, py, pz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.castShadow = true; b.receiveShadow = true; g.add(b); };
  part(0.44, 0.04, 0.42, 0, seat - 0.02, 0);
  for (const lx of [-0.19, 0.19]) for (const lz of [-0.18, 0.18]) part(0.035, seat - 0.04, 0.035, lx, (seat - 0.04) / 2, lz);
  if (back) part(0.44, 0.45, 0.035, 0, seat + 0.22, -0.2);
  g.position.set(x, 0, z);
  return g;
}
const UP = new THREE.Vector3(0, 1, 0);
function between(m, a, b) {
  const d = b.clone().sub(a), L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(1, L, 1);
}
function empty(H, bone, pos) { const o = new THREE.Object3D(); o.position.copy(pos); H.root.add(o); H.B[bone].attach(o); return o; }

export function hasAnim(key) { return !!ANIMS[key]; }

export async function mountViewer(host, key, muscles, who = "carlos", opts = {}) {
  const A = ANIMS[key];
  if (!A.R) A.R = A.frames.map(resolve);
  const buf = await modelBuffer(who);
  const gltf = await new GLTFLoader().parseAsync(buf, new URL("./modelos/", import.meta.url).href);
  const H = rigHuman(gltf, who), B = H.B, k = H.k;

  // Agarres y mancuernas (con los brazos rectos hacia abajo, antes de mover nada)
  const metal = new THREE.MeshStandardMaterial({ color: 0x33383D, roughness: 0.35, metalness: 0.6 });
  const grip = {};
  for (const [L, s, sg] of [["L", "Left", 1], ["R", "Right", -1]]) {
    const p = W(B[s + "Hand"]).lerp(W(B[s + "HandMiddle1"] || B[s + "Hand"]), 0.85).add(new THREE.Vector3(-sg * 0.015, 0, 0));
    grip[L] = empty(H, s + "Hand", p);
  }
  if (A.db === "hands" || A.db === "right") {
    H.grip = 70;
    for (const L of A.db === "hands" ? ["L", "R"] : ["R"]) {
      const d = dumbbell(metal, k); d.position.copy(W(grip[L])); H.root.add(d); B[L === "L" ? "LeftHand" : "RightHand"].attach(d);
    }
  }
  if (A.db === "chest") {
    H.grip = 55;
    const d = dumbbell(metal, k); d.rotation.x = Math.PI / 2; d.position.copy(W(B.Spine2)).add(new THREE.Vector3(0, -0.02, 0.2 * k));
    H.root.add(d); B.Spine2.attach(d);
  }
  if (A.strap) H.grip = 60;
  const knee = A.kneeBand ? ["Left", "Right"].map((s, i) => empty(H, s + "UpLeg", W(B[s + "Leg"]).add(new THREE.Vector3((i ? -0.07 : 0.07) * k, 0.05 * k, 0)))) : null;
  const footStrap = A.strap ? empty(H, "LeftFoot", W(B.LeftToeBase).add(new THREE.Vector3(0, -0.02, 0.03))) : null;
  styleHead(H, who);
  const glow = addMuscles(H, muscles || []);

  const Wd = host.clientWidth || 320, Hd = host.clientHeight || 320;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(Wd, Hd);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, Wd / Hd, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xB9C7BD, 1.5));
  const sun = new THREE.DirectionalLight(0xFFF6EC, 2.2);
  sun.position.set(2, 4.5, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xDDE8FF, 0.8); fill.position.set(-3, 2, -2); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshStandardMaterial({ color: 0xE3EAE1, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  scene.add(H.root);

  const pink = new THREE.MeshStandardMaterial({ color: 0xCF3F73, roughness: 0.6 });
  const towelMat = new THREE.MeshStandardMaterial({ color: 0x8FB8DE, roughness: 1 });
  const cyl = (r, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat); m.castShadow = true; scene.add(m); return m; };
  let band = null;
  if (A.band) {
    band = { a: new THREE.Vector3(...A.band), l: cyl(0.009, pink), r: cyl(0.009, pink) };
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, A.band[1] + 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xC9B79C, roughness: 0.9 }));
    post.position.set(A.band[0], (A.band[1] + 0.2) / 2, A.band[2] + 0.05); post.castShadow = true; scene.add(post);
  }
  const kneeMesh = knee ? cyl(0.016, pink) : null;
  const strap = footStrap ? [cyl(0.018, towelMat), cyl(0.018, towelMat)] : null;

  // Recorrido completo: apoyo en el suelo y punto fijo (pies, puntas…) en cada instante, calculado una vez
  const floorY = A.mat ? 0.015 : 0, T = period(A), N = A.cycle && A.linear ? 16 : 28;
  const standY = (A.step || 0) + (A.towelRoll ? 0.03 : 0);
  let ref = null;
  const offs = [], all = new THREE.Box3(), bx = new THREE.Box3();
  for (let i = 0; i < N; i++) {
    pose(H, sample(A, (i / N) * T));
    H.root.position.set(0, 0, 0); H.root.updateMatrixWorld(true);
    const o = new THREE.Vector3();
    if (A.anchor) { const a = anchorPos(H, A.anchor); if (!ref) ref = a.clone(); o.x = ref.x - a.x; o.z = ref.z - a.z; }
    meshBox(H.meshes, 3, bx);
    if (A.ground === "toes") o.y = standY - (Math.min(W(B.LeftToeBase).y, W(B.RightToeBase).y) - H.toeR);
    else o.y = floorY - bx.min.y;
    offs.push(o); bx.translate(o); all.union(bx);
  }
  const at = (t) => {
    pose(H, sample(A, t));
    const x = ((((t % T) + T) % T) / T) * N, i = Math.floor(x) % N, u = x - Math.floor(x);
    H.root.position.copy(offs[i]).lerp(offs[(i + 1) % N], u);
    H.root.updateMatrixWorld(true);
  };

  // Objetos fijos colocados según la postura
  const wood = 0xB08D66;
  at(0);
  if (A.mat) {
    const c = all.getCenter(new THREE.Vector3()), sz = all.getSize(new THREE.Vector3());
    const mat = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.62, sz.x + 0.1), 0.015, Math.max(1.85, sz.z + 0.15)), new THREE.MeshStandardMaterial({ color: 0x5E8F77, roughness: 0.9 }));
    mat.position.set(c.x, 0.0075, c.z); mat.receiveShadow = true; scene.add(mat);
  }
  if (A.step) {
    const toe = W(B.LeftToeBase).add(W(B.RightToeBase)).multiplyScalar(0.5);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.75, A.step, 0.34), new THREE.MeshStandardMaterial({ color: wood, roughness: 0.8 }));
    st.position.set(toe.x, A.step / 2, toe.z + 0.11); st.castShadow = true; st.receiveShadow = true; scene.add(st);
    if (A.towelRoll) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 16), towelMat);
      roll.rotation.z = Math.PI / 2; roll.position.set(toe.x, A.step + 0.02, toe.z + 0.03); roll.castShadow = true; scene.add(roll);
    }
  }
  if (A.bench) { const g = W(grip.L); scene.add(chair(wood, g.x, Math.max(0.3, g.y - 0.035), g.z, false)); }
  if (A.chair) {
    at(A.dur || 1.3);
    const hip = W(B.Hips);
    scene.add(chair(wood, hip.x, Math.max(0.3, hip.y - 0.13 * k), hip.z - 0.06, true));
    at(0);
  }
  if (A.wall) {
    at(T / 2);
    const z = Math.max(W(grip.L).z, W(grip.R).z) + 0.05;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0xF1EDE6, roughness: 0.95 }));
    wall.position.set(0, 1.05, z + 0.03); wall.receiveShadow = true; scene.add(wall);
    all.expandByPoint(new THREE.Vector3(0, 0, z)); at(0);
  }

  // Cámara: encuadra el recorrido completo a lo alto y a lo ancho
  const target = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  if (opts.face) { size.set(0.25, 0.25, 0.25); target.copy(W(B.Head)).add(new THREE.Vector3(0, 0.08, 0)); }
  const tv = Math.tan(15 * D), asp = Wd / Hd;
  const dist = Math.max(size.y / 2 / tv * 1.15, Math.max(size.x, size.z) / 2 / (tv * asp) * 1.2) + Math.min(size.x, size.z) / 2 + 0.2;
  let az = (opts.az ?? A.az ?? 50) * D, el = (opts.el ?? A.el ?? 12) * D;
  const place = () => {
    cam.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    cam.lookAt(target);
  };
  place();
  host.appendChild(renderer.domElement);

  const cv = renderer.domElement; let drag = null;
  cv.style.touchAction = "none"; cv.style.cursor = "grab";
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, az, el }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    az = drag.az - (e.clientX - drag.x) * 0.012; el = clamp(drag.el + (e.clientY - drag.y) * 0.006, -0.05, 1.3); place();
  });
  const upEv = () => (drag = null); cv.addEventListener("pointerup", upEv); cv.addEventListener("pointercancel", upEv);

  let playing = false, t = 0, last = performance.now(), raf = 0;
  function draw(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) t += dt;
    at(t);
    if (band) { between(band.l, W(grip.L), band.a); between(band.r, W(grip.R), band.a); }
    if (kneeMesh) between(kneeMesh, W(knee[0]), W(knee[1]));
    if (strap) { const f = W(footStrap); between(strap[0], W(grip.L), f); between(strap[1], W(grip.R), f); }
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    glow.mats.forEach((m) => (m.emissiveIntensity = 0.45 + 0.75 * pulse));
    glow.halos.forEach((m) => (m.opacity = 0.1 + 0.2 * pulse));
    renderer.render(scene, cam);
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  return {
    toggle() { playing = !playing; return playing; },
    get playing() { return playing; },
    seek(s) { t = s; },
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); });
      });
      renderer.dispose(); cv.remove();
    },
  };
}
