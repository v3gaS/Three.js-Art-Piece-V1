# Three.js Art Piece V1

A Three.js generative visualization — modular-arithmetic lattice mapped onto a 3D focal shell, woven into crossing strands with depth-of-field bokeh.

Inspired by [@hive_echo](https://x.com/hive_echo)'s [Residue Focal Web](https://x.com/hive_echo/status/2063038270297252248) / [echohive.ai](https://www.echohive.ai/).

**Repository:** [github.com/V3gaS/three-js-art-piece-v1](https://github.com/V3gaS/three-js-art-piece-v1)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

Output goes to `dist/`.

## Controls

| Parameter | Role |
|-----------|------|
| **Iteration Rate** | How fast the phase advances (animated rebuild) |
| **Modulus** | Modular arithmetic base (residue classes) |
| **Residue Window** | Max circular residue distance for connections |
| **Tension** | Radial wobble from residue classes |
| **Thread Density** | Length of modular strand walks |
| **Veil Weight** | Outer veil lattice opacity |
| **Dew Current** | Highlight strength at high-degree nodes |
| **Focus Plane** | Bokeh focal distance |
| **Aperture** | Bokeh blur strength |
| **Strands** | Number of modular multiplication paths |
| **Phase** | Seed offset for the residue field |

Drag to orbit. Scroll to zoom.

## How it works

1. **62.5k nodes** — a `250×250` grid on a deformed 3D shell with per-node residue `(3u + 5v + phase) mod M`
2. **Strands** — coprime multiplication walks mod `M`, connecting when residues fall inside the window
3. **Local mesh** — grid neighbors linked when residues are compatible
4. **Dew drops** — highlighted high-degree intersection nodes
5. **Post-processing** — Three.js `BokehPass` for the focal blur

## Project structure

```
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js          # Scene, camera, BokehPass, GUI
│   ├── residueWeb.js    # Geometry + strand generation
│   └── style.css
└── README.md
```

## Stack

- [Three.js](https://threejs.org/) — WebGL, `LineSegments`, `Points`, `BokehPass`
- [lil-gui](https://github.com/georgealways/lil-gui)
- [Vite](https://vite.dev/)

## Credits

- Original concept and demo: [@hive_echo](https://x.com/hive_echo)
- **Three.js Art Piece V1** by [V3gaS](https://github.com/V3gaS)

## License

MIT — see [LICENSE](LICENSE).
