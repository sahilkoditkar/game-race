# Apex Rush — 3D arcade racing in the browser

A complete 3D car racing game built with [Three.js](https://threejs.org/) and plain ES modules.
No build step, no bundler, no server-side code: the repository *is* the website, so it can be
hosted directly on GitHub Pages (or any static host).

**Features**

- Five hand-built circuits with distinct themes: club circuit, coastal esses, desert hairpins,
  snowy alpine road and a neon night street circuit.
- Arcade driving model with drift handbrake, off-road grip loss, barrier and car-to-car collisions.
- **Split-screen multiplayer**: two players on one keyboard (WASD vs arrow keys) or two gamepads.
  The screen splits left/right on wide displays and top/bottom on tall ones.
- **Career mode**: four championships (Rookie Cup → Pro Series → Grand Prix → Legends Endurance),
  points standings, prize money, a garage with four purchasable cars and four upgrade lines.
  Progress is saved in the browser (`localStorage`).
- Quick Race and Time Trial modes with adjustable laps, opponent count and AI difficulty.
- AI drivers with racing lines, braking for corners, overtaking/avoidance and un-stuck logic.
- Per-player HUD with position, lap timer, best lap, minimap and live standings.
- Procedural engine, skid, impact and countdown sounds (Web Audio, no asset files).

## Play locally

Any static file server works. For example:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk will not work because browsers block ES-module imports
from `file://` URLs.

## Deploy to GitHub Pages

Two options; both need nothing more than the repository contents.

**Option A — GitHub Actions (included).** Push to `main` (or `master`). The workflow in
`.github/workflows/deploy.yml` uploads the repository root to GitHub Pages. In the repository
settings under *Pages*, set **Source** to **GitHub Actions** the first time.

**Option B — Deploy from branch.** In *Settings → Pages*, choose **Deploy from a branch**, pick
`main` and the `/ (root)` folder. The included `.nojekyll` file makes Pages serve the files as-is.

Your game will be available at `https://<user>.github.io/<repo>/`. All asset paths are relative,
so it works from a project sub-path as well as from a custom domain.

## Controls

| Action            | Player 1        | Player 2                | Gamepad            |
|-------------------|-----------------|-------------------------|--------------------|
| Accelerate        | `W`             | `↑`                     | RT / A             |
| Brake / reverse   | `S`             | `↓`                     | LT / X             |
| Steer             | `A` / `D`       | `←` / `→`               | Left stick         |
| Handbrake (drift) | `Shift` / `Space` | `Right Shift` / `Right Ctrl` | B / RB      |
| Reset to track    | `R`             | `.`                     | Y                  |
| Pause             | `Esc`           | `Esc`                   | Start              |

Gamepad 1 controls Player 1 and gamepad 2 controls Player 2. Key schemes can be swapped in
*Settings*.

## Project layout

```
index.html            entry page, import map, HUD/menu containers
style.css             menus and HUD styling
vendor/three.module.js vendored Three.js (r170) so no CDN is needed
src/main.js           app state machine, render loop, race lifecycle
src/race.js           race manager: physics loop, collisions, laps, ranking, split-screen rendering
src/car.js            car physics and procedural car meshes (4 body styles)
src/ai.js             AI driver behaviour
src/track.js          spline sampling, road/curb/barrier geometry, track queries
src/tracks.js         track definitions (control points) and visual themes
src/scenery.js        ground, trees, buildings, mountains, grandstand, sponsor boards
src/hud.js            per-player HUD and minimap
src/ui.js             all menu screens (main, setup, career, garage, settings, results, pause)
src/career.js         save/load, championships, prize money, garage logic
src/data.js           cars, upgrades, series, AI roster, points table
src/input.js          keyboard schemes and gamepad polling
src/audio.js          procedural Web Audio sound effects
```

## Adding a track

Add an entry to `src/tracks.js` with an `id`, `name`, `theme` (one of `grass`, `coastal`,
`desert`, `alpine`, `city`), a road `width` and a list of 2D control `points`. The points are
joined by a closed Catmull-Rom spline; keep neighbouring points roughly 80–150 m apart and avoid
crossings. The car starts at the first point heading toward the second.

## License

Game code: MIT. Three.js is © its authors, MIT licensed (see `vendor/THREE_LICENSE`).
