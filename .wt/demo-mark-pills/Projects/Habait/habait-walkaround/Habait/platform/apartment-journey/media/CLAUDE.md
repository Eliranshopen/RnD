# apartment-journey/media/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The media of the apartment journey (round 4), made at $0 by `../../tools/make_journey_media.py`. Every file has a row (input, sha256, args, cost 0) in `manifest.json`; `manifest.json` › `floor16` says where floor 16 sits in the hold frame.

## What's here
| File | What |
|---|---|
| `tower-16-1920.jpg`, `tower-16-960.jpg` | the hold's stop pose: Kling frame 91 of `research/…/flyover3d/data/holdarc/jpg_hi/` (re-encode only) |
| `manifest.json` | the rows above + `floor16` |

## Gotchas
- The living-room landing is NOT a file here. `journey.js` draws it at run time from the tour's own panorama (`/tour/panos-parquet/04-living.webp`), so it is always the tour's current picture.
- Round 3's room views, walk frames and dollhouse still moved to `../../tools/_unused/apartment-journey-r3/media/`, with their manifest (`manifest-r3.json`).
- All of it is AI-made property imagery: the page shows «הדמיה · AI-generated».

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
