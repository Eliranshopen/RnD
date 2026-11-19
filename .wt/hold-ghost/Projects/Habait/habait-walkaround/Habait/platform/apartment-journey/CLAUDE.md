# apartment-journey/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The apartment journey of 846: ONE automatic flight from the hold's «המשיכו אל הדירה» / «כניסה לדירה» into the 360 tour, with no scrolling. This is round 4 of plan `development/plans/2026-11-09-rainbow-v2.md`, §9. Eliran 2026-11-10: «משלב לחיצה על "המשיכו אל הדירה" יש את הריחוף עם האנימציה של הקומות ואז זה ממשיך לסיור 360 של הדמיית הדירה».

The sequence, about 9 s:
1. **Floors:** the counter runs up to «16» beside the tower, with «דירה 846» and the facts; floor 16 glows.
2. **Isolated floor:** that floor stands out alone.
3. **Glide:** one push toward 846's terrace.
4. **Landing:** the living room, drawn as the tour opens it.
5. **Tour:** the 360 tour, cross-faded in by the hold.

## What's here
| File | What |
|---|---|
| `index.html` | the one screen: the hold frame + band + pin, the copy («16», «דירה 846», the facts), the landing canvas, the badge, «דלג לסיור» |
| `journey.css` | its styles. The frame is placed by JS: the hold's own on-screen box (`?fr=`), or cover. Portrait = the hold's blurred air. |
| `journey.js` | the GSAP timeline, the landing drawn from the tour's own panorama with the tour's first-view maths, the messages to the hold |
| `media/` | the hold frame stills (`tower-16-*.jpg`) and `manifest.json` (`floor16`) |

## Gotchas
- **Inside /hold/ it is a frame OVER the hold, and it never opens the tour itself.** It posts `habait:journey-preload`, then `habait:journey-land` or `habait:journey-skip`. The hold owns `#tourFrame`, so the tour's walkthrough music finds the AudioContext of the visitor's tap (`window.parent.__habaitAudio`). Opened on its own, it navigates to the tour.
- **The landing must stay the tour's first view.** It uses room living; the yaw comes from the hand-off URL (the hold's `JOURNEY_YAW`); pitch is −2; hfov is `fitHfov()` copied from `tour360/viewer/tour.js` and the panorama is the `floor=` set. Change one side, change both.
- **Reduced motion: no flight.** The hold opens the tour at once; the page itself hands straight off.
- **Truth and disclosure:** «הדמיה · AI-generated» is always visible. Facts come from units.json; no prices. No geometry is altered: light, crop and zoom on the hold frame, and a reprojection of the gated panorama.
- **Round 3 is archived:** the scroll page (walk, filmstrip, cutaway) and its media are in `../tools/_unused/apartment-journey-r3/` (moved, not deleted; the stage never deploys `tools/`).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Plan: `development/plans/2026-11-09-rainbow-v2.md`
