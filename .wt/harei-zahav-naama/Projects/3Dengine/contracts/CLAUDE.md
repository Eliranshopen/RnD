# contracts/ — the shapes that cross a boundary
<!-- last-updated: 2026-11-17 -->

## What's here
The contract of each milestone and the JSON Schemas of what crosses a boundary: the MCP tools (agent ↔ engine) and the job file (engine ↔ bridge). The server loads its `tools/list` schemas from here, so these files ARE what the agent sees.

## Key files
| File | Purpose |
|---|---|
| `CONTRACT-0.2.md` | milestone 0.2, a stub engine connected to the agent: the server, the eight tools, the job file, the settings, the runner and the local link, the bridge, the app, Pi. Changed by the main session only |
| `CONTRACT-0.3.md` | milestone 0.3, a job on the disk: one runner and its stages, `manifest.json`, `ledger.json`, alive or stalled, the heavy lock, start / resume / cancel, the closing test. Sections 10 to 16 = the rules added after the first seven QA rounds; each wins over what is before it. Section 17 = the eighth round (PASS) and what it saw that the milestone does not answer. Changed by the main session only |
| `CONTRACT-1.1.md` | milestone 1.1, intake and a first look at the PDF: what `inspect_plan` answers, the candidates and how a job chooses one, the verified read-only copy, the check of the stored input, the identity of `job.json` and `manifest.json` (carried from 0.3), the settings, the engine version, the six parts of the closing test, what changed in earlier tests, what is not in 1.1. Changed by the main session only |
| `job.schema.json` | `jobs/<job_id>/job.json` (`habait/job.v1`): every field, the 14 states, the 14 reason codes (0.3 added `STAGE_FAILED`), (0.3) `attempts`, `waiting_for`, and the computed `runner` of `get_job` / `list_jobs`; (1.1) `input.pdf_bytes`. Unknown top-level fields allowed (later milestones extend, never break) |
| `manifest.schema.json` | (0.3) `jobs/<job_id>/manifest.json` (`habait/manifest.v1`): one row per finished stage attempt |
| `ledger.schema.json` | (0.3) `jobs/<job_id>/ledger.json` (`habait/ledger.v1`): every paid call, `reserved` / `settled` / `failed` / `orphaned`; `sending_at` (set just before the send); the flags `recovered`, `late`, `not_sent`, `resend_of`, `answer_not_kept` (contract 0.3 §10 to §16) |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `tools/` | [`tools/CLAUDE.md`](tools/CLAUDE.md) | one input and one output schema per tool, 16 files |

## Conventions / gotchas
- Only the keywords `mcp/schema-check.mjs` implements may be used (`assertSupported` fails the tests otherwise): type, enum, const, properties, required, additionalProperties, items, min/maxItems, minimum/maximum, min/maxLength, pattern; plus annotations.
- A nullable object is `"type": ["object", "null"]`; its `required` applies only when it is an object.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Server: [../mcp/CLAUDE.md](../mcp/CLAUDE.md)
