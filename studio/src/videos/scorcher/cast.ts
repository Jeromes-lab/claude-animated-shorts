// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, KID, SKINS, fxBurst, fxPuff, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, lin, W, GARDEN, VEGAS, CAR, MAT, PAN, FACADE_FOCUS, OFFICE_DOOR, reporterX, towerZ, towerHW } from "./story";
import { CURB } from "./city";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- our cast ----------------
export type Stage = { places: Place[]; fx: FxPlace[]; rays: { a: V3; b: V3; k: number; w: number }[] };
const SUIT = "#2f3e5c";
const CARMAN: Outfit = { jacket: SUIT, pants: "#2a2f3d", boots: "#3a2a22", hat: "hair", hair: "#5a3b2a", shirt: "#f4f4f0", tie: "#b8403a", skin: SKINS[0] };
const REPORTER: Outfit = { jacket: "#7fa3c9", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#7a4a2c", bun: true, lanyard: "#c8323a", glasses: "round", skin: SKINS[2] };
const HAIRDRESSER: Outfit = { jacket: "#3a3540", pants: "#2a2830", boots: "#2a2830", hat: "hair", hair: "#b5653f", bun: true, apron: "#c25a7a", skin: SKINS[1] };
const DEVELOPER: Outfit = { jacket: "#6c7280", pants: "#4a4e58", boots: "#2a2420", hat: "hair", hair: "#a89c90", shirt: "#f4f4f0", tie: "#3f6fb5", build: "stout", skin: SKINS[0] };
const ARCHITECT: Outfit = { jacket: "#4a4e63", pants: "#3a3d4e", boots: "#2a2420", hat: "hair", hair: "#8f8a84", shirt: "#e9e4dc", glasses: "round", skin: SKINS[1] };
const FOLKS: Outfit[] = [
  { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a201a", skin: SKINS[3] },
  { jacket: "#b5653f", pants: "#2f3e5c", boots: "#3a2a22", hat: "hair", hair: "#d9a441", bun: true, skin: SKINS[0] },
  { jacket: "#5d7a3a", pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: "#c8323a", skin: SKINS[1] },
  { jacket: "#8c3b4a", pants: "#2a2f3d", boots: "#2a2420", hat: "hair", hair: "#4a3020", glasses: "sun", skin: SKINS[2] },
  { jacket: "#d9a441", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a201a", bun: true, skin: SKINS[3] },
  { jacket: "#2f5f6a", pants: "#4a4e58", boots: "#3a2a22", hat: "hair", hair: "#a89c90", tie: "#d9a441", shirt: "#f4f4f0", skin: SKINS[0] },
  { jacket: "#7b5ac9", pants: "#2a2f3d", boots: "#2a2420", hat: "hair", hair: "#5a3b2a", glasses: "sun", skin: SKINS[1] },
];
const BATHERS: Outfit[] = [
  { jacket: "#e2453c", pants: "#e2453c", boots: "#f2c9a0", hat: "sunhat", skin: SKINS[1], glasses: "sun" },
  { jacket: "#3fb5c9", pants: "#2f5f6a", boots: "#f2c9a0", hat: "hair", hair: "#2a201a", skin: SKINS[3] },
  { jacket: "#f2c94c", pants: "#3f6fb5", boots: "#f2c9a0", hat: "hair", hair: "#d9a441", bun: true, skin: SKINS[0] },
  { jacket: "#7b5ac9", pants: "#7b5ac9", boots: "#f2c9a0", hat: "sunhat", skin: SKINS[2] },
  { jacket: "#4f8a5a", pants: "#2a2f3d", boots: "#f2c9a0", hat: "hair", hair: "#4a3020", glasses: "sun", skin: SKINS[1] },
];
const at = (f: number, w: number) => f >= w - 2; // reactions land 0-3 frames before the word

const front = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, y: number, z: number, fo: FrontOpts, t: number, scale = 1, shadow = true) => {
  out.places.push(person(cam, { i, o, okey: key }, x, y, z, { side: false, mirror: false }, { blink: lidAt(t, i), ...fo }, {}, scale));
  if (shadow) blob(out, x, y, z, scale);
};
/** walking: side view when we see them across, front view otherwise; dx = walking direction along x (+1 / -1) */
const walker = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, y: number, z: number, dx: number, dz: number, phase: number, t: number, fo: Partial<FrontOpts> = {}) => {
  const view = viewOf(cam, x, z, dx, dz);
  const so: SideOpts = { mode: "march", phase, expr: fo.expr ?? "neutral", stomp: 0.5, stride: 0.75 * view.fs, blink: lidAt(t, i) };
  const f2: FrontOpts = { mode: "stroll", phase, expr: "neutral", lift: 40, blink: lidAt(t, i), ...fo };
  out.places.push(person(cam, { i, o, okey: key }, x, y, z, fo.prop ? { side: false, mirror: false } : view, f2, so));
  blob(out, x, y, z);
};
/** background pedestrians strolling along the pavements (wide London shots) */
const strollers = (out: Stage, cam: CamInfo, t: number, which: "s" | "n" | "both", n = 6) => {
  for (let i = 0; i < n; i++) {
    const south = which === "s" || (which === "both" && i % 2 === 0), dir = i % 3 === 0 ? -1 : 1, sp = 1.1 + 0.3 * hh(i, 3);
    const z = south ? 8.2 + 1.2 * hh(i, 4) : -9.4 - 1.0 * hh(i, 4), x = -40 + ((hh(i, 5) * 80 + dir * sp * t) % 80 + 80) % 80;
    walker(out, cam, 300 + i, FOLKS[i % FOLKS.length], `p${i % FOLKS.length}`, x - 0, CURB, z, dir, 0, q(((t * sp) / 1.5 + hh(i, 6)) % 1, 60), t);
  }
};

// ---------------- effect drawings (text-free) ----------------
/** scorch mark on a doormat, top-down, 256 x 256; k grows 0..1 */
const fxScorch = (p: Pen, k: number) => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 120 * k + 1);
  gr.addColorStop(0, "rgba(40,22,18,0.95)"); gr.addColorStop(0.55, "rgba(70,35,25,0.8)"); gr.addColorStop(0.8, "rgba(160,70,30,0.5)"); gr.addColorStop(1, "rgba(160,70,30,0)");
  g.fillStyle = gr; g.beginPath(); g.ellipse(128, 128, 120 * k + 1, 100 * k + 1, 0.3, 0, 7); g.fill();
  if (k > 0.4) for (let i = 0; i < 6; i++) { const a = i * 1.1; p.ell(128 + 50 * k * Math.cos(a), 128 + 40 * k * Math.sin(a), 6, 4, "#ffb347", 0); }
};
/** fried egg in the pan, top-down, 300 x 300; k = spread 0..1, sizzle 0..1 adds bubbles + browned lace */
const fxEgg = (p: Pen, k: number, sizzle: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, r = (60 + 70 * k) * (1 + 0.12 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 9)); pts.push([150 + r * Math.cos(a), 150 + r * 0.92 * Math.sin(a)]); }
  if (sizzle > 0.3) p.poly(pts.map(([x, y]) => [150 + (x - 150) * 1.06, 150 + (y - 150) * 1.06] as [number, number]), "#d9a35a", 0);
  p.poly(pts, "#fbf8f1", 7);
  p.ell(156, 142, 34, 30, "#f7b81f", 7);
  p.ell(146, 132, 9, 7, "#ffe9a6", 0);
  for (let i = 0; i < Math.round(8 * sizzle); i++) { const a = i * 2.3 + sizzle * 4; p.ell(150 + 90 * k * Math.cos(a), 150 + 80 * k * Math.sin(a), 6, 6, "#ffffff", 3); }
};
/** egg falling, side-on, 120 x 150 */
const fxEggWhole = (p: Pen) => p.ell(60, 75, 40, 52, "#f6efe0", 7);
/** steam: thin rising wavy strokes that fade, 200 x 300 */
const fxSteam = (p: Pen, u: number) => {
  const a = Math.sin(Math.PI * u);
  for (const x of [60, 100, 140]) {
    const pts: [number, number][] = [];
    for (let y = 290; y > 30; y -= 10) pts.push([x + 12 * Math.sin(y / 26 + u * 6.28 + x * 0.1) * (1 - y / 320), y - 40 * u]);
    p.stroke(pts, 6, `rgba(255,255,255,${(0.7 * a).toFixed(3)})`);
  }
};
/** dry leaf, top-down, 220 x 140 */
const fxLeaf = (p: Pen, burn: number) => {
  p.poly([[10, 70], [60, 22], [140, 14], [205, 62], [150, 118], [60, 120]], burn > 0.6 ? "#7a4a2c" : "#c98a3c", 7);
  p.stroke([[18, 70], [200, 64]], 5); for (const x of [60, 100, 140]) { p.stroke([[x, 68], [x + 22, 34]], 3.5); p.stroke([[x, 68], [x + 22, 104]], 3.5); }
  if (burn > 0) { p.ell(118, 66, 26 * burn, 20 * burn, "#3a2018", 0); p.ell(118, 66, 12 * burn, 9 * burn, "#ffb347", 0); }
};
/** heat shimmer: three wavy lines, 200 x 300, phase u */
const fxShimmer = (p: Pen, u: number) => {
  for (const x of [50, 100, 150]) {
    const pts: [number, number][] = [];
    for (let y = 280; y > 20; y -= 12) pts.push([x + 10 * Math.sin(y / 30 + u * 6.28 + x), y]);
    p.stroke(pts, 7, "rgba(255,255,255,0.75)");
  }
};
/** grey smoke wisp, 300 x 300 (soft) */
const fxSmoke = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = 1.6 + i * 0.5, d = 30 + 60 * t, r = (30 + 14 * (i % 2)) * (0.6 + 0.6 * t);
    p.ell(150 + d * 0.4 * Math.cos(a * 3), 200 - d * Math.sin(a) - 60 * t, r, r * 0.85, `rgba(110,105,115,${(0.8 * (1 - t)).toFixed(3)})`, 0);
  }
};

// ---------------- per shot ----------------
const T = (f: number) => f / FPS;
/** kid's spoon bowl in world space (kid card at kx, kz, scale s): bowl at design (440, 408) in the 600 x 1000 card */
const KID_AT: V3 = [GARDEN[0] + 0.1, 0, GARDEN[2]], KID_S = 0.82;
export const LEAF: V3 = [GARDEN[0] + 0.95, 0.02, GARDEN[2] + 0.65];
const bowlAt = (cam: CamInfo): V3 => {
  const dx = (440 - 300) * SU * KID_S, dy = (975 - 408) * SU * KID_S;
  return [KID_AT[0] + cam.right.x * dx, KID_AT[1] + dy, KID_AT[2] + cam.right.z * dx + 0.05];
};

export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [], rays: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (id) {
    case 1: {
      front(out, cam, 1, FOLKS[3], "f3", 6.2, CURB, 6.6, { mode: "stand", expr: at(f, W.car) ? "gasp" : "neutral", prop: "phone" }, t);
      front(out, cam, 2, FOLKS[1], "f1", 7.4, CURB, 7.4, { mode: "stand", expr: at(f, W.touching) ? "shock" : "squint", prop: "shade" }, t);
      shimmer(out, t, [0.2, 1.6, 2.4], 1.4);
      break;
    }
    case 2: strollers(out, cam, t, "both", 8); break;
    case 3: {
      // he gets out on the kerb side (his head rises over the roof), then strolls off east along the pavement
      if (f >= 346) {
        const rise = smooth((f - 346) / 14), walk = clamp01((f - 362) / 62);
        const x = 0.3 + 4.6 * walk, z = 4.45 + 1.4 * smooth((f - 362) / 18);
        const y = (walk > 0 ? CURB : 0) - 0.85 * (1 - rise);
        if (walk <= 0) front(out, cam, 10, CARMAN, "man", x, y, z, { mode: "stand", expr: "smile" }, t, 1, false);
        else walker(out, cam, 10, CARMAN, "man", x, CURB, z, 1, 0, q(((f - 362) / 22) % 1, 60), t, { expr: "smile" });
      }
      strollers(out, cam, t, "s", 4);
      break;
    }
    case 4: {
      const walk = clamp01((f - 420) / 17), x = 5.4 - 2.4 * smooth(walk);
      const expr: Expr = f < W.mirror - 3 ? "neutral" : f < W.badge - 3 ? "shock" : f < W.side - 3 ? "gasp" : "shock";
      if (walk < 1) walker(out, cam, 10, CARMAN, "man", x, 0, 1.15, -1, 0, q(((f - 420) / 22) % 1, 60), t, { expr: "neutral" });
      else front(out, cam, 10, CARMAN, "man", x, 0, 1.15, { mode: "stand", expr, look: -1 }, t);
      shimmer(out, t, [0.1, 1.5, 2.3], 1.2);
      break;
    }
    case 5: {
      const k = clamp01((f - 622) / 40);
      front(out, cam, 20, HAIRDRESSER, "hair", 14.0, CURB, 12.1, { mode: "stand", expr: at(f, W.scorch) ? "shock" : "neutral", prop: "scissors", look: at(f, W.scorch) ? 0 : -1 }, t);
      if (k > 0) out.fx.push({ key: `scorch${q(k, 30)}`, cw: 256, ch: 256, draw: (p) => fxScorch(p, q(k, 30)), x: MAT[0], y: CURB + 0.02, z: MAT[2], w: 0.75, h: 0.75, flat: true, soft: true });
      if (f > 640) for (let n = 0; n < 3; n++) {
        const u = ((t * 0.9 + n / 3) % 1);
        out.fx.push({ key: `smoke${q(u, 30)}`, cw: 300, ch: 300, draw: (p) => fxSmoke(p, q(u, 30)), x: MAT[0] - 0.1 + 0.15 * n, y: CURB + 0.3 + 0.9 * u, z: MAT[2] - 0.1, w: 0.8, h: 0.8, soft: true });
      }
      if (f < 616) strollers(out, cam, t, "s", 3);
      break;
    }
    case 6: {
      if (f < 726) {
        const x = reporterX(f), walking = f < 724;
        if (walking) walker(out, cam, 30, REPORTER, "rep", x, CURB, 7.55, 1, 0, q(((f - 670) / 22) % 1, 60), t, { prop: "pan", expr: "grin" });
        else front(out, cam, 30, REPORTER, "rep", x, CURB, 7.55, { mode: "stand", prop: "pan", expr: "grin" }, t);
      } else {
        front(out, cam, 30, REPORTER, "rep", PAN[0] - 0.75, CURB, PAN[2] + 0.25, { mode: "sit", expr: f > W.egg ? "laugh" : "grin" }, t);
      }
      if (f >= 737) out.fx.push({ key: `blob|contact|${hexOf([0.25, 0.24, 0.36], 1)}`, cw: 128, ch: 128, draw: (p) => fxContact(p, hexOf([0.25, 0.24, 0.36], 1)), x: PAN[0] + 0.04, y: CURB + 0.004, z: PAN[2], w: 0.42, h: 0.38, flat: true });
      // the egg: falls at "cooks", spreads on "egg", sizzles after
      if (f >= 762) {
        const drop = clamp01((f - 762) / 8), sp = clamp01((f - 770) / 12), sz = clamp01((f - 778) / 20);
        if (drop < 1) out.fx.push({ key: "eggWhole", cw: 120, ch: 150, draw: fxEggWhole, x: PAN[0], y: CURB + 0.5 - 0.42 * drop * drop, z: PAN[2], w: 0.07, h: 0.09 });
        else out.fx.push({ key: `egg${q(sp, 20)}_${q(sz, 10)}`, cw: 300, ch: 300, draw: (p) => fxEgg(p, q(sp, 20), q(sz, 10)), x: PAN[0], y: CURB + 0.056, z: PAN[2], w: 0.24, h: 0.24, flat: true, rot: 0.4 });
        if (sz > 0) for (let n = 0; n < 3; n++) {
          const u = (t * 1.2 + n / 3) % 1;
          out.fx.push({ key: `steam${q(u, 30)}`, cw: 200, ch: 300, draw: (p) => fxSteam(p, q(u, 30)), x: PAN[0] + 0.06 * n - 0.06, y: CURB + 0.2 + 0.12 * u, z: PAN[2], w: 0.14, h: 0.24, soft: true });
        }
        if (f >= 778 && f < 784) out.fx.push({ key: `burst${q((f - 778) / 6, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q((f - 778) / 6, 30)), x: PAN[0], y: CURB + 0.12, z: PAN[2], w: 0.35, h: 0.35 });
      }
      break;
    }
    case 7: {
      const crowd: [number, number, Expr, FrontOpts["prop"]][] = [
        [-5.6, -9.9, "squint", "shade"], [-4.3, -10.4, "gasp", "point"], [-3.0, -9.5, "grin", "phone"], [-1.6, -10.2, "squint", null],
        [-0.2, -9.6, "laugh", "point"], [1.2, -10.3, "shock", "shade"], [2.6, -9.7, "grin", "phone"], [4.0, -10.1, "squint", null],
      ];
      crowd.forEach(([x, z, e, pr], i) => {
        const expr: Expr = f < W.walkie - 2 ? (e === "laugh" ? "grin" : e) : i % 2 ? "laugh" : e;
        front(out, cam, 40 + i, i === 2 ? REPORTER : FOLKS[i % FOLKS.length], i === 2 ? "rep" : `f${i % FOLKS.length}`, x, CURB, z, { mode: "stand", expr, prop: pr, look: -1 }, t);
      });
      shimmer(out, t, [0.5, 0.05, 4.2], 1.6);
      break;
    }
    case 8: strollers(out, cam, t, "both", 8); break;
    case 10: { // a flat window: parallel rays in, parallel rays back out
      const sx = GARDEN[0] - 5.5, z = GARDEN[2] - 0.83, din: V3 = [-0.45, -0.55, -0.7];
      const n = Math.hypot(...din), d: V3 = [din[0] / n, din[1] / n, din[2] / n], r: V3 = [d[0], d[1], -d[2]];
      const kin = clamp01((f - 1030) / 28), kout = clamp01((f - W.bounces + 4) / 22);
      for (let i = 0; i < 5; i++) {
        const hit: V3 = [sx - 0.55 + i * 0.27, 1.25 + 0.15 * (i % 2) + i * 0.1, z];
        const L = 7;
        out.rays.push({ a: [hit[0] - d[0] * L, hit[1] - d[1] * L, hit[2] - d[2] * L], b: hit, k: kin, w: 0.035 });
        out.rays.push({ a: hit, b: [hit[0] + r[0] * L, hit[1] + r[1] * L, hit[2] + r[2] * L], k: kout, w: 0.035 });
      }
      break;
    }
    case 11: {
      const expr: Expr = f < W.gathers - 2 ? "smile" : f < W.hot - 2 ? "grin" : "laugh";
      front(out, cam, 50, KID, "kid", KID_AT[0], 0, KID_AT[2], { mode: "stand", expr, prop: "spoon" }, t, KID_S);
      const bowl = bowlAt(cam), sunD: V3 = [-0.45, -0.8, -0.4];
      const kin = clamp01((f - 1112) / 30), kout = clamp01((f - W.gathers + 2) / 30);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, o: V3 = [bowl[0] + 0.035 * Math.cos(a), bowl[1] + 0.05 * Math.sin(a), bowl[2] + 0.01];
        out.rays.push({ a: [o[0] - sunD[0] * 5, o[1] - sunD[1] * 5, o[2] - sunD[2] * 5], b: o, k: kin, w: 0.008 });
        out.rays.push({ a: o, b: LEAF, k: kout, w: 0.008 });
      }
      const burn = clamp01((f - W.one) / 30);
      out.fx.push({ key: `leaf${q(burn, 20)}`, cw: 220, ch: 140, draw: (p) => fxLeaf(p, q(burn, 20)), x: LEAF[0], y: 0.02, z: LEAF[2], w: 0.16, h: 0.1, flat: true, rot: 0.6 });
      if (kout > 0.9) out.fx.push({ key: "glowDot", cw: 128, ch: 128, draw: glowDot, x: LEAF[0], y: 0.05, z: LEAF[2], w: 0.09 + 0.03 * Math.sin(t * 20), h: 0.09 + 0.03 * Math.sin(t * 20), soft: true });
      if (burn > 0.1) for (let n = 0; n < 3; n++) {
        const u = (t * 0.8 + n / 3) % 1;
        out.fx.push({ key: `smoke${q(u, 30)}`, cw: 300, ch: 300, draw: (p) => fxSmoke(p, q(u, 30)), x: LEAF[0] + 0.02 * n, y: 0.08 + 0.3 * u, z: LEAF[2], w: 0.25, h: 0.25, soft: true });
      }
      break;
    }
    case 12: { // the 160 m spoon: sun rays into the curved front, all bent onto one spot in the street
      const spot: V3 = [0.2, 0.05, 2.8], kin = clamp01((f - 1262) / 22), kout = clamp01((f - 1283) / 26);
      for (let i = 0; i < 9; i++) {
        const y = 40 + (i % 3) * 25 + 6 * Math.floor(i / 3), u = (Math.floor(i / 3) - 1) * 0.55 + ((i % 3) - 1) * 0.1, x = u * towerHW(y);
        const hit: V3 = [x, y, towerZ(x, y) + 0.5], from: V3 = [x + 30, y + 70, hit[2] + 90];
        out.rays.push({ a: from, b: hit, k: kin, w: 0.35 });
        out.rays.push({ a: hit, b: spot, k: kout, w: 0.35 });
      }
      break;
    }
    case 13: {
      if (f < 1365) {
        front(out, cam, 60, DEVELOPER, "dev", 3.25, 0, 1.35, { mode: "stand", expr: "smile", prop: "envelope", facing: -1 }, t);
        front(out, cam, 10, CARMAN, "man", 1.25, 0, 1.45, { mode: "stand", expr: f >= W.car2 - 2 ? "relief_open" : "shock", facing: 1 }, t);
      }
      break;
    }
    case 14: front(out, cam, 70, ARCHITECT, "arch", 29.6, CURB, -9.6, { mode: "stand", expr: "neutral" }, t); break;
    case 15: {
      const [vx, , vz] = VEGAS;
      BATHERS.forEach((o, i) => {
        const lx = vx - 8 + i * 3.2 + (i >= 2 ? 3.2 : 0), lz = vz + 51.3, jumper = i === 1;
        let y = 0.42, mode: FrontOpts["mode"] = "sit", expr: Expr = (["relief", "smile_closed", "relief", "smile", "smile_closed"] as Expr[])[i];
        if (jumper && f >= W.pool - 10) { const u = clamp01((f - (W.pool - 10)) / 16); y += 1.3 * Math.sin(Math.PI * Math.min(1, u * 1.1)); mode = "fall"; expr = "shock"; }
        else if (f >= W.same - 2 && i % 2 === 0) expr = "squint";
        front(out, cam, 80 + i, o, `bath${i}`, lx, y, lz, { mode, expr }, t, 1, mode !== "fall");
      });
      // steam off the hot deck where the beam lands
      for (let n = 0; n < 4; n++) {
        const u = (t * 0.7 + n / 4) % 1;
        out.fx.push({ key: `steam${q(u, 30)}`, cw: 200, ch: 300, draw: (p) => fxSteam(p, q(u, 30)), x: vx + 1.5 + (n - 1.5) * 0.8, y: 0.6 + 0.3 * u, z: vz + 44 + (n % 2) * 0.6, w: 0.6, h: 1.0, soft: true });
      }
      shimmer(out, t, [vx + 1.5, 0.05, vz + 44], 2.4);
      break;
    }
    case 16: {
      const shrug = f >= W.too - 4 && f < 1700;
      front(out, cam, 70, ARCHITECT, "arch", 29.6, CURB, -9.6, { mode: "stand", expr: shrug ? "meh" : f >= W.explanation ? "smile" : "neutral", prop: shrug ? "shrug" : null }, t);
      break;
    }
  }
  return out;
};
const glowDot = (p: Pen) => {
  const g = p.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,230,160,0.8)"); gr.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};
/** heat shimmer standing over the hot spot */
const shimmer = (out: Stage, t: number, p: V3, size: number) => {
  for (let n = 0; n < 2; n++) {
    const u = q((t * 0.8 + n * 0.5) % 1, 30);
    out.fx.push({ key: `shim${u}`, cw: 200, ch: 300, draw: (pp) => fxShimmer(pp, u), x: p[0] + (n - 0.5) * size * 0.5, y: p[1] + 0.5 * size, z: p[2], w: size * 0.5, h: size * 0.75, soft: true });
  }
};
export { FPS, FACADE_FOCUS, OFFICE_DOOR, CAR, lin };
