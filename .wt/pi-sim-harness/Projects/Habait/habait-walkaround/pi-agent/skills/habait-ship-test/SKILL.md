---
name: habait-ship-test
description: Put the current Habait build on the TEST link (Vercel project rainbow-v2-test, https://rainbow-v2-test.vercel.app) — stage the whole site, compare it with the last stage, deploy only that project, prove the served files equal the stage, run the checks live, and record the ship-ledger row. Never production.
---

# Shipping to the test link

The test link is a separate $0 Vercel project. Production (`habait-flow`) is NOT this skill: it needs Eliran's own go, written,
for that one deploy. The guard extension blocks it.

## Steps
1. **Merge first.** The tour on `main` must be the one you tested. Rebuild it with
   `node Habait/tour360/tools/build-tour.mjs <id> --catalog=ai`. It must print the fidelity PASS line.
2. **Stage** into a NEW folder outside the repo (the scratch or temp dir), keeping the log:
   `timeout 540 C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe -X utf8 C:/RnD/Projects/Habait/tools/deploy-vercel/stage_flow.py <stage> --edit-api --studio > <stage>.log 2>&1`.
   The log must contain `PREDEPLOY GATE: PASS`.
3. **Carry over** from the previous test stage: the `.vercel/` link folder (projectName `rainbow-v2-test`), `.vercelignore`
   (it lists `.env*`), and any extra pages the test link carries (`walk/`, `walk-blender/`, `walk3d/`). Ask where the last stage
   is if you do not know.
4. **Compare:** `python Habait/tour360/tools/ship/cmpstage.py <previous stage> <stage>`. Only the files you meant to change may
   differ. Show the summary.
5. **Deploy:** `bash Habait/tour360/tools/ship/deploy-test.sh <stage> <stage>.log`. The script refuses unless the gate line is
   PASS and the link is `rainbow-v2-test`. It prints the deployment id and checks that the served files equal the stage. The guard
   asks Eliran to confirm.
6. **Check live** (habait-sim-check against https://rainbow-v2-test.vercel.app/tour/…).
7. **Record:** add one row to `C:/RnD/docs/governance/SHIP-LEDGER.md`: date · what · stage + diff · checks · rollback (redeploy
   the previous stage) · Eliran's words. Commit.
