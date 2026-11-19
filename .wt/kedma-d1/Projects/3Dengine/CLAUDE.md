# Projects/3Dengine/ — the engine: sales-plan PDF → full 360 tour
<!-- last-updated: 2026-11-16 -->

## What's here
The engine that turns a developer's sales-plan PDF (תכנית מכר) into a full 360 apartment tour, built to be driven by the agent through MCP. Plan: `development/plans/2026-11-16-pdf-to-360-engine-mcp.md` (the page Eliran reads is the `.html` beside it). Board: `development/tasks/3dengine/` — one card per milestone (0.1 → 7.5), each closed by its gate before the next starts (Eliran, 2026-11-16).

**State 2026-11-16:** milestone 0.1 (the engine home). The pipeline code is here as it was in git, the runtime and the render assets are in place, and the readiness command checks all of it. No job layer, no MCP server and no stages of its own yet: those are milestones 0.2 onward.

## Key files
| File | Purpose |
|---|---|
| `engine.config.json` | the ONE settings file: where Python, Blender, Chrome, the pipeline, the assets and the legal data are; the key NAMES. Machine overrides: `engine.config.local.json` (untracked) |
| `requirements.lock.txt` | the Python environment, 20 pins, the versions of the environment that produced apartment 846 |
| `package.json` | `npm test` (the whole suite, fails under 80 % line coverage of `engine/**`), `npm run test:unit`, `npm run doctor` |
| `.gitignore` | keeps `.venv/`, `.runtime/`, `jobs/`, `node_modules/` and every env file out of git |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `engine/` | [`engine/CLAUDE.md`](engine/CLAUDE.md) | the engine's own code: settings, readiness, set-up scripts, CLI |
| `pipeline/` | [`pipeline/CLAUDE.md`](pipeline/CLAUDE.md) | the tools brought from git `a63494a`, unchanged |
| `house/` | [`house/CLAUDE.md`](house/CLAUDE.md) | brand and legal data the tour carries |
| `appdeps/` | [`appdeps/CLAUDE.md`](appdeps/CLAUDE.md) | the two Node libraries the pipeline loads (`sharp`, `playwright-core`), locked |
| `tests/` | [`tests/CLAUDE.md`](tests/CLAUDE.md) | unit tests and one closing test per milestone |

Not in git, rebuilt by the set-up scripts: `.venv/` (Python), `appdeps/node_modules/`, `.runtime/` (set-up manifests), `jobs/` (run output, from milestone 0.3), and the render assets inside `pipeline/360walkaround/`.

## Commands
```
node engine/cli.mjs doctor              # is the engine ready? (exit 0 = ready, or ready except the keys)
node engine/cli.mjs env                 # the environment pointers the pipeline gets
node engine/cli.mjs setup-env [--go]    # Python environment + Node libraries, from the locks (dry-run without --go)
node engine/cli.mjs bring-assets [--go] # render assets from the backup, verified by sha256 (dry-run without --go)
npm test                                # the whole suite + the 80 % coverage bar
```

## Conventions / gotchas
- **One milestone at a time** (Eliran, 2026-11-16): plan to tasks → develop → tests → test coverage ≥ 80 % → sync-context → the next. The process and the milestone log: plan §7.2.
- **`pipeline/` is not edited.** A change there is listed in `pipeline/PORT-CHANGES.md`; the closing test of 0.1 compares every file with git `a63494a`.
- **Keys by NAME only** (`FAL_KEY`, `OPENROUTER_API_KEY`): the readiness command says present or missing, never a value. No env file is committed; never name one in a command.
- **The Blender lock is machine-wide** (`C:/RnD/.wt/_blender.lock`): one Blender at a time on this machine, whichever folder starts it (root §12).
- **The Kenney pack zip cannot be downloaded any more** (the URL returns a web page). `fetch.mjs --verify-only` needs it in `pipeline/360walkaround/catalog/.cache/` to verify 45 of the 57 models, and without it prints `12/57 rows OK` while still exiting 0. The only copies: the 2026-11-03 archive under `C:\HABAIT-Archive`, and this home's cache.
- Development happens in the git worktree `C:\RnD\.wt\3dengine` (branch `3dengine`); a closed milestone is merged into the local `main`. Never pushed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: [../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md](../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md) · Board: [../../development/tasks/3dengine/README.md](../../development/tasks/3dengine/README.md)
