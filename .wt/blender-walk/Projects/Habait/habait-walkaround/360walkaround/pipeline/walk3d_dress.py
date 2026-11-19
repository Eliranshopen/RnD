"""walk3d_dress.py — the 3D walk's apartment dressed AFTER THE TOUR (2026-11-12, Eliran: «זה ממש לא נראה כמו בהדמיה … כן אבל חשוב
שתיהיה עקביות … ולא נגיע למצב שהרהיטים ישתנו בין התמונות»). Stage A, $0: the catalogue pieces of the entrance, living room, dining
corner and kitchen are replaced by pieces BUILT to the tour's look, each modelled ONCE after ONE reference picture (consistency):

  kitchen (02-kitchen):   ONE L of handleless sand-grey lacquer fronts (fine seams, no handles), a thin brushed-steel worktop, a black
                          induction hob ~120 cm from the facade corner with a black oven under it, an integrated sink ~85 cm from the tall
                          column, the tall sand-grey fridge column; the plan model's own steel splashback + two shelves stay
  dining (03-dining):     a round light-oak pedestal table Ø120 cm, six cream boucle chairs with oak legs, a white "cloud" pendant
  living (01-entrance):   a cream boucle L sectional with a chaise at the window end and taupe cushions, a round boucle swivel armchair,
                          a round travertine pedestal coffee table, a cream rug, a floating sand-grey TV console with a black TV above
                          it, a floor lamp with a cream drum shade; the TV wall in greige textured plaster
  entrance (01-entrance): an open light-oak console where the catalogue console stood

Positions and sizes come from the plan's fixtures (`plan.json` fixtures[]: k-counter, k-counter-2, k-tall, d-table, l-sofa,
l-armchair, l-coffee, l-tv) and, for pieces the plan does not draw, from the catalogue piece they replace. Walls, openings and the
plan's geometry are never touched (sales-plan fidelity). No skirting boards (rule). $0, deterministic.

  blender -b <look.blend> --factory-startup -P walk3d_dress.py -- --plan <apt846-furnished/plan.json> --out <dressed.blend>
"""
import bpy, bmesh, sys, json, math, argparse
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser(); ap.add_argument('--plan', required=True); ap.add_argument('--out', required=True)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
plan = json.load(open(a.plan, encoding='utf-8')); FX = {f['id']: f for f in plan['fixtures']}
log = lambda *x: print('[dress]', *x, flush=True)
W = lambda p: Vector((p[0] / 100.0, -p[1] / 100.0, 0.0))   # plan cm (y down) -> world m (y up)
coll = bpy.data.collections.new('WALK3D_DRESS'); bpy.context.scene.collection.children.link(coll)

# ---------- materials
def mat(name, rgb, rough=0.6, metal=0.0, bump=0.0, bump_scale=300.0, noise_col=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if bump or noise_col:
        tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = bump_scale; nz.inputs['Detail'].default_value = 6
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        if bump:
            bn = nt.nodes.new('ShaderNodeBump'); bn.inputs['Strength'].default_value = bump; bn.inputs['Distance'].default_value = 0.002
            nt.links.new(nz.outputs['Fac'], bn.inputs['Height']); nt.links.new(bn.outputs['Normal'], b.inputs['Normal'])
        if noise_col:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['Factor'].default_value = noise_col
            mx.inputs['A'].default_value = (*rgb, 1); mx.inputs['B'].default_value = (rgb[0] * 0.86, rgb[1] * 0.84, rgb[2] * 0.82, 1)
            nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 6; nz2.inputs['Detail'].default_value = 8
            nt.links.new(tc.outputs['Object'], nz2.inputs['Vector']); nt.links.new(nz2.outputs['Fac'], mx.inputs['Factor'])
            nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])
    return m
LACQ = mat('M_dress_lacquer_sand', (0.50, 0.46, 0.41), rough=0.42)
SEAM = mat('M_dress_seam', (0.12, 0.11, 0.10), rough=0.8)
STEEL = mat('M_dress_steel', (0.55, 0.55, 0.54), rough=0.3, metal=1.0)
BLACK = mat('M_dress_black_gloss', (0.015, 0.015, 0.016), rough=0.12)   # not named 'glass': the bake sets glass apart unbaked
BOUCLE = mat('M_dress_boucle_cream', (0.76, 0.71, 0.62), rough=0.95, bump=0.35, bump_scale=420)
TAUPE = mat('M_dress_cushion_taupe', (0.50, 0.42, 0.34), rough=0.9, bump=0.2, bump_scale=300)
TRAV = mat('M_dress_travertine', (0.70, 0.62, 0.50), rough=0.55, bump=0.15, bump_scale=90, noise_col=0.6)
RUG = mat('M_dress_rug_cream', (0.66, 0.60, 0.50), rough=1.0, bump=0.5, bump_scale=160)
WHITE = mat('M_dress_white', (0.86, 0.85, 0.82), rough=0.6)
SHADE = mat('M_dress_shade_cream', (0.85, 0.80, 0.70), rough=0.8)
BRASS = mat('M_dress_brass', (0.55, 0.42, 0.24), rough=0.35, metal=1.0)
PLASTER = mat('M_dress_plaster_greige', (0.56, 0.50, 0.43), rough=0.9, bump=0.45, bump_scale=55, noise_col=0.5)
OAK = bpy.data.materials.get('M_wood_oak') or mat('M_dress_oak', (0.55, 0.40, 0.26), rough=0.5)

# ---------- geometry helpers (world metres)
def obj(name, bm, m, bevel=0.0):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); coll.objects.link(o); me.materials.append(m)
    for p in me.polygons: p.use_smooth = bevel > 0
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 3; mod.limit_method = 'ANGLE'
    return o
def prism(name, pts, z0, z1, m, bevel=0.0):   # pts: world xy (counter-clockwise or not)
    bm = bmesh.new(); vs0 = [bm.verts.new((p.x, p.y, z0)) for p in pts]; vs1 = [bm.verts.new((p.x, p.y, z1)) for p in pts]
    bm.faces.new(vs1); bm.faces.new(list(reversed(vs0)))
    for i in range(len(pts)): j = (i + 1) % len(pts); bm.faces.new((vs0[i], vs0[j], vs1[j], vs1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return obj(name, bm, m, bevel)
def box(name, c, ux, w, d, z0, z1, m, bevel=0.0):   # centre c (world xy), unit axis ux along w, d across
    uy = Vector((-ux.y, ux.x, 0)); hw, hd = w / 2, d / 2
    return prism(name, [c + ux * sx * hw + uy * sy * hd for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))], z0, z1, m, bevel)
def cyl(name, c, r, z0, z1, m, seg=48, bevel=0.0, arc=360.0, start=0.0, ring=0.0):
    pts = []
    n = seg if arc >= 360 else seg + 1
    for i in range(n):
        t = math.radians(start + arc * i / (seg if arc >= 360 else seg)); pts.append(c + Vector((math.cos(t), math.sin(t), 0)) * r)
    if ring:   # a curved back: the arc's outer edge, then back along the inner edge
        pts = pts + [c + (p - c).normalized() * (r - ring) for p in reversed(pts)]
    return prism(name, pts, z0, z1, m, bevel)
def fx_frame(fid):   # a fixture's centre and its long axis (world), length and depth (m)
    f = FX[fid]; P = [W(p) for p in f['polygon_cm']]; c = sum(P, Vector()) / 4
    e = [(P[(i + 1) % 4] - P[i]) for i in range(4)]; L = max(e, key=lambda v: v.length)
    return c, L.normalized(), max(v.length for v in e), min(v.length for v in e), P

# ---------- 1. the catalogue pieces of these rooms go
GONE = ('kitchenCabinet', 'kitchenSink', 'kitchenStoveElectric', 'kitchenFridge', 'doorFridge', 'doorFreezer', 'hoodModern', 'chairModernCushion',
        'table(Clone)', 'loungeDesignSofa', 'modern_arm_chair_01', 'modern_coffee_table_01', 'lampRoundFloor', 'rugRectangle', 'cabinetTelevision',
        'televisionModern')
drop = {o for o in bpy.data.objects if o.name.startswith(GONE)}
def kids(o): return [c for c in bpy.data.objects if c.parent == o]
stack = list(drop)
while stack:
    for c in kids(stack.pop()):
        if c not in drop: drop.add(c); stack.append(c)
console_bb = None
cat = bpy.data.objects.get('cabinetTelevision(Clone).002')
if cat: console_bb = [cat.matrix_world @ Vector(c) for c in cat.bound_box]
for o in drop: bpy.data.objects.remove(o, do_unlink=True)
log('catalogue pieces removed:', len(drop))

# ---------- 2. kitchen
c, ux, L, D, P = fx_frame('k-counter')
# the back edge = the long edge nearer the partition (farther from the room's middle: the dining table side is the front)
dt = W(FX['d-table']['centre_cm']); uy = Vector((-ux.y, ux.x, 0))
front = uy if (dt - c).dot(uy) > 0 else -uy
north = ux if (W((865.11, 277.2)) - c).dot(ux) > 0 else -ux   # the facade-corner end (hob side)
prism('DRESS_kitchen_run', P, 0.0, 0.86, LACQ)
box('DRESS_kitchen_run_top', c + front * 0.01, ux, L + 0.01, D + 0.02, 0.86, 0.892, STEEL)
for i in range(1, int(L / 0.6)):   # door seams on the front face
    s = c + north * (-L / 2 + i * L / int(L / 0.6)) + front * (D / 2 + 0.001)
    box('DRESS_kitchen_seam_%d' % i, s, front, 0.004, 0.004, 0.10, 0.84, SEAM)
box('DRESS_kitchen_plinth_shadow', c + front * (D / 2 - 0.04), ux, L, 0.02, 0.0, 0.09, SEAM)
hob = c + north * (L / 2 - 1.20) + front * 0.02
box('DRESS_kitchen_hob', hob, ux, 0.60, 0.52, 0.892, 0.898, BLACK)
box('DRESS_kitchen_oven', hob + front * (D / 2 - 0.005), ux, 0.58, 0.012, 0.16, 0.74, BLACK)
sink = c - north * (L / 2 - 0.85) + front * 0.02
box('DRESS_kitchen_sink', sink, ux, 0.50, 0.40, 0.886, 0.893, BLACK)
cyl('DRESS_kitchen_tap', sink - front * 0.24, 0.012, 0.89, 1.18, STEEL, seg=12)
c2, ux2, L2, D2, P2 = fx_frame('k-counter-2')
prism('DRESS_kitchen_leg', P2, 0.0, 0.86, LACQ); prism('DRESS_kitchen_leg_top', P2, 0.86, 0.892, STEEL)
c3, ux3, L3, D3, P3 = fx_frame('k-tall')
prism('DRESS_kitchen_tall', P3, 0.0, 2.20, LACQ)
box('DRESS_kitchen_tall_seam', c3 + front * (min(L3, D3) / 2 + 0.002), ux, 0.6, 0.004, 1.30, 1.304, SEAM)
log('kitchen built: run %.2f m, leg %.2f m, tall column' % (L, L2))

# ---------- 3. dining
dc = W(FX['d-table']['centre_cm'])
cyl('DRESS_dining_base', dc, 0.24, 0.0, 0.04, OAK, bevel=0.01); cyl('DRESS_dining_post', dc, 0.11, 0.04, 0.72, OAK)
cyl('DRESS_dining_top', dc, 0.60, 0.72, 0.76, OAK, seg=64, bevel=0.012)
for i in range(6):
    t = math.radians(30 + 60 * i); out = Vector((math.cos(t), math.sin(t), 0)); cc = dc + out * 0.78
    box('DRESS_dining_seat_%d' % i, cc, Vector((-out.y, out.x, 0)), 0.48, 0.46, 0.40, 0.48, BOUCLE, bevel=0.03)
    cyl('DRESS_dining_back_%d' % i, cc, 0.27, 0.48, 0.84, BOUCLE, seg=14, arc=150, start=math.degrees(t) - 75, ring=0.07, bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lp = cc + out * 0.17 * sx + Vector((-out.y, out.x, 0)) * 0.18 * sy
            cyl('DRESS_dining_leg_%d' % i, lp, 0.016, 0.0, 0.40, OAK, seg=10)
pend = bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(dc.x, dc.y, 2.02))
po = bpy.context.active_object; po.name = 'DRESS_dining_pendant'; po.scale = (0.38, 0.32, 0.10)
for col in po.users_collection: col.objects.unlink(po)
coll.objects.link(po); po.data.materials.append(WHITE); [setattr(p, 'use_smooth', True) for p in po.data.polygons]
cyl('DRESS_dining_cable', dc, 0.004, 2.1, 2.9, BLACK, seg=8)
log('dining built at', tuple(round(v, 2) for v in dc))

# ---------- 4. living
sc, sx_, SL, SD, SP = fx_frame('l-sofa'); suy = Vector((-sx_.y, sx_.x, 0))
cof = W(FX['l-coffee']['centre_cm']); sfront = suy if (cof - sc).dot(suy) > 0 else -suy
win = sx_ if sx_.x > 0 else -sx_   # the window end of the sofa (east, larger x)
L_ = 2.70; D_ = 0.98; back = sc - sfront * (D_ / 2 - 0.12)
box('DRESS_sofa_seat', sc, sx_, L_, D_, 0.0, 0.42, BOUCLE, bevel=0.06)
box('DRESS_sofa_back', back, sx_, L_ - 0.02, 0.24, 0.30, 0.78, BOUCLE, bevel=0.07)
box('DRESS_sofa_arm', sc - win * (L_ / 2 - 0.12), sfront, D_, 0.24, 0.30, 0.62, BOUCLE, bevel=0.07)
chaise = sc + win * (L_ / 2 - 0.50) + sfront * (D_ / 2 + 0.32)
box('DRESS_sofa_chaise', chaise, sx_, 1.0, 0.70, 0.0, 0.42, BOUCLE, bevel=0.06)
for i, (off, h) in enumerate(((-0.85, 0.0), (-0.45, 0.02), (0.15, 0.0), (0.55, 0.03))):
    cu = back + sx_ * off + sfront * 0.16
    o = box('DRESS_sofa_cushion_%d' % i, cu, sx_, 0.48, 0.14, 0.44, 0.88 + h, TAUPE if i % 2 == 0 else BOUCLE, bevel=0.05)
    o.rotation_mode = 'XYZ'
ac = W(FX['l-armchair']['centre_cm']); to_sofa = (sc - ac).normalized(); ang = math.degrees(math.atan2(to_sofa.y, to_sofa.x))
cyl('DRESS_armchair_seat', ac, 0.44, 0.0, 0.42, BOUCLE, seg=40, bevel=0.05)
cyl('DRESS_armchair_back', ac, 0.46, 0.38, 0.74, BOUCLE, seg=30, arc=230, start=ang + 65, ring=0.16, bevel=0.06)
cyl('DRESS_coffee_base', cof, 0.32, 0.0, 0.34, TRAV, seg=56, bevel=0.01); cyl('DRESS_coffee_top', cof, 0.55, 0.34, 0.40, TRAV, seg=64, bevel=0.015)
rc = (sc + cof) / 2 + sfront * 0.25
box('DRESS_rug', rc, sx_, 3.0, 2.2, 0.0, 0.012, RUG)
tc, tux, TL, TD, TP = fx_frame('l-tv'); tuy = Vector((-tux.y, tux.x, 0)); tfront = tuy if (sc - tc).dot(tuy) > 0 else -tuy
wallback = tc - tfront * (TD / 2)   # the TV wall's face
box('DRESS_tv_console', wallback + tfront * 0.21, tux, 2.40, 0.40, 0.22, 0.58, LACQ, bevel=0.01)
box('DRESS_tv_console_seam', wallback + tfront * 0.412, tux, 0.004, 0.004, 0.24, 0.56, SEAM)
box('DRESS_tv', wallback + tfront * 0.03, tux, 1.45, 0.04, 1.02, 1.84, BLACK)
lamp = wallback + tfront * 0.30 + (tux if tux.x > 0 else -tux) * 1.55
cyl('DRESS_lamp_base', lamp, 0.15, 0.0, 0.02, BRASS, seg=24); cyl('DRESS_lamp_pole', lamp, 0.012, 0.02, 1.30, BRASS, seg=10)
cyl('DRESS_lamp_shade', lamp, 0.22, 1.28, 1.60, SHADE, seg=40, ring=0.006)
# the TV wall: greige textured plaster on the wall faces along the TV unit's back edge (+ 1.2 m past each end: its rounded end)
n = 0
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(('FACING', 'WALL', 'INFILL'))]:
    me = o.data; mw = o.matrix_world; idx = None
    for p in me.polygons:
        q = mw @ p.center; rel = q - wallback; along = rel.dot(tux); across = rel.dot(tfront)
        nrm = (mw.to_3x3() @ p.normal).normalized()
        if abs(along) < TL / 2 + 1.2 and -0.35 < across < 0.35 and 0.0 < q.z < 2.9 and nrm.dot(tfront) > 0.3:
            if idx is None:
                me.materials.append(PLASTER); idx = len(me.materials) - 1
            p.material_index = idx; n += 1
log('TV wall faces in greige plaster:', n)

# ---------- 4b. sheer curtains (every tour picture shows them): a gathered cream sheer at each end of every facade glass pane, 12 cm
# inside the glass, floor to ceiling; the folds are a wave bump. Interior side = towards the room the pane belongs to.
SHEER = mat('M_dress_sheer', (0.86, 0.82, 0.74), rough=0.9)
nt = SHEER.node_tree; bsdf = nt.nodes['Principled BSDF']; wv = nt.nodes.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 40; wv.bands_direction = 'X'
tc2 = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc2.outputs['Object'], wv.inputs['Vector'])
bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6; nt.links.new(wv.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])
centre = W((sum(p[0] for r in plan['rooms'] for p in r['loop']) / sum(len(r['loop']) for r in plan['rooms']), sum(p[1] for r in plan['rooms'] for p in r['loop']) / sum(len(r['loop']) for r in plan['rooms'])))
nc = 0
for g in [o for o in bpy.data.objects if o.name.startswith('GLASS_facade')]:
    vs = [g.matrix_world @ v.co for v in g.data.vertices]; zs = [v.z for v in vs]
    if max(zs) - min(zs) < 1.5: continue   # railings, not windows
    flat = [Vector((v.x, v.y, 0)) for v in vs]
    p0 = min(flat, key=lambda v: (v - flat[0]).length); far = max(flat, key=lambda v: (v - flat[0]).length)
    run = far - flat[0]; Lg = run.length
    if Lg < 0.5: continue
    ug = run.normalized(); ng = Vector((-ug.y, ug.x, 0)); mid = (flat[0] + far) / 2
    if (centre - mid).dot(ng) < 0: ng = -ng
    for end in (0.0, 1.0):
        cpos = flat[0] + run * end + ug * (0.18 if end == 0 else -0.18) + ng * 0.14
        box('DRESS_sheer_%d' % nc, cpos, ug, 0.34, 0.10, 0.02, min(2.85, max(zs) + 0.02), SHEER, bevel=0.03); nc += 1
log('sheer curtains:', nc)

# ---------- 5. entrance console (where the catalogue console stood)
if console_bb:
    xs = [v.x for v in console_bb]; ys = [v.y for v in console_bb]; cc = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 0))
    ux_c = Vector((1, 0, 0)) if (max(xs) - min(xs)) > (max(ys) - min(ys)) else Vector((0, 1, 0)); Lc = max(max(xs) - min(xs), max(ys) - min(ys)); Dc = 0.36
    for nm_, z0, z1 in (('top', 0.72, 0.76), ('shelf', 0.10, 0.13)): box('DRESS_console_' + nm_, cc, ux_c, Lc, Dc, z0, z1, OAK)
    for s_ in (-1, 1): box('DRESS_console_side_%d' % s_, cc + ux_c * s_ * (Lc / 2 - 0.02), ux_c, 0.04, Dc, 0.0, 0.76, OAK)
    log('entrance console built, length %.2f m' % Lc)

# apply the bevels so the bake and the export see the final shapes
for o in coll.objects:
    if o.modifiers:
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        for m_ in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m_.name)
        o.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=a.out); log('saved', a.out, len(coll.objects), 'pieces'); print('WALK3D_DRESS_OK')
