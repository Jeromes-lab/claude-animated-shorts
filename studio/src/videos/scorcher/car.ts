// Vehicles: a smooth saloon built as a lofted rounded-box tube (so its side is a real grid that can droop and ripple),
// a glasshouse tube painted with pillars, wheels, lamps, grille, a round badge (no brand mark) and a wing mirror.
// `melt` bends the north (local -z) side down in warm waves, sags the roof, droops the mirror like toffee and lets the
// badge slide. Plus a white van, a black cab and a red double-decker bus from simple boxes.
import * as THREE from "three";
import { lam, boxGeo, V } from "./build";
import { ctex } from "./paint";
import { twoTone } from "./shade";
import { lin, Melt } from "./story";

type Profile = { len: number; hw: number; top: [number, number][]; cab: [number, number][]; cabX: [number, number]; bottom: number };
export const SALOON: Profile = {
  len: 5.1, hw: 0.93, bottom: 0.3,
  top: [[-2.55, 0.58], [-2.45, 0.86], [-2.1, 0.92], [0.9, 0.92], [2.15, 0.8], [2.45, 0.74], [2.55, 0.56]],
  cab: [[-1.78, 0.93], [-1.0, 1.4], [0.15, 1.42], [0.88, 0.93]], cabX: [-1.78, 0.88],
};
export const CAB_TAXI: Profile = {
  len: 4.55, hw: 0.9, bottom: 0.32,
  top: [[-2.27, 0.66], [-2.15, 0.95], [-1.6, 0.98], [0.9, 0.98], [1.9, 0.9], [2.27, 0.66]],
  cab: [[-1.75, 0.99], [-1.45, 1.72], [0.45, 1.74], [0.95, 0.99]], cabX: [-1.75, 0.95],
};
const NX = 56, NR = 28;
/** rounded-box ring point: angle a (0 = +z side, pi/2 = top), half width w, centre yc, half height hh, exponent n */
const ring = (a: number, w: number, yc: number, hh: number, n = 5): [number, number] => {
  const c = Math.cos(a), s = Math.sin(a);
  return [Math.sign(c) * Math.abs(c) ** (2 / n) * w, yc + Math.sign(s) * Math.abs(s) ** (2 / n) * hh];
};
/** lofted tube along x: for each slice x -> (bottom, top, half width at bottom, at top) */
const loft = (xs: number[], sec: (x: number) => [number, number, number, number]) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  xs.forEach((x, i) => {
    const [yb, yt, wb, wt] = sec(x), yc = (yb + yt) / 2, hh = Math.max(0.005, (yt - yb) / 2);
    for (let k = 0; k <= NR; k++) {
      const a = (k / NR) * Math.PI * 2, [z, y] = ring(a, 1, yc, hh), t = (y - yb) / (2 * hh || 1);
      pos.push(x, y, z * (wb + (wt - wb) * t));
      uv.push(i / (xs.length - 1), k / NR);
    }
  });
  for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < NR; k++) {
    const a = i * (NR + 1) + k, b = a + 1, c = a + NR + 2, d = a + NR + 1;
    idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** x samples with rounded ends: the end slices shrink toward a point so the tube closes smoothly */
const xsamples = (x0: number, x1: number, n: number) => {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(x0 + ((x1 - x0) * i) / n);
  return out;
};
const endK = (x: number, x0: number, x1: number, r = 0.16) => {
  const d = Math.min(x - x0, x1 - x), u = Math.max(0, Math.min(1, d / r));
  return Math.sqrt(1 - (1 - u) ** 2);
};

const cabTex = (body: string) => ctex("cabGlass" + body, 1024, 512, (g) => {
  // u = along the car (0 rear .. 1 front), v = around the ring (0 = +z side bottom ... 0.25 top ... 0.5 -z side)
  const gl = g.createLinearGradient(0, 0, 0, 512); gl.addColorStop(0, "#20283a"); gl.addColorStop(0.5, "#3c4c6c"); gl.addColorStop(1, "#20283a");
  g.fillStyle = gl; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "rgba(200,225,255,0.28)"; for (const x of [260, 600]) { g.save(); g.translate(x, 0); g.rotate(0.5); g.fillRect(0, -100, 40, 900); g.restore(); }
  // roof band (top of the ring = v 0.25 -> canvas y 384 with flipY... painted as both halves to be safe)
  g.fillStyle = body;
  for (const y of [100, 348]) g.fillRect(250, y, 520, 64);
  // pillars: C (rear), B (middle), A (front) on both sides
  for (const [x, w] of [[180, 70], [500, 34], [770, 46]] as const) g.fillRect(x, 0, w, 512);
  g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(0, 0, 1024, 6);
});

export class Car {
  root = new THREE.Group();
  private body: THREE.Mesh; private cab: THREE.Mesh;
  private base: Float32Array; private cabBase: Float32Array;
  private mirror = new THREE.Group(); private mirrorHouse: THREE.Mesh;
  private badge = new THREE.Group();
  private drips: THREE.Mesh[] = [];
  constructor(public P: Profile, col: string, opts: { badge?: boolean; mirror?: boolean; drips?: boolean } = {}) {
    const paint = twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#9aa6b8", shininess: 55 }), 0.4);
    const L = P.len / 2, xs = xsamples(-L, L, NX);
    const topAt = (x: number) => lin(P.top, x);
    this.body = new THREE.Mesh(loft(xs, (x) => {
      const k = endK(x, -L, L), yt = topAt(x), yb = P.bottom + (1 - k) * 0.12, w = P.hw * (0.25 + 0.75 * k);
      return [yb, P.bottom + (yt - P.bottom) * (0.35 + 0.65 * k), w, w * 0.97];
    }), paint);
    const [c0, c1] = P.cabX, cxs = xsamples(c0, c1, 40);
    this.cab = new THREE.Mesh(loft(cxs, (x) => {
      const yt = lin(P.cab, x), k = endK(x, c0, c1, 0.08), yb = topAt(x) - 0.02;
      return [yb, yb + Math.max(0.02, (yt - yb) * (0.4 + 0.6 * k)), P.hw * 0.94, P.hw * 0.74];
    }), twoTone(new THREE.MeshPhongMaterial({ map: cabTex(col), specular: "#ffffff", shininess: 80 }), 0.3));
    this.base = (this.body.geometry.attributes.position.array as Float32Array).slice();
    this.cabBase = (this.cab.geometry.attributes.position.array as Float32Array).slice();
    for (const m of [this.body, this.cab]) { m.castShadow = true; m.receiveShadow = true; this.root.add(m); }
    // wheels
    const tyre = lam("tyre", () => ({ color: "#26232b" })), hub = lam("hub", () => ({ color: "#c9ced8" }));
    for (const wx of [-L + 0.95, L - 0.95]) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateX(Math.PI / 2), tyre);
      w.position.set(wx, 0.34, s * (P.hw - 0.1)); w.castShadow = true; this.root.add(w);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).rotateX(Math.PI / 2), hub);
      h.position.set(wx, 0.34, s * (P.hw + 0.03)); this.root.add(h);
    }
    // lamps, grille, plates
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.4) }), red = lam("tail", () => ({ color: "#b8302f" }));
    const yNose = topAt(L - 0.15) - 0.12;
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), lampM); hl.scale.set(0.5, 0.8, 1.4); hl.position.set(L - 0.06, yNose, s * 0.6); this.root.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), red); tl.position.set(-L + 0.04, topAt(-L + 0.15) - 0.12, s * 0.62); this.root.add(tl);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.62), lam("grille", () => ({ color: "#2d2b33" })));
    grille.position.set(L + 0.0, yNose - 0.05, 0); this.root.add(grille);
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.68), lam("chrome", () => ({ color: "#d7dce6" })));
    chrome.position.set(L - 0.01, yNose - 0.05, 0); this.root.add(chrome);
    const plate = (x: number, c: string) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.5), lam("plate" + c, () => ({ color: c }))); p.position.set(x, P.bottom + 0.1, 0); this.root.add(p); };
    plate(L + 0.02, "#f4f4f0"); plate(-L - 0.02, "#f2c230");
    if (opts.badge) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 20).rotateZ(Math.PI / 2), lam("badge", () => ({ color: "#e0e4ec" })));
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20).rotateY(Math.PI / 2), lam("badgeRing", () => ({ color: "#9aa0aa" })));
      this.badge.add(disc, ring2); this.badge.position.set(L + 0.04, yNose - 0.05, 0); this.root.add(this.badge);
    }
    if (opts.mirror) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.16), paint); stalk.position.set(0, 0, -0.08);
      this.mirrorHouse = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.24), paint);
      this.mirrorHouse.geometry.translate(0, -0.02, -0.12); this.mirrorHouse.position.set(0, 0, -0.14);
      const glassM = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.2), lam("mirrorGlass", () => ({ color: "#b9d4ea" })));
      glassM.position.set(-0.085, -0.02, -0.12); this.mirrorHouse.add(glassM);
      this.mirror.add(stalk, this.mirrorHouse);
      this.mirror.position.set(0.8, topAt(0.8) + 0.06, -P.hw + 0.06); this.root.add(this.mirror);
      this.mirror.traverse((o) => { o.castShadow = true; });
    } else this.mirrorHouse = new THREE.Mesh();
    if (opts.drips) {
      const dm = twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#c0c8d8", shininess: 70 }), 0.4);
      for (let i = 0; i < 9; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dm);
        d.userData.x = -1.9 + i * 0.47 + 0.12 * Math.sin(i * 3.1); d.userData.k = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7));
        d.castShadow = true; this.drips.push(d); this.root.add(d);
      }
    }
  }
  /** melt the north (-z) side, roof, mirror, badge; x = position of the car centre along the street */
  update(m: Melt) {
    const P = this.P, pa = this.body.geometry.attributes.position as THREE.BufferAttribute, arr = pa.array as Float32Array, B = this.base;
    for (let i = 0; i < arr.length; i += 3) {
      const x = B[i], y = B[i + 1], z = B[i + 2];
      const ws = Math.max(0, Math.min(1, -z / P.hw)) ** 2, hk = Math.max(0, Math.min(1, (y - P.bottom) / 0.65));
      const wave = 0.5 + 0.5 * Math.sin(6.5 * x + 1.3) * Math.sin(2.3 * x + 0.4);
      arr[i] = x;
      arr[i + 1] = y - m.side * ws * (0.05 + 0.13 * wave) * Math.sqrt(hk) * hk;
      arr[i + 2] = z - m.side * ws * hk * (0.05 + 0.05 * Math.sin(4.2 * x));
    }
    pa.needsUpdate = true; this.body.geometry.computeVertexNormals();
    const ca = this.cab.geometry.attributes.position as THREE.BufferAttribute, carr = ca.array as Float32Array, C = this.cabBase;
    for (let i = 0; i < carr.length; i += 3) {
      const x = C[i], y = C[i + 1], z = C[i + 2], top = Math.max(0, (y - 1.0) / 0.42), ws = Math.max(0, Math.min(1, -z / P.hw));
      carr[i] = x; carr[i + 1] = y - m.roof * top * (0.06 + 0.05 * Math.sin(5 * x)) - m.side * ws * 0.05 * top; carr[i + 2] = z;
    }
    ca.needsUpdate = true; this.cab.geometry.computeVertexNormals();
    // mirror: droops forward and down like toffee
    this.mirror.rotation.set(-1.15 * m.mirror, 0, -0.35 * m.mirror);
    this.mirrorHouse.scale.set(1 - 0.25 * m.mirror, 1 + 1.6 * m.mirror, 1 - 0.3 * m.mirror);
    // badge: slides down and stretches
    this.badge.scale.set(1, 1 + 0.9 * m.badge, 1 - 0.15 * m.badge);
    this.badge.rotation.set(0.25 * m.badge, 0, -0.5 * m.badge);
    this.badge.position.y = lin(this.P.top, this.P.len / 2 - 0.15) - 0.17 - 0.1 * m.badge;
    // drips along the sill
    for (const d of this.drips) {
      const k = Math.max(0, m.side - 0.2) / 0.8 * d.userData.k, x = d.userData.x;
      d.visible = k > 0.02;
      d.scale.set(0.045, 0.04 + 0.16 * k, 0.045);
      d.position.set(x, P.bottom + 0.12 - 0.12 * k, -P.hw - 0.02 - 0.03 * k);
    }
  }
}

/** white tradesman's van */
export const van = () => {
  const g = new THREE.Group(), w = lam("vanWhite", () => ({ color: "#eef0f2" })), glass = lam("vanGlass", () => ({ color: "#2d3850" }));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(boxGeo(V(-2.6, 0.32, -0.98), V(1.2, 2.35, 0.98), 0, true), w);
  add(boxGeo(V(1.2, 0.32, -0.95), V(2.55, 1.15, 0.95), 0, true), w);
  const ws = add(new THREE.BoxGeometry(0.5, 0.9, 1.84), glass); ws.position.set(1.42, 1.62, 0); ws.rotation.z = -0.55;
  add(boxGeo(V(1.22, 1.15, -0.96), V(1.7, 2.05, 0.96)), w);
  for (const s of [-1, 1]) { const sw = add(new THREE.BoxGeometry(0.7, 0.55, 0.02), glass); sw.position.set(0.85, 1.55, s * 0.99); }
  const tyre = lam("tyre", () => ({ color: "#26232b" }));
  for (const wx of [-1.7, 1.6]) for (const s of [-1, 1]) { const t = add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 18).rotateX(Math.PI / 2), tyre); t.position.set(wx, 0.36, s * 0.86); }
  return g;
};

/** red double-decker bus (text-free) */
export const bus = () => {
  const g = new THREE.Group(), red = lam("busRed", () => ({ color: "#c8323a" }));
  const win = lam("busWin", () => ({ map: ctex("busWin", 1024, 256, (c) => {
    c.fillStyle = "#c8323a"; c.fillRect(0, 0, 1024, 256);
    for (const y of [20, 140]) for (let x = 20; x < 1000; x += 110) { c.fillStyle = "#2d3850"; c.fillRect(x, y, 96, 90); c.fillStyle = "rgba(200,225,255,0.25)"; c.fillRect(x + 10, y + 6, 14, 80); }
    c.fillStyle = "#f4ecd8"; c.fillRect(0, 122, 1024, 10);
  }) }));
  const body = new THREE.Mesh(boxGeo(V(-5.5, 0.35, -1.25), V(5.5, 4.3, 1.25), 0, true), red);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 2.9), win);
    p.position.set(0, 2.55, s * 1.26); if (s < 0) p.rotation.y = Math.PI; g.add(p);
  }
  const tyre = lam("tyre", () => ({ color: "#26232b" }));
  for (const wx of [-3.6, 3.4]) for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 18).rotateX(Math.PI / 2), tyre); t.position.set(wx, 0.5, s * 1.1); g.add(t); }
  return g;
};
