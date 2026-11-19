# v2/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
Rainbow v2: a SECOND, separate test version of the Rainbow experience at `/v2/` (Eliran 2026-11-09: «תיצור לי עוד לינק עם הגרסה השנייה לבדיקה … ואל תשנה כלום ב-https://habait-flow.vercel.app/»). Its pattern was learnt from a reference screen recording (hero film → a floor number beside the tower → the floor isolated → the apartment cutaway → full-screen rooms with a caption and a filmstrip) and rebuilt with our own media only. No production page links here and nothing here changes a production page. Plan: `development/plans/2026-11-09-rainbow-v2.md`.

## What's here
| File | What |
|---|---|
| `index.html` | the page: hero film · floor 16 / apartment 846 · the cutaway (dollhouse still + the live 3D on request) · 8 rooms · CTAs «לסיור 360° בדירה» (tour) and «לכל הדירות» (hold) |
| `v2.css` | its own styles; static by default, `html.is-motion` = sticky stages scrubbed by `v2.js` |
| `v2.js` | facts and routes from `../fixtures/rainbow/project.json` + `units.json`, the hero film, GSAP 3.13 ScrollTrigger + SplitText + Lenis (fine pointers) from `../js/vendor/` |
| `media/` | the stills (hold frame, room flats, dollhouse still) and their `manifest.json` (made by `../tools/make_v2_media.py`, $0) |

## Gotchas
- Reduced motion / no JS = the static page: every stage visible, nothing pinned. Keep it complete when adding motion.
- Floor 16's band and pin are positioned in the hold frame's own coordinates (CSS vars `--ax --ay --bx0 --bx1 --by0 --by1`, from `media/manifest.json` `floor16`). Changing the frame = re-project, never nudge by eye. No geometry is moved: the "isolated floor" is light and crop only (root §6).
- GSAP owns the transforms of `.v2-frame`, `.v2-pin`, `.v2-floor__copy`, `.v2-cut__img`, the rooms: centre them with margins/insets, not the CSS `translate` property (GSAP folds it into its own transform).
- Every picture carries «הדמיה · AI-generated»; the project render THE-2 carries «הדמיה» (as on the landing). No prices (`prices_public: false`).
- The stage (`stage_flow.py`) copies this folder as part of the platform; the live tour/hold links are resolved from project.json at run time (the stage rewrites its 127.0.0.1 hosts).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-09-rainbow-v2.md`
