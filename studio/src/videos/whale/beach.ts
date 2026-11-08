// Static scenery of "Twenty Sticks": an Oregon beach in 1970. Sand with a wet band and foam line, the sea (its own
// animated mesh in world.ts), dunes with grass, driftwood logs, sea stacks offshore, the rope line, the highway
// department truck, the TV news camera, the plunger box and the crates of dynamite. Plus the sperm whale (lofted,
// with a vertex-coloured blast crater that world.ts switches on).
import * as THREE from "three";
import { Batch, boxGeo, quad, lam, V, Ray, setSight, inTheWay, addVeg, Kit } from "./build";
import { ctex, rep, rng } from "./paint";
import { twoTone } from "./shade";
import { SHORE, ROPE_Z, PLUNGER, TVCAM, CRATES, WHALE, V3 } from "./story";

const up = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v);
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blotch = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};

// ---------------- textures ----------------
export const beachSand = () => ctex("beachSand", 1024, 1024, (g, r) => {
  g.fillStyle = "#e9cf9c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 140; i++) blotch(g, U(r, 0, 1024), U(r, 0, 1024), U(r, 30, 110), r() > 0.5 ? "255,240,205" : "190,150,100", 0.14);
  for (let i = 0; i < 22000; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,248,225,0.5)" : "rgba(150,115,80,0.45)"; g.fillRect(U(r, 0, 1024), U(r, 0, 1024), 2, 2); }
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,245,215,0.55)" : "rgba(160,120,80,0.35)"; g.beginPath(); g.ellipse(U(r, 0, 1024), U(r, 0, 1024), U(r, 2, 6), U(r, 1.5, 4), r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = r() > 0.5 ? "#f4ecdc" : "#c9b39a"; g.beginPath(); g.ellipse(U(r, 0, 1024), U(r, 0, 1024), U(r, 3, 7), U(r, 2, 4), r() * 3, 0, 7); g.fill(); } // shells / pebbles
});
export const wetSand = () => ctex("wetSand", 512, 512, (g, r) => {
  g.fillStyle = "#b99a72"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) blotch(g, U(r, 0, 512), U(r, 0, 512), U(r, 20, 60), "230,215,190", 0.18);
});
export const seaTex = () => ctex("seaHD", 1024, 1024, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, "#2f8fb3"); gr.addColorStop(1, "#1f6f9a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 160; i++) { g.strokeStyle = r() > 0.4 ? "rgba(220,245,255,0.55)" : "rgba(10,60,100,0.35)"; g.lineWidth = U(r, 3, 7); const x = U(r, 0, 1024), y = U(r, 0, 1024), w = U(r, 30, 90); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 10, x + w, y); g.stroke(); }
});
export const foamTex = () => ctex("foamHD", 1024, 128, (g, r) => {
  g.clearRect(0, 0, 1024, 128);
  for (let x = 0; x < 1024; x += 6) { const h = 40 + 30 * Math.sin(x / 40) + U(r, -10, 10); g.fillStyle = "rgba(255,255,255,0.92)"; g.beginPath(); g.ellipse(x, 64, 9, h / 2, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(U(r, 0, 1024), U(r, 10, 118), U(r, 2, 6), 0, 7); g.fill(); }
});
const crateTex = () => ctex("crateHD2", 256, 256, (g) => {
  g.fillStyle = "#c9955a"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 51) { g.fillStyle = "rgba(90,55,25,0.55)"; g.fillRect(0, y, 256, 4); }
  for (let k = 0; k < 4; k++) { g.fillStyle = "#c8323a"; g.fillRect(52 + k * 40, 90, 32, 120); g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(56 + k * 40, 94, 8, 112); g.strokeStyle = "#3a1a14"; g.lineWidth = 4; g.strokeRect(52 + k * 40, 90, 32, 120); }
  g.fillStyle = "#2b2a30"; g.fillRect(44, 140, 176, 14);
  g.strokeStyle = "#2b2a30"; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 90); g.bezierCurveTo(128, 60, 170, 70, 160, 34); g.stroke();
  g.fillStyle = "#f2c230"; g.beginPath(); g.arc(160, 30, 9, 0, 7); g.fill();
  g.strokeStyle = "rgba(60,30,15,0.9)"; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248);
  return;
  g.fillStyle = "#b5402f"; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) { g.fillStyle = "rgba(60,15,10,0.35)"; g.fillRect(0, y, 256, 4); }
  g.fillStyle = "#f2c230"; g.save(); g.translate(128, 128); for (let k = -3; k <= 3; k++) { g.save(); g.rotate(-0.6); g.fillRect(k * 46 - 10, -200, 20, 400); g.restore(); } g.restore();
  g.fillStyle = "#b5402f"; g.fillRect(40, 70, 176, 116);
  g.fillStyle = "#f4ecd8"; g.beginPath(); g.arc(128, 128, 38, 0, 7); g.fill(); // a blast-star pictogram (no text)
  g.fillStyle = "#2b2a30"; for (let k = 0; k < 8; k++) { g.save(); g.translate(128, 128); g.rotate((k * Math.PI) / 4); g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -32); g.lineTo(7, 0); g.fill(); g.restore(); }
  g.strokeStyle = "rgba(40,20,15,0.8)"; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248);
});
const whaleSkin = () => ctex("whaleSkin", 1024, 512, (g, r) => {
  // u along the body, v around: back (v .25) dark slate, belly lighter; sperm-whale wrinkles as soft wavy lines
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#9a8f8a"); gr.addColorStop(0.3, "#5f5d68"); gr.addColorStop(0.5, "#4d4b57"); gr.addColorStop(0.7, "#5f5d68"); gr.addColorStop(1, "#9a8f8a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = r() > 0.5 ? "rgba(30,28,38,0.35)" : "rgba(200,195,200,0.18)"; g.lineWidth = U(r, 2, 4);
    const x = U(r, 0, 1024), y = U(r, 40, 470); g.beginPath(); g.moveTo(x, y);
    for (let k = 1; k < 6; k++) g.lineTo(x + k * 14, y + 6 * Math.sin(k * 1.7 + x));
    g.stroke();
  }
  for (let i = 0; i < 40; i++) blotch(g, U(r, 0, 1024), U(r, 0, 512), U(r, 10, 40), "220,215,220", 0.18); // scars
});

// ---------------- whale ----------------
const loftSec = (x: number) => {
  // sperm whale: big blunt box head (front 1/3), body tapering to the tail stock; lying low on the sand
  const t = (x - WHALE.x0) / (WHALE.x1 - WHALE.x0); // 0 tail .. 1 snout
  const nose = Math.min(1, (1 - t) / 0.03), tail = Math.min(1, t / 0.08);
  const head = t > 0.62;
  const h = (head ? 3.0 : 1.2 + 1.8 * Math.sin(Math.min(1, (t - 0.0) / 0.62) * Math.PI / 2)) * Math.sqrt(Math.max(0.05, Math.min(nose, tail)));
  const w = (head ? 1.65 : 0.35 + 1.4 * Math.sin(Math.min(1, t / 0.62) * Math.PI / 2)) * Math.sqrt(Math.max(0.05, Math.min(nose, tail)));
  return { h: Math.max(0.12, h), w: Math.max(0.12, w), n: head ? 6 : 3.2 };
};
export const whaleGeo = () => {
  const NX = 80, NR = 36, pos: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = [];
  for (let i = 0; i <= NX; i++) {
    const x = WHALE.x0 + ((WHALE.x1 - WHALE.x0) * i) / NX, s = loftSec(x);
    for (let k = 0; k <= NR; k++) {
      const a = (k / NR) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const z = Math.sign(c) * Math.abs(c) ** (2 / s.n) * s.w, yy = Math.sign(sn) * Math.abs(sn) ** (2 / s.n) * s.h * 0.5;
      pos.push(x, Math.max(0.02, yy + s.h * 0.42), z); uv.push(i / NX, k / NR); col.push(1, 1, 1);
    }
  }
  for (let i = 0; i < NX; i++) for (let k = 0; k < NR; k++) {
    const a = i * (NR + 1) + k, b = a + 1, c = a + NR + 2, d = a + NR + 1;
    idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** whale mesh + flukes + eye; returns the body mesh (world.ts carves the crater into it) */
export const whale = () => {
  const grp = new THREE.Group();
  const mat = twoTone(new THREE.MeshLambertMaterial({ map: whaleSkin(), vertexColors: true }));
  const body = new THREE.Mesh(whaleGeo(), mat); body.castShadow = true; body.receiveShadow = true;
  grp.add(body);
  const fl = twoTone(new THREE.MeshLambertMaterial({ color: "#56545f" }));
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), fl);
    f.scale.set(0.9, 0.12, 1.5); f.position.set(WHALE.x0 - 0.5, 0.25, s * 1.2); f.rotation.y = s * 0.5; f.castShadow = true; grp.add(f);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lam("whaleEye", () => ({ color: "#1d1b22" })));
  eye.position.set(WHALE.x1 - 4.3, 0.9, 1.62); grp.add(eye);
  return { grp, body };
};

// ---------------- props ----------------
const truck = (b: Batch, x: number, z: number, yaw: number) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const orange = lam("hwOrange", () => ({ color: "#e8892f" })), dark = lam("tyre", () => ({ color: "#26232b" })), glass = lam("vanGlass", () => ({ color: "#2d3850" }));
  b.add(boxGeo(V(-3.2, 0.5, -1.1), V(1.0, 2.2, 1.1), 0, true), orange, m);           // dump bed
  b.add(boxGeo(V(1.0, 0.5, -1.1), V(3.0, 2.6, 1.1), 0, true), orange, m);            // cab
  b.add(boxGeo(V(2.2, 1.6, -1.12), V(2.95, 2.4, 1.12)), glass, m);
  b.add(boxGeo(V(2.98, 1.6, -0.95), V(3.02, 2.4, 0.95)), glass, m);
  for (const [wx, wz] of [[-2.2, -1.05], [-2.2, 1.05], [2.0, -1.05], [2.0, 1.05]]) b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16).rotateX(Math.PI / 2), dark, m.clone().multiply(new THREE.Matrix4().makeTranslation(wx, 0.5, wz)));
  b.add(boxGeo(V(-3.25, 2.2, -1.15), V(1.0, 2.35, 1.15)), lam("hwStripe", () => ({ color: "#f4ecd8" })), m);
};
const tvCamera = (b: Batch) => {
  const [x, , z] = TVCAM, dk = lam("camBody", () => ({ color: "#3a3d47" })), leg = lam("tripod", () => ({ color: "#9aa0aa" }));
  for (const a of [0, 2.1, 4.2]) {
    const top = V(x, 1.35, z), foot = V(x + Math.cos(a) * 0.55, 0, z + Math.sin(a) * 0.55);
    const d = top.clone().sub(foot), L = d.length();
    b.add(new THREE.CylinderGeometry(0.025, 0.03, L, 6), leg, new THREE.Matrix4().compose(foot.clone().add(top).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
  }
  b.add(boxGeo(V(x - 0.35, 1.35, z - 0.2), V(x + 0.35, 1.75, z + 0.2)), dk);
  b.add(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 14).rotateX(Math.PI / 2), dk, new THREE.Matrix4().makeTranslation(x, 1.55, z - 0.4));
  b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), dk, new THREE.Matrix4().makeTranslation(x - 0.1, 1.9, z));
  b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), dk, new THREE.Matrix4().makeTranslation(x + 0.15, 1.9, z));
};
const plungerBox = (b: Batch) => {
  const [x, , z] = PLUNGER, wood = lam("plungerWood", () => ({ color: "#8a5a3a" }));
  b.add(boxGeo(V(x - 0.25, 0, z - 0.2), V(x + 0.25, 0.42, z + 0.2), 0, true), wood);
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), lam("cable", () => ({ color: "#2b2a30" })), new THREE.Matrix4().makeTranslation(x - 0.2, 0.42, z - 0.1));
  b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), lam("rod", () => ({ color: "#9aa0aa" })), new THREE.Matrix4().makeTranslation(x, 0.62, z));
  b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10).rotateZ(Math.PI / 2), lam("tbar", () => ({ color: "#2b2a30" })), new THREE.Matrix4().makeTranslation(x, 0.84, z));
};
const crates = (b: Batch) => {
  const m = lam("crate", () => ({ map: crateTex() })), [cx, , cz] = CRATES;
  for (let i = 0; i < 20; i++) {
    const lay = i < 8 ? 0 : i < 14 ? 1 : i < 18 ? 2 : 3, k = i < 8 ? i : i < 14 ? i - 8 : i < 18 ? i - 14 : i - 18, n = [8, 6, 4, 2][lay];
    const x = cx + (k - (n - 1) / 2) * 0.62, y = lay * 0.42, z = cz + (lay % 2) * 0.05;
    b.add(boxGeo(V(x - 0.3, y, z - 0.25), V(x + 0.3, y + 0.42, z + 0.25), 0, true), m);
  }
};
const rope = (b: Batch) => {
  const post = lam("ropePost", () => ({ color: "#8a6a4a" })), ropeM = lam("rope", () => ({ color: "#e8d7a8" }));
  for (let x = -16; x <= 16; x += 4) {
    if (inTheWay(x - 0.2, x + 0.2, 0, 1.1, ROPE_Z - 0.2, ROPE_Z + 0.2, true)) continue;
    b.add(boxGeo(V(x - 0.06, 0, ROPE_Z - 0.06), V(x + 0.06, 1.0, ROPE_Z + 0.06)), post);
    if (x < 16) b.add(boxGeo(V(x, 0.86, ROPE_Z - 0.015), V(x + 4, 0.89, ROPE_Z + 0.015)), ropeM);
  }
};
const log = (b: Batch, x: number, z: number, len: number, yaw: number, r = 0.3) => {
  if (inTheWay(x - len / 2, x + len / 2, 0, r * 2, z - len / 2, z + len / 2, true)) return;
  const m = new THREE.Matrix4().compose(V(x, r * 0.8, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2)), V(1, 1, 1));
  b.add(new THREE.CylinderGeometry(r * 0.85, r, len, 12), lam("driftwood", () => ({ color: "#b8a48c" })), m);
};

export const buildBeach = (root: THREE.Object3D, kit: Kit, rays: Ray[]) => {
  setSight(rays);
  const b = new Batch(), r = rng(1970);
  void kit;
  b.add(up(-600, 600, SHORE + 6, 600, 0, 120, 120), lam("sand", () => ({ map: rep(beachSand(), 1, 1) })));
  b.add(up(-600, 600, SHORE - 2, SHORE + 6, 0.01, 120, 2), lam("wetSand", () => ({ map: rep(wetSand(), 1, 1) })));
  // dunes behind the parking lot + grass
  const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const dm = [lam("duneA", () => ({ color: "#e2c48e" })), lam("duneB", () => ({ color: "#d9b97f" }))];
  for (let i = 0; i < 14; i++) {
    const x = -160 + i * 25 + r() * 10, z = 72 + r() * 30, sx = 18 + r() * 14, sy = 6 + r() * 7;
    b.add(hill, dm[i % 2], new THREE.Matrix4().compose(V(x, -0.5, z), new THREE.Quaternion(), V(sx, sy, 14 + r() * 8)));
  }
  for (let i = 0; i < 70; i++) { const x = -90 + r() * 180, z = 62 + r() * 16; if (!inTheWay(x - 1, x + 1, 0, 1.2, z - 1, z + 1, true)) addVeg(b, "bush", x, 0, z, 0.7 + r() * 0.6, i * 13); }
  // pine forest on the far dunes (Oregon coast)
  for (let i = 0; i < 60; i++) { const x = -260 + r() * 520, z = 105 + r() * 60; addVeg(b, "cone", x, 4, z, 12 + r() * 8, i * 7 + 1, 1); }
  // sea stacks offshore
  const rock = lam("seaStack", () => ({ color: "#5d5560" }));
  for (const [x, z, s] of [[-60, -110, 14], [-40, -140, 9], [70, -125, 18], [95, -160, 10]] as const)
    b.add(new THREE.CylinderGeometry(s * 0.45, s * 0.7, s * 1.6, 9), rock, new THREE.Matrix4().makeTranslation(x, s * 0.8 - 1, z));
  // driftwood
  for (let i = 0; i < 16; i++) { const x = -40 + r() * 80, z = 12 + r() * 40; if (Math.abs(x - 6) < 16 && z < 36) continue; log(b, x, z, 2.5 + r() * 4, r() * 3, 0.2 + r() * 0.25); }
  truck(b, 18.5, 33, Math.PI * 0.85);
  tvCamera(b); plungerBox(b); rope(b);
  const cb = new Batch(), crateGrp = new THREE.Group(); crates(cb); cb.build(crateGrp); root.add(crateGrp);
  // cable from the plunger to the whale
  const cab = lam("cable", () => ({ color: "#2b2a30" }));
  const p0 = V(PLUNGER[0] - 0.2, 0.03, PLUNGER[2] - 0.1), p1 = V(4.5, 0.03, 2.2), d = p1.clone().sub(p0);
  b.add(new THREE.CylinderGeometry(0.02, 0.02, d.length(), 6), cab, new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(1, 1, 1)));
  b.build(root);
  setSight([]);
  return { crateGrp };
};
export type { V3 };
export { foamTex as foam };
