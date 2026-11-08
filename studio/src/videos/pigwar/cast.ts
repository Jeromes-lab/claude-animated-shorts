// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, SKINS, fxBurst, fxShadow, fxContact, Outfit, FrontOpts, SideOpts, pigDraw } from "./toon";
import { TALK } from "./talk";
import { HOOK_US, HOOK_UK, FPS, SHOTS, V3, clamp01, W, CUT, GRIF, PIG, CABIN, AMCAMP, REDOUBT_Z, SHORE, SHIPS, shipAt, DECK, ADMIRAL, FLAGSHIP, GOV, FACEOFF, PARTY, KROOM, GRAVE, POLE, FLAGS, BANG, CP, GP } from "./story";
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
const CUTLAR: Outfit = { jacket: "#c4553f", pants: "#4a5f8a", bib: "#4f6694", boots: "#4a3426", hat: "straw", moustache: "#6a4a2a", skin: SKINS[1] };
const OLDCUT: Outfit = { ...CUTLAR, moustache: "#d6d2ca", jacket: "#a8564a", glasses: "round" };
const GRIFF: Outfit = { jacket: "#7a6a4a", pants: "#5a5048", boots: "#2a2420", hat: "bowler", tie: "#8c2f2f", shirt: "#f4f1ea", chops: "#a8582c", skin: SKINS[0], build: "stout" };
const BLUE = (v: number): Outfit => ({ jacket: "#2f3e66", pants: "#7d9cc4", boots: "#2a2420", hat: "kepi", cap: "#2f3e66", belt: "#f1efe6", buttons: "#e8c45a", rifle: true, skin: SKINS[v % 4], moustache: v % 3 === 1 ? "#5a3b2a" : undefined });
const RED = (v: number): Outfit => ({ jacket: "#c0353a", pants: "#2a2a3a", boots: "#1d1b22", hat: "shako", belt: "#f1efe6", buttons: "#e8c45a", rifle: true, skin: SKINS[(v + 1) % 4], moustache: v % 3 === 0 ? "#6a4a2a" : undefined });
const PICKETT: Outfit = { ...BLUE(0), rifle: false, sword: true, sash: "#c0353a", moustache: "#4a3020", epaul: "#e8c45a" };
const GOVERNOR: Outfit = { jacket: "#2e2a36", pants: "#2e2a36", boots: "#1d1b22", hat: "tophat", shirt: "#f4f1ea", tie: "#f4f1ea", moustache: "#2a201a", skin: SKINS[3], build: "stout" };
const ADM_O: Outfit = { jacket: "#1f2a4a", pants: "#1f2a4a", boots: "#1d1b22", hat: "bicorne", buttons: "#e8c45a", epaul: "#e8c45a", moustache: "#e8e4dc", chops: "#e8e4dc", skin: SKINS[0], build: "stout" };
const KAISER: Outfit = { jacket: "#2e3a52", pants: "#1d1b22", boots: "#1d1b22", hat: "spike", buttons: "#e8c45a", epaul: "#e8c45a", sash: "#e8c45a", moustache: "#eeeae2", chops: "#eeeae2", skin: SKINS[0], build: "stout" };
const RANGER: Outfit = { jacket: "#b9a77d", pants: "#3f4a32", boots: "#3a2a22", hat: "ranger", tie: "#3f4a32", skin: SKINS[3] };
const TOURISTS: Outfit[] = [
  { jacket: "#e2453c", pants: "#3f6fb5", boots: "#f4f1ea", hat: "cap", cap: "#f2c230", skin: SKINS[1], glasses: "sun" },
  { jacket: "#4f8a5a", pants: "#c9b28a", boots: "#4a3426", hat: "hair", hair: "#3a2418", bun: true, skin: SKINS[2] },
  { jacket: "#f2c230", pants: "#3b3f52", boots: "#2a2420", hat: "hair", hair: "#a84a2c", skin: SKINS[0], glasses: "round" },
];
const SACK: Outfit = { jacket: "#c4553f", pants: "#c9a86a", boots: "#c9a86a", hat: "kepi", cap: "#2f3e66", dress: "#c9a86a", skin: SKINS[1] };
const at = (f: number, w: number) => f >= w - 2;
const talk = (sp: "C" | "G", f: number) => TALK[sp][Math.max(0, Math.min(TALK[sp].length - 1, f))] ?? 0;

const front = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, y: number, z: number, fo: FrontOpts, t: number, scale = 1, shadow = true) => {
  out.places.push(person(cam, { i, o, okey: key }, x, y, z, { side: false, mirror: false }, { blink: lidAt(t, i), ...fo }, {}, scale));
  if (shadow) blob(out, x, y, z, scale);
};
const walker = (out: Stage, cam: CamInfo, i: number, o: Outfit, key: string, x: number, z: number, dx: number, dz: number, phase: number, t: number, fo: Partial<FrontOpts> = {}, fast = false, y = 0) => {
  const view = viewOf(cam, x, z, dx, dz);
  const so: SideOpts = { mode: "march", phase, expr: fo.expr ?? "neutral", stomp: fast ? 1.3 : 0.5, stride: (fast ? 1.0 : 0.75) * view.fs, blink: lidAt(t, i) };
  const f2: FrontOpts = { mode: fast ? "march" : "stroll", phase, expr: "neutral", lift: fast ? 70 : 40, blink: lidAt(t, i), ...fo };
  out.places.push(person(cam, { i, o, okey: key }, x, y, z, fo.prop ? { side: false, mirror: false } : view, f2, so));
  blob(out, x, y, z);
};
/** the pig, a lit card like the people (profile, facing screen-right) */
const pig = (out: Stage, cam: CamInfo, mode: "munch" | "up" | "down" | "ghost", x: number, y: number, z: number, k = 0, scale = 1.15, shadow = true) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.4, z)) / scale, [w, h, kk] = tier(d * 0.6), light = light2D(cam, false), kq = q(k, 8);
  out.places.push({ key: `pig|${mode}|${kq}|${light.toFixed(2)}`, x, y, z, scale, draw: (p) => pigDraw(p, mode, kq, light), size: [w, h, kk] });
  if (shadow) blob(out, x, y, z, scale * 1.4);
};

// ---------------- effect drawings (text-free) ----------------
const fxGull = (p: Pen, w: number) => { // seagull, wings at phase w, 300 x 200
  const y = 100 + 30 * w;
  p.poly([[150, 108], [60, y - 10], [20, y + 10], [70, y + 4], [150, 122], [230, y + 4], [280, y + 10], [240, y - 10]], "#f4f4f0", 7);
  p.ell(150, 112, 26, 14, "#f4f4f0", 6); p.poly([[20, y + 10], [44, y - 4], [50, y + 6]], "#3a3d47", 0); p.poly([[280, y + 10], [256, y - 4], [250, y + 6]], "#3a3d47", 0);
  p.poly([[170, 110], [190, 114], [170, 118]], "#f2c230", 3);
};
const fxSparkle = (p: Pen, u: number) => { // 4-point star glint, 200 x 200
  const r = 90 * Math.sin(Math.PI * u), w = 16 * Math.sin(Math.PI * u);
  p.poly([[100, 100 - r], [100 + w, 100 - w], [100 + r, 100], [100 + w, 100 + w], [100, 100 + r], [100 - w, 100 + w], [100 - r, 100], [100 - w, 100 - w]], "#ffffff", 6);
};
const fxConfetti = (p: Pen, seed: number) => { // 300 x 300
  const cols = ["#e2453c", "#f2c230", "#3f6fb5", "#4f8a5a", "#c25a7a"];
  for (let i = 0; i < 26; i++) { const x = hh(seed * 40 + i, 1) * 280 + 10, y = hh(seed * 40 + i, 2) * 280 + 10, a = hh(seed * 40 + i, 3) * 3; p.g.save(); p.g.translate(x, y); p.g.rotate(a); p.g.fillStyle = cols[i % 5]; p.g.fillRect(-9, -4, 18, 8); p.g.restore(); }
};
const fxTwitch = (p: Pen, u: number) => { // three little stress lines, 200 x 200
  for (let k = 0; k < 3; k++) { const a = -0.9 + k * 0.6, r0 = 40 + 10 * u, r1 = 80 + 14 * u; p.stroke([[100 + r0 * Math.cos(a), 100 + r0 * Math.sin(a)], [100 + r1 * Math.cos(a), 100 + r1 * Math.sin(a)]], 9); }
};
const fxDust = (p: Pen, u: number) => { // soft grey smoke ball, 300 x 300
  const g = p.g, gr = g.createRadialGradient(150, 150, 0, 150, 150, 140);
  const a = (0.85 * (1 - u)).toFixed(3);
  gr.addColorStop(0, `rgba(235,232,228,${a})`); gr.addColorStop(0.6, `rgba(215,212,210,${a})`); gr.addColorStop(1, "rgba(215,212,210,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 300, 300);
};
const gulls = (out: Stage, t: number, cx: number, cy: number, cz: number, n = 4, r = 8) => {
  for (let k = 0; k < n; k++) {
    const a = t * 0.5 + (k / n) * Math.PI * 2, w = q(Math.sin(t * 8 + k) * 0.5 + 0.5, 6);
    out.fx.push({ key: `gull${w}`, cw: 300, ch: 200, draw: (p) => fxGull(p, w), x: cx + Math.cos(a) * r, y: cy + 1.5 * Math.sin(a * 2 + k), z: cz + Math.sin(a) * r * 0.6, w: 1.6, h: 1.07 });
  }
};
const firework = (out: Stage, f: number, f0: number, x: number, y: number, z: number, col: string, s = 4) => {
  const u = (f - f0) / 14;
  if (u >= 0 && u < 1) out.fx.push({ key: `fw${col}${q(u, 20)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20), col, 14, 30, 240), x, y, z, w: s, h: s });
};

export const stage = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const cut = (fo: Partial<FrontOpts>, o: Outfit = CUTLAR, p: V3 = CUT) => front(out, cam, 1, o, o === OLDCUT ? "oc" : "cu", p[0], p[1], p[2], { mode: "stand", expr: "neutral", talk: talk("C", f), ...fo }, t);
  const grif = (fo: Partial<FrontOpts>, p: V3 = GRIF) => front(out, cam, 2, GRIFF, "gr", p[0], p[1], p[2], { mode: "stand", expr: "stern", talk: talk("G", f), ...fo }, t);
  const ranks = (x0: number, z0: number, nx: number, nz: number, dx: number, dz: number, red: boolean, fo: (i: number) => Partial<FrontOpts> = () => ({}), y = 0, base = 200) => {
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const i = a + b * nx, o = red ? RED(i) : BLUE(i);
      front(out, cam, base + i, o, (red ? "r" : "b") + (i % 4), x0 + a * dx + (hh(i, 3) - 0.5) * 0.25, y, z0 + b * dz, { mode: "stand", expr: "neutral", ...fo(i) }, t);
    }
  };
  const decks = (fo: (i: number) => Partial<FrontOpts> = () => ({})) => SHIPS.forEach((sp, k) => {
    const st = shipAt(k, f); if (!st.vis) return;
    for (let m = 0; m < 5; m++) front(out, cam, 400 + k * 10 + m, RED(m + k), "r" + ((m + k) % 4), sp[0] + st.dx - 8 + m * 3.2, DECK + 0.15 * Math.sin(t * 0.9 + k), sp[2] + 2.6, { mode: "stand", expr: "neutral", ...fo(m) }, t, 1, false);
  });
  switch (id) {
    case 1: {
      ranks(HOOK_US[0], HOOK_US[1], 4, 2, 1.0, -1.2, false, (i) => ({ expr: i % 3 ? "stern" : "neutral", look: 1 }));
      ranks(HOOK_UK[0], HOOK_UK[1], 4, 2, 1.0, -1.2, true, (i) => ({ expr: i % 2 ? "stern" : "neutral", look: -1 }), 0, 300);
      decks();
      pig(out, cam, f >= W.pig1 - 6 ? "up" : "munch", PIG[0], 0, PIG[2], (t * 2.5) % 1);
      gulls(out, t, 0, 9, -14);
      break;
    }
    case 2: { gulls(out, t, -4, 14, -30, 5, 14); if (f >= 162) gulls(out, t, 0, 9, FLAGS[0][2] - 4, 3, 5); break; }
    case 3: {
      const k = clamp01((f - 210) / 54);
      if (f < 268) {
        if (k < 1) walker(out, cam, 1, { ...CUTLAR, rifle: true }, "cuR", CABIN[0] + 3.2 + (CUT[0] - CABIN[0] - 3.2) * k, CABIN[2] + (CUT[2] - CABIN[2]) * k, 1, 0.2, q(((f - 210) / 20) % 1, 60), t, { expr: "smile_closed" });
        else cut({ expr: "smile_closed", talk: 0 }, { ...CUTLAR, rifle: true });
      }
      if (f >= 318) {
        const aim = f >= 326;
        cut({ expr: aim ? "squint" : "stern", prop: aim ? "aim" : null, talk: 0 }, aim ? CUTLAR : { ...CUTLAR, rifle: true });
        out.places[out.places.length - 1].mirror = true; // aims screen-right, at the pig
        if (f >= 330) pig(out, cam, f >= BANG + 3 ? "down" : "munch", PIG[0], 0, PIG[2], (t * 2.5) % 1);
        if (f >= 320 && f < 334) { const u = q(((f - 320) / 6) % 1, 6); out.fx.push({ key: `tw${u}`, cw: 200, ch: 200, draw: (p) => fxTwitch(p, u), x: CUT[0] + cam.right.x * 0.28, y: 1.72, z: CUT[2] + cam.right.z * 0.28 + 0.1, w: 0.32, h: 0.32 }); }
        if (f >= BANG && f < BANG + 6) { const u = (f - BANG) / 6; out.fx.push({ key: `muz${q(u, 12)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 12), "#fff3b0"), x: CUT[0] + cam.right.x * 0.72, y: 1.36, z: CUT[2] + cam.right.z * 0.72 + 0.15, w: 0.8, h: 0.8 }); }
        if (f >= BANG) { for (let k2 = 0; k2 < 3; k2++) { const u = clamp01((f - BANG - k2 * 2) / 24); out.fx.push({ key: `dust${q(u, 12)}`, cw: 300, ch: 300, draw: (p) => fxDust(p, q(u, 12)), x: CUT[0] + cam.right.x * (0.78 + 0.4 * u + k2 * 0.15), y: 1.35 + 0.3 * u + k2 * 0.05, z: CUT[2] + cam.right.z * (0.78 + 0.4 * u) + 0.1, w: 0.4 + 0.5 * u, h: 0.4 + 0.5 * u, soft: true }); } }
      }
      if (f < 318 && f >= 268 || f < 268) pig(out, cam, "munch", PIG[0], 0, PIG[2], (t * 2.5) % 1);
      gulls(out, t, -2, 10, -12, 3, 6);
      break;
    }
    case 4: {
      pig(out, cam, "down", PIG[0], 0, PIG[2]);
      if (f < 380) {
        cut({ expr: "smile_closed", prop: "rifle", talk: 0 });
        const k = clamp01((f - 350) / 32);
        if (k < 1) walker(out, cam, 2, GRIFF, "gr", 13 - (13 - GRIF[0]) * k, GRIF[2] - 3 + 3 * k, -0.97, 0.22, q(((f - 350) / 14) % 1, 60), t, { expr: "shock" }, true);
        else grif({ expr: "shock", talk: 0 });
        for (let k2 = 0; k2 < 2; k2++) { const u = q(((t * 0.6 + k2 * 0.5) % 1), 20); out.fx.push({ key: `dust${u}`, cw: 300, ch: 300, draw: (p) => fxDust(p, 0.4 + 0.6 * u), x: CUT[0] - 0.9, y: 1.4 + 1.2 * u, z: CUT[2], w: 0.5 + 0.6 * u, h: 0.5 + 0.6 * u, soft: true }); }
      } else if (f < 432) { cut({ expr: "stern", prop: f >= W.eating - 2 ? "point" : "rifle" }); grif({ expr: "shock", talk: 0 }); }
      else { grif({ expr: f >= W.out - 2 ? "stern" : "smile_closed", prop: f >= W.keep - 2 ? "point" : null }); cut({ expr: "meh", prop: "rifle", talk: 0 }); }
      break;
    }
    case 5: {
      pig(out, cam, "down", PIG[0], 0, PIG[2]);
      const bill = f >= W.ten - 2 && f < W.forA - 2;
      cut({ expr: f >= W.forA - 2 ? "shock" : f >= W.ten2 - 2 ? "smile_closed" : "neutral", prop: bill ? "bill" : f >= W.forA - 2 ? "shrug" : null, talk: f >= 542 ? talk("C", f) : 0 });
      grif({ expr: f >= W.this - 2 ? "pained" : f >= W.hundred - 2 ? "stern" : "meh", prop: f >= W.this - 2 ? "heart" : null, talk: f >= 592 ? talk("G", f) : 0 });
      if (f >= W.pig5 - 2 && f < W.pig5 + 14) { const u = (f - W.pig5 + 2) / 16; out.fx.push({ key: `spark${q(u, 20)}`, cw: 200, ch: 200, draw: (p) => fxSparkle(p, q(u, 20)), x: GRIF[0] + cam.right.x * 0.35, y: 1.62, z: GRIF[2] + 0.3, w: 0.25, h: 0.25 }); }
      break;
    }
    case 6: {
      if (f < 716) {
        pig(out, cam, "down", PIG[0], 0, PIG[2]);
        grif({ expr: "stern", prop: f >= W.arrest - 2 ? "point" : null, talk: 0 });
        cut({ expr: f >= W.arrest - 2 ? "meh" : "neutral", prop: f >= W.arrest - 2 ? "shrug" : null, talk: 0 });
      } else if (f < 773) { // sixty-four soldiers march in, Pickett in front
        for (let k = 0; k < 17; k++) {
          const row = k === 0 ? -1.4 : Math.floor((k - 1) / 4), col = k === 0 ? 1.5 : (k - 1) % 4;
          const x = AMCAMP[0] - 7 + (f - 716) / FPS * 1.4 - row * 1.4, z = AMCAMP[2] - 4 + col * 1.0;
          walker(out, cam, 200 + k, k ? BLUE(k) : PICKETT, k ? "bw" + (k % 4) : "pk", x, z, 1, 0, q(((f - 716) / 15 + (k ? 0 : 0.5)) % 1, 60), t, { expr: k ? "stern" : "grin" });
        }
      } else if (f < 818) { decks(); }
      else if (f < 880) {
        ranks(AMCAMP[0] - 18, REDOUBT_Z + 3, 12, 5, 2.2, 1.9, false, (i) => ({ expr: i % 4 ? "stern" : "neutral" }));
        front(out, cam, 199, PICKETT, "pk", AMCAMP[0] + 9, 0, REDOUBT_Z + 3, { mode: "stand", expr: "grin", prop: "point" }, t);
      } else decks();
      break;
    }
    case 7: {
      pig(out, cam, "down", PIG[0], 0, PIG[2]);
      cut({ expr: "dazed", look: -1, talk: f < 1000 ? talk("C", f) : 0 });
      grif({ expr: "pained", prop: "heart", talk: f >= 1000 ? talk("G", f) : 0 });
      if (f >= W.good - 2 && f < W.good + 16) { const u = (f - W.good + 2) / 18; out.fx.push({ key: `spark${q(u, 20)}`, cw: 200, ch: 200, draw: (p) => fxSparkle(p, q(u, 20)), x: GRIF[0] + cam.right.x * 0.3, y: 1.6, z: GRIF[2] + 0.3, w: 0.22, h: 0.22 }); }
      decks();
      break;
    }
    case 8: {
      if (f < 1103) {
        front(out, cam, 50, GOVERNOR, "gov", GOV[0], 0.45, GOV[2], { mode: "stand", expr: f >= W.land - 2 ? "shock" : "stern", prop: "point" }, t);
        decks();
      } else if (f < 1140) {
        const sh = shipAt(FLAGSHIP, f);
        const ap: V3 = [ADMIRAL[0] + sh.dx, DECK + 0.15 * Math.sin(t * 0.9 + FLAGSHIP), ADMIRAL[2]];
        const scope = f < W.refused - 6;
        front(out, cam, 51, ADM_O, "adm", ap[0], ap[1], ap[2], { mode: "stand", expr: scope ? "squint" : "meh", prop: scope ? "telescope" : null, look: scope ? 0 : 1 }, t, 1, false);
        for (let m = 0; m < 3; m++) front(out, cam, 410 + m, RED(m), "r" + m, ap[0] - 3 - m * 2.4, ap[1], ap[2] - 1.8 - (m % 2) * 1.2, { mode: "stand", expr: "neutral" }, t, 1, false);
      } else {
        pig(out, cam, "down", PIG[0], 0, PIG[2]);
        const beat = Math.floor((f - 1140) / 9) % 2;
        cut({ expr: beat ? "stern" : "shock", prop: "point", talk: beat ? 0.8 : 0.3 }, CUTLAR, [-0.55, 0, 3.0]);
        grif({ expr: beat ? "shock" : "stern", prop: "point", talk: beat ? 0.3 : 0.8 }, [0.55, 0, 3.2]);
      }
      break;
    }
    case 9: {
      const [fx, , fz] = FACEOFF;
      if (f < 1256) {
        const glance = f >= W.fired - 2;
        front(out, cam, 60, BLUE(1), "b1", fx - 0.75, 0, fz, { mode: "stand", expr: glance ? "meh" : "stern", look: glance ? 1 : 0 }, t);
        front(out, cam, 61, RED(2), "r2", fx + 0.75, 0, fz, { mode: "stand", expr: glance ? "meh" : "stern", look: glance ? -1 : 0 }, t);
      } else {
        const yawn = f >= W.home - 4 && f < W.home + 24;
        front(out, cam, 60, { ...BLUE(1), rifle: false }, "b1n", fx - 0.7, 0, fz, { mode: "sit", expr: yawn ? "gasp" : "dazed" }, t);
        front(out, cam, 61, { ...RED(2), rifle: false }, "r2n", fx + 0.7, 0, fz, { mode: "sit", expr: "meh", look: -1 }, t);
      }
      gulls(out, t, fx, 8, fz - 8, 3, 6);
      break;
    }
    case 10: {
      if (f < 1394) { // camp life: sitting, strolling, a card game
        for (let k = 0; k < 8; k++) front(out, cam, 220 + k, { ...BLUE(k), rifle: false }, "bn" + (k % 4), AMCAMP[0] - 6 + (k % 4) * 1.4, 0, AMCAMP[2] + 2 + Math.floor(k / 4) * 1.6, { mode: k % 3 ? "sit" : "stand", expr: k % 2 ? "smile" : "dazed" }, t);
        for (let k = 0; k < 3; k++) { const u = ((t * 0.12 + k * 0.33) % 1); walker(out, cam, 230 + k, { ...BLUE(k + 4), rifle: false }, "bw" + k, AMCAMP[0] - 12 + 20 * u, AMCAMP[2] + 9.5 + k * 0.8, 1, 0, q((t * 1.6 + k * 0.3) % 1, 60), t, { expr: "neutral" }); }
      } else {
        const [px, , pz] = PARTY;
        // bluecoats + redcoats around the table
        for (let k = 0; k < 6; k++) front(out, cam, 240 + k, { ...BLUE(k), rifle: false }, "bp" + (k % 4), px - 3 + k * 1.2, 0, pz - 1.3, { mode: "stand", expr: f >= 1453 ? "laugh" : "grin", prop: f >= W.toasted - 2 ? "mug" : null }, t);
        if (f < 1453) {
          for (let k = 0; k < 6; k++) { const kk = clamp01((f - 1394) / 50); walker(out, cam, 250 + k, { ...RED(k), rifle: false }, "rw" + (k % 4), px + 2.5 - 5 * kk + (k % 3) * 1.1, pz + 1.9 + Math.floor(k / 3) * 1.0, -1, 0, q(((f - 1394) / 16) % 1, 60), t, { expr: "grin" }); }
        } else if (f < 1566) for (let k = 0; k < 6; k++) front(out, cam, 250 + k, { ...RED(k), rifle: false }, "rp" + (k % 4), px - 2.5 + k * 1.1, 0, pz + 1.4, { mode: "stand", expr: "laugh", prop: "mug" }, t);
        if (f < 1510) {
          firework(out, f, 1400, px - 4, 7, pz - 16, "#f2c230", 8); firework(out, f, 1412, px + 1, 8.5, pz - 18, "#e2453c", 8); firework(out, f, 1424, px - 2, 6.5, pz - 15, "#9fd4ff", 5);
          firework(out, f, 1436, px + 3, 8, pz - 16, "#ffffff", 8); firework(out, f, 1460, px + 5, 7, pz - 14, "#e2453c", 8); firework(out, f, 1478, px + 2, 8, pz - 16, "#f2c230", 8); firework(out, f, 1494, px + 6, 6.5, pz - 14, "#3f6fb5", 8);
        }
        if (f >= 1510 && f < 1566) {
          cut({ expr: "laugh", prop: "mug" }, CUTLAR, CP);
          for (let k = 0; k < 3; k++) { const u = ((f - 1510) / 40 + k * 0.33) % 1; out.fx.push({ key: `conf${k}`, cw: 300, ch: 300, draw: (p) => fxConfetti(p, k), x: CP[0] + (k - 1) * 0.6, y: 2.6 - 1.6 * u, z: CP[2] + 0.5, w: 0.8, h: 0.8, rot: u * 2 + k }); }
        }
        if (f >= 1566) grif({ expr: f >= W.fromUs - 2 ? "meh" : "smile", prop: "flaglet" }, GP);
      }
      break;
    }
    case 11: {
      if (f < 1756) {
        const k = f < W.decided - 8 ? 0 : clamp01((f - (W.decided - 8)) / 6);
        front(out, cam, 70, KAISER, "kz", KROOM[0], 0, KROOM[2] - 0.3, { mode: "stand", expr: f >= W.decided ? "grin" : "stern", prop: ["stamp", k] }, t, 1, false);
        if (f >= W.decided && f < W.decided + 6) { const u = (f - W.decided) / 6; out.fx.push({ key: `burst${q(u, 12)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 12), "#ffffff"), x: KROOM[0] + 0.55, y: 0.95, z: KROOM[2] + 0.8, w: 0.9, h: 0.9 }); }
      } else if (f < 1795) {
        cut({ expr: "laugh", wave: Math.sin(t * 14) * 0.5 + 0.5, talk: 0 });
        for (let k = 0; k < 4; k++) { const u = ((f - 1756) / 30 + k * 0.25) % 1; out.fx.push({ key: `conf${k}`, cw: 300, ch: 300, draw: (p) => fxConfetti(p, k), x: CUT[0] + (k - 1.5) * 0.8, y: 3.4 - 2.4 * u, z: CUT[2] + 0.4, w: 1.0, h: 1.0, rot: u * 2 + k }); }
      } else grif({ expr: f >= W.aboutMy - 2 ? "pained" : f >= W.decided2 - 2 ? "stern" : "dazed" });
      break;
    }
    case 12: {
      if (f < 1988) {
        front(out, cam, 80, { ...BLUE(1), rifle: false }, "b1n", GRAVE[0] - 0.85, 0, GRAVE[2] + 0.9, { mode: "stand", expr: "relief", prop: "heart" }, t);
        front(out, cam, 81, { ...RED(2), rifle: false }, "r2n", GRAVE[0] + 0.85, 0, GRAVE[2] + 0.9, { mode: "stand", expr: "relief", prop: "heart" }, t);
        pig(out, cam, "ghost", GRAVE[0], 1.2 + 0.12 * Math.sin(t * 3), GRAVE[2] - 0.3, 0, 0.75, false);
      } else if (f < 2110) {
        const pull = f >= 2000 && f < 2080;
        front(out, cam, 90, RANGER, "rg", POLE[0] + 0.55, 0, POLE[2] + 0.5, { mode: "stand", expr: "smile", prop: pull ? (Math.floor(f / 8) % 2 ? "point" : "thumbs") : null }, t);
        TOURISTS.forEach((o, k) => front(out, cam, 91 + k, o, "tu" + k, POLE[0] + 2.4 + k * 1.1, 0, POLE[2] + 2.6 + (k % 2) * 0.7, { mode: "stand", expr: k === 1 ? "smile" : "grin", prop: k === 0 ? "phone" : null }, t));
        gulls(out, t, POLE[0] - 3, 15, POLE[2] - 6, 3, 6);
      } else cut({ expr: "meh", look: 1 }, OLDCUT);
      break;
    }
  }
  return out;
};
export { FPS };
