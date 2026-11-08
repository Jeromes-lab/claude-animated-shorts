// Static scenery of "One Pig": San Juan Island, 1859. Meadow with a sandy shore, Cutlar's potato patch + split-rail
// fence + log cabin, the Hudson's Bay farmhouse, American Camp (tents, earthen redoubt, cannons), the party meadow
// (table, cake, bunting), the redcoat/bluecoat bench, the pig's grave, English Camp's blockhouse + flagpole, pine
// forest, distant islands, and the Kaiser's study (a little interior set far away). Warships and flags are built
// here but posed per frame by world.ts.
import * as THREE from "three";
import { Batch, boxGeo, quad, lam, V, Ray, setSight, inTheWay, addVeg, Kit } from "./build";
import { ctex, rep, rng, grassHD, planksHD } from "./paint";
import { twoTone } from "./shade";
import {
  PIG, SHORE, PATCH, CABIN, HBC, AMCAMP, REDOUBT_Z, SHIPS, PARTY, BLOCK, POLE, POLE_H, GRAVE, KROOM, FACEOFF, FLAGS, GOV, V3,
} from "./story";

const up = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), u, v);
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blotch = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};
const M = (x: number, y: number, z: number, yaw = 0, s: V3 = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), V(...s));
const between = (b: Batch, a: THREE.Vector3, c: THREE.Vector3, r: number, mat: THREE.Material, seg = 8) => {
  const d = c.clone().sub(a);
  b.add(new THREE.CylinderGeometry(r, r, d.length(), seg), mat, new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
};

// ---------------- textures ----------------
const sand = () => ctex("pwSand", 512, 512, (g, r) => {
  g.fillStyle = "#e3cf9e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) blotch(g, U(r, 0, 512), U(r, 0, 512), U(r, 20, 70), r() > 0.5 ? "250,238,205" : "180,150,105", 0.18);
  for (let i = 0; i < 6000; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,248,225,0.5)" : "rgba(150,115,80,0.4)"; g.fillRect(U(r, 0, 512), U(r, 0, 512), 2, 2); }
});
const soil = () => ctex("pwSoil", 512, 512, (g, r) => {
  g.fillStyle = "#7a5638"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80; i++) blotch(g, U(r, 0, 512), U(r, 0, 512), U(r, 15, 50), r() > 0.5 ? "150,110,75" : "80,52,32", 0.3);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "rgba(170,130,90,0.6)" : "rgba(60,40,25,0.5)"; g.beginPath(); g.ellipse(U(r, 0, 512), U(r, 0, 512), U(r, 2, 5), U(r, 1.5, 3.5), r() * 3, 0, 7); g.fill(); }
});
const logs = () => ctex("pwLogs", 512, 512, (g, r) => {
  for (let y = 0; y < 512; y += 64) {
    const gr = g.createLinearGradient(0, y, 0, y + 64); gr.addColorStop(0, "#a8784c"); gr.addColorStop(0.5, "#8f6240"); gr.addColorStop(1, "#5e3e28");
    g.fillStyle = gr; g.fillRect(0, y, 512, 64);
    g.fillStyle = "rgba(40,25,15,0.9)"; g.fillRect(0, y + 60, 512, 4);
    for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(60,38,22,0.4)"; g.lineWidth = 2; g.beginPath(); const x = U(r, 0, 512); g.moveTo(x, y + 20 + r() * 20); g.lineTo(x + U(r, 40, 120), y + 22 + r() * 20); g.stroke(); }
  }
});
const shingles = (key: string, col: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < 512; x += 48) {
    g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},${(0.04 + r() * 0.08).toFixed(3)})`; g.fillRect(x, y, 46, 30);
    g.fillStyle = "rgba(30,20,20,0.55)"; g.fillRect(x, y + 28, 48, 4); g.fillRect(x + 46, y, 2, 30);
  }
});
const clapboard = () => ctex("pwClap", 512, 512, (g) => {
  g.fillStyle = "#f1ece0"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) { g.fillStyle = "rgba(120,110,100,0.35)"; g.fillRect(0, y + 28, 512, 4); }
});
const canvasTex = () => ctex("pwCanvas", 256, 256, (g, r) => {
  g.fillStyle = "#f2ead6"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) blotch(g, U(r, 0, 256), U(r, 0, 256), U(r, 20, 50), "190,175,145", 0.18);
  for (let x = 0; x < 256; x += 64) { g.fillStyle = "rgba(150,135,110,0.4)"; g.fillRect(x, 0, 3, 256); }
});
const hullTex = () => ctex("pwHull", 1024, 256, (g) => {
  g.fillStyle = "#24232b"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#f1ece0"; g.fillRect(0, 70, 1024, 46);           // white gun strake
  for (let x = 40; x < 1000; x += 64) { g.fillStyle = "#16151b"; g.fillRect(x, 78, 30, 30); g.fillStyle = "#b8352f"; g.fillRect(x + 4, 82, 22, 22); g.fillStyle = "#16151b"; g.fillRect(x + 8, 86, 14, 14); }
  g.fillStyle = "#c9a24a"; g.fillRect(0, 20, 1024, 8);
  g.fillStyle = "#8a4a32"; g.fillRect(0, 226, 1024, 30);          // copper below the waterline
});
export const flagUS = () => ctex("pwFlagUS", 380, 200, (g) => {
  for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? "#f4f1ea" : "#c8323a"; g.fillRect(0, (k * 200) / 13, 380, 200 / 13 + 1); }
  g.fillStyle = "#2f3e7a"; g.fillRect(0, 0, 152, 108);
  g.fillStyle = "#f4f1ea";
  for (let row = 0; row < 6; row++) for (let c = 0; c < 6; c++) { const x = 13 + c * 25 + (row % 2) * 6, y = 10 + row * 17; g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? 2.2 : 5.5; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.fill(); }
});
export const flagUK = () => ctex("pwFlagUK", 400, 200, (g) => {
  g.fillStyle = "#24346e"; g.fillRect(0, 0, 400, 200);
  const diag = (w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); g.lineTo(400, 200); g.moveTo(400, 0); g.lineTo(0, 200); g.stroke(); };
  diag(40, "#f4f1ea"); diag(13, "#c8323a");
  g.fillStyle = "#f4f1ea"; g.fillRect(166, 0, 68, 200); g.fillRect(0, 66, 400, 68);
  g.fillStyle = "#c8323a"; g.fillRect(180, 0, 40, 200); g.fillRect(0, 80, 400, 40);
});
export const flagDE = () => ctex("pwFlagDE", 300, 200, (g) => {
  g.fillStyle = "#1d1b22"; g.fillRect(0, 0, 300, 67); g.fillStyle = "#f4f1ea"; g.fillRect(0, 67, 300, 67); g.fillStyle = "#c8323a"; g.fillRect(0, 134, 300, 66);
});
const wallpaper = () => ctex("pwPaper", 256, 256, (g) => {
  g.fillStyle = "#7a2c32"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(232,196,90,0.55)";
  for (let y = 0; y < 256; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < 256; x += 64) { g.beginPath(); g.ellipse(x + 16, y + 16, 7, 12, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 16, y + 16, 12, 4, 0, 0, 7); g.fill(); }
  g.fillStyle = "rgba(40,10,15,0.5)"; g.fillRect(0, 250, 256, 6);
});
const mapTex = () => ctex("pwMap", 512, 384, (g, r) => {
  g.fillStyle = "#e9dcb5"; g.fillRect(0, 0, 512, 384);
  g.fillStyle = "#9cc6d8"; g.fillRect(14, 14, 484, 356);
  g.fillStyle = "#cfe0a0"; g.strokeStyle = "#5a4a30"; g.lineWidth = 4; g.beginPath();
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = 120 + 34 * Math.sin(k * 2.3) + U(r, -10, 10); g.lineTo(256 + rr * Math.cos(a) * 1.2, 190 + rr * Math.sin(a) * 0.8); }
  g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = "#c8323a"; g.lineWidth = 6; g.setLineDash([16, 10]); g.beginPath(); g.moveTo(60, 40); g.bezierCurveTo(120, 200, 80, 300, 110, 360); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#f4a7b0"; g.beginPath(); g.arc(270, 200, 12, 0, 7); g.fill(); g.strokeStyle = "#241726"; g.lineWidth = 3; g.stroke(); // a tiny pig marker
});
const graveTex = () => ctex("pwGrave", 256, 320, (g) => {
  g.fillStyle = "#b9b6b0"; g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.12)" : "rgba(60,60,70,0.12)"; g.fillRect(Math.random() * 256, Math.random() * 320, 3, 3); }
  // the pig carved in relief: a small pig drawing (no text)
  // a carved pig face (no text)
  g.fillStyle = "#a19d97"; g.strokeStyle = "rgba(60,58,66,0.9)"; g.lineWidth = 6;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 30, 120); g.lineTo(128 + s * 62, 70); g.lineTo(128 + s * 66, 132); g.closePath(); g.fill(); g.stroke(); }
  g.beginPath(); g.ellipse(128, 160, 70, 62, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(128, 182, 30, 20, 0, 0, 7); g.fillStyle = "#b5b1aa"; g.fill(); g.stroke();
  g.fillStyle = "rgba(60,58,66,0.9)"; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 11, 182, 5, 0, 7); g.fill(); g.beginPath(); g.arc(128 + s * 28, 142, 6, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(60,58,66,0.9)"; g.lineWidth = 7; g.beginPath(); g.ellipse(128, 68, 46, 12, 0, 0, 7); g.stroke(); // halo
  g.strokeStyle = "rgba(60,58,66,0.8)"; g.lineWidth = 6; g.strokeRect(14, 14, 228, 292);
});

// ---------------- pieces ----------------
const tent = (b: Batch, x: number, z: number, yaw: number, s = 1) => {
  const m = M(x, 0, z, yaw, [s, s, s]), c = lam("tent", () => ({ map: canvasTex() }));
  const g = new THREE.BufferGeometry();
  const P = [[-1.3, 0, -1.6], [1.3, 0, -1.6], [0, 2.1, -1.6], [-1.3, 0, 1.6], [1.3, 0, 1.6], [0, 2.1, 1.6]];
  const tris = [[0, 2, 5], [0, 5, 3], [1, 4, 5], [1, 5, 2], [0, 1, 2], [3, 5, 4]];
  const pos: number[] = [], uv: number[] = [];
  for (const t of tris) for (const i of t) { pos.push(...P[i]); uv.push(P[i][2] / 3.2 + 0.5, P[i][1] / 2.1); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  b.add(g, c, m);
  b.add(boxGeo(V(-0.35, 0, 1.58), V(0.35, 1.2, 1.62)), lam("tentDoor", () => ({ color: "#6b5a44" })), m);
};
const cannon = (b: Batch, x: number, z: number, yaw: number) => {
  const m = M(x, 0, z, yaw), iron = lam("iron", () => ({ color: "#2d2c34" })), wood = lam("carriage", () => ({ color: "#6a4a30" }));
  b.add(boxGeo(V(-0.35, 0.25, -0.7), V(0.35, 0.6, 0.6)), wood, m);
  b.add(new THREE.CylinderGeometry(0.13, 0.2, 2.0, 14).rotateX(Math.PI / 2), iron, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.78, -0.4)));
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16).rotateZ(Math.PI / 2), wood, m.clone().multiply(new THREE.Matrix4().makeTranslation(s * 0.45, 0.42, 0)));
};
const rail = (b: Batch, x0: number, z0: number, x1: number, z1: number) => {
  const wood = lam("rail", () => ({ color: "#9a7a58" })), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.6));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
    if (inTheWay(x - 0.1, x + 0.1, 0, 1.2, z - 0.1, z + 0.1)) continue;
    b.add(boxGeo(V(x - 0.06, 0, z - 0.06), V(x + 0.06, 1.15, z + 0.06)), wood);
    if (i < n) {
      const xa = x0 + ((x1 - x0) * (i + 1)) / n, za = z0 + ((z1 - z0) * (i + 1)) / n;
      if (inTheWay(Math.min(x, xa), Math.max(x, xa), 0.3, 1.1, Math.min(z, za) - 0.1, Math.max(z, za) + 0.1)) continue;
      for (const y of [0.5, 0.95]) between(b, V(x, y, z), V(xa, y + 0.04, za), 0.045, wood, 6);
    }
  }
};
const flagpole = (b: Batch, x: number, z: number, h: number) => {
  b.add(new THREE.CylinderGeometry(0.06, 0.09, h, 10), lam("pole", () => ({ color: "#f1ece0" })), new THREE.Matrix4().makeTranslation(x, h / 2, z));
  b.add(new THREE.SphereGeometry(0.13, 12, 8), lam("poleBall", () => ({ color: "#d9b25a" })), new THREE.Matrix4().makeTranslation(x, h + 0.08, z));
};
/** a waving flag: plane in its own mesh (world.ts ripples it). Hoist edge at local x = 0. */
export const flagMesh = (tex: THREE.Texture, w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h, 14, 6); g.translate(w / 2, 0, 0);
  const m = new THREE.Mesh(g, twoTone(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
  m.castShadow = true; m.receiveShadow = true;
  (m.userData as { base: Float32Array }).base = (g.attributes.position.array as Float32Array).slice();
  return m;
};
export const ripple = (m: THREE.Mesh, t: number, amp = 1) => {
  const base = (m.userData as { base: Float32Array }).base, a = m.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = base[i], y = base[i + 1], k = Math.min(1, x / 0.6);
    arr[i + 2] = amp * k * (0.12 * Math.sin(x * 2.4 - t * 6) + 0.05 * Math.sin(x * 4.1 + y * 2 - t * 9));
    arr[i + 1] = y - amp * k * 0.04 * x;
  }
  a.needsUpdate = true; m.geometry.computeVertexNormals();
};

/** a warship (along x, bow +x): black hull with a white gun strake, deck, 3 masts with yards and set sails, funnel */
export const ship = (steam: boolean) => {
  const grp = new THREE.Group(), b = new Batch(), L = 34, B = 8.4, D = 4.2;
  const hullM = lam("hull", () => ({ map: hullTex() }));
  // lofted hull: sections along x
  const NX = 24, NA = 10, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NX; i++) {
    const t = i / NX, x = -L / 2 + L * t, bow = Math.max(0, (t - 0.72) / 0.28), stern = Math.max(0, (0.12 - t) / 0.12);
    const w = (B / 2) * Math.sqrt(Math.max(0.02, 1 - bow * bow)) * (1 - 0.25 * stern);
    for (let k = 0; k <= NA; k++) {
      const a = (k / NA) * Math.PI, y = D - (D + 1.2) * Math.sin(a) ** 0.7 * (1 - 0.15 * bow), z = -Math.cos(a) * w * (0.55 + 0.45 * Math.sin(a) ** 0.4);
      pos.push(x, y + 0.25 * bow * bow * 3, z); uv.push(t * 3, 1 - k / NA * 0.5);
    }
  }
  for (let i = 0; i < NX; i++) for (let k = 0; k < NA; k++) { const a = i * (NA + 1) + k, c = a + NA + 1; idx.push(a, c, c + 1, a, c + 1, a + 1); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
  const hull = new THREE.Mesh(hg, hullM); hull.material.side = THREE.DoubleSide; hull.castShadow = true; hull.receiveShadow = true; grp.add(hull);
  // deck + bulwark rail
  const deckM = lam("deck", () => ({ map: rep(planksHD(), 3, 1) }));
  b.add(up(-L / 2 + 1, L / 2 - 3, -B / 2 + 0.5, B / 2 - 0.5, D - 0.02, 1, 1), deckM);
  const railM = lam("shipRail", () => ({ color: "#3a2a22" }));
  for (const s of [-1, 1]) b.add(boxGeo(V(-L / 2 + 1, D, s * (B / 2 - 0.45) - 0.08), V(L / 2 - 4, D + 0.9, s * (B / 2 - 0.45) + 0.08)), railM);
  // masts, yards, sails
  const mastM = lam("mast", () => ({ color: "#8a6a48" })), sailM = lam("sail", () => ({ map: canvasTex(), side: THREE.DoubleSide }));
  const masts = [-10, 0, 9];
  masts.forEach((mx, i) => {
    const h = i === 1 ? 26 : 22;
    b.add(new THREE.CylinderGeometry(0.18, 0.3, h, 10), mastM, new THREE.Matrix4().makeTranslation(mx, D + h / 2, 0));
    for (const [y, w, sh] of [[D + h * 0.35, 13, 4.2], [D + h * 0.62, 10, 3.6], [D + h * 0.85, 7, 2.8]]) {
      b.add(new THREE.CylinderGeometry(0.1, 0.1, w, 8).rotateX(Math.PI / 2), mastM, new THREE.Matrix4().makeTranslation(mx, y, 0));
      // sail: a slightly bellied quad hanging under the yard
      const sg = new THREE.PlaneGeometry(w * 0.92, sh, 6, 3); const sp = sg.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < sp.count; k++) { const sx = sp.getX(k), sy = sp.getY(k); sp.setZ(k, 0.6 * (1 - (sx / (w * 0.46)) ** 2) * (0.5 - sy / sh)); }
      sg.computeVertexNormals(); sg.rotateY(Math.PI / 2);
      b.add(sg, sailM, new THREE.Matrix4().makeTranslation(mx + 0.35, y - sh / 2 - 0.15, 0));
    }
  });
  b.add(new THREE.CylinderGeometry(0.12, 0.2, 13, 8).rotateZ(-Math.PI / 2 + 0.35), mastM, new THREE.Matrix4().makeTranslation(L / 2 + 3.5, D + 2.6, 0)); // bowsprit
  if (steam) {
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 5.5, 16), lam("funnel", () => ({ color: "#26252c" })), new THREE.Matrix4().makeTranslation(-4.6, D + 2.6, 0));
    b.add(new THREE.CylinderGeometry(0.88, 0.88, 0.5, 16), lam("funnelBand", () => ({ color: "#c9a24a" })), new THREE.Matrix4().makeTranslation(-4.6, D + 4.6, 0));
  }
  // cabin / wheel at the stern
  b.add(boxGeo(V(-L / 2 + 1.6, D, -1.0), V(-L / 2 + 3.4, D + 1.4, 1.0)), lam("binnacle", () => ({ color: "#6a4a30" })));
  b.build(grp);
  // stern ensign (white ensign-ish: Union Jack canton on white with a red cross is too small to read; use the Union Jack)
  const ens = flagMesh(flagUK(), 3.6, 1.8); ens.position.set(-L / 2 - 0.2, D + 3.8, 0); ens.rotation.y = Math.PI; grp.add(ens);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8), mastM, new THREE.Matrix4().makeTranslation(-L / 2 - 0.2, D + 2.2, 0));
  b.build(grp);
  return { grp, ens };
};

// ---------------- the island ----------------
export type IslandOut = { flags: { m: THREE.Mesh; amp: number }[]; ships: { grp: THREE.Group; ens: THREE.Mesh }[]; ukPole: THREE.Mesh; graveGrp: THREE.Group };
export const buildIsland = (root: THREE.Object3D, kit: Kit, rays: Ray[]): IslandOut => {
  void kit;
  setSight(rays);
  const b = new Batch(), r = rng(1859);
  const flags: { m: THREE.Mesh; amp: number }[] = [];
  // ground: meadow + sandy shore band
  const G = lam("meadow", () => ({ map: rep(grassHD(), 1, 1) }));
  b.add(up(-700, 700, SHORE + 3, 700, 0, 175, 168), G);
  b.add(up(-700, 700, SHORE - 0.5, SHORE + 3.02, 0.005, 140, 0.7), lam("shoreSand", () => ({ map: rep(sand(), 1, 1) })));
  // the Kaiser's study sits on its own slab
  // potato patch: soil bed + ridged rows with leafy plants
  const soilM = lam("soil", () => ({ map: rep(soil(), 1, 1) })), leaf = [lam("potLeafA", () => ({ color: "#2f6a2c" })), lam("potLeafB", () => ({ color: "#3b7a32" }))];
  b.add(up(PATCH.x0, PATCH.x1, PATCH.z0, PATCH.z1, 0.02, 3, 2.4), soilM);
  for (let z = PATCH.z0 + 0.6; z < PATCH.z1; z += 1.1) {
    b.add(new THREE.CylinderGeometry(0.32, 0.32, PATCH.x1 - PATCH.x0 - 0.4, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.55, 1), soilM, new THREE.Matrix4().makeTranslation(0, 0.02, z));
    for (let x = PATCH.x0 + 0.5; x < PATCH.x1 - 0.3; x += 0.75) {
      if (Math.hypot(x - PIG[0], z - PIG[2]) < 1.2) continue; // the pig's corner is eaten bare
      if (inTheWay(x - 0.35, x + 0.35, 0, 0.6, z - 0.35, z + 0.35)) continue;
      const s = 0.13 + r() * 0.05;
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + x; b.add(new THREE.SphereGeometry(1, 9, 6), leaf[(((k + Math.round(x * 3)) % 2) + 2) % 2], M(x + Math.cos(a) * s * 0.9, 0.22 + s * 0.5 + (k === 3 ? s * 0.6 : 0), z + Math.sin(a) * s * 0.9, a, [s, s * 0.6, s * 1.3])); }
    }
  }
  // dug-up potatoes by the pig
  for (let k = 0; k < 7; k++) b.add(new THREE.SphereGeometry(1, 10, 7), lam("potato", () => ({ color: "#c9a06a" })), M(PIG[0] + Math.cos(k * 2.1) * 0.7, 0.06, PIG[2] + Math.sin(k * 2.1) * 0.5, k, [0.09, 0.06, 0.07]));
  // split-rail fence around the patch
  rail(b, PATCH.x0 - 1, PATCH.z0 - 1, PATCH.x1 + 1, PATCH.z0 - 1);
  rail(b, PATCH.x0 - 1, PATCH.z0 - 1, PATCH.x0 - 1, PATCH.z1 + 1.6);
  rail(b, PATCH.x1 + 1, PATCH.z0 - 1, PATCH.x1 + 1, PATCH.z1 + 1.6);
  // log cabin
  {
    const [cx, , cz] = CABIN, w = 5.5, d = 4.5, h = 2.6;
    b.add(boxGeo(V(cx - w / 2, 0, cz - d / 2), V(cx + w / 2, h, cz + d / 2), 2.6), lam("logs", () => ({ map: logs() })));
    const roofM = lam("cabinRoof", () => ({ map: shingles("pwShingle", "#6e5a4a"), side: THREE.DoubleSide }));
    for (const s of [-1, 1]) b.add(quad(V(cx - w / 2 - 0.4, h, cz + s * (d / 2 + 0.4)), V(cx + w / 2 + 0.4, h, cz + s * (d / 2 + 0.4)), V(cx + w / 2 + 0.4, h + 1.8, cz), V(cx - w / 2 - 0.4, h + 1.8, cz), 3, 2), roofM);
    for (const s of [-1, 1]) {
      const g = new THREE.BufferGeometry(), x = cx + s * w / 2;
      g.setAttribute("position", new THREE.Float32BufferAttribute(s > 0 ? [x, h, cz - d / 2, x, h + 1.8, cz, x, h, cz + d / 2] : [x, h, cz - d / 2, x, h, cz + d / 2, x, h + 1.8, cz], 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0], 2)); g.computeVertexNormals();
      b.add(g, lam("logs", () => ({ map: logs() })));
    }
    b.add(boxGeo(V(cx + w / 2 - 0.02, 0, cz - 0.5), V(cx + w / 2 + 0.04, 1.9, cz + 0.5)), lam("cabinDoor", () => ({ color: "#5a3a26" })));
    b.add(boxGeo(V(cx - 0.8, 1.0, cz + d / 2 - 0.02), V(cx + 0.4, 1.8, cz + d / 2 + 0.04)), lam("cabinWin", () => ({ color: "#3b4a6a" })));
    b.add(boxGeo(V(cx - w / 2 + 0.6, 0, cz - 0.6), V(cx - w / 2 + 1.5, h + 2.6, cz + 0.4)), lam("chimney", () => ({ color: "#8f877c" })));
    b.add(boxGeo(V(cx + w / 2 + 0.4, 0, cz + 1.4), V(cx + w / 2 + 1.2, 0.8, cz + 2.0)), lam("woodpile", () => ({ color: "#9a6a42" })));
  }
  // Hudson's Bay farmhouse
  {
    const [hx, , hz] = HBC, w = 7, d = 5, h = 3.6;
    b.add(boxGeo(V(hx - w / 2, 0, hz - d / 2), V(hx + w / 2, h, hz + d / 2), 3.5), lam("clap", () => ({ map: clapboard() })));
    const roofM = lam("hbcRoof", () => ({ map: shingles("pwShingleR", "#a8453a"), side: THREE.DoubleSide }));
    for (const s of [-1, 1]) b.add(quad(V(hx - w / 2 - 0.4, h, hz + s * (d / 2 + 0.4)), V(hx + w / 2 + 0.4, h, hz + s * (d / 2 + 0.4)), V(hx + w / 2 + 0.4, h + 2, hz), V(hx - w / 2 - 0.4, h + 2, hz), 3, 2), roofM);
    for (const k of [-2, 0, 2]) b.add(boxGeo(V(hx + k - 0.45, 1.3, hz + d / 2 - 0.02), V(hx + k + 0.45, 2.5, hz + d / 2 + 0.04)), lam("hbcWin", () => ({ color: "#3b4a6a" })));
    rail(b, hx - 8, hz + 6, hx + 6, hz + 6);
  }
  // flagpoles: US + UK shoulder to shoulder, the camp, the party meadow, English Camp
  const fp: [number, number, number, THREE.Texture, number][] = [
    [FLAGS[0][0], FLAGS[0][2], 7, flagUS(), 1], [FLAGS[1][0], FLAGS[1][2], 7, flagUK(), 1],
    [AMCAMP[0] + 3, AMCAMP[2] - 2, 9, flagUS(), 1], [PARTY[0] - 4, PARTY[2] - 2.5, 7, flagUS(), 1], [PARTY[0] + 4, PARTY[2] - 2.5, 7, flagUK(), 1],
    [GOV[0] - 6, GOV[2] + 9, 8, flagUK(), 1],
  ];
  for (const [x, z, h, tex, amp] of fp) {
    flagpole(b, x, z, h);
    const m = flagMesh(tex, 2.6, 1.4); m.position.set(x, h - 0.85, z); m.rotation.y = x > 0 && Math.abs(x - FLAGS[1][0]) < 0.1 ? 0.25 : 0.35; root.add(m); flags.push({ m, amp });
  }
  flagpole(b, POLE[0], POLE[2], POLE_H);
  const ukPole = flagMesh(flagUK(), 3.0, 1.6); ukPole.position.set(POLE[0], 1.6, POLE[2]); ukPole.rotation.y = 0.5; root.add(ukPole); flags.push({ m: ukPole, amp: 1 });
  // American Camp: tents in rows, the redoubt, cannons
  for (let i = 0; i < 14; i++) {
    const x = AMCAMP[0] - 10 + (i % 7) * 3.4, z = AMCAMP[2] + 6 + Math.floor(i / 7) * 4.5;
    if (!inTheWay(x - 1.4, x + 1.4, 0, 2.1, z - 1.7, z + 1.7)) tent(b, x, z, 0);
  }
  const berm = lam("berm", () => ({ color: "#8a8a4a" }));
  for (let k = 0; k < 9; k++) {
    const x = AMCAMP[0] - 16 + k * 4;
    b.add(new THREE.CylinderGeometry(1, 1, 4.2, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), berm, M(x, 0, REDOUBT_Z, 0, [1, 1.3, 1.6]));
  }
  for (let k = 0; k < 7; k++) cannon(b, AMCAMP[0] - 14 + k * 4.5, REDOUBT_Z + 2.6, 0);
  // the face-off bench + laundry line
  {
    const [fx, , fz] = FACEOFF, wood = lam("bench", () => ({ color: "#9a7452" }));
    b.add(boxGeo(V(fx - 1.6, 0.42, fz - 0.25), V(fx + 1.6, 0.5, fz + 0.25)), wood);
    for (const s of [-1.4, 1.4]) b.add(boxGeo(V(fx + s - 0.06, 0, fz - 0.2), V(fx + s + 0.06, 0.42, fz + 0.2)), wood);
    between(b, V(fx - 4, 2.0, fz - 3), V(fx + 4, 2.1, fz - 3), 0.012, lam("line", () => ({ color: "#e8e2d4" })), 4);
    for (const s of [-4, 4]) b.add(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8), wood, new THREE.Matrix4().makeTranslation(fx + s, 1.1, fz - 3));
    const cloth = [lam("shirtR", () => ({ color: "#c0353a", side: THREE.DoubleSide })), lam("shirtB", () => ({ color: "#2f3e66", side: THREE.DoubleSide })), lam("sock", () => ({ color: "#f1ece0", side: THREE.DoubleSide }))];
    for (let k = 0; k < 6; k++) b.add(new THREE.PlaneGeometry(k % 3 === 2 ? 0.3 : 0.8, k % 3 === 2 ? 0.5 : 0.7), cloth[k % 3], new THREE.Matrix4().makeTranslation(fx - 3 + k * 1.2, 1.7, fz - 3));
  }
  // party meadow: long table with a cloth, a cake, mugs; bunting between the flagpoles
  {
    const [px, , pz] = PARTY;
    b.add(boxGeo(V(px - 3.5, 0.72, pz - 0.6), V(px + 3.5, 0.8, pz + 0.6)), lam("cloth", () => ({ color: "#f4f1ea" })));
    for (const sx of [-3.2, 3.2]) for (const sz of [-0.5, 0.5]) b.add(boxGeo(V(px + sx - 0.05, 0, pz + sz - 0.05), V(px + sx + 0.05, 0.72, pz + sz + 0.05)), lam("tableLeg", () => ({ color: "#7a5638" })));
    const cake = [lam("cakeW", () => ({ color: "#fbf3e2" })), lam("cakeR", () => ({ color: "#d9434a" })), lam("cakeB", () => ({ color: "#3f5aa8" }))];
    b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24), cake[0], new THREE.Matrix4().makeTranslation(px, 0.95, pz));
    b.add(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 24), cake[1], new THREE.Matrix4().makeTranslation(px, 0.9, pz));
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 24), cake[0], new THREE.Matrix4().makeTranslation(px, 1.23, pz));
    b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 24), cake[2], new THREE.Matrix4().makeTranslation(px, 1.2, pz));
    for (let k = 0; k < 8; k++) b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), lam("mug", () => ({ color: "#c9b48a" })), new THREE.Matrix4().makeTranslation(px - 3 + k * 0.85 + (k > 3 ? 0.4 : 0), 0.89, pz + (k % 2 ? 0.3 : -0.3)));
    const bun = [lam("buntR", () => ({ color: "#d9434a", side: THREE.DoubleSide })), lam("buntW", () => ({ color: "#f4f1ea", side: THREE.DoubleSide })), lam("buntB", () => ({ color: "#3f5aa8", side: THREE.DoubleSide }))];
    const a0 = V(px - 4, 5.6, pz - 2.5), a1 = V(px + 4, 5.6, pz - 2.5);
    for (let k = 0; k < 20; k++) {
      const t = (k + 0.5) / 20, p = a0.clone().lerp(a1, t); p.y -= 1.2 * Math.sin(Math.PI * t);
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.42, 0], 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.computeVertexNormals();
      b.add(g, bun[k % 3], new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    }
    between(b, a0, V(px, 4.4, pz - 2.5), 0.012, lam("line", () => ({ color: "#e8e2d4" })), 4);
    between(b, V(px, 4.4, pz - 2.5), a1, 0.012, lam("line", () => ({ color: "#e8e2d4" })), 4);
  }
  // the pig's grave (own group: world.ts shows it only at the end)
  const gb = new Batch(), graveGrp = new THREE.Group();
  {
    const b = gb;
    const [gx, , gz] = GRAVE;
    b.add(boxGeo(V(gx - 0.4, 0, gz - 0.09), V(gx + 0.4, 0.9, gz + 0.09)), lam("graveSide", () => ({ color: "#a9a69f" })));
    b.add(quad(V(gx - 0.4, 0, gz + 0.1), V(gx + 0.4, 0, gz + 0.1), V(gx + 0.4, 0.9, gz + 0.1), V(gx - 0.4, 0.9, gz + 0.1)), lam("graveFace", () => ({ map: graveTex() })));
    b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2 * 0), lam("graveSide", () => ({ color: "#a9a69f" })), new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(gx, 0.9, gz)));
    b.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam("mound", () => ({ color: "#6a8a3a" })), M(gx, 0, gz + 0.9, 0, [0.55, 0.18, 0.8]));
    const fl = [lam("flY", () => ({ color: "#f4d24a" })), lam("flP", () => ({ color: "#f3a9bb" })), lam("flW", () => ({ color: "#f7f3e8" }))];
    for (let k = 0; k < 9; k++) b.add(new THREE.SphereGeometry(0.06, 8, 6), fl[k % 3], new THREE.Matrix4().makeTranslation(gx - 0.4 + (k % 5) * 0.2, 0.2 + (k % 2) * 0.03, gz + 0.5 + Math.floor(k / 5) * 0.35));
  }
  gb.build(graveGrp); root.add(graveGrp);
  // English Camp blockhouse (white, overhanging upper storey)
  {
    const [bx, , bz] = BLOCK, wM = lam("blockWall", () => ({ map: clapboard() })), rM = lam("blockRoof", () => ({ map: shingles("pwShingleG", "#5a5560"), side: THREE.DoubleSide }));
    b.add(boxGeo(V(bx - 2.5, 0, bz - 2.5), V(bx + 2.5, 3, bz + 2.5), 3), wM);
    b.add(boxGeo(V(bx - 3.2, 3, bz - 3.2), V(bx + 3.2, 5.6, bz + 3.2), 3), wM);
    for (const s of [-1, 1]) b.add(quad(V(bx - 3.6, 5.6, bz + s * 3.6), V(bx + 3.6, 5.6, bz + s * 3.6), V(bx, 7.6, bz), V(bx, 7.6, bz), 2, 2), rM);
    for (const s of [-1, 1]) b.add(quad(V(bx + s * 3.6, 5.6, bz - s * 3.6), V(bx + s * 3.6, 5.6, bz + s * 3.6), V(bx, 7.6, bz), V(bx, 7.6, bz), 2, 2), rM);
    for (const k of [-1.5, 0, 1.5]) b.add(boxGeo(V(bx + k - 0.2, 4.0, bz + 3.18), V(bx + k + 0.2, 4.4, bz + 3.24)), lam("loop", () => ({ color: "#2a2830" })));
  }
  // the governor's little wharf
  {
    const [gx, , gz] = GOV, wood = lam("wharf", () => ({ map: rep(planksHD(), 1, 2) }));
    b.add(boxGeo(V(gx - 1.5, 0.3, gz - 10), V(gx + 1.5, 0.45, gz + 4)), wood);
    for (let k = 0; k < 6; k++) for (const s of [-1.4, 1.4]) b.add(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), lam("pile", () => ({ color: "#6a4a30" })), new THREE.Matrix4().makeTranslation(gx + s, -0.6, gz - 9 + k * 2.5));
  }
  // the Kaiser's study: floor, three walls, a window, a desk with the map, the imperial flag
  {
    const [kx, , kz] = KROOM, wM = lam("paper", () => ({ map: rep(wallpaper(), 3, 1.5) }));
    b.add(up(kx - 6, kx + 6, kz - 4, kz + 8, 0.03, 4, 4), lam("parquet", () => ({ map: rep(planksHD(), 2, 2) })));
    b.add(boxGeo(V(kx - 6, 0, kz - 4.2), V(kx + 6, 5, kz - 4)), wM);
    for (const s of [-1, 1]) b.add(boxGeo(V(kx + s * 6 - 0.1, 0, kz - 4), V(kx + s * 6 + 0.1, 5, kz + 8)), wM);
    b.add(boxGeo(V(kx - 6, 0, kz - 3.98), V(kx + 6, 0.9, kz - 3.9)), lam("wainscot", () => ({ color: "#4a2a1e" })));
    b.add(boxGeo(V(kx + 1.6, 1.4, kz - 3.97), V(kx + 3.6, 4.0, kz - 3.9)), lam("kWin", () => ({ color: "#bcd4ef" })));
    for (const s of [1.3, 3.9]) b.add(boxGeo(V(kx + s - 0.35, 1.0, kz - 3.88), V(kx + s + 0.35, 4.4, kz - 3.8)), lam("curtain", () => ({ color: "#2f5a3a" })));
    b.add(boxGeo(V(kx - 3.6, 1.6, kz - 3.95), V(kx - 1.0, 3.4, kz - 3.88)), lam("flagDE", () => ({ map: flagDE() })));
    b.add(boxGeo(V(kx - 3.7, 1.5, kz - 3.97), V(kx - 0.9, 3.5, kz - 3.96)), lam("frame", () => ({ color: "#c9a24a" })));
    const desk = lam("desk", () => ({ color: "#4a2c1e" }));
    b.add(boxGeo(V(kx - 1.4, 0.72, kz + 0.2), V(kx + 1.4, 0.82, kz + 1.4)), desk);
    for (const sx of [-1.25, 1.25]) b.add(boxGeo(V(kx + sx - 0.15, 0, kz + 0.3), V(kx + sx + 0.15, 0.72, kz + 1.3)), desk);
    b.add(up(kx - 0.7, kx + 0.5, kz + 0.45, kz + 1.25, 0.83, 1, 1), lam("map", () => ({ map: mapTex() })));
    b.add(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12), lam("ink", () => ({ color: "#1d1b22" })), new THREE.Matrix4().makeTranslation(kx + 0.9, 0.88, kz + 0.7));
    b.add(boxGeo(V(kx - 0.5, 0, kz - 1.2), V(kx + 0.5, 1.6, kz - 0.8)), lam("chair", () => ({ color: "#7a2c32" })));
  }
  // pine forest around the meadows, hills + distant islands
  const pines: [number, number][] = [];
  for (let i = 0; i < 140; i++) { const a = r() * Math.PI * 2, d = 55 + r() * 70; pines.push([-10 + Math.cos(a) * d * 1.3, 40 + Math.sin(a) * d * 0.6]); }
  for (let i = 0; i < 40; i++) pines.push([-120 + r() * 60, -10 + r() * 40]);
  for (let i = 0; i < 30; i++) pines.push([90 + r() * 60, -10 + r() * 50]);
  for (const [x, z] of pines) { if (z < SHORE + 8) continue; if (!inTheWay(x - 2.5, x + 2.5, 0, 14, z - 2.5, z + 2.5)) addVeg(b, "cone", x, 0, z, 8 + r() * 7, Math.round(x * 13 + z), 1); }
  for (let i = 0; i < 40; i++) { const x = -60 + r() * 140, z = 25 + r() * 30; if (Math.abs(x - PARTY[0]) < 12 && Math.abs(z - PARTY[2]) < 10) continue; if (!inTheWay(x - 1, x + 1, 0, 1.4, z - 1, z + 1, true)) addVeg(b, "bush", x, 0, z, 0.9 + r() * 0.8, i * 17); }
  const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const hm = [lam("hillA", () => ({ color: "#4f8a46" })), lam("hillB", () => ({ color: "#5a9a50" })), lam("farIsle", () => ({ color: "#6f9a8a" }))];
  for (let i = 0; i < 8; i++) b.add(hill, hm[i % 2], M(-200 + i * 60 + r() * 20, -2, 150 + r() * 40, 0, [50 + r() * 30, 22 + r() * 14, 40]));
  for (const [x, z, sx, sy] of [[-220, -330, 120, 26], [-40, -380, 90, 18], [160, -320, 140, 30], [330, -260, 80, 20]] as const) b.add(hill, hm[2], M(x, -3, z, 0, [sx, sy, 40]));
  b.build(root);
  // ships (each its own group: world.ts slides them in)
  const ships = SHIPS.map((p, i) => { const s = ship(i % 2 === 1); s.grp.position.set(p[0], 0, p[2]); s.grp.rotation.y = i % 2 ? 0.15 : -0.1; root.add(s.grp); flags.push({ m: s.ens, amp: 0.8 }); return s; });
  setSight([]);
  return { flags, ships, ukPole, graveGrp };
};
export type { V3 };
