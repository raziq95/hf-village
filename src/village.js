import * as THREE from 'three';
import { BRAND } from './programs.js';

/* Koordinaten werden in BILD-Raum geschrieben: +x = rechts, +z = unten im Referenzbild.
   Die ganze Szene wird am Ende um 45° gedreht, damit die isometrische Ansicht entsteht. */

const C = {
  grass: 0xa2bd6a, grassLight: 0xb1c97a, grassDark: 0x8fac5d, grassEdge: 0x9bb666,
  dirt: 0xd3bd94, dirtSide: 0xbfa176, sand: 0xdccdaa, soil: 0xa88458,
  wall: 0xeee5cd, wallWarm: 0xe7d9b8, roof: 0x2f5fa8, roofDark: 0x25497f, roofRib: 0x3a67ad,
  trim: 0xf5f3ea, white: 0xf7f6f0, glass: 0xb9dbf1, stone: 0xb8b9b0, stoneDark: 0xa1a299,
  wood: 0xcb9f5d, woodDark: 0xa87c45, leaf: 0x87ac54, leafDark: 0x6b8f46, leafLight: 0x9bbd63,
  bark: 0x9c6d3d, thatch: 0xddc79a, thatchDark: 0xc4a97c, water: 0x5590c2, tank: 0x2f5fa8,
  crop: 0x86ae55, corn: 0xdcb954, metal: 0x9ba7b3, tyre: 0x303338,
  yellow: 0xdfb046, red: 0xbc5843, green: 0x568a4b, teal: 0x5f8fb8,
  skin: 0x9c6b45, skinDark: 0x7a5030, hair: 0x2c2118, goat: 0xf1f0e7, goatBrown: 0xa06a34,
  flower: 0xdec86a, cross: 0xc0463b, pitch: 0xaec97e
};

const M = {};
function mat(name, color, o = {}) {
  const key = name + color + (o.opacity || '') + (o.rough || '') + (o.flat ? 'f' : '') + (o.offset || '');
  if (!M[key]) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.0,
      transparent: !!o.opacity, opacity: o.opacity ?? 1,
      side: o.side || THREE.FrontSide, flatShading: !!o.flat
    });
    // Flache, übereinanderliegende Bodenschichten (Grasflecken, Pfade, Plattenauflagen)
    // brauchen einen Tiefen-Bias, sonst flimmern sie gegeneinander.
    if (o.offset) { m.polygonOffset = true; m.polygonOffsetFactor = o.offset; m.polygonOffsetUnits = 1; }
    m.name = name; M[key] = m;
  }
  return M[key];
}
const G = {};
const geo = (k, f) => (G[k] || (G[k] = f()));

function rbGeo(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001);
  return geo(`rb|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`, () => {
    const s = new THREE.Shape(), hw = w / 2 - r, hd = d / 2 - r;
    s.absarc(hw, hd, r, 0, Math.PI / 2, false);
    s.absarc(-hw, hd, r, Math.PI / 2, Math.PI, false);
    s.absarc(-hw, -hd, r, Math.PI, Math.PI * 1.5, false);
    s.absarc(hw, -hd, r, Math.PI * 1.5, Math.PI * 2, false);
    const bev = Math.min(r * 0.75, h / 3, 0.06);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 5 });
    g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); g.computeVertexNormals();
    return g;
  });
}
/** y = Mitte */
function rb(w, h, d, m, x = 0, y = 0, z = 0, r = 0.06, name = 'part') {
  const me = new THREE.Mesh(rbGeo(w, h, d, r), m);
  me.position.set(x, y - h / 2, z); me.name = name; me.castShadow = true; me.receiveShadow = true;
  return me;
}
/** y = Unterkante */
function bx(w, h, d, m, x = 0, y = 0, z = 0, name = 'part', sh = true) {
  const me = new THREE.Mesh(geo(`b|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  me.position.set(x, y + h / 2, z); me.name = name; me.castShadow = sh; me.receiveShadow = true;
  return me;
}
function cy(r1, r2, h, m, x = 0, y = 0, z = 0, seg = 20, name = 'part', sh = true) {
  const me = new THREE.Mesh(geo(`c|${r1}|${r2}|${h}|${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg)), m);
  me.position.set(x, y + h / 2, z); me.name = name; me.castShadow = sh; me.receiveShadow = true;
  return me;
}
function sp(r, m, x = 0, y = 0, z = 0, name = 'part', sh = true) {
  const me = new THREE.Mesh(geo(`s|${r}`, () => new THREE.SphereGeometry(r, 20, 14)), m);
  me.position.set(x, y, z); me.name = name; me.castShadow = sh; me.receiveShadow = true;
  return me;
}
function plane(w, d, m, x, y, z, name = 'plane') {
  const me = new THREE.Mesh(geo(`p|${w}|${d}`, () => new THREE.PlaneGeometry(w, d)), m);
  me.rotation.x = -Math.PI / 2; me.position.set(x, y, z); me.receiveShadow = true; me.name = name;
  return me;
}

/* ---------- Dächer, Fassadenteile ---------- */
function shedRoof(w, d, rise, over = 0.34, mRoof = mat('roof', C.roof, { rough: 0.62 })) {
  const g = new THREE.Group(); g.name = 'roof';
  const ang = Math.atan2(rise, d), len = Math.hypot(d, rise) + over;
  const inner = new THREE.Group();
  inner.add(rb(w + over * 2, 0.12, len, mRoof, 0, 0, 0, 0.05, 'roofSlab'));
  const ribM = mat('roofRib', C.roofRib, { rough: 0.5 });
  const n = Math.max(5, Math.round((w + over * 2) / 0.28));
  for (let i = 0; i <= n; i++)
    inner.add(bx(0.05, 0.03, len * 0.985, ribM, -(w + over * 2) / 2 + (i * (w + over * 2)) / n, 0.055, 0, 'rib', false));
  inner.add(bx(w + over * 2, 0.08, 0.08, mat('fascia', C.trim), 0, -0.03, len / 2 - 0.04, 'fascia', false));
  inner.rotation.x = -ang; inner.position.y = rise / 2;
  g.add(inner);
  return g;
}
function gableRoof(w, d, rise, over = 0.3) {
  const g = new THREE.Group(); g.name = 'roof';
  const half = d / 2 + over;
  [1, -1].forEach(s => {
    const side = shedRoof(w, half, rise, over * 0.7);
    side.rotation.y = s > 0 ? 0 : Math.PI;
    side.position.z = s * (half / 2 - over * 0.3);
    g.add(side);
  });
  g.add(bx(w + over * 1.7, 0.11, 0.17, mat('ridge', C.roofDark, { rough: 0.6 }), 0, rise - 0.055, 0, 'ridge', false));
  return g;
}
function winUnit(w = 0.55, h = 0.55) {
  const g = new THREE.Group(); g.name = 'window';
  g.add(rb(w + 0.12, h + 0.12, 0.08, mat('winFrame', C.roof, { rough: 0.6 }), 0, 0, 0, 0.03, 'frame'));
  g.add(rb(w - 0.02, h - 0.02, 0.05, mat('glass', C.glass, { rough: 0.12 }), 0, 0, 0.035, 0.02, 'glass'));
  g.add(bx(0.05, h + 0.12, 0.085, mat('winFrame', C.roof, { rough: 0.6 }), 0, -h / 2 - 0.06, 0.005, 'mullion', false));
  g.add(bx(w + 0.2, 0.07, 0.14, mat('sill', C.trim), 0, -h / 2 - 0.11, 0.02, 'sill', false));
  return g;
}
function doorUnit(w = 0.46, h = 0.82, col = C.roof) {
  const g = new THREE.Group(); g.name = 'door';
  g.add(rb(w + 0.12, h + 0.1, 0.08, mat('doorFrame', C.trim), 0, (h + 0.1) / 2 - 0.05, 0, 0.03, 'frame'));
  g.add(rb(w, h, 0.06, mat('doorLeaf', col, { rough: 0.7 }), 0, h / 2, 0.035, 0.03, 'leaf'));
  g.add(bx(0.03, h * 0.84, 0.065, mat('doorGap', C.roofDark), 0, h * 0.08, 0.05, 'gap', false));
  g.add(sp(0.035, mat('handle', C.metal, { rough: 0.35, metal: 0.4 }), w * 0.33, h * 0.5, 0.08, 'handle', false));
  return g;
}
function building(w, d, h, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'building';
  g.add(rb(w + 0.3, 0.18, d + 0.3, mat('plinth', C.stone), 0, 0.09, 0, 0.05, 'plinth'));
  g.add(rb(w, h, d, mat('wall', o.wall || C.wall, { rough: 0.9 }), 0, 0.18 + h / 2, 0, 0.07, 'wall'));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    g.add(rb(0.13, h, 0.13, mat('pilaster', C.trim, { rough: 0.85 }), sx * (w / 2 - 0.02), 0.18 + h / 2, sz * (d / 2 - 0.02), 0.04, 'pilaster')));
  const rise = o.rise ?? 0.6;
  const roof = o.gable ? gableRoof(w, d, rise) : shedRoof(w, d, rise);
  roof.position.y = 0.18 + h + 0.03;
  g.add(roof);
  g.userData.top = 0.18 + h;
  return g;
}
function steps(w, d, x, z, ry = 0) {
  const g = new THREE.Group(); g.name = 'steps';
  g.add(rb(w, 0.11, d, mat('stone', C.stone), 0, 0.055, 0, 0.03, 'step1'));
  g.add(rb(w * 0.7, 0.1, d * 0.55, mat('stoneD', C.stoneDark), 0, 0.155, d * 0.25, 0.03, 'step2'));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function solarArray(w = 1.3, d = 0.85, cells = 3) {
  const g = new THREE.Group(); g.name = 'solarArray';
  g.add(rb(w, 0.06, d, mat('solarFrame', 0xdfe2e8, { rough: 0.4 }), 0, 0, 0, 0.02, 'frame'));
  const cM = mat('solarCell', 0x223377, { rough: 0.22, metal: 0.3 });
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < 2; j++)
      g.add(bx(w / cells - 0.06, 0.02, d / 2 - 0.08, cM, -w / 2 + (w / cells) * (i + 0.5), 0.035, (j ? 1 : -1) * d / 4, 'cell', false));
  return g;
}

/* ---------- Natur ---------- */
function tree(x, z, s = 1.32, v = 0) {
  const g = new THREE.Group(); g.name = 'tree';
  g.add(cy(0.062 * s, 0.1 * s, 1.05 * s, mat('bark', C.bark, { rough: 0.95 }), 0, 0, 0, 10, 'trunk'));
  const lobes = v === 1
    ? [[0, 1.28, 0, 0.46], [0.26, 1.04, 0.14, 0.31], [-0.24, 1.1, -0.1, 0.29], [0.05, 1.54, -0.05, 0.25]]
    : [[0, 1.24, 0, 0.5], [0.3, 1.0, 0.1, 0.3], [-0.26, 1.06, -0.14, 0.31], [0.08, 1.5, 0.1, 0.24]];
  lobes.forEach(([lx, ly, lz, lr], i) => {
    const sph = sp(lr * s, mat(i % 2 ? 'leafDark' : (v ? 'leafLight' : 'leaf'), i % 2 ? C.leafDark : (v ? C.leafLight : C.leaf), { rough: 0.95 }), lx * s, ly * s, lz * s, 'crown');
    sph.scale.set(1, 0.93, 1); g.add(sph);
  });
  g.position.set(x, 0, z); g.rotation.y = x * 1.7;
  return g;
}
function bush(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'bush';
  [[0, 0, 0.32], [0.26, 0.03, 0.22], [-0.22, -0.06, 0.24]].forEach(([bx_, bz, r], i) => {
    const b = sp(r * s, mat(i ? 'leafDark' : 'leaf', i ? C.leafDark : C.leaf, { rough: 0.95 }), bx_ * s, r * s * 0.8, bz * s, 'lobe');
    b.scale.set(1.18, 0.82, 1.12); g.add(b);
  });
  g.position.set(x, 0, z);
  return g;
}
function rocks(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'rocks';
  const n = 1 + (Math.abs(Math.round(x * 3 + z)) % 3);
  for (let i = 0; i < n; i++) {
    const r = new THREE.Mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.17, 0)),
      mat(i % 2 ? 'stoneD' : 'stone', i % 2 ? C.stoneDark : C.stone, { flat: true, rough: 0.95 }));
    r.position.set(i * 0.26 * s, 0.1 * s, (i % 2) * 0.22 * s);
    r.scale.setScalar(s * (0.85 + (i % 3) * 0.22)); r.rotation.set(0.5 * i, i * 1.3, 0.3);
    r.castShadow = true; r.receiveShadow = true; g.add(r);
  }
  g.position.set(x, 0, z);
  return g;
}
function tuft(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'tuft';
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(geo('blade', () => new THREE.ConeGeometry(0.05, 0.34, 5)), mat('leafDark', C.leafDark, { rough: 0.95 }));
    b.position.set((i - 2) * 0.055 * s, 0.17 * s, ((i % 2) * 0.06) * s);
    b.rotation.z = (i - 2) * 0.2; b.scale.setScalar(s); b.castShadow = false;
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}
function flowers(x, z, n = 4, col = C.flower) {
  const g = new THREE.Group(); g.name = 'flowers';
  for (let i = 0; i < n; i++) {
    const fx = Math.cos(i * 2.1) * 0.18, fz = Math.sin(i * 2.1) * 0.18;
    g.add(bx(0.022, 0.22, 0.022, mat('stem', C.leafDark), fx, 0, fz, 'stem', false));
    g.add(sp(0.06, mat('flower', col, { rough: 0.8 }), fx, 0.24, fz, 'bloom', false));
  }
  g.position.set(x, 0, z);
  return g;
}
/** erdbebenbeschädigtes Gebäude: geneigte Restwände, abgerutschtes Dach, Trümmer */
function ruin(x, z, ry = 0, s = 1) {
  const g = new THREE.Group(); g.name = 'ruin';
  const wallM = mat('ruinWall', 0xdcd2bb, { rough: 0.95 });
  const wallM2 = mat('ruinWall2', C.wallWarm, { rough: 0.95 });
  g.add(rb(2.9 * s, 0.16 * s, 2.3 * s, mat('ruinSlab', C.stoneDark, { rough: 0.96 }), 0, 0.08 * s, 0, 0.04, 'floorSlab'));

  // Stehengebliebene Wand mit gestaffelter Bruchkante
  [[-1.3, 1.15, 0.5], [-1.3, 0.82, 0.5], [-1.3, 0.55, 0.5]].forEach(([wx, h, wd], i) => {
    const w = rb(0.16 * s, h * s, wd * s, wallM, wx * s, (0.16 + h / 2) * s, (-0.7 + i * 0.55) * s, 0.02, 'wallStub');
    w.rotation.z = 0.04; g.add(w);
  });
  const back = rb(2.6 * s, 0.95 * s, 0.16 * s, wallM2, 0, (0.16 + 0.475) * s, -1.05 * s, 0.02, 'backWall');
  back.rotation.x = -0.06; g.add(back);
  // Abgebrochene Ecke, schief in den Boden gerammt
  const lean = rb(1.1 * s, 0.8 * s, 0.14 * s, wallM, 0.75 * s, 0.5 * s, 0.75 * s, 0.02, 'leaningWall');
  lean.rotation.set(0, 0.35, 0.42); g.add(lean);

  // Herabgestürztes Dachteil, auf den Trümmern aufliegend
  const roofPiece = rb(1.6 * s, 0.11 * s, 1.15 * s, mat('ruinRoof', C.roof, { rough: 0.6 }), 0.3 * s, 0.62 * s, 0.4 * s, 0.03, 'fallenRoof');
  roofPiece.rotation.set(0.62, 0.22, -0.44); g.add(roofPiece);
  const roofShard = rb(0.9 * s, 0.1 * s, 0.7 * s, mat('ruinRoof', C.roofDark, { rough: 0.6 }), -0.9 * s, 0.3 * s, 1.15 * s, 0.03, 'roofShard');
  roofShard.rotation.set(-0.5, -0.4, 0.2); g.add(roofShard);

  // Schutt
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.5 + (i % 4) * 0.35;
    const chunk = rb((0.14 + (i % 3) * 0.07) * s, (0.1 + (i % 2) * 0.06) * s, (0.13 + (i % 3) * 0.06) * s,
      i % 2 ? wallM : mat('rubble', C.stone, { rough: 0.97, flat: true }),
      Math.cos(a) * r * s, (0.16 + 0.05) * s, Math.sin(a) * r * 0.8 * s, 0.02, 'rubble');
    chunk.rotation.set(i * 0.3, i * 0.7, i * 0.25); g.add(chunk);
  }
  // verstreute Trümmer ausserhalb der Grundmauern
  [[1.5, 1.25], [1.85, 0.7], [-1.7, 1.35], [1.25, -1.3]].forEach(([cx, cz], i) => {
    const dbg = rb(0.2 * s, 0.12 * s, 0.17 * s, i % 2 ? mat('rubble', C.stone, { rough: 0.97, flat: true }) : wallM,
      cx * s, 0.06 * s, cz * s, 0.02, 'rubbleOuter');
    dbg.rotation.set(i * 0.4, i * 0.9, i * 0.3); g.add(dbg);
  });
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
/** Notunterkunft: Giebelzelt der Katastrophenhilfe */
function reliefTent(x, z, ry = 0, s = 1) {
  const g = new THREE.Group(); g.name = 'reliefTent';
  const h = 0.85 * s, hw = 0.6 * s, len = 1.5 * s;
  const slope = Math.hypot(h, hw);            // Länge der Zeltbahn vom Boden zum First
  const ang = Math.atan2(h, hw);              // Neigung, damit die Oberkante genau am First sitzt
  const canvasM = mat('tent', C.white, { rough: 0.85 });
  [1, -1].forEach(sd => {
    const side = rb(len, 0.05 * s, slope, canvasM, 0, h / 2, sd * hw / 2, 0.02, 'tentSide');
    side.rotation.x = sd * ang;
    g.add(side);
  });
  // First und Giebelwände
  g.add(bx(len, 0.05 * s, 0.05 * s, mat('tentRidge', C.roof, { rough: 0.7 }), -len / 2, h, 0, 'ridge', false));
  [1, -1].forEach(sd => {
    const gable = new THREE.Mesh(
      geo('tentGable', () => {
        const sh = new THREE.Shape();
        sh.moveTo(-0.6, 0); sh.lineTo(0.6, 0); sh.lineTo(0, 0.85); sh.closePath();
        return new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
      }),
      mat('tentGable', 0xe6e0d2, { rough: 0.9 })
    );
    gable.scale.setScalar(s);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(sd * len / 2, 0, 0);
    gable.castShadow = true; gable.receiveShadow = true;
    g.add(gable);
  });
  // Rotes Kreuz auf der zugewandten Zeltbahn
  const cross = new THREE.Group();
  cross.add(rb(0.28 * s, 0.075 * s, 0.02 * s, mat('cross', C.cross, { rough: 0.7 }), 0, 0, 0, 0.01, 'crossH'));
  cross.add(rb(0.075 * s, 0.28 * s, 0.02 * s, mat('cross', C.cross, { rough: 0.7 }), 0, 0, 0, 0.01, 'crossV'));
  cross.rotation.x = ang;
  cross.position.set(0, h / 2 + 0.02 * s, hw / 2 + 0.05 * s);
  g.add(cross);
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
const texCache = {};
const texLoader = new THREE.TextureLoader();
/**
 * Textur für ein Programm-Piktogramm. Die Vorlagen sind freigestellte PNGs mit
 * Alphakanal, daher genügt direktes Laden — das frühere Ausstanzen des weißen
 * Hintergrunds per Canvas entfällt.
 */
function iconTex(url) {
  if (!texCache[url]) {
    const t = texLoader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache[url] = t;
  }
  return texCache[url];
}
/** Informationsschild mit dem Piktogramm des Programms — steht frei vor dem Bereich */
function programSign(x, z, key, s = 1) {
  const b = BRAND[key];
  if (!b) return new THREE.Group();
  const g = new THREE.Group(); g.name = 'programSign_' + key;
  const w = 2.0 * s, h = 1.5 * s, postH = 1.15 * s;
  [-1, 1].forEach(sd => g.add(cy(0.055 * s, 0.06 * s, postH + 0.1,
    mat('signPost', C.woodDark, { rough: 0.9 }), sd * (w / 2 - 0.18 * s), 0, 0, 8, 'post')));
  // Weiße Tafel mit farbigem Rand: das freigestellte Piktogramm liegt in seiner
  // Markenfarbe darauf — wie im Original-Logo und dadurch klar lesbar.
  g.add(rb(w, h, 0.1 * s, mat('signEdge' + key, b.color, { rough: 0.7 }), 0, postH + h / 2, 0, 0.06, 'boardEdge'));
  g.add(rb(w - 0.17 * s, h - 0.17 * s, 0.07 * s, mat('signFace', C.white, { rough: 0.85 }), 0, postH + h / 2, 0.06 * s, 0.04, 'board'));
  const icon = new THREE.Mesh(
    geo('signIcon', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: iconTex(b.icon), transparent: true, alphaTest: 0.04 })
  );
  const iconSize = Math.min(w, h) - 0.34 * s;
  icon.scale.set(iconSize, iconSize, 1);
  // deutlich vor die Tafel: die abgerundete Extrusion ist durch ihre Fase dicker
  // als der angegebene Wert und verdeckte das Symbol sonst.
  icon.position.set(0, postH + h / 2, 0.2 * s);
  icon.name = 'icon';
  g.add(icon);
  g.position.set(x, 0, z);
  return g;
}
/** Kochstelle: Feuerstelle mit Dreibein-Topf und Sitzsteinen */
function campfire(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'campfire';
  // Steinkranz
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = rb(0.2 * s, 0.14 * s, 0.17 * s, mat('fireStone', i % 2 ? C.stone : C.stoneDark, { rough: 0.96, flat: true }),
      Math.cos(a) * 0.5 * s, 0.07 * s, Math.sin(a) * 0.5 * s, 0.03, 'ring');
    st.rotation.y = -a; g.add(st);
  }
  g.add(plane(1.0 * s, 1.0 * s, mat('ash', 0x6f6558, { rough: 0.98, offset: -3 }), 0, 0.03, 0, 'ash'));
  // Holzscheite
  [0, 1.1, 2.2].forEach((a, i) => {
    const log = cy(0.045 * s, 0.05 * s, 0.62 * s, mat('log', C.woodDark, { rough: 0.92 }), 0, 0.05 * s, 0, 6, 'log');
    log.rotation.set(Math.PI / 2, a, 0.1 * i); g.add(log);
  });
  // Flamme (mehrere Kegel, animiert)
  const flames = [];
  [[0, 0.42, 0.16, 0xe0913a], [0.07, 0.3, 0.12, 0xdcb954], [-0.06, 0.24, 0.1, 0xe0913a]]
    .forEach(([fx, fh, fr, col], i) => {
      const f = new THREE.Mesh(geo('flame' + i, () => new THREE.ConeGeometry(1, 1, 7)),
        mat('flame' + col, col, { rough: 0.5 }));
      f.scale.set(fr * s, fh * s, fr * s);
      f.position.set(fx * s, 0.16 * s + fh * s / 2, 0);
      f.castShadow = false; g.add(f); flames.push([f, fh * s, i]);
    });
  // Dreibein mit Topf
  [0, 2.1, 4.2].forEach(a => {
    const leg = cy(0.03 * s, 0.035 * s, 1.15 * s, mat('tripod', C.metal, { rough: 0.45, metal: 0.4 }),
      Math.cos(a) * 0.42 * s, 0, Math.sin(a) * 0.42 * s, 6, 'leg');
    leg.rotation.set(Math.sin(a) * 0.34, 0, -Math.cos(a) * 0.34); g.add(leg);
  });
  g.add(cy(0.26 * s, 0.22 * s, 0.26 * s, mat('pot', 0x4a4a4a, { rough: 0.6, metal: 0.25 }), 0, 0.62 * s, 0, 14, 'pot'));
  // Sitzsteine
  [[1.35, 0.5], [-1.2, 0.9], [0.3, -1.4]].forEach(([sx2, sz2], i) =>
    g.add(rb(0.42 * s, 0.22 * s, 0.36 * s, mat('seatStone', i % 2 ? C.stone : C.stoneDark, { rough: 0.96, flat: true }),
      sx2 * s, 0.11 * s, sz2 * s, 0.06, 'seat')));
  g.position.set(x, 0, z);
  g.userData.flames = flames;
  return g;
}
/** Huhn: kleines Tier für die Freiflächen */
function chicken(x, z, s = 1, brown = false) {
  const g = new THREE.Group(); g.name = 'chicken';
  const bodyM = mat(brown ? 'henBrown' : 'henWhite', brown ? 0xb98a52 : 0xf2efe6, { rough: 0.9 });
  g.add(sp(0.16 * s, bodyM, 0, 0.22 * s, 0, 'body'));
  const head = new THREE.Group();
  head.add(sp(0.085 * s, bodyM, 0, 0, 0, 'head'));
  head.add(rb(0.05 * s, 0.045 * s, 0.06 * s, mat('beak', 0xd8a13c, { rough: 0.8 }), 0, 0, 0.1 * s, 0.01, 'beak'));
  head.add(rb(0.035 * s, 0.06 * s, 0.05 * s, mat('comb', 0xbc5843, { rough: 0.8 }), 0, 0.09 * s, 0.01 * s, 0.01, 'comb'));
  head.position.set(0, 0.38 * s, 0.09 * s);
  g.add(head);
  g.add(rb(0.1 * s, 0.11 * s, 0.05 * s, bodyM, 0, 0.26 * s, -0.16 * s, 0.02, 'tail'));
  [-0.05, 0.05].forEach(dx => g.add(bx(0.022 * s, 0.11 * s, 0.022 * s, mat('legThin', 0xd8a13c), dx * s, 0, 0, 'leg', false)));
  g.position.set(x, 0, z);
  g.userData.head = head;
  return g;
}
/** Hund: streift über die Wiese */
function dog(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'dog';
  const m = mat('dogFur', 0xc79a63, { rough: 0.9 });
  g.add(rb(0.44 * s, 0.2 * s, 0.19 * s, m, 0, 0.34 * s, 0, 0.09, 'body'));
  g.add(rb(0.17 * s, 0.16 * s, 0.16 * s, m, 0.27 * s, 0.42 * s, 0, 0.06, 'head'));
  g.add(rb(0.06 * s, 0.08 * s, 0.03 * s, m, 0.24 * s, 0.53 * s, 0.06 * s, 0.02, 'ear'));
  g.add(rb(0.06 * s, 0.08 * s, 0.03 * s, m, 0.24 * s, 0.53 * s, -0.06 * s, 0.02, 'ear'));
  const tail = rb(0.05 * s, 0.2 * s, 0.05 * s, m, -0.24 * s, 0.44 * s, 0, 0.02, 'tail');
  tail.rotation.z = 0.7; g.add(tail);
  [[-0.14, -0.07], [-0.14, 0.07], [0.14, -0.07], [0.14, 0.07]].forEach(([lx, lz]) =>
    g.add(bx(0.045 * s, 0.24 * s, 0.045 * s, m, lx * s, 0, lz * s, 'leg', false)));
  g.position.set(x, 0, z);
  g.userData.tail = tail;
  return g;
}
/** Akazie: flache Schirmkrone, typisch für die Savanne */
function acacia(x, z, s = 1.2) {
  const g = new THREE.Group(); g.name = 'acacia';
  const tr = cy(0.05 * s, 0.09 * s, 1.35 * s, mat('bark', C.bark, { rough: 0.95 }), 0, 0, 0, 8, 'trunk');
  tr.rotation.z = 0.05; g.add(tr);
  [[0, 1.42, 0, 0.78, 0.16], [0.32, 1.28, 0.2, 0.5, 0.13], [-0.34, 1.32, -0.16, 0.46, 0.12]]
    .forEach(([lx, ly, lz, r, h], i) => {
      const c = cy(r * s, r * 0.82 * s, h * s, mat(i % 2 ? 'leafDark' : 'leaf', i % 2 ? C.leafDark : C.leaf, { rough: 0.95 }),
        lx * s, ly * s, lz * s, 12, 'canopy');
      g.add(c);
    });
  g.position.set(x, 0, z); g.rotation.y = x * 1.3;
  return g;
}
/** Bambus-/Schilfgruppe: mehrere schlanke Halme mit Blattbüscheln */
function bamboo(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'bamboo';
  const culmM = mat('culm', 0x8fa653, { rough: 0.9 });
  const leafM = mat('bambooLeaf', C.leafLight, { rough: 0.92 });
  for (let i = 0; i < 6; i++) {
    const h = (1.5 + (i % 3) * 0.42) * s;
    const cx = ((i % 3) - 1) * 0.17 * s, cz = (Math.floor(i / 3) - 0.5) * 0.2 * s;
    const culm = cy(0.028 * s, 0.034 * s, h, culmM, cx, 0, cz, 6, 'culm');
    culm.rotation.z = ((i % 2) ? 1 : -1) * 0.05; g.add(culm);
    for (let b = 0; b < 3; b++) {
      const lf = bx(0.34 * s, 0.02, 0.09 * s, leafM, cx + (b % 2 ? 0.14 : -0.14) * s, h - 0.16 * b * s - 0.1, cz, 'leaf', false);
      lf.rotation.z = (b % 2 ? -0.5 : 0.5); lf.rotation.y = b * 1.1; g.add(lf);
    }
  }
  g.position.set(x, 0, z);
  return g;
}
/** Palme: leicht gebogener Stamm, radiale Wedel */
function palm(x, z, s = 1.15) {
  const g = new THREE.Group(); g.name = 'palm';
  for (let i = 0; i < 5; i++) {
    const seg = cy(0.075 * s - i * 0.008 * s, 0.085 * s - i * 0.008 * s, 0.4 * s,
      mat('palmTrunk', 0xa9855a, { rough: 0.93 }), i * 0.055 * s, i * 0.38 * s, 0, 8, 'trunkSeg');
    g.add(seg);
  }
  const top = new THREE.Vector3(0.28 * s, 1.95 * s, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const frond = bx(0.95 * s, 0.035 * s, 0.26 * s, mat(i % 2 ? 'leafDark' : 'leaf', i % 2 ? C.leafDark : C.leaf, { rough: 0.93 }),
      top.x + Math.cos(a) * 0.42 * s, top.y, top.z + Math.sin(a) * 0.42 * s, 'frond', false);
    frond.rotation.y = -a; frond.rotation.z = -0.3;
    g.add(frond);
  }
  g.position.set(x, 0, z); g.rotation.y = z * 1.1;
  return g;
}
/** Termitenhügel — kleines, ortstypisches Landschaftsdetail */
function termiteMound(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'termiteMound';
  g.add(cy(0.06 * s, 0.34 * s, 0.72 * s, mat('mound', C.soil, { rough: 0.98, flat: true }), 0, 0, 0, 9, 'mound'));
  g.position.set(x, 0, z);
  return g;
}
/** dichte Streuung wie im Render */
function greens(g, items) {
  items.forEach(([kind, x, z, s], i) => {
    if (kind === 't') g.add(tree(x, z, s || 1.4, i % 2));
    else if (kind === 'a') g.add(acacia(x, z, s || 1.2));
    else if (kind === 'm') g.add(bamboo(x, z, s || 1.0));
    else if (kind === 'p') g.add(palm(x, z, s || 1.15));
    else if (kind === 'd') g.add(termiteMound(x, z, s || 1.0));
    else if (kind === 'b') g.add(bush(x, z, s || 1.1));
    else if (kind === 'r') g.add(rocks(x, z, s || 1.1));
    else if (kind === 'g') g.add(tuft(x, z, s || 1.1));
    else if (kind === 'f') g.add(flowers(x, z, 4));
  });
}

/** kleiner, unregelmäßiger Fleck ausgetretener Erde vor Eingängen — statt Wegenetz */
function wornPatch(x, z, w = 1.6, d = 1.2, rot = 0) {
  const g = new THREE.Group(); g.name = 'wornPatch';
  const p1 = plane(w, d, mat('dirt', C.dirt, { rough: 0.97 }), 0, 0.025, 0, 'wornPatch');
  p1.rotation.z = rot; p1.scale.set(1, 1.15, 1);
  g.add(p1);
  const p2 = plane(w * 0.62, d * 0.7, mat('soil', C.soil, { rough: 0.98 }), w * 0.12, 0.03, -d * 0.08, 'wornPatchInner');
  p2.rotation.z = rot + 0.25;
  g.add(p2);
  g.position.set(x, 0, z);
  return g;
}
/** befestigte Bodenplatte unter einem Baukörper — hebt Gebäude sichtbar vom Rasen ab */
function groundPad(x, z, w, d, ry = 0, yOff = 0) {
  const g = new THREE.Group(); g.name = 'groundPad';
  // Solide Volumen statt gestapelter Ebenen — koplanare Flächen erzeugten Z-Fighting.
  g.add(rb(w, 0.07, d, mat('pad', C.sand, { rough: 0.96 }), 0, 0.035 + yOff, 0, 0.18, 'padSlab'));
  g.add(rb(w - 0.36, 0.02, d - 0.36, mat('padInner', C.dirt, { rough: 0.97 }), 0, 0.082 + yOff, 0, 0.14, 'padInner'));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
/** ein Teilstück eines Trampelpfads */
function pathSeg(x1, z1, x2, z2, w) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const g = new THREE.Group();
  // Segmente etwas verlängern, damit an den Knicken keine Lücken entstehen
  g.add(plane(w, len + w * 0.9, mat('sandPath', C.sand, { rough: 0.97, offset: -2 }), 0, 0.03, 0, 'footpath'));
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  g.rotation.y = Math.atan2(dx, dz);
  return g;
}
/**
 * Geschwungener Trampelpfad. Gerade Verbindungen ergaben ein auffällig
 * sternförmiges, künstliches Muster — daher wird die Strecke in Segmente geteilt
 * und quer zur Laufrichtung leicht ausgelenkt (deterministisch, kein Zufall pro Frame).
 */
function footpath(x1, z1, x2, z2, w = 0.9, bend = 1, seed = 0) {
  const g = new THREE.Group(); g.name = 'footpath';
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;          // Normale zur Laufrichtung
  const N = Math.max(3, Math.round(len / 3.2)); // Segmentzahl nach Länge
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Auslenkung in der Mitte am stärksten, an den Enden null (Treffgenauigkeit)
    const amp = Math.sin(t * Math.PI) * bend * (0.9 + 0.5 * Math.sin(seed * 2.3));
    const wob = amp * (1.0 + 0.35 * Math.sin(t * 5.1 + seed));
    pts.push([x1 + dx * t + nx * wob, z1 + dz * t + nz * wob]);
  }
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1];
    g.add(pathSeg(a[0], a[1], b[0], b[1], w * (0.94 + 0.12 * Math.sin(i * 1.7 + seed))));
  }
  return g;
}

/* ---------- Figuren ---------- */
function person(x, z, shirt = C.yellow, pants = C.roof, s = 1, skin = C.skin) {
  const g = new THREE.Group(); g.name = 'person';
  const pM = mat('pants', pants, { rough: 0.9 }), sM = mat('shirt', shirt, { rough: 0.9 }), skM = mat('skin', skin, { rough: 0.85 });
  const legL = rb(0.1 * s, 0.36 * s, 0.11 * s, pM, -0.06 * s, 0.18 * s, 0, 0.045, 'legL');
  const legR = rb(0.1 * s, 0.36 * s, 0.11 * s, pM, 0.06 * s, 0.18 * s, 0, 0.045, 'legR');
  g.add(legL, legR);
  g.add(rb(0.26 * s, 0.34 * s, 0.17 * s, sM, 0, 0.53 * s, 0, 0.08, 'torso'));
  const armL = rb(0.075 * s, 0.3 * s, 0.085 * s, sM, -0.16 * s, 0.53 * s, 0, 0.035, 'armL');
  const armR = rb(0.075 * s, 0.3 * s, 0.085 * s, sM, 0.16 * s, 0.53 * s, 0, 0.035, 'armR');
  g.add(armL, armR);
  g.add(sp(0.125 * s, skM, 0, 0.84 * s, 0, 'head'));
  const hair = sp(0.129 * s, mat('hair', C.hair, { rough: 0.9 }), 0, 0.865 * s, -0.012 * s, 'hair');
  hair.scale.set(1, 0.76, 1); g.add(hair);
  g.position.set(x, 0, z);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}
function walk(p, t, k, sp_ = 6) {
  const l = p.userData.limbs; if (!l) return;
  const a = Math.sin(t * sp_) * 0.34 * k;
  l.legL.rotation.x = a; l.legR.rotation.x = -a;
  l.armL.rotation.x = -a * 0.8; l.armR.rotation.x = a * 0.8;
}
function sitPose(p) {
  const l = p.userData.limbs;
  l.legL.rotation.x = -1.45; l.legR.rotation.x = -1.45;
  l.legL.position.z += 0.13; l.legR.position.z += 0.13;
}

/* ---------- Requisiten ---------- */
function goat(x, z, brown = false, s = 1) {
  const g = new THREE.Group(); g.name = 'goat';
  const bM = mat(brown ? 'goatB' : 'goat', brown ? C.goatBrown : C.goat, { rough: 0.9 });
  g.add(rb(0.54 * s, 0.28 * s, 0.26 * s, bM, 0, 0.4 * s, 0, 0.12, 'body'));
  [[-0.18, -0.09], [-0.18, 0.09], [0.18, -0.09], [0.18, 0.09]].forEach(([lx, lz]) =>
    g.add(bx(0.06 * s, 0.26 * s, 0.06 * s, mat('goatLeg', brown ? 0x7d4f22 : 0xdedcd0), lx * s, 0, lz * s, 'leg', false)));
  g.add(rb(0.22 * s, 0.2 * s, 0.19 * s, bM, 0.32 * s, 0.5 * s, 0, 0.08, 'head'));
  [0.06, -0.06].forEach(dz => g.add(bx(0.05 * s, 0.12 * s, 0.04 * s, mat('horn', 0xd0c8ae), 0.3 * s, 0.6 * s, dz * s, 'horn', false)));
  g.position.set(x, 0, z);
  return g;
}
function jerrycan(x, z, col = C.yellow) {
  const g = new THREE.Group(); g.name = 'jerrycan';
  g.add(rb(0.22, 0.32, 0.16, mat('jerry', col, { rough: 0.7 }), 0, 0.16, 0, 0.04, 'body'));
  g.add(cy(0.05, 0.05, 0.07, mat('jerryCap', C.roofDark), 0, 0.32, 0, 8, 'cap', false));
  g.position.set(x, 0, z);
  return g;
}
function pots(x, z) {
  const g = new THREE.Group(); g.name = 'pots';
  [0, 0.3, 0.58].forEach((dx, i) => g.add(cy(0.13 - i * 0.015, 0.17 - i * 0.015, 0.22, mat('pot', C.wallWarm, { rough: 0.85 }), dx, 0, 0, 10, 'pot')));
  g.position.set(x, 0, z);
  return g;
}
function laundryLine(x, z, ry = 0) {
  const g = new THREE.Group(); g.name = 'laundryLine';
  [-1, 1].forEach(sx => g.add(cy(0.03, 0.03, 1.1, mat('post', C.bark), sx * 1.1, 0, 0, 6, 'post')));
  g.add(bx(2.2, 0.01, 0.01, mat('rope', 0xd8d0bd), -1.1, 1.05, 0, 'rope', false));
  const cloths = [];
  [-0.8, -0.3, 0.3, 0.8].forEach((dx, i) => {
    const c = bx(0.3, 0.36, 0.02, mat('cloth', [C.yellow, C.teal, C.green, C.red][i % 4], { rough: 0.85 }), dx, 0.86, 0, 'cloth', false);
    g.add(c); cloths.push(c);
  });
  g.userData.cloths = cloths;
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function crate(x, y, col = C.wood) {
  const g = new THREE.Group(); g.name = 'crate';
  g.add(bx(0.4, 0.3, 0.32, mat('crate', col, { rough: 0.85 }), -0.2, 0, -0.16, 'box'));
  const fruit = [];
  for (let i = 0; i < 4; i++) {
    const f = sp(0.06, mat('fruit', i % 2 ? C.yellow : C.red, { rough: 0.7 }), -0.32 + (i % 2) * 0.2, 0.32, -0.16 + Math.floor(i / 2) * 0.2, 'fruit');
    g.add(f); fruit.push(f);
  }
  g.userData.fruit = fruit;
  g.position.set(x, y, 0);
  return g;
}
function beehive(x, z, dz = 0) {
  const g = new THREE.Group(); g.name = 'beehive';
  g.add(rb(0.5, 0.32, 0.42, mat('hive', C.wall, { rough: 0.85 }), 0, 0.16, 0, 0.03, 'box'));
  g.add(rb(0.54, 0.06, 0.46, mat('hiveTop', C.roof, { rough: 0.6 }), 0, 0.35, 0, 0.02, 'lid'));
  g.position.set(x, 0, z + dz);
  return g;
}
function shelter(w, d, rise, bench = false) {
  const g = new THREE.Group(); g.name = 'shelter';
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    g.add(cy(0.06, 0.07, rise + 0.3, mat('post', C.bark), sx * (w / 2 - 0.15), 0, sz * (d / 2 - 0.15), 8, 'post')));
  const roof = shedRoof(w, d, 0.35, 0.3); roof.position.y = rise + 0.3; g.add(roof);
  if (bench) g.add(bx(w - 0.4, 0.28, 0.3, mat('bench', C.wood, { rough: 0.85 }), 0, 0, 0, 'bench'));
  return g;
}
function cornPlant(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'corn';
  g.add(cy(0.02 * s, 0.03 * s, 0.5 * s, mat('stalk', C.leafDark, { rough: 0.9 }), 0, 0, 0, 6, 'stalk'));
  g.add(sp(0.08 * s, mat('corn', C.corn, { rough: 0.8 }), 0.05 * s, 0.4 * s, 0, 'cob'));
  g.position.set(x, 0, z);
  return g;
}
function veggie(x, z, s = 1) {
  const g = new THREE.Group(); g.name = 'veggie';
  g.add(sp(0.1 * s, mat('leafV', C.leaf, { rough: 0.9 }), 0, 0.1 * s, 0, 'bush'));
  g.position.set(x, 0, z);
  return g;
}
function goalNet(x, z, ry = 0) {
  const g = new THREE.Group(); g.name = 'goal';
  const m = mat('metal', C.metal, { rough: 0.4, metal: 0.3 });
  g.add(bx(0.05, 0.7, 0.05, m, -0.6, 0, 0, 'postL', false));
  g.add(bx(0.05, 0.7, 0.05, m, 0.6, 0, 0, 'postR', false));
  g.add(bx(1.25, 0.05, 0.05, m, 0, 0.7, 0, 'bar', false));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function schoolDesk(x, z) {
  const g = new THREE.Group(); g.name = 'desk';
  g.add(bx(0.7, 0.05, 0.4, mat('desk', C.wood, { rough: 0.85 }), -0.35, 0.32, -0.2, 'top'));
  [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]].forEach(([lx, lz]) =>
    g.add(bx(0.04, 0.32, 0.04, mat('leg', C.woodDark), lx, 0, lz, 'leg', false)));
  g.position.set(x, 0, z);
  return g;
}
function handcart(x, z, ry = 0) {
  const g = new THREE.Group(); g.name = 'handcart';
  g.add(bx(0.7, 0.28, 0.5, mat('cart', C.wood, { rough: 0.85 }), -0.35, 0.2, -0.25, 'bed'));
  [-0.3, 0.3].forEach(lx => {
    const w = cy(0.14, 0.14, 0.06, mat('wheel', C.roofDark, { rough: 0.7 }), lx, 0.14, 0, 10, 'wheel');
    w.rotation.z = Math.PI / 2; g.add(w);
  });
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function bicycle(x, z, ry = 0) {
  const g = new THREE.Group(); g.name = 'bicycle';
  [-0.35, 0.35].forEach(dx => {
    const w = new THREE.Mesh(geo('bikeWheel', () => new THREE.TorusGeometry(0.22, 0.025, 6, 20)), mat('bikeWheel', C.roofDark, { rough: 0.6 }));
    w.position.set(dx, 0.22, 0); g.add(w);
  });
  g.add(bx(0.6, 0.04, 0.04, mat('frame', C.teal, { rough: 0.6 }), -0.3, 0.24, 0, 'frame', false));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}

/* ================= Programme ================= */

/* 1 — Knowledge for Life: offener Klassenraum links oben */
function zoneSchool() {
  const g = new THREE.Group();
  const school = building(4.4, 2.8, 1.6, { rise: 0.75 });
  school.position.set(-10.4, 0, -10.2);
  g.add(school);
  [[-1.45, 0], [1.45, 0]].forEach(([dx]) => {
    const w = winUnit(0.6, 0.6); w.position.set(-10.4 + dx, 1.1, -8.75); g.add(w);
  });
  const dr = doorUnit(0.5, 0.9); dr.position.set(-9.1, 0.18, -8.75); g.add(dr);
  const schoolSolar = solarArray(1.9, 1.1, 4); schoolSolar.position.set(-10.6, 2.5, -10.5); schoolSolar.rotation.x = -0.28; g.add(schoolSolar);
  g.add(steps(1.0, 0.55, -9.1, -8.3));
  g.add(wornPatch(-8.3, -7.7, 2.6, 1.8, 0.1));
  const plat = rb(5.6, 0.18, 3.4, mat('stone', C.stone), -7.4, 0.09, -7.3, 0.06, 'classPlatform');
  g.add(plat);
  g.add(rb(3.2, 1.05, 0.1, mat('blackboard', 0x2e4534, { rough: 0.95 }), -8.9, 0.85, -8.7, 0.03, 'blackboard'));
  g.add(bx(3.3, 0.08, 0.16, mat('boardLedge', C.wood), -8.9, 0.28, -8.68, 'boardLedge', false));
  const kids = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const x = -9.2 + c * 1.6, z = -8.1 + r * 1.1;
      const d = schoolDesk(x, z); d.position.y = 0.18; g.add(d);
      const p = person(x, z + 0.45, [C.yellow, C.teal, C.green][(r + c) % 3], C.roofDark, 0.88);
      p.position.y = 0.32; p.rotation.y = Math.PI; sitPose(p); g.add(p); kids.push(p);
    }
  const teacher = person(-6.0, -8.2, C.trim, C.roof, 1.02);
  teacher.position.y = 0.18; teacher.rotation.y = -2.1; g.add(teacher);
  const kid = person(-11.6, -7.0, C.yellow, C.teal, 0.86); g.add(kid);
  greens(g, [['a', -13.6, -11.8, 1.3], ['p', -8.0, -12.8, 1.15], ['m', -5.0, -11.0, 1.0],
    ['b', -12.4, -8.8], ['g', -11.2, -6.4], ['r', -5.4, -9.4], ['d', -12.9, -7.2]]);
  return {
    group: g,
    tick(t, k) {
      kids.forEach((p, i) => {
        p.userData.limbs.armR.rotation.x = -0.4 - Math.abs(Math.sin(t * 3 + i * 0.8)) * 0.9 * k;
        p.rotation.z = Math.sin(t * 2.4 + i) * 0.04 * k;
      });
      teacher.position.z = -8.2 + Math.sin(t * 1.0) * 0.55 * k;
      walk(teacher, t, k, 3.4);
      kid.position.x = -11.6 + Math.sin(t * 1.3) * 0.6 * k;
      walk(kid, t, k, 5.5);
    }
  };
}

/* 2 — Orphan Care: Rundhaus links + Wäscheleine */
function zoneOrphan() {
  const g = new THREE.Group();
  const hut = new THREE.Group(); hut.name = 'roundHouse';
  hut.add(cy(1.5, 1.55, 0.16, mat('plinth', C.stone), 0, 0, 0, 28, 'plinth'));
  hut.add(cy(1.42, 1.44, 1.5, mat('wallWarm', C.wallWarm, { rough: 0.9 }), 0, 0.16, 0, 28, 'wall'));
  hut.add(cy(0.06, 1.82, 1.5, mat('thatch', C.thatch, { rough: 0.98 }), 0, 1.66, 0, 30, 'thatchRoof'));
  [0.25, 0.62, 0.99].forEach((f, i) => hut.add(cy(1.82 - f * 1.2 + 0.04, 1.82 - f * 1.2, 0.07,
    mat('thatchD', C.thatchDark, { rough: 0.98 }), 0, 1.66 + f * 1.35, 0, 30, 'thatchBand', false)));
  hut.add(sp(0.12, mat('thatchD', C.thatchDark, { rough: 0.98 }), 0, 3.2, 0, 'thatchTip', false));
  const hd = doorUnit(0.48, 0.86); hd.position.set(0, 0.16, 1.42); hut.add(hd);
  const hw = winUnit(0.4, 0.4); hw.position.set(-1.0, 0.95, 1.0); hw.rotation.y = -0.8; hut.add(hw);
  hut.position.set(-12.4, 0, -5.8); g.add(hut);
  g.add(wornPatch(-12.4, -4.2, 2.0, 1.6, 0.05));
  g.add(pots(-13.9, -4.6));
  const line = laundryLine(-12.9, -1.0, 0.05); g.add(line);
  const kids = [];
  [[-11.0, -4.6], [-11.7, -3.4], [-13.6, -2.2]].forEach(([x, z], i) => {
    const p = person(x, z, [C.yellow, C.green, C.teal][i], C.roofDark, 0.86);
    g.add(p); kids.push([p, x, z, i]);
  });
  const carer = person(-11.4, -5.9, C.teal, C.roof, 1.0); carer.rotation.y = -1.2; g.add(carer);
  greens(g, [['a', -15.0, -7.6, 1.3], ['m', -15.2, -2.4, 1.05], ['p', -10.4, -1.4, 1.1],
    ['b', -11.2, -0.4, 1.2], ['g', -14.4, -0.2], ['r', -12.2, -7.1], ['d', -13.4, -0.8]]);
  return {
    group: g,
    tick(t, k) {
      line.userData.cloths.forEach((c, i) => {
        c.rotation.x = Math.sin(t * 2.4 + i * 0.8) * 0.4 * k;
        c.rotation.z = Math.sin(t * 1.7 + i) * 0.1 * k;
      });
      kids.forEach(([p, x, z, i]) => {
        p.position.x = x + Math.sin(t * 1.4 + i * 2) * 0.5 * k;
        p.rotation.y = Math.sin(t * 1.4 + i * 2) * 1.0;
        walk(p, t, k, 6.5);
      });
      carer.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 1.6)) * 0.8 * k;
    }
  };
}

/* 3 — Gift of Sight: kleine Augenklinik mit Dachaufbau */
function zoneSight() {
  const g = new THREE.Group();
  const b = building(2.9, 2.4, 1.5, { rise: 0.16, wall: C.wall });
  b.position.set(-10.0, 0, -3.6); g.add(b);
  g.add(rb(1.1, 0.5, 0.9, mat('roofUnit', C.trim), -10.0, 2.1, -3.8, 0.05, 'rooftopUnit'));
  g.add(rb(0.9, 0.1, 0.7, mat('roofUnitTop', C.glass, { rough: 0.2 }), -10.0, 2.36, -3.8, 0.03, 'skylight'));
  const bigWin = winUnit(1.0, 0.6); bigWin.position.set(-10.9, 1.05, -2.35); g.add(bigWin);
  const sightSolar = solarArray(1.5, 0.9, 3); sightSolar.position.set(-9.0, 1.86, -4.3); sightSolar.rotation.x = -0.26; g.add(sightSolar);
  const d1 = doorUnit(0.44, 0.9); d1.position.set(-9.6, 0.18, -2.35); g.add(d1);
  const d2 = doorUnit(0.44, 0.9); d2.position.set(-9.1, 0.18, -2.35); g.add(d2);
  g.add(steps(1.5, 0.6, -9.35, -1.85));
  g.add(wornPatch(-10.0, -1.2, 2.8, 1.8, -0.05));
  const van = new THREE.Group(); van.name = 'eyeClinicVan';
  van.add(rb(1.95, 0.82, 0.98, mat('white', C.white, { rough: 0.6 }), 0, 0.58, 0, 0.12, 'body'));
  van.add(rb(0.6, 0.46, 0.9, mat('white', C.white, { rough: 0.6 }), 0.88, 1.15, 0, 0.1, 'cab'));
  van.add(rb(0.5, 0.32, 0.05, mat('windscreen', C.glass, { rough: 0.15 }), 1.1, 1.16, 0, 0.03, 'windscreen'));
  van.add(bx(1.15, 0.15, 1.0, mat('stripe', C.teal, { rough: 0.7 }), -0.28, 0.64, 0, 'stripe', false));
  [[-0.62, 0.48], [-0.62, -0.48], [0.72, 0.48], [0.72, -0.48]].forEach(([x, z]) => {
    const w = cy(0.21, 0.21, 0.14, mat('tyre', C.tyre, { rough: 0.7 }), x, 0, z, 14, 'wheel');
    w.rotation.x = Math.PI / 2; w.position.y = 0.21; van.add(w);
  });
  van.position.set(-7.6, 0, -2.0); van.rotation.y = -0.25; g.add(van);
  const doctor = person(-10.4, -1.6, C.trim, C.teal, 1.02); g.add(doctor);
  const queue = [];
  for (let i = 0; i < 3; i++) {
    const p = person(-11.5 - i * 0.55, -1.1 + i * 0.2, [C.green, C.teal, C.red][i], C.roofDark, 0.9);
    p.rotation.y = 1.0; g.add(p); queue.push(p);
  }
  g.add(cy(0.36, 0.38, 0.55, mat('drum', C.tank, { rough: 0.7 }), -8.4, 0, -3.2, 16, 'waterDrum'));
  greens(g, [['a', -12.4, -3.0, 1.25], ['m', -8.6, -4.8, 1.0], ['g', -8.2, -1.0], ['r', -12.0, -4.8]]);
  return {
    group: g,
    tick(t, k) {
      doctor.position.x = -10.4 + Math.abs(Math.sin(t * 1.05)) * 0.8 * k;
      walk(doctor, t, k, 4);
      queue.forEach((p, i) => {
        p.rotation.y = 1.0 + Math.sin(t * 1.1 + i) * 0.4 * k;
        p.position.y = Math.abs(Math.sin(t * 2.2 + i * 0.7)) * 0.03 * k;
      });
    }
  };
}

/* 4 — Water for Life: Brunnen Bildmitte oben + Wasserturm rechts */
function zoneWater() {
  const g = new THREE.Group();
  const well = new THREE.Group(); well.name = 'well';
  const ring = 14;
  for (let lvl = 0; lvl < 3; lvl++)
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + lvl * 0.22;
      const blk = rb(0.32, lvl === 2 ? 0.18 : 0.22, 0.24,
        mat((i + lvl) % 2 ? 'stone' : 'stoneD', (i + lvl) % 2 ? C.stone : C.stoneDark, { rough: 0.95 }),
        Math.cos(a) * 0.72, 0.11 + lvl * 0.21, Math.sin(a) * 0.72, 0.04, 'block');
      blk.rotation.y = -a; well.add(blk);
    }
  const water = cy(0.64, 0.64, 0.06, mat('water', C.water, { rough: 0.1, metal: 0.2 }), 0, 0.42, 0, 26, 'water');
  well.add(water);
  [-0.66, 0.66].forEach(px => well.add(cy(0.1, 0.12, 1.7, mat('wood', C.wood, { rough: 0.9 }), px, 0.6, 0, 10, 'post')));
  const beam = cy(0.09, 0.09, 1.75, mat('woodD', C.woodDark), 0, 2.3, 0, 10, 'beam');
  beam.rotation.z = Math.PI / 2; well.add(beam);
  const crank = cy(0.07, 0.07, 0.36, mat('woodD', C.woodDark), 0.76, 2.1, 0, 8, 'crank');
  crank.rotation.z = Math.PI / 2; well.add(crank);
  const rope = bx(0.032, 0.8, 0.032, mat('rope', 0xe8dfc4), 0, 1.45, 0, 'rope', false); well.add(rope);
  const bucket = new THREE.Group();
  bucket.add(cy(0.15, 0.12, 0.22, mat('bucket', C.yellow, { rough: 0.8 }), 0, 0, 0, 12, 'pail'));
  bucket.add(cy(0.155, 0.155, 0.035, mat('bucketRim', C.woodDark), 0, 0.22, 0, 12, 'rim', false));
  bucket.position.set(0, 1.25, 0); well.add(bucket);
  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(geo('ripple', () => new THREE.RingGeometry(0.2, 0.27, 30)),
      new THREE.MeshBasicMaterial({ color: 0xb6e3fb, transparent: true, opacity: 0 }));
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.47, 0); well.add(r); ripples.push(r);
  }
  well.position.set(-1.0, 0, -6.6); g.add(well);
  g.add(wornPatch(-0.6, -5.8, 2.4, 2.0, 0.08));
  g.add(jerrycan(0.5, -5.6)); g.add(jerrycan(0.9, -5.9, C.tank));
  const boy = person(0.2, -5.2, C.yellow, C.teal, 0.92); boy.rotation.y = -2.5; g.add(boy);
  const girl = person(-2.4, -5.6, C.teal, C.roofDark, 0.88); girl.rotation.y = 1.7; g.add(girl);
  const tower = new THREE.Group(); tower.name = 'waterTower';
  [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].forEach(([lx, lz]) => {
    const leg = cy(0.08, 0.1, 2.5, mat('wood', C.wood, { rough: 0.9 }), lx, 0, lz, 8, 'leg');
    leg.rotation.set(lz > 0 ? -0.1 : 0.1, 0, lx > 0 ? 0.1 : -0.1); tower.add(leg);
  });
  [0.65, 1.6].forEach(y => [[0, -0.58, 0], [0, 0.58, 0], [-0.58, 0, Math.PI / 2], [0.58, 0, Math.PI / 2]]
    .forEach(([bx_, bz, ry]) => {
      const br = bx(1.2, 0.07, 0.07, mat('woodD', C.woodDark), bx_, y, bz, 'brace', false);
      br.rotation.y = ry; tower.add(br);
    }));
  tower.add(cy(0.78, 0.78, 1.0, mat('tank', C.tank, { rough: 0.5 }), 0, 2.5, 0, 26, 'tank'));
  tower.add(cy(0.7, 0.78, 0.16, mat('tankTop', 0x1f4278, { rough: 0.5 }), 0, 3.5, 0, 26, 'tankTop'));
  tower.add(cy(0.24, 0.28, 0.18, mat('hatch', 0x1a3a68), 0, 3.66, 0, 14, 'hatch'));
  for (let i = 0; i < 7; i++)
    tower.add(bx(0.38, 0.04, 0.04, mat('ladder', C.metal, { rough: 0.4, metal: 0.35 }), 0.84, 0.4 + i * 0.3, 0, 'rung', false));
  tower.position.set(-4.6, 0, -9.2); g.add(tower);
  greens(g, [['p', -3.4, -8.0, 1.2], ['m', 1.8, -7.4, 1.05], ['g', -2.2, -4.2], ['r', 1.4, -4.6],
    ['a', -7.0, -11.2, 1.25], ['m', -2.4, -11.6, 1.0], ['g', -6.2, -7.4]]);
  return {
    group: g,
    tick(t, k) {
      const d = Math.sin(t * 1.25) * 0.5 + 0.5;
      bucket.position.y = 1.25 - d * 0.68 * k;
      rope.scale.y = 1 + d * 0.6 * k;
      rope.position.y = 1.45 + d * 0.18 * k;
      crank.rotation.x = t * 2.2 * k;
      water.position.y = 0.42 + Math.sin(t * 2.6) * 0.015 * k;
      ripples.forEach((r, i) => {
        const p = (t * 0.55 + i / 3) % 1;
        r.scale.setScalar(0.4 + p * 2.2);
        r.material.opacity = (1 - p) * 0.5 * k;
      });
      boy.userData.limbs.armR.rotation.x = -0.5 - Math.sin(t * 2.2) * 0.7 * k;
      girl.position.x = -2.4 + Math.sin(t * 1.1) * 0.45 * k;
      walk(girl, t, k, 4.2);
    }
  };
}

/* 5 — Global Health: Klinik oben rechts + Krankenwagen */
function zoneClinic() {
  const g = new THREE.Group();
  const b = building(3.6, 2.8, 1.7, { rise: 0.8, gable: true });
  b.position.set(6.0, 0, -10.0); g.add(b);
  [[-1.2], [1.2]].forEach(([dx]) => {
    const w = winUnit(0.58, 0.58); w.position.set(6.0 + dx, 1.15, -8.55); g.add(w);
  });
  const dr = doorUnit(0.54, 0.95); dr.position.set(6.0, 0.18, -8.55); g.add(dr);
  const clinicSolar = solarArray(1.8, 1.05, 4); clinicSolar.position.set(5.4, 2.75, -10.4); clinicSolar.rotation.x = -0.3; g.add(clinicSolar);
  g.add(steps(1.3, 0.7, 6.0, -8.0));
  g.add(wornPatch(6.4, -7.3, 3.2, 2.0, 0.06));
  g.add(rb(0.8, 0.24, 0.07, mat('cross', C.cross, { rough: 0.7 }), 6.0, 1.75, -8.5, 0.02, 'crossH'));
  g.add(rb(0.24, 0.8, 0.07, mat('cross', C.cross, { rough: 0.7 }), 6.0, 1.75, -8.5, 0.02, 'crossV'));
  const amb = new THREE.Group(); amb.name = 'ambulance';
  amb.add(rb(1.95, 0.72, 0.98, mat('white', C.white, { rough: 0.55 }), 0, 0.56, 0, 0.12, 'body'));
  amb.add(rb(0.68, 0.48, 0.92, mat('white', C.white, { rough: 0.55 }), 0.82, 1.14, 0, 0.1, 'cab'));
  amb.add(rb(0.54, 0.32, 0.05, mat('windscreen', C.glass, { rough: 0.15 }), 1.06, 1.16, 0, 0.03, 'windscreen'));
  amb.add(bx(1.15, 0.14, 1.0, mat('stripe', C.teal, { rough: 0.7 }), -0.3, 0.62, 0, 'stripe', false));
  amb.add(rb(0.3, 0.09, 0.03, mat('cross', C.cross), -0.35, 0.84, 0.5, 0.01, 'ambCrossH'));
  amb.add(rb(0.09, 0.3, 0.03, mat('cross', C.cross), -0.35, 0.84, 0.5, 0.01, 'ambCrossV'));
  [[-0.62, 0.48], [-0.62, -0.48], [0.7, 0.48], [0.7, -0.48]].forEach(([x, z]) => {
    const w = cy(0.21, 0.21, 0.14, mat('tyre', C.tyre, { rough: 0.7 }), x, 0, z, 14, 'wheel');
    w.rotation.x = Math.PI / 2; w.position.y = 0.21; amb.add(w);
    const hub = cy(0.1, 0.1, 0.16, mat('hub', C.metal, { rough: 0.35, metal: 0.45 }), x, 0, z, 10, 'hub', false);
    hub.rotation.x = Math.PI / 2; hub.position.y = 0.21; amb.add(hub);
  });
  const beacon = rb(0.34, 0.11, 0.18, mat('beacon', C.red, { rough: 0.3 }), 0.82, 1.44, 0, 0.04, 'beacon');
  amb.add(beacon);
  amb.position.set(2.6, 0, -7.4); amb.rotation.y = 0.15; g.add(amb);
  const nurse = person(7.6, -8.0, C.trim, C.teal, 1.02); nurse.rotation.y = -0.6; g.add(nurse);
  const patient = person(4.7, -7.4, C.yellow, C.roofDark, 0.94); patient.rotation.y = 0.9; g.add(patient);
  const helper = person(8.0, -6.6, C.green, C.roofDark, 0.98); helper.rotation.y = -1.6; g.add(helper);
  const bench = rb(1.6, 0.24, 0.46, mat('bench', C.wood, { rough: 0.85 }), 8.2, 0.36, -7.8, 0.03, 'bench');
  g.add(bench);
  greens(g, [['a', 3.2, -11.6, 1.3], ['p', 9.6, -11.2, 1.15], ['m', 10.0, -7.0, 1.0],
    ['b', 7.6, -5.8, 1.2], ['g', 2.8, -6.4], ['r', 8.8, -9.8], ['d', 3.8, -5.8]]);
  return {
    group: g,
    tick(t, k) {
      beacon.material.emissive.setHex(0xd2452f);
      beacon.material.emissiveIntensity = k * (0.4 + 0.6 * Math.abs(Math.sin(t * 7))) * 2.6;
      amb.position.x = 2.6 + Math.sin(t * 0.85) * 0.45 * k;
      nurse.position.z = -8.0 + Math.abs(Math.sin(t * 1.2)) * 0.6 * k;
      walk(nurse, t, k, 4.4);
      patient.rotation.y = 0.9 + Math.sin(t * 1.1) * 0.4 * k;
      helper.userData.limbs.armL.rotation.x = -Math.abs(Math.sin(t * 2.6)) * 1.1 * k;
    }
  };
}

/* 6 — Food Security: Beete + Gewächshaus rechts oben, Bienenstöcke + Ziegengehege rechts */
function zoneFood() {
  const g = new THREE.Group();
  g.add(rb(7.6, 0.12, 6.2, mat('fieldGround', C.soil, { rough: 0.98 }), 12.6, 0.06, -5.6, 0.1, 'fieldGround'));
  const fieldX = 12.6, fieldZ = -5.6;
  const plants = [];
  for (let r = 0; r < 5; r++) {
    const z = fieldZ - 2.0 + r * 1.0;
    // flache Beete: hohe Kästen lasen sich in der Iso-Ansicht wie Treppenstufen
    g.add(rb(6.0, 0.06, 0.86, mat('bed', 0x9a8560, { rough: 0.98 }), fieldX, 0.15, z, 0.04, 'bed'));
    for (let c = 0; c < 9; c++) {
      const x = fieldX - 2.6 + c * 0.65;
      const p = (r % 2 === 0) ? cornPlant(x, z, 1.5 + (c % 3) * 0.1) : veggie(x, z, 1.6);
      p.position.y = 0.15; g.add(p); plants.push([p, (r * 9 + c) * 0.45]);
    }
  }
  const gh = new THREE.Group(); gh.name = 'greenhouse';
  gh.add(rb(4.0, 0.2, 2.5, mat('ghBase', C.wood, { rough: 0.9 }), 0, 0.1, 0, 0.05, 'base'));
  const shell = new THREE.Mesh(
    geo('ghShell', () => new THREE.CylinderGeometry(1.22, 1.22, 3.8, 28, 1, true, 0, Math.PI)),
    mat('ghGlass', 0xeaf6fd, { rough: 0.06, opacity: 0.3, side: THREE.DoubleSide })
  );
  shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.position.y = 0.2; gh.add(shell);
  for (let i = 0; i <= 7; i++) {
    const hoop = new THREE.Mesh(geo('hoop', () => new THREE.TorusGeometry(1.22, 0.03, 6, 26, Math.PI)), mat('ghFrame', C.trim, { rough: 0.5 }));
    hoop.rotation.y = Math.PI / 2; hoop.position.set(-1.85 + i * 0.53, 0.2, 0); gh.add(hoop);
  }
  gh.add(bx(3.8, 0.05, 0.05, mat('ghFrame', C.trim), 0, 1.4, 0, 'ridgeBar', false));
  const ghPlants = [];
  for (let i = 0; i < 16; i++) {
    const p = veggie(-1.7 + (i % 8) * 0.49, i < 8 ? -0.5 : 0.5, 0.95);
    p.position.y = 0.2; gh.add(p); ghPlants.push(p);
  }
  gh.position.set(16.2, 0, -9.0); gh.rotation.y = 0.06; g.add(gh);
  g.add(wornPatch(14.2, -7.0, 1.8, 1.3));
  g.add(cy(0.42, 0.44, 0.62, mat('drum', C.tank, { rough: 0.6 }), 12.6, 0, -8.8, 18, 'waterDrum'));
  g.add(cy(0.44, 0.44, 0.08, mat('drumLid', 0x1f4278), 12.6, 0.62, -8.8, 18, 'drumLid', false));
  const farmer = person(15.0, -5.0, C.roofDark, C.wood, 1.0); farmer.rotation.y = -1.2; g.add(farmer);
  g.add(handcart(15.4, -2.4, -0.4));
  const hives = new THREE.Group(); hives.name = 'hives';
  hives.add(beehive(0, 0, 0.2)); hives.add(beehive(0.95, 0.35, -0.15)); hives.add(beehive(1.9, -0.1, 0.4));
  hives.position.set(11.4, 0, 1.2); g.add(hives);
  const keeper = person(10.2, 2.0, C.teal, C.trim, 0.98); keeper.rotation.y = -0.9; g.add(keeper);
  const pen = new THREE.Group(); pen.name = 'goatPen';
  pen.add(plane(4.6, 3.4, mat('dirt', C.dirt, { rough: 0.98 }), 0, 0.03, 0, 'penGround'));
  const pts = [[-2.3, -1.7], [2.3, -1.7], [2.3, 1.7], [-2.3, 1.7]];
  pts.forEach(([px, pz], i) => {
    pen.add(cy(0.08, 0.09, 0.7, mat('fence', C.wood, { rough: 0.9 }), px, 0, pz, 8, 'post'));
    const n = pts[(i + 1) % pts.length];
    const len = Math.hypot(n[0] - px, n[1] - pz);
    [0.26, 0.52].forEach(y => {
      const rail = bx(len, 0.07, 0.055, mat('fence', C.wood, { rough: 0.9 }), (px + n[0]) / 2, y, (pz + n[1]) / 2, 'rail', false);
      rail.rotation.y = -Math.atan2(n[1] - pz, n[0] - px); pen.add(rail);
    });
    for (let s = 1; s < 4; s++) {
      const t2 = s / 4;
      pen.add(cy(0.07, 0.08, 0.66, mat('fence', C.wood, { rough: 0.9 }), px + (n[0] - px) * t2, 0, pz + (n[1] - pz) * t2, 8, 'post'));
    }
  });
  const shed = shelter(2.2, 1.6, 1.15);
  shed.position.set(0.9, 0, -0.5); pen.add(shed);
  const goats = [goat(-0.9, 0.6), goat(0.1, -0.9, true, 0.92), goat(-1.5, -0.4, false, 0.96), goat(1.4, 0.9, true, 0.88)];
  goats.forEach(gt => pen.add(gt));
  pen.position.set(16.8, 0, 7.0); pen.rotation.y = -0.12; g.add(pen);
  greens(g, [['a', 18.6, -4.6, 1.3], ['m', 9.4, -3.0, 1.05], ['b', 19.2, -1.2, 1.2],
    ['g', 10.4, -1.0], ['r', 14.2, -0.4], ['p', 13.2, 4.6, 1.15], ['m', 14.8, 8.4, 1.0], ['g', 19.8, 4.6]]);
  return {
    group: g,
    tick(t, k) {
      plants.forEach(([p, off]) => {
        p.rotation.z = Math.sin(t * 2.0 + off) * 0.1 * k;
        p.scale.setScalar(1 + 0.06 * k * (0.5 + 0.5 * Math.sin(t * 1.5 + off)));
      });
      ghPlants.forEach((p, i) => p.scale.setScalar(1 + 0.14 * k * Math.sin(t * 2.2 + i * 0.6)));
      farmer.position.z = -5.0 + Math.sin(t * 0.9) * 0.8 * k;
      walk(farmer, t, k, 3.6);
      keeper.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 1.8)) * 1.0 * k;
      goats.forEach((gt, i) => {
        gt.rotation.y = Math.sin(t * 0.9 + i * 1.6) * 0.5 * k;
        gt.position.y = Math.abs(Math.sin(t * 2.6 + i)) * 0.04 * k;
      });
    }
  };
}

/* 7 — Community Care: Sportplatz + Tribüne links unten, Markt in der Mitte */
function zoneCommunity() {
  const g = new THREE.Group();
  const px = -9.2, pz = 6.4;
  g.add(rb(7.0, 0.12, 5.0, mat('pitch', C.pitch, { rough: 0.95 }), px, 0.06, pz, 0.2, 'pitch'));
  const lineM = mat('line', C.white, { rough: 0.6 });
  g.add(bx(6.5, 0.02, 0.07, lineM, px, 0.12, pz - 2.2, 'line', false));
  g.add(bx(6.5, 0.02, 0.07, lineM, px, 0.12, pz + 2.2, 'line', false));
  g.add(bx(0.07, 0.02, 4.4, lineM, px, 0.12, pz, 'halfway', false));
  g.add(bx(0.07, 0.02, 4.4, lineM, px - 3.25, 0.12, pz, 'sideline', false));
  g.add(bx(0.07, 0.02, 4.4, lineM, px + 3.25, 0.12, pz, 'sideline', false));
  const circle = new THREE.Mesh(geo('cc', () => new THREE.RingGeometry(0.62, 0.69, 44)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  circle.rotation.x = -Math.PI / 2; circle.position.set(px, 0.135, pz); g.add(circle);
  [-1, 1].forEach(s => {
    const arc = new THREE.Mesh(geo('pa', () => new THREE.RingGeometry(0.85, 0.92, 26, 1, 0, Math.PI)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    arc.rotation.x = -Math.PI / 2; arc.rotation.z = s > 0 ? Math.PI : 0;
    arc.position.set(px, 0.135, pz + s * 2.2); g.add(arc);
  });
  g.add(goalNet(px, pz - 2.5, Math.PI / 2)); g.add(goalNet(px, pz + 2.5, -Math.PI / 2));
  const players = [];
  [[-1.4, -1.2], [-0.4, 0.9], [0.7, -0.6], [1.6, 1.2], [-2.2, 1.4], [2.2, -1.4], [0.2, 2.0]].forEach(([dx, dz], i) => {
    const p = person(px + dx, pz + dz, i % 2 ? C.yellow : C.teal, i % 2 ? C.roof : C.roofDark, 0.88);
    p.position.y = 0.12; g.add(p); players.push([p, px + dx, pz + dz, i]);
  });
  const ball = sp(0.14, mat('ball', C.white, { rough: 0.6 }), px, 0.26, pz, 'ball'); g.add(ball);
  const stand = shelter(3.0, 1.6, 1.35, true);
  stand.position.set(-12.4, 0, 3.0); stand.rotation.y = 0.06; g.add(stand);
  const fans = [];
  for (let i = 0; i < 4; i++) {
    const f = person(-13.4 + i * 0.66, 2.6, [C.yellow, C.teal, C.green, C.red][i], C.roofDark, 0.84);
    f.position.y = i % 2 ? 0.6 : 0.86; sitPose(f); g.add(f); fans.push(f);
  }
  const market = new THREE.Group(); market.name = 'market';
  const shop = building(2.6, 2.2, 1.6, { rise: 0.2, wall: C.wallWarm });
  market.add(shop);
  const sw = winUnit(0.55, 0.55); sw.position.set(-0.75, 1.1, 1.13); market.add(sw);
  const sd = doorUnit(0.46, 0.86); sd.position.set(0.7, 0.18, 1.13); market.add(sd);
  market.add(rb(1.4, 0.5, 0.9, mat('roofUnit', C.trim), 0, 2.2, -0.3, 0.05, 'rooftop'));
  const mktSolar = solarArray(1.5, 0.9, 3); mktSolar.position.set(0, 2.02, -0.95); mktSolar.rotation.x = -0.27; market.add(mktSolar);
  market.add(rb(3.1, 0.12, 1.35, mat('awning', C.white, { rough: 0.7 }), 0, 1.95, 1.5, 0.03, 'awning'));
  for (let i = 0; i < 6; i++)
    market.add(bx(0.26, 0.13, 1.35, mat('awningStripe', C.roof, { rough: 0.7 }), -1.3 + i * 0.52, 1.89, 1.5, 'stripe', false));
  [-1.4, 1.4].forEach(ax => market.add(bx(0.06, 0.7, 0.06, mat('metal', C.metal, { rough: 0.4 }), ax, 1.2, 2.1, 'awningPost', false)));
  const crates = [];
  [[-1.0, C.red], [-0.35, C.yellow], [0.3, C.green], [0.95, C.red]].forEach(([cx, col]) => {
    const c = crate(cx, 1.9, col); market.add(c); crates.push(c);
  });
  const stacked = crate(0.95, 1.9, C.yellow); stacked.position.y = 0.28; market.add(stacked); crates.push(stacked);
  const vendor = person(0.1, 2.7, C.green, C.roofDark, 1.0); vendor.rotation.y = Math.PI; market.add(vendor);
  const buyer = person(-1.2, 2.8, C.yellow, C.teal, 0.94); buyer.rotation.y = -0.5; market.add(buyer);
  market.position.set(-4.6, 0, 2.2); g.add(market);
  g.add(wornPatch(-4.0, 4.1, 2.6, 1.8, 0.06));
  const smallShelter = shelter(2.0, 1.4, 1.05, true);
  smallShelter.position.set(-13.2, 0, 9.8); smallShelter.rotation.y = 0.1; g.add(smallShelter);
  const sitter = person(-13.4, 9.6, C.yellow, C.roofDark, 0.9); sitter.position.y = 0.6; sitPose(sitter); g.add(sitter);
  greens(g, [['a', -14.2, 6.6, 1.3], ['p', -5.2, 8.4, 1.15], ['m', -4.6, 3.4, 1.0],
    ['b', -6.2, 11.2, 1.2], ['g', -10.4, 10.6], ['r', -6.8, 10.2], ['d', -11.4, 1.6],
    ['a', 2.6, 2.8, 1.2], ['g', 1.6, -1.2], ['r', -3.2, 3.6]]);
  return {
    group: g,
    tick(t, k) {
      players.forEach(([p, x, z, i]) => {
        p.position.x = x + Math.sin(t * 1.5 + i) * 0.7 * k;
        p.position.z = z + Math.cos(t * 1.15 + i * 1.7) * 0.5 * k;
        p.rotation.y = Math.sin(t * 1.5 + i) * 0.9;
        walk(p, t, k, 7);
        p.position.y = 0.12;
      });
      ball.position.x = px + Math.sin(t * 2.0) * 1.8 * k;
      ball.position.z = pz + Math.cos(t * 1.6) * 1.2 * k;
      ball.position.y = 0.26 + Math.abs(Math.sin(t * 5.2)) * 0.12 * k;
      ball.rotation.z -= 0.14 * k;
      fans.forEach((f, i) => {
        f.userData.limbs.armL.rotation.x = -Math.abs(Math.sin(t * 2.6 + i)) * 0.8 * k;
        f.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 2.6 + i + 0.4)) * 0.8 * k;
      });
      crates.forEach((c, i) => c.userData.fruit.forEach((f, j) =>
        f.position.y = 0.35 + Math.abs(Math.sin(t * 2.6 + i + j)) * 0.045 * k));
      vendor.rotation.y = Math.PI + Math.sin(t * 1.3) * 0.45 * k;
      buyer.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 2.0)) * 1.0 * k;
    }
  };
}

/* 8 — Disaster Relief: Werkstatt/Lager unten Mitte + Solarhaus + Karren */
function zoneDisaster() {
  const g = new THREE.Group();
  const hall = new THREE.Group(); hall.name = 'depot';
  hall.add(rb(4.6, 0.2, 3.4, mat('stone', C.stone), 0, 0.1, 0, 0.06, 'apron'));
  hall.add(rb(3.6, 1.7, 2.8, mat('wall', C.wall, { rough: 0.9 }), -0.3, 1.05, -0.2, 0.07, 'wall'));
  const roof = shedRoof(3.9, 3.0, 0.85, 0.4);
  roof.position.set(-0.3, 1.9, -0.2); hall.add(roof);
  const arr = solarArray(2.0, 1.2, 4); arr.position.set(-0.3, 2.42, 0.35); arr.rotation.x = -0.27; hall.add(arr);
  const openings = doorUnit(0.5, 0.95); openings.position.set(-1.5, 0.2, 1.2); hall.add(openings);
  const shopWin = winUnit(1.2, 0.7); shopWin.position.set(0.7, 1.1, 1.2); hall.add(shopWin);
  for (let i = 0; i < 5; i++)
    hall.add(rb(0.5, 0.36, 0.5, mat('supplyBox', 0xdcb877, { rough: 0.9 }), -0.6 + (i % 2) * 0.6, 0.38 + Math.floor(i / 2) * 0.36, 0.9, 0.04, 'box'));
  const table = new THREE.Group();
  table.add(rb(1.5, 0.08, 0.8, mat('deskTop', C.wood, { rough: 0.85 }), 0, 0.6, 0, 0.02, 'top'));
  [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([lx, lz]) =>
    table.add(bx(0.07, 0.6, 0.07, mat('woodD', C.woodDark), lx, 0, lz, 'leg', false)));
  table.position.set(1.1, 0, 0.6); hall.add(table);
  hall.position.set(3.0, 0, 8.0); hall.rotation.y = 0.05; g.add(hall);
  g.add(wornPatch(3.4, 9.2, 1.8, 1.3));
  const worker = person(3.4, 9.2, C.teal, C.roofDark, 1.0); worker.rotation.y = 0.2; g.add(worker);
  const worker2 = person(4.6, 8.6, C.yellow, C.roofDark, 0.98); worker2.rotation.y = -1.2; g.add(worker2);
  g.add(bicycle(0.9, 9.0, 0.35));
  const cart = handcart(1.4, 12.2, 0.2); g.add(cart);
  const boy = person(0.2, 12.4, C.yellow, C.teal, 0.9); boy.rotation.y = -1.4; g.add(boy);
  const solarHouse = building(3.2, 2.6, 1.6, { rise: 0.7 });
  solarHouse.position.set(7.4, 0, 5.8); g.add(solarHouse);
  const shWin = winUnit(0.55, 0.55); shWin.position.set(6.5, 1.1, 7.15); g.add(shWin);
  const shDoor = doorUnit(0.5, 0.9); shDoor.position.set(8.2, 0.18, 7.15); g.add(shDoor);
  g.add(steps(1.1, 0.6, 8.2, 7.7));
  const arr2 = solarArray(1.7, 1.0, 3); arr2.position.set(7.2, 2.3, 5.3); arr2.rotation.x = -0.28; g.add(arr2);
  // kleines Solarfeld auf Aufständerung
  for (let i = 0; i < 3; i++) {
    const arr3 = solarArray(1.3, 0.85, 3);
    arr3.position.set(-0.6 + i * 1.15, 0.62, 4.6);
    arr3.rotation.x = -0.42; arr3.rotation.y = 0.05;
    g.add(arr3);
    [-0.45, 0.45].forEach(dx =>
      g.add(cy(0.035, 0.04, 0.6, mat('solarPost', C.metal, { rough: 0.4, metal: 0.35 }), -0.6 + i * 1.15 + dx, 0, 4.68, 6, 'solarPost')));
  }
  // Erdbebenschaden als Anlass der Nothilfe: eingestürztes Haus, daneben Notunterkünfte
  g.add(ruin(-2.2, 10.2, 0.3, 1.0));
  g.add(reliefTent(-4.4, 12.0, 0.5));
  g.add(reliefTent(-0.4, 12.6, -0.35));
  const rescuer = person(-3.2, 11.2, C.yellow, C.roofDark, 1.0); rescuer.rotation.y = 0.7; g.add(rescuer);
  const rescuer2 = person(-1.0, 8.8, C.teal, C.roofDark, 0.98); rescuer2.rotation.y = -1.9; g.add(rescuer2);
  const passer = person(8.4, 4.8, C.green, C.roofDark, 1.0); passer.rotation.y = 2.4; g.add(passer);
  const passer2 = person(9.3, 5.4, C.teal, C.roofDark, 0.98); passer2.rotation.y = -0.7; g.add(passer2);
  greens(g, [['m', -0.4, 6.4, 1.05], ['a', 6.8, 11.6, 1.3], ['p', 10.4, 3.4, 1.15],
    ['b', -1.0, 10.8, 1.2], ['g', 2.0, 5.6], ['r', 5.8, 12.2], ['d', 7.8, 8.6],
    ['b', 4.0, 3.0], ['g', 8.0, 2.6]]);
  return {
    group: g,
    tick(t, k) {
      worker.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 2.4)) * 1.2 * k;
      worker2.position.x = 4.6 + Math.sin(t * 1.1) * 0.5 * k;
      walk(worker2, t, k, 5);
      cart.position.x = 1.4 + Math.sin(t * 0.7) * 0.5 * k;
      boy.position.x = 0.2 + Math.sin(t * 0.7 + 0.5) * 0.5 * k;
      walk(boy, t, k, 5.5);
      passer.position.x = 8.4 + Math.sin(t * 1.0) * 0.6 * k;
      walk(passer, t, k, 4.8);
      rescuer.userData.limbs.armR.rotation.x = -Math.abs(Math.sin(t * 2.2)) * 1.15 * k;
      rescuer.userData.limbs.armL.rotation.x = -Math.abs(Math.sin(t * 2.2 + 0.6)) * 0.9 * k;
      rescuer2.position.z = 8.8 + Math.sin(t * 0.9) * 0.5 * k;
      walk(rescuer2, t, k, 4.2);
      passer2.userData.limbs.armL.rotation.x = -Math.abs(Math.sin(t * 2.0)) * 0.9 * k;
    }
  };
}

export const PROGRAMS = [
  { key: 'knowledge', name: 'Knowledge for Life', build: zoneSchool,
    hits: [[-10.4, -10.2, 3.2], [-7.6, -7.4, 3.0]], label: [-9.0, -8.8],
    line: 'Schulen, Lernmaterial und Ausbildung für Kinder ohne Zugang zu Bildung.',
    body: 'Bildung durchbricht den Teufelskreis der Armut. Humanity First baut und unterhält Schulen, stellt Lernmaterial bereit und unterstützt Schülerinnen und Schüler beim Zugang zu digitalem Unterricht.',
    url: 'https://humanityfirst.de/programme/knowledge-for-life/' },
  { key: 'orphan', name: 'Orphan Care', build: zoneOrphan,
    hits: [[-12.4, -5.8, 2.8], [-12.9, -1.6, 2.4]], label: [-12.6, -4.0],
    line: 'Ein Zuhause, Betreuung und Schulbildung für Waisenkinder.',
    body: 'In Waisenheimen wie dem Ahmadiyya Daroul Ikram erhalten Kinder ein sicheres Zuhause, Verpflegung, medizinische Betreuung und eine Schulausbildung — begleitet bis in die Selbstständigkeit.',
    url: 'https://humanityfirst.de/programme/orphan-care/' },
  { key: 'sight', name: 'Gift of Sight', build: zoneSight,
    hits: [[-10.0, -3.6, 2.6], [-7.6, -2.0, 1.8]], label: [-9.6, -2.6],
    line: '70 € schenken einem Menschen mit einer Katarakt-OP das Augenlicht.',
    body: 'Mit der mobilen Augenklinik ′Al-Ain′ erreicht Humanity First auch entlegene Dörfer in Afrika. Eine Katarakt-Operation kostet rund 70 € und gibt Menschen ihr Sehvermögen zurück.',
    url: 'https://humanityfirst.de/programme/gift-of-sight/' },
  { key: 'water', name: 'Water for Life', build: zoneWater,
    hits: [[-1.0, -6.2, 2.8], [-4.6, -9.2, 2.6]], label: [-1.0, -6.4],
    line: 'Brunnen und Leitungen für Dörfer ohne sauberes Trinkwasser.',
    body: 'Alle 15 Sekunden stirbt ein Kind durch verschmutztes Trinkwasser. Mit Brunnen, Handpumpen und Wassertanks kann ein ganzes Dorf dauerhaft mit sauberem Wasser versorgt werden.',
    url: 'https://humanityfirst.de/programme/water-for-life/' },
  { key: 'health', name: 'Global Health', build: zoneClinic,
    hits: [[6.0, -9.4, 3.0], [2.6, -7.4, 2.2]], label: [5.4, -8.6],
    line: 'Medizinische Versorgung und mobile Kliniken in unterversorgten Regionen.',
    body: 'Kliniken, Gesundheitsstationen und mobile Teams versorgen Menschen dort, wo es keine erreichbare medizinische Infrastruktur gibt — von der Grundversorgung bis zu Impfkampagnen.',
    url: 'https://humanityfirst.de/programme/global-health/' },
  { key: 'food', name: 'Food Security', build: zoneFood,
    hits: [[12.6, -5.6, 3.6], [16.2, -9.0, 2.8], [11.9, 1.2, 2.2], [16.8, 7.0, 3.2]], label: [13.4, -6.0],
    line: 'Landwirtschaft, Saatgut und Nahrungsmittelhilfe gegen Hunger.',
    body: 'Neben akuter Nahrungsmittelhilfe geht es um Eigenständigkeit: Saatgut, Bewässerung, Gewächshäuser, Bienenhaltung und Vieh, damit Familien sich langfristig selbst versorgen können.',
    url: 'https://humanityfirst.de/programme/food-security/' },
  { key: 'community', name: 'Community Care', build: zoneCommunity,
    hits: [[-9.2, 6.4, 3.8], [-12.4, 3.0, 2.4], [-4.6, 3.2, 2.8], [-13.2, 9.8, 2.0]], label: [-9.2, 5.4],
    line: 'Nachbarschaftshilfe, Begegnung und Unterstützung im Alltag.',
    body: 'Community Care richtet sich an benachteiligte Menschen in der unmittelbaren Umgebung: Lebensmittelausgaben, Sport- und Jugendarbeit, Beratung und Hilfe bei Behördengängen.',
    url: 'https://humanityfirst.de/programme/community-care/' },
  { key: 'disaster', name: 'Disaster Relief', build: zoneDisaster,
    hits: [[3.0, 8.4, 3.2], [1.0, 11.8, 2.2], [7.4, 5.8, 2.6], [-2.6, 10.8, 3.0]], label: [3.0, 8.0],
    line: 'Soforthilfe nach Erdbeben, Fluten und in Krisengebieten.',
    body: 'Nach Katastrophen zählt Geschwindigkeit: Notunterkünfte, Trinkwasser, Decken, Hygiene- und Lebensmittelpakete — von der Türkei und Syrien bis Pakistan, Polen und Madagaskar.',
    url: 'https://humanityfirst.de/programme/disaster-relief/' }
];

/* ================= Insel ================= */
/** Halbachsen der Insel und Drehung der Bühne — auch außerhalb für die
 *  Berechnung der sichtbaren Ausdehnung gebraucht. */
export const ISLAND_RX = 27;
export const ISLAND_RZ = 20.5;
export const STAGE_ROT_Y = Math.PI / 4 - 0.22;

function islandShape(rx, rz) {
  const pts = [];
  const N = 160;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.035 * Math.sin(a * 7) + 0.028 * Math.sin(a * 11 + 1.2) + 0.02 * Math.sin(a * 4 - 0.6);
    pts.push(new THREE.Vector2(Math.cos(a) * rx * wob, Math.sin(a) * rz * wob));
  }
  return new THREE.Shape(pts);
}
function buildIsland() {
  const g = new THREE.Group(); g.name = 'island';
  const shape = islandShape(ISLAND_RX, ISLAND_RZ);
  const slab = new THREE.ExtrudeGeometry(shape, {
    depth: 1.5, bevelEnabled: true, bevelThickness: 0.34, bevelSize: 0.34, bevelSegments: 4, curveSegments: 2
  });
  slab.rotateX(-Math.PI / 2); slab.translate(0, -1.84, 0);   // Oberkante auf y = 0
  const isl = new THREE.Mesh(slab, [mat('grass', C.grass, { rough: 0.95 }), mat('dirtSide', C.dirtSide, { rough: 0.98 })]);
  isl.receiveShadow = true; isl.castShadow = true; isl.name = 'ground';
  g.add(isl);
  // Grastöne
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39, r = 3.0 + (i % 8) * 2.6;
    const patch = new THREE.Mesh(geo('patch', () => new THREE.CircleGeometry(1.9, 24)),
      mat(i % 2 ? 'grassLight' : 'grassDark', i % 2 ? C.grassLight : C.grassDark, { rough: 0.95, offset: -1 }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * r * 1.25, 0.012 + i * 0.0006, Math.sin(a) * r);
    patch.scale.set(1 + (i % 3) * 0.25, 1, 0.75 + (i % 4) * 0.2);
    patch.receiveShadow = true; g.add(patch);
  }
  // Kochstelle nahe dem zentralen Brunnenplatz
  const fire = campfire(3.4, 2.6, 1.0); g.add(fire); g.userData.campfire = fire;

  // Dorfleben auf den Freiflächen zwischen den Programmbereichen: spielende Kinder,
  // Hühner und ein Hund. Bewusst zonenneutral — kein Einfluss auf Hover/Programme.
  const life = { walkers: [], hens: [], dogs: [] };
  // Kinder auf kleinen Runden in den Lücken zwischen den Bereichen
  [[-14, -10.5, 1.7], [13.5, -7.5, 2.0], [14, 7, 1.8], [-1.5, 13.5, 2.2],
   [-15.5, 8.5, 1.6], [-20, -1, 1.5], [5.5, -5.5, 1.9], [-5.5, -6.5, 1.6]]
    .forEach(([cx, cz, r], i) => {
      const p = person(cx, cz, [C.yellow, C.teal, C.green, C.red][i % 4], C.roofDark, 0.82 + (i % 3) * 0.05);
      g.add(p);
      life.walkers.push({ p, cx, cz, r, sp: 0.28 + (i % 4) * 0.07, ph: i * 1.9 });
    });
  // Hühner: picken in Grüppchen, meist nahe der Wege und Höfe
  [[2.6, 2.0], [3.4, 1.2], [1.8, 3.0], [-6.5, 5.5], [-5.8, 6.4],
   [9.5, -3.5], [10.4, -2.8], [-12, -2.5], [16, 4.5], [-2.5, -9.5]]
    .forEach(([hx, hz], i) => {
      const h = chicken(hx, hz, 1.0, i % 3 === 0);
      g.add(h);
      life.hens.push({ h, ph: i * 1.3, hx, hz });
    });
  // Hund
  const hund = dog(-8.5, 1.5, 1.0);
  g.add(hund);
  life.dogs.push({ d: hund, cx: -8.5, cz: 1.5, r: 2.6, sp: 0.42, ph: 0.5 });
  g.userData.life = life;

  // Randbepflanzung, dicht
  // Küstensaum: bewusst locker gesetzt, Mischung aus Akazie, Palme, Bambus statt Baumteppich
  const rim = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2;
    const rr = 0.90 + ((i * 37) % 11) / 130;
    rim.push([Math.cos(a) * (ISLAND_RX - 0.6) * rr, Math.sin(a) * (ISLAND_RZ - 0.6) * rr, i]);
  }
  rim.forEach(([x, z, i]) => {
    const kind = i % 5;
    if (kind === 0) g.add(acacia(x, z, 1.2 + (i % 3) * 0.16));
    else if (kind === 1) g.add(palm(x, z, 1.1 + (i % 2) * 0.18));
    else if (kind === 2) g.add(bamboo(x, z, 0.95 + (i % 3) * 0.14));
    else if (kind === 3) g.add(tree(x, z, 1.25 + (i % 3) * 0.2, i % 2));
    if (i % 2) g.add(tuft(x - 1.0, z + 1.2, 1.0 + (i % 3) * 0.15));
    if (i % 3 === 0) g.add(rocks(x + 1.6, z - 1.3, 1.1));
    if (i % 4 === 1) g.add(termiteMound(x + 1.2, z + 1.5, 0.9 + (i % 2) * 0.3));
  });
  // Füllung in den Zwischenräumen
  // Zwischenräume nur sparsam füllen — offene Flächen sind gewollt
  const fill = [[-4.2, -1.4], [2.4, -2.8], [-4.4, 3.0], [-15.4, 1.8], [-15.6, -8.2],
    [8.8, -5.2], [18.6, -5.4], [10.6, 10.4], [-7.4, 11.8], [1.2, 6.2],
    [11.8, -11.6], [-2.6, -11.2], [-17.2, -2.6], [-9.8, 12.4], [8.2, 12.0], [13.6, 8.8],
    [-24.0, 4.0], [24.2, -3.0], [-21.0, -10.0], [22.0, 11.0], [-6.0, 17.5], [7.0, -17.0],
    [-14.0, -16.0], [17.0, 15.0], [0.0, 19.0], [-25.0, 12.0]];
  fill.forEach(([x, z], i) => {
    const kind = i % 4;
    if (kind === 0) g.add(acacia(x, z, 1.15 + (i % 3) * 0.14));
    else if (kind === 1) g.add(bamboo(x, z, 0.9 + (i % 2) * 0.16));
    else if (kind === 2) g.add(bush(x + 1.1, z - 0.8, 1.05 + (i % 2) * 0.25));
    g.add(tuft(x - 0.9, z + 0.9, 1.05));
    if (i % 3 === 1) g.add(rocks(x + 1.5, z + 1.2, 1.05));
    if (i % 5 === 2) g.add(termiteMound(x - 1.3, z - 1.1, 0.95));
  });
  return g;
}

/**
 * Platzierung der Zonen auf der Insel.
 * Der Versatz verschiebt jede Zone als Ganzes (Gebäude, Requisiten, Trefferflächen,
 * Bodenplatten, Label-Anker). Die Werte sind so gewählt, dass der Brunnen der
 * Wasser-Zone genau in der Inselmitte (0,0) liegt und sich die übrigen sieben
 * Bereiche ringförmig und gleichmäßig darum verteilen.
 */
const ZONE_OFFSET = {
  water:     [1.0, 6.6],      // Brunnen exakt ins Zentrum
  sight:     [-0.2, -10.2],   // oben          -> Ziel (-9, -13)
  health:    [2.2, -3.6],     // oben rechts   -> Ziel (6.5, -12)
  food:      [4.125, 3.1],    // rechte Flanke -> Ziel (18.5, 1.5)
  disaster:  [5.3, 2.3],      // unten rechts  -> Ziel (7.5, 11.5)
  community: [-0.15, 5.4],    // unten links   -> Ziel (-10, 11)
  orphan:    [-6.85, 7.7],    // linke Flanke  -> Ziel (-19.5, 4)
  knowledge: [-9.0, 2.3]      // links oben    -> Ziel (-18, -6.5)
};

/** Bewegt das Dorfleben (Kinder, Hühner, Hund, Feuer). Liegt hier, weil die
 *  Lauf-Animation der Figuren (walk) Teil der Primitiven-Bibliothek ist. */
export function animateLife(island, t, dusk = 0) {
  if (!island) return;
  const fire = island.userData.campfire;
  if (fire) {
    fire.userData.flames.forEach(([f, baseH, i]) => {
      const fl = (0.82 + 0.18 * Math.sin(t * (7 + i * 2.3) + i)) * (1 + 0.9 * dusk);
      f.scale.y = baseH * fl;
      f.position.y = 0.16 + (baseH * fl) / 2;
    });
  }
  const life = island.userData.life;
  if (!life) return;
  life.walkers.forEach(w => {
    const a = t * w.sp + w.ph;
    w.p.position.x = w.cx + Math.cos(a) * w.r;
    w.p.position.z = w.cz + Math.sin(a) * w.r * 0.72;
    w.p.rotation.y = -a + Math.PI / 2;              // Blick in Laufrichtung
    walk(w.p, t, 1, 5.2);
  });
  life.hens.forEach(h => {
    h.h.userData.head.rotation.x = 0.5 + 0.5 * Math.sin(t * 2.6 + h.ph);   // Picken
    h.h.rotation.y = Math.sin(t * 0.5 + h.ph) * 1.4;
    h.h.position.x = h.hx + Math.sin(t * 0.4 + h.ph) * 0.35;
    h.h.position.z = h.hz + Math.cos(t * 0.33 + h.ph) * 0.3;
  });
  life.dogs.forEach(d => {
    const a = t * d.sp + d.ph;
    d.d.position.x = d.cx + Math.cos(a) * d.r;
    d.d.position.z = d.cz + Math.sin(a) * d.r * 0.7;
    d.d.rotation.y = -a + Math.PI / 2;
    d.d.userData.tail.rotation.x = Math.sin(t * 9) * 0.5;
  });
}

export function createVillage() {
  const root = new THREE.Group(); root.name = 'village';
  const stage = new THREE.Group(); stage.name = 'stage';
  stage.rotation.y = STAGE_ROT_Y;                     // isometrische Drehung wie in der Vorlage
  root.add(stage);
  const island = buildIsland();
  stage.add(island);
  const zones = {};
  PROGRAMS.forEach(p => {
    const z = p.build();
    z.group.name = 'zone_' + p.key;
    const holder = new THREE.Group(); holder.name = 'holder_' + p.key;
    holder.add(z.group);
    const [ox, oz] = ZONE_OFFSET[p.key] || [0, 0];
    holder.position.set(ox, 0, oz);
    // Jede Trefferfläche beschreibt einen zusammenhängenden Bereich der Zone — daraus wird
    // automatisch die Bodenplatte abgeleitet, damit kein Bereich ohne Untergrund bleibt.
    // Der kleine y-Versatz je Index verhindert koplanare Flächen (Flimmern) bei Überlappung.
    const padMats = [];
    p.hits.forEach(([hx, hz, hr], i) => {
      const size = hr * 1.7;
      // achsparallel (ruhiger Eindruck) und mit deutlichem Höhenversatz je Bereich,
      // damit überlappende Platten nie koplanar liegen.
      const pad = groundPad(hx, hz, size, size * 0.86, 0, i * 0.006);
      // Eigene Material-Instanzen: der mat()-Cache teilt Materialien zonenübergreifend,
      // eine Einfärbung würde sonst alle Platten der Szene betreffen.
      pad.traverse(o => {
        if (o.isMesh) {
          o.material = o.material.clone();
          padMats.push({ m: o.material, base: o.material.color.clone() });
        }
      });
      holder.add(pad);
    });
    // Schild mit Programm-Piktogramm vor dem Hauptbereich
    const [sx, sz, sr] = p.hits[0];
    holder.add(programSign(sx, sz + sr * 1.15, p.key, 1.0));
    const hits = p.hits.map(([hx, hz, hr]) => {
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, 5.5, 14), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(hx, 1.8, hz); hit.userData.zoneKey = p.key; hit.name = 'hit_' + p.key;
      holder.add(hit);
      return hit;
    });
    const rings = p.hits.map(([hx, hz, hr]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(hr * 0.84, hr * 0.97, 48),
        new THREE.MeshBasicMaterial({ color: 0xfff3c2, transparent: true, opacity: 0 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(hx, 0.05, hz); ring.name = 'ring';
      holder.add(ring);
      return ring;
    });
    const anchor = new THREE.Object3D();
    anchor.position.set(p.label[0], 3.4, p.label[1]);
    holder.add(anchor);
    stage.add(holder);
    zones[p.key] = { holder, rings, hits, anchor, inner: z.group, tick: z.tick, data: p, k: 0,
      padMats, brand: BRAND[p.key] };
  });
  // Wegenetz aus den tatsächlichen Positionen ableiten (nicht hartkodiert), damit
  // kein Weg im Leeren endet. Reine Speichen vom Zentrum ergaben ein auffällig
  // sternförmiges Muster — daher hängt nur ein Teil der Bereiche direkt am Dorfplatz,
  // der Rest über Querverbindungen; alle Wege verlaufen leicht geschwungen.
  const netz = new THREE.Group(); netz.name = 'footpaths';
  const PLAZA = 2.8;   // Wege beginnen am Rand des Brunnenplatzes, nicht im Brunnen
  const anchors = PROGRAMS.map(p => {
    const [ox, oz] = ZONE_OFFSET[p.key] || [0, 0];
    return { key: p.key, x: p.hits[0][0] + ox, z: p.hits[0][1] + oz, hits: p.hits, ox, oz };
  });
  const SPOKE = { sight: 1, health: 1, community: 1, food: 1 };
  anchors.forEach((a, i) => {
    if (SPOKE[a.key]) {
      const d = Math.hypot(a.x, a.z) || 1;
      netz.add(footpath((a.x / d) * PLAZA, (a.z / d) * PLAZA, a.x, a.z, 0.95, 1.6, i * 1.3));
    }
    for (let j = 1; j < a.hits.length; j++) {
      netz.add(footpath(a.x, a.z, a.hits[j][0] + a.ox, a.hits[j][1] + a.oz, 0.7, 0.7, i + j));
    }
  });
  // Ringverbindungen entlang der Nachbarschaft rund um den Platz
  const by = k => anchors.find(a => a.key === k);
  [['sight', 'knowledge'], ['knowledge', 'orphan'], ['orphan', 'community'],
   ['community', 'disaster'], ['disaster', 'food'], ['food', 'health'],
   ['health', 'sight']].forEach(([a, b], i) => {
    const A = by(a), B = by(b);
    if (A && B) netz.add(footpath(A.x, A.z, B.x, B.z, 0.8, 2.4, i * 2.1 + 0.6));
  });
  stage.add(netz);

  return { root, stage, zones, island };
}
