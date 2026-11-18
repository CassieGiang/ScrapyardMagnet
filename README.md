# Scrapyard Magnet

A small, playable 2D salvage game. Pull scrap into a horseshoe magnet, sell your haul, upgrade your equipment, and recover five parts to restore Rusty the robot.

## Play online

Once GitHub Pages is enabled, play at https://cassiegiang.github.io/ScrapyardMagnet/ — no installation required.

Pages serves the static browser files directly from the root of `main`. `.nojekyll` disables unnecessary Jekyll processing. The Node server is only needed for local play.

## Play locally

Requires Node.js 20 or newer. No packages or installation step required.

On Windows, double-click **Start Game.cmd**, then open http://127.0.0.1:4173 in your browser. Keep the terminal window open while playing.

Or run this from the game folder in any terminal, including PowerShell:

```sh
node server.js
```

Open http://127.0.0.1:4173. The server binds only to your computer. Set `PORT` to choose another port.

If PowerShell blocks `npm.ps1`, use `node server.js` directly or `npm.cmd start`. No execution-policy changes are needed. If the port is already in use, an instance may already be running; open the address above.

## Controls

- Each yard has a sealed locker. Clear scrap within its marked area, then hold click or Space with the magnet in the circle to the right for 1.6 seconds. Its door slides open to reveal a collectible and bank a cash reward. The camera, radio, and drone are kept on the Keeper's shelf; each locker pays only once, including on repeat expeditions.
- Explore three finite yards: North yard, Rail depot, and Reactor ruins. Scrap stays cleared. Bank enough pieces to expose each yard's wreck, then hold your magnet over its center for 2.5 seconds to recover it and claim the cash reward. Sell any remaining cargo before travelling.
- Travel preserves credits, workshop upgrades, and Rusty's parts. Yard progress saves when cargo is sold; unbanked cargo is returned to the pile on reload. After the third wreck, the route can be replayed.
- Motors require pull power level 3; reactor cores require level 4. Later upgrades cost more, while the first purchases remain affordable. Existing saves keep their purchased upgrades.
- Salvage jobs pay bonus cash for bringing the requested cargo in a single haul. The first six-piece delivery pays at least $38, enough for the first power upgrade.
- Bring 6 pieces for a 1.5× scrap payout, or 10 for 2×. Job bonuses are added after the multiplier.
- The first power upgrade unlocks Magnetic Blast: press E or the Blast button to pull from a much larger area for a short burst. It recharges in seven seconds; higher power levels strengthen it.
- Move the pointer to steer; hold the primary mouse button to attract scrap.
- Touch: drag and hold to move and attract.
- Keyboard: WASD / arrow keys to move, Space to attract, P to pause.
- Enter the green sell bay at the bottom to unload automatically.
- Spend credits in the workshop. Pull power level 2 unlocks engines.
- Glowing robot parts appear after selling 8, 22, 45, 75, and 110 pieces. Attract them to restore Rusty. They do not consume cargo capacity.
- Sound is optional. The game pauses when the window loses focus.

Credits, upgrades, and restored parts save automatically in this browser. Cargo and the randomized scrap layout reset on reload. Use “Start a fresh yard” to reset progress, with confirmation.

## Check

```sh
node --test
```

Tests cover the collection/selling/upgrade loop, job rewards, cargo weight limits, salvage unlocking, upgrade limits, saved-state migration, wreck recovery, travel, and simulated game frames for the first haul and blast cooldown. Frame tests use a minimal DOM/canvas stub; they do not replace a visual browser playtest.

## Scope

Dependency-free HTML, CSS, JavaScript, Canvas, SVG, and synthesized sound. All game visuals are drawn in code. Optional Google Fonts fall back to system fonts when offline. No analytics, accounts, backend, or paid assets. This prototype is designed for quick playtesting rather than production release.

`engine.js` contains progression rules; `game.js` handles input, simulation, drawing, sound, and browser saves. Any static web host can serve the five browser files (`index.html`, `style.css`, `game.js`, `engine.js`, plus optional README); `server.js` is only the local development server.
