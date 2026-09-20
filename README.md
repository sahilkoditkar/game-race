# Apex Rush — 3D arcade racing in the browser

A complete 3D car racing game built with [Three.js](https://threejs.org/) and plain ES modules.
No build step, no bundler, no server-side code: the repository *is* the website, so it can be
hosted directly on GitHub Pages (or any static host).

**Features**

- Sixteen circuits with elevation: eight original themed tracks (club circuit, coast, harbour,
  desert, canyon, alpine, forest, neon night city) and eight layouts inspired by real-world
  circuits: Silverstone, Monza, Spa-Francorchamps, Interlagos, Red Bull Ring, Bahrain, Circuit
  of the Americas and Zandvoort. Real circuits carry hand-authored height profiles (Eau Rouge
  climbs, the Red Bull Ring hillside, the Senna S plunge); originals get rolling terrain.
- Nine cars, from a vintage roadster and a muscle car to a rally hatch, supercar, hypercar,
  endurance prototype and open-wheel single seater.
- Arcade driving model with a grip-limited bicycle steering model, drift handbrake, off-road
  grip loss (the rally car barely cares), slope gravity, barrier and car-to-car collisions.
- **Split-screen multiplayer**: two players on one keyboard (WASD vs arrow keys) or two gamepads.
  The screen splits left/right on wide displays and top/bottom on tall ones.
- **Career mode**: four championships (Rookie Cup → Pro Series → Grand Prix → Legends Endurance),
  points standings, prize money, a garage with four purchasable cars and four upgrade lines.
  Progress is saved in the browser (`localStorage`).
- Quick Race and Time Trial modes with adjustable laps, opponent count and AI difficulty
  (Easy, Medium, Hard, or **Dynamic**, where the AI learns your lap times during the race and
  paces itself around you: a few drivers just quicker, most just slower).
- Road width varies from track to track and along each lap, from tight 10 m street sections
  to 20 m+ desert straights.
  Time Trial replays your best lap as a translucent **ghost car** (stored per track and car).
- Touch controls appear automatically on phones and tablets.
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

**Option A — Deploy from branch (current setup).** In *Settings → Pages*, choose
**Deploy from a branch**, pick `main` and the `/ (root)` folder. Every push to `main` is
published automatically. The included `.nojekyll` file makes Pages serve the files as-is.

**Option B — GitHub Actions.** `.github/workflows/deploy.yml` uploads the repository root to
GitHub Pages. It is manual-only (`workflow_dispatch`) so it does not conflict with Option A; set
**Source** to **GitHub Actions** and add a `push` trigger if you prefer this route.

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

On touch devices, on-screen steering, gas, brake and drift buttons are shown for Player 1.

Each player picks their controls (WASD, arrows, gamepad 1, gamepad 2, or touch) on the race
setup screen; the choice is remembered. Career uses the Player 1 choice, changeable on the
career screen or in *Settings*.

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
src/tracks.js         track definitions (control points, incl. real-circuit-inspired layouts) and themes
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
`desert`, `forest`, `alpine`, `city`), `kind` (`real` or `original`), a road `width` and a list
of 2D control `points`. The points are joined by a closed Catmull-Rom spline; keep neighbouring
points roughly 80–150 m apart and avoid crossings. The car starts at the first point heading
toward the second. Optionally add `elevation: [[t, height], ...]` keypoints (t is the lap
fraction from the start line) or an `elevationAmp` for a seeded rolling profile.

## License

Game code: MIT. Three.js is © its authors, MIT licensed (see `vendor/THREE_LICENSE`).
