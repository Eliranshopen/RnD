---
name: habait-sim-check
description: Verify a Habait tour before anyone sees it — plan fidelity per picture, cross-tab consistency, no skirting boards, every room button visible and arriving, the movement, screenshots at desktop 1440 and phone 390, no page errors. Use after any build or fix and against the live test link after a deploy.
---

# Checking a tour

All of these are free unless marked. Run them against a local build (`node Habait/tour360/tools/serve-dist.mjs` or
`python -m http.server` in the dist folder) or the live URL. Keep the outputs under `qa-evidence/tour360/<task>-<date>/`.

## The gates
- `build-tour.mjs` printed `fidelity: every shipped room has a PASS row at 1% for its exact bytes`. If it did not, nothing ships.
- `consistency-check.mjs <id> --group kitchen` (and the door groups): look at the sheet. `--judge` costs about $0.01.
- `hotspot-check.mjs <id>`: every button on the plan.

## In the browser (Chrome, playwright-core from HABAIT_APP_DIR)
- `node Habait/tour360/tools/qa/allbuttons.mjs <tour url> <out>`: every room button at 1440 and 390 must be hit-testable, overlap
  nothing, and arrive in its room. It must end `ALL BUTTONS: PASS`.
- `node Habait/tour360/tools/qa/levelview.mjs <tour url>`: hidden 0 of N.
- `node Habait/tour360/tools/point-move-check.mjs <tour url> --out <dir>`: the movement.
- `node Habait/tour360/tools/qa/views.mjs <tour url> <out> <room:yaw[:floor]> …`: screenshots of the changed spots at both sizes.
  Read every screenshot yourself.

## By eye (you must look)
- Every tab, at least 4 directions, on the default floor (parquet) and on one other floor.
- No skirting boards. The doors and the front door look the same from every tab. Nothing the plan does not draw.
- The «הדמיה» badge and the disclosure line «עד 1%».
- On the phone: no overflow, and the buttons are not under the controls.

## Live, after a deploy
- Served = stage: compare the sha256 of `tour/index.html` and every changed picture between the URL and the stage folder.
- Run the browser checks above against the live URL.
- Not checked unless Eliran does it: a real phone. Say so.
