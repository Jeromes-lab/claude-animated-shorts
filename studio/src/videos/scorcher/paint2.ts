// Painted textures for the scorcher short: London street (asphalt with UK markings, paving slabs, kerbs), City office
// facades, the curved glass tower, Victorian shop terraces with text-free pictogram fascias, the salon interior,
// garden shed, Las Vegas sand, pool water and deck tiles. Same hand-painted rules as paint.ts: soft blotches, seams as
// dark tints, no pure black, everything cached by key.
import * as THREE from "three";
import { ctex, jit } from "./paint";

const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blotch = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};

/** asphalt for the road z -7..5 (v: 0 at the north kerb .. 1 at the south kerb), 6.3 m per tile along x (u).
 *  Double yellow lines on the north kerb, dashed white centre line, white parking-bay box on the south side. */
export const roadHD = () => ctex("roadHD", 1024, 2048, (g, r) => {
  const W = 1024, H = 2048, mx = W / 6.3, mz = H / 12; // px per metre along x / across z
  g.fillStyle = "#4b4860"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 20, 90), r() > 0.5 ? "120,115,120" : "40,38,44", U(r, 0.05, 0.12));
  for (let i = 0; i < 16000; i++) { g.fillStyle = r() > 0.5 ? "rgba(170,165,185,0.45)" : "rgba(25,22,40,0.45)"; g.fillRect(U(r, 0, W), U(r, 0, H), 3, 3); }
  const paint = (x0: number, z0: number, x1: number, z1: number, col: string) => {
    g.fillStyle = col; g.fillRect(x0 * mx, z0 * mz, (x1 - x0) * mx, (z1 - z0) * mz);
  };
  // double yellow (north kerb at z 0 of the tile)
  paint(0, 0.18, 6.3, 0.28, "#e8c13c"); paint(0, 0.36, 6.3, 0.46, "#e8c13c");
  // centre line: 3 m dash, 3.3 m gap
  paint(0.4, 5.62, 3.4, 5.76, "#f1efe8");
  // parking bay on the south side: bay line 2.2 m from the kerb, end lines at the tile edges
  paint(0, 9.72, 6.3, 9.82, "#f1efe8");
  paint(0, 9.72, 0.1, 12, "#f1efe8"); paint(6.2, 9.72, 6.3, 12, "#f1efe8");
  // wear on the paint
  for (let i = 0; i < 160; i++) { g.fillStyle = "rgba(89,86,92,0.55)"; g.fillRect(U(r, 0, W), U(r, 0, H), U(r, 2, 10), U(r, 2, 6)); }
  // patch repair + a manhole
  g.fillStyle = "rgba(40,38,44,0.18)"; g.fillRect(U(r, 100, 600), U(r, 600, 900), 260, 180);
  g.fillStyle = "#4b484f"; g.beginPath(); g.ellipse(700, 1200, 0.35 * mx, 0.35 * mz, 0, 0, 7); g.fill();
  g.strokeStyle = "rgba(25,22,30,0.6)"; g.lineWidth = 4; g.stroke();
});

/** grey paving slabs 0.9 m with dark seams; 4 m per tile */
export const paveHD = () => ctex("paveHD", 1024, 1024, (g, r) => {
  const S = 1024 / 4.5, n = 5;
  g.fillStyle = "#6f6470"; g.fillRect(0, 0, 1024, 1024);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const off = (j % 2) * S * 0.5;
    g.fillStyle = jit(r, "#d6c3a6", 0.08, 6, 0.25);
    g.fillRect(i * S + off + 5, j * S + 5, S - 10, S - 10);
    if (off) { g.fillStyle = jit(r, "#d6c3a6", 0.08, 6, 0.25); g.fillRect(-S + off + 3 + (i === 0 ? 0 : 0), j * S + 3, S - 6, S - 6); }
    blotch(g, i * S + U(r, 20, S - 20), j * S + U(r, 20, S - 20), U(r, 20, 60), "90,85,80", 0.08);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(60,55,58,0.35)"; g.beginPath(); g.ellipse(U(r, 0, 1024), U(r, 0, 1024), U(r, 2, 6), U(r, 2, 5), 0, 0, 7); g.fill(); } // gum
});

/** granite kerb */
export const kerbHD = () => ctex("kerbHD", 512, 128, (g, r) => {
  g.fillStyle = "#9d9a98"; g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 128) { g.fillStyle = jit(r, "#a8a5a2", 0.05); g.fillRect(x + 2, 2, 124, 124); }
  g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, 0, 512, 10);
});

/** modern City office facade: horizontal glass bands + stone spandrels, `wm` x `hm` metres */
export const officeHD = (key: string, wm: number, hm: number, o: { stone: string; glass: string; mull: number }) => {
  const PX = Math.min(48, 2048 / Math.max(wm, hm)), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("off" + key, W, H, (g, r) => {
    g.fillStyle = o.stone; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) blotch(g, U(r, 0, W), U(r, 0, H), m(U(r, 2, 6)), "255,255,255", 0.06);
    const fl = 3.6;
    for (let y = hm - fl * 0.25; y > 0.5; y -= fl) {
      const y0 = m(y - fl * 0.68), y1 = m(y - 0.12);
      const gl = g.createLinearGradient(0, y0, 0, y1);
      gl.addColorStop(0, o.glass); gl.addColorStop(1, "#3d4f78");
      g.fillStyle = gl; g.fillRect(m(0.4), y0, W - m(0.8), y1 - y0);
      g.save(); g.beginPath(); g.rect(m(0.4), y0, W - m(0.8), y1 - y0); g.clip();
      g.fillStyle = "rgba(255,255,255,0.22)";
      for (let k = 0; k < 3; k++) { const x = U(r, 0, W); g.save(); g.translate(x, y0); g.rotate(0.5); g.fillRect(0, -40, m(0.35), (y1 - y0) * 3); g.restore(); }
      g.restore();
      for (let x = m(0.4); x < W - m(0.4); x += m(o.mull)) { g.fillStyle = "rgba(40,40,52,0.55)"; g.fillRect(x, y0, Math.max(2, m(0.06)), y1 - y0); }
      g.fillStyle = "rgba(40,35,40,0.35)"; g.fillRect(0, y1, W, 2);
    }
  });
};

/** the curved tower's glass: dense vertical mullions, floor lines, sky + cloud reflections brightening toward the top.
 *  u across the front (0..1), v up (0 at street .. 1 at the top) */
export const towerGlassHD = () => ctex("towerGlassHD", 2048, 2048, (g, r) => {
  const W = 2048, H = 2048;
  const gr = g.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, "#5d78a6"); gr.addColorStop(0.45, "#7fa2d2"); gr.addColorStop(0.8, "#a9c6ea"); gr.addColorStop(1, "#cfe0f4");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // reflected clouds: soft horizontal smears, mirrored by the concave glass
  for (let i = 0; i < 26; i++) blotch(g, U(r, 0, W), U(r, 0, H * 0.75), U(r, 60, 180), "245,248,255", U(r, 0.15, 0.32));
  // vertical streak of the reflected sun near the middle (the hot band)
  const sb = g.createLinearGradient(W * 0.38, 0, W * 0.62, 0);
  sb.addColorStop(0, "rgba(255,248,225,0)"); sb.addColorStop(0.5, "rgba(255,248,225,0.35)"); sb.addColorStop(1, "rgba(255,248,225,0)");
  g.fillStyle = sb; g.fillRect(0, H * 0.28, W, H * 0.4);
  // floors (37) and mullions (every 1.5 m on a ~60 m front)
  const floors = 37, cols = 42;
  for (let k = 0; k <= floors; k++) {
    const y = H - (k * H) / floors;
    g.fillStyle = "rgba(220,228,240,0.85)"; g.fillRect(0, y - 3, W, 6);
    g.fillStyle = "rgba(40,50,72,0.45)"; g.fillRect(0, y + 3, W, 3);
  }
  for (let c = 0; c <= cols; c++) {
    const x = (c * W) / cols;
    g.fillStyle = "rgba(210,218,232,0.8)"; g.fillRect(x - 2, 0, 4, H);
    g.fillStyle = "rgba(35,45,70,0.35)"; g.fillRect(x + 2, 0, 2, H);
  }
  // per-pane tint jitter
  for (let k = 0; k < floors; k++) for (let c = 0; c < cols; c++) if (r() < 0.25) {
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.08)" : "rgba(20,30,60,0.08)";
    g.fillRect((c * W) / cols + 4, H - ((k + 1) * H) / floors + 4, W / cols - 8, H / floors - 8);
  }
});
/** tower sides and back: silver vertical fins over darker glass */
export const towerSideHD = () => ctex("towerSideHD", 1024, 2048, (g) => {
  g.fillStyle = "#6c7d99"; g.fillRect(0, 0, 1024, 2048);
  const gr = g.createLinearGradient(0, 2048, 0, 0); gr.addColorStop(0, "rgba(0,0,0,0.1)"); gr.addColorStop(1, "rgba(255,255,255,0.18)");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 2048);
  for (let x = 0; x < 1024; x += 32) { g.fillStyle = "#cfd6e0"; g.fillRect(x, 0, 10, 2048); g.fillStyle = "rgba(30,35,50,0.35)"; g.fillRect(x + 10, 0, 3, 2048); }
  for (let k = 0; k <= 37; k++) { g.fillStyle = "rgba(30,35,50,0.25)"; g.fillRect(0, (k * 2048) / 37, 1024, 3); }
});

/** ground-floor shop front 6 m x 4.2 m: fascia board with a pictogram (no text), big window, door at u = 0.5 */
export type Shop = "salon" | "cafe" | "news" | "flowers" | "bank" | "office";
const FASCIA: Record<Shop, string> = { salon: "#2f5f6a", cafe: "#b8553a", news: "#3f6fb5", flowers: "#4f8a5a", bank: "#3b3f52", office: "#5d5a6e" };
export const shopHD = (kind: Shop, open = false) => ctex("shop" + kind + open, 1024, 720, (g, r) => {
  const W = 1024, H = 720, m = W / 6;
  const fas = FASCIA[kind];
  g.fillStyle = "#e6dccb"; g.fillRect(0, 0, W, H); // stone surround
  // fascia
  g.fillStyle = fas; g.fillRect(m * 0.2, m * 0.15, W - m * 0.4, m * 0.62);
  g.strokeStyle = "rgba(240,220,170,0.9)"; g.lineWidth = 6; g.strokeRect(m * 0.28, m * 0.22, W - m * 0.56, m * 0.48);
  const cx = W / 2, cy = m * 0.46, ink = "#f4ecd8";
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 9; g.lineCap = "round";
  if (kind === "salon") { // scissors + comb
    g.beginPath(); g.moveTo(cx - 60, cy - 26); g.lineTo(cx + 40, cy + 22); g.moveTo(cx - 60, cy + 26); g.lineTo(cx + 40, cy - 22); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx - 74, cy + s * 30, 14, 0, 7); g.stroke(); }
    g.fillRect(cx + 70, cy - 26, 90, 14);
    for (let i = 0; i < 9; i++) g.fillRect(cx + 74 + i * 10, cy - 12, 5, 30);
  } else if (kind === "cafe") { // cup with steam
    g.fillRect(cx - 40, cy - 14, 70, 44); g.beginPath(); g.arc(cx + 38, cy + 6, 14, -1.4, 1.4); g.stroke();
    for (const x of [-20, 0, 20]) { g.beginPath(); g.moveTo(cx + x - 4, cy - 22); g.quadraticCurveTo(cx + x + 10, cy - 36, cx + x - 2, cy - 50); g.stroke(); }
  } else if (kind === "news") { // folded paper
    g.fillRect(cx - 70, cy - 30, 140, 60); g.fillStyle = fas; for (let i = 0; i < 4; i++) g.fillRect(cx - 56, cy - 18 + i * 12, i ? 112 : 60, 6);
  } else if (kind === "flowers") {
    for (const [x, c] of [[-40, "#f2c94c"], [0, "#f4ecd8"], [40, "#e78c8c"]] as const) { g.fillStyle = c; g.beginPath(); g.arc(cx + x, cy - 8, 18, 0, 7); g.fill(); g.strokeStyle = "#a9d6a0"; g.beginPath(); g.moveTo(cx + x, cy + 10); g.lineTo(cx, cy + 34); g.stroke(); }
  } else if (kind === "bank") { // columns + pediment
    g.beginPath(); g.moveTo(cx - 70, cy - 10); g.lineTo(cx, cy - 40); g.lineTo(cx + 70, cy - 10); g.closePath(); g.fill();
    for (const x of [-50, -18, 18, 50]) g.fillRect(cx + x - 7, cy - 6, 14, 36);
  } else { g.fillRect(cx - 50, cy - 24, 100, 48); g.fillStyle = fas; g.fillRect(cx - 38, cy - 12, 76, 24); }
  // window (left) + door (centre) + window (right)
  const y0 = m * 0.95, y1 = H - m * 0.12;
  const win = (x0: number, x1: number) => {
    const gl = g.createLinearGradient(0, y0, 0, y1); gl.addColorStop(0, "#5c6f94"); gl.addColorStop(1, "#2f3a55");
    g.fillStyle = gl; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    g.fillStyle = "rgba(255,255,255,0.28)";
    for (const [a, b] of [[0.3, 26], [0.55, 12]]) { g.save(); g.translate(x0 + (x1 - x0) * a, y0); g.rotate(0.6); g.fillRect(0, -200, b, 900); g.restore(); }
    // goods silhouettes inside
    g.fillStyle = "rgba(240,220,190,0.25)";
    for (let i = 0; i < 4; i++) g.fillRect(x0 + 20 + i * ((x1 - x0 - 40) / 4), y1 - 70 - U(r, 0, 50), (x1 - x0 - 60) / 5, 60);
    g.restore();
    g.strokeStyle = fas; g.lineWidth = 12; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  };
  win(m * 0.2, m * 2.35); win(m * 3.65, W - m * 0.2);
  // door
  if (open) { g.clearRect(m * 2.5, y0, m * 1.0, H - y0); } // a real opening (alphaTest): the salon interior shows through
  else {
    g.fillStyle = fas; g.fillRect(m * 2.5, y0, m * 1.0, y1 - y0);
    g.fillStyle = "#5c6f94"; g.fillRect(m * 2.62, y0 + 20, m * 0.76, (y1 - y0) * 0.55);
    g.fillStyle = "#e8c45a"; g.beginPath(); g.arc(m * 3.3, y0 + (y1 - y0) * 0.65, 8, 0, 7); g.fill();
  }
  g.fillStyle = "rgba(60,45,40,0.5)"; g.fillRect(0, H - 10, W, 10);
});

/** Victorian upper floors over shops: stone with tall sash windows, `wm` x `hm` metres */
export const terraceHD = (key: string, wm: number, hm: number, wall: string) => {
  const PX = Math.min(56, 2048 / Math.max(wm, hm)), W = Math.round(wm * PX), H = Math.round(hm * PX), m = (v: number) => v * PX;
  return ctex("ter" + key, W, H, (g, r) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 20; i++) blotch(g, U(r, 0, W), U(r, 0, H), m(U(r, 0.6, 2)), r() > 0.5 ? "255,255,255" : "90,70,60", 0.07);
    for (let y = 0; y < H; y += m(0.4)) { g.fillStyle = "rgba(90,75,65,0.12)"; g.fillRect(0, y, W, 2); } // stone courses
    const floors = Math.max(1, Math.floor((hm - 0.6) / 3.3)), n = Math.max(1, Math.floor(wm / 2.0));
    for (let fl = 0; fl < floors; fl++) {
      const by = H - m(fl * 3.3 + 0.9);
      g.fillStyle = "rgba(255,250,240,0.55)"; g.fillRect(0, by + m(0.15), W, m(0.12)); // string course
      for (let i = 0; i < n; i++) {
        const cx = ((i + 0.5) * W) / n, ww = m(0.95), wh = m(1.9), x0 = cx - ww / 2, y0 = by - wh;
        g.fillStyle = "#f3eadb"; g.fillRect(x0 - m(0.1), y0 - m(0.22), ww + m(0.2), wh + m(0.32));
        const gl = g.createLinearGradient(0, y0, 0, y0 + wh); gl.addColorStop(0, "#7d8fc4"); gl.addColorStop(1, "#4a5590");
        g.fillStyle = gl; g.fillRect(x0, y0, ww, wh);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.save(); g.beginPath(); g.rect(x0, y0, ww, wh); g.clip(); g.translate(x0 + ww * 0.3, y0); g.rotate(0.6); g.fillRect(0, -50, m(0.08), wh * 2); g.restore();
        g.fillStyle = "#f3eadb"; g.fillRect(x0, y0 + wh * 0.5 - m(0.03), ww, m(0.06)); g.fillRect(cx - m(0.025), y0, m(0.05), wh);
        g.strokeStyle = "rgba(60,45,40,0.55)"; g.lineWidth = 1.5; g.strokeRect(x0 - m(0.1), y0 - m(0.22), ww + m(0.2), wh + m(0.32));
      }
    }
  });
};

/** checkered salon floor */
export const tilesHD = () => ctex("tilesHD", 512, 512, (g) => {
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.fillStyle = (i + j) % 2 ? "#2f2c36" : "#ece6da"; g.fillRect(i * 64, j * 64, 64, 64); }
});
/** red bristle doormat */
export const matHD = () => ctex("matHD", 512, 320, (g, r) => {
  g.fillStyle = "#a8423a"; g.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,180,150,0.18)" : "rgba(60,15,15,0.2)"; g.fillRect(U(r, 0, 512), U(r, 0, 320), 2, 5); }
  g.strokeStyle = "#7d2a26"; g.lineWidth = 16; g.strokeRect(14, 14, 484, 292);
});
/** desert sand */
export const sandHD = () => ctex("sandHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e3b77e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 120; i++) blotch(g, U(r, 0, 1024), U(r, 0, 1024), U(r, 30, 120), r() > 0.5 ? "255,230,190" : "170,110,70", 0.12);
  for (let i = 0; i < 40; i++) { g.strokeStyle = "rgba(170,115,70,0.18)"; g.lineWidth = 3; const y = U(r, 0, 1024); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(300, y - 30, 700, y + 30, 1024, y); g.stroke(); }
});
/** pool water seen from the deck: turquoise with light caustic lines */
export const poolHD = () => ctex("poolHD", 1024, 1024, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, "#38b8d8"); gr.addColorStop(1, "#1f8fc0");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = "rgba(220,250,255,0.45)"; g.lineWidth = 4;
  for (let i = 0; i < 70; i++) { const x = U(r, 0, 1024), y = U(r, 0, 1024); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 20, x + 60, y + 20, x + 90, y - 5); g.stroke(); }
});
/** cream deck tiles */
export const deckHD = () => ctex("deckHD", 512, 512, (g, r) => {
  g.fillStyle = "#cdbfa6"; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = jit(r, "#eee1c6", 0.04); g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); }
});
/** hotel glass (Vegas): bronze-gold bands */
export const hotelHD = () => ctex("hotelHD", 1024, 2048, (g, r) => {
  const gr = g.createLinearGradient(0, 2048, 0, 0); gr.addColorStop(0, "#6f8fb2"); gr.addColorStop(1, "#b9cfe6");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 2048);
  for (let i = 0; i < 18; i++) blotch(g, U(r, 0, 1024), U(r, 0, 1600), U(r, 50, 140), "255,240,220", 0.22);
  for (let k = 0; k <= 57; k++) { const y = (k * 2048) / 57; g.fillStyle = "rgba(230,214,180,0.9)"; g.fillRect(0, y - 4, 1024, 8); }
  for (let c = 0; c <= 24; c++) { g.fillStyle = "rgba(60,70,95,0.35)"; g.fillRect((c * 1024) / 24, 0, 3, 2048); }
});
/** garden shed planks */
export const shedHD = () => ctex("shedHD", 512, 512, (g, r) => {
  for (let x = 0; x < 512; x += 64) { g.fillStyle = jit(r, "#8a6a4a", 0.08); g.fillRect(x, 0, 64, 512); g.fillStyle = "rgba(40,25,15,0.45)"; g.fillRect(x, 0, 4, 512); }
});
