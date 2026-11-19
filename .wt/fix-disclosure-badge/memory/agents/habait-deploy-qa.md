
## 2026-11-04 · habait-deploy-qa · Card 22 QA on deployed habait-flow.vercel.app: FAIL on cine 404s
- **Did:** Headless Chrome, 6 pages x 1440/390, on the alias. All lines PASS except 0 console errors / 0 responses>=400 on landing variant b and flow.html: 3 never-staged _local/segments/rainbow-cine files 404, cine.js logs 2 errors, landing hero paints black. Ruled FAIL, not note.
- **Evidence:** `development/tasks/platform-ui-ux/logs/qa-deployed-report.md`
- **Learned:** Landing A/B split is random, so test v=a and v=b explicitly. Lazy hidden stills look broken until their tab opens. A network drop mid-run yields ERR_* rows: rerun, never judge.
- **Owed / open:** Eliran: stage rainbow-cine, default variant a, or accept; then rerun card 22.
- **Second reader:** none

## 2026-11-04 · habait-deploy-qa · Card 22 round 2 on dpl_HprzbAud: PASS
- **Did:** Fresh headless-Chrome rerun, 6 pages x 1440/390 on habait-flow.vercel.app: 12/12 rows 0 console errors, 0 responses>=400, Heebo ok, no Google Fonts, no dev text, no clay, AI badges present; cine hero and flow frames not black (luminance 136-147). Round-1 cine 404s gone.
- **Evidence:** `development/tasks/platform-ui-ux/logs/qa-deployed-report.md`
- **Learned:** A pixel luminance sample of the hero crop (PIL) is a cheap black-frame proof. Default A/B split differs per load; force v=a and v=b.
- **Owed / open:** Not tested: /tour/ rise/dive interaction, Edge. Main session sets board row to SHIPPED (QA 22 PASS).
- **Second reader:** none

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-platform-ui-ux-shipped.md — platform-ui-ux SHIPPED to habait-flow prod on Eliran's go; QA 22 r1 FAIL (black cine stage) -> landing fallback + cine clips staged -> r2 PASS; habait.ai is another project → `memory/runs/2026-11-04-platform-ui-ux-shipped.md`

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-flow-deploy-5.md: prod deploy 5 live on habait-flow.vercel.app; paint-proof PASS on / flow hold; owed: demo-transition shows dev error, 23 CLAUDE.md public despite stage_flow rule. → `memory/runs/2026-11-04-flow-deploy-5.md`

## 2026-11-04 · main-session → second-reader pointer
- project/2026-11-04-owed-024-rulings.md — Eliran ruled OWED-024: developer 'ישראל קנדה' shown, landing-B disclosure reduced to the flight's own, copy approved, a11y statement drafted (unpublished); live, not deployed → `memory/project/2026-11-04-owed-024-rulings.md`

## 2026-11-04 · main-session → second-reader pointer
- runs/2026-11-04-owed-024-deploy.md — OWED-024 (developer name, landing-B disclosure, copy) deployed dpl_D4nm8a…, live site_check 14/14 → `memory/runs/2026-11-04-owed-024-deploy.md`

- 2026-11-04 · second-reader pointer only: git steps now wait for a remote only (identity set, local only) → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer: SHIP-LEDGER is live again (Vercel-deployment columns); append a row after every prod deploy → `memory/runs/2026-11-04-context-sync-4.md`

## 2026-11-04 · main session rnd-1f → second-reader pointer
- Eliran 2026-11-04: after his deploy go the main session runs the deploy itself, not a ! handoff; per-deploy go still required; first: habait-flow dpl_3avVrz 10:59 → `memory/project/2026-11-04-deploy-run-by-session.md`

## 2026-11-04 · habait-deploy-qa · Card 07 hold-building-tour deployed QA: PASS
- **Did:** habait-flow prod: check-building 80/80 on 4 devices, paint proof desktop+390 (aerial pano 200, non-uniform pixels), / /tour/ /hold/ clean. Verdict PASS.
- **Evidence:** `development/tasks/hold-building-tour/logs/qa-deployed.md`
- **Learned:** Check hash of served files first; sample pixels via an in-browser canvas on a clipped screenshot; the chain auto-advances so scene may be orbit2 by shot time.
- **Owed / open:** none
- **Second reader:** none

## 2026-11-04 · main session rnd-1f → second-reader pointer
- board hold-building-tour SHIPPED+CLOSED: hold button opens tour exterior overlay (one URL); gate D1 fixed; prod dpl_3avVrz 10:59 run by the session on Eliran's ruling; QA live + prod 80/80 → `memory/runs/2026-11-04-hold-building-tour.md`
- 2026-11-04 · second-reader pointer: stage_flow.py now drops every CLAUDE.md and demo-transition.html from the stage (step 3b) → `memory/runs/2026-11-04-prod-exposure-fix.md`
- 2026-11-04 · second-reader pointer only: product repo baseline 35cc0f6 on main; origin = previous owner GitHub, never push → memory/project/2026-11-04-git-back.md
- 2026-11-04 · second-reader pointer: your definition was rewritten for habait-walkaround / habait-flow (OWED-009); old-app steps marked not applicable → `memory/runs/2026-11-04-owed-cleanup.md`
- 2026-11-04 · second-reader pointer only: live walk found F01 (badge hidden in buyer flow) and F20 (placeholder phone 972500000000) on habait-flow prod → memory/project/2026-11-04-feature-worktrees-plan.md
