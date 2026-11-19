# v2/media/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The stills of the Rainbow v2 test page, made at $0 from media already on disk by `../../tools/make_v2_media.py` (ffmpeg + headless Chrome). Every file has a row (input, sha256, args, cost 0) in `manifest.json`; `manifest.json` also carries `floor16` (where floor 16 sits in the hold frame) and the room yaws.

## What's here
| File | What |
|---|---|
| `tower-16-1920.jpg`, `-960.jpg`, `-portrait.jpg` | the hold's stop pose, Kling frame 91 of `research/…/flyover3d/data/holdarc/jpg_hi/` (re-encode / 2:3 crop only) |
| `room-<id>-wide.webp` / `-tall.webp` / `-thumb.webp` | flat views (ffmpeg `v360`, no edit) of the gated tour panoramas `tour360/dist/apt846/panos/*.webp`, 8 rooms |
| `dollhouse.webp` | a still of the live dollhouse `tour360/dist/apt846/3d/dollhouse.html` (preset 3d, UI and labels hidden, alpha, trimmed) |
| `manifest.json` | one row per output + `floor16` + `rooms` |

## Gotchas
- All of it is AI-made property imagery: the page shows «הדמיה · AI-generated» on each (root §6).
- The panoramas are 2048×1024, so a full-screen flat is soft on a large desktop; a sharper gated set would fix it (not here: never use an ungated pano).
- Re-run = `python tools/make_v2_media.py --go` from `Habait/platform`; a step whose output hash, input hash and args match its row is skipped.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
