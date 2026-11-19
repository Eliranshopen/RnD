#!/usr/bin/env python
"""auto_finalize.py <plan.general.json> <vlm.json> <seeds.json> <barrier.png> <px_per_cm> <crop.png> <overlay.png>

auto-trace's last step: camera points at each room's pole of inaccessibility (not on the label), fixtures from the vision
model's boxes turned into rectangles aligned with the plan's dominant wall direction (sizes clamped to sane ranges per
kind), the room names from the reading, and an approval overlay (the trace in colour over the sales plan, numbered rooms,
fixtures in red) — the image the developer approves in the portal. Writes the plan in place.
"""
import json
import math
import os
import sys

import cv2
import sys as _s, os as _o
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.ops import polylabel, unary_union

SIZE = {  # kind: (min, max) for each side in cm, height, z
    "counter": ((60, 600), (55, 70), 90), "tall_unit": ((50, 250), (55, 70), 220), "hob": ((55, 90), (45, 60), 92),
    "sink": ((50, 120), (40, 60), 92), "island": ((90, 300), (60, 120), 90), "wardrobe": ((60, 400), (55, 65), 240),
    "shower": ((70, 220), (70, 120), 10), "bathtub": ((150, 190), (70, 85), 55), "wc": ((50, 70), (35, 45), 45),
    "vanity": ((50, 160), (40, 60), 85), "washer": ((55, 65), (55, 65), 85), "table": ((70, 240), (70, 120), 75),
    "sofa": ((80, 300), (80, 100), 75), "bed": ((180, 220), (90, 200), 55), "tv_unit": ((120, 320), (35, 50), 50),
}


def dominant_angle(bar):
    edges = cv2.Canny((bar * 255).astype(np.uint8), 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 360, 80, minLineLength=120, maxLineGap=6)
    if lines is None:
        return 0.0
    h = np.zeros(180)
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        a = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 90
        h[int(a * 2) % 180] += math.hypot(x2 - x1, y2 - y1)
    return float(np.argmax(np.convolve(np.r_[h[-3:], h, h[:3]], np.ones(7), "valid")) / 2.0)


def main():
    plan_p, vlm_p, seeds_p, bar_p, ppc_s, crop_p, ov_p = sys.argv[1:8]
    ppc = float(ppc_s)
    plan = json.load(open(plan_p, encoding="utf-8"))
    vlm = json.load(open(vlm_p, encoding="utf-8"))
    bar = cv2.imread(bar_p, cv2.IMREAD_GRAYSCALE) > 127
    ang = dominant_angle(bar)
    degenerate = [r["id"] for r in plan["rooms"] if len(r.get("loop", [])) < 3]
    plan["rooms"] = [r for r in plan["rooms"] if len(r.get("loop", [])) >= 3]
    rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
    degenerate += [rid for rid, g in rooms.items() if g.is_empty or g.area < 100]
    plan["rooms"] = [r for r in plan["rooms"] if r["id"] not in degenerate]
    rooms = {rid: g for rid, g in rooms.items() if rid not in degenerate}
    # cameras: the pole of inaccessibility of each room (≥ 60 cm from every wall where the room allows it)
    for cp in plan.get("camera_points", []):
        p = rooms.get(cp.get("room_id"))
        if p is None or p.is_empty:
            continue
        g = p if p.geom_type == "Polygon" else max(p.geoms, key=lambda q: q.area)
        q = polylabel(g, tolerance=2.0)
        cp["x"], cp["y"] = round(q.x, 1), round(q.y, 1)
        cp["note"] = "auto-trace: the room's pole of inaccessibility"
    # fixtures from the reading's boxes
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    fixtures = []
    for k, f in enumerate(vlm.get("fixtures", [])):
        kind = f.get("kind")
        if kind not in SIZE or not f.get("box_px"):
            continue
        x0, y0, x1, y1 = [v / ppc for v in f["box_px"]]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        su = [(x - cx) * ux + (y - cy) * uy for x, y in corners]
        sv = [(x - cx) * vx + (y - cy) * vy for x, y in corners]
        # an axis-aligned box of a rotated object over-states both sides; deflate by the rotation's spread
        cosr = abs(math.cos(a)) + abs(math.sin(a))
        L, D = (max(su) - min(su)) / cosr, (max(sv) - min(sv)) / cosr
        (lo1, hi1), (lo2, hi2), h = SIZE[kind]
        if D > L:
            L, D = D, L
            ux_, uy_, vx_, vy_ = vx, vy, ux, uy
        else:
            ux_, uy_, vx_, vy_ = ux, uy, vx, vy
        L = min(max(L, lo1), hi1); D = min(max(D, lo2), hi2)
        poly = [[round(cx + sx * L / 2 * ux_ + sy * D / 2 * vx_, 1), round(cy + sx * L / 2 * uy_ + sy * D / 2 * vy_, 1)] for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        room = next((rid for rid, p in rooms.items() if p.contains(Point(cx, cy))), None)
        fixtures.append({"id": f"fx-{k + 1}-{kind}", "room_id": room, "kind": kind, "polygon_cm": poly, "z_cm": 0, "height_cm": h,
                         "centre_cm": [round(cx, 1), round(cy, 1)], "angle_deg": round(math.degrees(math.atan2(uy_, ux_)), 1),
                         "size_cm": [round(L), round(D)], "source": "auto-trace: the vision model's box on the sales plan, aligned to the walls",
                         "note": f.get("label") or ""})
    plan["fixtures"] = fixtures
    # --- doors from the swing arcs; the entrance next to its label
    import auto_doors
    d_ = os.path.dirname(plan_p)
    grey_img = cv2.imread(os.path.join(d_, "plan-grey.png"), cv2.IMREAD_GRAYSCALE)
    if os.path.exists(os.path.join(d_, "strokes.png")):
        stroke = (cv2.imread(os.path.join(d_, "strokes.png"), cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8) * 255
    else:
        band = ((grey_img >= 70) & (grey_img <= 150)).astype(np.uint8)
        band = cv2.morphologyEx(band, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        stroke = ((grey_img < 70) & (cv2.dilate(band, np.ones((5, 5), np.uint8)) == 0)).astype(np.uint8) * 255
    wallm = (grey_img >= 70) & (grey_img <= 150)
    arcs = auto_doors.detect_arcs(stroke, wallm, ppc)
    def room_at(x_cm, y_cm):
        pt = Point(x_cm, y_cm)
        return next((rid for rid, g in rooms.items() if g.contains(pt)), None)
    added = 0
    env_p = os.path.join(d_, "envelope.png")
    env_img = cv2.imread(env_p, cv2.IMREAD_GRAYSCALE) if os.path.exists(env_p) else None
    for k, a_ in enumerate(arcs):
        (hx, hy), (ex, ey) = a_["chord_px"]
        if env_img is not None:   # an arc whose hinge lies outside the building envelope is garden furniture, not a door
            fy, fx = int(hy * env_img.shape[0] / grey_img.shape[0]), int(hx * env_img.shape[1] / grey_img.shape[1])
            if not (0 <= fy < env_img.shape[0] and 0 <= fx < env_img.shape[1]) or env_img[fy, fx] == 0:
                a_["ignored"] = "outside the building envelope (not a door)"
                continue
        cxm, cym = (hx + ex) / 2 / ppc, (hy + ey) / 2 / ppc
        dx, dy = (ex - hx) / ppc, (ey - hy) / ppc
        L_ = math.hypot(dx, dy) or 1
        nx, ny = -dy / L_, dx / L_
        r1, r2 = room_at(cxm + nx * 45, cym + ny * 45), room_at(cxm - nx * 45, cym - ny * 45)
        def nearest(x_cm, y_cm, other):
            pt = Point(x_cm, y_cm)
            c_ = sorted(((g.distance(pt), rid) for rid, g in rooms.items() if rid != other), key=lambda t: t[0])
            return c_[0][1] if c_ and c_[0][0] <= 80 else None
        if r1 is None: r1 = nearest(cxm + nx * 45, cym + ny * 45, r2)
        if r2 is None: r2 = nearest(cxm - nx * 45, cym - ny * 45, r1)
        a_["rooms"] = [r1, r2]
        near = [o for o in plan.get("openings", []) if o.get("centre_cm") and math.hypot(o["centre_cm"][0] - cxm, o["centre_cm"][1] - cym) <= max(60, a_["r_cm"])]
        if near:
            a_["matched_opening"] = near[0]["id"]
            continue
        if r1 == r2:
            a_["problem"] = "both sides of the door lie in the same traced room (a wrong split or a missing room)" if r1 else "neither side lies in a traced room"
            continue
        oid = f"o-arc-{k + 1}"
        plan.setdefault("openings", []).append({"id": oid, "kind": "door", "rooms": [x for x in (r1, r2) if x] + (["outside"] if None in (r1, r2) else []),
                                                "a_cm": [round(hx / ppc, 1), round(hy / ppc, 1)], "b_cm": [round(ex / ppc, 1), round(ey / ppc, 1)], "centre_cm": [round(cxm, 1), round(cym, 1)],
                                                "angle_deg": round(math.degrees(math.atan2(dy, dx)), 1), "width_cm": round(a_["r_cm"], 1), "sill_cm": 0, "head_cm": 215, "source": "auto_doors: a swing arc on the plan"})
        a_["added_opening"] = oid
        added += 1
    # the entrance: the opening on the building's edge nearest the entrance label (the label may sit outside the door)
    ent = next((s_ for s_ in json.load(open(seeds_p, encoding="utf-8")) if "כניסה" in (s_.get("name_he") or "") or s_.get("vlm_type") == "entrance"), None)
    entrance = None
    if ent:
        lx, ly = [v / ppc for v in (ent.get("label_px") or ent["at_px"])]
        foot = unary_union(list(rooms.values())).buffer(30)
        cands = []
        for o in plan.get("openings", []):
            c_ = o.get("centre_cm")
            if not c_:
                continue
            outer = ("outside" in (o.get("rooms") or [])) or (None in (o.get("rooms") or [])) or (not foot.buffer(-60).contains(Point(*c_)))
            if outer:
                cands.append((math.hypot(c_[0] - lx, c_[1] - ly), o))
        if cands:
            dist_, o = min(cands, key=lambda t: t[0])
            if dist_ <= 350:
                o["kind"] = "entry_door"
                entrance = {"opening": o["id"], "dist_to_label_cm": round(dist_, 1)}
    plan.setdefault("plan_meta", {})["entrance"] = entrance
    json.dump({"arcs": arcs, "added": added, "entrance": entrance}, open(os.path.join(d_, "doors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    gl_p = os.path.join(os.path.dirname(plan_p), "glazing.json")
    if os.path.exists(gl_p):
        gl = json.load(open(gl_p)).get("glazing", [])
        have = [Polygon(p_["polygon_cm"]).buffer(0) for p_ in plan.get("panes", []) if len(p_.get("polygon_cm", [])) >= 3]
        added = 0
        for i, g_ in enumerate(gl):
            poly = [[round(x / ppc, 1), round(y / ppc, 1)] for x, y in g_["rect_px"]]
            pg = Polygon(poly).buffer(0)
            if any(h.intersects(pg) for h in have):
                continue
            xs_, ys_ = zip(*poly)
            plan.setdefault("panes", []).append({"id": f"window-auto-{i + 1}", "kind": "window", "sill_cm": 90, "head_cm": 215, "polygon_cm": poly,
                                                 "bbox_cm": [round(min(xs_), 1), round(min(ys_), 1), round(max(xs_), 1), round(max(ys_), 1)], "diag_cm": round(math.hypot(max(xs_) - min(xs_), max(ys_) - min(ys_)), 1),
                                                 "source": "auto_prep.py: a blue glazing bar on the brochure plan (sill/head assumed: no section)"})
            added += 1
        if added:
            plan["plan_meta"].setdefault("assumptions", []).append(f"{added} window bars read from the plan's blue glazing symbols; sill 90 / head 215 cm assumed")
    # --- the printed room dims: measured (minimum rotated rectangle of the traced room) vs printed; fit the scale when asked
    fit = "--fit-dims" in sys.argv
    seeds = json.load(open(seeds_p, encoding="utf-8"))
    dims_of = {s_["room_id"]: s_.get("dims_cm") for s_ in seeds if s_.get("dims_cm")}
    name_of = {s_["room_id"]: s_.get("name_he") for s_ in seeds}
    ratios, dim_rows = [], []
    for r in plan["rooms"]:
        p = rooms[r["id"]]
        if p.is_empty:
            continue
        g = p if p.geom_type == "Polygon" else max(p.geoms, key=lambda q: q.area)
        mrr = g.minimum_rotated_rectangle
        xs, ys = mrr.exterior.coords.xy
        e1 = math.hypot(xs[1] - xs[0], ys[1] - ys[0]); e2 = math.hypot(xs[2] - xs[1], ys[2] - ys[1])
        meas = sorted([e1, e2], reverse=True)
        d = dims_of.get(r["id"])
        row = {"room": r["id"], "name_he": name_of.get(r["id"]), "measured_cm": [round(meas[0]), round(meas[1])], "printed_cm": d}
        if d and len(d) == 2 and min(d) > 0:
            pr = sorted(d, reverse=True)
            row["ratio"] = [meas[0] / pr[0], meas[1] / pr[1]]
            ratios += row["ratio"]
        dim_rows.append(row)
    factor = 1.0
    if fit and len(ratios) >= 2:
        factor = float(np.median(ratios))            # measured = factor × printed  → every cm value shrinks by 1/factor
        def sc(v):
            if isinstance(v, list): return [sc(x) for x in v]
            if isinstance(v, (int, float)) and not isinstance(v, bool): return round(v / factor, 1)
            return v
        for r in plan["rooms"]:
            for k in ("loop", "bbox_cm", "clear_dims_cm"):
                if k in r: r[k] = sc(r[k])
            if "area_m2" in r: r["area_m2"] = round(r["area_m2"] / factor ** 2, 3)
        for w in plan.get("walls", []):
            w["polygon_cm"] = sc(w["polygon_cm"]); w["area_cm2"] = round(w.get("area_cm2", 0) / factor ** 2)
        for o in plan.get("openings", []):
            for k in ("a_cm", "b_cm", "centre_cm", "width_cm"):
                if k in o and o[k] is not None: o[k] = sc(o[k])
        for pn in plan.get("panes", []):
            for k in ("polygon_cm", "bbox_cm", "diag_cm"):
                if k in pn: pn[k] = sc(pn[k])
        for cp in plan.get("camera_points", []):
            cp["x"], cp["y"] = sc(cp["x"]), sc(cp["y"])
        for f in plan["fixtures"]:
            for k in ("polygon_cm", "centre_cm", "size_cm"):
                f[k] = sc(f[k])
        rooms = {r["id"]: Polygon(r["loop"]).buffer(0) for r in plan["rooms"]}
        new_ppc = ppc * factor
        plan["plan_meta"]["scale_px_per_cm"] = round(new_ppc, 4)
        plan["plan_meta"]["scale_basis"] = f"fitted from the printed room dimensions: {len(ratios) // 2} rooms, median ratio {factor:.4f} over the nominal {ppc} px/cm -> {new_ppc:.4f} px/cm"
        plan["axes"] = plan["axes"].replace(f"{ppc} px/cm", f"{new_ppc:.4f} px/cm") if "px/cm" in plan.get("axes", "") else plan.get("axes")
        ppc = new_ppc
        for row in dim_rows:
            row["measured_cm"] = [round(v / factor) for v in row["measured_cm"]]
    for row in dim_rows:
        if row.get("printed_cm"):
            pr = sorted(row["printed_cm"], reverse=True)
            row["delta_pct"] = [round(100 * (row["measured_cm"][i] - pr[i]) / pr[i], 1) for i in range(2)]
    could_not = [f"room {rid}: the traced region was degenerate (fewer than 3 points) and was dropped" for rid in degenerate]
    for s_ in seeds:
        if s_["room_id"] not in rooms:
            could_not.append(f"room '{s_.get('name_he')}' ({s_['room_id']}): no closed region was traced around its label (the flood leaked or the label sits on a line)")
    for row in dim_rows:
        if not row.get("printed_cm"):
            could_not.append(f"room '{row['name_he']}' ({row['room']}): no printed dimensions were read; its size comes from the drawing only")
        elif max(abs(x) for x in row["delta_pct"]) > 3:
            could_not.append(f"room '{row['name_he']}' ({row['room']}): traced {row['measured_cm']} cm vs printed {row['printed_cm']} cm ({row['delta_pct']} %) — check the trace or the reading")
    if not fixtures:
        could_not.append("no fixed elements (kitchen run, sanitary, closets) were read from the drawing")
    report = {"rooms": len(plan["rooms"]), "fixtures": len(fixtures), "scale_px_per_cm": round(ppc, 4), "scale_fit_factor": round(factor, 4), "scale_fitted": fit and factor != 1.0,
              "dims": dim_rows, "could_not_read": could_not, "legend": [{"n": i + 1, "id": r["id"], "name_he": name_of.get(r["id"]), "area_m2": r.get("area_m2")} for i, r in enumerate(plan["rooms"])]}
    rep_p = ov_p.rsplit(".", 1)[0].replace("overlay", "report") + ".json"
    json.dump(report, open(rep_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    md = ["# auto-trace report", "", f"rooms: {len(plan['rooms'])} · fixtures: {len(fixtures)} · scale: {ppc:.4f} px/cm" + (f" (fitted ×{factor:.4f} from the printed dims)" if report["scale_fitted"] else ""), "",
          "| # | room | printed cm | traced cm | delta % | m² |", "|---|---|---|---|---|---|"]
    for i, r in enumerate(plan["rooms"], start=1):
        row = next((x for x in dim_rows if x["room"] == r["id"]), {})
        md.append(f"| {i} | {name_of.get(r['id']) or r['id']} | {('×'.join(map(str, sorted(row['printed_cm'], reverse=True))) if row.get('printed_cm') else '—')} | {'×'.join(map(str, row.get('measured_cm', [])))} | {('/'.join(map(str, row['delta_pct'])) if row.get('delta_pct') else '—')} | {r.get('area_m2', 0):.2f} |")
    md += ["", "## could not read / check", ""] + ([f"- {x}" for x in could_not] or ["- nothing: every room has printed dimensions within 3 % of the trace"])
    open(rep_p.replace(".json", ".md"), "w", encoding="utf-8").write(chr(10).join(md))
    plan["plan_meta"]["dominant_wall_angle_deg"] = round(ang, 1)
    json.dump(plan, open(plan_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # the approval overlay
    img = cv2.imread(crop_p)
    over = img.copy()
    rng = np.random.default_rng(3)
    for i, r in enumerate(plan["rooms"]):
        col = tuple(int(c) for c in rng.integers(40, 230, 3))
        pts = np.array([[int(x * ppc), int(y * ppc)] for x, y in r["loop"]], np.int32)
        cv2.fillPoly(over, [pts], col)
        cv2.polylines(img, [pts], True, col, 6)
    img = cv2.addWeighted(over, 0.28, img, 0.72, 0)
    for f in fixtures:
        cv2.polylines(img, [np.array([[int(x * ppc), int(y * ppc)] for x, y in f["polygon_cm"]], np.int32)], True, (0, 0, 220), 5)
    for o in plan.get("openings", []):
        if o.get("a_cm") and o.get("b_cm"):
            cv2.line(img, (int(o["a_cm"][0] * ppc), int(o["a_cm"][1] * ppc)), (int(o["b_cm"][0] * ppc), int(o["b_cm"][1] * ppc)), (0, 170, 0), 7)
    for i, r in enumerate(plan["rooms"], start=1):
        g = rooms[r["id"]]
        g = g if g.geom_type == "Polygon" else max(g.geoms, key=lambda q: q.area)
        q = polylabel(g, tolerance=2.0)
        x, y = int(q.x * ppc), int(q.y * ppc)
        cv2.circle(img, (x, y), 34, (255, 255, 255), -1); cv2.circle(img, (x, y), 34, (0, 0, 0), 3)
        cv2.putText(img, str(i), (x - 18 if i > 9 else x - 10, y + 12), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 0), 3)
        cv2.putText(img, f"{r.get('area_m2', 0):.1f}", (x - 34, y + 70), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 3)
    h0, w0 = img.shape[:2]
    s = 2000 / max(h0, w0)
    cv2.imwrite(ov_p, cv2.resize(img, (int(w0 * s), int(h0 * s)), interpolation=cv2.INTER_AREA))
    print(f"auto_finalize: {len(plan['rooms'])} rooms, {len(fixtures)} fixtures, wall angle {ang:.1f} deg, scale {ppc:.4f} px/cm (fit x{factor:.4f}), {len(could_not)} notes, overlay {ov_p}")


if __name__ == "__main__":
    main()
