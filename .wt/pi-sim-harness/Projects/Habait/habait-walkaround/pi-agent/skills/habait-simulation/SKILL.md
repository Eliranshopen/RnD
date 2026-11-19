---
name: habait-simulation
description: Make a Habait apartment simulation (360° tour) from a developer's sales-plan PDF — trace the plan, build the plan-exact 3D model, render one CG panorama per room, paint the photoreal look with fal (paid, gated at 1 % plan fidelity and cross-tab consistency), build the tour and check it at 1440 and 390. Use for any new apartment, or to rebuild one from its plan.
---

# Habait simulation: from sales plan to tour

Work from the project root `C:/RnD/Projects/Habait/habait-walkaround`, in Git Bash, with `export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`.
Read `references/pipeline.md` before the first command and `references/rules.md` before any image prompt. The commands and their
flags are in `references/tools.md`. Do not invent flags: run a tool with no arguments to see its usage.

## 0. Before anything
- Ask Eliran three things, in one message: the apartment id (`aptNNN`, lowercase), the PDF path, and the money cap for this
  apartment's paid steps. The Rainbow 846 round spent about $35 on its skin and repairs.
- Check fal: `habait_fal_status`. If it is locked (no balance), stop before the paid steps and say so.
- Say in one line what you will run.

## 1. Trace the plan: PDF → `plan.general.json` (paid vision calls, about $0.1–1)
1. Dry run first: `node Habait/tour360/tools/auto-trace.mjs <pdf> --out <work>/trace --id <id> --budget 1 --dry`.
2. Then the same without `--dry`. Exit 0 = PASS, 5 = FAIL.
3. On FAIL, read `report.md` and show Eliran `overlay.png`. A FAIL trace never goes further.
4. Compare the overlay with the PDF yourself: every room, door arc, window and the entrance. The trace is the truth everything
   else follows; a wrong wall here is a wrong wall in every picture.

## 2. The CG apartment (no money: Blender on the CPU)
`node Habait/tour360/tools/run-project.mjs <id> --plan <trace>/plan-<k>/plan.general.json --crop <trace>/plan-<k>/crop.png --steps apartment,cameras,prompts,furnish,render,scenes,sets,build`.
- This writes `Habait/tour360/apartments/<id>/` and `360walkaround/tours/<id>/`, and renders one panorama per room under
  `renders/cp-<room>/` (pano.webp + depth.png).
- Look at every render and its camera. Each camera stands inside its room, at eye height, away from walls and furniture. The
  room's openings must be where the plan draws them.
- The CG tour is already a correct, plain tour. Show it to Eliran (habait-ship-test) before paying for the look, if he wants.

## 3. The photoreal look (PAID, the main cost)
- `node Habait/tour360/tools/run-project.mjs <id> … --skin`, or `skin-project.mjs <id> --soft <half cap> --hard <cap> --dry`
  first, then without `--dry`.
- Every scene is skinned, fidelity-gated, and repaired until it passes (the fix loop in `Habait/tour360/fidelity.json`). Elements
  seen from 2+ scenes are judged the same.
- Floor finishes (parquet, concrete, marble) are made and gated too.
- If the hard cap is hit, stop and report the per-room numbers. Never drop a room.

## 4. Markers, build, check
- `scan-pieces.mjs <id>` (paid, about $0.04 per scene) → `build-tour.mjs <id> --catalog=ai`. The build refuses to package any
  ungated picture.
- Then run the full habait-sim-check: every tab by eye, every floor set, doors and the front door consistent, no skirting boards,
  every room button, at 1440 and 390.

## 5. Ship to the test link
habait-ship-test. Production only on Eliran's own go.

## Report to Eliran (Hebrew, short)
The link, what passed (with the numbers), what is left, and the money spent against the cap.
