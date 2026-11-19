# 2026-11-05 · fork F (rnd-9d) · project-runner — every step after a passing trace, autonomous

## 2026-11-05 · fork F · the designed look, consistency for every element, the publish route, the portal autonomy fixes
- **Did:** In `.wt/project-runner` (commits ab7e266, 2a69274, 8ef5584, 4c730a7, fe48d4e) — `tools/skin-project.mjs` runs the Rainbow recipe for a new apartment with no human step: make-skin-prompts → gen-pano gpt25 → close-seam --lite (only when the seam steps) → fidelity-gate at fidelity.json's bar → the fix loop (regenerate, then CG-guided band repairs; never drop a room; a trace/CG deviation stops the room) → cross-scene consistency for EVERY group seen from 2+ scenes (consistency-check --all-groups, groups = rooms with fixtures + the railing; the home scene's passed picture is a reference for the others; judge list must be empty) → make-sets + the gate on the shipped bytes → the 3 floor finishes, each gated. run-project step `skin`; `gate` packages only when skin-report says PASS. run-job: skin by default, `publishPackage()` + pointer `studio/pub/<pid>.json`; `api/studio-pub.mjs` serves `/p/<pid>/…` read-only from the private store (rewrites in stage_flow.py --studio). Portal: review card «ממשיכים לדייק / המערכת ממשיכה לתקן לבד»; Hebrew-only reading (prompt + a translation guard); the engine-version stamp + one automatic requeue per newer engine (sweep), `studio/engine.json`.
- **Evidence:** proof on apt846-auto (rebuilt from the corrected hand plan, CG 2048 in 881 s): living FAIL 9.05% → regenerated → PASS 0.58% (bar 1%), balanced PASS, parquet/concrete/marble PASS 0.58%, 9 rings, $3.11 — `.wt/project-runner/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846-auto/_local/fidelity/04-living__picks__d20a9d296a97.gate.jpg`, scratchpad `forkF/proof1-skin-report.json`; publish route on preview `habait-flow-g3xxv1gz8` (302 to landing, data/tour/panos 200, unknown project and tour/api source 404); fake-store test of the engine retry (requeued once, not twice).
- **Learned:** finish-pano did not create its output folder (paid answers saved, the webp write failed; fixed, re-run from cache $0). build-tour wants a gate row for every shipped picture, so a CG-only set is gated too. Rainbow-only words lived in consistency-check (id-prefix groups, the L-kitchen judge): now data-driven by room, same groups for apt846.
- **Owed / open:** the proof re-run on main after fork A merges, then the full 11-scene run (est. $35–40, ceiling $60, report at $40); a prod deploy of the publish route + portal fixes needs Eliran's go; the building film needs inputs a sales plan lacks (no building mass) — a new project ships film:false; a browser paint check of /p/<pid>/ on the protected preview was not run (HTTP only).
- **Second reader:** `habait-deploy-qa` — the next habait-flow deploy ships the /p/ rewrites, api/studio-pub.mjs and the portal text changes.

## 2026-11-05 (evening) · fork F · the responsive gate in code, parity, the portal on production, one measurement
- **Did:** project-runner commits ef02ade, ceab0ac, bcbc7df, 1cdd84d, e3e82ba, 541c8e4, 56beb0b, 8d5a64c, 4c01009, 70463a9 (+ studio-supabase 00d2512, 2589077): `Habait/tools/qa/responsive-gate.mjs` (1440 + 390: page errors, 4xx, overflow both sides, 44 px HIT areas, cover > 15 %) used by the runner's step `qa` (a failing project is not published; screenshots go with the job) and by `Habait/tools/deploy/predeploy.mjs` (stage_flow.py exits 1 on FAIL); every 44 px finding fixed (home, landing, hold pins + HUD, tour header at 390, portal, Clerk); the parity registry + `run-project --parity` (13 rows, PASS); the apartment page and an empty cine flow in every package; Blob-quota-safe executor (no list() to find a job, ops counted); plan_gate measures with printed_dimensions.measure_line.
- **Evidence:** predeploy on deploy-H-1 32/32 → LIVE dpl_G55ZUBqZ; production portal e2e on Supabase PASS (scratchpad forkF/prod-e2e/report.json: upload 16 PUTs 200, real Hebrew reading, sandbox claim 67 s); H-2 preview 32/32 → LIVE dpl_4PxPsAxt; production gate 32/32 (scratchpad forkF/prod-gate-H2/verdict.json).
- **Learned:** a closed fixed drawer and a clipping container hid a cut control (the gate now fails any control cut by the edge, carousels and panorama rings excepted); a stopped background run kept writing into a stage being rebuilt (a false FAIL) — never rebuild a stage under a running gate; the store quota counts every list().
- **Owed / open:** fix-846-fidelity not merged into main by 19:41, so: merge main into project-runner, re-run --parity + the gate, rebuild apt846-auto from the final plan and re-render (fork A first), CG-vs-plan must pass in every room, then the full 11-scene paid run (est. $35–40, cap $60). The test project «fork F prod e2e · 846 (test)» stays in the store (deletion is Eliran's).
- **Second reader:** `habait-deploy-qa` — every habait-flow stage now passes predeploy.mjs before a deploy.

## 2026-11-05 (night) · fork F · the apt846-auto acceptance run on the final plan — stopped at the $60 ceiling, not accepted yet
- **Did:** apt846-auto rebuilt from the final apt846 plan (fc23b88) + re-rendered; CG-vs-plan 11/11 PASS (≤ 0.85 %); skin-project ran to the $60 ceiling ($39.80 + $20.10). Shared behaviour added on the way (516c8e0): R24 judge majority of 3, an unreadable judge asked again (never regenerated on), the automatic ref repair after the first consistency FAIL, fidelity.json max_attempts 5; the furnisher keeps a plan-drawn piece's size (4e697e5).
- **Evidence:** `.wt/project-runner/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846-auto/_local/skin-report.json`; rooms 10/11 PASS (bedroom-main FAIL 5.38 % after 5 attempts: an invented opening at 319–329°, band repairs did not move it); consistency 7/8 (living fixed by the ref repair; kitchen FAIL: hob and sink reversed in one view); finishes incomplete at the cap; no human step in the run.
- **Owed / open:** bedroom-main (why band repairs do not remove the finding), the kitchen view with the hob/sink reversed, the remaining finishes — a new budget ruling; fork A's band-edge rule R25 (83b057f) to merge once it is on main, run on every picture before acceptance.
- **Second reader:** none.

## 2026-11-06 ~09:30 — acceptance run resume 4 (fork F)
- What: skin-project apt846-auto resume 4 inside the $90 ceiling — kitchen consistency round, bath-main parquet finish, mirror-rule re-gates.
- Result: rooms 11/11 PASS (balanced, worst entrance 0.85 %); finishes 33/33 PASS; consistency 7/8 — kitchen FAIL x3 (photo 4: upper wall cabinets + different sink/hob layout vs photos 2,3,5) after ref repair and regen; bath-guest mirror exemption 208-224° crop `_local/fidelity/11-bath-guest__mirror__216__32db08757595.jpg`.
- Spend: $5.29 this resume; total $84.77 of $90 (~$5.23 left). Human steps: only Eliran's fal top-up.
- Open: kitchen decision (coordinator); R25 (83b057f) still only on fix-846-fidelity, not main.
- Evidence: .wt/project-runner/.../apartments/apt846-auto/_local/skin-report.json; spend-ledger 2026-11-06 07:55 row.
- Second reader: main session (coordinator).

## 2026-11-06 ~10:05 — kitchen repair (a), two tries, both rejected (fork F)
- What: close-seam 04-living --ref current 02-kitchen pick (s22): try 1 band 100° at u 0.3278; try 2 band 25° at u 0.25 (the far kitchen only), extra words "same small size, no upper cabinets".
- Result: both REJECTED by eye; the 04-living pick is back to gpt25 s22 (a92fe83e2197); kitchen consistency stays FAIL.
- Finding: the ref repair transplants the ref's close-up view. Try 1 replaced the dining, column and windows with a close-up kitchen and the depth gate FAILED it (7.65 %). Try 2 enlarged the far kitchen, removed the oven column and left hard band edges, and the depth gate PASSED it (0.19 %). So the depth gate does not catch a transplant inside a small band.
- Also: the earlier ref repair used the s7 kitchen, which was replaced by s22 later, so it was a stale ref. The entrance pick is a seam from a living ref repair (52529cfa2ab3) and looks like the living area was brought closer; it should be audited with R27.
- Spend: $1.24 (2 seams $1.20 + 4 depth $0.04); total $86.01 of $90.
- Evidence: _local/generated/04-living__seam__s7__c38a20d89bd7.png and 04-living__seam__s7__ee350e030a69.png; gate rows 04-living__picks__a4950932f063 (FAIL) and 145f07185131 (PASS).
- Second reader: main session (coordinator); fork A (owner of R27).

## 2026-11-06 ~11:15 — R25/R27 merged, audit, kitchen position control (fork F)
- What: main (R25/R25b, R26, R27) merged into project-runner 24a20e7 and studio-supabase c0bb281; parity PASS (17 and 12 rows). The judge's JSON fix is b5f60ea: max_tokens 8000, response_format json_object, JSON-only words, finish_reason kept.
- R25 gate on 44 shipped apt846-auto pictures: 40 PASS. 01-entrance fails in all 4 sets because its pick is a v1 seam (52529cfa2ab3) with no readable cut; its .raw.png exists, so a $0 v3 re-composite is possible.
- R27 judge ×3: 7/8 groups PASS; the kitchen FAILS. 01-entrance and 04-living show upper cabinets; 02, 03 and 05 show stainless with shelves.
- Control: Rainbow apt846 kitchen with renders is 3/3 PASS; 02 positions are hob 1°, sink 9°, tall 6° off. Without renders (gitignored, not in the worktree) it dropped silently to photos-only.
- Root cause found: apt846-auto's fixture_hints are rule-guessed (hob at the "centre of the second run" (951,385), sink at (766,468)) and sit about 1.3 m from the drawn symbols, which Rainbow uses (hob (821,395), sink (689,570)).
- Spend: about $0.28; total about $86.29 of $110 (the coordinator raised the ceiling).
- Evidence: scratchpad audit-r25-gates.json, audit-r25-r27.json; apt846/_local/fidelity/consistency.json.
- Second reader: main session; fork A (the judge fix); fork B (auto-trace fixture hints).

## 2026-11-06 ~11:45 — (2a) hob/sink from the drawing, (2b) 02 re-skin, HARD STOP on paid calls (fork F)
- What: casework_symbols.py reads the hob (a burner square) and the sink (drain/tap holes) from the casework layer and registers them into the plan's frame. On apt846-auto: hob 4 cm and sink 11 cm from Rainbow's hand-checked hints. The furnisher uses them; the run-centre guess stays only as a labelled FALLBACK. The board's open-shelf wall becomes uppers "shelves". New runner step `casework`. R27 never falls back silently: judge exit 4 names the file, the runner's ensureRenders builds the renders. skin-project: the home first (a home off the plan is regenerated) and --context. Parity rows 18–21; parity is 21 rows PASS.
- Result: the 5 kitchen views re-rendered ($0). 02 was re-skinned; seed 8 swapped hob and sink and the depth gate PASSED it, so the home-first rule was added. 02 is now s7 d89004bcff86 (0.33 %). Kitchen consistency still FAILS: 01/04 have upper cabinets, 02's sink is 16° off.
- HARD STOP 12:36 local (coordinator): Eliran loaded $50 on fal at 09:00. Fork F spent $25.68 of it: apt846-auto $25.63 (resumes 3+4 $20.93, which really ran after 09:00 — the spend-ledger lines say 01:10/07:55), plus the Rainbow control $0.05. One gen row (02 seed 31, $0.60) is still "reserved" but its answer file exists, so it was billed.
- Commits on project-runner: e98ea47, ceaebf0, 1945937, 358026f, 1ae22f6.
- Second reader: main session; fork B (fixed the hob classification with casework_symbols, auto-trace 612b87c).

## 2026-11-06 ~13:50 — entrance v3, --keep-picks, the tall-unit rule (fork F, $0.02)
- Entrance: the living-ref band was re-composited as v3 from its raw answer onto its parent, gpt25 s22 0868c6d15448. At --cut-search 140 both cuts score 0.86 (at 40, one cut was 8.0 and failed). Gate PASS 0.85 %, R25 PASS, $0.02.
- skin-project --keep-picks: parity row 22.
- Tall-unit rule: parity row 23, d5cccc2. Eliran saw the column painted as an oven tower. Cause: the board's tall_unit words ("oven and fridge") plus k-counter's inherited words_en ("tall oven column"); the CG was already a fridge. Now the type comes from the drawing's words, else fridge by size (55–95 × 55–90), else storage. Prompts name it, the judge checks `tall_is`. The 846 PDF has no text layer.
- Registration now refuses a fit off scale 1 ± 0.05 (fork B's re-drawn trace fitted at 1.13).
- Paid repaints held until the coordinator's go; $12 cap, $0.02 spent.
- Second reader: main session; fork A (the new house-board keys reach Rainbow on the next merge).

## 2026-11-06 ~15:45 — step (1): R28 taken, rows 24–26, kitchen still FAIL, waiting on the bake-off (fork F)
- Taken byte-identical from fork A: R28 (e5c75cc: ref-scale-check, close-seam, band-lineage, same blob hashes; fidelity.json ref_scale hunk) and floor_composite.py --whole (c8cead2).
- Row 24: the fix loop's cut-search retry (80 then 140, $0). Row 25: prompts name every fixture the camera sees (sight lines; 01/05 now name the fridge column). Row 26: a floor-only composite only where the pick grew from the finish's source.
- Paid pass ($6.41): 02 home re-skinned twice (s32 passes, plan positions OK); 03 regenerated and shows the FRIDGE. 01/04/05 still paint an oven tower. 03's R28-guarded ref repair failed the gate at 14.74 % (a transplant, caught). Kitchen still FAIL.
- The 6 floor composites for 02/03 passed the gate and R25 but failed by eye (tile patch / smears at the counter base) → fresh finishes needed.
- Spend for step (1): $6.59 of $20. Holding $0.60 calls until fork A's cheap-model table arrives.
- Commits on project-runner: 38d78ed, c444d5c, 86c562d, b555d9e, bb75e01, ad170f0.
- Second reader: main session; fork A (86c562d to take for Rainbow's 01).

## 2026-11-06 ~12:30 local — step (1) final table, merges, the runner's trace step (fork F)
- Step (1): $18.97 of $20 (apt846-auto ledger since 08:35Z). 11/11 rooms ≤ 1 %, 44/44 pictures PASS gate + R25. Judges ×3: dining, bedroom-main, wardrobe, bedroom-2 and terrace-railing PASS; kitchen (05's column side, 03's fridge reads as stainless), living (armchair/sofa) and bath-guest (shower door) FAIL. Open by eye: 03 finishes ×3 and 02 concrete/marble (plinth stubs). The spend-ledger rows' local times for step (1) are wrong: the calls ran 08:39–10:07Z.
- Shared fixes from step (1): band-edge FAIL regenerates (it is not a trace fault); finish price from the model table; composite-first finishes with FLOOR_SLACK 50; --no-finish-composite; panel-ready fridge words; the judge accepts storage for a fridge.
- Merged main (auto-trace T1–T17) into project-runner 882963d and studio-supabase 918a181.
- Trace step: run-project --steps trace (dc12e2a, parity row 27).
  - The 846 PDF FAILS on a fresh reading (73/78, and 73/79 with the spec). It PASSES 85/85 only with fork B's saved vlm.json.
  - dims_gate against apt846: closed 6/6, rows 17/17, casework 3/3 in both; open-plan outline 4.35 % (saved reading) vs 62 % (fresh).
  - Tall typing fixed: fridge only in a kitchen or at a counter run (c96aa0c).
  - Trace spend: $0.094.
- Eliran: no more paid spend.
- Second reader: main session; fork B (reading variance; the duplicate laundry tall units).
