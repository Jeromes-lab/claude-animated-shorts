// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, KID, SKINS, fxBurst, fxPuff, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { TALK } from "./talk";
import { FPS, SHOTS, V3, smooth, clamp01, lin, W, THORNTON, WALTER_AT, OLDS, PLUNGER, TVCAM, CRATES, ROPE_Z, BOOM, CRUSH, CHUNKS, GIANT, TH2, WC } from "./story";
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
export type Stage = { places: Place[]; fx: FxPlace[] };
const THORN: Outfit = { jacket: "#f4f1ea", pants: "#8a7a5a", boots: "#3a2a22", hat: "hardhat", cap: "#f2c230", tie: "#2f3e5c", shirt: "#f4f1ea", skin: SKINS[0] };
const WALT: Outfit = { jacket: "#6b6f3a", pants: "#4a4e58", boots: "#3a2a22", hat: "cap", cap: "#3f5a3a", moustache: "#8f877c", skin: SKINS[2], build: "stout" };
const WORKER: Outfit = { jacket: "#e8892f", pants: "#3b3f52", boots: "#3a2a22", hat: "hardhat", cap: "#f4f1ea", skin: SKINS[3] };
const CAMMAN: Outfit = { jacket: "#3a3d47", pants: "#4a4e58", boots: "#2a2420", hat: "cap", cap: "#c8323a", skin: SKINS[1], glasses: "sun" };
const FOLK70: Outfit[] = [
  { jacket: "#c8742f", pants: "#3f6fb5", boots: "#4a3426", hat: "hair", hair: "#5a3b2a", skin: SKINS[0] },
  { jacket: "#d9a441", pants: "#7a4a2c", boots: "#3a2a22", hat: "hair", hair: "#e0b25a", bun: true, skin: SKINS[1] },
  { jacket: "#7a4a2c", pants: "#2f3e5c", boots: "#2a2420", hat: "hair", hair: "#2a201a", glasses: "round", skin: SKINS[3] },
  { jacket: "#5d7a3a", pants: "#8a7a5a", boots: "#4a3426", hat: "cap", cap: "#3f6fb5", skin: SKINS[2] },
  { jacket: "#8c3b4a", pants: "#3b3f52", boots: "#3a2a22", hat: "hair", hair: "#a84a2c", bun: true, skin: SKINS[0] },
  { jacket: "#3f6fb5", pants: "#c9b28a", boots: "#2a2420", hat: "hair", hair: "#3a2418", glasses: "sun", skin: SKINS[1] },
  { jacket: "#b5a03f", pants: "#4a4e58", boots: "#3a2a22", hat: "hair", hair: "#8f8a84", skin: SKINS[2] },
];
const at = (f: number, w: number) => f >= w - 2;
const talk = (sp: "T" | "W", f: number) => TALK[sp][Math.max(0, Math.min(TALK[sp].length - 1, f))] ?? 0;

const front = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, y: number, z: number, fo: FrontOpts, t: number, scale = 1, shadow = true) => {
  out.places.push(person(cam, { i, o, okey: key }, x, y, z, { side: false, mirror: false }, { blink: lidAt(t, i), ...fo }, {}, scale));
  if (shadow) blob(out, x, y, z, scale);
};
const walker = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, z: number, dx: number, dz: number, phase: number, t: number, fo: Partial<FrontOpts> = {}, fast = false) => {
  const view = viewOf(cam, x, z, dx, dz);
  const so: SideOpts = { mode: "march", phase, expr: fo.expr ?? "neutral", stomp: fast ? 1.3 : 0.5, stride: (fast ? 1.0 : 0.75) * view.fs, blink: lidAt(t, i) };
  const f2: FrontOpts = { mode: fast ? "march" : "stroll", phase, expr: "neutral", lift: fast ? 70 : 40, blink: lidAt(t, i), ...fo };
  out.places.push(person(cam, { i, o, okey: key }, x, 0, z, fo.prop ? { side: false, mirror: false } : view, f2, so));
  blob(out, x, 0, z);
};
/** spectators behind the rope (count grows when "the crowd gathers") */
const CROWD: [number, number][] = Array.from({ length: 24 }, (_, i) => [-9 + (i % 8) * 2.5 + (Math.floor(i / 8) % 2) * 1.2 + (hh(i, 1) - 0.5) * 0.8, ROPE_Z + 1.1 + Math.floor(i / 8) * 1.7 + hh(i, 2) * 0.5]);
const crowd = (out: Stage, cam: CamInfo, t: number, f: number, n: number, fo: (i: number) => Partial<FrontOpts>) => {
  for (let i = 0; i < n; i++) {
    const [x, z] = CROWD[i], kid = i % 7 === 3;
    front(out, cam, 100 + i, kid ? KID : FOLK70[i % FOLK70.length], kid ? "kid" : `c${i % FOLK70.length}`, x, 0, z, { mode: "stand", expr: "neutral", ...fo(i) }, t, kid ? 0.78 : 1);
  }
};
/** the crowd runs for it: away from the beach, each at its own pace and angle */
const crowdRun = (out: Stage, cam: CamInfo, t: number, f: number) => {
  const t0 = 1392;
  for (let i = 0; i < CROWD.length; i++) {
    const [x0, z0] = CROWD[i], kid = i % 7 === 3, sp = 3.2 + 1.6 * hh(i, 3), ang = (hh(i, 4) - 0.5) * 1.6;
    const tt = Math.max(0, (f - t0 - hh(i, 5) * 10) / FPS), x = x0 + Math.sin(ang) * sp * tt, z = z0 + Math.cos(ang) * sp * tt;
    const o = kid ? KID : FOLK70[i % FOLK70.length], key = kid ? "kid" : `c${i % FOLK70.length}`;
    if (tt <= 0) front(out, cam, 100 + i, o, key, x, 0, z, { mode: "stand", expr: "shock", look: -1 }, t, kid ? 0.78 : 1);
    else walker(out, cam, 100 + i, { ...o, goo: i % 4 === 1 && f > t0 + 20 }, key + (i % 4 === 1 ? "g" : ""), x, z, Math.sin(ang), Math.cos(ang), q((tt * sp / 1.6 + hh(i, 6)) % 1, 60), t, { expr: i % 3 ? "shock" : "gasp" }, true);
  }
};

// ---------------- effect drawings (text-free) ----------------
const fxSplat = (p: Pen, u: number) => { // goo splash burst, 400 x 400
  const g = p.g;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, d = 40 + 150 * u, r = (26 - 14 * u) * (i % 2 ? 0.7 : 1);
    p.ell(200 + d * Math.cos(a), 220 + d * 0.7 * Math.sin(a) - 60 * u * (1 - u), r, r * 0.8, i % 3 ? "#c99a88" : "#94645a", 5);
  }
  if (u < 0.5) p.ell(200, 230, 70 * (1 - u), 40 * (1 - u), "#c99a88", 6);
  void g;
};
const fxGoo = (p: Pen, seed: number) => { // flat goo puddle, top-down, 300 x 300
  const pts: [number, number][] = [];
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2, r = 110 * (1 + 0.18 * Math.sin(a * 5 + seed) + 0.1 * Math.sin(a * 9 + seed * 2)); pts.push([150 + r * Math.cos(a), 150 + r * Math.sin(a)]); }
  p.poly(pts, "#c39484", 6); p.ell(130, 135, 30, 18, "#e0bcae", 0);
};
const fxStink = (p: Pen, u: number) => { // wavy green stink lines, 200 x 300
  for (const x of [55, 100, 145]) {
    const pts: [number, number][] = [];
    for (let y = 280; y > 30; y -= 10) pts.push([x + 14 * Math.sin(y / 22 + u * 6.28 + x), y - 30 * u]);
    p.stroke(pts, 9, `rgba(120,160,60,${(0.85 * Math.sin(Math.PI * u)).toFixed(3)})`);
  }
};
const fxGull = (p: Pen, w: number) => { // seagull, wings at phase w, 300 x 200
  const y = 100 + 30 * w;
  p.poly([[150, 108], [60, y - 10], [20, y + 10], [70, y + 4], [150, 122], [230, y + 4], [280, y + 10], [240, y - 10]], "#f4f4f0", 7);
  p.ell(150, 112, 26, 14, "#f4f4f0", 6); p.poly([[20, y + 10], [44, y - 4], [50, y + 6]], "#3a3d47", 0); p.poly([[280, y + 10], [256, y - 4], [250, y + 6]], "#3a3d47", 0);
  p.poly([[170, 110], [190, 114], [170, 118]], "#f2c230", 3);
};
const fxFly = (p: Pen) => { p.ell(50, 50, 12, 10, "#2b2a30", 0); p.ell(40, 38, 12, 8, "rgba(220,230,255,0.85)", 3); p.ell(60, 38, 12, 8, "rgba(220,230,255,0.85)", 3); };
const fxSparkle = (p: Pen, u: number) => { // 4-point star glint, 200 x 200
  const r = 90 * Math.sin(Math.PI * u), w = 16 * Math.sin(Math.PI * u);
  p.poly([[100, 100 - r], [100 + w, 100 - w], [100 + r, 100], [100 + w, 100 + w], [100, 100 + r], [100 - w, 100 + w], [100 - r, 100], [100 - w, 100 - w]], "#ffffff", 6);
};
const fxConfetti = (p: Pen, seed: number) => { // 300 x 300
  const cols = ["#e2453c", "#f2c230", "#3f6fb5", "#4f8a5a", "#c25a7a"];
  for (let i = 0; i < 26; i++) { const x = hh(seed * 40 + i, 1) * 280 + 10, y = hh(seed * 40 + i, 2) * 280 + 10, a = hh(seed * 40 + i, 3) * 3; p.g.save(); p.g.translate(x, y); p.g.rotate(a); p.g.fillStyle = cols[i % 5]; p.g.fillRect(-9, -4, 18, 8); p.g.restore(); }
};
const fxBadge = (p: Pen) => { // gold star badge, 200 x 200
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) { const r = k % 2 ? 40 : 90, a = (k * Math.PI) / 5 - Math.PI / 2; pts.push([100 + r * Math.cos(a), 100 + r * Math.sin(a)]); }
  p.poly(pts, "#f2c230", 8); p.ell(100, 100, 26, 26, "#ffe28a", 5);
};

const splats = (out: Stage, f: number, near: (x: number, z: number) => boolean, burst = false) => {
  CHUNKS.forEach((c, i) => {
    if (f < c.t1 || !near(c.land[0], c.land[2])) return;
    const u = (f - c.t1) / 8;
    if (burst && u < 1) out.fx.push({ key: `splat${q(u, 20)}`, cw: 400, ch: 400, draw: (p) => fxSplat(p, q(u, 20)), x: c.land[0], y: 0.4 * c.size + 0.3, z: c.land[2], w: 1.6 * c.size + 0.6, h: 1.6 * c.size + 0.6 });
    out.fx.push({ key: `goo${i % 4}`, cw: 300, ch: 300, draw: (p) => fxGoo(p, i % 4), x: c.land[0], y: 0.015 + 0.001 * (i % 7), z: c.land[2], w: 1.5 * c.size + 0.5, h: 1.3 * c.size + 0.5, flat: true, rot: i });
  });
};

export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const thorn = (fo: Partial<FrontOpts>, o: Outfit = THORN, at3: V3 = THORNTON) => front(out, cam, 1, o, "th" + (o.goo ? "g" : ""), at3[0], 0, at3[2], { mode: "stand", expr: "smile", talk: talk("T", f), ...fo }, t);
  const walt = (fo: Partial<FrontOpts>, o: Outfit = WALT, at3: V3 = WALTER_AT) => front(out, cam, 2, o, "wa" + (o.goo ? "g" : ""), at3[0], 0, at3[2], { mode: "stand", expr: "neutral", talk: talk("W", f), ...fo }, t);
  const stink = (x: number, y: number, z: number, n: number, sz = 1.6) => { for (let k = 0; k < n; k++) { const u = q((t * 0.5 + k / n) % 1, 30); out.fx.push({ key: `stink${u}`, cw: 200, ch: 300, draw: (p) => fxStink(p, u), x: x + (k - n / 2) * 1.6, y: y + 0.6 * sz, z, w: sz * 0.7, h: sz, soft: true }); } };
  switch (id) {
    case 1: {
      crowd(out, cam, t, f, 10, (i) => ({ expr: i % 3 ? "neutral" : "squint", prop: i % 4 === 0 ? "pinch" : null }));
      for (let k = 0; k < 2; k++) {
        const u = ((t * 0.35 + k * 0.5) % 1), x = CRATES[0] - 3 + 6 * u;
        walker(out, cam, 20 + k, WORKER, "wk", x, CRATES[2] + 1.6 + k * 0.8, 1, 0, q((t * 1.4 + k * 0.5) % 1, 60), t, { expr: "neutral" });
      }
      stink(0, 3, 0, 3);
      break;
    }
    case 2: {
      stink(0, 3, 0, 4, 2.2);
      for (let k = 0; k < 7; k++) { const a = t * (2 + k * 0.3) + k, r = 1.2 + 0.5 * hh(k, 1); out.fx.push({ key: "fly", cw: 100, ch: 100, draw: fxFly, x: 3 + Math.cos(a) * r + (k % 3) * 2 - 2, y: 2.8 + 0.4 * Math.sin(a * 1.7), z: 1.5 + Math.sin(a) * r * 0.5, w: 0.12, h: 0.12 }); }
      crowd(out, cam, t, f, 14, (i) => ({ expr: at(f, W.smells) ? (i % 2 ? "squint" : "pained") : "neutral", prop: at(f, W.smells) && i % 3 !== 2 ? "pinch" : null }));
      break;
    }
    case 3: {
      const k = clamp01((f - 300) / 54);
      if (k < 1) walker(out, cam, 1, THORN, "th", 16 - 4.7 * k, 30 - 8.8 * k, -0.47, -0.88, q(((f - 300) / 20) % 1, 60), t, { expr: "smile", prop: "clipboard" });
      else thorn({ expr: at(f, W.thornton) ? "grin" : "smile", prop: "clipboard", talk: 0 });
      front(out, cam, 20, WORKER, "wk", 15.5, 0, 26, { mode: "stand", expr: "neutral" }, t);
      crowd(out, cam, t, f, 14, () => ({ expr: "squint", prop: "pinch" }));
      break;
    }
    case 4: {
      thorn({ expr: "grin", prop: f < W.blow ? "clipboard" : "point" });
      for (let k = 0; k < 6; k++) { const a = t * 0.8 + (k / 6) * Math.PI * 2, w = Math.sin(t * 9 + k) * 0.5 + 0.5; out.fx.push({ key: `gull${q(w, 6)}`, cw: 300, ch: 200, draw: (p) => fxGull(p, q(w, 6)), x: 4 + Math.cos(a) * (3 + k * 0.6), y: 6 + 1.5 * Math.sin(a * 2 + k), z: 6 + Math.sin(a) * (2 + k * 0.4), w: 2.2, h: 1.47 }); }
      crowd(out, cam, t, f, 14, () => ({ expr: "squint", prop: "pinch" }));
      break;
    }
    case 5: {
      const k = clamp01((f - 552) / 66);
      if (k < 1) walker(out, cam, 2, WALT, "wa", 4 + 5 * k, 28.5 - 6.7 * k, 0.6, -0.8, q(((f - 552) / 24) % 1, 60), t, { expr: "neutral" });
      else walt({ expr: at(f, W.explosives) ? "smile_closed" : "neutral", talk: 0 });
      thorn({ expr: "smile", prop: "clipboard", talk: 0 });
      crowd(out, cam, t, f, 14, (i) => ({ expr: "neutral", prop: i % 3 === 0 ? "pinch" : null }));
      break;
    }
    case 6: {
      walt({ expr: f >= W.need - 2 ? "stern" : "neutral", look: -1 });
      thorn({ expr: f >= W.sir - 2 ? "meh" : "grin", prop: f >= W.sir - 2 ? "clipboard" : null, look: 1 });
      break;
    }
    case 7: {
      const k = clamp01((f - 880) / 70);
      if (k < 1) walker(out, cam, 2, WALT, "wa", 1 + 2.6 * k, 44 + 4.4 * k, 0.5, 0.86, q(((f - 880) / 24) % 1, 60), t, { expr: "smile_closed" });
      else walt({ expr: "smile_closed", prop: f >= W.bought ? "thumbs" : null, talk: 0 }, WALT, WC);
      for (const [f0, x, y] of [[929, OLDS[0] + 1.2, 1.25], [945, OLDS[0] - 1.0, 1.05], [1051, OLDS[0] + 0.3, 1.4], [1060, OLDS[0] + 2.2, 0.85]] as const) {
        const u = (f - f0) / 12;
        if (u >= 0 && u < 1) out.fx.push({ key: `spark${q(u, 20)}`, cw: 200, ch: 200, draw: (p) => fxSparkle(p, q(u, 20)), x, y, z: OLDS[2] - 1.1, w: 0.7, h: 0.7 });
      }
      break;
    }
    case 8: {
      const n = Math.round(lin([[1085, 10], [1120, 24]], f));
      crowd(out, cam, t, f, n, (i) => ({ expr: f >= BOOM ? "shock" : i % 3 ? "grin" : "smile", prop: f < BOOM && i % 5 === 0 ? "pinch" : null, look: -1 }));
      front(out, cam, 30, CAMMAN, "cm", TVCAM[0] + 0.15, 0, TVCAM[2] + 0.55, { mode: "stand", expr: "squint" }, t);
      const pushK2 = f >= 1210 ? 1 : 0;
      front(out, cam, 1, THORN, "th", PLUNGER[0], 0, PLUNGER[2] + 0.42, { mode: "stand", expr: pushK2 ? "laugh" : "grin", prop: "plunger" }, t);
      break;
    }
    case 9: {
      crowd(out, cam, t, f, 24, (i) => ({ expr: f < W.bad - 2 ? (i % 2 ? "relief" : "smile") : "shock", look: f < W.bad - 2 ? 0 : -1 }));
      break;
    }
    case 10: {
      crowdRun(out, cam, t, f);
      splats(out, f, () => true, true);
      break;
    }
    case 11: {
      const hit = f >= CRUSH;
      walt({ expr: hit ? "shock" : at(f, W.chunk) ? "gasp" : "neutral", look: hit ? 0 : -1, talk: 0 }, hit ? { ...WALT, goo: true } : WALT, WC);
      if (hit && f < CRUSH + 10) { const u = (f - CRUSH) / 10; out.fx.push({ key: `splat${q(u, 20)}`, cw: 400, ch: 400, draw: (p) => fxSplat(p, q(u, 20)), x: OLDS[0], y: 1.8, z: OLDS[2] - 0.6, w: 4.5, h: 4.5 }); }
      splats(out, f, (x, z) => z > 40);
      break;
    }
    case 12: walt({ expr: "stern" }, { ...WALT, goo: true }, WC); break;
    case 13: {
      thorn({ expr: f >= W.still - 2 ? "nervous" : "neutral", talk: 0, look: -1 }, { ...THORN, goo: true }, TH2);
      front(out, cam, 20, WORKER, "wk", TH2[0] + 1.3, 0, TH2[2] + 0.6, { mode: "stand", expr: "nervous", look: -1 }, t);
      front(out, cam, 21, { ...WORKER, goo: true }, "wkg", TH2[0] - 1.4, 0, TH2[2] + 0.9, { mode: "stand", expr: "dazed" }, t);
      stink(0.5, 2.5, 0.3, 3, 2);
      splats(out, f, (x, z) => z < 20);
      break;
    }
    case 14: {
      const promo = f >= W.promoted - 2;
      thorn({ expr: f >= W.nailed - 2 ? "grin" : promo ? "laugh" : "smile", prop: "thumbs" }, { ...THORN, goo: true }, TH2);
      if (promo) {
        out.fx.push({ key: "badge", cw: 200, ch: 200, draw: fxBadge, x: TH2[0] - 0.14, y: 1.3, z: TH2[2] + 0.2, w: 0.24, h: 0.24 });
        for (const [f0, dx, dy] of [[1882, -1.2, 2.0], [1893, 1.3, 1.6], [1910, -0.9, 1.2]] as const) { const u = (f - f0) / 6; if (u >= 0 && u < 1) out.fx.push({ key: `burst${q(u, 20)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20), "#ffffff"), x: TH2[0] + dx, y: dy, z: TH2[2] + 0.8, w: 0.9, h: 0.9 }); }
        for (let k = 0; k < 4; k++) { const u = ((f - W.promoted) / 45 + k * 0.25) % 1; out.fx.push({ key: `conf${k}`, cw: 300, ch: 300, draw: (p) => fxConfetti(p, k), x: TH2[0] + (k - 1.5) * 0.7, y: 3.4 - 2.6 * u, z: TH2[2] + 0.4, w: 1.1, h: 1.1, rot: u * 2 + k }); }
      }
      splats(out, f, (x, z) => z < 20);
      break;
    }
  }
  return out;
};
export { FPS, BOOM, GIANT, CRUSH };
