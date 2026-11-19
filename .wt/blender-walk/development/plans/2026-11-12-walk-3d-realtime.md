# 2026-11-12 — apt846: free real-time walking in a true 3D apartment (path 1)

**Ask (Eliran, 2026-11-12):** «אני לא רוצה סרטון בהדמייה אלא אני רוצה תחושה אמיתית של הליכה בדירה לפי החיצים שאני אזיז». Then «כן» to path 1: the plan-exact Blender model in the browser, $0.

**Why this path:** the simulation is made from the sales plan. Blender builds the 3D model, and the 11 tour pictures are AI renders around it; there are no real photos. Walking freely without warping therefore needs a real 3D scene:
- Reprojected pictures (`/walk/`) warp mid-way.
- Pre-made films cannot be steered.
- Gaussian splatting would need dozens to hundreds of consistent views of a place that does not exist yet.

The model already holds the exact geometry; what is missing is a realistic look. Blender's path tracer can bake real daylight (bounce light, soft shadows) into it.

## Steps (worktree `blender-walk`, $0)
1. **Scene:** `scene-full.blend` + `walk_look.py`:
   - Wood floor, white doors, no skirting boards (rule), daylight.
   - The laundry niche open and empty, with no door (Eliran 2026-11-12; the 2026-11-05 `l-laundry` box removed).
   - Glass kept as glass.
2. **Bake:** `walk3d_bake.py`.
   - A second UV set (lightmap pack) on every static mesh, grouped into a few atlases.
   - Cycles bakes DIFFUSE (direct + indirect + colour) per atlas, bounded runs ≤ 540 s each.
   - Export one GLB: the baked atlases as unlit colour, glass separate, potted plants decimated.
3. **Viewer:** `walk3d/index.html` + `walk3d.js` (three.js 0.170, vendored):
   - The eye at 1.6 m; start at the entrance spot facing the living room.
   - Desktop: ↑ forward, ↓ back, ← → turn, mouse drag to look.
   - Phone: finger drag (horizontal turns, vertical walks), no on-screen arrows (2026-11-11 ruling).
   - Collision against the plan's free floor (rooms + openings − walls / panes / furniture footprints, the walk proof's mask), sliding along walls.
   - The «הדמיה» badge.
4. **Checks:**
   - Hold ↑ from the entrance into the living room, kitchen and corridor at 1440 and 390 (GPU).
   - Frame rate, no errors, no overflow; screenshots by eye.
   - Plan fidelity: the GLB's walls are the plan model's own (no geometry edits).
5. **Ship:** test link `/walk3d/` only; production only on Eliran's own go.

**Open / known:** the model's furniture is not the AI pictures' furniture. The kitchen, baths and some pieces are low-poly catalog models. This is a first look to judge the walking feel; matching furniture is a follow-up.
