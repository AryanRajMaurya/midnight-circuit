# MIDNIGHT CIRCUIT

A free-roam drive through a procedural neon city. One HTML file, one canvas, no
build step, no model, texture or audio file — the district, the car, the sky and
the engine note are all generated in code.

An original project in the spirit of the synthwave driving demos around — not a
copy of any of them.

## Run it

Any static file server from this directory:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000
```

It needs to be served over HTTP (ES modules do not load from `file://`).

## Controls

| Action | Key |
| --- | --- |
| Throttle / brake-reverse | `W` / `S` (or arrows) |
| Steer | `A` / `D` |
| Look around | drag, or the wheel to tilt |
| Nitrous | `shift` |
| Recover the car onto the nearest road | `R` |
| Pause | `esc` |

## What's inside

- **The district** — a 9×9 block grid on a fixed seed, so it is identical on
  every visit. Buildings are one merged mesh per facade family with UVs scaled in
  world units, so windows stay crisp on a 10-metre shop or a 90-metre tower.
  Instancing a unit box instead would stretch one texture over every height and
  the windows would smear into streaks.
- **The ground** — a single 2048² canvas drawn once: blocks, kerbs, neon kerb
  lines, centre dashes and a pool of light at every intersection.
- **The car** — arcade physics. The velocity vector is split into forward and
  lateral parts; the chassis yaws, the same world velocity is re-read in the new
  basis, and grip erases the difference. Grip drops under nitrous, which is what
  lets the tail step out. Buildings are circle-vs-AABB, bucketed by block.
- **The camera** — a chase rig that widens and lifts with speed, kicks the FOV,
  shakes under nitrous or impact, and eases back behind the car when you let go
  of the mouse.
- **The sound** — two detuned oscillators through a lowpass for the engine (pitch
  and cutoff follow speed), filtered noise for wind and tyre slip, and a slow
  detuned pad for the city. Nothing is downloaded.
- **Three times of day** — dusk, night, midnight — cross-faded over about a
  second and reflected in the sky shader, the fog and the light intensities.

## Verification

```bash
node tools/verify.mjs
```

14 checks: boot, title, draw-call budget, driving, steering, nitrous, frame
loop, time-of-day change, pause/resume and a page-error sweep.

The frame-rate check is a floor, not a figure — the CI sandbox renders through
SwiftShader (software), so it only asserts the loop is alive. On a real GPU the
scene is 35 draw calls and about 11k triangles.

## Layout

```
index.html        markup and screens
styles.css        interface
src/main.js       boot, loop, screens
src/world.js      sky, ground, city, collision, time of day
src/car.js        car mesh and physics
src/camera.js     chase camera
src/input.js      keyboard and pointer
src/audio.js      synthesis
src/hud.js        speed, district, minimap
vendor/           three.js r160 (MIT)
```
