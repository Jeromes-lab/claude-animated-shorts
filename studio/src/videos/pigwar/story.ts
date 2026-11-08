// Timeline of "One Pig" (the 1859 Pig War on San Juan Island): shots timed to the three voices
// (~/pigwar-short/voice/words.json, frames at 30 fps), story state (the shot, the ships sailing in, the flag going up)
// and the camera grammar of the bridge short: cuts on big reframes, smootherstep glides, creeping holds, flip kicks.
export const FPS = 30;
export const TOTAL = 2190;
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

// ---------------- San Juan Island ----------------
// Land at z > SHORE, Griffin Bay (the sea) toward -z. Cutlar's potato patch at the origin (rows along x), his log
// cabin to the west, the Hudson's Bay farm to the east, American Camp further west, the warships out in the bay,
// a party meadow to the north-east, English Camp's blockhouse + flagpole on the eastern shore, and the Kaiser's
// study as a separate little set far to the north.
export const SHORE = -28;
export const PATCH = { x0: -5, x1: 5, z0: -4, z1: 4 };
export const PIG: V3 = [0.1, 0, 0.9];
export const CUT: V3 = [-1.15, 0, 3.0];
export const GRIF: V3 = [1.15, 0, 3.2];
export const CABIN: V3 = [-11, 0, 1];
export const HBC: V3 = [17, 0, -5];
export const FLAGS: [V3, V3] = [[-1.0, 0, -7.5], [1.0, 0, -7.5]]; // US, UK: shoulder to shoulder
export const AMCAMP: V3 = [-32, 0, 8];
export const REDOUBT_Z = -4;
export const SHIPS: V3[] = [[-30, 0, -78], [6, 0, -92], [42, 0, -80], [-62, 0, -118], [30, 0, -128]];
export const SHIP_IN = [773, 776, 779, 884, 890];  // when each ship has sailed in (frame)
export const FLAGSHIP = 1;
export const DECK = 4.2;
export const ADMIRAL: V3 = [SHIPS[1][0] - 7, DECK, SHIPS[1][2] + 1.2];
export const GOV: V3 = [16, 0, -24];
export const FACEOFF: V3 = [-14, 0, -12];
export const PARTY: V3 = [32, 0, 20];
export const BLOCK: V3 = [62, 0, -14];
export const POLE: V3 = [57, 0, -9];
export const POLE_H = 13;
export const GRAVE: V3 = [3.2, 0, -5.6];
export const KROOM: V3 = [0, 0, 420];
export const MTN: V3 = [-260, 0, -820];

// ---------------- word cues (frames) ----------------
export const W = {
  war: 78, over: 92, pig1: 106, san: 128, both: 164, theirs: 192, morning: 217, found: 270, british: 278, pig2: 286, potatoes: 299,
  again: 320, so: 353, shot: 363, your: 383, eating: 401, then: 435, keep: 441, out: 466, pig3: 478,
  offered: 511, ten: 520, ten2: 544, generous: 574, hundred: 594, forA: 617, pig4: 627, this: 645, pig5: 651,
  arrest: 696, america: 719, sixty: 738, soldiers: 752, britain: 775, three: 790, warships: 797, america2: 821, fourHundred: 839, men: 867,
  britain2: 882, five: 896, twoThousand: 921, all: 952, onePig: 983, very: 1014, good: 1022, governor: 1054, land: 1085, admiral: 1108,
  refused: 1120, noWar: 1143, squabble: 1164, pig6: 1182, luckily: 1204, fired: 1231, unluckily: 1258, home: 1292,
  both2: 1315, camped: 1332, twelve: 1370, british2: 1399, fourth: 1426, americans: 1458, toasted: 1473, queens: 1485,
  happy: 1512, majesty: 1546, happy2: 1570, independence: 1587, fromUs: 1635, kaiser: 1716, decided: 1737, america3: 1758,
  german: 1802, decided2: 1838, aboutMy: 1882, myPig: 1896, total: 1919, casualties: 1927, onePig2: 1966, today: 1991, rangers: 2025,
  raise: 2044, flag: 2062, every: 2084, still: 2114, paying: 2134, hundred2: 2146,
};
export const BANG = 334;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 124, light: "day", sunAz: 110 },   // hook: the stand-off, then the pig
  { id: 2, a: 124, b: 207, light: "day" },             // the island; two flags
  { id: 3, a: 207, b: 350, light: "day" },             // the farm, the pig in the potatoes, "Again." BANG
  { id: 4, a: 350, b: 490, light: "day" },             // so he shot it; the two farmers
  { id: 5, a: 490, b: 665, light: "day" },             // ten dollars / a hundred
  { id: 6, a: 665, b: 948, light: "day", sunAz: 100 }, // escalation montage
  { id: 7, a: 948, b: 1045, light: "day" },            // all this for one pig
  { id: 8, a: 1045, b: 1200, light: "day" },           // governor, admiral, telescope
  { id: 9, a: 1200, b: 1310, light: "day" },           // nobody fired; nobody went home
  { id: 10, a: 1310, b: 1662, light: "day" },          // twelve years of parties
  { id: 11, a: 1662, b: 1915, light: "day" },          // the Kaiser decides; Griffin
  { id: 12, a: 1915, b: TOTAL, light: "day" },         // one pig; the flag; still not paying
];
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 124;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- story state ----------------
/** ship i: x offset while sailing in (0 once arrived), visible? */
export const shipAt = (i: number, f: number) => {
  const t1 = SHIP_IN[i], u = clamp01((f - (t1 - 30)) / 30);
  const vis = i < 3 ? f >= 700 || f < 207 : f >= t1 - 30 || f < 207;
  return { vis, dx: (1 - smooth(u)) * (i % 2 ? 26 : -26) * (f < 207 ? 0 : 1) };
};
/** the Union Jack at English Camp: 0 at the bottom .. 1 at the top */
export const flagUp = (f: number) => smooth((f - 2000) / 80);
/** telescope view (circular mask) */
export const SCOPE: [number, number] = [1140, 1200];
/** the pig is alive until the shot */
export const pigAlive = (f: number) => f < BANG;

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
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** medium close-up on someone standing at p (eyes ~1.55 m), camera in front of them (from +z) and off to one side */
const mcu = (p: V3, f0: number, side = 0.6, dist = 2.3, roll = 0, punch = 0.006, fov = 36, h = 1.55, lx = 0) => (f: number) =>
  dolly([p[0] + side + lx, h - 0.05, p[2] + dist], [p[0] + lx, h - 0.1, p[2]], pushK(f, f0, 0.0025, punch, 26), { fov, roll });

const CH: V3 = [CUT[0], 1.5, CUT[2]], GH: V3 = [GRIF[0], 1.5, GRIF[2]];
const PH: V3 = [PIG[0], 0.35, PIG[2]];
// 1 hook: high wide over the field, the redoubt and the bay full of ships; snap to the pig on "Over one pig"
const S1a = (f: number) => zoom([0.5, 2.1, 7.2], [0.2, 1.4, -10], 52, pushK(f, 0, 0.0022), { roll: -0.03 });
export const HOOK_US: [number, number] = [-5.4, -9], HOOK_UK: [number, number] = [1.8, -9.6];
const S1b = (f: number) => dolly([PIG[0] + 1.4, 0.45, PIG[2] + 2.1], [PIG[0] + 0.3, 0.42, PIG[2]], pushK(f, 92, 0.003, 0.009, 26), { fov: 38, roll: 0.04 });
// 2 the island from the bay, gliding in; two flags shoulder to shoulder
const S2a = (f: number) => dolly([30, 34, -150], [-10, 0, 0], pushK(f, 124, 0.0035), { fov: 50 });
const S2b = (f: number) => zoom([0.6, 0.5, FLAGS[0][2] + 6.5], [0, 5.2, FLAGS[0][2]], 44, pushK(f, 162, 0.0025, 0.006, 28), { roll: 0.04 });
// 3 morning at the farm; the pig in the potatoes; Cutlar's eye twitch + BANG
const S3a = (f: number) => dolly([6, 2.6, 13], [-4, 1.0, 0], pushK(f, 207, 0.002), { fov: 46 });
const S3b = (f: number) => dolly([PIG[0] + 1.2, 0.55, PIG[2] + 2.4], [PIG[0] + 0.4, 0.4, PIG[2]], pushK(f, 268, 0.0028), { fov: 40, roll: -0.03 });
const S3c = (f: number) => dolly([CUT[0] + 0.4, 1.5, CUT[2] + 1.7], [CUT[0], 1.45, CUT[2]], pushK(f, 318, 0.003, 0.012, 16), { fov: 34, roll: 0.05 });
const S3d = (f: number) => dolly([CUT[0] + 0.3, 1.4, CUT[2] + 4.8], [CUT[0] + 0.65, 0.95, CUT[2] - 1.0], pushK(f, 330, 0.002), { fov: 44, roll: -0.04 });
// 4 the pig down, Cutlar with the smoking rifle, Griffin running in; then the two of them
const S4a = (f: number) => dolly([0.2, 2.3, 12.5], [0.1, 0.9, 1.8], pushK(f, 350, 0.0022), { fov: 46 });
const S4b = mcu(CUT, 380, -0.5, 2.3, -0.035);
const S4c = mcu(GRIF, 432, 0.6, 2.3, 0.035);
// 5 money: two-shot over the pig, then singles
const TWO: V3 = [(CUT[0] + GRIF[0]) / 2, 1.3, (CUT[2] + GRIF[2]) / 2];
const S5a = (f: number) => dolly([TWO[0] - 0.3, 1.45, TWO[2] + 6.6], [TWO[0], 1.15, TWO[2] - 0.4], pushK(f, 490, 0.0022), { fov: 48 });
const S5b = mcu(CUT, 542, -0.5, 2.2, -0.035);
const S5c = mcu(GRIF, 592, 0.5, 2.1, 0.04, 0.01);
const S5d = mcu(CUT, 615, -0.4, 1.9, -0.05, 0.012);
const S5e = mcu(GRIF, 638, 0.5, 2.0, 0.04);
// 6 escalation: arrest threat; 64 soldiers march in; 3 ships; 461 men + cannons; 5 ships
const S6a = (f: number) => dolly([TWO[0] + 0.5, 1.5, TWO[2] + 6.4], [TWO[0], 1.25, TWO[2]], pushK(f, 665, 0.0025), { fov: 46 });
const S6b = (f: number) => dolly([AMCAMP[0] + 1, 1.6, AMCAMP[2] + 5], [AMCAMP[0] - 7, 1.1, AMCAMP[2] - 2.5], pushK(f, 716, 0.002), { fov: 48, roll: -0.03 });
const S6c = (f: number) => zoom([78, 7, -42], [-8, 6, -86], 40, pushK(f, 773, 0.0022), { roll: 0.03 });
const S6d = (f: number) => dolly([AMCAMP[0] + 18, 9, AMCAMP[2] + 18], [AMCAMP[0], 0.5, AMCAMP[2] - 6], pushK(f, 818, 0.0025), { fov: 52 });
const S6e = (f: number) => zoom([88, 10, -28], [-12, 5, -102], 50, pushK(f, 880, 0.002), { roll: -0.03 });
// 7 in the middle of it all
const S7a = (f: number) => dolly([CUT[0] - 0.9, 1.5, CUT[2] + 2.4], [CUT[0], 1.45, CUT[2]], pushK(f, 948, 0.0025, 0.006, 26), { fov: 40, roll: -0.03 });
const S7b = (f: number) => dolly([GRIF[0] + 0.9, 1.5, GRIF[2] + 2.3], [GRIF[0], 1.45, GRIF[2]], pushK(f, 1000, 0.0028, 0.007, 30), { fov: 38, roll: 0.035 });
// 8 the governor on the beach; the admiral on his deck; telescope view of the squabble
const GV: V3 = [GOV[0], 1.55, GOV[2]], AD: V3 = [ADMIRAL[0], DECK + 1.55, ADMIRAL[2]];
const S8a = (f: number) => dolly([GV[0] - 1.2, 1.4, GV[2] + 3.4], [GV[0] + 0.35, 1.5, GV[2] - 0.5], pushK(f, 1045, 0.0025, 0.006, 26), { fov: 40, roll: 0.03 });
const S8b = (f: number) => dolly([AD[0] + 0.9, AD[1] - 0.05, AD[2] + 2.4], [AD[0], AD[1] - 0.1, AD[2]], pushK(f, 1103, 0.0025, 0.006, 26), { fov: 38, roll: -0.035 });
const S8c = (f: number) => zoom([TWO[0] + 1.2, 1.8, TWO[2] - 9], [TWO[0], 1.25, TWO[2]], 44, pushK(f, 1140, 0.002), { roll: 0.02 });
// 9 the redcoat and the bluecoat; then sitting, bored
const FO: V3 = [FACEOFF[0], 1.4, FACEOFF[2]];
const S9a = (f: number) => dolly([FO[0] + 0.5, 1.5, FO[2] + 5.6], FO, pushK(f, 1200, 0.0022), { fov: 44 });
const S9b = (f: number) => dolly([FO[0] - 1.2, 1.2, FO[2] + 4.0], [FO[0], 0.95, FO[2]], pushK(f, 1256, 0.0025), { fov: 44, roll: 0.03 });
// 10 camp life; the party meadow (Fourth of July, the Queen's birthday); toasts
const PT: V3 = [PARTY[0], 1.3, PARTY[2]];
const S10a = (f: number) => dolly([AMCAMP[0] + 5, 2.6, AMCAMP[2] + 22], [AMCAMP[0] - 3, 1.0, AMCAMP[2] + 8], pushK(f, 1310, 0.0022), { fov: 48, roll: -0.02 });
const S10b = (f: number) => dolly([PT[0] - 4, 2.4, PT[2] + 9], [PT[0] - 1, 1.2, PT[2] - 1], pushK(f, 1394, 0.0022), { fov: 48 });
const S10c = (f: number) => dolly([PT[0] + 4, 1.9, PT[2] + 6], [PT[0] + 1.5, 1.5, PT[2] - 2], pushK(f, 1453, 0.0025), { fov: 44, roll: 0.03 });
const CP: V3 = [PARTY[0] - 1.2, 0, PARTY[2] + 2.2], GP: V3 = [PARTY[0] + 1.4, 0, PARTY[2] + 2.4];
const S10d = mcu(CP, 1510, -0.5, 2.2, -0.035);
const S10e = mcu(GP, 1566, 0.5, 2.4, 0.035, 0.006, 36, 1.55, 0.18);
// 11 the Kaiser's study; America gets the island; Griffin, three pushes
const KZ: V3 = [KROOM[0], 1.45, KROOM[2]];
const S11a = (f: number) => dolly([KZ[0] + 0.7, 1.6, KZ[2] + 3.3], [KZ[0] + 0.1, 1.15, KZ[2]], pushK(f, 1662, 0.0022), { fov: 42, roll: 0.02 });
const S11b = (f: number) => dolly([CUT[0] + 2.5, 1.0, CUT[2] + 5.5], [CUT[0], 2.3, CUT[2] - 3], pushK(f, 1756, 0.0025), { fov: 52, roll: -0.04 });
const S11c = mcu(GRIF, 1795, 0.5, 2.4, 0.03, 0.006);
const S11d = mcu(GRIF, 1836, 0.4, 1.8, -0.03, 0.008, 34);
const S11e = mcu(GRIF, 1880, 0.3, 1.35, 0.05, 0.01, 34);
// 12 the grave; English Camp today, the Union Jack going up; old Cutlar
const GR: V3 = [GRAVE[0], 0.6, GRAVE[2]];
const S12a = (f: number) => dolly([GR[0] + 0.6, 1.5, GR[2] + 5.4], [GR[0], 1.0, GR[2]], pushK(f, 1915, 0.0025), { fov: 46, roll: 0.02 });
const S12b = (f: number) => zoom([POLE[0] + 3.5, 1.5, POLE[2] + 9.5], [POLE[0], 4.0, POLE[2]], 48, pushK(f, 1988, 0.0015), {});
const S12c = (f: number) => zoom([POLE[0] + 3.5, 1.5, POLE[2] + 9.5], [POLE[0], 1.5 + 11 * flagUp(f), POLE[2]], 48, pushK(f, 2050, 0.002, 0.005, 40), { roll: -0.02 });
const S12d = mcu(CUT, 2110, -0.6, 2.3, -0.03, 0.006);

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 92, cut: true, s: S1b }],
  2: [{ f: 124, s: S2a }, { f: 162, cut: true, s: S2b }],
  3: [{ f: 207, s: S3a }, { f: 268, cut: true, s: S3b }, { f: 318, cut: true, s: S3c }, { f: 330, cut: true, s: S3d }],
  4: [{ f: 350, s: S4a }, { f: 380, cut: true, s: S4b }, { f: 432, cut: true, s: S4c }],
  5: [{ f: 490, s: S5a }, { f: 542, cut: true, s: S5b }, { f: 592, cut: true, s: S5c }, { f: 615, cut: true, s: S5d }, { f: 638, cut: true, s: S5e }],
  6: [{ f: 665, s: S6a }, { f: 716, cut: true, s: S6b }, { f: 773, cut: true, s: S6c }, { f: 818, cut: true, s: S6d }, { f: 880, cut: true, s: S6e }],
  7: [{ f: 948, s: S7a }, { f: 1000, cut: true, s: S7b }],
  8: [{ f: 1045, s: S8a }, { f: 1103, cut: true, s: S8b }, { f: 1140, cut: true, s: S8c }],
  9: [{ f: 1200, s: S9a }, { f: 1256, cut: true, s: S9b }],
  10: [{ f: 1310, s: S10a }, { f: 1394, cut: true, s: S10b }, { f: 1453, cut: true, s: S10c }, { f: 1510, cut: true, s: S10d }, { f: 1566, cut: true, s: S10e }],
  11: [{ f: 1662, s: S11a }, { f: 1756, cut: true, s: S11b }, { f: 1795, cut: true, s: S11c }, { f: 1836, cut: true, s: S11d }, { f: 1880, cut: true, s: S11e }],
  12: [{ f: 1915, s: S12a }, { f: 1988, cut: true, s: S12b }, { f: 2040, dur: 30, s: S12c }, { f: 2110, cut: true, s: S12d }],
};

const KICKS: [number, number][] = [[BANG / FPS, 2.4], [W.over / FPS, 0.8], [W.pig4 / FPS, 0.6], [W.warships / FPS, 0.5], [W.men / FPS, 0.5],
  [W.twoThousand / FPS, 0.7], [W.refused / FPS, 0.5], [W.decided / FPS, 1.4], [W.decided2 / FPS, 0.5], [W.myPig / FPS, 0.6], [W.hundred2 / FPS, 0.4]];
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
  { f: 0, cInf: 0 }, { f: 92, cInf: 14, focus: () => PH }, { f: 124, cInf: 0 }, { f: 162, cInf: 6 }, { f: 207, cInf: 5 },
  { f: 268, cInf: 13, focus: () => PH }, { f: 318, cInf: 14, focus: () => CH }, { f: 350, cInf: 6 },
  { f: 380, cInf: 13, focus: () => CH }, { f: 432, cInf: 13, focus: () => GH }, { f: 490, cInf: 8, focus: () => TWO },
  { f: 542, cInf: 13, focus: () => CH }, { f: 592, cInf: 13, focus: () => GH }, { f: 615, cInf: 14, focus: () => CH }, { f: 638, cInf: 13, focus: () => GH },
  { f: 665, cInf: 9, focus: () => TWO }, { f: 716, cInf: 6 }, { f: 773, cInf: 0 }, { f: 818, cInf: 0 }, { f: 948, cInf: 12, focus: () => CH },
  { f: 1000, cInf: 12, focus: () => GH }, { f: 1045, cInf: 12, focus: () => GV }, { f: 1103, cInf: 12, focus: () => AD }, { f: 1140, cInf: 4, focus: () => TWO },
  { f: 1200, cInf: 8, focus: () => FO }, { f: 1310, cInf: 0 }, { f: 1394, cInf: 5 }, { f: 1453, cInf: 7 },
  { f: 1510, cInf: 13, focus: () => [CP[0], 1.5, CP[2]] }, { f: 1566, cInf: 13, focus: () => [GP[0], 1.5, GP[2]] }, { f: 1662, cInf: 8, focus: () => KZ },
  { f: 1756, cInf: 6, focus: () => CH }, { f: 1795, cInf: 13, focus: () => GH }, { f: 1915, cInf: 10, focus: () => GR }, { f: 1988, cInf: 0 },
  { f: 2110, cInf: 13, focus: () => CH },
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
export { CH, GH, TWO, CP, GP, add };
export type Melt = { mirror: number; badge: number; side: number; roof: number };
