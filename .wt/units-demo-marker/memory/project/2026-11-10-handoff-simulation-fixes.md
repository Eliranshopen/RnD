---
date: 2026-11-10
layer: project
author: rnd-9d (main session), on Eliran's word 2026-11-10 ~10:50: «המשימה שלך היא המחיקה ואת כל המשימה של התיקונים תעביר לסשן חדש»
second-reader: the next main session (read this first, then HOT); habait-deploy-qa
---
# Handoff: the Rainbow fixes move to a new session

## Where the product stands (10:50)
- **Prod habait-flow.vercel.app** = `dpl_HoCGVoUPqLptJfsMtSESBvsLcvsM` (2026-11-09 15:39: round-8 landing + Habait brand). Nothing deployed to prod since; one rollback (r9 copy of rainbowtlv.com → `project/2026-11-09-inspiration-not-copy.md`).
- **Test link https://rainbow-v2-test.vercel.app/** (separate Vercel project `rainbow-v2-test`, `prj_ZaoQlNcTJhvYbr7zBBR6vuP39JRJ`, $0): main `e5556fd`-level — general project landing (r10), /hold/ with the phone stop reframed + no ghost tower on iPhone (ee80a5a), the apartment journey (tap «כניסה לדירה» on 846 → ~9 s automatic flight → 360 tour, a8f0ddd), /v2/ → `/`. Eliran liked everything up to the apartment pick; the ghost-tower fix awaits **his iPhone re-check**. On his «נראה טוב» → deploy the same main to habait-flow (procedure `memory/project/2026-11-04-deploy-run-by-session.md`; stage from `stage_flow.py … --edit-api --studio`, predeploy, deploy `--prod`, served-sha check, prod gate, map→3D, flow; ledger row; memory). The test-link stage recipe: fresh stage + `.vercel/` of `rainbow-v2-test` + `.vercelignore` with `.env*` (SHIP-LEDGER rows 2026-11-09/10).
- **Known gate flake:** responsive-gate on bare `/hold/` at 390 can sample the pre-load state with the dev scrub bar `input#t` 305×16 (1 of 4 runs). Follow-up: hide `#bar` until loaded on phones (`runs/2026-11-10-hold-ghost.md`).

## In flight
- **Worktree `.wt/units-demo-marker`** (agent spawned 10:47, $0): `units.json` gets `source: sales-plan|demo`; every render of rooms/area/terrace shows «נתוני הדגמה» for demo units; 846 never. Ruling `project/2026-11-10-units-demo-marker.md`. If the agent died with this session: continue from the worktree, gates, merge, test link first.

## Money (Eliran 2026-11-10)
- FAL ceiling **$25** on the live key (`project/2026-11-10-fal-budget-25.md`; the live `.env` key is the relevant one, balance probe 77.67 via `scratchpad/fal-balance.mjs`-style read of `FAL_KEY` by name — never print it). §7 rails: ledger BEFORE every paid call (`development/tasks/studio-agent-fal/logs/spend-ledger.txt` is the running ledger), dry-run first, `--go` inside the estimate, checkpoints. Present each estimate to Eliran and wait.

## The simulation fixes still open (from memory; paid ones need an estimate + his go)
1. Kitchen sets 03/04: hob too close to the sink (141–146 / 124–130 cm vs 219 drawn; R31 FAIL) — ~one gpt band each, ≈$1.30 with finish re-bases (`runs/2026-11-06-fix-846-fidelity-final.md`).
2. Set 01: fridge placement deviation (`runs/2026-11-06-rainbow-round2-live.md`).
3. Sets 07/10: raw finishes add or move doors.
4. Bathrooms: fresh finish needed.
5. Entrance video / hand-off frames still show old pictures — a paid video job (Eliran's call).
6. Room images soft on large desktops: gated panoramas are 2048 px; the 3840 set in `apartments/apt846/_local/full/` does not match the gated set (kitchen/dining/living regenerated after it).
7. Type-L and other units' numbers → handled by the demo marker (in flight), unless Eliran sends the sales table.
Eliran was asked which matters most; no answer yet.

## Also owed
- Real-iPhone check of the tour music after the journey hand-off; `/sync-context` (new folders, skills, the removed backup's cards); English «HOME IS HABAIT» vector; worktree removals (`.wt/rainbow-*`, `hold-*`, `journey-r4`) = Eliran's act.
