# Projects/3Dengine/ — the engine: sales-plan PDF → full 360 tour
<!-- last-updated: 2026-11-17 -->

## What's here
The engine that turns a developer's sales-plan PDF (תכנית מכר) into a full 360 apartment tour, built to be driven by the agent through MCP. Plan: `development/plans/2026-11-16-pdf-to-360-engine-mcp.md` (the page Eliran reads is the `.html` beside it). Board: `development/tasks/3dengine/` — one card per milestone (0.1 → 7.5), each closed by its gate before the next starts (Eliran, 2026-11-16).

**State 2026-11-17:** milestones 0.1, 0.2 and 0.3 are closed (0.3 after eight QA rounds). The real stages are milestones 1.x onward.
- **0.1, the engine home:** the pipeline as it was in git, the runtime, the render assets, the readiness command.
- **0.2, connected to the agent:** the MCP server `habait-engine` with its eight tools, on a STUB that replays the apartment-846 tour (`"mode": "stub"`, nothing rendered or paid). Contract: `contracts/CONTRACT-0.2.md`.
- **1.1, intake and a first look (built 2026-11-17):** `inspect_plan` reads the PDF itself (`engine/inspect.mjs` runs the pipeline's `auto_pages.py scan`): pages, a sheet or a booklet, the drawings found. A job keeps its own verified, read-only copy of the PDF (`engine/stages/intake.mjs`) and a runner checks it at every start. `job.json` and `manifest.json` are read only when they are this job's. Every stage after the intake is still a stub. Contract: `contracts/CONTRACT-1.1.md`.
- **0.3, a job on the disk:** one detached runner (`engine/runner.mjs`) walks the stages of `engine/stages/`; every job keeps `manifest.json` (what was really done) and `ledger.json` (every paid call, reserved before it is sent); a killed runner resumes from the same point, with no finished stage repeated and no call billed twice. Contract: `contracts/CONTRACT-0.3.md` (sections 10 to 16 = what the QA rounds added; section 17 = what is still open).

## Key files
| File | Purpose |
|---|---|
| `engine.config.json` | the ONE settings file: where Python, Blender, Chrome, the pipeline, the assets and the legal data are; the key NAMES; (0.2) `inbox` (the only folders a PDF may come from), `stub` (site root, tour path, seconds per state, rooms, quote), `serve` (host, port 8891); (0.3) `stub.callUsd`, `runner` (heartbeat, stale time, heavy stages, heavy lock); (1.1) `inspect` (large image, vector page, timeout). Machine overrides: `engine.config.local.json` (untracked); test overrides by env: `ENGINE_HOME`, `ENGINE_JOBS_DIR`, `ENGINE_SERVE_PORT`, `ENGINE_STUB_STEP_MS` |
| `requirements.lock.txt` | the Python environment, 20 pins, the versions of the environment that produced apartment 846 |
| `package.json` | the engine version (part of every job id; since 1.1 it is the number of the last closed milestone); `npm test` (the whole suite, fails under 80 % line coverage of `engine/**` and `mcp/**`), `npm run test:unit`, `npm run doctor` |
| `.gitignore` | keeps `.venv/`, `.runtime/`, `jobs/`, `node_modules/` and every env file out of git |
| `.gitattributes` | (1.1) `*.pdf` and `tests/fixtures/**` are bytes: git never changes their line endings (a checkout once turned a fixture's LF into CRLF in the live home) |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `engine/` | [`engine/CLAUDE.md`](engine/CLAUDE.md) | the engine's own code: settings, readiness, set-up scripts, CLI, job files, inbox check, static server |
| `mcp/` | [`mcp/CLAUDE.md`](mcp/CLAUDE.md) | the MCP server `habait-engine` (stdio), the eight tools, the stub engine and its detached runner |
| `contracts/` | [`contracts/CLAUDE.md`](contracts/CLAUDE.md) | the milestone contracts and the JSON Schemas of the job file and the tools |
| `pipeline/` | [`pipeline/CLAUDE.md`](pipeline/CLAUDE.md) | the tools brought from git `a63494a`, unchanged |
| `house/` | [`house/CLAUDE.md`](house/CLAUDE.md) | brand and legal data the tour carries |
| `appdeps/` | [`appdeps/CLAUDE.md`](appdeps/CLAUDE.md) | the two Node libraries the pipeline loads (`sharp`, `playwright-core`), locked |
| `tests/` | [`tests/CLAUDE.md`](tests/CLAUDE.md) | unit tests and one closing test per milestone |

Not in git, rebuilt by the set-up scripts or at run time: `.venv/` (Python), `appdeps/node_modules/`, `.runtime/` (set-up manifests; `serve.json` + `serve.log` of the static server; `doctor.json`, the cached readiness report; (1.1) `inspect/<sha256>/`, the first look of a PDF), `jobs/` (one folder per job: `job.json`, `manifest.json`, `ledger.json`, `cache/` (paid answers), `stages/<stage>/`, `input/source.pdf`, `runner.pid` while the runner lives, `runner.log`), `.runtime/heavy.lock` (one heavy stage at a time), and the render assets inside `pipeline/360walkaround/`.

## Commands
```
node engine/cli.mjs doctor              # is the engine ready? (exit 0 = ready, or ready except the keys)
node engine/cli.mjs env                 # the environment pointers the pipeline gets
node engine/cli.mjs setup-env [--go]    # Python environment + Node libraries, from the locks (dry-run without --go)
node engine/cli.mjs bring-assets [--go] # render assets from the backup, verified by sha256 (dry-run without --go)
node engine/cli.mjs mcp                 # the MCP server habait-engine on stdio (same as: node mcp/server.mjs)
node engine/cli.mjs jobs [--json]       # the newest jobs, one line each
node engine/cli.mjs job <job_id> [--json]   # one job: stages + manifest rows, ledger total, orphaned rows, STALLED
node engine/cli.mjs resume <job_id>     # a runner for a stalled job; restart a cancelled / failed / review one
node engine/cli.mjs ledger <job_id> [--json] # the job's paid calls: reserved, settled, failed, orphaned
node engine/cli.mjs serve --root <dir> [--port N]   # static server for a folder, foreground (default port 8891)
npm test                                # the whole suite + the 80 % coverage bar (about 80 s; give it timeout 300)
npm run test:e2e                        # browser → bridge → Pi → a scripted model → the engine (0.2); evidence goes to a temp folder unless E2E_LOG_DIR names one
npm run test:soak -- --kills 60 --freezes 40   # random kills, then takeovers of runners that look dead (0.3)
```

## Conventions / gotchas
- **One milestone at a time** (Eliran, 2026-11-16): plan to tasks → develop → tests → test coverage ≥ 80 % → sync-context → the next. The process and the milestone log: plan §7.2.
- **`pipeline/` is not edited.** A change there is listed in `pipeline/PORT-CHANGES.md`; the closing test of 0.1 compares every file with git `a63494a`.
- **Keys by NAME only** (`FAL_KEY`, `OPENROUTER_API_KEY`): the readiness command says present or missing, never a value. No env file is committed; never name one in a command.
- **Where the keys are (Eliran, 2026-11-17).** Both keys are in the repo's one keys file, at the repo root. By default the engine looks in its own folder (`envRoot: "."`) and then says both are missing. The untracked `engine.config.local.json` of an engine home points it at the root: `{ "envRoot": "C:/RnD" }`; the readiness command then prints `FAL_KEY: present, OPENROUTER_API_KEY: present` and `READY`. A worktree needs its own copy of that file.
- **The Blender lock is machine-wide** (`C:/RnD/.wt/_blender.lock`): one Blender at a time on this machine, whichever folder starts it (root §12).
- **The Kenney pack zip cannot be downloaded any more** (the URL returns a web page). `fetch.mjs --verify-only` needs it in `pipeline/360walkaround/catalog/.cache/` to verify 45 of the 57 models, and without it prints `12/57 rows OK` while still exiting 0. The only copies: the 2026-11-03 archive under `C:\HABAIT-Archive`, and this home's cache.
- Development happens in the git worktree `C:\RnD\.wt\3dengine` (branch `3dengine`); a closed milestone is merged into the local `main`. Never pushed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: [../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md](../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md) · Board: [../../development/tasks/3dengine/README.md](../../development/tasks/3dengine/README.md)
