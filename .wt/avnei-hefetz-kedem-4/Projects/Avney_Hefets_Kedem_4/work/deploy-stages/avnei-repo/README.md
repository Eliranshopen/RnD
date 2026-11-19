# Avnei Hefetz Kedem, apartment 7: an interactive 3D walkaround

A real-time, walkable 3D model of a 4-room apartment (94 m², with a 7.39 m² balcony) built from the developer's sales plan. It is lit in Blender and shown in the browser with three.js.

**Live walkaround:** see the link in the repository description.

## What the visitor can do
- **Walk freely.**
  - Desktop: arrow keys or WASD, and drag the mouse to look around.
  - Phone: drag one finger.
  - You cannot walk through walls or furniture.
- **Move between rooms:** from the room strip with thumbnails, or from the floor plan with a "you are here" marker.
- **Use the view from above:** a dollhouse view with the ceilings removed. Tap the floor to walk there.
- **Measure:** a tape measure between any two points.
- **Change the time of day:** morning, noon, sunset and night. Each one is a separately baked light set, and the clock blends between them.
- **Change the design:**
  - Rings on the furniture open a catalog of alternative pieces, generated as 3D models.
  - Colour swatches recolour a piece.
  - A free-text line (Hebrew or English), for example "leather sofa and walnut floor".
  - Styles, floors, wall colour, kitchen fronts and worktop.
  - Undo, a before/after view, reset, and a link that keeps the current design.
- Every view carries the «הדמיה» (rendering) disclosure badge.

## How it is built
| Step | Tool | Script |
|---|---|---|
| Plan: walls, openings and room sizes traced from the sales sheet. Every printed dimension is within 2 % | Python (OpenCV, NumPy) | `tools/trace_walls.py`, `tools/make_plan.py` → `plan/plan.json` |
| 3D scene | Blender 4.5 (headless) | `tools/build_scene.py` |
| Furniture: generated from the client's interior renders. Each piece goes from a studio photo, to back/left/right views, to a 3D model with PBR materials | fal.ai: `nano-banana-pro/edit`, `hunyuan-3d/v3.1/pro` | `tools/catalog/gen_item.mjs` (dry run by default), `tools/catalog/optimize_item.py` |
| Light: baked per group into light and colour atlases, with a part id on every face so finishes can change live | Blender Cycles | `tools/walk3d_bake.py` |
| Time of day: one light atlas per keyframe on the same model | Blender + `relight.py` | `tools/daynight/` |
| Walkable floor | Python | `tools/walk_grid.py` |
| Web page | three.js 0.170 | `tools/walk/index.html`, `tools/walk/walk3d.js`, `tools/build_walk_site.py` |
| QA: desktop 1440 and phone 390 in headless Chrome | Playwright | `tools/v2_check.mjs`, `tools/walk_check.mjs`, `tools/shots.mjs` |

## Not in this repository
- **Media, by design:** the developer's sales material, the client's reference renders, the baked atlases and the generated 3D models.
- **API keys:** they are read by name from a local keys file and never stored here.
- **Generation cost:** every paid call is reserved in a ledger before it is sent (`tools/catalog/ledger*.json`).

The model research behind the furniture pipeline is in `docs/fal-3d-model-research-2026-11-18.md`.
