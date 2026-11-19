# apartment-journey/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The apartment journey of 846 at `/apartment-journey/` (round 2 of plan `development/plans/2026-11-09-rainbow-v2.md`, §8; it was the v2 test page; `../v2/` now forwards to the project landing `/`). The flow (Eliran 2026-11-09: «דף נחיתה … כללי ואז סיור לפרויקט ויהיה את כל המסלול של הסרטון ובחירת דירה מתוך הבניין ומעוף ציפור»):
1. landing;
2. `/hold/`: fly-around, bird's eye, pick from the building;
3. «המשיכו אל הדירה» on 846 → **here**:
   - floor 16 lights on the hold's own frame;
   - the floor is isolated;
   - a push-in flies into the terrace;
   - one walk through the 8 rooms;
   - the whole apartment (cutaway, live 3D);
4. «לסיור 360° בדירה» → the 360 tour.

## What's here
| File | What |
|---|---|
| `index.html` | the page. `?from=hold&unit=846&tour=…&return=…` comes from the hold. `?intro=hero` is a test view of the 846 hero (nothing links to it). The journey is reached ONLY by picking 846 at the hold (Eliran 2026-11-09: no entry point about one apartment). «חזרה לבניין» goes to the hold's stop. |
| `journey.css` | its styles. Static by default; `html.is-motion` turns on the sticky stages; `html.is-journey` hides the hero. |
| `journey.js` | facts and routes from project.json/units.json. The automatic floor reveal on entry. GSAP 3.13 ScrollTrigger + SplitText + Lenis (fine pointers). The fly-in. The walk (frames on canvases, from `media/walk.json`). The tour opens in a full-screen frame **after the iOS audio unlock in the visitor's tap**. |
| `media/` | the stills, the walk frames and their `manifest.json`, all $0 (`../tools/make_journey_media.py`, `../tools/capture_v2_dollhouse.mjs`) |

## Gotchas
- **One frame geometry on every screen.** The floor frame is the hold's frame cover-fitted and centred, exactly as `/hold/` fits it, so the hand-off is the same picture. Floor 16's band and pin are in that frame's coordinates (`media/manifest.json` › `floor16`): re-project, never nudge by eye.
- **No geometry is moved.** The isolated floor is light and crop; the fly-in is a zoom on the hold frame; the walk is flat views of the gated panoramas along the tour's own bearings.
- **The tour must open inside this page** (`openTour`). The tour's walkthrough music uses `window.parent.__habaitAudio`, which only exists if this page made it in the visitor's own tap.
- **GSAP owns the transforms** of `.v2-frame`, `.v2-pin`, `.v2-floor__copy`, `.v2-flyin`, the rooms and the cutaway image: centre them with margins/insets, not CSS `translate`.
- **Disclosure:** every picture carries «הדמיה · AI-generated»; THE-2 carries «הדמיה». No prices.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-09-rainbow-v2.md`
