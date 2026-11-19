# secrets-steward — lessons and entries (newest last)

## 2026-11-03 · secrets-steward · burned-credential filing: FAL_KEY, MYARCHITECTAI_API_KEY
- **Did:** upgraded both ledger rows to `BURNED — ROTATION OWED` (exposure: read-only doc review sub-agent opened the live `.env`, values entered its transcript; names only). Named `C:\Habait-archive-2026-11-03\habait-walkaround\.env` as the second copy. §2 wording "worktree's" -> "working folder's". Added a §3 addendum (rotate in the live `.env` only, archive stays frozen, scrub is Eliran's call). Added §4 rotation checklist (9 steps, 4 probes owed). Added OWED-013 pointing at it.
- **Evidence:** `C:\RnD\docs\governance\SECRETS-LEDGER.md` §1, §3, §4; `C:\RnD\docs\governance\OWED.md` OWED-013. Exposure source is the main session's task statement; no transcript path exists on disk.
- **Learned:** the persona's OWED-001/002 refer to the old harness; here OWED-001/002 are git items, so a new id (013) was used. The rotation runbook was not transferred, so the ledger §4 holds the procedure for this round. No probe exists yet for MYARCHITECTAI_API_KEY.
- **Owed / open:** Eliran runs console steps; main session or `habait-deploy-qa` runs the 4 probes; Eliran approves any paid probe call. Rows stay BURNED until probe evidence is recorded.
- **Second reader:** main session — must run/route the probes and never let a value into chat; pointer: ledger §4 and OWED-013.

## 2026-11-04 · main-session → second-reader pointer
- project/2026-11-04-keys-kept.md — Eliran kept the exposed FAL_KEY + MYARCHITECTAI_API_KEY (no rotation); OWED-013 closed by ruling; ledger rows EXPOSED — KEPT → `memory/project/2026-11-04-keys-kept.md`
