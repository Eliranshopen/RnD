# tests/ — the engine's tests
<!-- last-updated: 2026-11-16 -->

## What's here
| Folder | Context file | Purpose |
|---|---|---|
| `unit/` | [`unit/CLAUDE.md`](unit/CLAUDE.md) | unit tests of `engine/`; no environment needed |
| `milestones/` | [`milestones/CLAUDE.md`](milestones/CLAUDE.md) | one closing test per milestone, against the real environment |
| `helpers/` | [`helpers/CLAUDE.md`](helpers/CLAUDE.md) | the fakes the unit tests share |

## Commands
```
npm test            # everything: unit + milestones, fails under 80 % line coverage of engine/**
npm run test:unit   # unit only, no environment needed
node --test tests/milestones/m0.1.test.mjs   # one milestone's closing test
```

## Conventions / gotchas
- **The gate of every milestone** (Eliran, 2026-11-16; plan §7.2): its closing test, unit tests for the code it adds or changes, every earlier milestone's tests again, and at least 80 % line coverage. `npm test` is that gate in one command.
- Runner and coverage are Node's own (`node --test`, `--experimental-test-coverage`): no test dependency to install.
- A milestone test FAILS when the environment is missing; it never skips.
- The coverage counts `engine/**` only. The code under `pipeline/` came from git as it is and is proven by the milestones of kind «קיים», which run the real tool and compare with the measured number.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
