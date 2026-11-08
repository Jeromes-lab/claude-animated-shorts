// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, GPU via ANGLE, jpeg)
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
import fs from "node:fs";
// Remotion bundles fill the temp folder (~1.3 GB each): set REMOTION_TMP to a folder on a big drive
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
// CHROME_PATH overrides the browser; otherwise Windows Chrome if present, else the container's Chromium (or Remotion's own).
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/opt/pw-browsers/chromium"].filter(Boolean);
const browserExecutable = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
// Real GPU: REMOTION_GL=angle. Headless Linux/cloud without a GPU: swangle (software WebGL, slower).
const chromiumOptions = { gl: process.env.REMOTION_GL || (process.platform === "win32" ? "angle" : "swangle") };
// POST='{"ink":false}' passes post-effect toggles (see Bridge.tsx) for A/B test stills.
const inputProps = process.env.POST ? { post: JSON.parse(process.env.POST) } : {};
const compId = process.env.COMP || "BridgeShort";
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: compId, inputProps, browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (!l.text.includes("404") && !l.text.includes("Failed to load resource")) console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), inputProps,
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
