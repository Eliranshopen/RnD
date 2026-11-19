# end-of-night records (plan studio-agent-fal + preview deploy 2). Facts only, each with its evidence path.
import datetime, os, re
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
R = r"C:\RnD"


def w(path, text, mode="w"):
    open(os.path.join(R, path), mode, encoding="utf-8", newline="\n").write(text)


def sub(path, a, b):
    p = os.path.join(R, path); s = open(p, encoding="utf-8").read()
    assert a in s, (path, a[:60]); open(p, "w", encoding="utf-8", newline="").write(s.replace(a, b, 1))


w(r"development\tasks\platform-ui-ux\logs\preview-deploy-2.txt", f"""# Vercel PREVIEW deploy 2 ({now}, main session) — from the LIVE files after both copy-backs
go: Eliran 2026-11-03 "go ל-preview ב-Vercel" + the blanket approval 21:50 (previews). Production needs its own go (root §9).
staged: the LIVE Projects/Habait/tools/deploy-vercel/stage_flow.py (runs now: platform node_modules installed, OWED-023 resolved) into scratchpad/deploy-preview-2 (310.5 MB).
local check (python http.server :8852, killed by PID): 7 pages x 390/1440: page errors 0; 0 x 4xx except the 3 known optional /_local/segments/rainbow-cine/* probes on flow.html and landing arm B (never staged; the flight falls back).
deploy: npx vercel@65.9.0 link --yes --project habait-flow; npx vercel@65.9.0 deploy --yes (NO --prod). The .env.local that link writes was deleted unread before the deploy.
result: https://habait-flow-fd9fypg6c-eliran-5390.vercel.app · Preview · Ready (vercel ls). Production untouched: the latest Production deployment is still 14 h old.
""")
w(r"development\tasks\studio-agent-fal\logs\review-fixes.txt", f"""# fixes after the refute review (logs/review.md), {now}
2a (money): lib/llm.mjs structured() uses fal ONLY when the caller passes allowFal (today: the intake stage, which gates with ctx.spendGate and ledgers) AND spending is on; any other caller (plan.mjs, tools/pick_views.mjs) falls back to the API key / the subscription CLI. Test: 'review 2a' — 0 requests reach fal.
2b (money): lib/chat.mjs holds a per-project in-flight lock around the paid call; a second question while one is under way is refused ('הסוכן עדיין עונה'). Test: 'review 2b' — one ledger row.
4: POST /api/projects/:id/chat with a non-JSON body answers 400.
tests: working copy llm-fal 9/9 · run.mjs 13/14 (known missing tour360 file in the copy). LIVE after copy-back + npm ci: llm-fal 9/9 · run.mjs 14/14.
copy-back: python scripts/wt.py close studio-agent-fal --go -> closed 64 file(s) (10 changed or new).
""")
sub(r"development\plans\2026-11-03-studio-agent-fal.md", "state: APPROVED (Eliran's blanket approval 21:50", f"state: DONE {now} — copied back, live tests green, paid check $0.17 (was: APPROVED under Eliran's blanket approval 21:50")
sub(r"development\plans\CLAUDE.md", "| APPROVED under Eliran's blanket approval 21:50 — the Studio agent chat", f"| DONE {now}: copied back, live tests 14/14 + 9/9, paid check $0.17; records `../tasks/studio-agent-fal/` — the Studio agent chat")
o = os.path.join(R, r"docs\governance\OWED.md"); s = open(o, encoding="utf-8").read()
a = "| `npm ci` in the live studio after that plan's copy-back; `test/run.mjs` green live |"
assert a in s
s = s.replace(a, a[:-2] + f" — **resolved {now}**: `npm ci` in the live studio; `test/run.mjs` 14/14 and `test/llm-fal.test.mjs` 9/9 live |", 1)
s = s.replace("open — 003, 007, 009 (partly), 013, 022, 024, 025 and", "open — 003, 007, 009 (partly), 013, 022, 024 and", 1)
open(o, "w", encoding="utf-8", newline="").write(s)
print("records written")
