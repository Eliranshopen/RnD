---
name: habait-scene-fix
description: Change ONE element in the shipped pictures of a Habait tour (a door that the sales plan does not draw, a niche, a wrong fixture, a colour) through the paid image-edit lane, paste only that element's polygon onto every floor set, re-gate at 1 % and rebuild. Use when Eliran points at something wrong in a tab.
---

# Fixing one element in a tour (the apt846 laundry-niche recipe, 2026-11-12)

## 1. Find it exactly (free)
- Which tab, and which element? Turn the live tour to it (`qa/views.mjs <url> <out> living:135:parquet`). Find the same element
  in EVERY tab that sees it: project the plan position into each picture with the camera from
  `360walkaround/tours/<cg>/renders/cp-<room>/pano.render.json` (u = 0.5 + (bearing − yaw)/360), and confirm by eye. A tab where
  a wall hides it needs no fix.
- Read the plan crop at that spot (`_local/plan/plan-crop.png`). Say what the plan draws. If the plan draws a symbol (a washer
  circle, a cabinet), ask Eliran what he wants there, in one question.
- Find where the wrong element came from. A sentence in `skin-notes.json` or a fixture in `plan.general.json` is fixed there too,
  or the next generation brings it back.

## 2. The edit (PAID, about $0.20 per call)
1. Copy the shipped picture of ONE floor set (concrete is the cleanest) to `_local/<task>/in/<asset>__concrete.png`.
2. Write `_local/<task>/prompts.json` with one entry `{id, scene, set, references:[that png], prompt}`. Use the rules in
   `../habait-simulation/references/rules.md`: same picture, one change, name the target by its neighbours, keep the width,
   no skirting.
3. Run it dry: `timeout 170 node Habait/tour360/tools/gen-pano.mjs <id> <entry> gpt25-medium --prompts _local/<task>/prompts.json --seed 91 --cap <cap> --dry`.
   Then without `--dry`.
4. Look at the answer next to the input, zoomed in. Wrong target, wider element, or anything else changed? Change the seed or
   sharpen the prompt (another $0.20), and say so.

## 3. Paste only the element, on every floor set (free)
1. Measure the polygon in picture pixels on a zoomed crop with a pixel ruler.
2. Write a spec and run `python Habait/tour360/tools/polygon_paste.py --spec spec.json`. The tool takes the polygon from the
   answer onto the base pick and the parquet / concrete / marble pictures, and backs each file up once. It writes the sidecars
   (`*.seam.json`, `<set>/<asset>.source.json` with `answer`) that the gate needs, and updates `picks.json`.
3. Look at all four results side by side. A leftover lever tip or a seam is painted out locally (the spec's `local_fill`).

## 4. Re-gate, rebuild, check
1. `make-sets.mjs <id> --only <asset>`, then `make-tiles.mjs <id> --only <asset>`, then `scan-pieces.mjs <id> --scenes <room> --force`
   (paid ≈ $0.04; `node --env-file=<repo>/.env`).
2. `fidelity-gate.mjs <id> --scenes <asset> --skin <file> --cg-tour <cg>` for the balanced file and each floor set: every one PASS.
3. `build-tour.mjs <id> --catalog=ai`: it must print `fidelity: every shipped room has a PASS row`.
4. habait-sim-check on the room and its neighbours, then habait-ship-test.

## 5. Record
Commit on the task branch. Report to Eliran: the before/after views, the gate numbers, and the money against the cap.
