# tests/fixtures/apt846/ — the golden input: the sales plan of apartment 846
<!-- last-updated: 2026-11-17 -->

## What's here
| File | Purpose |
|---|---|
| `source.pdf` | the real sales-plan PDF (תכנית מכר) of apartment 846, Rainbow Tel Aviv: 183,222 bytes, sha256 `0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a`. One vector sheet, 1684 × 1191 pt, 8,515 vector paths, four small images, no text layer |

## Conventions / gotchas
- A COPY of `Projects/Habait/data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/source.pdf` (tracked there), brought in at milestone 1.1 so that the engine's tests do not depend on that folder being on the disk. Never edited: `tests/unit/intake-wiring.test.mjs` fails when its hash changes.
- It is the apartment every milestone of the engine is measured on (plan §7.1). The expected numbers of each stage are added beside it by the milestone that proves them.
- Bytes, not text: `../../../.gitattributes` keeps git from changing its line endings.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [../../../contracts/CONTRACT-1.1.md](../../../contracts/CONTRACT-1.1.md)
