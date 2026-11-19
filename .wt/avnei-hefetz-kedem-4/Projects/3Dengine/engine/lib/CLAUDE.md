# engine/lib/ — small helpers
<!-- last-updated: 2026-11-17 -->

## What's here
| File | Purpose |
|---|---|
| `paths.mjs` | forward-slash paths, resolve against the engine home |
| `hash.mjs` | sha256 of a file (streamed async, or sync in 1 MB chunks), of a text |
| `atomic.mjs` | (0.3) `writeFileAtomic` / `writeJsonAtomic` (temp + rename, retried on Windows). `withFileLock(lock, fn)`: the lock is created WITH its content (`createLockWithContent`: a temp file hard-linked into place), so it is never empty; `lockIsStale`: a dead pid, an empty lock older than a second, or any lock older than `staleMs`; `takeOverStale` puts back a lock that changed meanwhile; `isTransient(e)`: a file error that passes by itself (a reader holds the file, a lock is busy; `RETRY` = EPERM, EBUSY, EACCES and UNKNOWN, the name Node gives a Windows error it does not know) |
| `run.mjs` | `run(cmd, args, {cwd, env, timeoutMs, input})` over `spawnSync` → `{status, stdout, stderr}`; always with a timeout |
| `json.mjs` | read and write JSON, append a row to a manifest array |
| `lock.mjs` | parse `name==version` lines of `requirements.lock.txt`; names normalised as pip does |
| `files.mjs` | list the files of a folder, recursively |
| `main.mjs` | `isMain(argv1, moduleUrl)`: a module runs its main only when executed directly |
| `proc.mjs` | `pidAlive(pid)`, `spawnDetached(script, args, {logFile, env, cwd})` (node, detached, output to a log file, never to the parent's stdout), `sleepSync(ms)` |

## Conventions / gotchas
- No helper reads the environment or the clock on its own: callers pass what they need, so the tests stay deterministic.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
