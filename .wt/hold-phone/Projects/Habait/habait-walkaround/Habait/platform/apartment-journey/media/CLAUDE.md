# apartment-journey/media/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The media of the apartment journey, made at $0 from media already on disk by `../../tools/make_journey_media.py` (ffmpeg + headless Chrome). Every file has a row (input, sha256, args, cost 0) in `manifest.json`. `manifest.json` also carries:
- `floor16`: where floor 16 sits in the hold frame;
- `rooms`: the static views picked by eye;
- `walk`: every bearing of the walk and its source.

## What's here
| File | What |
|---|---|
| `tower-16-1920.jpg`, `-960.jpg` | the hold's stop pose, Kling frame 91 of `research/…/flyover3d/data/holdarc/jpg_hi/` (re-encode only). `tower-16-portrait.jpg` (a 2:3 crop) is kept but unused since round 2. |
| `room-<id>-wide.webp` / `-tall.webp` / `-thumb.webp` | one flat view per room, picked by eye: the static page and the filmstrip |
| `walk/` | the walk's frame sequences, one folder per room (see `walk/CLAUDE.md`) |
| `walk.json` | what the page reads: the rooms in walk order, frames and turns |
| `dollhouse.webp` | a still of the live dollhouse `tour360/dist/apt846/3d/dollhouse.html` |
| `manifest.json` | one row per output + `floor16` + `rooms` + `walk` |

## Gotchas
- All of it is AI-made property imagery: the page shows «הדמיה · AI-generated» on each (root §6).
- The panoramas are 2048×1024, so a full-screen flat is soft on a large desktop. Only a sharper GATED set would fix it.
- Re-run with `python tools/make_journey_media.py --go` from `Habait/platform`. A step whose output hash, input hash and args all match its row is skipped.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
