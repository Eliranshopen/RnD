# qa-evidence/platform/rainbow-landing-2026-11-08/ — context file
<!-- last-updated: 2026-11-08 -->

## Purpose
Evidence for the Rainbow landing page (plan `development/plans/2026-11-08-rainbow-landing.md`), on a local stage of the worktree (`stage_flow.py` variant: platform from `.wt/rainbow-landing`, `_local` media from live main, `--edit-api --studio`).

## Subfolders
| Folder | What |
|---|---|
| `check/` | `Habait/platform/test/rainbow-landing.check.mjs` at 1440 and 390 (round 2, project-level page): poster first paint, film playing, paused, sections, EN, no 846 shortcut, one CTA target, CTA → /hold/, reduced motion; `result.json` PASS |
| `flow/` | `Habait/platform/test/rainbow-flow.check.mjs`: landing → CTA → film → stop → all apartments → pick → enter; `flow.json` PASS |
| `hold-chrome/` | round 3: the hold's top chrome at the stop, 360/390/430/1440, bounding-box overlap check PASS |
| `hold-chrome-before/` | the same check on live main before the fix: FAIL (the before picture) |
| `no-price/` | price round: no price text anywhere at 360/390/1440, no /studio/ link on the landing; prod dev-only items hidden — PASS |
| `no-price-before/` | the same check on live main before: FAIL (the before picture) |
| `gate/` | `Habait/tools/qa/responsive-gate.mjs` on `/`, `/landing.html`, `/apartment.html`, `/hold/`: PASS 8/8 |
| `predeploy-worktree/` | `Habait/tools/deploy/predeploy.mjs` on the worktree stage: PASS 32 page×size |
| `predeploy-main/` | the same gate on a stage built by the real `stage_flow.py` from live main after the merge |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-08-rainbow-landing.md`
