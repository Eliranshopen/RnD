#!/usr/bin/env python
"""trace_check.py <plan-dir>

The mandatory check after an automatic trace (Eliran 2026-11-04: «אני לא יכול שהיזם יאשר ולהסתמך על זה, אני צריך שהסוכן AI
מאחורי הקלעים יבדוק התאמה»). The developer's approval is NOT the check: a trace reaches the developer only after it PASSES here
and the independent vision judge (auto-trace.mjs) finds no mismatch. Hard thresholds:

  dims        every room with printed dims: each traced side within max(2 %, 5 cm) of the printed side
  areas       every printed room area within 2 % (when the plan prints room areas)
  labels      every room label has exactly one traced room; no traced room without a label; rooms = labels read
  doors       every door swing arc on the drawing → an opening between two DIFFERENT traced rooms (or a room and outside)
  entrance    when the plan labels an entrance, an opening on the building's edge next to it
  windows     every window drawn on the plan → a pane in the trace
  wet rooms   every bathroom has a sanitary fixture; the kitchen has a counter, sink or hob

Writes <plan-dir>/trace-check.json: { status, checks: [{check, room?, expected, got, pass}], failures: [...],
corrections: { force_rect: [seed ids] } } — the corrections the next round applies (re-seed the room from its printed rectangle).
"""
import json
import math
import os
import sys

from shapely.geometry import Polygon, Point

WET = {"bathroom": {"wc", "shower", "bathtub", "vanity"}, "kitchen": {"counter", "sink", "hob", "tall_unit", "island"}}


def main():
    d = sys.argv[1]
    J = lambda f, dflt=None: json.load(open(os.path.join(d, f), encoding="utf-8")) if os.path.exists(os.path.join(d, f)) else dflt
    plan, seeds, report = J("plan.general.json"), J("seeds.json", []), J("report.json", {})
    doors, glazing = J("doors.json", {"arcs": []}), J("glazing.json", {"glazing": []})
    ppc = float(report.get("scale_px_per_cm") or plan["plan_meta"].get("scale_px_per_cm") or 1)
    rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
    by_id = {s["room_id"]: s for s in seeds}
    checks, force = [], set()
    add = lambda **k: checks.append(k)
    # dims
    for row in report.get("dims", []):
        if not row.get("printed_cm"):
            continue
        pr = sorted(row["printed_cm"], reverse=True)
        got = row["measured_cm"]
        ok = all(abs(got[i] - pr[i]) <= max(0.02 * pr[i], 5) for i in range(2))
        add(check="dims", room=row["room"], name=row.get("name_he"), expected=pr, got=got, tol="max(2 %, 5 cm) per side", **{"pass": ok})
        if not ok and by_id.get(row["room"], {}).get("dims_cm"):
            force.add(by_id[row["room"]]["id"])
    # areas (only when printed per room)
    for s in seeds:
        if s.get("area_m2") and s["room_id"] in rooms:
            got = rooms[s["room_id"]].area / 1e4
            ok = abs(got - s["area_m2"]) <= 0.02 * s["area_m2"]
            add(check="area", room=s["room_id"], name=s.get("name_he"), expected=s["area_m2"], got=round(got, 2), **{"pass": ok})
    # labels <-> rooms
    labelled = [s for s in seeds if not s.get("auto") and not s.get("merged_into") and not s.get("void_on_this_floor")]   # a label merged into a room (מעבר צר → the terrace) counts with it
    for s in labelled:
        ok = s["room_id"] in rooms and rooms[s["room_id"]].area > 0.5e4
        add(check="label_has_room", room=s["room_id"], name=s.get("name_he"), expected="one traced room", got="traced" if ok else "missing", **{"pass": ok})
        if not ok and s.get("dims_cm"):
            force.add(s["id"])
    for rid in rooms:
        s = by_id.get(rid)
        ok = s is not None and (not s.get("auto") or s.get("auto_reason") in ("stairs", "entrance-hall"))
        add(check="room_has_label", room=rid, expected="a printed label", got=(s or {}).get("name_he") or ("auto hall" if s else "none"), **{"pass": ok})
    n_found = sum(1 for rid in rooms if by_id.get(rid, {}).get("auto_reason") == "stairs")   # stairs found from the drawing
    add(check="room_count", expected=len(labelled) + n_found, got=len(rooms), **{"pass": len(rooms) == len(labelled) + n_found})
    # doors
    for k, a in enumerate(doors.get("arcs", [])):
        if a.get("ignored"):
            continue
        ok = bool(a.get("matched_opening") or a.get("added_opening"))
        add(check="door_arc", arc=k + 1, hinge_cm=[round(v / ppc) for v in a["hinge_px"]], expected="an opening between two rooms", got=a.get("matched_opening") or a.get("added_opening") or a.get("problem"), **{"pass": ok})
    # entrance
    ent_label = next((s for s in seeds if "כניסה" in (s.get("name_he") or "") or s.get("vlm_type") == "entrance"), None)
    if ent_label:
        e = (plan.get("plan_meta") or {}).get("entrance")
        add(check="entrance", expected="an opening on the building edge next to the entrance label", got=e, **{"pass": bool(e)})
    # windows
    panes = [Polygon(p["polygon_cm"]).buffer(0) for p in plan.get("panes", []) if len(p.get("polygon_cm", [])) >= 3]
    for k, g in enumerate(glazing.get("glazing", [])):
        c = Polygon([[x / ppc, y / ppc] for x, y in g["rect_px"]]).centroid
        ok = any(p.distance(c) <= 20 for p in panes)
        add(check="window", window=k + 1, centre_cm=[round(c.x), round(c.y)], expected="a pane", got="pane" if ok else "none", **{"pass": ok})
    if not glazing.get("glazing"):
        add(check="windows_traced", expected="glazing on the plan traced as panes", got=len(panes), **{"pass": len(panes) > 0})
    # wet rooms
    fx = plan.get("fixtures", [])
    for r in plan["rooms"]:
        need = WET.get(r.get("type"))
        if not need:
            continue
        have = sorted({f["kind"] for f in fx if f.get("room_id") == r["id"]} & need)
        add(check="wet_room_fixtures", room=r["id"], name=by_id.get(r["id"], {}).get("name_he"), expected=sorted(need), got=have, **{"pass": bool(have)})
    # --- round 4: shape, orthogonality, unlabelled space, the envelope, wet-room size (with or without the judge)
    import cv2
    import numpy as np
    seed_of = {s["room_id"]: s for s in seeds}
    rj = J("rooms.json", {})
    axis = float(rj.get("axis_deg", 0.0))
    bar_full = cv2.imread(os.path.join(d, "walls-only.png"), cv2.IMREAD_GRAYSCALE)   # walls only (no automatic door bars)
    if bar_full is None:
        bar_full = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    env_img = cv2.imread(os.path.join(d, "envelope.png"), cv2.IMREAD_GRAYSCALE)
    for r in plan["rooms"]:
        g = rooms[r["id"]]
        s = seed_of.get(r["id"], {})
        name = s.get("name_he")
        # (a) shape: IoU with the printed rectangle (same centre and orientation as the traced room)
        if s.get("dims_cm") and not g.is_empty:
            mrr = g.minimum_rotated_rectangle
            xs_, ys_ = mrr.exterior.coords.xy
            e1 = (xs_[1] - xs_[0], ys_[1] - ys_[0]); e2 = (xs_[2] - xs_[1], ys_[2] - ys_[1])
            long_e = e1 if math.hypot(*e1) >= math.hypot(*e2) else e2
            th = math.atan2(long_e[1], long_e[0])
            L_, S_ = max(s["dims_cm"]), min(s["dims_cm"])
            cx_, cy_ = g.centroid.x, g.centroid.y
            u = (math.cos(th), math.sin(th)); v = (-math.sin(th), math.cos(th))
            pr = Polygon([(cx_ + a * L_ / 2 * u[0] + b * S_ / 2 * v[0], cy_ + a * L_ / 2 * u[1] + b * S_ / 2 * v[1]) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
            iou = g.intersection(pr).area / g.union(pr).area
            add(check="shape_iou", room=r["id"], name=name, expected=">= 0.85 with the printed rectangle", got=round(iou, 3), **{"pass": iou >= 0.85})
        # (b) orthogonality: no non-axis edge > 30 cm unless the wall band along it is itself diagonal / curved
        bad = []
        loop = r["loop"]
        for i in range(len(loop)):
            (x1, y1), (x2, y2) = loop[i], loop[(i + 1) % len(loop)]
            Lc = math.hypot(x2 - x1, y2 - y1)
            if Lc <= 30:
                continue
            a_ = math.degrees(math.atan2(y2 - y1, x2 - x1))
            off = min(min(abs(((a_ - sg * axis) - k * 90 + 45) % 90 - 45) for k in range(4)) for sg in (1, -1))
            if off <= 5:
                continue
            nx_, ny_ = -(y2 - y1) / Lc, (x2 - x1) / Lc
            hits = tot = 0
            if bar_full is not None:
                for tt in np.linspace(0.15, 0.85, 7):
                    px_, py_ = x1 + (x2 - x1) * tt, y1 + (y2 - y1) * tt
                    for sgn in (1, -1):
                        for dcm in (8, 14, 20):
                            X, Y = int((px_ + sgn * nx_ * dcm) * ppc), int((py_ + sgn * ny_ * dcm) * ppc)
                            if 0 <= Y < bar_full.shape[0] and 0 <= X < bar_full.shape[1]:
                                tot += 1
                                hits += bar_full[Y, X] > 127
            if not tot or hits / tot < 0.3:
                bad.append(round(Lc))
        add(check="orthogonal", room=r["id"], name=name, expected="no non-axis edge > 30 cm off a diagonal/curved wall", got=bad or "ok", **{"pass": not bad})
        # (c) unlabelled space
        if s.get("auto") and s.get("auto_reason") not in ("entrance-hall", "stairs"):
            a_m2 = g.area / 1e4
            add(check="unlabelled_room", room=r["id"], expected="<= 3 m²", got=round(a_m2, 2), **{"pass": a_m2 <= 3})
        # (d) indoor rooms inside the envelope
        if not r.get("is_outdoor") and env_img is not None and not g.is_empty:
            sc = env_img.shape[1] / (bar_full.shape[1] if bar_full is not None else env_img.shape[1])
            m = np.zeros(env_img.shape, np.uint8)
            cv2.fillPoly(m, [np.round(np.array(loop) * ppc * sc).astype(np.int32)], 1)
            out_frac = float(((m > 0) & (env_img == 0)).sum()) / max(1, int(m.sum()))
            add(check="inside_envelope", room=r["id"], name=name, expected="<= 2 % outside", got=f"{out_frac * 100:.1f} %", **{"pass": out_frac <= 0.02})
        # (f) a labelled room lies where its label is printed (within 50 cm; an entrance label moved inside is taken at its new point)
        if s and not s.get("auto") and not g.is_empty:
            lp = s.get("at_px") if s.get("moved_inside") else (s.get("label_px") or s.get("at_px"))
            if lp:
                from shapely.geometry import Point as _P
                dist_cm = g.distance(_P(lp[0] / ppc, lp[1] / ppc))
                lim_ = 150 if s.get("moved_inside") else 50
                add(check="label_in_room", room=r["id"], name=name, expected=f"the printed label inside its room (<= {lim_} cm)", got=f"{dist_cm:.0f} cm away", **{"pass": dist_cm <= lim_})
        # (e) a bath / WC is at least 1.5 m²
        if r.get("type") == "bathroom":
            add(check="wet_room_area", room=r["id"], name=name, expected=">= 1.5 m²", got=round(g.area / 1e4, 2), **{"pass": g.area / 1e4 >= 1.5})
    fails = [c for c in checks if not c["pass"]]
    out = {"status": "PASS" if not fails else "FAIL", "n_checks": len(checks), "n_failed": len(fails), "checks": checks,
           "failures": fails, "corrections": {"force_rect": sorted(force)}}
    json.dump(out, open(os.path.join(d, "trace-check.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"trace_check: {out['status']} — {len(checks) - len(fails)}/{len(checks)} checks pass; corrections: force_rect {sorted(force)}")


if __name__ == "__main__":
    main()
