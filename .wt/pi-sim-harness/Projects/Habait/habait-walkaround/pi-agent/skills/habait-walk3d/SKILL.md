---
name: habait-walk3d
description: Build or update the free real-time 3D walk of a Habait apartment (arrow keys / finger drag, no warping) — the plan-exact Blender model with baked daylight in a three.js page, its furniture dressed after the tour, the city backdrop from one tour picture. Use when Eliran asks for walking through the apartment.
---

# The 3D walk (apt846, branch `blender-walk`, 2026-11-12)

Eliran's rulings:
- Walking = steered by his own arrows, continuous, with no warping. Films and reprojected pictures were rejected.
- The furniture must be the tour's furniture, each piece modelled ONCE (consistency).
- Primitive stand-ins were rejected as "not the tour".

**State.** The tools are on git branch `blender-walk` (worktree `C:/RnD/.wt/blender-walk`), not on main yet. The live page is
https://rainbow-v2-test.vercel.app/walk3d/.

## The chain (each step one bounded Blender run, CPU)
1. `360walkaround/pipeline/walk_look.py`: wood floor, no skirting, white doors, daylight, every interior door open
   (`--open-door o-6,o-9,o-10,o-11`).
2. `360walkaround/pipeline/walk3d_dress.py`: the catalogue pieces of the rooms replaced. **Next (paid):** real 3D copies of the tour's
   pieces with `Habait/tour360/walk-proof/furn-crop.py` (a straight view of a piece from a tour picture) and `furn3d.py` (a catalogue
   photo with nano-banana-2 at $0.08, then trellis $0.02 or hunyuan3d v2 at $0.16; dry by default, ledger first, cap $5). Place each
   at its plan fixture, scaled to the fixture's footprint.
3. `360walkaround/pipeline/walk3d_bake.py --stage prep|bake|geom|export`.
   - prep joins 5 groups and unwraps with margin 0 + scale_to_bounds (59 % of the atlas, against 9 % with a margin).
   - Metals are made non-metallic for a diffuse bake, or they come out black.
   - A material named `*glass*` is never baked (do not name a black panel "glass").
   - Bake 2048 px × 32 samples, about 2 min per group.
   - Export with `--view Standard --exposure -0.7 --look None`.
4. `Habait/tour360/walk-proof/walk3d-sky.py`: the city backdrop from ONE picture's skyline band.
5. `walk_footprints.py` → `walk3d-grid.py`: the free floor (furniture kept 22 cm clear).
6. `build-walk3d.py --gl … --grid … --sky … --color 1.6 --contrast 1.15`, then `walk3d-check.mjs <url> <plan.json> <out>`: it walks,
   the walls hold, the phone drag turns, about 60 fps, no errors.
7. Ship the folder as `walk3d/` inside a test stage (habait-ship-test).

## Do not
- Do not project the AI pictures onto the model: the furniture smears, which Eliran rejected.
- Do not cross-fade into the tour pictures: they differ slightly between tabs.
