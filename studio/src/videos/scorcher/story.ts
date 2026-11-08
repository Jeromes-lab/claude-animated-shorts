// Timeline of "The Tower That Fried an Egg": shots timed to the voice words (~/scorcher-short/voice/words.json, frames
// at 30 fps), story state (car melt, beam hot spot, fins, rays) and the camera grammar of the bridge short: hard cuts on
// big reframes, smootherstep glides 18-40 f, every hold creeps in, flip kicks on impacts, 4-5 deg rolls.
// Places: London (origin), the garden demo (x = -1500), Las Vegas (x = +1500). The fog hides the other two.
export const FPS = 30;
export const TOTAL = 1700;
export const D0 = 0; // ground height (build.ts / cast.ts read it)
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

// ---------------- places ----------------
export const GARDEN: V3 = [-1500, 0, 0];
export const VEGAS: V3 = [1500, 0, 0];
export type Place = "london" | "garden" | "vegas";

// ---------------- London layout ----------------
// Eastcheap runs along x. Tower to the north (front at z = -14 at street level, flaring out toward the street as it
// rises, concave in plan), the road z -7..5, south pavement z 5..10, south shop fronts at z = 10 facing the tower.
export const ROAD = { n: -7, s: 5 }, PAVE_N = -11, PAVE_S = 10;
export const TOWER = { h: 150, base: -14, flare: 15, hw0: 24, hw1: 31, sag: 5, back: -52 };
/** tower front surface: z at (x, y); concave in plan (the middle sits `sag` behind the edges), leaning out with height */
export const towerHW = (y: number) => TOWER.hw0 + (TOWER.hw1 - TOWER.hw0) * clamp01(y / TOWER.h) ** 1.3;
export const towerZ = (x: number, y: number) => {
  const k = clamp01(y / TOWER.h), hw = towerHW(y), u = Math.max(-1, Math.min(1, x / hw));
  return TOWER.base + TOWER.flare * k ** 1.7 - TOWER.sag * (1 - u * u);
};
/** where the curved glass focuses its reflection (the facade patch that sends the beam) */
export const FACADE_FOCUS: V3 = [0, 72, towerZ(0, 72)];
export const CAR: V3 = [0, 0, 3.15]; // Jaguar, nose toward +x, parked against the south kerb
export const VAN: V3 = [-6.6, 0, 3.15];
export const BAYS = [[-9.6, -3.3], [-3.3, 3.0], [3.0, 9.3]] as const; // parking bays along the south kerb (x ranges)
export const SALON = { x0: 10.5, x1: 16.5, z0: PAVE_S, z1: 16.5, door: 13.5 };
export const MAT: V3 = [13.5, 0.012, 10.75]; // doormat just inside the salon door
export const PAN: V3 = [-5.2, 0, 7.4];       // the reporter's frying pan on the pavement
export const OFFICE_DOOR: V3 = [-12.5, 0, PAVE_S];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 107, light: "day", place: "london" },        // hook: tower, beam, melting car
  { id: 2, a: 107, b: 308, light: "day", place: "london", sunAz: 150, sunEl: 40 }, // 2013, the shiny curved tower
  { id: 3, a: 308, b: 424, light: "day", place: "london" },      // the man parks and pops out
  { id: 4, a: 424, b: 575, light: "day", place: "london" },      // he comes back: mirror, badge, side
  { id: 5, a: 575, b: 670, light: "day", place: "london" },      // the salon carpet scorches
  { id: 6, a: 670, b: 790, light: "day", place: "london" },      // reporter, pan, egg
  { id: 7, a: 790, b: 875, light: "day", place: "london", sunAz: 160, sunEl: 35 }, // the nickname
  { id: 8, a: 875, b: 959, light: "day", place: "london" },      // luckily: two hours a day
  { id: 9, a: 959, b: 1028, light: "day", place: "london" },     // unluckily: the parking spaces
  { id: 10, a: 1028, b: 1105, light: "day", place: "garden", sunAz: 100, sunEl: 40 }, // a flat window
  { id: 11, a: 1105, b: 1259, light: "day", place: "garden", sunAz: 160, sunEl: 45 }, // the spoon
  { id: 12, a: 1259, b: 1325, light: "day", place: "london", sunAz: 165, sunEl: 40 }, // a 160 m spoon
  { id: 13, a: 1325, b: 1431, light: "day", place: "london" },   // paid for the car, the sunshade
  { id: 14, a: 1431, b: 1458, light: "day", place: "london" },   // and the architect?
  { id: 15, a: 1458, b: 1597, light: "golden", place: "vegas", sunAz: 165, sunEl: 14 }, // Las Vegas hotel, the pool
  { id: 16, a: 1597, b: TOTAL, light: "day", place: "london" },  // too many sunny days
];
export const XFADE: Record<number, number> = { 10: 8, 12: 8, 15: 8, 16: 8 };
export const FLASH_AT = 107;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state ----------------
/** word onsets used for reactions (frames) */
export const W = {
  car: 53, touching: 87, shiny: 181, curved: 236, leans: 273, sun: 297, parks: 341, pops: 393, back: 437, mirror: 456, drooping: 471,
  badge: 491, soft: 510, side: 532, chocolate: 560, road: 590, carpet: 607, scorch: 654, reporter: 679, pan: 715, sets: 729, pavement: 750,
  cooks: 770, egg: 780, nickname: 831, walkie: 852, scorchie: 861, luckily: 878, two: 930, day: 945, unluckily: 962, parking: 1002,
  flat: 1048, bounces: 1072, back2: 1093, spoon: 1133, sun2: 1145, gathers: 1179, one: 1224, hot: 1231, spot: 1245, make: 1267,
  tall: 1314, paid: 1340, car2: 1352, bolted: 1370, sunshade: 1395, front: 1419, architect: 1438, three: 1461, hotel: 1492, vegas: 1512,
  same: 1547, pool: 1587, explanation: 1604, london: 1623, too: 1646, many: 1651, sunny: 1656, now: 1669,
};
export type Melt = { mirror: number; badge: number; side: number; roof: number };
/** how far the car has melted (0 = new, 1 = fully drooped) */
export const meltAt = (id: number, f: number): Melt => {
  if (id === 3 || id === 2) return { mirror: 0, badge: 0, side: 0, roof: 0 };
  if (id === 1) { const k = lin([[0, 0.45], [100, 0.95]], f); return { mirror: k, badge: k, side: k, roof: k * 0.6 }; }
  if (id === 4) return {
    mirror: lin([[454, 0.35], [474, 0.95], [488, 1]], f), badge: lin([[488, 0.3], [512, 0.95], [526, 1]], f),
    side: lin([[424, 0.25], [526, 0.45], [562, 1]], f), roof: lin([[424, 0.2], [575, 0.55]], f),
  };
  return { mirror: 1, badge: 1, side: 1, roof: 0.55 };
};
/** the reflected sun: where it lands (world), radius (m) and strength 0..1 */
export type Beam = { at: V3; r: number; k: number };
export const beamAt = (id: number, f: number): Beam => {
  switch (id) {
    case 1: return { at: [0.2, 1.0, 2.5], r: 2.2, k: 1 };
    case 2: return { at: [0.2, 1.0, 2.5], r: 2.2, k: 0.9 };
    case 3: return { at: [-0.4, 0.05, 1.6], r: 2.3, k: 0.55 + 0.25 * smooth((f - 330) / 60) };
    case 4: return { at: [0.1, 0.9, 2.6], r: 2.3, k: 1 };
    case 5: return { at: [MAT[0], 0.05, MAT[2] - 0.1], r: f < 616 ? 1.6 : 0.8, k: 1 };
    case 6: return { at: [PAN[0] + 0.1, 0.02, PAN[2]], r: f < 726 ? 1.5 : 0.7, k: 1 };
    case 7: return { at: [0.5, 0.05, 4.2], r: 2.4, k: 1 };
    case 8: { // the spot crawls along the street with the sun, then fades out ("two hours a day")
      const u = clamp01((f - 875) / 80);
      return { at: [-14 + 26 * u, 0.04, 2.8], r: 2.4, k: 1 - smooth((f - 930) / 22) };
    }
    case 9: { // it slides in and parks itself right on the bays
      const u = smooth((f - 962) / 40);
      return { at: [-12 + 12 * u, 0.04, 0.4 + 2.6 * u], r: 2.9, k: smooth((f - 960) / 14) };
    }
    case 12: return { at: [0.2, 0.05, 2.8], r: 2.4, k: smooth((f - 1268) / 30) };
    case 13: return { at: [0.2, 1.0, 2.6], r: 2.2, k: f < 1365 ? 0.9 : 1 - smooth((f - 1405) / 20) };
    default: return { at: [0, 0, 0], r: 1, k: 0 };
  }
};
/** brise-soleil fins: number visible (fractional = the next one sliding in) */
export const FIN_N = 9;
export const finsAt = (id: number, f: number) => {
  if (id < 13 || (id === 13 && f < 1365)) return 0;
  if (id === 13) return lin([[1366, 0], [1372, 1], [1385, 2], [1394, 3], [1400, 4], [1406, 5], [1411, 6], [1416, 7], [1420, 8], [1426, 9]], f);
  return FIN_N;
};
/** the fins bang into place: one kick per fin (frames) */
export const FIN_HITS = [1372, 1385, 1394, 1400, 1406, 1411, 1416, 1420, 1426];
/** car arrival (shot 3): x of the car centre */
export const carX = (f: number) => (f >= 341 ? 0 : -30 * (1 - easeOut((f - 296) / 46)) ** 1.4);

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
/** push-in factor since f0 (rate per frame), with an optional punch for the first n frames */
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
const G = (x: number, y: number, z: number): V3 => [GARDEN[0] + x, y, GARDEN[2] + z];
const Vg = (x: number, y: number, z: number): V3 => [VEGAS[0] + x, y, VEGAS[2] + z];

// shot 1: the hook. Low on the road east of the car: the tower rises behind, the beam comes down onto the car; cut to the
// melting side on "car", push on "touching"
const S1a = (f: number) => zoom([30, 1.7, 7.4], [-2, 12.5, -4], 62, pushK(f, 0, 0.0025), { roll: -0.03 });
const S1b = (f: number) => dolly([2.4, 1.05, -1.0], [0.1, 0.85, 2.3], pushK(f, 50, 0.0022, 0.006, 34), { fov: 40, roll: 0.04 });
// shot 2: aerial over the City -> up the curved glass -> under the overhang
const S2a = (f: number) => zoom([95, 85, 150], [0, 55, -20], 44, pushK(f, 107, 0.0022));
const S2b = (f: number) => zoom([30, 6, 18], [2, 70, -12], 54, pushK(f, 218, 0.002));
const S2c = (f: number) => zoom([-1.5, 1.6, -9.0], [0, 90, -2], 62, pushK(f, 268, 0.0025, 0.005, 30), { roll: 0.04 });
// shot 3: across the road from the north pavement; the car rolls in from the left, the man walks off right
const S3a = (f: number) => dolly([-1.8, 1.25, -4.2], [0.5, 1.25, 4.0], pushK(f, 308, 0.0018), { fov: 46 });
const S3b = (f: number) => dolly([1.8, 1.25, -4.2], [5.0, 1.3, 5.0], pushK(f, 385, 0.002), { fov: 46 });
// shot 4: he comes back; mirror, badge, side inserts
const S4a = (f: number) => dolly([7.6, 1.55, -1.6], [2.2, 1.25, 2.0], pushK(f, 424, 0.0025), { fov: 42 });
const S4b = (f: number) => dolly([1.85, 1.2, 0.9], [1.0, 1.0, 2.2], pushK(f, 454, 0.002, 0.006, 30), { fov: 38, roll: -0.04 });
const S4c = (f: number) => dolly([4.1, 0.95, 2.4], [2.6, 0.68, 3.15], pushK(f, 488, 0.002, 0.005, 30), { fov: 36, roll: 0.035 });
const S4d = (f: number) => dolly([0.8, 1.25, -3.2], [-0.2, 0.75, 2.3], pushK(f, 526, 0.0025), { fov: 46 });
// shot 5: the salon across the road, then the doormat
const S5a = (f: number) => dolly([11.5, 1.45, -2.0], [13.3, 2.2, 10.5], pushK(f, 575, 0.0025), { fov: 48 });
const S5b = (f: number) => dolly([13.0, 1.35, 7.5], [13.5, 0.35, 11.0], pushK(f, 616, 0.002, 0.006, 30), { fov: 44, roll: -0.04 });
// shot 6: the reporter walks out with a pan; sets it down; the egg
const S6a = (f: number) => dolly([-0.8, 1.55, 8.9], [-8.5, 1.2, 7.4], pushK(f, 670, 0.002), { fov: 46 });
const S6b = (f: number) => dolly([-3.4, 0.55, 5.3], [-5.1, 0.2, 7.3], pushK(f, 726, 0.0022), { fov: 42, roll: 0.03 });
const S6c = (f: number) => dolly([-4.65, 0.8, 6.55], [-5.2, 0.05, 7.4], pushK(f, 766, 0.003, 0.006, 30), { fov: 38 });
// shot 7: the crowd on the north pavement, the tower above; punch on "Walkie Scorchie"
const S7a = (f: number) => zoom([3.6, 1.0, -2.6], [-0.8, 3.4, -11.5], 66, pushK(f, 790, 0.002), { roll: -0.03 });
const S7b = (f: number) => zoom([3.6, 1.0, -2.6], [-0.6, 3.1, -11.5], 58, pushK(f, 845, 0.002, 0.007, 30), { roll: 0.05 });
// shot 8: high over the street, the spot crawls along and fades
const S8a = (f: number) => dolly([-7, 26, -11], [3, 0, 4], pushK(f, 875, 0.0018), { fov: 50 });
// shot 9: straight down onto the bays
const S9a = (f: number) => dolly([0.3, 17, 4.0], [0.3, 0, 2.8], pushK(f, 959, 0.002, 0.006, 32), { fov: 50, roll: 0.05 });
// shot 10: garden shed window, side on, rays in and out
const S10a = (f: number) => dolly(G(-2.5, 2.2, 9.5), G(-4.5, 2.4, -1.5), pushK(f, 1024, 0.0022), { fov: 46 });
// shot 11: the kid with the spoon; the bowl; the hot little spot on the leaf
const S11a = (f: number) => dolly(G(1.6, 1.25, 3.4), G(0.1, 0.95, 0), pushK(f, 1105, 0.0022), { fov: 42 });
const S11b = (f: number) => dolly(G(0.95, 1.15, 1.25), G(0.25, 0.92, 0.3), pushK(f, 1159, 0.002, 0.005, 30), { fov: 38, roll: 0.04 });
const S11c = (f: number) => dolly(G(1.25, 0.75, 1.75), G(0.95, 0.05, 0.65), pushK(f, 1217, 0.003, 0.007, 30), { fov: 38, roll: -0.035 });
// shot 12: back in London, crane up the facade while the rays converge on the street
const S12a = (f: number) => {
  const u = glide((f - 1255) / 70);
  return { pos: [8 + 28 * u, 2 + 44 * u, 14 + 40 * u] as V3, look: [0, 12 + 40 * u, -8] as V3, fov: 56 - 6 * u, roll: 0 };
};
// shot 13: the developer pays; the fins go on
const S13a = (f: number) => dolly([2.25, 1.6, -3.6], [2.25, 1.3, 1.4], pushK(f, 1325, 0.0022), { fov: 46 });
const S13b = (f: number) => zoom([7, 1.6, 4.5], [0, 55, -8], 64, pushK(f, 1365, 0.0018));
// shot 14: the architect in front of his tower
const S14a = (f: number) => dolly([32.6, 1.15, -6.4], [29.6, 1.95, -9.6], pushK(f, 1431, 0.0025, 0.006, 26), { fov: 46 });
// shot 15: Las Vegas: the hotel wide, then the pool deck
const S15a = (f: number) => zoom(Vg(110, 22, 265), Vg(0, 45, 10), 44, pushK(f, 1454, 0.0022));
const S15b = (f: number) => dolly(Vg(-15, 1.7, 41), Vg(2, 2.6, 49), pushK(f, 1528, 0.002, 0.006, 34), { fov: 48, roll: 0.035 });
// shot 16: the architect's explanation
const S16a = (f: number) => dolly([32.6, 1.15, -6.3], [29.6, 1.95, -9.6], pushK(f, 1593, 0.0022), { fov: 46 });
const S16b = (f: number) => dolly([32.0, 1.2, -7.0], [29.6, 1.9, -9.6], pushK(f, 1637, 0.0025, 0.006, 30), { fov: 44, roll: 0.04 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 50, cut: true, s: S1b }],
  2: [{ f: 103, s: S2a }, { f: 218, cut: true, s: S2b }, { f: 268, cut: true, s: S2c }],
  3: [{ f: 304, s: S3a }, { f: 385, dur: 34, s: S3b }],
  4: [{ f: 420, s: S4a }, { f: 454, cut: true, s: S4b }, { f: 488, cut: true, s: S4c }, { f: 526, cut: true, s: S4d }],
  5: [{ f: 571, s: S5a }, { f: 616, cut: true, s: S5b }],
  6: [{ f: 666, s: S6a }, { f: 726, cut: true, s: S6b }, { f: 766, cut: true, s: S6c }],
  7: [{ f: 786, s: S7a }, { f: 845, dur: 22, s: S7b }],
  8: [{ f: 871, s: S8a }],
  9: [{ f: 955, s: S9a }],
  10: [{ f: 1020, s: S10a }],
  11: [{ f: 1101, s: S11a }, { f: 1159, cut: true, s: S11b }, { f: 1217, cut: true, s: S11c }],
  12: [{ f: 1251, s: S12a }],
  13: [{ f: 1321, s: S13a }, { f: 1365, cut: true, s: S13b }],
  14: [{ f: 1427, s: S14a }],
  15: [{ f: 1450, s: S15a }, { f: 1528, cut: true, s: S15b }],
  16: [{ f: 1589, s: S16a }, { f: 1637, dur: 24, s: rolled(S16b, 0.04) }],
};

// impact kicks (seconds): the badge going, the egg cracking, the scorchie punch, every fin, the jump
const KICKS: [number, number][] = [
  [W.car / FPS, 0.6], [W.drooping / FPS, 0.5], [W.egg / FPS, 0.6], [W.scorchie / FPS, 0.7], [W.parking / FPS, 0.5],
  ...FIN_HITS.map((h) => [h / FPS, 0.55] as [number, number]), [W.pool / FPS, 0.8],
];
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
  { f: 0, cInf: 0 },                                     // hook wide (tower + beam), sharp
  { f: 50, cInf: 14, focus: () => [0.2, 0.85, 2.25] },   // melting side CU
  { f: 107, cInf: 0 },                                   // aerial, facade, overhang
  { f: 308, cInf: 7, focus: () => [0.5, 1.0, 3.2] },     // across the road: the car
  { f: 424, cInf: 11, focus: () => [2.9, 1.6, 1.0] },    // the man comes back
  { f: 454, cInf: 15 },                                  // mirror insert (focus = look)
  { f: 488, cInf: 15 },                                  // badge insert
  { f: 526, cInf: 11, focus: () => [0, 0.8, 2.2] },      // the chocolate side
  { f: 575, cInf: 0 },                                   // salon across the road
  { f: 616, cInf: 13, focus: () => [MAT[0], 0.3, MAT[2]] }, // the doormat
  { f: 670, cInf: 9, focus: (f) => [reporterX(f), 1.55, 7.3] }, // reporter MS
  { f: 726, cInf: 12, focus: () => [PAN[0], 0.2, PAN[2]] },
  { f: 766, cInf: 15, focus: () => [PAN[0], 0.06, PAN[2]] }, // egg CU
  { f: 790, cInf: 0 },                                   // crowd + tower
  { f: 1028, cInf: 5 },                                  // shed window
  { f: 1105, cInf: 11, focus: () => G(0.1, 1.25, 0.05) }, // kid MS (eyes)
  { f: 1159, cInf: 14 },                                 // spoon CU
  { f: 1217, cInf: 15, focus: () => G(0.95, 0.03, 0.65) }, // leaf CU
  { f: 1259, cInf: 0 },                                  // crane up the tower, fins
  { f: 1325, cInf: 11, focus: () => [2.2, 1.6, 1.6] },   // the handover
  { f: 1365, cInf: 0 },
  { f: 1431, cInf: 10, focus: () => [29.6, 1.75, -9.6] }, // architect MS
  { f: 1458, cInf: 0 },                                  // Vegas wide
  { f: 1528, cInf: 4, focus: () => Vg(-1.6, 1.3, 51.3) },  // pool deck
  { f: 1597, cInf: 10, focus: () => [29.6, 1.75, -9.6] }, // architect again
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };

/** reporter walk (shot 6): x along the south pavement */
export const reporterX = (f: number) => lin([[670, -11.8], [724, -6.0]], f);

/** near framing objects (Kenney kit is optional; plants are drawn as cartoon vegetation) */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 1105, b: 1159, kit: "plant_bushDetailed", pos: G(1.9, 0, 2.2), s: 0.8, yaw: 0.3 }, // garden: bush in the bottom-right corner
];
