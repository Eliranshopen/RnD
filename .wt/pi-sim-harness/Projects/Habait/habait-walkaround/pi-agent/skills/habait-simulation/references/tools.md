# Tool index (run from habait-walkaround; `node` tools need HABAIT_APP_DIR; Python = the venv with -I -X utf8)

Each tool prints its usage when run with no arguments. Read the header comment of a tool before its first use.

## Trace and build (Habait/tour360/tools/)
| tool | does | paid? |
|---|---|---|
| `auto-trace.mjs <pdf> --out <dir> --id <id> [--budget 1] [--dry]` | sales plan → plan.general.json + overlay + report | yes (vision) |
| `run-project.mjs <id> --plan <p> --crop <c> [--steps …] [--skin]` | the whole chain; `--parity` checks the runner matches the house recipe | skin step only |
| `skin-project.mjs <id> [--scenes a,b] [--soft 40] [--hard 60] [--dry]` | photoreal look per scene, gated, repaired | yes |
| `make-scenes.mjs <id>` | scenes.json from cameras + hotspot-pins.json | no |
| `make-sets.mjs <id> [--only <asset>]` | panos/balanced, thumbs, full set from picks.json | no |
| `make-tiles.mjs <id> --only <asset>` | cube tiles for one picture | no |
| `scan-pieces.mjs <id> --scenes <room> --force` | the furniture markers (needs FAL_KEY in the env: `node --env-file=<repo>/.env`, never read the file) | yes, ≈$0.04/scene |
| `build-tour.mjs <id> --catalog=ai [--apartments <dir>] [--out <dir>]` | the built tour; refuses an ungated picture | no |

## Look and fixes
| tool | does | paid? |
|---|---|---|
| `gen-pano.mjs <id> <entry> <model> --prompts <file> [--seed N] --cap <usd> [--dry]` | one image edit/generation per entry of a prompts file; cached by hash | yes |
| `close-seam.mjs <id> <asset> [--band-deg 12] [--u …] [--dry]` | repaint a vertical band (seam / a wrong element) guided by the CG | yes |
| `polygon_paste.py --spec <spec.json>` | take an answer's polygons onto the shipped picture of every floor set, install with backups and source records | no |
| `region_paste.py`, `paste_object.py`, `recolour_region.py`, `floor_planks.py` | rectangle paste, move a dark fixture, recolour, parquet | no |
| `furn-crop`-style cuts: `qa/views.mjs` | straight views from a picture | no |

## Gates and checks
| tool | does | paid? |
|---|---|---|
| `fidelity-gate.mjs <id> --scenes <asset> [--skin <file>] --cg-tour <cg id>` | the 1 % plan gate for one picture | $0.01 (cached) |
| `consistency-check.mjs <id> --group <g> [--judge]` | one element from every tab, designed vs CG | judge ≈$0.01 |
| `hotspot-check.mjs <id>` | every room button on the plan | no |
| `point-move-check.mjs <tour url> --out <dir>` | the tour's movement in a browser | no |
| `qa/allbuttons.mjs <tour url> <out> [room…]` | every room button: visible, no overlap, arrives, at 1440 and 390 | no |
| `qa/levelview.mjs <tour url>` | every button visible at the level view | no |
| `qa/views.mjs <tour url> <out> <room:yaw[:floor]> …` | screenshots of chosen views at 1440 and 390 | no |

## Shipping (Habait/tour360/tools/ship/)
| tool | does |
|---|---|
| `C:/RnD/Projects/Habait/tools/deploy-vercel/stage_flow.py <stage> --edit-api --studio` | stages the whole site from the live tree (prints `PREDEPLOY GATE: PASS/FAIL`) |
| `ship/cmpstage.py <old stage> <new stage>` | what changed between two stages |
| `ship/deploy-test.sh <stage> <stage log>` | deploys a stage to `rainbow-v2-test` only (checks the gate line and the project link) and compares served files |

## Ledgers
- `Habait/tour360/apartments/<id>/_local/ledger.json`: every paid call of that apartment (`rows`, `reserved_usd`/`settled_usd`).
- Task ledgers under `qa-evidence/…/ledger.json` (films, 3D furniture).
- `habait_spend` sums them.
