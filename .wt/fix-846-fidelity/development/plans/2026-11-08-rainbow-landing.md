# Plan — the Rainbow landing page at the habait-flow root
<!-- 2026-11-08 · worktree .wt/rainbow-landing (branch rainbow-landing, off main 1a54ce0) · owner: Eliran Shopen · $0 -->

## The ask (Eliran, verbatim)
«אני רוצה גם שתשפר את כל הנראות של הדף נחיתה הראשוני של הפרויקט — שזה יהיה ממש דף נחיתה ייעודי לפרויקט, לפרויקט RAINBOW, ששם ישר יהיה סרטון של כל הבניין מבחוץ איך שנכנסים לעמוד» … «ללא עלות».
Later the same day: «עבור הדף נחיתה בהתחלה אתה יכול לקחת רעיונות מהסרטון הזה C:\RnD\screenshots\Rainbow-Boutique-1080p.mp4» (ideas only) and «הוספתי לך עוד כמה תמונות שאתה יכול להשתמש בהם … C:\RnD\screenshots» (THE-1/2/3/6, cleared for the page).

## What exists (measured 2026-11-08)
- `/` = `Habait/platform/index.html` (stage_flow.py step 1 copies the platform folder to the site root). Today: a generic "projects" page — a short aerial still, «סיור בבניין, לפני שהוא קם.», one project card. `projects.json` lists ONE project (rainbow); no other project exists, so there is nothing to keep a list for.
- Exterior films, all AI (Kling v2v over the Blender clay orbit; the 1080 one is Topaz Starlight, board exterior-film A2): `hold/data/video/building-film-1080.mp4` (24.8 s = orbit 0–14.5 s → facade arc → dip to black 20.5 s → descent INTO the apartment, i.e. the old interior Eliran flagged), `fixtures/rainbow/orbit_real.mp4` and `_local/segments/rainbow-cine/orbit.mp4` (720p versions of the same orbit), `approach.mp4` / `intro-approach-interim.mp4` (fixture crossfades of clay stills). Contact sheets: scratchpad `frames/*.jpg`.
- Facts we may print (our data only): `project.json` name, tagline «מגדל מגורים על קו הים», developer «ישראל קנדה» (shown since OWED-024), the disclaimer; apartment 846: floor 16, the 360 tour of 11 spaces (`apartment.json tour.rooms`), sales plan DBLK Architects 15.10.2025; THE-1's printed place labels (נמל ת"א, פארק רידינג, מרינה, חוף הים, כוכב הצפון).
- **Not printed, on purpose:** price, unit counts (units.json is a fixture: "every price and every unit except 846's geometry is invented"), and 846's rooms/area — `units.json` says 4 rooms · 118 m² · 22 m² terrace, but the sales-plan meta (`data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/meta.json`) says 3 rooms · 106.72 m² · 26.15 m². The apartment page shows the units.json numbers → open question Q2.

## Reference: Rainbow-Boutique-1080p.mp4 (ideas only, not shipped, no footage cut)
27 s, 1920×1080. What we took: (1) the building is introduced by an aerial over the sea, then the name appears; (2) the wordmark is a classical Roman serif in wide-tracked caps with a small tracked sub-label under it — we set «RAINBOW» in our own display serif (Frank Ruhl Libre, house token) with 0.14 em tracking and «TEL AVIV» under it; (3) one short Hebrew line per beat, low on the frame, start side; (4) a small «הדמיה» mark sits in the same corner on every frame — our badge sits bottom-end on the hero and on every picture; (5) bright daylight, sea blue + warm sand + white — matches our film and the house warm stone. Not taken: its claims ("220 sold", "resort"), its people, birds, logo plate, or any frame.

## Direction (locked, navigator mode)
Editorial, quiet, daylight. Light warm-stone page (house tokens: `--brand-primary #005d83`, `--brand-accent #eea927`, Heebo + Frank Ruhl Libre), one dark band only in the hero and the closing CTA.
1. **Hero** — the film full-bleed, 100 svh (phone and desktop, min 560 px, max 980 px); the header floats over it (turns solid once the hero scrolls away). Bottom-start: eyebrow, the RAINBOW wordmark, one promise line, primary CTA «לסיור בפרויקט» (the same route as today: `projectHref()` = /hold/ with the orbit intro) + secondary «לדירה 846». Bottom-end: «הדמיה · AI-generated» + a 44 px pause/play (WCAG 2.2.2). Scrim only at the bottom (text) and a thin top band (header).
2. **Location** — THE-1 (render with its place labels) + the five place names as a list.
3. **Architecture** — THE-2 (dusk), THE-3 (street), THE-6 (roofs): a three-picture mosaic, no claims, captions describe the view only.
4. **The experience** — four cards, each a real route: fly around (/hold/ + film) · pick an apartment on the facade (/hold/ without the film) · walk into 846 (/tour/ living) · change finishes (/tour/ kitchen). Pictures = our own film frames and flat views of the current tour panoramas.
5. **Apartment 846** — a large living-room view + the facts above + links: apartment page, plan tab, 3D tab, 360 tour.
6. **Closing band** — the CTA again; footer: developer, the legal disclaimer (one line → full), the a11y slot (Eliran's), a quiet «פורטל יזמים» link to /studio/.

## Media (all $0, local ffmpeg, `Habait/platform/tools/make_landing_hero.py`, manifest `fixtures/rainbow/landing/manifest.json`)
- **Film chosen: `building-film-1080.mp4`, 0 → 14.4 s only** (the clockwise orbit: whole tower, sea, city; best source = 1080p Starlight). Cut before the facade arc, so no interior and none of the old apartment images. Loop seam: the last 0.8 s dip through black into its own first 0.8 s (a plain dissolve ghosted two orbit poses — the same lesson as exterior-film A), so `<video loop>` restarts on the identical frame. Encodes: `hero-1080.mp4` 7.2 MB (H.264 high, ~4.4 Mb/s, faststart, no audio), `hero-720.mp4` 3.3 MB (small landscape screens), `hero-portrait.mp4` 3.4 MB (portrait screens); poster = loop frame 0 (`hero-poster-1920/960.jpg`, the LCP image).
- Section stills: `facade.jpg` (film frame, card 02), `interior-entrance.jpg` (card 03), `finish-parquet.jpg` + `finish-marble.jpg` (card 04, the same floor view in two tour finishes shown side by side in HTML, no compositing), `interior-living.jpg` (apartment 846) — v360 flat views of the CURRENT gated tour panos, not the older `_local/dist` stills, whose panos differ from the tour's. Phone hero: `hero-portrait.mp4` (2:3 crop of the 1080 source around the tower, 3.4 MB) + `hero-poster-portrait.jpg`.
- THE-1/2/3/6: originals 1056×696 (nothing larger exists; never upscaled) → `renders/the-N-{1056,640}.{webp,jpg}`; scale + re-encode only, originals in `screenshots/` untouched.

## Decisions logged (navigator mode, for Eliran's audit)
- D1 The root becomes the Rainbow landing page; no "other projects" link (none exist). `landing.html` (the A/B lead page) stays reachable as before.
- D2 Video starts only after the poster is painted (`load`); portrait screens get the 2:3 crop, landscape ≤ 900 CSS px or DPR-width ≤ 1400 the 720p, poster-only on Save-Data; pauses off-screen; reduced motion = poster + play button, no autoplay.
- D3 No new facts: everything printed is from project.json, apartment.json, the sales-plan meta, or THE-1's labels.
- D4 Strings live in `js/home.js` (its own he/en table); `js/i18n.js` untouched (parallel forks).

## Open questions for Eliran (not blocking the build; raised by the coordinator at the deploy go)
- ~~Q1 Disclosure wording on THE-1/2/3/6.~~ **CLOSED 2026-11-08 — Eliran ruled «הדמיה»** (as built; EN shows «Render»). Our own AI media keeps «הדמיה · AI-generated».
- **Q2 846 facts mismatch** (fork A is fixing units.json to the sales plan; this landing touches no unit data). units.json (4 rooms, 118 m², 22 m²) ≠ the sales plan (3 rooms, 106.72 m², 26.15 m²); the apartment page prints the units.json numbers. Sales-plan fidelity says the plan wins; the fix is outside this landing (the landing prints neither).
- **Q3 The reference film.** Not used. If Eliran wants a clip of it on the page, that is a licensing call (third-party material).

## Done when
Headless Chrome at 1440 and 390 (poster first paint, video playing, sections, EN): video `currentTime` advances, 0 page errors, no horizontal overflow, a badge on every property picture, every CTA resolves; responsive gate PASS; predeploy PASS on a local stage; merged into main; NOT deployed (the coordinator asks Eliran).

## Round 2 — Eliran's review (2026-11-08, before the deploy)
His words: «בדף הנחיתה עצמו אני לא רוצה הפנייה רק לדירה 846 אלא סרטון כללי על הפרויקט ואז יש מעבר לסיור בפרויקט ואז מתחיל כל הסרטון ריחוף של הבניין ועצירה ומראה של כל הדירות וכל מה שאנחנו מכירים» · «אני לא רוצה שרק דירה 846 תהיה האופציה היחידה, אני רוצה אחרי הריחוף שכל הדירות יראו לי ואוכל לבחור כמו שהיה עד עכשיו».
- **Done:** the page is about the whole project. Removed: the «לדירה 846» hero button, the «דירה 846» nav item, the apartment-846 section and every 846 string (the check asserts 0 × «846» in `<main>`). Nav = «המיקום» · «החוויה». The four experience cards now describe the steps of the ONE flow in order (fly around → stop at the facade with every apartment marked → step inside → change the design). They are not links. The page has one action, «לסיור בפרויקט» (hero + closing band), and both go to the same route.
- **The route is unchanged:** `projectHref()` = `/hold/?…&orbit=<orbit_real.mp4>`, the same as the old home page (1a54ce0). It was proven equal to the production home page's CTA, origins stripped. Flow proof (`test/rainbow-flow.check.mjs`, 1440 + 390):
  - landing → CTA → the fly-around film plays (`orbit_real.mp4`) → it hands over to the hold and stops in front of the tower;
  - all 12 units of units.json have a marker; 9 pills are visible at 1440 and 8 at 390, and the rest sit behind the front units, as before;
  - pick 845 → its card; pick 846 → «המשיכו אל הדירה» → descent → the apartment tour is in front.
- The flow itself (`/hold/`, `js/picker.js`, the tour) was not touched. Only 846 can be entered today (`canEnter` in the hold). That is the existing behaviour, not a landing change.
- Observed in round 2: at 390 the hold's legend and «דירות» chip sat over its title (fixed in round 3).

## Round 3 — the hold's phone chrome (coordinator, 2026-11-08, $0)
The hold is now the first screen after «לסיור בפרויקט». At 360/390/430 its top chrome piled up: the picker row was pinned at 64 px, on the title at 72 px.
- **Fix** (`research/fal-bench-2026-11-02/flyover3d/index.html` CSS + `app.js` `placeDragHint()`; flow and data untouched). On a portrait phone everything sits in one column, in flow, under the two top buttons, so nothing can overlap whatever its height: title → legend → «דירות» → the legal line, on a glass panel because it is the AI disclosure and must read over the sky. The hint «לחצו על דירה» is dropped on phones because the title already says «בחרו דירה». The drag hint goes 14 px under the column and still leaves on the first drag or after 9 s. On wider screens the drag hint now goes under the title; at 1440 it used to cover pills 836/826. The rest of desktop is unchanged.
- **Proof:** `test/hold-chrome.check.mjs` checks the bounding boxes of the top elements pairwise, against the viewport and against the visible pills. On live main before the fix it FAILS (6 overlaps on phones, the drag hint on 2 pills at 1440); after the fix it PASSES at 360/390/430/1440. The flow check, the responsive gate and predeploy were re-run.

## Round 4 — prices hidden, no portal link on the landing (Eliran, 2026-11-08, $0)
Eliran: «כן, להסתיר» (the units.json prices are fixtures) and «פורטל יזמים … לא צריך להיות בדף נחיתה».
- **One switch:** `fixtures/rainbow/project.json` `"prices_public": false`. Every price render reads it, and anything but `true` means no price:
  - `js/picker.js` (the unit card and the «דירות» list on /hold/ and flow.html; the «מחיר לפי פנייה» line also goes);
  - `js/apartment.js` (`#aptPrice` hidden, and no price row in «אודות»);
  - `js/landing.js` (no price row in the facts).
  - `tools/build_zip.mjs` copies the flag into `apartment.json`. The dist was not rebuilt: an `apartment.json` without the flag means no price, so the live 846 dist already renders none. Turning prices on later = `true` in project.json plus a build_zip rebuild of the dist.
  - The fixture price values stay in units.json and apartment.json.
- **No layout gap:** the card's price line is not rendered at all. The facts row follows the head with the sheet's own 12 px gap, so there is no orphan «₪».
- **The /hold/ list:** while the unit card or the «דירות» list is open, the picker stage rises above the top buttons and the drag hint (`#pickerStage:has(open panel) { z-index: 8 }`); they used to float over the list and its title.
- **Landing footer:** the «פורטל יזמים» link is gone in HE and EN; /studio/ stays live at its own address. The footer reads Habait mark · «יזם: ישראל קנדה» · the legal line.
- **The «fixture» chip** next to «למכירה» on the apartment page and **the landing's a11y TODO** are dev-only (DEV = localhost or ?dev=1). Confirmed hidden on prod dpl_6JZXxQ2B (`no-price/prod-dev-only.json`).
- **Not touched:** the tour's furniture-catalog prices («מחיר נכון ל-…», IKEA items) are catalog prices, not unit prices, and they belong to the tour viewer (fork A's files). flow.html's HUD targets are under 44 px; that is pre-existing on main and flow.html is not a Rainbow buyer route.
