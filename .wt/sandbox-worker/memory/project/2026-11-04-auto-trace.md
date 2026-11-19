# auto-trace: sales plan → plan.general.json with no hand drawing (developer-platform P3)
<!-- 2026-11-04 · fork B of session rnd-67 · worktree .wt/auto-trace, branch auto-trace, commit 96ed30b (NOT merged, NOT deployed) -->

**What exists.** `Habait/tour360/tools/auto-trace.mjs <pdf|png> --out <dir> [--spec] [--type] [--budget] [--ledger] [--env-root]`
→ `<out>/index.json` + `plan-<k>/{plan.general.json, overlay.png, report.json, report.md}`. It is a callable step for the portal's
job executor (fork C). Helpers: `auto_pages.py` (PDF scan / sheet raster / brochure image extract), `auto_prep.py` (colour gate),
`auto_split.py` (geodesic Voronoi replaces 846's hand zone bars), `auto_finalize.py` (cameras, fixtures, scale fit from printed dims,
overlay, report), `trace_score.py`; `trace-plan.mjs` gained a barrier dump, walls-from-grey-fill and a geodesic fallback for leaks.

**Proven (evidence `Projects/Habait/research/auto-trace-2026-11-04/`, git-ignored):**
- 846, fully automatic (one Gemini read, $0.01; `run-auto-final/plan-1/score.json`): walled rooms within 2 % area / ≤ 4 cm mean
  edge (bedroom-2 +0.4 %, bath-main +1.7 %, bedroom-main −2.0 %, wardrobe +6 %). Open plan NOT at target: the entrance and
  terrace-bedroom labels were lost (entrance merged into living), kitchen +13 %, dining +25 %, guest bath +64 %; openings 2/13 by
  room pair; fixtures 6/19. With the hand seeds (`run-handseeds/`) the terrace union is exact (0.0 %) and the open-plan union −1.1 %,
  so the remaining gap is where the open-plan boundaries fall and which labels the read finds.
- Maale Efraim brochure (`maale-efraim-158/`, $0.04): found the plan pages itself (6 floor plans on 16 pages), picked type 158 m²
  (page 7, two floors). Ground floor: 6/7 rooms, walls right, the open kitchen/living split wrong (kitchen 28.8 m² vs printed
  3.10×4.85), the entrance label sits outside the door and was dropped. First floor: 4/6 rooms (two bedrooms' floods were degenerate).
  Brochures print no scale: the scale is fitted from the printed room dims, so a bad split also bends the scale.

**Spend:** $0.049 total in `research/auto-trace-2026-11-04/ledger.json` (cap $5).

**Incident (fixed):** a PNG input wrote its outputs beside the input; one run put 21 files into the live
`apt846/_local/plan/` through the worktree junction. Nothing was overwritten; the files were moved to `run-auto-final/plan-1/`; the
tool now always writes inside `--out`.

**Round 2 + the mandatory gate (later 2026-11-04, commits 7e5bec8 and 7f59755 on branch auto-trace).** Eliran (hard rule):
the AI checks the trace, not the developer. `trace_check.py` (printed dims within max(2 %, 5 cm), labels ↔ rooms, door arcs →
openings, entrance, windows, wet-room fixtures) + an independent vision judge; correction rounds re-seed rooms from their printed
rectangles; FAIL = exit 5, queued in `research/auto-trace-2026-11-04/review-queue.jsonl`, never shown to the developer.
Round 2 added walls by the wall colour (brochure (107,107,107)), the open-plan partition by printed W/L rectangles, door arcs.
Results: 846 FAIL (25/31 mechanical; 5 door arcs between no traced rooms; the cached reading has no per-room dims);
brochure first floor FAIL (22/31: bedroom −3 %, bedroom-2 +3/+11 %, laundry ±2.4 %, the en-suite/master split wrong);
ground floor FAIL (16/39: kitchen, living and entrance lost — the open space leaks into the garden). No plan PASSES yet.
**fal is locked ("User is locked. Reason: TOP_UP", HTTP 403)**: the judge cannot run until Eliran tops up; no judge = no PASS.
Spend $0.0968 total (13 ledger rows).

**Round 3 ($0, commit ce87f1f).** The building envelope (wall band closed adaptively 120–400 cm and filled; its gaps become
barriers), outdoor labels kept outside, door arcs attached to the nearest rooms (arcs outside the envelope ignored), `--no-judge`.
Ground floor: kitchen +0.2/+0.3 %, living +0.5/+1.6 %, ממ"ד 0.0/−0.7 % (26/30 mechanical; bathroom −34 %, entrance opening not
found). First floor 21/31 (bedroom 1 lost, 3 automatic halls). **846 passes 26/26 mechanical checks while the hand-trace score shows
its open plan off (dining +25 %, guest bath +64 %, entrance not found): its cached reading has no per-room dims and no entrance
label, so the mechanical gate cannot see the errors — only the judge (or a fresh reading with dims) can.** All three FAIL (no judge).

**Round 4 ($0).** `auto_rooms.py` rebuilds rooms orthogonally: printed rectangles snapped to the walls (walls-only mask; the
tracer's barrier holds diagonal door bars), smallest first without overlaps; rooms without dims keep the flood. Six new mandatory
checks (shape IoU ≥ 0.85, orthogonality, unlabelled ≤ 3 m², inside the envelope, bath ≥ 1.5 m², the room where its label is).
The coordinator caught that the old dims check (bounding box) passed wrong shapes; the new checks catch them, and the label check
catches a stairs room traced 459 cm from its label. Results (all FAIL): ground floor 40/51, first floor 38/54, 846 46/56.

**Round 5 ($0).** Printed rectangles placed to hold their own fixtures (kitchen 4/4) and never cover another label; no-dims
rooms from their reading box; outdoor clipped to paving; the envelope must hold every indoor label (fixed the lost bedroom);
`--spec` fills printed dims by exact name (846 from the audit: `research/auto-trace-2026-11-04/spec-846-from-audit.json`).
Ground floor 43/51 (kitchen at its counter, living −2.2/0.0 %, bath 0.0/+1.2 %; stairs and entrance corridor merged), first floor
42/55 (bedroom 1 swallows the corridor), 846 53/62 (main bath and main bedroom within 1 %; the north wing has its own wall axis;
terrace floods wrong). All FAIL. Open: per-wing axes, the entrance corridor as its own room, leftover never into a bedroom.

**Round 6 ($0).** Per-wing local axis (846 bedroom 2 now +0.3/−1.1 %), size-keeping snap, entrance strip rule, leftover never
into a bedroom/bath/laundry (its own «מעבר» for review), baths from their fixtures, one terrace. First floor 53/63 (master
+0.5/+0.3, en-suite +0.7/0, bedroom 2 +0.9/+0.7, laundry 0/−4, bath 0/−3 %); ground floor 45/55; 846 52/58. Still open: the
ground-floor entrance strip, automatic «מעבר» pieces outside the walls (the envelope admits a yard-stairs strip and a roof strip),
846 terrace/dining, first-floor bedroom 1 (−15 %).

**Round 7 ($0).** Wall-enclosed interiors, door-band entrance, open-plan slabs inside walls + glazing, wall-crossing
penalty, closed railing. First floor 56/63 (all six labelled rooms within 0–5 %, bedroom 1 fixed: placed sideways before);
ground floor 42/51 (entrance still inside the stairs room); 846 48/58 (bedroom 2 exact, open plan as slabs; the terrace region
takes the walk-in closet's label, guest bath collapsed onto the vent shaft, a roof strip on the first floor still outside).

**Round 8 ($0).** Ground-floor entrance traced as its own room (front door = the tracer's wall gap nearest the label; the
walk follows the free pixels across the door span). Regression table `research/auto-trace-2026-11-04/rounds.md` (per room, per run,
⚠ on a regression; it caught a bath growing to 99 % and the rule was fixed). Not fixed: 846 closet/terrace (the closet label takes
the terrace region), first-floor roof strip, stairs from the tread pattern (rule in, did not fire). Ground 47/55, first 56/63,
846 51/58, all FAIL (no judge).

**2026-11-05, judged rounds 9–10 + opentakeoff (commit cc1df3a on branch auto-trace).** fal back (new key): fresh 846 reading
with per-room dims ($0.009), judge on every plan ($0.005–0.012 each). Judge-driven fixes: rejected rectangles that span rooms,
openings from adjacency, outdoor-label-inside-envelope = this floor's terrace or a void, one unlabelled corridor per floor.
Fork C's real run of Eliran's own portal project (`pmw25zqqf4bb478`, the 846 PDF through the portal) = the third fixture.
**opentakeoff MCP verdict** (`research/auto-trace-2026-11-04/opentakeoff-probe/VERDICT.md`): WORKS on the 846 PDF, which is
vector CAD with its layer table (25,217 segments; `H-CONC-1` wall fills, `W-CONC/W-BLOCK`, `S-COLS`, `O-WIN`, `05door_m`,
`24dimension_m`, `P-PLUMBING`; the numbers are glyph outlines, no text). BLOCKED on the Maale Efraim brochure (its plans are
raster images; the 373 vectors are the page frame). `detect_rooms`/`one_click` are gated on the server, so its measuring needs our
vertices; the lever is the layers, read with pymupdf by `auto_walls_pdf.py` (walls, windows, doors exact, raster prep the fallback).
The brochure stays raster. **Measured:** the vector leg did NOT beat the raster trace on 846 (lost bedroom and living, master bath −39.5 %, terrace +71 %, rectangles off-axis; 62/79), so it is opt-in (`--vector-walls`, commit after cc1df3a). Judged raster results: 846 56/64, ground floor 48/55, first floor 56/63 — all FAIL; spend $0.22 of $5. Second reader: fork C / the main session (the executor passes the PDF, so the vector leg runs for it).

**Round 11 (2026-11-05, commit cb0204d) — Eliran's acceptance gate: the portal's auto trace of the 846 PDF must equal the hand
trace** (fork A's fixed one, `.wt/fix-846-fidelity` 12c3571; the live tree's copy is the 11-01 one). `trace_vs_hand.py` registers
both on the 288 dpi sheet (template match, corr 1.000) and compares per room at a 1 % bar. The 846 PDF's dimension lines, chained
and measured tick to tick (`dim_chains.py`), give every printed value exactly and the scale (2.2677 px/cm) — a reading-less run
had guessed 3.25 from room boxes, 43 % off. Anchored on both axes: bedroom, guest bath, closet, master bath, master bedroom.
Gate: 0/11 at 1 %; bedroom-2 +1.8 %, bath-main −0.1 % (sides −1.9/−2.0), bedroom-main −1.4 %; terrace untraced; openings 3/13.
Brochure (generalisation only): its closed rooms' wall-to-wall spans differ from their printed dims by ±3–5 % even at the
fitted scale — the render is not drawn to its own dims, so a 2 % bar there can fail on the drawing. Spend $0.26 of $5.

**Stopped at a definitional wall (2026-11-05).** The hand trace is itself >1 % off the printed dims in every printed room
(bedroom-2 area −2.5 %, bath-main +1.5/+1.3 %, bedroom-main side +11.6 %, bath-guest +19 %, wardrobe zone includes the passage;
open-plan zones cut by hand-placed virtual bars) — `research/auto-trace-2026-11-04/hand-vs-printed.md` with three options; under
Eliran's ruling «printed numbers are the authority» the auto trace cannot also equal the hand at 1 %. Bug found and fixed:
trace-plan reused a stale `walls.json` from a run at another scale (846 walls IoU 0.014 -> 0.824); fork C's builds consumed
those walls. Spend $0.26.

**Next:** Eliran's choice of the gate's truth (hand re-traced to print / printed for size + hand for topology / hand as is). → the judge on all three + a fresh 846 reading (~$0.03); then first-floor bedroom 1 and the
auto halls, the ground-floor bathroom and entrance; then merge on Eliran's word. The developer never sees a FAIL trace.

Second reader: the portal's job runner (fork C / the main session) — it consumes `index.json`.
