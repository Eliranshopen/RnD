# tests/unit/ — unit tests of the engine's own code
<!-- last-updated: 2026-11-17 -->

## What's here
One file per module:
- **`engine/`:** `config`, `lib`, `proc` (lib/proc + lib/main), `doctor`, `setup-env`, `setup-assets`, `cli`, `jobs`, `inbox`, `serve`.
- **`engine/`, added in 0.3:** `manifest`, `ledger` (every branch of `paidCall`), `heavy-lock`, `stages` (the registry and the stub), `control` (the restart rules, the computed `runner`), `runner` (the loop with injected stages, a fake clock and a fake timer: resume rule, cancel, failures, heavy lock, going back on a changed output).
- **`mcp/`:** `schema-check`, `mcp-tools`, `mcp-server`, `stub-engine`. (`stub-runner.test.mjs` left with `mcp/stub-runner.mjs` in 0.3.)

- **`resilience`** (0.3, after the first QA round): locks born with their content, liveness that needs a sign of life, the refreshed heavy lock, a cached answer never sent again, `spent_usd` derived.
- **Ownership** (contract 0.3 §10 rules 9 and 10), in `runner` and `resilience`: a runner that was replaced writes no row, no state and no heartbeat, reserves nothing, does not send a call it had reserved (`not_sent`), takes no heavy lock and leaves the other runner's pid file alone; an answer that comes back late is settled `late`.
- **After the second QA round** (contract 0.3 §11): the stub's output is the same bytes at every attempt, so a stage that runs again does not make the paid stages after it pay again (`stages`, `runner`); `syncSpent` reads the ledger inside the job lock; a late answer never replaces the owner's cached answer (`resilience`).
- **After the third and fourth QA rounds** (contract 0.3 §12, §13), in `resilience`: no reservation is left open (the cache names its row; a row with `sending_at` is orphaned, one without is dropped); two same-key calls at once are one call; a planted cache is no answer for a row whose send never started; an answer in hand survives a busy lock.
- **After the fifth QA round** (contract 0.3 §14), in `resilience` and `stub-engine`: the copy of the spent total is written with the settle; `get_job`, `list_jobs` and `get_result` report the ledger's total and repair the copy; a cache without a sane amount is no answer; the close of a failed send survives a busy lock.
- **After the sixth QA round** (contract 0.3 §15), in `resilience`, `cli` and `runner`: what an amount is (cache, estimate, cost); a read that does not wait for a busy lock; the CLI and the runner with a ledger that cannot be read.
- **After the seventh QA round** (contract 0.3 §16), in `runner` and `resilience`: a job that ended between a runner's look and its locked claim is not taken; what a ledger file must be, row by row, and a runner that stops on one that is not; the estimate checked first; an answer JSON cannot hold.
- **A lost heavy lock** (rule 13), in `runner` and `heavy-lock`: the heavy stage stops, no row for that attempt, the runner waits and runs the stage again; `holdsHeavy` = yes, no, or not readable just now.
- **`cleanup`** (at the close of 0.3): the clean-up the tests share (`../helpers/cleanup.mjs`), with fake processes, and once with two REAL static servers started for one port: the record names the one that ended, the removal of the home is refused, and `removeHome` still stops the live one and removes it.
- **Milestone 1.1:** `inspect` (the first look with a FAKE scanner: sheet, booklet, the record and when it is reused, the failures, two looks at one moment, no text of the PDF anywhere), `intake` (the verified read-only copy, on real files), `file-identity` (contract 1.1 §5: the job and manifest readers, the runner, the restart rules, the tools, the CLI), `intake-wiring` (the runner's check of the stored input with the real intake; the `inspect` settings; the fixtures' hashes).

Two more guard the whole:
- `all-modules.test.mjs` imports every `.mjs` under `engine/` and `mcp/`, so no file can be missing from the coverage table, and proves no import starts a server.
- `env-pointers.test.mjs` scans the brought-in tools for an environment name that falls back to a machine path (`process.env.NAME || 'C:…'`) and fails if the settings file does not feed that name.

## Conventions / gotchas
- The runner tests answer the check of the stored input themselves (`verifyInput: () => ({ ok: true })` in `base()`): their jobs are made by hand, with no PDF in the folder. The real check runs in `intake-wiring.test.mjs`.
- No real Python, Blender, assets or network: the outside world comes from `../helpers/fakes.mjs` or from a temp folder. Loopback HTTP on a port the test chose (0 = any free one) is allowed.
- A few tests start a real detached child (runner, doctor CLI) against a temp home with its own `engine.config.json`; each waits for it to end.
- Links in tests are directory junctions (`fs.symlinkSync(dir, link, 'junction')`): they need no Windows privilege, file symlinks do.
- A test that plants a fake secret must look for it in every output of the code under test.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
