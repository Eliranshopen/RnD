#!/usr/bin/env python
"""auto_rooms.py <plan-dir> <px_per_cm>

Round 4 of auto-trace (2026-11-04): the rooms of plan.general.json rebuilt ORTHOGONALLY from the printed labels, replacing the
flood regions of trace-plan.mjs (walls, openings and panes stay).

1. The plan is rotated to its dominant wall axis (846: 17.5 deg; a brochure: 0).
2. A labelled indoor room with printed W/L = its printed rectangle at scale, containing its label, placed where it lies most
   inside the building's free space and touches most wall; then EACH EDGE is snapped to the nearest wall face (wall outside,
   floor inside) within 40 cm; where there is no wall (an open kitchen | living boundary) the printed edge stays.
   Overlaps go to the rectangle that holds the pixel deeper. Rooms are clipped to the free space inside the envelope.
3. The open space is partitioned ONLY by these rectangles. A leftover piece that holds an indoor label without dims (stairs,
   entrance) becomes that room (inside the label's reading box when there is one); else it joins the labelled room it opens into
   (the longest shared edge), and becomes its own «מבואה» only when it is >= 3 m2 and touches the entrance door.
4. An indoor room whose label is printed outside the envelope (כניסה on the front path) is placed at the door, on the inside.
5. Outdoor rooms (מרפסת / חצר / פטיו) are the free space outside the envelope around their label, inside their reading box.
6. Polygons: every edge within 12 deg of an axis is snapped to the axis; a non-axis edge is kept only where the wall band along it
   is itself diagonal or curved (846's curved facade).
Writes the rooms into plan.general.json (source "auto_rooms") and rooms-debug.png.
"""
import json
import math
import re
import os
import sys

import cv2
import numpy as np
from shapely.geometry import Polygon

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from auto_split import best_rect, dominant_angle   # noqa: E402

F = 3


def rot_setup(H, W, ang):
    M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1.0)
    c, s = abs(M[0, 0]), abs(M[0, 1])
    nW, nH = int(H * s + W * c) + 4, int(H * c + W * s) + 4
    M[0, 2] += nW / 2 - W / 2
    M[1, 2] += nH / 2 - H / 2
    Mi = cv2.invertAffineTransform(M)
    return M, Mi, (nW, nH)


def tp(M, x, y):
    return (M[0, 0] * x + M[0, 1] * y + M[0, 2], M[1, 0] * x + M[1, 1] * y + M[1, 2])


def snap_edges(rect, bar, free, t, keep_size=None):
    """rect = [x0, y0, x1, y1] in the rotated frame; move each edge to the nearest wall face within t px."""
    x0, y0, x1, y1 = [int(round(v)) for v in rect]
    H, W = bar.shape
    def score_v(x, ys, side):          # vertical edge at column x; side -1 = wall on the left, +1 = wall on the right
        xw = x + side
        if not (0 <= xw < W and 0 <= x < W) or len(ys) == 0:
            return -1
        return bar[ys, xw].mean() - bar[ys, x].mean()
    def score_h(y, xs, side):
        yw = y + side
        if not (0 <= yw < H and 0 <= y < H) or len(xs) == 0:
            return -1
        return bar[yw, xs].mean() - bar[y, xs].mean()
    ys = np.arange(max(0, y0 + (y1 - y0) // 10), min(H, y1 - (y1 - y0) // 10))
    xs = np.arange(max(0, x0 + (x1 - x0) // 10), min(W, x1 - (x1 - x0) // 10))
    best = lambda cands: max(cands, key=lambda c: c[0]) if cands else (-1, None)
    s, v = best([(score_v(x, ys, -1), x) for x in range(x0 - t, x0 + t + 1)])
    nx0 = v if s >= 0.4 else x0
    s, v = best([(score_v(x, ys, +1), x) for x in range(x1 - t, x1 + t + 1)])
    nx1 = v if s >= 0.4 else x1
    s, v = best([(score_h(y, xs, -1), y) for y in range(y0 - t, y0 + t + 1)])
    ny0 = v if s >= 0.4 else y0
    s, v = best([(score_h(y, xs, +1), y) for y in range(y1 - t, y1 + t + 1)])
    ny1 = v if s >= 0.4 else y1
    if keep_size is not None:      # (round 6) a printed rectangle keeps its printed size: a snap may move, not stretch it
        A, B, tol = keep_size
        def pick(o0, o1, n0, n1, size):
            for c0, c1 in ((n0, n1), (n0, n0 + size), (n1 - size, n1), (o0, o1)):
                if abs((c1 - c0) - size) <= tol(size):
                    return c0, c1
            return o0, o1
        nx0, nx1 = pick(x0, x1, nx0, nx1, A)
        ny0, ny1 = pick(y0, y1, ny0, ny1, B)
    if nx1 - nx0 < 0.5 * (x1 - x0) or ny1 - ny0 < 0.5 * (y1 - y0):
        return [x0, y0, x1, y1], False
    return [nx0, ny0, nx1, ny1], True


def mask_poly(mask, bar_r, Mi, ppc, ang_eps=12):
    """an orthogonal polygon (image frame, cm) from a room mask in the rotated frame"""
    m = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return None
    cnt = max(cs, key=cv2.contourArea)
    if cv2.contourArea(cnt) < 20:
        return None
    eps = max(1.0, 1.5 * ppc / F)
    pts = cv2.approxPolyDP(cnt, eps, True).reshape(-1, 2).astype(float)
    n = len(pts)
    # axis snap: an edge within ang_eps of vertical/horizontal takes the mean coordinate of its two ends
    for axis in (0, 1):
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L < 1e-6:
                continue
            ang = abs(math.degrees(math.atan2(dy, dx))) % 180
            if axis == 0 and abs(ang - 90) <= ang_eps:       # vertical
                xm = (a[0] + b[0]) / 2
                pts[i][0] = pts[(i + 1) % n][0] = xm
            if axis == 1 and (ang <= ang_eps or ang >= 180 - ang_eps):
                ym = (a[1] + b[1]) / 2
                pts[i][1] = pts[(i + 1) % n][1] = ym
    out = []
    for x, y in pts:
        X, Y = tp(Mi, x, y)
        p = [round(X * F / ppc, 1), round(Y * F / ppc, 1)]
        if not out or abs(out[-1][0] - p[0]) + abs(out[-1][1] - p[1]) > 0.5:
            out.append(p)
    if len(out) >= 2 and abs(out[0][0] - out[-1][0]) + abs(out[0][1] - out[-1][1]) <= 0.5:
        out.pop()
    if len(out) < 3:
        return None
    poly = Polygon(out).buffer(0)
    if poly.is_empty:
        return None
    if poly.geom_type != "Polygon":
        poly = max(poly.geoms, key=lambda g: g.area)
    ring = list(poly.exterior.coords)[:-1]
    return [[round(x, 1), round(y, 1)] for x, y in ring]


def main():
    d, ppc = sys.argv[1], float(sys.argv[2])
    J = lambda f, dflt=None: json.load(open(os.path.join(d, f), encoding="utf-8")) if os.path.exists(os.path.join(d, f)) else dflt
    plan, seeds = J("plan.general.json"), J("seeds.json", [])
    # WALLS ONLY (the grey wall band of plan-grey.png, windows included): trace-plan's barrier also holds its automatic
    # door-gap bars (diagonal segments between wall ends) and door leaves, which would make rooms diagonal
    grey = cv2.imread(os.path.join(d, "plan-grey.png"), cv2.IMREAD_GRAYSCALE)
    full = ((grey >= 70) & (grey <= 150)).astype(np.uint8)
    full = cv2.morphologyEx(full, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    full = cv2.morphologyEx(full, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    cv2.imwrite(os.path.join(d, "walls-only.png"), full.astype(np.uint8) * 255)
    H0, W0 = full.shape
    bar = cv2.resize(full.astype(np.uint8), (W0 // F, H0 // F), interpolation=cv2.INTER_AREA) > 0
    bar = cv2.morphologyEx(bar.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    env = cv2.imread(os.path.join(d, "envelope.png"), cv2.IMREAD_GRAYSCALE)
    env = (cv2.resize(env, (bar.shape[1], bar.shape[0]), interpolation=cv2.INTER_NEAREST) > 0) if env is not None else np.ones_like(bar)
    H, W = bar.shape
    ang = dominant_angle(bar)
    # pick the rotation sign that makes the walls axis-aligned
    best = None
    for a in (ang, -ang, 90 - ang, ang - 90):
        M, Mi, size = rot_setup(H, W, a)
        br = cv2.warpAffine(bar.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        r = dominant_angle(br)
        off = min(r, 90 - r)
        if best is None or off < best[0]:
            best = (off, a, M, Mi, size)
    _, a_used, M, Mi, size = best
    bar_r = cv2.warpAffine(bar.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    env_r = cv2.warpAffine(env.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    inside = env_r & ~bar_r
    paved_r = None
    crop = cv2.imread(os.path.join(d, "crop.png"), cv2.IMREAD_COLOR)
    if crop is not None:
        hsv = cv2.cvtColor(cv2.resize(crop, (W, H), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2HSV)
        if (hsv[..., 1] > 55).mean() >= 0.03:          # a rendered plan: paving = light and unsaturated
            paved = ((hsv[..., 1] < 45) & (hsv[..., 2] > 120)).astype(np.uint8)
            paved = cv2.morphologyEx(paved, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            paved_r = cv2.warpAffine(paved, M, size, flags=cv2.INTER_NEAREST) > 0
    outside = ~env_r & ~bar_r
    Hr, Wr = bar_r.shape
    pf = ppc / F
    notes = []
    def to_r(px):
        return tp(M, px[0] / F, px[1] / F)
    gl_early = None
    fb_ = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    if fb_ is not None:
        bb_ = cv2.resize((fb_ > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb_ = cv2.morphologyEx(bb_.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
        gl_early = cv2.warpAffine(bb_.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    n_v, l_v = cv2.connectedComponents((inside & ~(gl_early if gl_early is not None else bar_r)).astype(np.uint8), connectivity=4)
    for s_ in seeds:
        if not s_.get("is_outdoor"):
            continue
        vx, vy = [int(round(v)) for v in to_r(s_.get("label_px") or s_["at_px"])]
        if not (0 <= vy < Hr and 0 <= vx < Wr and env_r[vy, vx]):
            continue
        if l_v[vy, vx] > 0:
            comp_v = l_v == l_v[vy, vx]
        else:
            yy, xx = np.nonzero(l_v > 0)
            if not len(xx):
                continue
            j = int(np.argmin((xx - vx) ** 2 + (yy - vy) ** 2))
            comp_v = l_v == l_v[yy[j], xx[j]] if math.hypot(xx[j] - vx, yy[j] - vy) <= 60 * pf else None
        if comp_v is None or comp_v.sum() / (pf * pf) / 1e4 > 60:
            continue
        inside[comp_v] = False
        outside[comp_v] = True
        if re.search(r"בקומ", s_.get("name_he") or ""):
            s_["void_on_this_floor"] = True
            notes.append(f"{s_['id']}: an outdoor label naming another floor, inside the building: a void on this floor, not a room")
        else:
            notes.append(f"{s_['id']}: an outdoor label inside the building envelope: this floor's terrace / patio, outside the rooms")
    inside_er = cv2.erode(inside.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    n_c, l_c = cv2.connectedComponents(inside_er.astype(np.uint8), connectivity=4)
    ring_wall = cv2.dilate(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    out_m = (~env_r).astype(np.uint8)
    out_m[:8, :] = 1; out_m[-8:, :] = 1; out_m[:, :8] = 1; out_m[:, -8:] = 1      # the image border is outside
    img_m = cv2.warpAffine(np.ones((H, W), np.uint8), M, size, flags=cv2.INTER_NEAREST)
    out_m[cv2.dilate((img_m == 0).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0] = 1   # so is the area beyond the rotated image
    ring_out = cv2.dilate(out_m, np.ones((3, 3), np.uint8)) > 0
    dropped = 0
    for c in range(1, n_c):
        comp = (cv2.dilate((l_c == c).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & inside
        edge = comp & ~cv2.erode(comp.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        n_edge = int(edge.sum())
        if n_edge == 0:
            continue
        on_out = int((edge & ring_out & ~ring_wall).sum())
        if on_out > 0.35 * n_edge:
            inside[comp] = False
            outside[comp] = True
            dropped += 1
    if dropped:
        print(f"auto_rooms: {dropped} free strip(s) inside the envelope but not enclosed by walls -> outside")
    Hr, Wr = bar_r.shape
    pf = ppc / F                                    # rotated-frame px per cm
    t = int(40 * pf)
    # (notes defined above)
    # the entrance door: the envelope's outline gap nearest an entrance label
    ring = (cv2.dilate(env_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~env_r & ~bar_r
    n_r, l_r = cv2.connectedComponents(ring.astype(np.uint8), connectivity=8)
    ent = next((s for s in seeds if "כניסה" in (s.get("name_he") or "") or s.get("vlm_type") == "entrance"), None)
    door_px = None
    if ent and n_r > 1:
        lx, ly = to_r(ent.get("label_px") or ent["at_px"])
        best_d = None
        for c in range(1, n_r):
            yy, xx = np.nonzero(l_r == c)
            dd = np.min((xx - lx) ** 2 + (yy - ly) ** 2)
            if best_d is None or dd < best_d[0]:
                best_d = (dd, (float(xx.mean()), float(yy.mean())))
        door_px = best_d[1]
    full_b0 = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    gl_r = None
    if full_b0 is not None:
        bb0 = cv2.resize((full_b0 > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb0 = cv2.morphologyEx(bb0.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
        gl_r = cv2.warpAffine(bb0.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    claim = np.zeros((Hr, Wr), np.int32)
    depth = np.zeros((Hr, Wr), np.float32)
    rect_of = {}
    n_in, comp_in = cv2.connectedComponents(inside.astype(np.uint8), connectivity=4)
    def label_point(s):
        x, y = to_r(s.get("label_px") or s["at_px"])
        xi, yi = int(round(x)), int(round(y))
        if 0 <= yi < Hr and 0 <= xi < Wr and inside[yi, xi]:
            return xi, yi, False
        # an indoor label outside the envelope: at the entrance door when it is the entrance, else the nearest inside pixel
        if door_px is not None and s is ent:
            x, y = door_px
        iy, ix = np.nonzero(inside)
        j = int(np.argmin((ix - x) ** 2 + (iy - y) ** 2))
        return int(ix[j]), int(iy[j]), True
    pts = {}
    for k, s in enumerate(seeds):
        if s.get("is_outdoor") or s.get("auto"):
            continue
        pts[k] = label_point(s)
    # 2. printed rectangles (round 5): placed by score — inside the free space, containing the room's OWN fixtures (a kitchen
    #    its counter/hob/sink, a bath its WC/shower/basin), touching walls and glazing, never covering another room's label
    vlm = J("vlm.json", {})
    KIT = {"counter", "hob", "sink", "tall_unit", "island"}
    WETK = {"wc", "shower", "bathtub", "vanity", "washer"}
    fx_pts = []
    for f in vlm.get("fixtures", []) or []:
        b = f.get("box_px")
        if b:
            fx_pts.append((f.get("kind"), to_r(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))))
    label_r = {k: (pts[k][0], pts[k][1]) for k in pts}
    def own_fixtures(k):
        s = seeds[k]
        kinds = KIT if s.get("type") == "kitchen" else WETK if s.get("type") == "bathroom" else set()
        if not kinds:
            return []
        same = [j for j in pts if seeds[j].get("type") == s.get("type")]
        out = []
        for kind, (fx, fy) in fx_pts:
            if kind not in kinds:
                continue
            near = min(same, key=lambda j: (label_r[j][0] - fx) ** 2 + (label_r[j][1] - fy) ** 2)
            if near == k and math.hypot(label_r[k][0] - fx, label_r[k][1] - fy) <= 450 * pf:
                out.append((fx, fy))
        return out
    integ = lambda m: np.pad(m.astype(np.int64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    def boxsum(I, x0, y0, x1, y1):
        x0, y0 = max(0, int(x0)), max(0, int(y0)); x1, y1 = min(I.shape[1] - 1, int(x1)), min(I.shape[0] - 1, int(y1))
        if x1 <= x0 or y1 <= y0:
            return 0
        return I[y1, x1] - I[y0, x1] - I[y1, x0] + I[y0, x0]
    I_bar = integ(bar_r)
    def place(k, cmask, A, B):
        x, y = label_r[k]
        I_in = integ(cmask)
        own = own_fixtures(k)
        others = [label_r[j] for j in pts if j != k]
        best = None
        for (a, b) in ((A, B), (B, A)):
            step = max(1, int(min(a, b) / 24))
            for x0 in range(int(x - a), int(x) + 1, step):
                for y0 in range(int(y - b), int(y) + 1, step):
                    x1, y1 = x0 + a, y0 + b
                    frac = boxsum(I_in, x0, y0, x1, y1) / max(1.0, a * b)
                    ring = boxsum(I_bar, x0 - 3, y0 - 3, x1 + 3, y1 + 3) - boxsum(I_bar, x0 + 2, y0 + 2, x1 - 2, y1 - 2)
                    wall_in = boxsum(I_bar, x0 + 3, y0 + 3, x1 - 3, y1 - 3)   # a rectangle that crosses a wall
                    own_in = sum(1 for fx, fy in own if x0 <= fx <= x1 and y0 <= fy <= y1)
                    oth_in = sum(1 for ox, oy in others if x0 + 3 <= ox <= x1 - 3 and y0 + 3 <= oy <= y1 - 3)
                    sc = frac * 1000 + (own_in / len(own) * 400 if own else 0) - 600 * oth_in + min(ring, 4 * (a + b)) / (4 * (a + b)) * 80 - 5000 * wall_in / max(1.0, a * b)
                    if best is None or sc > best[0]:
                        best = (sc, [x0, y0, x1, y1], frac, own_in, len(own), oth_in)
        return best
    def place_in(k, cmask_l, bar_l, A, B, Ml):
        x, y = label_r[k]
        I_in = integ(cmask_l); I_b = integ(bar_l)
        own = [tp(Ml, fx, fy) for fx, fy in own_fixtures(k)]
        others = [tp(Ml, *label_r[j]) for j in pts if j != k]
        best = None
        for (a, b) in ((A, B), (B, A)):
            step = max(1, int(min(a, b) / 24))
            for x0 in range(int(x - a), int(x) + 1, step):
                for y0 in range(int(y - b), int(y) + 1, step):
                    x1, y1 = x0 + a, y0 + b
                    frac = boxsum(I_in, x0, y0, x1, y1) / max(1.0, a * b)
                    ring = boxsum(I_b, x0 - 3, y0 - 3, x1 + 3, y1 + 3) - boxsum(I_b, x0 + 2, y0 + 2, x1 - 2, y1 - 2)
                    wall_in = boxsum(I_b, x0 + 3, y0 + 3, x1 - 3, y1 - 3)
                    own_in = sum(1 for fx, fy in own if x0 <= fx <= x1 and y0 <= fy <= y1)
                    oth_in = sum(1 for ox, oy in others if x0 + 3 <= ox <= x1 - 3 and y0 + 3 <= oy <= y1 - 3)
                    sc = frac * 1000 + (own_in / len(own) * 400 if own else 0) - 600 * oth_in + min(ring, 4 * (a + b)) / (4 * (a + b)) * 80 - 5000 * wall_in / max(1.0, a * b)
                    if best is None or sc > best[0]:
                        best = (sc, [x0, y0, x1, y1], frac, own_in, len(own), oth_in)
        return best
    # (round 11) the printed dimension lines of a CAD PDF are the authority: chains measured tick to tick
    CHAINS = []
    pv_ = J("pdf-vectors.json")
    if pv_ and pv_.get("dimension_segments_px"):
        import dim_chains
        CHAINS = dim_chains.chains(pv_["dimension_segments_px"], ppc)
        notes.append(f"{len(CHAINS)} printed dimension lines read from the PDF (tick to tick)")
    TAN4 = math.tan(math.radians(4))

    def anchor_rect(k, r0, Mx, mask_f):
        """fix the rectangle's extent on each axis that a matching printed dimension line, near the label, gives exactly"""
        dims = seeds[k]["dims_cm"]
        lx, ly = label_r[k]
        if Mx is not None:
            lx, ly = tp(Mx, lx, ly)
        best = {}
        for c in CHAINS:
            A = to_r(c["a"]); B = to_r(c["b"])
            if Mx is not None:
                A = tp(Mx, *A); B = tp(Mx, *B)
            dx, dy = B[0] - A[0], B[1] - A[1]
            if abs(dy) <= TAN4 * abs(dx):
                ax_ = "x"; lo, hi = sorted([A[0], B[0]]); along, perp = lx, abs(ly - (A[1] + B[1]) / 2)
            elif abs(dx) <= TAN4 * abs(dy):
                ax_ = "y"; lo, hi = sorted([A[1], B[1]]); along, perp = ly, abs(lx - (A[0] + B[0]) / 2)
            else:
                continue
            L = hi - lo
            for si, sv in enumerate(dims):
                if abs(c["len_cm"] - sv) > max(0.015 * sv, 4):
                    continue
                other = dims[1 - si]
                if not (lo - 0.15 * L <= along <= hi + 0.15 * L) or perp > other * pf * 1.0:
                    continue
                if ax_ not in best or perp < best[ax_][0]:
                    best[ax_] = (perp, lo, hi, si, c)
        if "x" in best and "y" in best and best["x"][3] == best["y"][3] and abs(dims[0] - dims[1]) > 8:
            drop = "x" if best["x"][0] > best["y"][0] else "y"
            del best[drop]
        if not best:
            return r0, {}
        r = list(r0)
        anc = {}
        if "x" in best:
            _, lo, hi, si, c = best["x"]; r[0], r[2] = lo, hi; anc["x"] = (lo, hi, c["len_cm"])
        if "y" in best:
            _, lo, hi, si, c = best["y"]; r[1], r[3] = lo, hi; anc["y"] = (lo, hi, c["len_cm"])
        if len(best) == 1:                       # the free axis: the other printed side, placed where it lies most inside
            ax_, (_, lo, hi, si, c) = next(iter(best.items()))
            other = dims[1 - si] * pf
            I_m = integ(mask_f)
            if ax_ == "x":
                cands = [(boxsum(I_m, lo, y0, hi, y0 + other), y0) for y0 in range(int(ly - other), int(ly) + 1, max(1, int(other / 30)))]
                y0 = max(cands)[1] if cands else r[1]; r[1], r[3] = y0, y0 + other
            else:
                cands = [(boxsum(I_m, x0, lo, x0 + other, hi), x0) for x0 in range(int(lx - other), int(lx) + 1, max(1, int(other / 30)))]
                x0 = max(cands)[1] if cands else r[0]; r[0], r[2] = x0, x0 + other
        return r, anc

    def restore(r1, anc):
        r1 = list(r1)
        if "x" in anc:
            r1[0], r1[2] = anc["x"][0], anc["x"][1]
        if "y" in anc:
            r1[1], r1[3] = anc["y"][0], anc["y"][1]
        return r1
    order = sorted([k for k in pts if seeds[k].get("dims_cm")], key=lambda k: seeds[k]["dims_cm"][0] * seeds[k]["dims_cm"][1])
    for k in order:
        x, y, moved = pts[k]
        s = seeds[k]
        cmask = inside & (claim == 0)
        a_px, b_px = s["dims_cm"][0] * pf, s["dims_cm"][1] * pf
        tol = lambda size: max(0.02 * size, 5 * pf)
        # (round 6) the walls around THIS label may run on another axis (846's north wing): place in a local frame
        R_ = int(max(a_px, b_px) * 1.2) + 10
        wx0, wy0, wx1, wy1 = max(0, x - R_), max(0, y - R_), min(Wr, x + R_), min(Hr, y + R_)
        r_loc = dominant_angle(bar_r[wy0:wy1, wx0:wx1])
        off = r_loc if r_loc <= 45 else r_loc - 90
        if abs(off) > 3:
            best_l = None
            for sg in (off, -off):
                Ml = cv2.getRotationMatrix2D((float(x), float(y)), sg, 1.0)
                br_l = cv2.warpAffine(bar_r.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
                rr = dominant_angle(br_l[wy0:wy1, wx0:wx1])
                o2 = min(rr, 90 - rr)
                if best_l is None or o2 < best_l[0]:
                    best_l = (o2, sg, Ml, br_l)
            _, sg, Ml, br_l = best_l
            Mli = cv2.invertAffineTransform(Ml)
            in_l = cv2.warpAffine(cmask.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
            in_all_l = cv2.warpAffine(inside.astype(np.uint8), Ml, (Wr, Hr), flags=cv2.INTER_NEAREST) > 0
            saved = (label_r[k], I_bar)
            I_bar_l = integ(br_l)
            I_bar_saved = I_bar
            globals_ = None
            sc, r0, frac, own_in, n_own, oth_in = place_in(k, in_l, br_l, a_px, b_px, Ml)
            r0, anc = anchor_rect(k, r0, Ml, in_l)
            r1, snapped = snap_edges(r0, br_l, in_all_l, t, keep_size=(r0[2] - r0[0], r0[3] - r0[1], tol))
            r1 = restore(r1, anc)
            corners = [tp(Mli, r1[0], r1[1]), tp(Mli, r1[2], r1[1]), tp(Mli, r1[2], r1[3]), tp(Mli, r1[0], r1[3])]
            m = np.zeros((Hr, Wr), np.uint8)
            cv2.fillPoly(m, [np.round(np.array(corners)).astype(np.int32)], 1)
            local_axis = sg
        else:
            sc, r0, frac, own_in, n_own, oth_in = place(k, cmask, a_px, b_px)
            r0, anc = anchor_rect(k, r0, None, cmask)
            r1, snapped = snap_edges(r0, bar_r, inside, t, keep_size=(r0[2] - r0[0], r0[3] - r0[1], tol))
            r1 = restore(r1, anc)
            m = np.zeros((Hr, Wr), np.uint8)
            cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
            local_axis = 0.0
        if anc:                  # an anchored rectangle claims its whole extent: the dimension lines, not the raster, decide
            take = (m > 0) & (claim == 0) & ~(cv2.erode(bar_r.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        else:
            take = (m > 0) & inside & (claim == 0)
        if len(anc) < 2 and (frac < 0.70 or take.sum() < 0.6 * (m > 0).sum() or oth_in > 0):
            notes.append(f"{s['id']}: its printed {s['dims_cm']} cm rectangle fits the free space only {frac * 100:.0f} % — not a room rectangle (a span over several rooms?); traced without it")
            s["dims_rejected"] = s["dims_cm"]; s["dims_cm"] = None
            continue
        claim[take] = k + 1
        rect_of[k] = {"rect_px": [float(v) for v in r1], "fit": round(float(frac), 3), "snapped": snapped, "own_fixtures_in": f"{own_in}/{n_own}", "other_labels_covered": oth_in, "local_axis_deg": round(float(local_axis), 1),
                      "anchored": {ax_: v[2] for ax_, v in anc.items()}}
        if anc:
            s["anchored_by_dimension_lines"] = {ax_: v[2] for ax_, v in anc.items()}
    # (round 8) the front door from the drawing: the door arc whose hinge is nearest the entrance label (<= 4 m)
    door_seg = None
    if ent is not None:
        try:
            import auto_doors
            stroke_p = os.path.join(d, "strokes.png")
            if os.path.exists(stroke_p):
                stroke = (cv2.imread(stroke_p, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8) * 255
            else:
                band_ = ((grey >= 70) & (grey <= 150)).astype(np.uint8)
                stroke = ((grey < 70) & (cv2.dilate(band_, np.ones((5, 5), np.uint8)) == 0)).astype(np.uint8) * 255
            arcs = auto_doors.detect_arcs(stroke, full, ppc)
            lx, ly = ent.get("label_px") or ent["at_px"]
            near = sorted(arcs, key=lambda a_: math.hypot(a_["hinge_px"][0] - lx, a_["hinge_px"][1] - ly))
            if near and math.hypot(near[0]["hinge_px"][0] - lx, near[0]["hinge_px"][1] - ly) <= 400 * ppc:
                (hx, hy), (ex, ey) = near[0]["chord_px"]
                p0, p1 = to_r((hx, hy)), to_r((ex, ey))
                door_seg = (p0, p1)
                notes.append(f"front door: the arc at {round(hx / ppc)},{round(hy / ppc)} cm, {near[0]['r_cm']} cm wide")
        except Exception as e_:
            notes.append(f"front door arc: {str(e_)[:80]}")
    # (round 8) no arc: the tracer's automatic door gap (60-140 cm between two wall ends) nearest the entrance label (<= 4 m)
    if ent is not None and door_seg is None and os.path.exists(os.path.join(d, "trace.log")):
        lxc, lyc = [v / ppc for v in (ent.get("label_px") or ent["at_px"])]
        gaps = []
        for line in open(os.path.join(d, "trace.log"), encoding="utf-8", errors="replace"):
            mm = re.match(r"AUTO gap-\d+\s+(\d+) cm\s+(-?\d+),(-?\d+) -> (-?\d+),(-?\d+)", line.strip())
            if mm:
                w_, ax_, ay_, bx_, by_ = [float(v) for v in mm.groups()]
                cxg, cyg = (ax_ + bx_) / 2, (ay_ + by_) / 2
                gaps.append((math.hypot(cxg - lxc, cyg - lyc), (ax_, ay_), (bx_, by_), w_))
        if gaps:
            dist_, a_, b_, w_ = min(gaps)
            if dist_ <= 400:
                door_seg = (to_r((a_[0] * ppc, a_[1] * ppc)), to_r((b_[0] * ppc, b_[1] * ppc)))
                notes.append(f"front door: the wall gap {w_:.0f} cm wide, {dist_:.0f} cm from the entrance label")
    # 2c'. (round 7) the entrance: from the front door inward, a band of the door's width, until the free space opens wider
    #      than ~2.2 doors (a stair hall) or a room / wall stops it
    if ent is not None and seeds.index(ent) in pts and (door_seg is not None or (door_px is not None and n_r > 1)):
        k_e = seeds.index(ent)
        if door_seg is not None:
            (ax_, ay_), (bx_, by_) = door_seg
            ts_ = np.linspace(0, 1, 40)
            gx = np.round(ax_ + (bx_ - ax_) * ts_).astype(int); gy = np.round(ay_ + (by_ - ay_) * ts_).astype(int)
        else:
            best_c = min(range(1, n_r), key=lambda c: (lambda yy, xx: np.min((xx - door_px[0]) ** 2 + (yy - door_px[1]) ** 2))(*np.nonzero(l_r == c)))
            gy, gx = np.nonzero(l_r == best_c)
        horiz = (gx.max() - gx.min()) >= (gy.max() - gy.min())
        un = inside & (claim == 0)
        # (round 8) the walk follows the FREE pixels anywhere across the door's span (a door may half-face a room's rectangle),
        # and the free run they extend into; a vertical door walks on the transposed arrays
        U = un if horiz else un.T
        if horiz:
            a0, a1, c0 = int(gx.min()), int(gx.max()), int(gy.mean())
        else:
            a0, a1, c0 = int(gy.min()), int(gy.max()), int(gx.mean())
        wd = max(1, a1 - a0)
        lim = U.shape[0]
        def free_runs(row):
            span = row[max(0, a0 - int(10 * pf)):min(row.shape[0], a1 + int(10 * pf)) + 1]
            if not span.any():
                return None
            idx = np.nonzero(span)[0] + max(0, a0 - int(10 * pf))
            l_, r_ = int(idx.min()), int(idx.max())
            while l_ > 0 and row[l_ - 1]: l_ -= 1
            while r_ < row.shape[0] - 1 and row[r_ + 1]: r_ += 1
            return l_, r_
        # the inside is the side whose rows (just past the wall band) hold free pixels across the door span
        sides = []
        for st_ in (1, -1):
            hits = sum(1 for dd in range(1, int(60 * pf)) if 0 <= c0 + st_ * dd < lim and free_runs(U[c0 + st_ * dd]) is not None)
            sides.append((hits, st_))
        step = max(sides)[1]
        B = np.zeros_like(U)
        y = c0 + step
        while 0 <= y < lim and free_runs(U[y]) is None and abs(y - c0) < 40 * pf:
            y += step
        while 0 <= y < lim:
            fr = free_runs(U[y])
            if fr is None:
                break
            l_, r_ = fr
            if (r_ - l_) > 2.2 * wd and abs(y - c0) > 60 * pf:
                break
            B[y, l_:r_ + 1] = True
            y += step
        band = B if horiz else B.T
        band &= un
        if band.sum() / (pf * pf) / 1e4 >= 1.0:
            claim[band] = k_e + 1
            ent["from_strip"] = True
    # (round 7) open-plan rooms WITHOUT printed dims (kitchen / dining / living) that share one region bounded by walls AND
    #     glazing: orthogonal slabs, cut at the midpoints between their labels along the axis of their greatest spread
    if gl_r is not None:
        reg_all = inside & ~gl_r & (claim == 0)
        k_open = int(110 * pf) | 1
        reg_all = cv2.morphologyEx(reg_all.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (k_open, k_open))) > 0
        n_g, l_g = cv2.connectedComponents(reg_all.astype(np.uint8), connectivity=4)
        groups = {}
        for k, (x, y, _) in pts.items():
            s_ = seeds[k]
            if s_.get("dims_cm") or s_.get("vlm_type") not in ("kitchen", "dining", "living"):
                continue
            g = l_g[y, x]
            if g == 0:
                yy, xx = np.nonzero(l_g > 0)
                if not len(xx):
                    continue
                j = int(np.argmin((xx - x) ** 2 + (yy - y) ** 2)); g = l_g[yy[j], xx[j]]
            groups.setdefault(int(g), []).append(k)
        for g, ks in groups.items():
            if len(ks) < 2:
                continue
            region = l_g == g
            xs_ = [pts[k][0] for k in ks]; ys_ = [pts[k][1] for k in ks]
            axis = 0 if (max(xs_) - min(xs_)) >= (max(ys_) - min(ys_)) else 1
            ks = sorted(ks, key=lambda k: pts[k][axis])
            cuts = [(pts[ks[i]][axis] + pts[ks[i + 1]][axis]) / 2 for i in range(len(ks) - 1)]
            yy, xx = np.mgrid[0:Hr, 0:Wr]
            coord = xx if axis == 0 else yy
            for i, k in enumerate(ks):
                lo = cuts[i - 1] if i > 0 else -1e9
                hi = cuts[i] if i < len(cuts) else 1e9
                slab = region & (coord >= lo) & (coord < hi)
                claim[slab & (claim == 0)] = k + 1
                seeds[k]["from_box"] = True
                rect_of[k] = {"rect_px": None, "fit": None, "snapped": False, "from": f"open-plan slab {i + 1}/{len(ks)} (walls + glazing)"}
    # 2c. (round 6) the entrance: the narrow free strip (<= 160 cm wide) connected to the front door, as its own room
    if ent is not None and door_px is not None and seeds.index(ent) in pts:
        k_e = seeds.index(ent)
        un = (inside & (claim == 0)).astype(np.uint8)
        dt = cv2.distanceTransform(un, cv2.DIST_L2, 5)
        kk = int(80 * pf) * 2 + 1
        wide = cv2.dilate(dt, np.ones((kk, kk), np.uint8))
        narrow = (un > 0) & (wide <= 80 * pf)
        n_n, l_n = cv2.connectedComponents(narrow.astype(np.uint8), connectivity=4)
        dx_, dy_ = int(door_px[0]), int(door_px[1])
        yy, xx = np.nonzero(l_n > 0)
        if len(xx):
            j = int(np.argmin((xx - dx_) ** 2 + (yy - dy_) ** 2))
            if math.hypot(xx[j] - dx_, yy[j] - dy_) <= 60 * pf:
                strip = l_n == l_n[yy[j], xx[j]]
                if strip.sum() / (pf * pf) / 1e4 >= 1.0:
                    claim[strip] = k_e + 1
                    ent["from_strip"] = True
    # 2d. (round 6) a bath / WC without printed dims: the rectangle around its own fixtures (+ 20 cm), snapped to the walls
    for k in [k for k in pts if not seeds[k].get("dims_cm") and seeds[k].get("type") == "bathroom"]:
        own = own_fixtures(k)
        if len(own) < 2:
            continue
        xs_ = [p[0] for p in own]; ys_ = [p[1] for p in own]
        mg = 45 * pf
        r0 = [min(xs_) - mg, min(ys_) - mg, max(xs_) + mg, max(ys_) + mg]
        r1, snapped = snap_edges(r0, bar_r, inside, int(60 * pf))
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
        take = (m > 0) & inside & (claim == 0)
        if take.sum() / (pf * pf) / 1e4 >= 1.0:
            claim[take] = k + 1
            seeds[k]["from_box"] = True
            rect_of[k] = {"rect_px": [float(v) for v in r1], "fit": None, "snapped": snapped, "from": "its fixtures"}
    # 2a. a room WITHOUT printed dims whose reading box lies inside the building: that box, snapped to the walls
    for k in [k for k in pts if not seeds[k].get("dims_cm") and not seeds[k].get("from_box") and not seeds[k].get("from_strip")]:
        s = seeds[k]
        rb = s.get("room_box_px")
        if not rb:
            continue
        cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
        xs_, ys_ = [c[0] for c in cs_], [c[1] for c in cs_]
        r0 = [min(xs_), min(ys_), max(xs_), max(ys_)]
        cx_, cy_ = int((r0[0] + r0[2]) / 2), int((r0[1] + r0[3]) / 2)
        if not (0 <= cy_ < Hr and 0 <= cx_ < Wr and env_r[cy_, cx_]):
            continue            # the reading box sits outside the building (an entrance path): the door rule places it
        r1, snapped = snap_edges(r0, bar_r, inside, t)
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(m, (int(r1[0]), int(r1[1])), (int(r1[2]) - 1, int(r1[3]) - 1), 1, -1)
        take = (m > 0) & inside & (claim == 0)
        if take.sum() / (pf * pf) / 1e4 >= 0.5:
            claim[take] = k + 1
            s["from_box"] = True
            rect_of[k] = {"rect_px": r1, "fit": None, "snapped": snapped, "from": "reading box"}
    # 2b. a room without printed dims and no usable box keeps the tracer's flood region, on unclaimed space
    old_rooms = {r["id"]: r for r in plan["rooms"]}
    sc_ = ppc / F
    for k, s in enumerate(seeds):
        if s.get("dims_cm") or s.get("auto") or s.get("from_box") or s.get("from_strip") or s["room_id"] not in old_rooms:
            continue
        loop = old_rooms[s["room_id"]]["loop"]
        if len(loop) < 3:
            continue
        m = np.zeros((Hr, Wr), np.uint8)
        cv2.fillPoly(m, [np.round(np.array([tp(M, x * sc_, y * sc_) for x, y in loop])).astype(np.int32)], 1)
        region = (m > 0) & (outside if s.get("is_outdoor") else inside) & (claim == 0)
        if s.get("is_outdoor") and paved_r is not None:
            region &= paved_r
        if gl_r is not None:          # (round 8) only the part around its label, bounded by walls AND glazing / railing
            reg2 = region & ~gl_r
            k30 = int(30 * pf) | 1
            reg2 = cv2.morphologyEx(reg2.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k30, k30), np.uint8)) > 0
            n2, l2 = cv2.connectedComponents(reg2.astype(np.uint8), connectivity=4)
            lx2, ly2 = [int(round(v)) for v in to_r(s.get("label_px") or s["at_px"])]
            if n2 > 1:
                yy2, xx2 = np.nonzero(l2 > 0)
                j2 = int(np.argmin((xx2 - lx2) ** 2 + (yy2 - ly2) ** 2))
                if math.hypot(xx2[j2] - lx2, yy2[j2] - ly2) <= 150 * pf:
                    region = l2 == l2[yy2[j2], xx2[j2]]
                else:
                    region = np.zeros_like(region)      # the flood is elsewhere (a leak): drop it, the leftover rules place the room
            else:
                region = np.zeros_like(region)
        if region.sum() * (1 / (pf * pf)) / 1e4 > 0.3:
            claim[region] = k + 1
            s["kept_flood"] = True
    # 3. leftover pieces
    left = inside & (claim == 0)
    n_l, l_l, st_l, _ = cv2.connectedComponentsWithStats(left.astype(np.uint8), connectivity=4)
    min_px = (0.3e4) * pf * pf          # 0.3 m2
    hall_k = None
    # an indoor label without dims whose point fell inside a claimed rectangle takes the nearest leftover piece (<= 150 cm)
    nodim_piece = {}
    for k, (x, y, _) in pts.items():
        if seeds[k].get("dims_cm") or l_l[y, x] > 0:
            continue
        best_c = None
        for c in range(1, n_l):
            if st_l[c, cv2.CC_STAT_AREA] < min_px:
                continue
            yy, xx = np.nonzero(l_l == c)
            dmin = float(np.sqrt(np.min((xx - x) ** 2 + (yy - y) ** 2))) / pf
            if dmin <= 150 and (best_c is None or dmin < best_c[0]):
                best_c = (dmin, c)
        if best_c:
            nodim_piece[best_c[1]] = k
    for c in range(1, n_l):
        if st_l[c, cv2.CC_STAT_AREA] < min_px:
            continue
        piece = l_l == c
        area_m2 = st_l[c, cv2.CC_STAT_AREA] / (pf * pf) / 1e4
        owners = [k for k, (x, y, _) in pts.items() if not seeds[k].get("dims_cm") and piece[y, x]] or ([nodim_piece[c]] if c in nodim_piece else [])
        if owners:
            k = owners[0]
            rb = seeds[k].get("room_box_px")
            if rb and seeds[k] is not ent:
                bm = np.zeros((Hr, Wr), np.uint8)
                cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
                cv2.fillPoly(bm, [np.round(np.array(cs_)).astype(np.int32)], 1)
                bm = cv2.dilate(bm, np.ones((int(30 * pf) | 1, int(30 * pf) | 1), np.uint8)) > 0
                inbox = piece & bm
                if inbox.sum() > 0.3 * piece.sum():
                    rest = piece & ~bm
                    piece = inbox
                    left[rest] = True      # the rest of the piece is re-handled below as unlabelled
            claim[piece] = k + 1
            continue
        touches_door = door_px is not None and np.hypot(*(np.array(np.nonzero(piece))[::-1].T - np.array(door_px)).T).min() <= 60 * pf
        if area_m2 >= 3.0 and touches_door and ent is not None and ent_k_has_room(seeds, claim, ent) is False:
            k = seeds.index(ent)
            claim[piece] = k + 1
            continue
        if area_m2 >= 3.0 and touches_door:
            if hall_k is None:
                seeds.append({"id": "hall-entrance", "room_id": "r-hall-entrance", "name_he": "מבואה", "name_en": "Hall", "type": "hall", "is_outdoor": False, "auto": True, "auto_reason": "entrance-hall", "at_px": [0, 0]})
                hall_k = len(seeds) - 1
            claim[piece] = hall_k + 1
            continue
        # join the labelled room it opens into (longest shared edge)
        ring_p = (cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~piece
        nb = claim[ring_p]
        nb = nb[nb > 0]
        dtp = cv2.distanceTransform(piece.astype(np.uint8), cv2.DIST_L2, 5)
        width_cm = 2 * float(dtp.max()) / pf
        edge_p = piece & ~(cv2.erode(piece.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        on_env = float((edge_p & ring_out).sum()) / max(1, int(edge_p.sum()))
        if width_cm <= 110 and on_env >= 0.25:
            inside[piece] = False; outside[piece] = True
            notes.append(f"a {area_m2:.1f} m² strip {width_cm:.0f} cm wide along the building edge: outside (a roof / ledge strip)")
            continue
        PRIVATE = {"bedroom", "bathroom", "storage", "safe_room"}
        if width_cm <= 170 and area_m2 >= 1.0 and any(seeds[v - 1].get("type") in PRIVATE for v in set(nb.tolist())) and len(set(nb.tolist())) >= 2:
            seeds.append({"id": f"corridor-{c}", "room_id": f"r-corridor-{c}", "name_he": "מעבר", "name_en": "Corridor", "type": "hall", "is_outdoor": False,
                          "auto": True, "auto_reason": "corridor", "at_px": [0, 0]})
            claim[piece] = len(seeds)
            notes.append(f"corridor-{c}: a {width_cm:.0f} cm wide passage serving {sorted({seeds[v - 1]['id'] for v in set(nb.tolist())})}: its own room «מעבר»")
            continue
        if len(nb) and len(set(nb.tolist())) == 1 and not seeds[int(nb[0]) - 1].get("is_outdoor") and not seeds[int(nb[0]) - 1].get("dims_cm"):
            claim[piece] = int(nb[0])          # enclosed by one room and walls: a corner of that room (never a printed room)
            continue
        OPEN_TYPES = {"hall", "living", "kitchen", "other"}       # never a bedroom, a bath, a laundry or a store
        nb = np.array([v for v in nb if seeds[v - 1].get("type") in OPEN_TYPES and not seeds[v - 1].get("is_outdoor")], dtype=np.int64)
        nb_free = np.array([v for v in nb if not seeds[v - 1].get("dims_cm")], dtype=np.int64)
        if len(nb_free):
            claim[piece] = np.bincount(nb_free).argmax()
        elif len(nb):
            claim[piece] = np.bincount(nb).argmax()
        elif area_m2 >= 1.0:
            seeds.append({"id": f"corridor-{c}", "room_id": f"r-corridor-{c}", "name_he": "מעבר", "name_en": "Corridor", "type": "hall", "is_outdoor": False,
                          "auto": True, "auto_reason": "corridor", "at_px": [0, 0]})
            claim[piece] = len(seeds)
            notes.append(f"corridor-{c}: {area_m2:.1f} m² of unlabelled space next to bedrooms/baths only: its own room «מעבר» (for review)")
        else:
            notes.append(f"a {area_m2:.1f} m² piece opens into no hall or living room: left untraced")
    # (round 6) an outdoor passage («מעבר צר») is part of the terrace beside it: one terrace room
    terr = [k for k, s_ in enumerate(seeds) if s_.get("is_outdoor") and "מרפסת" in (s_.get("name_he") or "")]
    for k, s_ in enumerate(seeds):
        if s_.get("is_outdoor") and "מעבר" in (s_.get("name_he") or "") and terr:
            j = terr[0]
            claim[claim == k + 1] = j + 1
            s_["merged_into"] = seeds[j]["room_id"]
    full_b = cv2.imread(os.path.join(d, "barrier.png"), cv2.IMREAD_GRAYSCALE)
    if full_b is not None:
        bb = cv2.resize((full_b > 127).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        bb = cv2.morphologyEx(bb.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0   # heal railing gaps
        rail_r = cv2.warpAffine(bb.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        outside = outside & ~cv2.dilate(rail_r.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)   # the terrace ends at its railing
    # 5. outdoor rooms
    n_o, comp_o = cv2.connectedComponents(outside.astype(np.uint8), connectivity=4)
    for k, s in enumerate(seeds):
        if not s.get("is_outdoor") or s.get("kept_flood") or s.get("merged_into") or s.get("void_on_this_floor"):
            continue
        x, y = [int(round(v)) for v in to_r(s.get("label_px") or s["at_px"])]
        if not (0 <= y < Hr and 0 <= x < Wr):
            continue
        if not outside[y, x]:
            yy, xx = np.nonzero(outside)
            j = int(np.argmin((xx - x) ** 2 + (yy - y) ** 2)); x, y = int(xx[j]), int(yy[j])
        reg = comp_o == comp_o[y, x]
        rb = s.get("room_box_px")
        if rb:
            bm = np.zeros((Hr, Wr), np.uint8)
            cs_ = [to_r((rb[0], rb[1])), to_r((rb[2], rb[1])), to_r((rb[2], rb[3])), to_r((rb[0], rb[3]))]
            cv2.fillPoly(bm, [np.round(np.array(cs_)).astype(np.int32)], 1)
            reg = reg & (bm > 0)
        else:   # no reading box: at most 6 m around the label (an open terrace must not swallow the garden)
            yy_, xx_ = np.mgrid[0:Hr, 0:Wr]
            reg = reg & ((xx_ - x) ** 2 + (yy_ - y) ** 2 <= (600 * pf) ** 2)
        if paved_r is not None:
            reg = reg & paved_r
        near_b = cv2.dilate(env_r.astype(np.uint8), np.ones((int(350 * pf) | 1, int(350 * pf) | 1), np.uint8)) > 0
        reg = reg & near_b          # a terrace / patio is never more than 3.5 m from the building
        if reg.any():
            k80 = int(80 * pf) | 1
            reg_c = cv2.morphologyEx(reg.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k80, k80)))
            cs_o, _ = cv2.findContours(reg_c, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            filled = np.zeros_like(reg_c)
            cv2.drawContours(filled, cs_o, -1, 1, -1)
            reg = (filled > 0) & ~bar_r & ~env_r
        claim[reg & (claim == 0)] = k + 1
    # (round 8) a bath is never smaller than its fixtures' bounding box (+ 15 cm): it takes that box from rooms without dims
    for k in [k for k in pts if seeds[k].get("type") == "bathroom" and not seeds[k].get("dims_cm")]:   # a printed bath keeps its printed size
        own = own_fixtures(k)
        if len(own) < 2:
            continue
        xs_ = [p_[0] for p_ in own]; ys_ = [p_[1] for p_ in own]
        mg = 15 * pf
        bx = np.zeros((Hr, Wr), np.uint8)
        cv2.rectangle(bx, (int(min(xs_) - mg), int(min(ys_) - mg)), (int(max(xs_) + mg), int(max(ys_) + mg)), 1, -1)
        bx = (bx > 0) & inside
        mine = claim == k + 1
        if mine.sum() < 0.8 * bx.sum():
            free_or_soft = (claim == 0) | np.isin(claim, [j + 1 for j, s_ in enumerate(seeds) if not s_.get("dims_cm") and j != k and s_.get("type") != "bathroom"])
            claim[bx & free_or_soft] = k + 1
            notes.append(f"{seeds[k]['id']}: grown to its fixtures' box")
    # (round 8) stairs from the drawing: an unlabelled corridor holding a regular tread pattern (>= 6 parallel lines 18-35 cm
    #    apart) becomes «מדרגות» for the tread area
    stroke_r = None
    sp_ = os.path.join(d, "strokes.png")
    if os.path.exists(sp_):
        st_full = cv2.imread(sp_, cv2.IMREAD_GRAYSCALE) > 127
        st_small = cv2.resize(st_full.astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        stroke_r = cv2.warpAffine(st_small.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    elif grey is not None:
        dk = cv2.resize(((grey < 110) & ~full).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA) > 0
        stroke_r = cv2.warpAffine(dk.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
    crop_g = cv2.imread(os.path.join(d, "crop.png"), cv2.IMREAD_GRAYSCALE)
    if crop_g is not None:
        ed = cv2.Canny(cv2.resize(crop_g, (W, H), interpolation=cv2.INTER_AREA), 40, 120) > 0
        ed_r = cv2.warpAffine(ed.astype(np.uint8), M, size, flags=cv2.INTER_NEAREST) > 0
        stroke_r = ed_r if stroke_r is None else (stroke_r | ed_r)
    if stroke_r is not None:
        for k, s_ in enumerate(list(seeds)):
            if s_.get("auto_reason") != "corridor":
                continue
            piece = claim == k + 1
            if not piece.any():
                continue
            ys_, xs_ = np.nonzero(piece)
            sub = stroke_r & piece
            best_t = None
            for ax_ in (0, 1):
                prof = sub.sum(axis=ax_).astype(float)            # ax 0: per column (lines along y); ax 1: per row
                if prof.max() <= 0:
                    continue
                thr = 0.35 * prof.max()
                idx = np.nonzero(prof >= thr)[0]
                if len(idx) < 6:
                    continue
                peaks = [idx[0]]
                for i_ in idx[1:]:
                    if i_ - peaks[-1] > 2:
                        peaks.append(i_)
                gaps = np.diff(peaks) / pf
                good = [g_ for g_ in gaps if 18 <= g_ <= 35]
                if len(good) >= 5 and len(good) >= 0.6 * len(gaps):
                    lo, hi = peaks[0], peaks[-1]
                    if best_t is None or len(good) > best_t[0]:
                        best_t = (len(good), ax_, lo, hi)
            if best_t:
                _, ax_, lo, hi = best_t
                treads = piece.copy()
                coord = np.arange(Wr)[None, :] if ax_ == 0 else np.arange(Hr)[:, None]
                treads &= (coord >= lo - 30 * pf) & (coord <= hi + 30 * pf)
                if treads.sum() / (pf * pf) / 1e4 >= 1.5:
                    seeds.append({"id": f"stairs-{k}", "room_id": f"r-stairs-auto-{k}", "name_he": "מדרגות", "name_en": "Stairs", "type": "hall",
                                  "is_outdoor": False, "auto": True, "auto_reason": "stairs", "at_px": [0, 0]})
                    claim[treads] = len(seeds)
                    notes.append(f"stairs: a {best_t[0] + 1}-tread pattern in {s_['id']} -> «מדרגות»")
    # (round 6) an entrance with no room takes the automatic corridor nearest its label (within 4 m): the door-side strip
    if ent is not None and (claim == seeds.index(ent) + 1).sum() / (pf * pf) / 1e4 < 1.0:     # none, or a sliver
        lx, ly = to_r(ent.get("label_px") or ent["at_px"])
        best_c = None
        for k, s_ in enumerate(seeds):
            if s_.get("auto_reason") == "corridor" and (claim == k + 1).any():
                yy, xx = np.nonzero(claim == k + 1)
                dd = float(np.sqrt(np.min((xx - lx) ** 2 + (yy - ly) ** 2))) / pf
                if dd <= 400 and (best_c is None or dd < best_c[0]):
                    best_c = (dd, k)
        if best_c:
            claim[claim == best_c[1] + 1] = seeds.index(ent) + 1
            seeds[best_c[1]]["merged_into"] = ent["room_id"]
            notes.append(f"the entrance takes {seeds[best_c[1]]['id']} ({best_c[0]:.0f} cm from its label)")
    # (round 10) the cap on unlabelled rooms: one automatic corridor per floor
    cors = [k for k, s_ in enumerate(seeds) if s_.get("auto_reason") == "corridor" and (claim == k + 1).any()]
    if len(cors) > 1:
        cors.sort(key=lambda k: -(claim == k + 1).sum())
        keep_k = cors[0]
        for k in cors[1:]:
            piece = claim == k + 1
            ring_p = (cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~piece
            nb = claim[ring_p]; nb = nb[nb > 0]
            nb_all = nb.copy()
            nb = np.array([v for v in nb if seeds[v - 1].get("type") in ("hall", "living", "kitchen", "other") and not seeds[v - 1].get("is_outdoor")], dtype=np.int64)
            if (nb == keep_k + 1).any():
                target = keep_k + 1
            elif len(nb):
                target = int(np.bincount(nb).argmax())
            elif len(nb_all) and len(set(nb_all.tolist())) == 1:
                target = int(nb_all[0])
            else:
                continue                               # not adjacent to anything it may join: stays (for review)
            claim[piece] = target
            seeds[k]["merged_into"] = seeds[target - 1]["room_id"]
            notes.append(f"{seeds[k]['id']}: joined {seeds[target - 1]['id']} (one unlabelled corridor per floor)")
    # (round 10) the tracer's own openings came from its flood regions: keep one only if it still lies between two of the
    #    rebuilt rooms (<= 40 cm from each), else it is stale
    _rooms_now = {}
    for k, s_ in enumerate(seeds):
        mk = claim == k + 1
        if mk.any():
            _rooms_now[s_["room_id"]] = cv2.dilate(mk.astype(np.uint8), np.ones((int(40 * pf) | 1, int(40 * pf) | 1), np.uint8)) > 0
    kept_o = []
    for o in plan.get("openings", []):
        if o.get("source") == "auto_rooms adjacency" or not o.get("centre_cm"):
            kept_o.append(o); continue
        cx_, cy_ = tp(M, o["centre_cm"][0] * ppc / F, o["centre_cm"][1] * ppc / F)
        cx_, cy_ = int(round(cx_)), int(round(cy_))
        if not (0 <= cy_ < Hr and 0 <= cx_ < Wr):
            continue
        touching = [rid for rid, mk in _rooms_now.items() if mk[cy_, cx_]]
        if len(touching) >= 2 or (len(touching) == 1 and "outside" in (o.get("rooms") or [])):
            o["rooms"] = touching if len(touching) >= 2 else [touching[0], "outside"]
            kept_o.append(o)
    plan["openings"] = kept_o
    # (round 9) openings from adjacency: two rooms that touch across free space (a door gap, an open passage) share an
    #    opening; an indoor room that touches the outside across the envelope gap has an exterior door (the entrance)
    k3 = np.ones((5, 5), np.uint8)
    ids = [k for k in range(len(seeds)) if (claim == k + 1).any()]
    dil = {k: cv2.dilate((claim == k + 1).astype(np.uint8), k3) > 0 for k in ids}
    free_any = ~bar_r
    adj_openings = []
    def seg_from(mask):
        ys_, xs_ = np.nonzero(mask)
        if len(xs_) < 4:
            return None
        P = np.stack([xs_, ys_], 1).astype(float); mu = P.mean(0)
        _, sv, vt = np.linalg.svd(P - mu, full_matrices=False)
        if sv[0] > 0 and sv[1] / sv[0] > 0.18:
            return None                       # not a straight contact (an L around a corner): no opening line
        dvec = vt[0]; t_ = (P - mu) @ dvec
        A, B = mu + t_.min() * dvec, mu + t_.max() * dvec
        return [tp(Mi, A[0], A[1]), tp(Mi, B[0], B[1])]
    outside_free = outside.copy()
    for i, a_ in enumerate(ids):
        for b_ in ids[i + 1:]:
            if seeds[a_].get("is_outdoor") and seeds[b_].get("is_outdoor"):
                continue
            contact = dil[a_] & dil[b_] & free_any
            if not contact.any():
                continue
            n_c, l_c = cv2.connectedComponents(contact.astype(np.uint8), connectivity=8)
            for c in range(1, n_c):
                cm_ = l_c == c
                seg = seg_from(cm_)
                if not seg:
                    continue
                L_ = math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) * F / ppc
                if L_ < 55 or L_ > 300:
                    continue
                adj_openings.append({"rooms": [seeds[a_]["room_id"], seeds[b_]["room_id"]], "seg": seg, "width_cm": round(L_, 1), "kind": "opening" if L_ > 140 else "door"})
        contact = dil[a_] & outside_free & ~env_r if (ent is not None and seeds[a_] is ent) else None   # the entrance's door only
        if contact is not None and contact.any():
            n_c, l_c = cv2.connectedComponents(contact.astype(np.uint8), connectivity=8)
            for c in range(1, n_c):
                seg = seg_from(l_c == c)
                if not seg:
                    continue
                L_ = math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) * F / ppc
                if 55 <= L_ <= 260:
                    adj_openings.append({"rooms": [seeds[a_]["room_id"], "outside"], "seg": seg, "width_cm": round(L_, 1), "kind": "door"})
    plan["openings"] = [o for o in plan.get("openings", []) if o.get("source") != "auto_rooms adjacency"]
    for i, o in enumerate(adj_openings):
        (ax_, ay_), (bx_, by_) = o["seg"]
        a_cm = [round(ax_ * F / ppc, 1), round(ay_ * F / ppc, 1)]; b_cm = [round(bx_ * F / ppc, 1), round(by_ * F / ppc, 1)]
        plan["openings"].append({"id": f"o-adj-{i + 1}", "kind": o["kind"], "rooms": o["rooms"], "a_cm": a_cm, "b_cm": b_cm,
                                 "centre_cm": [round((a_cm[0] + b_cm[0]) / 2, 1), round((a_cm[1] + b_cm[1]) / 2, 1)],
                                 "angle_deg": round(math.degrees(math.atan2(b_cm[1] - a_cm[1], b_cm[0] - a_cm[0])), 1), "width_cm": o["width_cm"],
                                 "sill_cm": 0, "head_cm": 215, "source": "auto_rooms adjacency"})
    notes.append(f"{len(adj_openings)} opening(s) from room adjacency")
    # 6. polygons
    old = {r["id"]: r for r in plan["rooms"]}
    rooms = []
    for k, s in enumerate(seeds):
        m = claim == k + 1
        if not m.any():
            continue
        loop = mask_poly(m, bar_r, Mi, ppc)
        if not loop:
            continue
        g = Polygon(loop)
        o = old.get(s["room_id"], {})
        xs_, ys_ = zip(*loop)
        rooms.append({"id": s["room_id"], "name_he": s.get("name_he"), "name_en": s.get("name_en"), "type": s.get("type"), "is_outdoor": bool(s.get("is_outdoor")),
                      "roofed": o.get("roofed") if s.get("is_outdoor") else None, "loop": loop, "printed_dims_cm": s.get("dims_cm"),
                      "clear_dims_cm": [round(max(xs_) - min(xs_), 1), round(max(ys_) - min(ys_), 1)], "bbox_cm": [round(min(xs_), 1), round(min(ys_), 1), round(max(xs_), 1), round(max(ys_), 1)],
                      "area_m2": round(g.area / 1e4, 3), "source": "auto_rooms: printed rectangle snapped to the walls" if k in rect_of else ("auto_rooms: leftover space" if not s.get("is_outdoor") else "auto_rooms: outdoor around its label"),
                      "auto_reason": s.get("auto_reason"), "label_moved_inside": bool(pts.get(k, (0, 0, False))[2])})
    plan["rooms"] = rooms
    # one camera per room (auto_finalize moves it to the room's pole of inaccessibility)
    plan["camera_points"] = [{"id": f"cp-{r['id'][2:] if r['id'].startswith('r-') else r['id']}", "room_id": r["id"], "x": round(Polygon(r["loop"]).centroid.x, 1),
                              "y": round(Polygon(r["loop"]).centroid.y, 1), "z": 160, "yaw_deg": 0.0, "note": "auto_rooms"} for r in rooms]
    plan.setdefault("plan_meta", {})["rooms_method"] = f"auto_rooms.py: orthogonal (axis {a_used:.1f} deg), printed rectangles snapped to the walls, leftover joined"
    plan["plan_meta"]["entrance_door_px"] = [round(v, 1) for v in tp(Mi, *door_px)] if door_px else None
    json.dump(plan, open(os.path.join(d, "plan.general.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(seeds, open(os.path.join(d, "seeds.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"axis_deg": a_used, "rects": {seeds[k]["id"]: v for k, v in rect_of.items()}, "notes": notes}, open(os.path.join(d, "rooms.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    vis = cv2.cvtColor((bar_r * 80).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    rng = np.random.default_rng(5)
    cols = rng.integers(60, 255, (len(seeds) + 2, 3)).astype(np.uint8)
    for k in range(len(seeds)):
        vis[claim == k + 1] = cols[k + 1]
    cv2.imwrite(os.path.join(d, "rooms-debug.png"), vis)
    print(f"auto_rooms: {len(rooms)} rooms (axis {a_used:.1f} deg), {len(rect_of)} printed rectangles, {sum(v['snapped'] for v in rect_of.values())} snapped; {len(notes)} notes")


def ent_k_has_room(seeds, claim, ent):
    k = seeds.index(ent)
    return bool((claim == k + 1).any())


if __name__ == "__main__":
    main()
