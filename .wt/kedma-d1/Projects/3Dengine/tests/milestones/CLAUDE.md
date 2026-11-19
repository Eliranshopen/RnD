# tests/milestones/ — one closing test per milestone
<!-- last-updated: 2026-11-16 -->

## What's here
`m<id>.test.mjs` = the «מוכן כאשר» line of milestone `<id>` in plan §7.1, written as a runnable test against the REAL environment. A milestone is closed only when its file passes; `npm test` runs all of them, so a closed milestone stays closed.

| File | Milestone | What it proves |
|---|---|---|
| `m0.1.test.mjs` | 0.1 the engine home | parity `41 rows · PASS`; `fetch.mjs --verify-only` prints `57/57 rows OK`; the readiness command reports ready except the keys; every file under `pipeline/` has the git blob id of its source in commit `a63494a` (context files excepted) |

## Conventions / gotchas
- Assert on the tool's text, not only on its exit code: `fetch.mjs` exits 0 even when it could verify only 12 of 57 rows.
- A tool that rewrites a tracked file (`fetch.report.json`) is run inside a `try` / `finally` that puts the bytes back.
- Every spawn has a timeout.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
