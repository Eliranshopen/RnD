# .wt/apartment-3d — the work tree for the apartment 3D view

This is where the apartment page's 3D tab (dollhouse) is rebuilt: room labels, tap a room to open its 360, a look that matches the tour, and later Cycles-baked light.

- **Board:** `C:\RnD\development\tasks\apartment-3d\README.md`
- **Plan:** `C:\RnD\development\plans\2026-11-03-apartment-3d-ux.md`

`files\` holds a runnable copy of the parts of the project this work touches, at their paths relative to `C:\RnD`. The live project stays untouched until Eliran says "good" and card 10 copies the changed files back.

| What | Where |
|---|---|
| What changed so far | [`CHANGES.md`](CHANGES.md) |
| Every copied file and its fingerprint at open | `manifest.json` |
| The helper | `python -X utf8 wt.py changes` (and `drift`) |
| Preview while working | `http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846` |
