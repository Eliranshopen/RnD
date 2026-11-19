"""walk3d-grid.py — where a visitor may stand in the 3D walk (2026-11-12): the plan's free floor as a small PNG the browser reads.

  python -I walk3d-grid.py --plan <apt846-furnished>/plan.json --footprints <footprints.json> --out <dir> [--cell 5] [--clear 22]

Free floor = the rooms + every interior opening carved through its wall (the front door stays closed: no walking out of the flat)
minus the walls, the glass panes and every piece of furniture's footprint (walk_footprints.py on the same scene), then shrunk by
--clear cm so the eye never comes closer than that to a wall or a piece. Writes walk3d-grid.png (white = may stand) and
walk3d-grid.json {x0, y0, cell, w, h, start} in plan cm (x right, y down): the browser maps plan (x, y) to three.js (x/100, -, y/100).
"""
import json, math, argparse, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
ap = argparse.ArgumentParser()
ap.add_argument('--plan', required=True); ap.add_argument('--footprints', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--cell', type=float, default=5.0); ap.add_argument('--clear', type=float, default=22.0)
a = ap.parse_args(); C = a.cell; os.makedirs(a.out, exist_ok=True)
plan = json.load(open(a.plan, encoding='utf-8')); foot = json.load(open(a.footprints, encoding='utf-8'))['pieces']
xs = [p[0] for r in plan['rooms'] for p in r['loop']]; ys = [p[1] for r in plan['rooms'] for p in r['loop']]
X0, Y0 = min(xs) - 40, min(ys) - 40; GW, GH = int((max(xs) + 40 - X0) / C) + 1, int((max(ys) + 40 - Y0) / C) + 1
g = lambda pts: [((x - X0) / C, (y - Y0) / C) for x, y in pts]
inside = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(inside)
for r in plan['rooms']: d.polygon(g(r['loop']), fill=255, outline=255)
OPEN = []
for o in plan['openings']:
    if o['kind'] in ('window', 'entrance_door'): continue
    (ax_, ay_), (bx_, by_) = o['a_cm'], o['b_cm']; L = math.hypot(bx_ - ax_, by_ - ay_); ux, uy = (bx_ - ax_) / L, (by_ - ay_) / L; nx_, ny_ = -uy, ux; m = 4; t = 40
    OPEN.append([(ax_ + ux * m + nx_ * t, ay_ + uy * m + ny_ * t), (bx_ - ux * m + nx_ * t, by_ - uy * m + ny_ * t), (bx_ - ux * m - nx_ * t, by_ - uy * m - ny_ * t), (ax_ + ux * m - nx_ * t, ay_ + uy * m - ny_ * t)])
for q in OPEN: d.polygon(g(q), fill=255, outline=255)
inside = ndimage.binary_dilation(np.array(inside) > 0, iterations=2)
block = Image.new('L', (GW, GH), 0); d = ImageDraw.Draw(block)
for w in plan['walls']: d.polygon(g(w['polygon_cm']), fill=255, outline=255)
for p in plan['panes']: d.polygon(g(p['polygon_cm']), fill=255, outline=255)
for q in OPEN: d.polygon(g(q), fill=0, outline=0)
for f in foot:
    if len(f['poly']) >= 3: d.polygon(g(f['poly']), fill=255, outline=255)
free = inside & ~(np.array(block) > 0)
walk = ndimage.distance_transform_edt(free) * C >= a.clear
lab, n = ndimage.label(walk)
cam = next(c for c in plan['camera_points'] if c['id'] == 'cp-entrance')
r0, c0 = int(round((cam['y'] - Y0) / C)), int(round((cam['x'] - X0) / C))
if not walk[r0, c0]:   # the entrance spot may sit closer to a wall than --clear: start on the nearest walkable cell
    rr, cc = np.nonzero(walk); k = int(np.argmin((rr - r0) ** 2 + (cc - c0) ** 2)); r0, c0 = int(rr[k]), int(cc[k])
main = lab == lab[r0, c0]
Image.fromarray((main * 255).astype(np.uint8)).save(os.path.join(a.out, 'walk3d-grid.png'))
start = {'x': X0 + c0 * C, 'y': Y0 + r0 * C, 'yaw_deg': cam['yaw_deg']}
rooms = [{'id': r['id'], 'loop': [[round(x, 1), round(y, 1)] for x, y in r['loop']]} for r in plan['rooms']]
json.dump({'x0': X0, 'y0': Y0, 'cell': C, 'w': GW, 'h': GH, 'clear_cm': a.clear, 'start': start, 'rooms': rooms,
           'note': 'plan cm, x right, y down; white = a visitor may stand; three.js position = (x/100, eye, y/100)'}, open(os.path.join(a.out, 'walk3d-grid.json'), 'w'), indent=1)
print('grid', GW, 'x', GH, 'walkable cells', int(main.sum()), 'of', int(walk.sum()), 'start', start)
