# SECRETS-LEDGER — credential NAMES, never values
<!-- created: 2026-11-03 · kept by secrets-steward · authority: Eliran (inherited D8) -->

## §1 The ledger
| Name | Lives in | Exposure event | Rotation state | Date | Probe that proved it |
|---|---|---|---|---|---|
| `FAL_KEY` | `C:\RnD\Projects\Habait\habait-walkaround\.env` (live); second copy, same value: `C:\Habait-archive-2026-11-03\habait-walkaround\.env` (frozen archive, the old `C:\Habait` renamed at cut-over) | 2026-11-03: a read-only documentation-review sub-agent opened the live `.env` and the value entered its session transcript (not repeated in its report). Root §8.1: transcript exposure = burned. (Earlier row, superseded: "none known", names read by a value-masking `sed`.) | **EXPOSED — KEPT BY ELIRAN'S RULING 2026-11-04** (was: BURNED — ROTATION OWED). **Eliran's ruling 2026-11-04: keep the existing keys, no rotation** ("תמשיך הכל טוב עם המפתחות שקיימות בקובץ"). Exposure was a local sub-agent transcript, not public. Probe 2026-11-04: FAL_KEY authenticates (2xx, $0.000076; `development/tasks/studio-agent-fal/logs/spend-ledger.txt`). Risk accepted by Eliran | 2026-11-03 | exposure: the sub-agent session as reported by the main session in the secrets-steward task of 2026-11-03 (no transcript path on disk). Rotation probe: not yet run — see checklist at the end. Pre-exposure baseline only: task 07 of board `copy-habait-2026-11-03` (fal `--dry-run`) |
| `MYARCHITECTAI_API_KEY` | same live file; second copy, same value: `C:\Habait-archive-2026-11-03\habait-walkaround\.env` | 2026-11-03: same review, same file, same event — value entered the sub-agent's session transcript (not repeated in its report). (Earlier row, superseded: "none known".) | **EXPOSED — KEPT BY ELIRAN'S RULING 2026-11-04** (was: BURNED — ROTATION OWED; Eliran: "תמשיך הכל טוב עם המפתחות שקיימות בקובץ"; not probed — no MyArchitectAI call path was run) | 2026-11-03 | exposure: as above. Rotation probe: not yet run (no tool on this machine exercises it in dry-run; see checklist) |

A value that reaches a chat transcript, a task file, a commit or `memory/` is **burned**: file the row the moment it happens, prepare the rotation checklist Eliran runs in the console, record the outcome from the probe result only.

## §2 Env backups are a secrets question
Any copy of an `.env*` file (a backup folder, a working folder's `_env-backups/`, a zip) is a credential store: it is listed here by name, never opened by an agent, and its removal is Eliran's act.

## §3 Two copies until cut-over
From 2026-11-03 the same `.env` exists in `C:\Habait\habait-walkaround\` (the live source) and in `C:\RnD\Projects\Habait\habait-walkaround\` (the copy). A rotation before cut-over must update both, or the source is archived first (board `copy-habait-2026-11-03` task 09). **Closed 2026-11-03:** `C:\Habait` was renamed to `C:\Habait-archive-2026-11-03` after the cut-over; the live `.env` is the copy's only. The archive still holds the same values — a rotation also invalidates it; deleting the archive is Eliran's act.

**2026-11-03 (addendum):** cut-over is closed and the archive copy holds the same values as the live `.env`. A rotation therefore replaces the value in the live `C:\RnD\Projects\Habait\habait-walkaround\.env` only and leaves `C:\Habait-archive-2026-11-03\habait-walkaround\.env` as a frozen record (its old values are dead once revoked); scrubbing it is Eliran's call. No agent opens either file.

## §4 2026-11-03 — Rotation checklist: `FAL_KEY` + `MYARCHITECTAI_API_KEY` (BURNED, OWED-013) — NOT RUN: Eliran kept the keys 2026-11-04; kept for a future rotation
Eliran runs every console step; no value is ever pasted into chat (a value pasted there is burned again). The old `C:\RnD\docs\governance\key-rotation-runbook-2026-08.md` was not transferred, so this list is the procedure for this round.

1. Copy the live `C:\RnD\Projects\Habait\habait-walkaround\.env` aside first (outside the repo tree, e.g. a new folder under `C:\RnD\.wt\_env-backups\`). The copy is itself a credential store: list its path here by name only, never open it from an agent.
2. fal console: create a new key for `FAL_KEY`. Leave the old key active for now.
3. MyArchitectAI console: create a new key for `MYARCHITECTAI_API_KEY`. Leave the old key active for now.
4. Edit the live `.env` by hand: replace the value on the `FAL_KEY=` and `MYARCHITECTAI_API_KEY=` lines (names stay, values change). Do not edit the archive copy `C:\Habait-archive-2026-11-03\habait-walkaround\.env`; it stays frozen.
5. If either name is also set in any deployed environment (Vercel or other), set it there through a pipe, never printed. Whether either is set remotely is not recorded in this ledger; Eliran confirms. Env changes are not retroactive: redeploy once afterwards, on its own explicit go (root §9).
6. Probe, in this order (specified here; the main session or `habait-deploy-qa` runs it and returns status codes only, loading the key from the `.env` without echoing it):
   - `FAL_KEY` new key: one authenticated request from the live root through the product's own fal path, `--dry-run` first, then the cheapest paid call only inside a budget and ledgered BEFORE it runs, on Eliran's go (root §7). Pass = authenticated success (2xx). A dry-run alone does not exercise the key.
   - `MYARCHITECTAI_API_KEY` new key: no tool on this machine exercises it in dry-run. Eliran names the cheapest authenticated MyArchitectAI call (a balance or account read if the vendor offers one); same ledgering and go rule. Pass = authenticated success.
   - Old keys: a direct authenticated request with each OLD key must return 401 or 403 after step 7. Revocation is proven only by that, not by clicking revoke.
7. Only after both new-key probes pass: revoke the old `FAL_KEY` in the fal console and the old `MYARCHITECTAI_API_KEY` in the MyArchitectAI console. Then run the old-key probes.
8. Hand `secrets-steward` the probe results (status codes, dates, the path of the probe log). Rows close from that evidence only; until then both stay `BURNED — ROTATION OWED`.
9. Eliran's separate call: whether to scrub the archive `.env` (it holds only dead values after step 7).

Probes still owed: 4 (two new-key, two old-key-dead); runner: main session or `habait-deploy-qa`; spend approval: Eliran.
