// Channel art for "Fact Fumble": the mascot (our own bean-head cast drawing, canvas) and a wide backdrop of the painted
// London street rendered by the same world + post chain with a fixed camera.
import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getInputProps } from "remotion";
import { Pen, bodyFront, Outfit, Expr, Prop, SKINS } from "./toon";
import { ShotView, useKit } from "./Bridge";
import { CAM_OVERRIDE } from "./world";
import { V3 } from "./story";

export const FUMBLER: Outfit = {
  jacket: "#e8553a", pants: "#2f3e5c", boots: "#3a2a22", hat: "hair", hair: "#3a2418", glasses: "round", shirt: "#f4ecd8", tie: "#2f6fb5",
  skin: SKINS[1],
};

/** mascot on a canvas: mode "avatar" = bust on a sunburst (square), "full" = whole figure on transparent */
export const MascotArt: React.FC<{ mode: "avatar" | "full"; size: [number, number] }> = ({ mode, size }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [h] = useState(() => delayRender("mascot"));
  const p = getInputProps() as { expr?: Expr; prop?: Prop };
  useEffect(() => {
    const cv = ref.current!, g = cv.getContext("2d")!, [W, H] = size;
    g.clearRect(0, 0, W, H);
    if (mode === "avatar") {
      // sunburst: warm yellow-orange rays from the centre, soft vignette to coral
      const cx = W / 2, cy = H * 0.52;
      g.fillStyle = "#ff9f3a"; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI * 2, a1 = a0 + Math.PI / 24;
        g.fillStyle = i % 2 ? "#ffc23d" : "#ffb03a";
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, W, a0, a1); g.closePath(); g.fill();
      }
      const vg = g.createRadialGradient(cx, cy, W * 0.2, cx, cy, W * 0.75);
      vg.addColorStop(0, "rgba(255,240,180,0.55)"); vg.addColorStop(1, "rgba(230,70,60,0.55)");
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    // the figure: design space 600 x 1000 (soles at 975)
    const s = mode === "avatar" ? W / 430 : H / 1010, ox = mode === "avatar" ? W / 2 - 300 * s - 0.02 * W : W / 2 - 300 * s;
    const oy = mode === "avatar" ? H * 0.5 - 330 * s + H * 0.16 : 0;
    g.save(); g.translate(ox, oy); g.scale(s, s);
    bodyFront(new Pen(g), FUMBLER, { mode: "stand", expr: p.expr ?? "grin", prop: p.prop ?? "point", light: (-120 * Math.PI) / 180, seed: 3, facing: 0 });
    g.restore();
    if (mode === "avatar") {
      // a fumbled "?" and "!" popping off
      const glyph = (t: string, x: number, y: number, sz: number, rot: number, col: string) => {
        g.save(); g.translate(x, y); g.rotate(rot); g.font = `${sz}px Impact`; g.textAlign = "center"; g.textBaseline = "middle";
        g.lineJoin = "round"; g.lineWidth = sz * 0.14; g.strokeStyle = "#241726"; g.strokeText(t, 0, 0); g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
      };
      glyph("?", W * 0.2, H * 0.27, W * 0.2, -0.35, "#ffffff");
      glyph("!", W * 0.83, H * 0.22, W * 0.17, 0.3, "#fff36b");
    }
    continueRender(h);
  }, [h, mode, size, p.expr, p.prop]);
  return <canvas ref={ref} width={size[0]} height={size[1]} style={{ width: "100%", height: "100%" }} />;
};

export const ChannelAvatar: React.FC = () => <AbsoluteFill><MascotArt mode="avatar" size={[1600, 1600]} /></AbsoluteFill>;
export const ChannelMascot: React.FC = () => <AbsoluteFill><MascotArt mode="full" size={[1000, 1600]} /></AbsoluteFill>;

/** wide London street backdrop, 2560 x 1440; camera from inputProps or a default along the street toward the tower */
export const ChannelBanner: React.FC = () => {
  const kit = useKit();
  const ip = getInputProps() as { cam?: { pos: V3; look: V3; fov: number }; id?: number };
  CAM_OVERRIDE.c = { pos: [34, 4.5, 3.0], look: [-4, 15, -9], fov: 38, roll: 0, ...(ip.cam ?? {}) };
  if (!kit) return null;
  return <AbsoluteFill style={{ background: "#cfe3f2" }}><ShotView id={ip.id ?? 7} kit={kit} alpha={1} w={2560} h={1440} /></AbsoluteFill>;
};
