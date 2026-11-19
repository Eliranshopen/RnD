# The project package — what the live site reads per project (template vs data)
<!-- written 2026-11-04 by fork C of session rnd-67 (project runner); Eliran: the site is a fixed TEMPLATE + one DATA PACKAGE per project -->

habait-flow.vercel.app = **template** (code, the same for every project) + **package** (data, one per project). A new project is a new
package plugged into the same template at a new address. No code is written per project. `tools/run-project.mjs` writes the package to
`out/<id>/package/`; `run-project.mjs <id> --steps publish-local` serves template + package at `/p/<id>/` and `/p/<id>/tour/`.
On habait-flow the same addresses are served by `api/studio-pub.mjs` from the private Blob store (the runner uploads the package and
the pointer `studio/pub/<id>.json`), so a new project needs no deploy (fork F, 2026-11-05).

## Template (never per project)
| Path on the site | Source | What |
|---|---|---|
| `/`, `/landing.html`, `/apartment.html`, `/flow.html`, `/js/*`, `/css/*`, `/fonts/*` | `Habait/platform/` | project page, unit picker, apartment page |
| `/tour/index.html` (the viewer code inside it) | `Habait/tour360/viewer/` via `build-tour.mjs` | the 360 viewer, rings, catalog swap, typed bar, look and finish switches |
| `/api/tour-edit` | `Habait/tour360/server/` | the typed bar and the catalog swap (FAL_KEY, open host) |
| `/tour/catalog/*` + `api/catalog.json` | `Habait/tour360/catalog/` (AI rows) | the furniture catalog, shared by every project |
| `copy/tour360-copy.json` | `Habait/tour360/copy/` | the badge, the concept line, the AI note (approved disclosure wording) |
| `/studio/*`, `/api/studio-*` | `Habait/studio-web/` | the developer portal |
| `/p/<id>/…` | `Habait/studio-web/api/studio-pub.mjs` + `vercel.json` rewrites (`stage_flow.py --studio`) | a published portal project, read-only from the store |
| `house-style/style-living.png`, `apartments/apt846/material-board.json`, `apartments/apt846/videos.json` (floors) | `Habait/tour360/` | the house look every project is skinned in (style ref, material words, the three floor finishes) |
| `fidelity.json` | `Habait/tour360/` | the fidelity rule (1% working bar), read by the gate, the build and the runner |

## Package (one per project) — `out/<id>/package/`
| File in the package | Served at | Produced by (run-project step) | Was hand-made for 846? |
|---|---|---|---|
| `platform/fixtures/<id>/project.json` | `/p/<id>/fixtures/<id>/project.json` | `platform` (from the portal's approved `spec.json`) | yes (hand-authored) |
| `platform/fixtures/<id>/units.json` | same folder | `platform` (the unit(s) the spec reads; price/status null until a price list) | yes |
| `platform/fixtures/<id>/flow.json` | same folder | `platform` (minimal: no film until the exterior step exists) | yes |
| `platform/projects.json` | `/p/<id>/projects.json` | `platform` (this project only) | yes |
| `tour/` = `build-tour.mjs` dist: `index.html` (template code + this project's data inlined), `panos/`, `panos-original/`, `thumbs/`, `plan/floorplan.webp`, `catalog/`, `api/` | `/p/<id>/tour/` | `build` | — |
| ↳ inputs of `tour/`, kept in `apartments/<id>/`: `apartment.json` | | `apartment` (template + spec titles) | yes |
| ↳ `plan.general.json` (the traced plan, cm) | | input (fork B's auto-trace; 846's hand trace for the proof) | yes (hand trace) |
| ↳ `cameras.json` (one point per room, links through the plan's openings) | | `cameras` | **yes → now automatic** |
| ↳ `material-board.json` (ONE material description per apartment, every scene) | | `apartment` (house board) | yes |
| ↳ `prompts.json` (skin prompts, one shared style + material block) | | `prompts` | **yes → now automatic** |
| ↳ `skin-prompts.json`, `_local/generated/*`, `_local/picks.json`, `_local/fidelity/{gate,consistency}.json`, `_local/skin-report.json` | | `skin` (`skin-project.mjs`, paid) | **yes → now automatic** |
| ↳ `videos.json` (the floor finishes) + `_local/panos-{parquet,concrete,marble}/` | | `skin` (`finish-pano.mjs` per scene × floor, each gated) | **yes → now automatic** |
| ↳ `scenes.json` (graph, door markers by plan bearing) | | `scenes` (`make-scenes.mjs`) | automatic already |
| ↳ `plan/floorplan.webp`, `_local/refs/*` | | `scenes` (`make-refs.mjs`) | automatic already |
| ↳ CG panoramas `360walkaround/tours/<id>/renders/cp-*/pano.webp` (the "original" look) | | `furnish` + `render` (Blender) | automatic already (furnish by rule) |
| ↳ `panos/{balanced,thumb}` (designed look; = CG without `--skin`) | | `sets`, then `skin` (`make-sets.mjs` from the passed picks) | — |
| ↳ `markers.json` (the rings) | | `markers` (`scan-pieces.mjs`, ≈ $0.01/scene) | automatic already |
| ↳ dollhouse GLB | | `dollhouse` (optional, `export_dollhouse.py`) | automatic already |
| `package.json` (manifest: inputs' hashes, steps, timings, spend) | — | every step | — |

## The designed look and its gates (`--skin`, `tools/skin-project.mjs`, fork F 2026-11-05)
The SAME tools that made Rainbow apt846 (fix-846-fidelity): `make-skin-prompts.mjs` → `gen-pano.mjs` (gpt25) → `close-seam.mjs --lite`
→ `fidelity-gate.mjs` → the fix loop of `fidelity.json` → `consistency-check.mjs` → `make-sets.mjs` → `finish-pano.mjs` → the gate again.
1. **Sales-plan fidelity** per room at `fidelity.json`'s bar (1%): FAIL → regenerate, then CG-guided band repairs, up to `max_attempts`.
   A room is never dropped; a deviation the trace or the CG carries stops the room (fix the trace, re-render).
2. **Cross-scene consistency for every element seen from 2+ scenes** (Eliran 2026-11-05: «זה כלל שצריך להיות גם בתוצאות מהפורטל»):
   the sight lines come from the plan (`consistency-check.mjs --list`, ≤ 700 cm); each room's fixtures are one group, the camera
   inside the room is its home; the home's passed picture is a reference for every other viewer; the judge's list must be empty.
3. The floor finishes are gated like the rooms. `build-tour.mjs` re-checks every shipped picture's exact bytes against `gate.json`.
4. The runner's `gate` step refuses to package unless `skin-report.json` says PASS (fidelity, consistency and finishes).
Money: `--skin-soft` / `--skin-hard` per job (default $40 / $60); every call reserved in `apartments/<id>/_local/ledger.json` before it
is sent and mirrored into `out/<id>/ledger.json`.

## Parity registry — everything done on Rainbow, the portal does by itself (Eliran 2026-11-05: «כל אותם דברים שאנחנו עושים על RAINBOW, הפורטל צריך לדעת לעשות לבד»)
One row per rule or step applied to Rainbow apt846: the shared module that enforces it (the SAME file Rainbow uses) and where the
runner calls it. `node Habait/tour360/tools/run-project.mjs --parity` reads the JSON block below and FAILS when a module is missing,
when its call site is not where the row says, or when a listed module carries an apt846/Rainbow literal in code that is not marked
`parity-ok:` (a Rainbow-only path). Anything added to Rainbow gets its row here in the same change (coordinator's rule, 2026-11-05).

| # | Rule / step on Rainbow | Shared module(s) | Called by (runner step) |
|---|---|---|---|
| 1 | Printed-dimension fidelity ≤ 1% between extension lines | `tour360/tools/trace_check.py`, `dim_chains.py`, `fidelity.json` | run-job `stageTrace` (trace-check before any build) |
| 2 | Fidelity gate per room + the fix loop (never drop a room) | `fidelity-gate.mjs`, `skin-project.mjs`, `fidelity.json` | run-project `skin`, `gate`; build-tour refuses |
| 3 | Cross-scene consistency for every shared element | `consistency-check.mjs` (`--all-groups`) | run-project `skin` (via skin-project) |
| 4 | Kitchen uppers / every material from the material board, as data | `apartments/apt846/material-board.json` (the house board), `make-skin-prompts.mjs` | run-project `apartment` (copies the board), `skin` |
| 5 | The three floor finishes, each gated | `finish-pano.mjs`, `apartments/apt846/videos.json` (the floors) | run-project `skin` |
| 6 | Rings + catalog + typed bar | `scan-pieces.mjs`, `build-tour.mjs --catalog=ai`, `server/handler.mjs` (`/api/tour-edit`) | run-project `markers`, `build`; `/p/<id>/tour/api/edit` rewrite |
| 7 | Building film, or the honest fallback | run-project `stepPackage` (`film:false`, empty `flow.cine.json`) | run-project `package` |
| 8 | The disclosure line carries the gate's number | `copy/tour360-copy.json` `conceptLine`, `fidelity.json` | run-project `build` (build-tour checks), `package` (disclaimer) |
| 9 | Responsive gate 1440 / 390 (in code) | `Habait/tools/qa/responsive-gate.mjs`, `Habait/tools/deploy/predeploy.mjs` | run-project `qa`; stage_flow.py predeploy |
| 10 | Hebrew-only developer strings | `studio-web/api/studio-agent.mjs` (`hebrewOnly`) | the portal's read |
| 11 | Autonomous review wording + the engine-version retry | `run-job.mjs` (`review`, `sweep`, `ENGINE`), `studio-web/index.html` | run-job sweep |
| 12 | The apartment page (stills, plan, dollhouse, the pack) | `platform/tools/build_zip.mjs` | run-project `package` |

```json parity
[
 { "id": 1, "rule": "printed-dimension fidelity <= 1%", "modules": ["tour360/tools/trace_check.py", "tour360/tools/dim_chains.py", "tour360/fidelity.json"], "call": { "file": "tour360/tools/run-job.mjs", "contains": "trace_check" } },
 { "id": 2, "rule": "fidelity gate + fix loop", "modules": ["tour360/tools/fidelity-gate.mjs", "tour360/tools/skin-project.mjs", "tour360/fidelity.json"], "step": "skin", "call": { "file": "tour360/tools/skin-project.mjs", "contains": "fidelity-gate.mjs" } },
 { "id": 3, "rule": "cross-scene consistency, every shared element", "modules": ["tour360/tools/consistency-check.mjs"], "step": "skin", "call": { "file": "tour360/tools/skin-project.mjs", "contains": "--all-groups" } },
 { "id": 4, "rule": "materials (kitchen uppers) from the material board", "modules": ["tour360/apartments/apt846/material-board.json", "tour360/tools/make-skin-prompts.mjs"], "step": "apartment", "call": { "file": "tour360/tools/run-project.mjs", "contains": "material-board.json" } },
 { "id": 5, "rule": "floor finishes, gated", "modules": ["tour360/tools/finish-pano.mjs", "tour360/apartments/apt846/videos.json"], "step": "skin", "call": { "file": "tour360/tools/skin-project.mjs", "contains": "finish-pano.mjs" } },
 { "id": 6, "rule": "rings + catalog + typed bar", "modules": ["tour360/tools/scan-pieces.mjs", "tour360/tools/build-tour.mjs", "tour360/server/handler.mjs"], "step": "markers", "call": { "file": "tour360/tools/run-project.mjs", "contains": "--catalog=ai" } },
 { "id": 7, "rule": "building film or the honest fallback", "modules": ["tour360/tools/run-project.mjs"], "step": "package", "call": { "file": "tour360/tools/run-project.mjs", "contains": "flow.cine.json" } },
 { "id": 8, "rule": "disclosure line from the gate", "modules": ["tour360/copy/tour360-copy.json", "tour360/fidelity.json"], "step": "build", "call": { "file": "tour360/tools/build-tour.mjs", "contains": "conceptLine" } },
 { "id": 9, "rule": "responsive gate 1440/390", "modules": ["tools/qa/responsive-gate.mjs", "tools/deploy/predeploy.mjs"], "step": "qa", "call": { "file": "tour360/tools/run-project.mjs", "contains": "responsive-gate.mjs" } },
 { "id": 10, "rule": "Hebrew-only developer strings", "modules": ["studio-web/api/studio-agent.mjs"], "call": { "file": "studio-web/api/studio-agent.mjs", "contains": "hebrewOnly(spec" } },
 { "id": 11, "rule": "autonomous review wording + engine retry", "modules": ["tour360/tools/run-job.mjs", "studio-web/index.html"], "call": { "file": "tour360/tools/run-job.mjs", "contains": "ENGINE.version" } },
 { "id": 12, "rule": "the apartment page", "modules": ["platform/tools/build_zip.mjs"], "step": "package", "call": { "file": "tour360/tools/run-project.mjs", "contains": "build_zip.mjs" } }
]
```

## Not in the package yet (gaps)
- The building film and `/hold/`: Rainbow's film is a Kling v2v pass over a Blender clay orbit of the real tower in its block
  (`flyover3d/data/site.glb`, the site mass from map data) plus a hand cut and an upscale (board `exterior-film`). A sales plan has
  none of that: no building mass, height, facade or site. A new project ships `film: false` and the page hides the building button
  (no invented building). The honest path to a film: the developer uploads the building's own exterior renders (or its address for a
  site mass), then a disclosed image-to-video pass of THOSE images; not built yet.
- Prices/status: need the developer's price list (`build_units.mjs --source`).
