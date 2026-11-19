# Projects/ — the product projects
<!-- last-updated: 2026-11-03 -->

## What's here
Each product project in its own folder, with its own `CLAUDE.md`, memory and (when it has one) `.claude/` layer. The root contract (`C:\RnD\CLAUDE.md` §0–§12) applies above every project; a project's own card wins inside it on anything it states.

| Project | Folder | Card | State 2026-11-03 |
|---|---|---|---|
| Habait — developer sales plan → 360 tour / flyover / clickable building | `Habait/` | [`Habait/CLAUDE.md`](Habait/CLAUDE.md) (Hebrew, the project's own) | **copied 2026-11-03 12:19** from `C:\Habait` by board `development/tasks/copy-habait-2026-11-03/` — 29,552 files, 30.4 GB, verified 5/5; paths re-pointed (`Habait/REPOINTED.md`). cut over 2026-11-03: `C:\Habait` is archived as `C:\Habait-archive-2026-11-03`; this folder is the only live copy |

## How a Habait session works (Eliran's ruling Q5, 2026-11-03)
- **Start Habait sessions from `C:\RnD\Projects\Habait`.** Its `.claude/agents/` (7 definitions) and `.claude/skills/plan-to-tasks` load only from there; its `CLAUDE.md` and `SESSIONS.md` stay the project's own; since 2026-11-03 the binding memory is the department's `C:\RnD\memory\` and `memory.md` is frozen, grep-only reference (plan `development/plans/2026-11-03-harness-focus.md`, OWED-014).
- The root harness (10 agents, 32 skills, `memory/`) loads from `C:\RnD`; since 2026-11-03 product build work goes to the 7 project agents, and the chat-MVP `habait-*` agents are in `C:\RnD\archive\agents\` (OWED-009 partly).
- The project's git repo is `Habait/habait-walkaround/` (remote still the previous CTO's; HEAD `506f63d`; dirty by design — no commit, checkout, stash, reset or clean without Eliran, as its own `CLAUDE.md` rules).
- Secrets: `Habait/habait-walkaround/.env` (names in `docs/governance/SECRETS-LEDGER.md`; the archive folder holds the same values, so a rotation invalidates both).
- Toolchain from the new root: `tools/habait-venv` was re-created here (not copied — a venv is not relocatable); Blender is the portable folder under `tools/`; env lines in `development/tasks/copy-habait-2026-11-03/logs/toolchain-report.md`.

## Subfolders
| Folder | Card | Purpose |
|---|---|---|
| `Habait/` | [`Habait/CLAUDE.md`](Habait/CLAUDE.md) | the project root: instructions, memory protocol, repo layout, commands (Hebrew-first) |
| `Habait/.claude/agents/` | [`Habait/.claude/agents/CLAUDE.md`](Habait/.claude/agents/CLAUDE.md) | the project's 7 agents (engine-builder, platform-dev, blender-scene, genai-look, cloud-render, qa-reviewer, corpus-and-docs) |
| `Habait/habait-walkaround/360walkaround/pipeline/` | [card](Habait/habait-walkaround/360walkaround/pipeline/CLAUDE.md) | the deterministic Blender/Cycles plan → pano pipeline |
| `Habait/habait-walkaround/Habait/tour360/` | [card](Habait/habait-walkaround/Habait/tour360/CLAUDE.md) | the 360° apartment-tour system |

## Conventions / gotchas
- A project arrives by a board, never by hand: counts, hashes and git integrity are verified before anything points at it.
- Every folder of a project carries a `CLAUDE.md` (root §8.6): the project's own hand-written ones stay as they are; the rest are generated (`generated-by` on line 3), with the Purpose line filled by `codebase-cartographer` from the folder's contents. Inside `Habait/habait-walkaround/` they show as untracked files in `git status` — expected, never committed by an agent.
- `C:\Habait-archive-2026-11-03` is frozen history: never edited, never served from, deleted only by Eliran.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Board: [../development/tasks/copy-habait-2026-11-03/README.md](../development/tasks/copy-habait-2026-11-03/README.md)
