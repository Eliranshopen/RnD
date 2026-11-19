# board platform-ui-ux close records: the board table row and the OWED rows (the README state was already written).
import re
p = r"C:\RnD\development\tasks\CLAUDE.md"
s = open(p, encoding="utf-8").read()
s2 = s if "CLOSED 2026-11-03 23:40" in s else re.sub(r"\| `platform-ui-ux/` \| 2026-11-03 \| [^|]*\|",
            "| `platform-ui-ux/` | 2026-11-03 | CLOSED 2026-11-03 23:40 (01–21 DONE; copied back 23:15; QA 21 PASS; 22 = deployed-site QA after Eliran's prod deploy go) |", s, count=1)
assert "CLOSED 2026-11-03 23:40" in s2, "board row not found"
open(p, "w", encoding="utf-8", newline="").write(s2)
o_p = r"C:\RnD\docs\governance\OWED.md"
o = open(o_p, encoding="utf-8").read()
a = "| `npm ci` in the live `Habait/platform` on Eliran's go (or in its working copy at card 09, card 01c), then a bounded stage run passes |"
assert o.count(a) == 1
o = o.replace(a, a[:-2] + " — **resolved 2026-11-03 23:16**: `npm ci` in the live platform under Eliran's blanket approval (21:50); `three` installed; the 846 dist rebuilt with it |")
o = o.replace("open — 003, 007, 009 (partly), 013, 022, 023 and", "open — 003, 007, 009 (partly), 013, 022, 024, 025 and", 1)
row24 = ("| OWED-024 | 2026-11-03 | Board platform-ui-ux left these for Eliran: (1) the production deploy go (root §9) and then card 22 "
         "(deployed-site QA by `habait-deploy-qa`); (2) the accessibility-statement link text and target (footer slot, §6; judge Q7); "
         "(3) \"יזם (השם מוסתר עד אישור)\" shown to buyers next to the RAINBOW mark (judge Q4); (4) the disclosure shown three times on "
         "landing B / the hold (judge Q5); (5) the home/landing copy drafts. Evidence `development/tasks/platform-ui-ux/logs/ux-review.md` §4, "
         "`task-01-eliran-calls.md`. | Eliran | each answered in his words and recorded on the board |\n")
row25 = ("| OWED-025 | 2026-11-03 | The live `Habait/studio` has no `node_modules` (zod), so the real Studio server and `test/run.mjs` cannot "
         "run live (QA 21 CANNOT-RUN). | main session (plan studio-agent-fal, under the blanket approval) | `npm ci` in the live studio after "
         "that plan's copy-back; `test/run.mjs` green live |\n")
if not o.endswith("\n"): o += "\n"
i = o.index("| OWED-023 |"); j = o.index("\n", i) + 1
o = o[:j] + row24 + row25 + o[j:]
open(o_p, "w", encoding="utf-8", newline="").write(o)
print("board row + OWED-023 resolved + OWED-024/025 filed")
