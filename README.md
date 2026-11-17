# NEON BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Reki120/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Reki120/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**An open-world crime game in the browser: steal cars, outrun the cops, and work off your debt to the fixer Mara Voss.**

You are Rook, a getaway driver in debt to Mara Voss. Neon Bay is yours — a procedural dusk city of downtown towers, parks, a beach and a harbour, full of traffic, pedestrians and patrol cars. Take jobs from Mara, earn cash, and don't get busted.

## How to play

Open `game/index.html` (or serve `game/` with any static server) and press Enter or click to start. No install, no network at play time — three.js is vendored and all art and sound are generated in code.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| Shift | Run |
| Space | Jump |
| Mouse drag | Look around |
| Click | Shoot the pistol (on foot) |
| R | Reload (12-round magazine) |
| E | Enter / exit a car, start a mission at the pink marker |
| M | Mute / unmute sound (button top-right too) |
| Esc / P | Pause |

## Features

- **Open city** — 10×10 blocks of procedural buildings, parks, beach and harbour water, all generated from a seed
- **Driving + on foot** — arcade car physics with drift, enter and steal parked cars
- **Police + wanted level** — 0–5 stars; stealing, ramming and shooting raise the heat, patrol cars pursue, ram and arrest; lose them to cool off, or get busted and lose 25% of your cash
- **4 missions for Mara Voss** — a pickup run ($400), stealing the Lagoon coupe ($600), losing a 2-star tail ($500), and the timed 3-stop Big Score ($1,200), with a beacon and minimap marker for every objective
- **Pistol combat** — on-foot shooting with tracer, reload, and police return fire at 3+ stars
- **Synthesized sound** — WebAudio engine hum, police siren, gunshots, mission chimes and a synthwave loop; no audio files
- **HUD + minimap** — cash, speed, health, wanted stars, objective line, and a live top-down map
- **Save / load** — cash, best cash and completed missions persist in localStorage
- **Screenshot scenes** — `?shot=start|drive|foot|chase&seed=1` stages four fixed scenes for the entry dossier

## Entry

Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
