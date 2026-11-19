# engine/ — the engine's own code
<!-- last-updated: 2026-11-16 -->

## What's here
The code that turns the brought-in pipeline into an engine. Node ESM (`.mjs`), Node built-ins only, no npm dependencies. As of milestone 0.1: the settings loader, the readiness command, the two set-up scripts and the CLI. The job layer, the stages and the MCP server arrive with milestones 0.2 onward.

## Key files
| File | Purpose |
|---|---|
| `cli.mjs` | `main(argv, io)` → exit code. Commands: `doctor [--json]`, `env`, `setup-env [--go]`, `bring-assets [--from <dir>] [--go]`, `help`. Exit 0 ok, 1 not ready or failed, 2 usage |
| `config.mjs` | `loadConfig()` reads `../engine.config.json`, then `engine.config.local.json`, then `ENGINE_PYTHON` / `ENGINE_BLENDER` / `ENGINE_CHROME`; returns absolute forward-slash paths. `pipelineEnv(config)` = the 11 environment pointers the brought-in tools read |
| `doctor.mjs` | `runDoctor(config, deps)`: node, python (the 20 pins), node-libs, blender, chrome, legal, pipeline (parity), assets-catalog (57 models), assets-packs, assets-hdri, keys (by name) → `{ready, ready_except_keys, checks}`; `formatReport(result)` |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `lib/` | [`lib/CLAUDE.md`](lib/CLAUDE.md) | small helpers |
| `setup/` | [`setup/CLAUDE.md`](setup/CLAUDE.md) | the set-up scripts: the Python environment and the Node libraries, the render assets |

## Conventions / gotchas
- Every function takes its outside world as a `deps` object (run a command, read a file, hash a file), so the unit tests need no Python, no Blender and no assets.
- A key's value never enters a result, a report or a log: `readEnvNames` returns names only, and a unit test plants a fake secret and looks for it in every output.
- A command that changes the disk is dry-run unless `--go`, is safe to repeat, and writes a manifest row under `.runtime/` (root §5).
- `npm test` fails under 80 % line coverage of this folder; a new file must be imported by a test (`tests/unit/all-modules.test.mjs` imports every file here so none is missing from the table).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Tests: [../tests/CLAUDE.md](../tests/CLAUDE.md)
