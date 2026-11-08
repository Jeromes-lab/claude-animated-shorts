// Timeline of "Twenty Sticks" (the 1970 Oregon exploding whale): shots timed to the three voices
// (~/whale-short/voice/words.json, frames at 30 fps), story state (blast, blubber flight, car crush) and the camera
// grammar of the bridge short: cuts on big reframes, smootherstep glides, creeping holds, flip kicks on impacts.
export const FPS = 30;
export const TOTAL = 1955;
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};
export const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------- the beach ----------------
// Sea to -z (shore at z = -24), sand 0, the whale at the origin along x (head toward +x), the crowd behind a rope at
// z 27-33, the plunger at (10, 0, 22), the parking lot at z ~ 50 (Walter's Oldsmobile at x 6), dunes beyond z 60.
export const WHALE = { len: 14, x0: -7, x1: 7 };
export const SHORE = -24;
export const ROPE_Z = 26;
export const PLUNGER: V3 = [10.2, 0, 21.6];
export const THORNTON: V3 = [11.3, 0, 21.2];
export const WALTER_AT: V3 = [9.0, 0, 21.8];   // where Walter stops to talk
export const OLDS: V3 = [6, 0, 50];           // Walter's brand new car
export const TVCAM: V3 = [-5.5, 0, 25];
export const CRATES: V3 = [1.5, 0, 3.6];
export const PARKED: [number, string][] = [[-17, "#a9442f"], [-11.5, "#3f6fb5"], [-6, "#d9a441"], [0, "#5d7a3a"], [OLDS[0], "#7ec4b0"], [12, "#e6e2dc"], [17.5, "#8c3b4a"]];

// ---------------- word cues (frames) ----------------
export const W = {
  way: 90, half: 111, dynamite: 130, sperm: 185, smells: 248, think: 278, highway: 325, engineer: 359, thornton: 381,
  easy: 416, blow: 461, pieces: 484, seagulls: 508, walter: 573, strolls: 583, trained: 629, explosives: 642,
  how: 682, twentyCases: 732, need: 778, sticks: 795, sir: 825, engineer2: 850, walks: 894, olds: 929, bought: 972, called: 1024,
  whaleDeal: 1051, crowd: 1093, cameras: 1142, plunger: 1210, good: 1271, gone: 1309, bad: 1332, everywhere: 1364,
  blubber: 1389, beach: 1418, crowd2: 1436, parking: 1458, chunk: 1505, car: 1558, twenty: 1595, sticks2: 1639,
  most: 1696, still: 1738, success: 1800, promoted: 1879, nailed: 1906,
};
export const BOOM = 1226;          // the plunger goes down (end of "plunger" + a beat)
export const CRUSH = 1556;         // the giant chunk hits the Oldsmobile (lands 0-3 f before "car")

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 158, light: "day", sunAz: 130, sunEl: 35 },   // hook: whale on the beach, the dynamite
  { id: 2, a: 158, b: 296, light: "day" },                        // 45 ft, the smell
  { id: 3, a: 296, b: 414, light: "day" },                        // highway department, Thornton
  { id: 4, a: 414, b: 548, light: "day" },                        // "Easy. ... seagulls"
  { id: 5, a: 548, b: 678, light: "day" },                        // Walter strolls over
  { id: 6, a: 678, b: 878, light: "day" },                        // the argument
  { id: 7, a: 878, b: 1085, light: "day" },                       // the Oldsmobile, Whale of a Deal
  { id: 8, a: 1085, b: 1268, light: "day", sunAz: 120, sunEl: 35 }, // crowd, cameras, plunger, BOOM
  { id: 9, a: 1268, b: 1384, light: "day" },                      // good news / bad news
  { id: 10, a: 1384, b: 1482, light: "day" },                     // beach, crowd, parking lot
  { id: 11, a: 1482, b: 1590, light: "day" },                     // the giant chunk on Walter's car
  { id: 12, a: 1590, b: 1675, light: "day" },                     // "Twenty. Sticks."
  { id: 13, a: 1675, b: 1774, light: "day", sunAz: 130, sunEl: 35 }, // most of the whale: still there
  { id: 14, a: 1774, b: TOTAL, light: "day" },                    // success, promoted, "Nailed it."
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 158;
export const BOOM_FLASH: [number, number[]] = [BOOM, [1, 0.9, 0.7, 0.45, 0.25, 0.1]];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- blast physics ----------------
const G = 9.8;
export type Chunk = { p0: V3; land: V3; t0: number; t1: number; size: number; seed: number };
/** every flying piece of whale: launched at BOOM from the whale, landing at `land` at frame t1 */
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (let i = 0; i < 90; i++) {
    const zone = i % 3; // 0 beach, 1 crowd, 2 parking lot
    const x = (hh(i, 1) - 0.5) * (zone === 2 ? 46 : 36), z = zone === 0 ? -14 + hh(i, 2) * 36 : zone === 1 ? 26 + hh(i, 2) * 9 : 43 + hh(i, 2) * 14;
    const t1 = (zone === 0 ? 1350 : zone === 1 ? 1405 : 1440) + hh(i, 3) * 70;
    out.push({ p0: [(hh(i, 4) - 0.5) * 6, 1.5, (hh(i, 5) - 0.5) * 2], land: [x, 0, z], t0: BOOM, t1, size: 0.25 + 0.55 * hh(i, 6) ** 2, seed: i });
  }
  return out;
})();
/** the giant chunk: onto the Oldsmobile's roof */
export const GIANT: Chunk = { p0: [0.5, 2, 0], land: [OLDS[0] + 0.2, 1.35, OLDS[2]], t0: BOOM, t1: CRUSH, size: 1.25, seed: 999 };
/** position of a chunk at frame f (null before launch); after landing it rests at `land` */
export const chunkAt = (c: Chunk, f: number): { p: V3; landed: boolean; spin: number } | null => {
  if (f < c.t0) return null;
  const T = (c.t1 - c.t0) / FPS, t = Math.min((f - c.t0) / FPS, T);
  const vx = (c.land[0] - c.p0[0]) / T, vz = (c.land[2] - c.p0[2]) / T, vy = (c.land[1] - c.p0[1]) / T + 0.5 * G * T;
  return { p: [c.p0[0] + vx * t, c.p0[1] + vy * t - 0.5 * G * t * t, c.p0[2] + vz * t], landed: f >= c.t1, spin: t * (2 + 3 * hh(c.seed, 7)) };
};
/** 0 = intact whale .. 1 = blown (crater + scorch) */
export const blownAt = (f: number) => (f < BOOM ? 0 : 1);
/** the Oldsmobile's roof: 0 shiny .. 1 flattened */
export const crushAt = (f: number) => (f < CRUSH ? 0 : Math.min(1, (f - CRUSH + 1) / 3));

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

const TH: V3 = [THORNTON[0], 1.62, THORNTON[2]], WA: V3 = [WALTER_AT[0], 1.58, WALTER_AT[2]];
// 1 hook: low across the sand to the whale, the crowd and cars behind; cut to the dynamite stack on "half a ton"
const S1a = (f: number) => zoom([17, 5.5, 26], [0, 1.0, -2], 40, pushK(f, 0, 0.0022), { roll: -0.03 });
const S1b = (f: number) => dolly([CRATES[0] + 2.4, 1.2, CRATES[2] + 3.4], [CRATES[0], 0.7, CRATES[2]], pushK(f, 104, 0.002, 0.007, 34), { fov: 42, roll: 0.04 });
// 2 the whale, then the smell (crowd pinching noses)
const S2a = (f: number) => dolly([9, 1.2, 9], [0, 1.5, 0], pushK(f, 158, 0.0022), { fov: 46 });
const S2b = (f: number) => dolly([1.5, 1.55, 23.5], [0.5, 1.5, 29], pushK(f, 244, 0.0025, 0.006, 28), { fov: 42, roll: -0.03 });
// 3 Thornton arrives with the highway truck behind him
const S3a = (f: number) => dolly([18, 2.2, 13], [13.5, 1.4, 22], pushK(f, 296, 0.002), { fov: 44 });
const S3b = (f: number) => dolly([TH[0] - 1.4, 1.55, TH[2] - 3.4], TH, pushK(f, 356, 0.0025, 0.006, 30), { fov: 38, roll: 0.03 });
// 4 Thornton talks; seagulls over the whale
const S4a = (f: number) => dolly([TH[0] - 1.1, 1.6, TH[2] - 2.8], TH, pushK(f, 414, 0.0022), { fov: 36 });
const S4b = (f: number) => zoom([4, 0.6, 9], [0, 8, -2], 56, pushK(f, 504, 0.002), { roll: -0.04 });
// 5 Walter strolls over from the crowd; then MS of him
const S5a = (f: number) => dolly([10.5, 1.8, 15], [8.5, 1.3, 24], pushK(f, 548, 0.0018), { fov: 46 });
const S5b = (f: number) => dolly([WA[0] + 0.7, 1.5, WA[2] - 2.6], WA, pushK(f, 622, 0.0025, 0.006, 30), { fov: 36, roll: -0.03 });
// 6 the argument: two-shot, then singles on each line
const TWO: V3 = [(TH[0] + WA[0]) / 2, 1.55, (TH[2] + WA[2]) / 2];
const S6two = (f: number) => dolly([TWO[0] + 0.6, 1.55, TWO[2] + 6.8], [TWO[0], 1.3, TWO[2]], pushK(f, 852, 0.0022), { fov: 50 });
const S6t = (f0: number) => (f: number) => dolly([TH[0] + 1.0, 1.45, TH[2] - 2.0], [TH[0], 1.45, TH[2]], pushK(f, f0, 0.0025, 0.006, 26), { fov: 36, roll: 0.035 });
const S6w = (f0: number) => (f: number) => dolly([WA[0] + 0.6, 1.55, WA[2] - 2.3], WA, pushK(f, f0, 0.0025, 0.006, 26), { fov: 36, roll: -0.035 });
// 7 Walter back at his brand new car; "Whale of a Deal" punch on the car
const S7a = (f: number) => dolly([OLDS[0] - 8, 1.7, OLDS[2] - 7], [OLDS[0], 1.0, OLDS[2]], pushK(f, 878, 0.0018), { fov: 42 });
const S7b = (f: number) => dolly([OLDS[0] + 3.4, 0.9, OLDS[2] - 3.6], [OLDS[0] + 0.6, 0.85, OLDS[2]], pushK(f, 1040, 0.002, 0.008, 30), { fov: 40, roll: 0.05 });
// 8 the crowd gathers, the TV camera rolls, the plunger; then the wide for the BOOM
const S8a = (f: number) => dolly([-2, 1.7, 18], [0, 1.5, 30], pushK(f, 1085, 0.0018), { fov: 48 });
const S8b = (f: number) => dolly([TVCAM[0] + 1.6, 1.5, TVCAM[2] - 1.8], [TVCAM[0], 1.3, TVCAM[2]], pushK(f, 1136, 0.003), { fov: 38 });
const S8c = (f: number) => dolly([PLUNGER[0] - 0.9, 1.3, PLUNGER[2] - 2.6], [PLUNGER[0] + 0.05, 1.05, PLUNGER[2] + 0.35], pushK(f, 1183, 0.003, 0.008, 30), { fov: 40, roll: 0.04 });
const S8d = (f: number) => zoom([2, 2.2, 42], [0, 7, 0], 52, pushK(f, 1222, 0.0015));
// 9 good news (smoke clearing), bad news (the sky full of whale)
const S9a = (f: number) => zoom([3, 2.0, 40], [0, 6, 0], 50, pushK(f, 1268, 0.0015));
const S9b = (f: number) => zoom([2, 1.4, 34], [0, 16, 8], 64, pushK(f, 1328, 0.002, 0.006, 30), { roll: 0.05 });
// 10 rain on the beach, the crowd running, the parking lot
const S10a = (f: number) => dolly([-6, 1.2, 8], [-2, 0.6, 14], pushK(f, 1384, 0.0025), { fov: 46 });
const S10b = (f: number) => dolly([0.5, 1.5, 47], [0, 1.5, 30], pushK(f, 1428, 0.0025), { fov: 40, roll: -0.04 });
const S10c = (f: number) => dolly([-4, 2.4, 40], [-2, 0.8, 50], pushK(f, 1452, 0.0025), { fov: 48 });
// 11 Walter by his car looks up; the giant chunk; crunch
const S11a = (f: number) => zoom([OLDS[0] - 9, 1.3, OLDS[2] - 6.5], [OLDS[0], 3.2, OLDS[2]], 52, pushK(f, 1482, 0.002), { roll: 0.03 });
const S11b = (f: number) => dolly([OLDS[0] - 2.7, 1.7, OLDS[2] - 6.4], [OLDS[0] - 1.7, 1.05, OLDS[2] - 0.9], pushK(f, 1540, 0.0015), { fov: 52 });
// 12 Walter, goo on his head: "Twenty. Sticks."
const WC: V3 = [OLDS[0] - 2.4, 1.6, OLDS[2] - 1.6];
const S12a = (f: number) => dolly([WC[0] + 0.5, 1.55, WC[2] - 2.2], WC, pushK(f, 1590, 0.0025, 0.007, 26), { fov: 36 });
const S12b = (f: number) => dolly([WC[0] + 0.3, 1.6, WC[2] - 1.5], WC, pushK(f, 1636, 0.003, 0.008, 26), { fov: 34, roll: 0.04 });
// 13 the whale, still mostly there; the crew staring
const S13a = (f: number) => zoom([-8, 2.2, 13], [0, 1.4, 0], 46, pushK(f, 1675, 0.002));
const S13b = (f: number) => dolly([6, 1.3, 7], [0.5, 1.2, 0.5], pushK(f, 1735, 0.003, 0.008, 28), { fov: 40, roll: -0.04 });
// 14 Thornton, blubbered, proud; promoted (gold badge + confetti); "Nailed it."
const TH2: V3 = [3.5, 1.62, 6.5];
const S14a = (f: number) => dolly([TH2[0] - 0.8, 1.6, TH2[2] + 2.8], TH2, pushK(f, 1774, 0.0022), { fov: 38 });
const S14b = (f: number) => dolly([TH2[0] - 0.5, 1.5, TH2[2] + 2.6], [TH2[0], 1.42, TH2[2]], pushK(f, 1836, 0.0025, 0.006, 30), { fov: 40, roll: 0.04 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 104, cut: true, s: S1b }],
  2: [{ f: 158, s: S2a }, { f: 244, cut: true, s: S2b }],
  3: [{ f: 296, s: S3a }, { f: 356, cut: true, s: S3b }],
  4: [{ f: 414, s: S4a }, { f: 504, cut: true, s: S4b }],
  5: [{ f: 548, s: S5a }, { f: 622, cut: true, s: S5b }],
  6: [{ f: 678, s: S6w(678) }, { f: 729, cut: true, s: S6t(729) }, { f: 770, cut: true, s: S6w(770) }, { f: 821, cut: true, s: S6t(821) }, { f: 852, cut: true, s: S6two }],
  7: [{ f: 878, s: S7a }, { f: 1040, cut: true, s: S7b }],
  8: [{ f: 1085, s: S8a }, { f: 1136, cut: true, s: S8b }, { f: 1183, cut: true, s: S8c }, { f: 1222, cut: true, s: S8d }],
  9: [{ f: 1268, s: S9a }, { f: 1328, cut: true, s: S9b }],
  10: [{ f: 1384, s: S10a }, { f: 1428, cut: true, s: S10b }, { f: 1452, cut: true, s: S10c }],
  11: [{ f: 1482, s: S11a }, { f: 1540, cut: true, s: S11b }],
  12: [{ f: 1590, s: S12a }, { f: 1636, cut: true, s: rolled(S12b, 0.04) }],
  13: [{ f: 1675, s: S13a }, { f: 1735, cut: true, s: S13b }],
  14: [{ f: 1774, s: S14a }, { f: 1836, cut: true, s: S14b }],
};

const KICKS: [number, number][] = [[BOOM / FPS, 2.4], [(BOOM + 8) / FPS, 1.2], [CRUSH / FPS, 2.0], [W.half / FPS, 0.5], [W.whaleDeal / FPS, 0.6],
  [1395 / FPS, 0.5], [1440 / FPS, 0.5], [1464 / FPS, 0.6], [W.sticks2 / FPS, 0.6], [W.nailed / FPS, 0.5]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, { f: 104, cInf: 13 }, { f: 158, cInf: 0 }, { f: 244, cInf: 11 }, { f: 296, cInf: 6 },
  { f: 356, cInf: 12, focus: () => TH }, { f: 414, cInf: 13, focus: () => TH }, { f: 504, cInf: 0 }, { f: 548, cInf: 6 },
  { f: 622, cInf: 12, focus: () => WA }, { f: 678, cInf: 13, focus: () => WA }, { f: 729, cInf: 13, focus: () => TH },
  { f: 770, cInf: 13, focus: () => WA }, { f: 821, cInf: 13, focus: () => TH }, { f: 852, cInf: 8, focus: () => TWO },
  { f: 878, cInf: 6, focus: () => [OLDS[0], 1, OLDS[2]] }, { f: 1040, cInf: 12 }, { f: 1085, cInf: 7 }, { f: 1136, cInf: 12 },
  { f: 1183, cInf: 13 }, { f: 1222, cInf: 0 }, { f: 1384, cInf: 8 }, { f: 1428, cInf: 6 }, { f: 1452, cInf: 6 }, { f: 1482, cInf: 0 },
  { f: 1590, cInf: 13, focus: () => WC }, { f: 1675, cInf: 0 }, { f: 1735, cInf: 9 }, { f: 1774, cInf: 12, focus: () => TH2 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
export { TH, WA, TH2, WC };
export type Melt = { mirror: number; badge: number; side: number; roof: number };
