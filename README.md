# Cheeky Run 🍑👂

A butt with ears, on the run — a toon-shaded 3D endless runner built with
[Three.js](https://threejs.org/) and bundled with [Vite](https://vitejs.dev/).

Swipe between lanes, hop (double-jump!), duck under bars, grab toilet rolls and
dodge cacti.

## Play

- **Swipe ◀ ▶** / **Arrow keys** — change lanes
- **Tap / swipe ▲** / **Up / Space** — hop (double-jump!)
- **Swipe ▼** / **Down** — duck under bars
- 🧻 grab rolls · 🌵 dodge cacti

## Develop

Requires Node.js 20+.

```bash
npm install      # install dependencies
npm run dev      # start the dev server with hot reload
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

## Project layout

The game used to live in a single HTML file; it is now split into focused
ES modules under `src/`:

| File | Responsibility |
| --- | --- |
| `index.html` | Markup: HUD, overlays, canvas mount point |
| `src/style.css` | All styling |
| `src/main.js` | Entry point — scene setup, spawning, game flow, controls, loop |
| `src/config.js` | Shared constants and small utilities |
| `src/materials.js` | Cel-shading gradient, toon material, ink outline helpers |
| `src/props.js` | Mesh factories (obstacles, rolls, trees, bushes, flowers, clouds) |
| `src/player.js` | Builds the player character |
| `src/particles.js` | Reusable particle pool (dust, sparkle, debris) |
| `src/audio.js` | Chiptune music engine + sound effects (Web Audio API) |

## Deployment

Every push to `main` triggers the
[`Deploy to GitHub Pages`](.github/workflows/deploy.yml) workflow, which builds
the site with Vite and publishes `dist/` to GitHub Pages.

The Vite `base` is set to `./` (relative) so the build works whether it is
served from a user/org Pages root or a project subpath.

### One-time setup

In the repository **Settings → Pages**, set **Source** to **GitHub Actions**.
After that, each commit to `main` deploys automatically.
