#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""place_cameras.py -- board 360-v2 T06. The camera auto-placement RULE, and the reconciler that
applies it to `plan.json`'s `camera_points[]` (the one field this task may generate, CONTRACT
§16.4 / C-360-81's "EXTEND the data, never reshape the schema" clause, SCHEMA §7).

Pure Python, no Blender, no third-party deps -- this is 2-D polygon geometry over `plan.json`'s own
`loop`/`bbox_cm` fields, so it runs in milliseconds under a plain `python3` and is independently
testable without paying Blender's startup cost.

--------------------------------------------------------------------------------------------------
THE RECONCILE POLICY (T06 task file, board 360-v2 -- this is the whole point of this module)
--------------------------------------------------------------------------------------------------
1. **Authored seeds are KEPT, verbatim, in place.** Any room that already has >=1 camera_points[]
   entry (T02's 9 curated seeds, or a previous run of this very script) is left untouched. Curation
   beats a rule; a human who placed a point on purpose is never silently overridden.
2. **The rule fills every INDOOR room still lacking one** (walkability -- S-V2-1: GetFloorPlan
   parity means every room is reachable, not just the ones a human got to first).
3. **Outdoor rooms (`is_outdoor: true`) get ZERO points, always** -- a product rule ported verbatim
   from the reference (REPORT §2.1) and already enforced by `validate-plan.mjs` V11.
4. **Deterministic**: the same `plan.json` produces the same points, same ids, same order, on every
   run -- no randomness anywhere, grid search steps are fixed constants, and a tie always resolves
   the same documented way (see `pick_bearing` below).

THE RULE ITSELF (mirrors REPORT §2.1's measured reference behaviour):
  * count   = 1, plus one more for every "started" 15 sq m above 20 sq m
              (`1 + ceil((area_m2 - 20) / 15)` once area_m2 > 20; REPORT §2.1's own worked example,
              a 37.88 sq m room getting 3 points, is exactly this formula -- 1 + ceil(17.88/15) = 3).
              ⚠ No room lacking a seed in `pilot-karnei` exceeds 20 sq m (the largest, r-living, is
              already authored), so this task exercises count==1 only; the N>1 branch below is
              real code, not a stub, but UNEXERCISED on this plan -- flagged for whoever first
              raises it on a bigger apartment.
  * position = the room polygon's "deepest interior point": the point maximising the minimum
              distance to any edge of the room's own `loop` (which IS the set of interior wall
              faces, SCHEMA §5's V9 coverage guarantee) -- found by a deterministic coarse-then-fine
              grid search, not a centroid or a bbox-centre shortcut, so an L-shaped or notched room
              (the master lobby has a 12.8x12.7 cm notch, SCHEMA §5's four-face wall footprints) is
              handled correctly instead of guessed at.
  * yaw     = "the room's longest clear sightline": for the chosen point, cast a ray at every
              integer bearing 0..359 against the room polygon's own edges and keep the bearing whose
              ray travels FARTHEST before it would exit the room. Ties (exact, both directions of a
              symmetric rectangle's long axis) resolve to the SMALLEST bearing -- arbitrary but
              stable, documented here rather than silently effective.
  * z       = 140 cm (`CAM_DEFAULT_Z_CM`), the same eye height T02's authored seeds and
              render_pano.py's analytic checks already use (F-360-114: ported from the reference,
              not measured off this drawing).

CLEARANCE: this module's own `min_clearance_to_boundary_cm` is a 2-D, plan-space SANITY check only
(fast, no Blender). ⛔ It is NOT the acceptance-criterion instrument -- a 2-D distance to the room's
drawn loop over-counts closeness at a doorway (the loop there is open air, not a wall, once the wall
is actually built and boolean-cut). The AUTHORITATIVE, mesh-based clearance check (walls after their
boolean cuts, furniture bounding boxes) lives in `build_scene.py::verify()`, which measures off the
BUILT scene, never off `plan.json`'s 2-D input (same principle as the rest of that file).

    python 360walkaround/pipeline/place_cameras.py 360walkaround/tours/pilot-karnei/plan.json
    python 360walkaround/pipeline/place_cameras.py <plan.json> --write   # persist the reconciled file

v0.2.0 (2026-10-28, D-WQ-28 / Q01b): a GENERAL plan (`geometry: "general"`) keeps its authored
camera_points[] verbatim and is never auto-filled -- `sightline_distance` reads axis-aligned edges only,
so the rule would pick a wrong yaw on a diagonal wall. An indoor room with no point is REPORTED.
(`point_in_polygon` and `deepest_point` are already general; the yaw rule is the rectilinear part.)
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

VERSION = "0.2.0"
CAM_DEFAULT_Z_CM = 140.0          # F-360-114: ported from REPORT §2.1, not traced off this drawing
MIN_CLEARANCE_CM = 40.0           # the task's own bar
COARSE_STEP_CM = 10.0             # deepest-point search, pass 1
FINE_STEP_CM = 1.0                # deepest-point search, pass 2 (refine around pass 1's winner)
REFINE_RADIUS_CM = 15.0           # how far pass 2 looks around pass 1's winner
BEARING_STEP_DEG = 1.0            # yaw search granularity
BEARING_TIE_EPS_CM = 0.05         # two sightlines this close count as a tie


# ==================================================================================== geometry
def point_in_polygon(pt, loop):
    """Even-odd ray-cast, identical convention to validate-plan.mjs's own `pointInPolygon` (V11) --
    keeping the two implementations behaviourally aligned matters more than which algorithm reads
    prettier."""
    px, py = pt
    inside = False
    n = len(loop)
    j = n - 1
    for i in range(n):
        xi, yi = loop[i]
        xj, yj = loop[j]
        if (yi > py) != (yj > py):
            xint = (xj - xi) * (py - yi) / (yj - yi) + xi
            if px < xint:
                inside = not inside
        j = i
    return inside


def dist_point_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    if length2 < 1e-12:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def dist_to_boundary(pt, loop):
    px, py = pt
    n = len(loop)
    best = float("inf")
    for i in range(n):
        ax, ay = loop[i]
        bx, by = loop[(i + 1) % n]
        best = min(best, dist_point_to_segment(px, py, ax, ay, bx, by))
    return best


def bbox_of(loop):
    xs = [p[0] for p in loop]
    ys = [p[1] for p in loop]
    return min(xs), min(ys), max(xs), max(ys)


def _frange_inclusive(a, b, step):
    if b < a:
        a, b = b, a
    n = int(math.floor((b - a) / step + 1e-9))
    vals = [a + i * step for i in range(n + 1)]
    if vals[-1] < b - 1e-9:
        vals.append(b)
    return vals


def _grid_scan(loop, x0, y0, x1, y1, step):
    """One full grid pass. Returns (best_d, [(x,y), ...]) -- EVERY interior grid point within
    `step` (a quantisation-noise tolerance) of the best distance found, not just the first one."""
    xs = _frange_inclusive(x0, x1, step)
    ys = _frange_inclusive(y0, y1, step)
    best_d = -1.0
    ties = []
    for x in xs:
        for y in ys:
            if not point_in_polygon((x, y), loop):
                continue
            d = dist_to_boundary((x, y), loop)
            if d > best_d + step:                  # a genuinely new, better region
                best_d, ties = d, [(x, y)]
            elif d >= best_d - step:                # within noise of the best -> same plateau
                ties.append((x, y))
    return best_d, ties


def deepest_point(loop, x_range=None, y_range=None,
                   coarse_step=COARSE_STEP_CM, fine_step=FINE_STEP_CM):
    """The point inside `loop` (optionally restricted to `x_range`/`y_range`, for the N>1-points-
    per-room branch) that maximises the minimum distance to any edge of `loop` -- a deterministic
    coarse-then-fine grid search over the FULL (possibly range-restricted) bbox, never a centroid
    or bbox-centre shortcut, so it is correct for a non-convex/notched room too.

    ⭐ For a plain rectangle whose two long sides are the limiting distance, EVERY point on the
    central band along the long axis ties for "deepest" (the medial axis is a segment, not a
    point) -- measured on this exact plan (r-wc: the tied band is 60 cm long). Picking the FIRST
    grid point to reach that score would silently pin the camera to one end of the band instead of
    its middle. So this function keeps every near-tied point from the fine pass and reports their
    CENTROID -- still deterministic (grid steps are fixed constants), and no longer order-biased.
    A centroid that (rarely, e.g. a very non-convex tied region) falls outside the polygon or scores
    meaningfully worse falls back to the single best grid point instead.

    Returns (x_cm, y_cm, clearance_cm). Falls back to the room's own bbox centre if the grid
    genuinely misses the polygon entirely -- should not happen for any SCHEMA-valid room, and is a
    safety net, not the intended path.
    """
    x0, y0, x1, y1 = bbox_of(loop)
    if x_range is not None:
        x0, x1 = max(x0, x_range[0]), min(x1, x_range[1])
    if y_range is not None:
        y0, y1 = max(y0, y_range[0]), min(y1, y_range[1])

    _, coarse_ties = _grid_scan(loop, x0, y0, x1, y1, coarse_step)
    if not coarse_ties:
        cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
        d = dist_to_boundary((cx, cy), loop) if point_in_polygon((cx, cy), loop) else 0.0
        return cx, cy, d

    best_d, fine_ties = _grid_scan(loop, x0, y0, x1, y1, fine_step)
    if not fine_ties:
        fine_ties, best_d = coarse_ties, dist_to_boundary(coarse_ties[0], loop)

    cx = sum(p[0] for p in fine_ties) / len(fine_ties)
    cy = sum(p[1] for p in fine_ties) / len(fine_ties)
    if point_in_polygon((cx, cy), loop):
        d = dist_to_boundary((cx, cy), loop)
        if d >= best_d - 2.0 * fine_step:           # sanity: the centroid is still near-optimal
            return cx, cy, d
    bx, by = fine_ties[0]
    return bx, by, dist_to_boundary((bx, by), loop)


def sightline_distance(pt, bearing_deg, loop):
    """How far a ray at plan bearing `bearing_deg` (0 = -y/plan-north, 90 = +x/plan-east, clockwise,
    SCHEMA §1) travels from `pt` before it would cross the room's own boundary. Exact ray-vs-
    axis-aligned-segment intersection (SCHEMA guarantees rectilinear loops), so this is not a
    sampling approximation."""
    px, py = pt
    theta = math.radians(bearing_deg)
    dx, dy = math.sin(theta), -math.cos(theta)
    n = len(loop)
    best_t = None
    eps = 1e-6
    for i in range(n):
        ax, ay = loop[i]
        bx, by = loop[(i + 1) % n]
        if abs(ax - bx) < 1e-9:                       # vertical edge: x == ax, y in [ay,by]
            if abs(dx) < 1e-12:
                continue
            t = (ax - px) / dx
            if t <= eps:
                continue
            y_hit = py + t * dy
            lo, hi = (ay, by) if ay <= by else (by, ay)
            if lo - 1e-6 <= y_hit <= hi + 1e-6:
                best_t = t if best_t is None else min(best_t, t)
        elif abs(ay - by) < 1e-9:                     # horizontal edge: y == ay, x in [ax,bx]
            if abs(dy) < 1e-12:
                continue
            t = (ay - py) / dy
            if t <= eps:
                continue
            x_hit = px + t * dx
            lo, hi = (ax, bx) if ax <= bx else (bx, ax)
            if lo - 1e-6 <= x_hit <= hi + 1e-6:
                best_t = t if best_t is None else min(best_t, t)
        # a SCHEMA-valid loop edge is always axis-aligned; a diagonal edge is a data error this
        # function deliberately does not try to handle silently.
    return best_t if best_t is not None else 0.0


def pick_bearing(pt, loop, step=BEARING_STEP_DEG, tie_eps=BEARING_TIE_EPS_CM):
    """"The room's longest clear sightline": the bearing (0..360) whose ray from `pt` travels
    farthest before crossing the room boundary. Tie-break: the SMALLEST bearing wins -- arbitrary,
    but fixed and documented, which is all determinism requires."""
    n_steps = int(round(360.0 / step))
    best_deg, best_dist = 0.0, -1.0
    for i in range(n_steps):
        deg = i * step
        d = sightline_distance(pt, deg, loop)
        if d > best_dist + tie_eps:
            best_deg, best_dist = deg, d
        # else: within tie_eps of the current best (or worse) -> keep the smaller (earlier) bearing
    return best_deg, best_dist


# ==================================================================================== the rule
def room_target_count(area_m2):
    """REPORT §2.1's measured rule: 1, +1 per started 15 sq m above 20 sq m. Verified against its
    own worked example: 37.88 sq m -> 1 + ceil(17.88/15) = 3."""
    if area_m2 <= 20.0:
        return 1
    return 1 + math.ceil((area_m2 - 20.0) / 15.0)


def place_n_points(room, n):
    """N deterministic (position, yaw, clearance) points for one room. n==1 (the only case this
    plan ever exercises) is one grid search over the whole room. n>1 splits the room's bbox into n
    equal bands along whichever axis is longer, and finds the deepest point WITHIN each band's
    range while still measuring clearance against the FULL room polygon (not the band's own edges)
    -- so a band boundary is never mistaken for a wall. Untested on `pilot-karnei` (no missing-seed
    room here exceeds 20 sq m); written now so a future larger apartment does not need a new
    algorithm, only exercise of this one."""
    loop = room["loop"]
    if n <= 1:
        x, y, clear = deepest_point(loop)
        yaw, _ = pick_bearing((x, y), loop)
        return [(x, y, yaw, clear)]

    x0, y0, x1, y1 = bbox_of(loop)
    wide = (x1 - x0) >= (y1 - y0)
    out = []
    for i in range(n):
        if wide:
            bx0 = x0 + (x1 - x0) * i / n
            bx1 = x0 + (x1 - x0) * (i + 1) / n
            x, y, clear = deepest_point(loop, x_range=(bx0, bx1))
        else:
            by0 = y0 + (y1 - y0) * i / n
            by1 = y0 + (y1 - y0) * (i + 1) / n
            x, y, clear = deepest_point(loop, y_range=(by0, by1))
        yaw, _ = pick_bearing((x, y), loop)
        out.append((x, y, yaw, clear))
    return out


def _is_general(plan):
    """D-WQ-28: the flag plan_general.is_general() reads, inlined so this module stays dependency-free."""
    return (plan.get("geometry") == "general"
            or (plan.get("plan_meta") or {}).get("geometry") == "general")


def reconcile(plan, min_clearance_cm=MIN_CLEARANCE_CM):
    """Apply the whole policy. Returns (new_camera_points_list, added_records, warnings)."""
    if _is_general(plan):
        covered = {cp["room_id"] for cp in plan["camera_points"]}
        missing = [r["id"] for r in sorted(plan["rooms"], key=lambda r: r["id"])
                   if not r["is_outdoor"] and r["id"] not in covered]
        return list(plan["camera_points"]), [], (
            [f"general plan: camera_points[] taken as given, no auto-placement; indoor room(s) with no "
             f"point: {', '.join(missing)}"] if missing else [])
    existing = list(plan["camera_points"])
    covered = {cp["room_id"] for cp in existing}
    added = []
    warnings = []
    for room in sorted(plan["rooms"], key=lambda r: r["id"]):     # deterministic order
        if room["is_outdoor"]:
            continue
        if room["id"] in covered:
            continue                                              # authored (or prior auto) - KEPT
        n = room_target_count(room["area_m2"])
        pts = place_n_points(room, n)
        suffix = room["id"][2:] if room["id"].startswith("r-") else room["id"]
        for i, (x, y, yaw, clear) in enumerate(pts):
            cid = f"cp-{suffix}" if i == 0 else f"cp-{suffix}-{i + 1}"
            if clear < min_clearance_cm:
                warnings.append(f"{cid}: clearance {clear:.1f} cm < {min_clearance_cm:.0f} cm "
                                 f"(plan-space estimate; see build_scene.py for the mesh-true check)")
            added.append({
                "id": cid,
                "room_id": room["id"],
                "x": round(x, 1),
                "y": round(y, 1),
                "z": CAM_DEFAULT_Z_CM,
                "yaw_deg": round(yaw % 360.0, 1),
                "note": (f"auto-placed (T06 rule, place_cameras.py v{VERSION}): deepest interior "
                         f"point, yaw = longest clear sightline, ~{clear:.1f} cm plan-space "
                         f"clearance to the nearest drawn wall face"),
            })
    return existing + added, added, warnings


# ======================================================================================= CLI
def main(argv):
    ap = argparse.ArgumentParser(prog="place_cameras.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan", help="path to plan.json")
    ap.add_argument("--write", action="store_true", help="persist the reconciled file in place")
    ap.add_argument("--out", default=None, help="write to a different path instead of --write in place")
    ap.add_argument("--min-clearance-cm", type=float, default=MIN_CLEARANCE_CM)
    ap.add_argument("--report", default=None, help="write a machine-readable report json")
    args = ap.parse_args(argv)

    with open(args.plan, "r", encoding="utf-8") as f:
        plan = json.load(f)

    before = len(plan["camera_points"])
    new_points, added, warnings = reconcile(plan, args.min_clearance_cm)
    plan["camera_points"] = new_points

    print(f"place_cameras.py v{VERSION}")
    print(f"plan            {args.plan}")
    print(f"camera_points   {before} authored/existing -> {len(new_points)} total "
          f"(+{len(added)} auto-placed)")
    for rec in added:
        print(f"  + {rec['id']:<20s} room {rec['room_id']:<18s} "
              f"({rec['x']:8.1f}, {rec['y']:8.1f}) cm  z={rec['z']:.0f}  yaw={rec['yaw_deg']:6.1f}  "
              f"-- {rec['note']}")
    for w in warnings:
        print(f"WARN  {w}")

    report = {
        "generator": {"script": "pipeline/place_cameras.py", "version": VERSION},
        "plan": os.path.abspath(args.plan).replace("\\", "/"),
        "before_count": before,
        "after_count": len(new_points),
        "added": added,
        "warnings": warnings,
        "policy": ("authored seeds kept verbatim; the rule fills every indoor room still lacking "
                   "one; outdoor rooms get zero; deterministic grid-search placement + ray-cast "
                   "yaw; see this file's module docstring for the exact rule"),
    }
    if args.report:
        with open(args.report, "w", encoding="utf-8", newline="\n") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"report          {args.report}")

    out_path = args.out or (args.plan if args.write else None)
    if out_path:
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(plan, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"written         {out_path}")
    else:
        print("(dry run -- pass --write to persist, or --out <path> to write elsewhere)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
