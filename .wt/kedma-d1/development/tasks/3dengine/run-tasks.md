# How to run board 3dengine
<!-- created: 2026-11-16 -->

**Order:** card 01 → card 30, one at a time. A card starts only when the card before it is `DONE` (Eliran, 2026-11-16).

**Resume:** read `README.md` → Key state. Then `git -C C:/RnD/.wt/3dengine log --oneline -5` and `git -C C:/RnD/.wt/3dengine status --short`. The first card in the table whose State is not `DONE` is the one to work on.

**After every card (the close):**
1. `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m<id>.test.mjs` — the closing test.
2. `timeout 300 npm test` — the whole suite, with the 80 % coverage bar.
3. Save both outputs in `development/tasks/3dengine/logs/<id>/`.
4. A card with a `Reviewer scope:` line: a fresh Sonnet reviewer, prompted to refute, before the close.
5. Commit on the branch (`git -C C:/RnD/.wt/3dengine add Projects/3Dengine` and the commit; never `git add -A`), then merge `3dengine` into the local `main`. Never push.
6. A sync-context pass on the live files (the session runs it itself, on Eliran's word of 2026-11-16).
7. Memory: one entry (`python scripts/mem_entry.py … --go`), HOT made true.
8. The plan: the milestone log row in §7.2, the progress line on the page, the page published again.
9. This board: the card's State → `DONE`, the README's Key state → the next card.

**A card that waits for keys or for Eliran's answer:** stop there and report. Never skip to a later card.
