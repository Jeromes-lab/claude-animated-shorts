// Static scenery of the scorcher short: the City of London street (Eastcheap) with the curved glass tower and its roof
// crane, Victorian shop terraces, office blocks, a domed cathedral on the skyline, street furniture and the hair salon
// with a real interior; the garden for the window / spoon demo; Las Vegas (crescent hotel, pool deck, palms,
// mountains). Everything that could stand in front of a lens is tested against the film's sight lines.
import * as THREE from "three";
import { Batch, boxGeo, quad, lam, V, Ray, setSight, inTheWay, addVeg, VegKind, Kit, prop } from "./build";
import { ctex, rep, stoneHD, grassHD, roofHD } from "./paint";
import {
  roadHD, paveHD, kerbHD, officeHD, towerGlassHD, towerSideHD, shopHD, Shop, terraceHD, tilesHD, sandHD, poolHD, deckHD, hotelHD, shedHD,
} from "./paint2";
import { twoTone } from "./shade";
import { TOWER, towerZ, towerHW, ROAD, PAVE_N, PAVE_S, SALON, GARDEN, VEGAS, V3 } from "./story";
import { rng } from "./paint";

export const CURB = 0.13; // pavement height
const up = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number, u0 = 0, v0 = 0) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v, u0, v0);

// ---------------- the tower ----------------
const NU = 40, NY = 60;
/** front: concave glass grid (u across, y up), sides flaring out with height, flat back, roof */
const towerGeo = () => {
  const H = TOWER.h, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NU; i++) {
    const y = (j / NY) * H, u = (i / NU) * 2 - 1, x = u * towerHW(y);
    pos.push(x, y, towerZ(x, y)); uv.push(i / NU, j / NY);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 2, d = a + NU + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const towerSides = (b: Batch, side: THREE.Material, roofM: THREE.Material) => {
  const H = TOWER.h, n = 30;
  for (const s of [-1, 1]) for (let j = 0; j < n; j++) {
    const y0 = (j / n) * H, y1 = ((j + 1) / n) * H, x0 = s * towerHW(y0), x1 = s * towerHW(y1);
    const f0 = towerZ(x0, y0), f1 = towerZ(x1, y1), bk = TOWER.back;
    const a = V(x0, y0, bk), bb = V(x0, y0, f0), c = V(x1, y1, f1), d = V(x1, y1, bk);
    b.add(s > 0 ? quad(bb, a, d, c, 1, 1 / n, 0, 0) : quad(a, bb, c, d, 1, 1 / n, 0, 0), side);
  }
  const hw = towerHW(H);
  b.add(quad(V(hw, 0, TOWER.back), V(-hw, 0, TOWER.back), V(-towerHW(H), H, TOWER.back), V(hw, H, TOWER.back), 1, 1), side);
  // roof: fan over the front curve
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) { const x = -hw + (2 * hw * i) / 20; pts.push(V(x, H, towerZ(x, H))); }
  for (let i = 0; i < 20; i++) {
    const g = new THREE.BufferGeometry();
    const p = [pts[i], V(pts[i].x, H, TOWER.back), V(pts[i + 1].x, H, TOWER.back), pts[i + 1]];
    g.setAttribute("position", new THREE.Float32BufferAttribute([p[0], p[2], p[1], p[0], p[3], p[2]].flatMap((v) => [v.x, v.y, v.z]), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(Array(12).fill(0), 2));
    b.add(g, roofM);
  }
  // parapet + lobby canopy at street level
  b.add(boxGeo(V(-hw, H, TOWER.back), V(hw, H + 1.2, TOWER.back + 1.2), 4), roofM);
  b.add(boxGeo(V(-14, 5.8, towerZ(0, 6) - 0.2), V(14, 6.3, towerZ(0, 6) + 3.2), 4), lam("canopy", () => ({ color: "#c9ccd2" })));
};
/** tower crane on the roof (the tower was still being built in 2013) */
const crane = (b: Batch) => {
  const Y = lam("craneY", () => ({ color: "#e8b23a" })), D = lam("craneD", () => ({ color: "#3b3f52" })), H = TOWER.h;
  const cx = 9, cz = -36, top = H + 34;
  for (let y = H; y < top; y += 3) { // lattice mast: corner posts + diagonals as thin boxes
    b.add(boxGeo(V(cx - 1, y, cz - 1), V(cx + 1, y + 0.18, cz + 1)), Y);
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(boxGeo(V(cx + dx * 0.9 - 0.12, H, cz + dz * 0.9 - 0.12), V(cx + dx * 0.9 + 0.12, top, cz + dz * 0.9 + 0.12)), Y);
  b.add(boxGeo(V(cx - 14, top, cz - 0.7), V(cx + 46, top + 1.4, cz + 0.7)), Y);   // jib (toward +x) + counter-jib
  b.add(boxGeo(V(cx - 13, top - 2.6, cz - 1.3), V(cx - 7, top, cz + 1.3)), D);      // counterweight
  b.add(boxGeo(V(cx - 1.2, top - 3.4, cz + 1.0), V(cx + 1.2, top - 1.0, cz + 3.0)), lam("cab", () => ({ color: "#f1efe8" }))); // cab
  b.add(boxGeo(V(cx - 0.3, top + 1.4, cz - 0.3), V(cx + 0.3, top + 7, cz + 0.3)), Y); // apex
  b.add(boxGeo(V(cx + 30 - 0.05, top - 22, cz - 0.05), V(cx + 30 + 0.05, top, cz + 0.05)), D); // hook line
  b.add(boxGeo(V(cx + 29.4, top - 23, cz - 0.6), V(cx + 30.6, top - 22, cz + 0.6)), D);
};

// ---------------- buildings ----------------
type Block = { x0: number; x1: number; z0: number; z1: number; h: number; front: "n" | "s"; kind: "terrace" | "office"; shops?: Shop[]; wall?: string; keep?: boolean };
const WALLS = ["#e0a85e", "#c9673f", "#ecca86", "#b8553a", "#e6c79a", "#d48a5a", "#9fb7a0"];
const blockMesh = (b: Batch, B: Block, key: string) => {
  const w = B.x1 - B.x0, d = B.z1 - B.z0, h = B.h;
  // skip when it blocks a lens (core lines only, so blocks can still frame)
  if (!B.keep && inTheWay(B.x0, B.x1, 0, h, B.z0, B.z1, true)) return;
  const wall = B.wall ?? "#d9c3a0";
  const plain = lam("bw" + wall, () => ({ color: wall }));
  const fz = B.front === "s" ? B.z0 : B.z1; // front face z (faces the street)
  const dir = B.front === "s" ? -1 : 1;
  const faceQuad = (y0: number, y1: number, mat: THREE.Material) => {
    const a = V(dir > 0 ? B.x0 : B.x1, y0, fz), bb = V(dir > 0 ? B.x1 : B.x0, y0, fz), c = V(dir > 0 ? B.x1 : B.x0, y1, fz), dd = V(dir > 0 ? B.x0 : B.x1, y1, fz);
    b.add(quad(a, bb, c, dd), mat);
  };
  if (B.kind === "terrace") {
    // ground floor: one shop front per 6 m, upper floors stone with sash windows
    const n = Math.max(1, Math.round(w / 6)), sw = w / n;
    for (let i = 0; i < n; i++) {
      const kind = B.shops?.[i % (B.shops?.length || 1)] ?? "office";
      const sx0 = dir > 0 ? B.x0 + i * sw : B.x1 - i * sw, sx1 = dir > 0 ? sx0 + sw : sx0 - sw;
      const isSalon = kind === "salon";
      const m = lam("shopM" + kind + isSalon, () => ({ map: shopHD(kind, isSalon), alphaTest: 0.5, side: isSalon ? THREE.DoubleSide : THREE.FrontSide }));
      b.add(quad(V(sx0, CURB, fz), V(sx1, CURB, fz), V(sx1, 4.2 + CURB, fz), V(sx0, 4.2 + CURB, fz)), m);
    }
    const upM = lam("ter" + key, () => ({ map: terraceHD(key, w, h - 4.2, wall) }));
    faceQuad(4.2 + CURB, h, upM);
    // cornice + fascia ledge
    const zc = dir > 0 ? [fz, fz + 0.35] : [fz - 0.35, fz];
    b.add(boxGeo(V(B.x0 - 0.1, h - 0.6, zc[0]), V(B.x1 + 0.1, h - 0.25, zc[1])), lam("trimStone", () => ({ color: "#efe3c8" })));
    b.add(boxGeo(V(B.x0, 4.2 + CURB, zc[0]), V(B.x1, 4.45 + CURB, zc[1])), lam("trimStone", () => ({ color: "#efe3c8" })));
  } else {
    const m = lam("off" + key, () => ({ map: officeHD(key, w, h, { stone: wall, glass: "#8fa6cf", mull: 1.5 }) }));
    faceQuad(0, h, m);
  }
  // sides, back, roof
  b.add(quad(V(B.x0, 0, B.z0), V(B.x0, 0, B.z1), V(B.x0, h, B.z1), V(B.x0, h, B.z0)), plain);
  b.add(quad(V(B.x1, 0, B.z1), V(B.x1, 0, B.z0), V(B.x1, h, B.z0), V(B.x1, h, B.z1)), plain);
  const bz = B.front === "s" ? B.z1 : B.z0;
  b.add(dir > 0 ? quad(V(B.x1, 0, bz), V(B.x0, 0, bz), V(B.x0, h, bz), V(B.x1, h, bz)) : quad(V(B.x0, 0, bz), V(B.x1, 0, bz), V(B.x1, h, bz), V(B.x0, h, bz)), plain);
  b.add(up(B.x0, B.x1, B.z0, B.z1, h, 1, 1), lam("roofTar", () => ({ color: "#7d7a80" })));
  b.add(boxGeo(V(B.x0, h, B.z0), V(B.x1, h + 0.9, B.z0 + 0.4)), plain);
  b.add(boxGeo(V(B.x0, h, B.z1 - 0.4), V(B.x1, h + 0.9, B.z1)), plain);
};

/** the salon interior behind its open door: tiled floor, walls, a mirror, two chairs, the doormat lives in world.ts */
const salonRoom = (b: Batch) => {
  const { x0, x1, z0, z1 } = SALON, y0 = CURB, y1 = 4.2 + CURB;
  b.add(up(x0, x1, z0, z1, y0 + 0.002, (x1 - x0) / 2, (z1 - z0) / 2), lam("tiles", () => ({ map: rep(tilesHD(), 1, 1) })));
  const wallM = lam("salonWall", () => ({ color: "#e9c9b6" })), side = THREE.DoubleSide;
  b.add(quad(V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1)), wallM);                 // back
  b.add(quad(V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1)), wallM);                 // left
  b.add(quad(V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0)), wallM);                 // right
  b.add(quad(V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)), lam("ceil", () => ({ color: "#f3ebe0", side })));
  // mirror + counter on the back wall, two chairs
  b.add(boxGeo(V(x0 + 0.8, 1.2, z1 - 0.06), V(x1 - 0.8, 2.6, z1 - 0.02)), lam("mirror", () => ({ color: "#b9d4ea" })));
  b.add(boxGeo(V(x0 + 0.6, 0.9, z1 - 0.6), V(x1 - 0.6, 1.0, z1 - 0.05)), lam("counter", () => ({ color: "#f4ecd8" })));
  for (const cx of [x0 + 1.9, x1 - 1.9]) {
    const red = lam("chairRed", () => ({ color: "#b8403a" })), steel = lam("chairSteel", () => ({ color: "#9aa0aa" }));
    b.add(boxGeo(V(cx - 0.32, y0, z1 - 1.6), V(cx + 0.32, 0.55, z1 - 1.0)), steel);
    b.add(boxGeo(V(cx - 0.36, 0.55, z1 - 1.7), V(cx + 0.36, 0.8, z1 - 0.95)), red);
    b.add(boxGeo(V(cx - 0.36, 0.8, z1 - 1.05), V(cx + 0.36, 1.6, z1 - 0.9)), red);
  }
};

/** cathedral dome on the skyline (west) */
const cathedral = (b: Batch, x: number, z: number) => {
  const st = lam("cathStone", () => ({ map: stoneHD("cathHD", ["#e6dcc8", "#ddd2bd", "#ece3d1", "#d6cab4"], "#b5a891") }));
  const lead = lam("dome", () => ({ color: "#8e9aa6" }));
  b.add(boxGeo(V(x - 40, 0, z - 14), V(x + 40, 26, z + 14), 6), st);
  b.add(new THREE.CylinderGeometry(15, 15, 18, 32, 1), st, new THREE.Matrix4().makeTranslation(x, 35, z));
  b.add(new THREE.CylinderGeometry(16.5, 16.5, 2, 32, 1), st, new THREE.Matrix4().makeTranslation(x, 44.5, z));
  b.add(new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lead, new THREE.Matrix4().compose(V(x, 45, z), new THREE.Quaternion(), V(1, 1.15, 1)));
  b.add(new THREE.CylinderGeometry(2, 2.5, 8, 12, 1), st, new THREE.Matrix4().makeTranslation(x, 66, z));
  b.add(new THREE.SphereGeometry(1.6, 12, 8), lam("gold", () => ({ color: "#d9b04a" })), new THREE.Matrix4().makeTranslation(x, 71, z));
  for (const s of [-1, 1]) {
    b.add(boxGeo(V(x + s * 34 - 5, 26, z + 9), V(x + s * 34 + 5, 50, z + 15), 6), st);
    b.add(new THREE.ConeGeometry(4, 10, 4), lead, new THREE.Matrix4().makeTranslation(x + s * 34, 55, z + 12));
  }
};

/** street furniture: lamp post, bollard, phone box, post box */
const lamp = (b: Batch, x: number, z: number) => {
  if (inTheWay(x - 0.4, x + 0.4, 0, 6, z - 0.4, z + 0.4, true)) return;
  const blk = lam("lampBlk", () => ({ color: "#2c2a33" }));
  b.add(new THREE.CylinderGeometry(0.07, 0.11, 5.6, 8), blk, new THREE.Matrix4().makeTranslation(x, CURB + 2.8, z));
  b.add(new THREE.CylinderGeometry(0.22, 0.12, 0.5, 8), blk, new THREE.Matrix4().makeTranslation(x, CURB + 5.8, z));
  b.add(new THREE.SphereGeometry(0.18, 10, 8), lam("lampGlass", () => ({ color: "#f6eccb" })), new THREE.Matrix4().makeTranslation(x, CURB + 5.5, z));
};
const phoneBox = (b: Batch, x: number, z: number, yaw: number) => {
  if (inTheWay(x - 0.6, x + 0.6, 0, 2.6, z - 0.6, z + 0.6, true)) return;
  const red = lam("phoneRed", () => ({ color: "#c8323a" })), glass = lam("phoneGlass", () => ({ color: "#b9d4ea" }));
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, CURB, z);
  b.add(boxGeo(V(-0.5, 0, -0.5), V(0.5, 2.45, 0.5)), red, m);
  for (const [a, c] of [[V(-0.38, 0.9, 0.51), V(0.38, 2.1, 0.52)], [V(-0.38, 0.9, -0.52), V(0.38, 2.1, -0.51)]] as const) b.add(boxGeo(a, c), glass, m);
  b.add(boxGeo(V(-0.55, 2.45, -0.55), V(0.55, 2.6, 0.55)), red, m);
  b.add(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 4, 1).rotateY(Math.PI / 4), red, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 2.72, 0)));
};
const postBox = (b: Batch, x: number, z: number) => {
  const red = lam("phoneRed", () => ({ color: "#c8323a" }));
  b.add(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 16), red, new THREE.Matrix4().makeTranslation(x, CURB + 0.65, z));
  b.add(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, new THREE.Matrix4().makeTranslation(x, CURB + 1.3, z));
  b.add(boxGeo(V(x - 0.15, CURB + 1.0, z + 0.28), V(x + 0.15, CURB + 1.06, z + 0.32)), lam("lampBlk", () => ({ color: "#2c2a33" })));
};
const veg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number) => {
  const rad = k === "bush" ? 0.85 * h : 0.39 * h;
  if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
  addVeg(b, k, x, y, z, h, seed, Math.hypot(x - GARDEN[0], z) < 400 || Math.hypot(x, z) < 120 ? 0 : 1);
};

// ---------------- London ----------------
const london = (b: Batch) => {
  // ground: road, pavements, kerbs, the plaza in front of the tower
  b.add(up(-420, 420, ROAD.n, ROAD.s, 0, 840 / 6.3, 1, 0, 0), lam("road", () => ({ map: roadHD() })));
  const pave = lam("pave", () => ({ map: paveHD() }));
  b.add(up(-420, 420, PAVE_N, ROAD.n, CURB, 210, 1), pave);
  b.add(up(-420, 420, ROAD.s, PAVE_S, CURB, 210, 1.25), pave);
  b.add(up(-TOWER.hw0 - 2, TOWER.hw0 + 2, TOWER.base - 2, PAVE_N, CURB, 13, 1), pave);
  const kerb = lam("kerb", () => ({ map: kerbHD() }));
  b.add(quad(V(-420, 0, ROAD.n), V(420, 0, ROAD.n), V(420, CURB, ROAD.n), V(-420, CURB, ROAD.n), 210, 1), kerb);
  b.add(quad(V(420, 0, ROAD.s), V(-420, 0, ROAD.s), V(-420, CURB, ROAD.s), V(420, CURB, ROAD.s), 210, 1), kerb);
  // far ground under the whole City (streets between blocks)
  b.add(up(-900, 900, -900, PAVE_N - 40, 0.0, 200, 200), pave);
  b.add(up(-900, 900, PAVE_S + 40, 900, 0.0, 200, 200), pave);
  b.add(up(-900, -TOWER.hw0 - 2, PAVE_N - 40, PAVE_N, 0.0, 200, 10), pave);
  b.add(up(TOWER.hw0 + 2, 900, PAVE_N - 40, PAVE_N, 0.0, 200, 10), pave);
  b.add(up(-900, 900, PAVE_S, PAVE_S + 40, 0.0, 200, 10), pave);
  b.add(up(-TOWER.hw0 - 2, TOWER.hw0 + 2, PAVE_N - 40, TOWER.base - 2, 0.0, 10, 10), pave);
  // tower
  const glass = twoTone(new THREE.MeshPhongMaterial({ map: towerGlassHD(), specular: "#ffffff", shininess: 70 }), 0.6);
  const front = new THREE.Mesh(towerGeo(), glass);
  front.castShadow = true; front.receiveShadow = true; front.name = "towerFront";
  const sideM = lam("towerSide", () => ({ map: towerSideHD() })), roofM = lam("towerRoof", () => ({ color: "#9a9ca6" }));
  towerSides(b, sideM, roofM);
  crane(b);
  // north side of the street: Victorian terraces either side of the tower, offices behind
  const r = rng(7);
  const pickWall = () => WALLS[Math.floor(r() * WALLS.length)];
  const NSHOPS: Shop[] = ["cafe", "bank", "news", "office", "flowers"];
  let x = TOWER.hw0 + 4;
  while (x < 300) { const w = 12 + Math.floor(r() * 3) * 6, h = 16 + Math.floor(r() * 4) * 3.3; blockMesh(b, { x0: x, x1: x + w, z0: PAVE_N - 16, z1: PAVE_N, h, front: "n", kind: "terrace", shops: NSHOPS, wall: pickWall() }, `n${x}`); x += w + (r() < 0.2 ? 6 : 0); }
  x = -TOWER.hw0 - 4;
  while (x > -300) { const w = 12 + Math.floor(r() * 3) * 6, h = 16 + Math.floor(r() * 4) * 3.3; blockMesh(b, { x0: x - w, x1: x, z0: PAVE_N - 16, z1: PAVE_N, h, front: "n", kind: "terrace", shops: NSHOPS, wall: pickWall() }, `nw${x}`); x -= w + (r() < 0.2 ? 6 : 0); }
  // south side: the salon terrace (shops: office door, news, cafe, salon ...)
  const SSHOPS: Shop[] = ["office", "news", "cafe", "flowers", "salon", "bank"];
  // the block holding the salon: x -19.5..22.5 = 7 shops of 6 m, salon at index 5 (x 10.5..16.5)
  blockMesh(b, { x0: -19.5, x1: 22.5, z0: PAVE_S, z1: PAVE_S + 16, h: 19.5, front: "s", kind: "terrace", shops: ["bank", "flowers", "cafe", "news", "office", "salon", "cafe"].reverse() as Shop[], wall: "#e8c27c", keep: true }, "salonBlock");
  x = 22.5;
  while (x < 300) { const w = 12 + Math.floor(r() * 3) * 6, h = 15 + Math.floor(r() * 4) * 3.3; blockMesh(b, { x0: x, x1: x + w, z0: PAVE_S, z1: PAVE_S + 16, h, front: "s", kind: "terrace", shops: SSHOPS, wall: pickWall() }, `s${x}`); x += w; }
  x = -19.5;
  while (x > -300) { const w = 12 + Math.floor(r() * 3) * 6, h = 15 + Math.floor(r() * 4) * 3.3; blockMesh(b, { x0: x - w, x1: x, z0: PAVE_S, z1: PAVE_S + 16, h, front: "s", kind: "terrace", shops: SSHOPS, wall: pickWall() }, `sw${x}`); x -= w; }
  salonRoom(b);
  // the City behind: office blocks on a loose grid, a few taller towers further out
  for (let gx = -280; gx <= 280; gx += 36) for (let gz = -280; gz <= 300; gz += 34) {
    if (gz > PAVE_N - 40 && gz < PAVE_S + 30) continue;
    if (Math.abs(gx) < 40 && gz > -100 && gz < -20) continue; // around the tower
    const d = Math.hypot(gx, gz), h = 20 + r() * 26 + (d > 140 && r() < 0.18 ? 60 + r() * 80 : 0);
    const w = 22 + r() * 8, dd = 20 + r() * 8;
    blockMesh(b, { x0: gx - w / 2, x1: gx + w / 2, z0: gz - dd / 2, z1: gz + dd / 2, h, front: gz < 0 ? "n" : "s", kind: "office", wall: ["#e3c08a", "#a9bcd6", "#e6b48a", "#c7d0dc", "#d9a77a"][Math.floor(r() * 5)] }, `o${gx}_${gz}`);
  }
  cathedral(b, -250, -120);
  // street furniture
  for (let lx = -60; lx <= 60; lx += 15) { lamp(b, lx + 4, PAVE_N + 0.6); lamp(b, lx, PAVE_S - 0.6); }
  phoneBox(b, -17.5, 8.6, 0);
  postBox(b, -9.0, 8.9);
  for (const [tx, tz] of [[-30, PAVE_S - 1.4], [34, PAVE_S - 1.4], [-40, PAVE_N + 1.2], [44, PAVE_N + 1.2]]) {
    b.add(boxGeo(V(tx - 0.7, 0, tz - 0.7), V(tx + 0.7, CURB + 0.05, tz + 0.7)), lam("treePit", () => ({ color: "#6b5a48" })));
    veg(b, "round", tx, CURB, tz, 7.5, tx * 13 + tz);
  }
  return front;
};

// ---------------- garden ----------------
const garden = (b: Batch, kit: Kit) => {
  const [gx, , gz] = GARDEN, Gv = (x: number, y: number, z: number) => V(gx + x, y, gz + z);
  b.add(up(gx - 200, gx + 200, gz - 200, gz + 200, 0, 50, 50), lam("lawn", () => ({ map: rep(grassHD(), 1, 1), color: "#cfd8bf" })));
  // shed with a flat window facing +z
  const sh = lam("shed", () => ({ map: shedHD() })), x0 = gx - 7.2, x1 = gx - 3.8, z0 = gz - 3.6, z1 = gz - 0.9, h = 2.5;
  b.add(boxGeo(V(x0, 0, z0), V(x1, h, z1), 1.5), sh);
  const rf = lam("shedRoof", () => ({ map: roofHD("#7d6a5c", true), side: THREE.DoubleSide }));
  b.add(quad(V(x0 - 0.3, h, z1 + 0.3), V(x1 + 0.3, h, z1 + 0.3), V(x1 + 0.3, h + 0.9, (z0 + z1) / 2), V(x0 - 0.3, h + 0.9, (z0 + z1) / 2)), rf);
  b.add(quad(V(x1 + 0.3, h, z0 - 0.3), V(x0 - 0.3, h, z0 - 0.3), V(x0 - 0.3, h + 0.9, (z0 + z1) / 2), V(x1 + 0.3, h + 0.9, (z0 + z1) / 2)), rf);
  const wallTri = lam("shed", () => ({ map: shedHD() }));
  for (const xx of [x0, x1]) {
    const g = new THREE.BufferGeometry(), s = xx === x0 ? -1 : 1;
    const p = [V(xx, h, z0), V(xx, h, z1), V(xx, h + 0.9, (z0 + z1) / 2)];
    const o = s < 0 ? [p[0], p[1], p[2]] : [p[1], p[0], p[2]];
    g.setAttribute("position", new THREE.Float32BufferAttribute(o.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([s, 0, 0, s, 0, 0, s, 0, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.4], 2));
    b.add(g, wallTri);
  }
  // window: white frame + light glass pane (flat), centre (gx - 5.5, 1.55, z1)
  const frame = lam("winFrame", () => ({ color: "#f4f1ea" }));
  b.add(boxGeo(V(gx - 6.35, 0.95, z1), V(gx - 4.65, 2.15, z1 + 0.06)), frame);
  b.add(quad(V(gx - 6.2, 1.08, z1 + 0.07), V(gx - 4.8, 1.08, z1 + 0.07), V(gx - 4.8, 2.02, z1 + 0.07), V(gx - 6.2, 2.02, z1 + 0.07)),
    lam("winGlass", () => ({ map: ctex("paneHD", 256, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, "#d6ecfb"); gr.addColorStop(1, "#86aed6");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = "rgba(255,255,255,0.5)"; g.save(); g.translate(60, 0); g.rotate(0.6); g.fillRect(0, -40, 26, 400); g.restore();
    }) })));
  b.add(boxGeo(V(gx - 5.53, 1.08, z1 + 0.06), V(gx - 5.47, 2.02, z1 + 0.1)), frame);
  // fence + trees + bushes + a garden table where the leaf lies
  const fence = lam("fence", () => ({ map: shedHD() }));
  b.add(boxGeo(V(gx - 30, 0, gz - 9), V(gx + 30, 1.8, gz - 8.8), 1), fence);
  const r = rng(31);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 14 + r() * 60;
    veg(b, r() < 0.6 ? "round" : "fat", gx + Math.cos(a) * d, 0, gz + Math.sin(a) * d - 10, 6 + r() * 4, i * 7 + 3);
  }
  for (const [x, z] of [[-2.5, -7.5], [2.5, -7.8], [5, -6], [-8.5, -6.5], [6.5, 3.5]]) veg(b, "bush", gx + x, 0, gz + z, 1.2, x * 9 + z);
  // flower bed
  for (let i = 0; i < 18; i++) { const fx = gx - 3 + r() * 9, fz = gz - 6.5 + r() * 1.4; prop(b, kit, ["flower_redA", "flower_yellowA", "flower_purpleA"][i % 3], fx, 0, fz, 0.5); }
  // a house wall at the back
  b.add(quad(V(gx - 40, 0, gz - 45), V(gx + 20, 0, gz - 45), V(gx + 20, 7, gz - 45), V(gx - 40, 7, gz - 45)), lam("gardenTerrace", () => ({ map: terraceHD("gardenT", 60, 7, "#d9a066") })));
  void Gv;
};

// ---------------- Las Vegas ----------------
export const HOTEL = { cz: 40, R: 70, th: 0.82, h: 120, depth: 18 }; // crescent: centre of curvature in front (over the deck)
const hotel = (b: Batch) => {
  const [vx, , vz] = VEGAS, n = 36, H = HOTEL.h;
  const glass = lam("hotelGlass", () => ({ map: hotelHD() })), backM = lam("hotelBack", () => ({ color: "#d8c3a0" }));
  const P = (th: number, R: number, y: number) => V(vx + R * Math.sin(th), y, vz + HOTEL.cz - R * Math.cos(th));
  for (let i = 0; i < n; i++) {
    const a = -HOTEL.th + (2 * HOTEL.th * i) / n, c = -HOTEL.th + (2 * HOTEL.th * (i + 1)) / n;
    b.add(quad(P(a, HOTEL.R, 0), P(c, HOTEL.R, 0), P(c, HOTEL.R, H), P(a, HOTEL.R, H), (i + 1) / n, 1, i / n, 0), glass);
    const R2 = HOTEL.R + HOTEL.depth;
    b.add(quad(P(c, R2, 0), P(a, R2, 0), P(a, R2, H), P(c, R2, H)), backM);
    const g = new THREE.BufferGeometry(), top = [P(a, HOTEL.R, H), P(c, HOTEL.R, H), P(c, R2, H), P(a, R2, H)];
    g.setAttribute("position", new THREE.Float32BufferAttribute([top[0], top[2], top[1], top[0], top[3], top[2]].flatMap((v) => [v.x, v.y, v.z]), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(Array(12).fill(0), 2));
    b.add(g, backM);
  }
  for (const s of [-1, 1]) {
    const a = s * HOTEL.th, R2 = HOTEL.R + HOTEL.depth;
    b.add(s < 0 ? quad(P(a, R2, 0), P(a, HOTEL.R, 0), P(a, HOTEL.R, H), P(a, R2, H)) : quad(P(a, HOTEL.R, 0), P(a, R2, 0), P(a, R2, H), P(a, HOTEL.R, H)), backM);
  }
};
const palm = (b: Batch, x: number, z: number, h: number, seed: number) => {
  if (inTheWay(x - 2, x + 2, 0, h + 2, z - 2, z + 2, true)) return;
  const r = rng(seed), lean = (r() - 0.5) * 0.25, trunk = lam("palmTrunk", () => ({ color: "#9a7550" })), leaf = lam("palmLeaf", () => ({ color: "#4f9a46" }));
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const y0 = (i / segs) * h, y1 = ((i + 1) / segs) * h, rr = 0.32 - 0.12 * (i / segs);
    b.add(new THREE.CylinderGeometry(rr * 0.9, rr, y1 - y0, 8), trunk, new THREE.Matrix4().makeTranslation(x + lean * y0, (y0 + y1) / 2, z));
  }
  const tx = x + lean * h;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + r(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -0.5 - r() * 0.3, "YXZ"));
    b.add(new THREE.SphereGeometry(1, 10, 6), leaf, new THREE.Matrix4().compose(V(tx + Math.cos(a) * 1.6, h - 0.3, z + Math.sin(a) * 1.6), q, V(2.0, 0.12, 0.45)));
  }
};
const vegas = (b: Batch) => {
  const [vx, , vz] = VEGAS;
  b.add(up(vx - 600, vx + 600, vz - 600, vz + 600, 0, 60, 60), lam("sand", () => ({ map: rep(sandHD(), 1, 1), color: "#f2e2cc" })));
  hotel(b);
  // pool deck + pool
  b.add(up(vx - 22, vx + 22, vz + 26, vz + 66, 0.02, 11, 10), lam("deck", () => ({ map: rep(deckHD(), 1, 1) })));
  b.add(up(vx - 9, vx + 9, vz + 32, vz + 48, 0.03, 1.5, 1.4), new THREE.MeshBasicMaterial({ map: poolHD(), color: "#c8f0ff" }));
  const edge = lam("poolEdge", () => ({ color: "#f4ecd8" }));
  for (const [a, c] of [[V(vx - 9.3, 0, vz + 31.7), V(vx + 9.3, 0.12, vz + 32)], [V(vx - 9.3, 0, vz + 48), V(vx + 9.3, 0.12, vz + 48.3)],
    [V(vx - 9.3, 0, vz + 32), V(vx - 9, 0.12, vz + 48)], [V(vx + 9, 0, vz + 32), V(vx + 9.3, 0.12, vz + 48)]] as const) b.add(boxGeo(a, c), edge);
  // loungers + umbrellas along the near side of the pool
  const white = lam("lounger", () => ({ color: "#f4f1ea" })), stripe = lam("umbrella", () => ({ color: "#d65a4a" })), pole = lam("umPole", () => ({ color: "#6e4b33" }));
  for (let i = 0; i < 6; i++) {
    const lx = vx - 8 + i * 3.2, lz = vz + 51.5;
    b.add(boxGeo(V(lx - 0.35, 0.3, lz - 1), V(lx + 0.35, 0.42, lz + 1)), white);
    b.add(boxGeo(V(lx - 0.35, 0.42, lz - 1), V(lx + 0.35, 0.95, lz - 0.85)), white);
    if (i % 2 === 0) {
      b.add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), pole, new THREE.Matrix4().makeTranslation(lx + 1.6, 1.2, lz - 1.2));
      b.add(new THREE.ConeGeometry(1.4, 0.6, 12, 1, true), stripe, new THREE.Matrix4().makeTranslation(lx + 1.6, 2.5, lz - 1.2));
    }
  }
  for (const [x, z, h] of [[-15, 30, 9], [15, 31, 10], [-17, 50, 8.5], [17, 55, 9.5], [-13, 62, 10], [13, 64, 8], [-30, 20, 11], [32, 22, 10]] as const) palm(b, vx + x, vz + z, h, x * 7 + z);
  // mountains + low casino blocks on the horizon
  const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = [lam("mtnA", () => ({ color: "#b07a62" })), lam("mtnB", () => ({ color: "#9c6c66" }))];
  ([[-420, -380, 260, 90, 120], [180, -460, 300, 110, 140], [520, -260, 220, 80, 110], [-600, -150, 240, 70, 130]] as const).forEach(([x, z, sx, sy, sz], i) =>
    b.add(hill, hm[i % 2], new THREE.Matrix4().compose(V(vx + x, -2, vz + z), new THREE.Quaternion(), V(sx, sy, sz))));
  const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const x = vx + (r() - 0.5) * 500, z = vz - 120 - r() * 200, w = 20 + r() * 30, hh = 15 + r() * 60;
    b.add(boxGeo(V(x - w / 2, 0, z - w / 2), V(x + w / 2, hh, z + w / 2), 4), lam("casino" + (i % 3), () => ({ map: officeHD("c" + (i % 3), 24, 48, { stone: ["#e8d2b0", "#d9b8a0", "#e0c8b8"][i % 3], glass: "#c9a46a", mull: 2 }) })));
  }
};

export const buildWorld = (root: THREE.Object3D, kit: Kit, rays: Ray[]) => {
  setSight(rays);
  const b = new Batch();
  const towerFront = london(b);
  garden(b, kit);
  vegas(b);
  b.build(root);
  root.add(towerFront);
  setSight([]);
  return { towerFront };
};
export type { V3 };
