# fix-846-fidelity · final pass 2026-11-06 (Rainbow apt846)
<!-- memory entry · 2026-11-06 · fork fix-846-fidelity -->

## 2026-11-06 · fork fix-846-fidelity · Rainbow merged (aabd15b), live copied, dist rebuilt — the deploy is the coordinator's
- **Did:**
  - **01:** s51 + seam close (ref 04; cuts 1.08 / 1.04, line steps 1 / 1, R28 0.942). The fridge placement is recorded as a known deviation in fidelity.json known_deviations; s52 placed it the same way.
  - **Floor sets:** every one passes 1% at its webp. 02, 01 and 08 floors are R26 floor-only composites on their own source (slack 30–70). 02 concrete comes from a gpt25-high answer, because the nano answer redrew the far sofa.
  - **Gates and judges:** all 44 shipped webps PASS and all band lineages PASS. Kitchen, living and dining pass 3/3 with R27.
  - **Merge and live:** merged e5a86fd + aabd15b. _local copied to live (backups in scratchpad live-local-backup-2026-11-06b). The live build-tour passes, with a fidelity row for every shipped byte.
  - **Dist:** rebuilt. 11 panos are byte-identical to panos/balanced; 13 are derived (11 stills, plan.png, top.webp).
  - **QA:** 1440/390 sheets for 01/02/03/04/08 and the apartment page: no errors, no failed requests, no overflow.
- **Evidence:** main aabd15b; qa-evidence/tour360/fix-846-fidelity-2026-11-05/final-2026-11-06b/; band-edges/ (fridge, R28 exception and 01 deviation crops); ledger 310.13 (this $20 pass: $15.36).
- **Learned:**
  - Cheap finish models redraw content that isn't floor while the 1% gate still passes: nano changed 01's front door and 02's far sofa. Ship the floor-only composite with a small slack.
  - A gpt25-high answer, composited, keeps the furniture.
  - R28 box widths are unreliable near the camera and when an object is placed differently.
- **Owed / open:**
  - The deploy (coordinator, after Eliran's go).
  - 01 fridge placement, for the coordinator's review.
  - The segments enter-846.mp4, last.jpg and handoff-living.webp still come from the old pictures (paid video, Eliran's call).
- **Second reader:** the coordinator; fork F (R25–R30 on main).


## 2026-11-06 midday · fork fix-846-fidelity · live kitchen issues: hotspots off fixtures (R23b), spacing (R31), attribute checklist (R32) — $0, merged aaed3d1
- **Did:** Eliran's 4 live issues, $0 only. (1) Sink↔fridge: measured on labelled perspective pairs, 02 90 cm and 03 93 cm fridge face → sink centre vs 84 drawn; neither view deviates beyond noise (02's "beside" look is the fridge's side panel seen obliquely; the render shows it the same). (2) No oven visible under the hob in 01-04 (Eliran's ruling: built in under the hob) — noted, not fixed. (3) R23b: tools/hotspot-hit.mjs (viewer pitch + CG depth + plan; floor/doorway/glass ok, fixture face / skim / wall not), make-scenes places with it, hotspot-check verifies: 12/27 failed before, 27/27 after; viewer hsPitch extended past v 0.743 (old values map unchanged); 01's fridge masked via fidelity.json known_deviations marker_avoid. (4) R31 spacing in cm + R32 attribute checklist in consistency-check (deterministic(), --recheck on cached answers; no free-text verdict). Dist rebuilt --catalog=ai, live dist copied.
- **Evidence:** worktree c7a6e74, c6cd985; main merge aaed3d1; qa-evidence/tour360/fix-846-fidelity-2026-11-05/hotspots-2026-11-06/ (all-markers.jpg, moved-markers.jpg, browser/*-1440.png and -390.png, hotspots-after.json); apt846/_local/fidelity/recheck__kitchen__*.json (rows 249-251: sink↔tall PASS in 02/03/04, hob↔sink 04 −94..−105 cm FAIL); dist_bytes 132 byte-identical + 29 derived; live dist backup scratchpad live-dist-backup-2026-11-06-hotspots.
- **Learned:** the viewer draws markers at its own pitch band (−12..−17°), not on the picture's floor line, so a "walkable via" still lands on whatever stands within ~6 m on that bearing; check the drawn ray, not the plan point. The designed furniture is taller than the CG blocks: a ray skimming 25 cm over a bed lands on its pillows in the picture.
- **Owed / open:** engine/test/run.mjs 13/2 and smoke catalog checks fail the same way on HEAD (pre-existing link-count and plain-build expectations); 01→bathguest marker now at v 1.0 (−63°, on the floor, below the default view); 05→terraceBedroom sits on a terrace plant (decor not in the plan). Paid fixes (04 kitchen, oven, optional 02 gap) wait for the coordinator's go inside Eliran's $5 (ledger $310.13 → stop $315.13).
- **Second reader:** fork F — take consistency-check.mjs, hotspot-hit.mjs, hotspot-check.mjs, make-scenes.mjs, viewer/tour.js hsPitch and fidelity.json consistency_checklist byte-identical (main aaed3d1).
