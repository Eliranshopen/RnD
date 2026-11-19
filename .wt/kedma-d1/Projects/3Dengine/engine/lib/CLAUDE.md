# engine/lib/ — small helpers
<!-- last-updated: 2026-11-16 -->

## What's here
| File | Purpose |
|---|---|
| `paths.mjs` | forward-slash paths, resolve against the engine home |
| `hash.mjs` | sha256 of a file |
| `run.mjs` | `run(cmd, args, {cwd, env, timeoutMs, input})` over `spawnSync` → `{status, stdout, stderr}`; always with a timeout |
| `json.mjs` | read and write JSON, append a row to a manifest array |
| `lock.mjs` | parse `name==version` lines of `requirements.lock.txt`; names normalised as pip does |
| `files.mjs` | list the files of a folder, recursively |

## Conventions / gotchas
- No helper reads the environment or the clock on its own: callers pass what they need, so the tests stay deterministic.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
