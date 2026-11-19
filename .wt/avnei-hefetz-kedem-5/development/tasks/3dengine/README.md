# Board — 3dengine
<!-- created: 2026-11-16 · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md · coordinator: main session · owner: Eliran Shopen -->

**Goal:** build the engine «sales-plan PDF → full 360 tour» in `Projects/3Dengine`, connected to the agent through MCP, one milestone after another: the 27 milestones of plan §7.1 (0.1 → 7.5; 29 until the three render milestones became one on 2026-11-17), each closed by its own gate before the next one starts.
**State:** `EXECUTING` — cards 01, 02 and 03 (milestones 0.1, 0.2, 0.3) DONE; 3 of 27 milestones closed; card 04 (milestone 1.1) EXECUTING since 2026-11-17.

**Eliran's words (2026-11-16):** «תתחיל לפתח כל MILESTONE. לא עוברים לMILESTONE הבא לפני שסוגרים MILESTONE קודם. … ברגע שמסיים לפתח אותו אתה מריץ עליו בדיקות … אתה צריך להגיע לTEST COVERAGE של לפחות 80% … אתה צריך לעשות SYNC CONTEXT ואז אתה עובר לMILESTONE הבא». On the board itself: «כדי שזמן העבודה יהיה יותר מהיר ויעיל אני חושב שכדאי שתפעיל את PLAN TO TASKS», and when told the command is typed only by him: «אתה יכול לעשות את זה גם בעצמך. תעשה!». So this board was written by the main session by hand, following `/plan-to-tasks` step by step, and the session runs the sync-context passes itself.

**Working folder:** git worktree `C:\RnD\.wt\3dengine`, branch `3dengine`, opened 2026-11-16 off `main` `a63494a` (root §8.7). The engine home inside it: `Projects/3Dengine/`. Every closed card is committed on the branch and merged into the local `main`. Never pushed.

## Key state (the resume point)
- **Now:** card 04 (milestone 1.1, intake and a first look at the PDF) is EXECUTING since 2026-11-17: eight task cards in `m1.1/` (its `README.md` = state and waves), contract `Projects/3Dengine/contracts/CONTRACT-1.1.md`. Its first task is carried from the eighth QA round of 0.3: `manifest.json` and `job.json` are checked for the job they name, the way `ledger.json` is (see «Carried items» below).
- **Eliran, 2026-11-17 («כן»): the three render milestones are ONE.** Cards 08, 09 and 10 (2.1 one room, 2.2 the whole apartment, 2.3 render as an engine stage) are card 08, milestone 2.1: the existing chain is checked on one room, the stage is tested on two (one finished, one killed), and the whole apartment is not rendered by hand. It is rendered once, by the engine itself, at card 11 (milestone 3.1), which now also records the 11 rooms, the furnishing audit and the time. His reason: the goal is to build the engine, and a full render that only proves old code takes time and machine. 27 milestones, 28 cards in work (09 and 10 stay as files, `MERGED INTO 08`). The same merge is recommended for cards 17 to 19 (the AI look, where the double run also costs about $7): it is question 8 of plan §10, his to answer when stage 5 comes.
- **Done:** card 03 (milestone 0.3, a job on the disk) on 2026-11-17 — local `main` `157e994`. Eight QA rounds by fresh reviewers; rounds 1 to 7 FAILED, each on something smaller, the eighth PASSED on `cc5f410` (about 457 real kills and 326 real takeovers with no loss, no repeat and no double bill). The gate on the closing commit: 267 tests, line coverage 99.71 %, the whole suite 6 runs of 6 in the worktree and 1 of 1 in the live home, the closing test 17 of 17, end to end 51 of 51. Details and the rounds: `m0.3/README.md`; contract and what is still open: `Projects/3Dengine/contracts/CONTRACT-0.3.md` (§17); evidence: `logs/0.3/`.
- **Done:** card 02 (milestone 0.2) on 2026-11-16 — the engine is registered in Pi (`pi mcp list`: `habait-engine: connected, 8 tools`), the agent UI shows the job card, the guard asks before `approve_paid_stage`; the engine behind the tools is still a STUB that replays the 846 tour. Details: `m0.2/README.md`; contract and its known limits: `Projects/3Dengine/contracts/CONTRACT-0.2.md`; evidence `logs/0.2/`.
- **The agent side lives in two other repos**, merged locally and never pushed: `C:\HABAIT-Agent-UI` (main `309802f`) and `C:\pi-main\habait` (main `89751a0`). Work on them in an isolated copy (`.wt/engine-mcp` inside each, ignored through `info/exclude`).
- **The whole chain is tested by** `npm run test:e2e` in the engine home (a scripted fake model, a temp Pi folder); `-- --live` plays one conversation with the real model and needs Eliran's word for the spend.
- **Done:** card 01 (milestone 0.1) on 2026-11-16 — local `main` `5844920`; the live home `C:\RnD\Projects\3Dengine` is set up and `node engine/cli.mjs doctor` prints READY EXCEPT KEYS. Details: `m0.1/README.md`, evidence `logs/0.1/`.
- **Every milestone starts with plan to tasks** (Eliran, 2026-11-16): its task cards go in `m<id>/` (`README.md` + `task-NN-*.md`), with a QA card by a fresh reviewer last.
- **After a close:** `git -C C:/RnD/.wt/3dengine merge --ff-only main`, so the branch starts the next milestone from `main`.
- **WIP at filing:** 1 board `EXECUTING` in `development/tasks/CLAUDE.md` (`exterior-film/`); this board is the second.
- **Keys (corrected 2026-11-17 on Eliran's word «יש לך מפתחות פה»):** `FAL_KEY` and `OPENROUTER_API_KEY` are BOTH present in the repo's one keys file at the repo root. The readiness command said "missing" on 2026-11-16 only because the engine looked in its own folder (`envRoot: "."`). Pointed at the repo root by the machine override `engine.config.local.json` (`"envRoot": "C:/RnD"`), it prints `FAL_KEY: present, OPENROUTER_API_KEY: present` and `READY` (checked by name in the worktree; no value was read). The live home `C:\RnD\Projects\3Dengine` has the same override since the close of 0.3 (2026-11-17) and prints `READY` (`logs/0.3/r12-live-doctor.txt`). So card 05 (milestone 1.2) does not wait for keys; paid calls still follow root §7.
- **Project agents** (`engine-builder`, `blender-scene`, `genai-look`, `platform-dev`, `qa-reviewer`) are defined in `Projects/Habait/.claude/agents/` and do not load in a session started at `C:\RnD`: build cards run in the main session in that role; reviewer cards are fresh spawns carrying the definition. `Projects/Habait` is off the disk in the main tree (2026-11-16): read the definitions in the working folder.
- **One card per milestone, on purpose.** Eliran thinks in the plan's numbering, so a milestone that touches a second domain (0.2: the agent's UI; 7.5: the two reviewers) stays one card and names the second role inside it.

## The gate of every card (plan §7.2)
1. The closing test: the milestone's «מוכן כאשר» line, written as `tests/milestones/m<id>.test.mjs`.
2. Unit tests for every function the card adds or changes.
3. Every earlier card's tests again (`npm test` runs the whole suite).
4. Test coverage of at least 80 % of the lines of the engine's own code the card adds or changes (`node --test` with Node's built-in coverage and a threshold that fails the run). Code brought from git as it is stays out of the count: the cards of kind «קיים» prove it by running the real tool and comparing with the measured number.
5. Close: commit on `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, the card's State.

## Cards (execution order = the plan's numbering)
| # | File | Card | Agent · model · tier | State |
|---|---|---|---|---|
| 01 | `task-01-m0-1-engine-home.md` | 0.1 · בית המנוע — The engine home | engine-builder · opus · T0 | DONE |
| 02 | `task-02-m0-2-stub-engine-agent.md` | 0.2 · מנוע דמה מחובר לסוכן — A stub engine connected to the agent | engine-builder · opus · T1 | DONE |
| 03 | `task-03-m0-3-jobs-on-disk.md` | 0.3 · עבודה על הדיסק — A job on the disk | engine-builder · opus · T0 | DONE |
| 04 | `task-04-m1-1-intake-inspect.md` | 1.1 · קליטה והצצה — Intake and a first look at the PDF | engine-builder · opus · T0 | EXECUTING |
| 05 | `task-05-m1-2-trace-846.md` | 1.2 · פענוח 846 במנוע — Reading the 846 plan inside the engine | engine-builder · opus · T1 | PLANNED |
| 06 | `task-06-m1-3-trace-gate.md` | 1.3 · שער הפענוח — The trace gate | engine-builder · opus · T0 | PLANNED |
| 07 | `task-07-m1-4-saved-reading.md` | 1.4 · קריאה שמורה — A saved reading | engine-builder · opus · T0 | PLANNED |
| 08 | `task-08-m2-1-one-room-render.md` | 2.1 · רינדור כשלב במנוע — Render as an engine stage (one room checked first, tested on two; merged from 08, 09, 10) | engine-builder + blender-scene · opus · T0 | PLANNED |
| 09 | `task-09-m2-2-apartment-render.md` | (was 2.2 · דירה שלמה — The whole apartment rendered) | — | MERGED INTO 08 |
| 10 | `task-10-m2-3-render-stage.md` | (was 2.3 · רינדור כשלב במנוע — Render as an engine stage) | — | MERGED INTO 08 |
| 11 | `task-11-m3-1-cg-vs-plan.md` | 3.1 · בדיקת ה-CG מול התכנית — The CG check against the plan | engine-builder · opus · T0 | PLANNED |
| 12 | `task-12-m3-2-cg-tour.md` | 3.2 · סיור במראה CG — A tour in the CG look | platform-dev · opus · T0 | PLANNED |
| 13 | `task-13-m3-3-live-link-and-stop.md` | 3.3 · קישור שנשאר חי, ועצירה — A link that stays alive, and the stop | engine-builder · opus · T0 | PLANNED |
| 14 | `task-14-m4-1-quote.md` | 4.1 · הצעת מחיר — The quote | engine-builder · opus · T0 | PLANNED |
| 15 | `task-15-m4-2-no-pay-without-approval.md` | 4.2 · אין תשלום בלי אישור — No payment without an approval | engine-builder · opus · T2 | PLANNED |
| 16 | `task-16-m4-3-caps.md` | 4.3 · תקרות — The caps | engine-builder · opus · T2 | PLANNED |
| 17 | `task-17-m5-1-skin-one-room.md` | 5.1 · חדר אחד — One room in the AI look | genai-look · opus · T1 | PLANNED |
| 18 | `task-18-m5-2-skin-apartment.md` | 5.2 · דירה שלמה, מדודה — The whole apartment in the AI look, measured | genai-look · opus · T1 | PLANNED |
| 19 | `task-19-m5-3-skin-stage.md` | 5.3 · מראה כשלב במנוע — The AI look as an engine stage | engine-builder · opus · T1 | PLANNED |
| 20 | `task-20-m5-4-house-data.md` | 5.4 · נתוני הבית מחוץ לקוד — The house data out of the code | engine-builder · opus · T1 | PLANNED |
| 21 | `task-21-m6-1-fidelity-gate.md` | 6.1 · שער ההתאמה — The fidelity gate | engine-builder · opus · T0 | PLANNED |
| 22 | `task-22-m6-2-repair-then-review.md` | 6.2 · תיקון, ואז «לבדיקה» — Repair, and then «לבדיקה» | engine-builder · opus · T1 | PLANNED |
| 23 | `task-23-m6-3-consistency.md` | 6.3 · עקביות בין חדרים — Consistency between the rooms | engine-builder · opus · T1 | PLANNED |
| 24 | `task-24-m6-4-deviation-table.md` | 6.4 · טבלת הסטיות — The deviation table | engine-builder · opus · T0 | PLANNED |
| 25 | `task-25-m7-1-floor-finishes.md` | 7.1 · גימורי רצפה — The floor finishes | genai-look · opus · T1 | PLANNED |
| 26 | `task-26-m7-2-pack-and-qa.md` | 7.2 · אריזה ובדיקות — Packing and the checks | platform-dev · opus · T1 | PLANNED |
| 27 | `task-27-m7-3-ruler-and-dollhouse.md` | 7.3 · סרגל מדידה ובית בובות — The measuring ruler and the dollhouse | platform-dev · opus · T0 | PLANNED |
| 28 | `task-28-m7-4-result-to-agent.md` | 7.4 · תוצאה לסוכן — The result for the agent | engine-builder · opus · T0 | PLANNED |
| 29 | `task-29-m7-5-acceptance.md` | 7.5 · קבלה מול הרפרנס — Acceptance against the reference | main session + `habait-ux-judge` + `compliance-warden` · opus · T1 | PLANNED |
| 30 | `task-30-qa-live.md` | Final QA on the live `main` (plan §11) | fresh `qa-reviewer` spawn · sonnet · T0 | PLANNED |

## Carried items (found in one milestone, owed by a later card)
| Found | What | Owed by | Where it is written |
|---|---|---|---|
| 0.3, QA round 8 (O-4) — ANSWERED in 1.1 (`ac717c5`) | A hand-edited `manifest.json` or `job.json` that names another job, or none, made a runner write into that other job's file or create `jobs/undefined/`. Both files are now read only when they are this job's | card 04 (milestone 1.1), its first task: done | contract 0.3 §17 item 2 · `task-04-m1-1-intake-inspect.md` |
| 0.3, at the close | `serve.json` can name a static server that is not the one serving: two callers of `ensureServe` at one moment start two, one ends, and the record keeps the pid written last (5 rounds of 5). Nothing in the engine reads the record; the tests no longer trust it | card 13 (milestone 3.3), which makes the link the engine's own | contract 0.3 §17 item 1 · `task-13-m3-3-live-link-and-stop.md` · `logs/0.3/r12-double-start.txt` |
| 1.1, at its gate | A first look at a PDF is one Python start: about 2 s on a quiet machine, 31 s and 46 s while another session's job held every core and most of the memory, over the scanner's 30 s limit (the tool then answers `FILE_TOO_LARGE`, its message naming a busy machine). The engine itself will saturate the machine when it renders. The first look also runs inside the tool call, so the MCP server answers no other call until it ends (QA round 1 of 1.1, O-6) | card 08 (milestone 2.1, the render stage): measure a first look during a render and settle it | contract 1.1 §9 · `logs/1.1/gate-summary.txt` |
| 1.1 | The Pi wrapper's system text says every answer of the engine carries `mode: stub`; since 1.1 `inspect_plan` answers `real` (the tool descriptions, which the agent also reads, say so). The wrapper is another repo and was not touched (engine only) | card 13 (milestone 3.3), the first that returns to the agent side | contract 1.1 §9 |
| 0.3, QA round 8 (O-3) | An answer of a paid call that JSON holds only in part (`NaN`, a `Date`, a `Map`) is cached in its JSON form, so a stage that runs again gets the cached form | the first card whose stage makes a real paid call (card 17, milestone 5.1): its answers are plain JSON values | contract 0.3 §17 item 3 |

Seen in 0.3 and owed by no card (limits, written in contract 0.3 §17 items 4 to 8): a ledger that goes bad between the mark and the send; an answer object that throws when read; a reader of `job.json` with no pause between reads; five "still answering" process ids in 225 storms, not explained; `start_simulation` for a job whose `job.json` was deleted, not tested.

## Waves
Strictly sequential: 28 waves of one card (Eliran's rule; cards 09 and 10 are merged into 08). Inside one card the main session may hand independent parts to at most five workers per burst (`/plan-to-tasks` Step 15); a worker never opens the next card. `agent-model-guard.ps1` is not installed, so this line is the only bound.

## Gates
- **Every card:** its `Check:` line, run in Git Bash under `timeout` (root §12).
- **A fresh reviewer prompted to refute** (never the author): card 03 (kill and resume, no double billing), card 15 (no payment without an approval), card 16 (the caps), card 22 (a room is never dropped, a wrong tour never returned), card 29 (`habait-ux-judge` and `compliance-warden`).
- **Final QA:** card 30, on the live `main` after the last merge. The board is `CLOSED` only when it passes.
- **No deployed-site QA card:** nothing in this board reaches a deploy. The share link (`publish_test_link`, plan phase E5) is a later board, with its own QA card `BLOCKED (deploy go)`.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).
7. **The gate (Eliran, 2026-11-16):** no card starts before the previous card is closed. A card closes only after its closing test, its unit tests, every earlier card's tests, test coverage of at least 80 %, and a sync-context pass (plan §7.2).
8. **Git:** stage only your own paths; ⛔ never `git add -A` (the deletion of `Projects/Habait` in the main tree is unstaged and must stay so); never push.
9. **Secrets by NAME only:** never print a value, never name a `.env` path in a command; check a key's presence as a yes/no.
10. **Paid calls:** ledger row BEFORE the call, dry-run first, inside the cap, and only after Eliran answered the card's question.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
