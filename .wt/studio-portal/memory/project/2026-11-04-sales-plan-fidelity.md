
## 2026-11-04 · main session rnd-67 · Eliran: the simulation must match the sales plan exactly
- **Did:** Eliran ruled: every dimension, detail and element of the simulation must be accurate to the sales plan; a buyer must never see a simulation that differs from it. This strengthens root section 6 (add-only, never alter geometry) into a fidelity requirement.
- **Evidence:** `memory/HOT.md`
- **Learned:** Today's apt846 tour carries the concept line 'הריהוט, הנוף וחלק מהמידות מדומיינים' and was never audited room by room against the sales plan; the typed bar already refuses structure and view changes (handler SCOPE structure:false).
- **Owed / open:** rnd-67: propose a plan-fidelity audit of the 11 rooms (dimensions, windows, doors, fixed kitchen/bath elements vs the sales-plan PDF) and a fidelity gate in the developer platform
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · fidelity-audit sub-agent (general-purpose, for the main session) · apt846 sales-plan fidelity audit
- **Did:** Audited the 11 apt846 panoramas against the sales-plan PDF (read and judge only, $0). Verdict DEVIATES: 3 S0, 3 S1, 6 S2, 3 Q. The S0s are an extra curved glass wall in the living room, a window over the terrace column face in the main bedroom, and an invented doorway in the dressing nook.
- **Evidence:** `Projects/Habait/research/fidelity-audit-2026-11-04/manifest.json`
- **Learned:** The CG originals sit on the traced plan in every room; all three S0s were introduced by the AI skin pass, so a mechanical gate (traced floor/ceiling lines or CG-vs-pano structure) catches them. Trace errors: hob on the wrong kitchen leg, terrace south passage unmodelled (18.69 vs 26.15 m2), whole terrace roofed (plan: 14.34 m2 covered).
- **Owed / open:** Main session: save REPORT.md from the sub-agent's return text; regenerate 04/07/08 (and 02/03 after the kitchen trace fix); trace fixes F4/F5/F6/F8; Eliran: OQ-G4 roof ruling, conceptLine wording, PDF tracked in git despite rights note.
- **Second reader:** `habait-deploy-qa`

## Eliran's rulings after the audit (2026-11-04, rnd-67)
- **Disclosure line:** replace "חלק מהמידות מדומיינים" with wording that states the measured deviation from the sales plan (exact text: rnd-67 drafts, Eliran approves; it may only claim what the fidelity check proves).
- **Terrace roof:** follow the sales plan (roof only inside "קו קומה מעל", 14.34 m²); supersedes OQ-G4 for apt846.
- **Sales-plan PDF in git:** allowed ("לא אסור … תמחק את החוק הזה כי מותר"); the "never in git" note in `apt846/apartment.json` removed (merge `9039ba2`).
- Audit: `Projects/Habait/research/fidelity-audit-2026-11-04/REPORT.md` (DEVIATES: 3 S0 from the AI skin pass, 3 S1).
