# Running the skill on your own PC

The 3D renderer (three.js inside Remotion) needs a real GPU. Cloud containers with no GPU fall back to software
WebGL, which gives blank frames or is far too slow. **Render on your own computer.** Cloud sessions are still fine
for research, scripts and audio.

## 1. Install the tools (once)
- **Node.js 20+**: https://nodejs.org
- **Python 3.11+**, then: `pip install numpy scipy pillow`
- **ffmpeg** on your PATH (Windows: `winget install ffmpeg`, macOS: `brew install ffmpeg`)
- **Google Chrome** (the stills script uses it if found, otherwise Remotion downloads its own browser)
- **Claude Code**: https://claude.com/claude-code

## 2. Get the repo and install the skill
Clone your fork, then make it available as a skill. On macOS or Linux:
```bash
git clone https://github.com/jeromes-lab/claude-animated-shorts.git ~/.claude/skills/cartoon-3d-short
```
On Windows, clone it to `%USERPROFILE%\.claude\skills\cartoon-3d-short`.

## 3. Install the Remotion project
```bash
cd ~/.claude/skills/cartoon-3d-short/studio
npm install
```
`studio/` is a ready Remotion project:
- `src/Root.tsx` registers the compositions. `BridgeShort` is the example short.
- `src/videos/bridge/` is the full bridge source, copied from `templates/bridge/`. Copy it to `src/videos/<name>/` for each new short.
- `scripts/` holds the stills, QA, side-by-side and merge helpers.
- `public/bridge/kenney/` is where the free Kenney 3D models go. See the README there; they are optional.

## 4. Check it works
```bash
npm run studio
```
This opens the live preview in your browser. To render test stills:
```bash
REMOTION_TMP=/path/on/big/drive/remotion-tmp REMOTION_GL=angle node scripts/bridge-stills.mjs out/bridge/x_ 100,900 0.5
```
On Windows PowerShell, set the variables first with `$env:REMOTION_TMP="D:/remotion-tmp"; $env:REMOTION_GL="angle"`.

Environment variables for `bridge-stills.mjs`:
| Variable | Meaning |
|---|---|
| `REMOTION_TMP` | Temp folder for bundles (each one is ~1 GB or more; use a big drive and clean it out) |
| `REMOTION_GL` | `angle` (GPU, default on Windows), `swangle` (software, the default elsewhere), `egl`, `vulkan` |
| `CHROME_PATH` | Path to a Chrome/Chromium binary (optional) |
| `COMP` | Composition id to render (default `BridgeShort`) |
| `POST` | Post-effect toggles for A/B stills, e.g. `{"ink":false,"grade":false}` |

## 5. Make a short
Start Claude Code inside `studio/` and say: *"Use the cartoon short skill and make a short about …"*.
Claude follows `SKILL.md`: facts, then script, then voice, then shot plan, then stills, then the final render.

Final 2K render:
```bash
npx remotion render src/index.ts BridgeShort out/bridge/video.mp4 --codec h264 --crf 16 --scale 1.3333 --gl angle
```
