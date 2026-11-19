# tests/helpers/ — what the tests share
<!-- last-updated: 2026-11-17 -->

## What's here
`fakes.mjs`: a fake settings object, a fake file system, and fake answers for the commands the engine runs (Python, Blender, the parity check), so a unit test can state one fact and change one thing. `stubConfig()` (0.2) = a config whose home, inbox, jobs, runtime folder and tiny site are a real temp folder; `PDF_BYTES` = a minimal PDF.

`cleanup.mjs` (0.3): what a test that started real processes takes away. `stopPids(pids)` kills the live ones and waits until they are gone; `stopServers(home, port)` stops the static server of a temp home, by its record and, when the port is still answered, by the node processes that name the home in their command line (`processesOf`, one PowerShell question, Windows only); `removeHome(home, port)` = the servers, then the folder, in short passes (`RM`). It never kills "whoever holds the port" and never this process. Unit tests: `../unit/cleanup.test.mjs`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
