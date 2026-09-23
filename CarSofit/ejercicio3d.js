// CarSofit · visor 3D de ejercicios: maniquí articulado, músculo trabajado en rojo brillante y movimiento con play.
// Se carga solo al abrir un ejercicio (import dinámico desde app.html). Three.js va en vendor/ para funcionar sin CDN.
import * as THREE from "./vendor/three.module.min.js";

const D = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Posturas ----------
// Ángulos en grados. pitch: inclinación del cuerpo entero (90 boca abajo, -90 boca arriba).
// sh: flexión de hombro (brazo adelante), ab: abducción (brazo al lado), el: flexión de codo, elz: antebrazo hacia arriba con el brazo abierto.
// hip: flexión de cadera, hab: abducción de cadera, knee: flexión de rodilla, ank: flexión plantar (si falta, pie plano en el suelo).
const KEYS = ["pitch", "spine", "head", "shL", "shR", "abL", "abR", "elL", "elR", "elzL", "elzR", "hipL", "hipR", "habL", "habR", "kneeL", "kneeR", "ankL", "ankR"];
const STAND = { abL: 6, abR: 6 };
const SUPINE_KNEES = { pitch: -90, hipL: 60, hipR: 60, kneeL: 108, kneeR: 108, abL: 12, abR: 12 };
const QUAD = { pitch: 90, shL: 90, shR: 90, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, ankL: 90, ankR: 90 };
const DEADBUG = { pitch: -90, shL: 90, shR: 90, hipL: 90, hipR: 90, kneeL: 90, kneeR: 90, ankL: 0, ankR: 0 };
const GOBLET = { shL: 30, shR: 30, elL: 120, elR: 120, abL: -14, abR: -14 };

const ANIMS = {
  squat: { frames: [GOBLET, { ...GOBLET, hipL: 100, hipR: 100, kneeL: 112, kneeR: 112, spine: 34, habL: 10, habR: 10 }], db: "chest", anchor: "feet" },
  squatbw: { frames: [{ shL: 80, shR: 80, abL: 6, abR: 6 }, { shL: 85, shR: 85, abL: 6, abR: 6, hipL: 95, hipR: 95, kneeL: 105, kneeR: 105, spine: 30, habL: 10, habR: 10 }], anchor: "feet" },
  floorpress: { frames: [{ ...SUPINE_KNEES, abL: 65, abR: 65, elL: 90, elR: 90 }, { ...SUPINE_KNEES, shL: 90, shR: 90, abL: 8, abR: 8 }], db: "hands", mat: true, az: 78 },
  row: {
    frames: [
      { pitch: 55, hipL: 70, hipR: 70, kneeL: 25, kneeR: 25, spine: 5, head: -25, shL: 60, elL: 20, shR: 55, elR: 5, abL: 6, abR: 6 },
      { pitch: 55, hipL: 70, hipR: 70, kneeL: 25, kneeR: 25, spine: 5, head: -25, shL: 60, elL: 20, shR: -5, elR: 75, abL: 6, abR: 10 },
    ], db: "right", anchor: "feet", az: 70,
  },
  rowband: { frames: [{ shL: 78, shR: 78, abL: 4, abR: 4 }, { shL: -12, shR: -12, elL: 95, elR: 95, abL: 4, abR: 4 }], band: [0, 1.1, 1.3], anchor: "feet", az: 60 },
  bridge: {
    frames: [
      { pitch: -90, hipL: 60, hipR: 60, kneeL: 110, kneeR: 110, abL: 12, abR: 12 },
      { pitch: -115, hipL: 0, hipR: 0, kneeL: 115, kneeR: 115, head: 25, shL: -25, shR: -25, abL: 12, abR: 12 },
    ], mat: true, anchor: "feet", az: 82,
  },
  plank: {
    frames: [
      { pitch: 84, shL: 84, shR: 84, elL: 90, elR: 90, ankL: 0, ankR: 0 },
      { pitch: 84, spine: -3, head: -4, shL: 84, shR: 84, elL: 90, elR: 90, ankL: 5, ankR: 5 },
    ], mat: true, anchor: "feet", az: 80, dur: 1.8,
  },
  heel: { frames: [STAND, { ...STAND, ankL: 38, ankR: 38 }], anchor: "toes", az: 70, dur: 1.4 },
  lunge: { frames: [{ abL: 8, abR: 8 }, { hipL: 85, kneeL: 90, hipR: -15, kneeR: 78, ankR: -30, spine: 5, abL: 8, abR: 8 }], db: "hands", anchor: "footL", az: 75 },
  rdl: { frames: [{ kneeL: 5, kneeR: 5, abL: 4, abR: 4 }, { pitch: 72, hipL: 82, hipR: 82, kneeL: 20, kneeR: 20, shL: 72, shR: 72, head: -20, abL: 4, abR: 4 }], db: "hands", anchor: "feet", az: 72 },
  press: { frames: [{ abL: 80, abR: 80, elzL: 95, elzR: 95 }, { abL: 168, abR: 168, elzL: 8, elzR: 8 }], db: "hands", anchor: "feet", az: 30 },
  facepull: { frames: [{ shL: 88, shR: 88, abL: 6, abR: 6 }, { shL: 15, shR: 15, abL: 80, abR: 80, elzL: 105, elzR: 105 }], band: [0, 1.55, 1.3], anchor: "feet", az: 40 },
  deadbug: {
    frames: [DEADBUG, { ...DEADBUG, shR: 175, hipL: 15, kneeL: 5 }, DEADBUG, { ...DEADBUG, shL: 175, hipR: 15, kneeR: 5 }],
    cycle: true, mat: true, az: 70, dur: 1.1,
  },
  birddog: {
    frames: [QUAD, { ...QUAD, shR: 180, hipL: 0, kneeL: 0, ankL: 30 }, QUAD, { ...QUAD, shL: 180, hipR: 0, kneeR: 0, ankR: 30 }],
    cycle: true, mat: true, az: 65, dur: 1.2,
  },
  mob: { frames: [{ ...QUAD, spine: -10, shL: 80, shR: 80, head: -25 }, { ...QUAD, spine: 12, shL: 102, shR: 102, head: 35 }], mat: true, az: 75, dur: 1.6 },
  pilates: {
    frames: [
      { ...DEADBUG, spine: 28, head: 20, shL: 22, shR: 22 },
      { ...DEADBUG, spine: 28, head: 20, shL: 8, shR: 8 },
    ], mat: true, az: 75, dur: 0.45,
  },
  breath: { frames: [SUPINE_KNEES, { ...SUPINE_KNEES, spine: -3, head: 3 }], mat: true, az: 78, dur: 2.4 },
  stretch: { frames: [STAND, { pitch: 78, hipL: 82, hipR: 82, kneeL: 4, kneeR: 4, shL: 84, shR: 84, head: -10, abL: 4, abR: 4 }], anchor: "feet", az: 75, dur: 2 },
  fascia: { frames: [STAND, { pitch: 18, hipL: 45, kneeL: 50, hipR: -8, kneeR: 0, shL: 105, shR: 105, abL: 6, abR: 6 }], anchor: "footL", wall: true, az: 80, dur: 1.8 },
  walk: {
    frames: [
      { hipL: 25, kneeL: 5, hipR: -15, kneeR: 12, shL: -22, shR: 22, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipL: 5, kneeL: 8, hipR: 25, kneeR: 55, shL: 0, shR: 0, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipR: 25, kneeR: 5, hipL: -15, kneeL: 12, shR: -22, shL: 22, elL: 20, elR: 20, abL: 5, abR: 5 },
      { hipR: 5, kneeR: 8, hipL: 25, kneeL: 55, shL: 0, shR: 0, elL: 20, elR: 20, abL: 5, abR: 5 },
    ],
    cycle: true, linear: true, az: 80, dur: 0.42,
  },
  curl: { frames: [{ abL: 5, abR: 5 }, { elL: 140, elR: 140, abL: 5, abR: 5 }], db: "hands", anchor: "feet", az: 55 },
};

// Pie plano por defecto: el ángulo del tobillo compensa cadera, rodilla e inclinación del cuerpo
function resolve(p) {
  const o = {};
  KEYS.forEach((k) => (o[k] = p[k] ?? 0));
  for (const L of ["L", "R"]) if (p["ank" + L] === undefined) o["ank" + L] = clamp(o["hip" + L] - o["knee" + L] - o.pitch, -35, 60);
  return o;
}
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

// ---------- Maniquí ----------
const MUSCLES = {
  cuadriceps: [["hip", [0, -0.21, 0.05], [0.06, 0.15, 0.04]]],
  isquios: [["hip", [0, -0.22, -0.05], [0.058, 0.15, 0.04]]],
  gluteos: [["pelvis", [0.075, -0.05, -0.1], [0.085, 0.085, 0.06], true]],
  gemelos: [["knee", [0, -0.12, -0.04], [0.045, 0.11, 0.04]]],
  fascia: [["ank", [0, -0.05, 0.07], [0.036, 0.014, 0.1]]],
  pecho: [["spine", [0.08, 0.43, 0.1], [0.085, 0.065, 0.04], true]],
  abdomen: [["spine", [0, 0.2, 0.11], [0.085, 0.13, 0.035]]],
  espalda: [["spine", [0.09, 0.36, -0.1], [0.075, 0.15, 0.04], true]],
  lumbar: [["spine", [0.04, 0.12, -0.105], [0.03, 0.09, 0.028], true]],
  hombros: [["sh", [0, -0.01, 0], [0.075, 0.075, 0.075]]],
  biceps: [["sh", [0, -0.15, 0.04], [0.034, 0.09, 0.03]]],
  triceps: [["sh", [0, -0.15, -0.04], [0.034, 0.09, 0.03]]],
};

function buildFigure() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xE8CDB5, roughness: 0.55 });
  const shorts = new THREE.MeshStandardMaterial({ color: 0x3B4A52, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x1E7650, roughness: 0.75 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xF4F4F2, roughness: 0.6 });
  const J = {}, body = [];
  const group = (parent, x, y, z, name) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); J[name] = g; return g; };
  const add = (parent, geo, mat, x, y, z, s) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (s) m.scale.set(...s);
    m.castShadow = true; parent.add(m); body.push(m); return m;
  };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
  const sph = (r) => new THREE.SphereGeometry(r, 24, 16);

  const root = group(null, 0, 0, 0, "root");
  const pelvis = group(root, 0, 0, 0, "pelvis");
  add(pelvis, sph(0.16), shorts, 0, -0.02, 0, [1.15, 0.75, 0.85]);
  const spine = group(pelvis, 0, 0.06, 0, "spine");
  add(spine, cap(0.15, 0.3), shirt, 0, 0.28, 0, [1.2, 1, 0.75]);
  const head = group(spine, 0, 0.6, 0, "head");
  add(head, cap(0.05, 0.06), skin, 0, 0.03, 0);
  add(head, sph(0.11), skin, 0, 0.17, 0.01, [0.95, 1.08, 1]);
  add(head, sph(0.02), skin, 0, 0.16, 0.115);
  for (const s of [1, -1]) {
    const L = s > 0 ? "L" : "R";
    const sh = group(spine, 0.22 * s, 0.5, 0, "sh" + L);
    add(sh, sph(0.066), shirt, 0, 0, 0);
    add(sh, cap(0.05, 0.2), skin, 0, -0.15, 0);
    const el = group(sh, 0, -0.3, 0, "el" + L);
    add(el, cap(0.043, 0.18), skin, 0, -0.13, 0);
    const hand = group(el, 0, -0.27, 0, "hand" + L);
    add(hand, sph(0.045), skin, 0, -0.02, 0, [0.8, 1.1, 0.6]);
    const hip = group(pelvis, 0.1 * s, -0.06, 0, "hip" + L);
    add(hip, cap(0.072, 0.3), skin, 0, -0.21, 0);
    add(hip, cap(0.08, 0.08), shorts, 0, -0.08, 0);
    const knee = group(hip, 0, -0.43, 0, "knee" + L);
    add(knee, cap(0.052, 0.28), skin, 0, -0.2, 0);
    const ank = group(knee, 0, -0.42, 0, "ank" + L);
    add(ank, new THREE.BoxGeometry(0.09, 0.06, 0.25), shoe, 0, -0.03, 0.06);
    group(ank, 0, -0.06, 0.18, "toe" + L);
  }
  return { J, body, root };
}

// Músculos activos: rojo con brillo pulsante y un halo alrededor
function addMuscles(fig, list) {
  const mats = [], halos = [];
  const geo = new THREE.SphereGeometry(1, 24, 16);
  list.forEach((name) => (MUSCLES[name] || []).forEach(([parent, pos, scale, mirror]) => {
    const parents = ["hip", "knee", "ank", "sh"].includes(parent) ? [[fig.J[parent + "L"], 1], [fig.J[parent + "R"], 1]]
      : mirror ? [[fig.J[parent], 1], [fig.J[parent], -1]] : [[fig.J[parent], 1]];
    parents.forEach(([g, sx]) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xE53935, emissive: 0xFF2211, emissiveIntensity: 0.8, roughness: 0.4 });
      const m = new THREE.Mesh(geo, mat); m.position.set(pos[0] * sx, pos[1], pos[2]); m.scale.set(...scale);
      const hm = new THREE.MeshBasicMaterial({ color: 0xFF3B30, transparent: true, opacity: 0.25, depthWrite: false });
      const h = new THREE.Mesh(geo, hm); h.scale.setScalar(1.45); m.add(h);
      g.add(m); mats.push(mat); halos.push(hm);
    });
  }));
  return { mats, halos };
}

function dumbbell(mat) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 10), mat); bar.rotation.x = Math.PI / 2; g.add(bar);
  for (const z of [-0.1, 0.1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 18), mat); p.rotation.x = Math.PI / 2; p.position.z = z; g.add(p);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function applyPose(J, p) {
  J.root.rotation.set(p.pitch * D, 0, 0);
  J.spine.rotation.set(p.spine * D, 0, 0);
  J.head.rotation.set(p.head * D, 0, 0);
  for (const [L, s] of [["L", 1], ["R", -1]]) {
    J["sh" + L].rotation.set(-p["sh" + L] * D, 0, s * p["ab" + L] * D);
    J["el" + L].rotation.set(-p["el" + L] * D, 0, s * p["elz" + L] * D);
    J["hip" + L].rotation.set(-p["hip" + L] * D, 0, s * p["hab" + L] * D);
    J["knee" + L].rotation.set(p["knee" + L] * D, 0, 0);
    J["ank" + L].rotation.set(p["ank" + L] * D, 0, 0);
  }
}

// Coloca el cuerpo: fija el punto de apoyo (pies, puntas…) y apoya en el suelo lo que quede más bajo
const box = new THREE.Box3();
function anchorPos(J, a) {
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  if (a === "feet") return J.ankL.getWorldPosition(v).add(J.ankR.getWorldPosition(w)).multiplyScalar(0.5);
  if (a === "toes") return J.toeL.getWorldPosition(v).add(J.toeR.getWorldPosition(w)).multiplyScalar(0.5);
  return J.ankL.getWorldPosition(v);
}
function settle(fig, A, floorY) {
  const r = fig.J.root;
  r.position.set(0, 0, 0); r.updateMatrixWorld(true);
  if (A.anchor) {
    const a = anchorPos(fig.J, A.anchor);
    if (!A.ref) A.ref = a.clone();
    r.position.x = A.ref.x - a.x; r.position.z = A.ref.z - a.z; r.updateMatrixWorld(true);
  }
  box.makeEmpty(); fig.body.forEach((m) => box.expandByObject(m, true));
  r.position.y = floorY - box.min.y; r.updateMatrixWorld(true);
}

const UP = new THREE.Vector3(0, 1, 0);
function between(m, a, b) {
  const d = b.clone().sub(a), L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(1, L, 1);
}

export function hasAnim(key) { return !!ANIMS[key]; }

export function mountViewer(host, key, muscles) {
  const A = ANIMS[key];
  if (!A.R) A.R = A.frames.map(resolve);
  const W = host.clientWidth || 320, H = host.clientHeight || 300;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xC9D6CD, 1.2));
  const sun = new THREE.DirectionalLight(0xFFFFFF, 1.7);
  sun.position.set(2, 4.5, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 }); sun.shadow.radius = 4;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 56), new THREE.MeshStandardMaterial({ color: 0xE3EAE1, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const fig = buildFigure(); scene.add(fig.root);
  const glow = addMuscles(fig, muscles || []);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3A3F44, roughness: 0.35, metalness: 0.6 });
  if (A.db === "hands" || A.db === "right") for (const L of A.db === "hands" ? ["L", "R"] : ["R"]) { const d = dumbbell(metal); d.position.y = -0.04; fig.J["hand" + L].add(d); }
  if (A.db === "chest") { const d = dumbbell(metal); d.rotation.x = Math.PI / 2; d.position.set(0, 0.42, 0.27); fig.J.spine.add(d); }
  const floorY = A.mat ? 0.015 : 0;
  let band = null;
  if (A.band) {
    const bm = new THREE.MeshStandardMaterial({ color: 0xCF3F73, roughness: 0.6 });
    const g = new THREE.CylinderGeometry(0.009, 0.009, 1, 8);
    band = { a: new THREE.Vector3(...A.band), l: new THREE.Mesh(g, bm), r: new THREE.Mesh(g, bm) };
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, A.band[1] + 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xC9B79C, roughness: 0.9 }));
    post.position.set(A.band[0], (A.band[1] + 0.2) / 2, A.band[2] + 0.05); post.castShadow = true;
    scene.add(band.l, band.r, post);
  }

  // Encuadre: el hueco que ocupa el movimiento completo
  const all = new THREE.Box3();
  A.R.forEach((p) => { applyPose(fig.J, p); settle(fig, A, floorY); box.makeEmpty(); fig.body.forEach((m) => box.expandByObject(m, true)); all.union(box); });
  if (A.mat) {
    const c = all.getCenter(new THREE.Vector3());
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 1.85), new THREE.MeshStandardMaterial({ color: 0x5E8F77, roughness: 0.9 }));
    mat.position.set(c.x, 0.0075, c.z); mat.receiveShadow = true; scene.add(mat);
  }
  if (A.wall) {
    // Pared donde apoya las manos en la postura final
    applyPose(fig.J, A.R.at(-1)); settle(fig, A, floorY);
    const z = Math.max(fig.J.handL.getWorldPosition(new THREE.Vector3()).z, fig.J.handR.getWorldPosition(new THREE.Vector3()).z) + 0.05;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0xF1EDE6, roughness: 0.95 }));
    wall.position.set(0, 1.05, z + 0.03); wall.receiveShadow = true; scene.add(wall);
    all.expandByPoint(new THREE.Vector3(0, 0, z));
  }
  const target = all.getCenter(new THREE.Vector3()), size = all.getSize(new THREE.Vector3());
  // Distancia para que quepa a lo alto y a lo ancho del recuadro, con margen
  const tv = Math.tan(15 * D), asp = W / H;
  const dist = Math.max(size.y / 2 / tv * 1.15, Math.max(size.x, size.z) / 2 / (tv * asp) * 1.2) + Math.min(size.x, size.z) / 2 + 0.2;
  let az = (A.az ?? 50) * D, el = 12 * D;
  const place = () => {
    cam.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    cam.lookAt(target);
  };
  place();

  // Girar arrastrando
  const cv = renderer.domElement; let drag = null;
  cv.style.touchAction = "none"; cv.style.cursor = "grab";
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, az, el }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    az = drag.az - (e.clientX - drag.x) * 0.012; el = clamp(drag.el + (e.clientY - drag.y) * 0.006, -0.05, 1.2); place();
  });
  const up = () => (drag = null); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

  let playing = false, t = 0, last = performance.now(), raf = 0;
  const hl = new THREE.Vector3(), hr = new THREE.Vector3();
  function draw(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) t += dt;
    applyPose(fig.J, sample(A, t)); settle(fig, A, floorY);
    if (band) { fig.J.handL.getWorldPosition(hl); fig.J.handR.getWorldPosition(hr); between(band.l, hl, band.a); between(band.r, hr, band.a); }
    const k = 0.5 + 0.5 * Math.sin(now / 260);
    glow.mats.forEach((m) => (m.emissiveIntensity = 0.45 + 0.75 * k));
    glow.halos.forEach((m) => (m.opacity = 0.12 + 0.22 * k));
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
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      renderer.dispose(); cv.remove();
    },
  };
}
