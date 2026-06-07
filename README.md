# Residue Focal Web — Advanced

A high-end Three.js generative art piece: a 62.5k-node modular-arithmetic lattice deformed into a 3D focal shell, woven with crossing strands, bright dew nodes, depth-of-field bokeh, bloom, and rich per-strand coloring.

**Dramatically upgraded** with zero-allocation hot paths, `LineSegments2` + per-segment colors, full bloom + vignette post pipeline, 5 powerful new generative parameters (curvature with real bent strands, polarity, resonance, nucleation, clustering), a complete export system, presets, and shareable URL hashes.

Inspired by the visual language of [@hive_echo](https://x.com/hive_echo)'s Residue Focal Web.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

### Production

```bash
npm run build
npm run preview
```

## New in this build (what you asked for)

**Performance**
- Structure completely decoupled from visual phase via "Structure Rate"
- Builder now writes directly into pre-allocated typed arrays (no giant push arrays / GC storms)
- Geometries and `LineSegments2` / materials are **reused and mutated in place** — no per-frame object creation or disposal
- Status bar shows live rebuild time + segment count

**Visual upgrades**
- Main strands now use `LineSegments2` + `LineMaterial` (world-space width, beautiful joins, per-segment colors driven by residue)
- Added `UnrealBloomPass` (glowing dew + strand accents that survive bokeh)
- Subtle screen vignette for stronger focal shell feeling
- Live controls for line width, dew size/glow, bloom, vignette
- Alive "pulse" on the brightest dew drops
- Much richer color response across the whole piece

**New generative parameters (big visual changes)**
- **Curvature** — bends many strands with real mid-point subdivision (not just wobble)
- **Polarity** — directional bias and warping of the weave
- **Resonance** — secondary phase beating inside the residue field
- **Nucleation** — soft attractor points that pull the shell and seed high-degree dew
- **Clustering** — biases strand seeding and local density

Plus all the classics (modulus, residue window, tension, thread density, veil, strands, phase, optics).

**Export & sharing (actually useful)**
- PNG stills at 1x / 2x / 4x (renders to high-res target, correct orientation)
- Video recording (WebM via MediaRecorder) — 8s/12s/20s presets + manual stop
- 6 beautiful built-in presets + save/load your own to localStorage
- URL hash sharing of the current artistic state (copy the URL after you find something nice)
- Keyboard: `r` = randomize, `space` = pause, `s` = screenshot, `f` = toggle GUI, `v` (during record) = stop
- `window.residueWeb` for console/script access

Drag to orbit, scroll to zoom. GUI starts closed — press `f` or click the top-right corner to open the full control surface.

## Controls (highlights)

See the **Generative**, **Strands**, **Veil & Dew**, **Optics**, **Presets**, and **Export** folders in the GUI.

## Stack

- Three.js (WebGL, LineSegments2, Points, BokehPass, UnrealBloomPass, ShaderPass)
- lil-gui
- Vite

## Credits

Original visual language and inspiration: [@hive_echo](https://x.com/hive_echo)

This advanced implementation, perf work, new features, and export system by Grok (xAI) in one focused session on the codebase at `/Volumes/InternalSATA/__Scripts/Bokah 3d Test`.

MIT license for the code. Have fun making and exporting beautiful focal webs.
