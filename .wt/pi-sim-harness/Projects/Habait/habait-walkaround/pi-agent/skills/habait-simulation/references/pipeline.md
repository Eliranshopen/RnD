# The simulation pipeline (what each stage produces and where)

```
sales-plan PDF
  └─ auto-trace.mjs ............ <work>/trace/plan-<k>/{plan.general.json, crop.png, overlay.png, report.md}
       └─ run-project.mjs <id> (the portal's one runner; every step idempotent, a row each in out/<id>/package/package.json)
            apartment ........... Habait/tour360/apartments/<id>/{apartment.json, plan.general.json, material-board.json, _local/plan/plan-crop.png}
            cameras ............. cameras.json + camera_points (one per room, eye 160 cm, deepest interior point clear of fixtures)
            prompts ............. prompts.json (one style + one material block for every scene)
            furnish ............. 360walkaround/tours/<id>/plan.json (furniture by rule) → Blender scene
            render .............. 360walkaround/tours/<id>/renders/cp-<room>/{pano.webp, depth.png, pano.render.json} (Cycles, CPU)
            scenes .............. scenes.json (links between rooms, buttons; hotspot-pins.json overrides by hand)
            sets ................ panos/balanced/*.webp, thumbs, tiles (designed = CG until skinned)
            skin (--skin) ....... _local/generated/<asset>__… (AI answers), picks.json (the chosen one per room),
                                  _local/fidelity/gate.json (PASS rows per exact bytes), floor sets _local/panos-<floor>/
            markers ............. markers.json (scan-pieces: the furniture a visitor can swap)
            build ............... Habait/tour360/dist/<id>/ (index.html + panos + floor sets) — refuses an ungated picture
            package ............. out/<id>/package/
```

## The house rules the runner enforces
- **Fidelity gate** (`tools/fidelity-gate.mjs`): the traced plan is ray-cast from each camera. A monocular depth model (fal,
  about $0.01 per picture, cached) is fitted to it, and a column where the picture shows something FAR where the plan has a wall NEAR
  is a finding. Each room gets `deviation_pct`, `resolution_pct` and the CG-vs-plan check. PASS ≤ `fidelity.json` max (1 %).
  A sidecar `*.seam.json` / `*.source.json` lets the gate walk a picture's lineage (band edges, R25).
- **Consistency** (`tools/consistency-check.mjs --group <kitchen|door…> [--judge]`): one sheet per element group, from every scene
  that sees it, with designed | CG side by side. `--judge` is one vision call.
- **Disclosure**: the copy's `conceptLine.he` must carry «עד 1%», or the build refuses.

## Where money goes (fal prices read from fal's pricing API)
| step | model | price |
|---|---|---|
| trace reading / judge | text+vision via fal/OpenRouter | ≈ $0.1–1 per plan |
| skin (one room) | gpt-image-2.5 edit (`gpt25*` keys in image-models.mjs) | $0.06–0.40 per call, booked high |
| gate depth | depth-anything v2 | $0.01 per picture (cached) |
| markers scan | text+vision | ≈ $0.04 per scene |
| a spot fix | gpt25-medium edit | $0.20 per call |
| 3D furniture (walk) | nano-banana-2 photo $0.08 + trellis $0.02 / hunyuan3d v2 $0.16 | per piece |

## Lessons from apt846 (Rainbow, 2026-11)
- **The AI follows the PROMPT, not the plan.**
  - A sentence in `skin-notes.json` added a door to a niche the plan draws open (F8). Every sentence about an element must say what
    the plan draws.
  - The edit model can pick the wrong target: it put the washing machine in the fridge column. Name the target by what is around
    it, and check by eye.
- **Pictures from different tabs differ slightly** (the sofa from the entrance ≠ from the living room). Never blend several AI views
  of one piece.
- **Do not trust the gate alone.** The gate passed the laundry door, but Eliran's eye did not. Look at every changed spot in every
  tab and every floor set.
