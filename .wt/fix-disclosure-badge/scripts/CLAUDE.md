# scripts/ — harness scripts
<!-- last-updated: 2026-11-03 -->

## What's here
Small scripts that turn a hand-proven harness procedure into one command (root `CLAUDE.md` §3, §5: dry-run by default, `--go` to write, non-zero exit with the reason on stderr). Both were hand-run first on 2026-11-03 (`.wt\harness-focus`) and tested on a scratch root before landing here. Plan: `development/plans/2026-11-03-harness-focus.md` phase 3.

| File | Purpose |
|---|---|
| `wt.py` | the working-folder procedure of root §8.7: `open` (copy + sha256 manifest), `add` (follow-up in the same task; re-adding a file already closed in this task reopens it with a fresh hash, the old pair kept under `rounds`, 2026-11-04), `status`, `close` (refuses on drift, copies back, verifies, records). Refuses a path another open folder holds. Never deletes a folder (D11) |
| `mem_entry.py` | one memory entry per root §0.2: the `_TEMPLATE.md` entry, its INDEX line under the existing header (≤ 400 chars), the second-reader pointer. Refuses missing evidence paths and secret-shaped text (§8.1) |

## Conventions / gotchas
- Run from `C:\RnD` in Git Bash: `python scripts/wt.py …`, `python scripts/mem_entry.py …`; `--root <dir>` points either at a test copy.
- Both force UTF-8 output (the console is cp1255).
- The `/close-task` skill (`.claude/skills/close-task/`) is the procedure that calls them.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
