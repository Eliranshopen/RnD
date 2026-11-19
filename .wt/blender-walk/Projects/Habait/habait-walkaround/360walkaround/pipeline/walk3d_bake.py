"""walk3d_bake.py — the 3D WALK's scene: the look-pass apartment with its daylight BAKED into texture atlases, exported for the browser
(2026-11-12, Eliran: «אני רוצה תחושה אמיתית של הליכה בדירה לפי החיצים שאני אזיז» → path 1, the plan-exact model, $0).

Three stages, each one bounded Blender run (CPU Cycles; root §12):
  blender -b <look.blend> --factory-startup -P walk3d_bake.py -- --stage prep   --dir <work> [--groups 6] [--size 4096]
  blender -b <work>/prep.blend --factory-startup -P walk3d_bake.py -- --stage bake --dir <work> --group K [--samples 128]
  blender -b <work>/prep.blend --factory-startup -P walk3d_bake.py -- --stage export --dir <work>

prep: the laundry niche EMPTY with no door (Eliran 2026-11-12: the closet box `CLOSET_l-laundry_*` and the fixture prism under it go),
      every hidden object (skirting boards, swapped pieces) deleted, glass and plants set apart (they are not baked), every other mesh
      given a `bake` UV map, packed per group so a group shares ONE atlas; an image node per group in every material.
bake: Cycles DIFFUSE (direct + indirect + colour) of group K into `<work>/bake_K.exr`; glass hidden so the daylight comes in.
export: each atlas denoised (compositor, OIDN) and saved through the scene's view transform (AgX, the look's exposure) as display
      colour JPEG at full size and at 2048; the baked meshes get one unlit-ready material per group on the `bake` UV only; plants keep
      their own materials; glass gets a light tint; one glTF (`walk3d.gltf` + bin + jpgs) for three.js (+Y up).
Geometry is never edited except the two removals the ruling names (sales-plan fidelity). $0, deterministic for the same inputs.
"""
import bpy, bmesh, sys, os, json, math, argparse
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument('--stage', required=True, choices=('prep', 'bake', 'geom', 'export')); ap.add_argument('--dir', required=True)
ap.add_argument('--groups', type=int, default=6); ap.add_argument('--size', type=int, default=4096)
ap.add_argument('--group', type=int, default=-1); ap.add_argument('--samples', type=int, default=128)
ap.add_argument('--exposure', type=float, default=None, help='export: the display exposure (default: the look pass exposure)'); ap.add_argument('--look', default=None, help='export: an AgX look (default: the scene look)'); ap.add_argument('--view', default=None, help='export: a view transform (Standard keeps colour where AgX washes out a bright bake)')
ap.add_argument('--atlas-from', default=None, help='export: take <dir>/bake_K.jpg as the atlases (the tour-picture projection, walk3d-project.py) instead of denoising the light bake')
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
W = os.path.abspath(a.dir); os.makedirs(W, exist_ok=True)
log = lambda *x: print('[walk3d]', *x, flush=True)
GLASS = lambda o: o.name.startswith('GLASS') or any(s.material and 'glass' in s.material.name.lower() and 'mirror' not in s.material.name.lower() for s in o.material_slots)
PLANT = lambda o: o.name.startswith('potted')
# the laundry niche (plan cm, raster frame) -> world metres (x/100, -y/100)
NICHE = [(226.09, 1128.47), (292.16, 1149.9), (313.59, 1083.83), (247.52, 1062.4)]

def inside(pt, poly, pad=0.06):
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    poly = [(cx + (x - cx) * (1 + pad / max(0.01, math.hypot(x - cx, y - cy))), cy + (y - cy) * (1 + pad / max(0.01, math.hypot(x - cx, y - cy)))) for x, y in poly]
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > pt[1]) != (yj > pt[1]) and pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi + 1e-12) + xi: c = not c
        j = i
    return c

def cycles(samples):
    s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = False; s.render.use_persistent_data = True
    s.cycles.max_bounces = 6; s.cycles.diffuse_bounces = 4; s.cycles.glossy_bounces = 2; s.cycles.transmission_bounces = 4
    s.cycles.sample_clamp_indirect = 8.0

if a.stage == 'prep':
    gone = 0
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (o.hide_render or o.name.startswith('CLOSET_l-laundry')):
            bpy.data.objects.remove(o, do_unlink=True); gone += 1
    log('deleted hidden + laundry closet objects:', gone)
    world_niche = [(x / 100, -y / 100) for x, y in NICHE]
    for o in [o for o in bpy.data.objects if o.name.startswith('FIXTURE_')]:
        bm = bmesh.new(); bm.from_mesh(o.data); mw = o.matrix_world
        kill = [f for f in bm.faces if inside(((mw @ f.calc_center_median()).x, (mw @ f.calc_center_median()).y), world_niche)]
        if kill:
            bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); log('niche faces removed from', o.name, len(kill))
        bm.free()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    def area(o):
        sc = o.matrix_world.to_scale(); k = abs(sc.x * sc.y * sc.z) ** (2 / 3)
        return sum(p.area for p in o.data.polygons) * k
    ENV = lambda o: area(o) > 1500   # the ground far below the 16th floor: not baked, lit in the browser
    for o in meshes:
        o['walk3d'] = 'glass' if GLASS(o) else 'plant' if PLANT(o) else 'env' if ENV(o) else 'bake'
        if o['walk3d'] == 'env': log('environment (not baked):', o.name, round(area(o)))
    bake = [o for o in meshes if o['walk3d'] == 'bake']
    # single-user data, so a UV map on one object never lands on another; an object with no material gets a plain grey one
    grey = bpy.data.materials.new('M_walk3d_grey'); grey.use_nodes = True
    for o in bake:
        if o.data.users > 1: o.data = o.data.copy()
        if not o.material_slots or not any(s.material for s in o.material_slots): o.data.materials.clear(); o.data.materials.append(grey)
    # a DIFFUSE bake of a metal is black (a metal has no diffuse colour: the fridge came out a black slab, 2026-11-12): every baked
    # material is made non-metallic, keeping its colour; the reflections a metal would show are not in a diffuse bake anyway
    nm = 0
    for m in {s.material for o in bake for s in o.material_slots if s.material and s.material.use_nodes}:
        for n in m.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeBsdfPrincipled':
                for l in list(n.inputs['Metallic'].links): m.node_tree.links.remove(l)
                if n.inputs['Metallic'].default_value > 0: nm += 1
                n.inputs['Metallic'].default_value = 0.0
    log('materials made non-metallic for the bake:', nm)
    # surface area per object -> greedy groups of similar area (one atlas each)
    ar = sorted(((area(o), o) for o in bake), key=lambda t: -t[0])
    G = [[0.0, []] for _ in range(a.groups)]
    for s_, o in ar:
        g = min(G, key=lambda t: t[0]); g[0] += s_; g[1].append(o)
    log('groups (m2, objects):', [(round(g[0], 1), len(g[1])) for g in G])
    for k, (s_, objs) in enumerate(G):
        # ONE object per group (Cycles re-syncs the scene for every baked object: 67 objects = minutes even at 512 px). Before the join
        # each mesh's render UV map is named 'UVMap', so the join keeps every textured piece on its own texture coordinates.
        for o in objs:
            if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
            ren = next((u for u in o.data.uv_layers if u.active_render), o.data.uv_layers[0])
            for u in o.data.uv_layers:
                if u != ren and u.name == 'UVMap': u.name = 'UVMap_other'
            ren.name = 'UVMap'
            for u in [u for u in o.data.uv_layers if u.name != 'UVMap']: o.data.uv_layers.remove(u)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.hide_viewport = False; o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.convert(target='MESH')   # modifiers applied
        bpy.ops.object.join(); j = bpy.context.view_layer.objects.active; j.name = 'WALK3D_group_%d' % k; j.parent = None
        j['walk3d'] = 'bake'; j['walk3d_group'] = k; objs = [j]
        j.data.uv_layers.new(name='bake'); j.data.uv_layers['UVMap'].active_render = True; j.data.uv_layers.active = j.data.uv_layers['bake']
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        # island_margin 0 + scale_to_bounds: measured 2026-11-12 on group 0 (9,669 faces): margin 0 -> 59 % of the atlas used,
        # 0.0005 -> 26 %, 0.001 -> 15 %, 0.002 -> 9 % (every island pays the margin); pack_islands is a no-op in a background run.
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode='OBJECT')
        img = bpy.data.images.new('bake_%d' % k, a.size, a.size, float_buffer=True, alpha=False)
        mats = {s.material for o in objs for s in o.material_slots if s.material}
        for m in mats:
            m.use_nodes = True
            n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.name = 'WALK3D_BAKE_%d' % k; n.image = img; n.label = n.name
        log('group', k, 'objects', len(objs), 'materials', len(mats))
    json.dump({'groups': a.groups, 'size': a.size}, open(os.path.join(W, 'prep.json'), 'w'))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(W, 'prep.blend')); log('saved prep.blend'); print('WALK3D_PREP_OK')

elif a.stage == 'bake':
    k = a.group; cycles(a.samples)
    for o in bpy.data.objects:
        if o.get('walk3d') == 'glass': o.hide_render = True   # the daylight comes in through the openings
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]
    for m in bpy.data.materials:
        if m.node_tree and ('WALK3D_BAKE_%d' % k) in m.node_tree.nodes: m.node_tree.nodes.active = m.node_tree.nodes['WALK3D_BAKE_%d' % k]
    for o in objs: o.data.uv_layers.active = o.data.uv_layers['bake']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    b = bpy.context.scene.render.bake; b.margin = 8; b.use_clear = True; b.target = 'IMAGE_TEXTURES'
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=8, use_clear=True)
    img = bpy.data.images['bake_%d' % k]
    img.filepath_raw = os.path.join(W, 'bake_%d.exr' % k); img.file_format = 'OPEN_EXR'; img.save()
    log('baked group', k, len(objs), 'objects ->', img.filepath_raw); print('WALK3D_BAKE_OK')

elif a.stage == 'geom':
    # 2026-11-12 (Eliran: the walk in the TOUR'S OWN look): per atlas texel its world position and normal, for walk3d-project.py to
    # colour from the tour pictures. Position / normal bakes need one sample; dumped as float32 .npy (rows bottom-up, Blender order).
    import numpy as np
    k = a.group; cycles(1)
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]
    for o in objs: o.data.uv_layers.active = o.data.uv_layers['bake']
    img = bpy.data.images['bake_%d' % k]
    for m in bpy.data.materials:
        if m.node_tree and ('WALK3D_BAKE_%d' % k) in m.node_tree.nodes: m.node_tree.nodes.active = m.node_tree.nodes['WALK3D_BAKE_%d' % k]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for kind in ('POSITION', 'NORMAL'):
        b = bpy.context.scene.render.bake; b.margin = 4; b.use_clear = True; b.target = 'IMAGE_TEXTURES'
        if kind == 'NORMAL': b.normal_space = 'OBJECT'   # joined groups carry an identity transform: object space = world space
        img.pixels.foreach_set(np.zeros(img.size[0] * img.size[1] * 4, dtype=np.float32))
        bpy.ops.object.bake(type=kind, margin=4, use_clear=True)
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(px)
        np.save(os.path.join(W, 'geom_%s_%d.npy' % (kind.lower(), k)), px.reshape(img.size[1], img.size[0], 4))
        log('geom', kind, 'group', k, 'saved')
    print('WALK3D_GEOM_OK')

else:  # export
    cfg = json.load(open(os.path.join(W, 'prep.json'))); s = bpy.context.scene
    # denoise each atlas in a compositor-only scene, then save through the look's view transform as display colour
    dn = bpy.data.scenes.new('walk3d_denoise'); dn.use_nodes = True; nt = dn.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    dn.view_settings.view_transform = s.view_settings.view_transform; dn.view_settings.look = s.view_settings.look
    dn.view_settings.exposure = s.view_settings.exposure if a.exposure is None else a.exposure; dn.view_settings.gamma = s.view_settings.gamma
    if a.view: dn.view_settings.view_transform = a.view
    if a.look: dn.view_settings.look = a.look
    log('display: view', dn.view_settings.view_transform, 'look', dn.view_settings.look, 'exposure', dn.view_settings.exposure)
    dn.render.image_settings.file_format = 'JPEG'; dn.render.image_settings.quality = 90
    for k in range(cfg['groups'] if not a.atlas_from else 0):
        src = bpy.data.images.load(os.path.join(W, 'bake_%d.exr' % k), check_existing=False)
        for n in list(nt.nodes): nt.nodes.remove(n)
        i = nt.nodes.new('CompositorNodeImage'); i.image = src
        d = nt.nodes.new('CompositorNodeDenoise'); d.prefilter = 'ACCURATE'
        c = nt.nodes.new('CompositorNodeComposite')
        nt.links.new(i.outputs['Image'], d.inputs['Image']); nt.links.new(d.outputs['Image'], c.inputs['Image'])
        dn.render.resolution_x, dn.render.resolution_y = src.size; dn.render.resolution_percentage = 100
        dn.render.filepath = os.path.join(W, 'gl', 'bake_%d.jpg' % k); os.makedirs(os.path.join(W, 'gl'), exist_ok=True)
        bpy.ops.render.render(write_still=True, scene=dn.name)
        small = bpy.data.images.load(dn.render.filepath, check_existing=False); small.scale(2048, 2048)
        small.filepath_raw = os.path.join(W, 'gl', 'bake_%d_2k.jpg' % k); small.file_format = 'JPEG'; small.save()
        log('atlas', k, 'denoised ->', dn.render.filepath)
    # the baked meshes: one material per group (base colour = the atlas on the bake UV), no other UV map
    for k in range(cfg['groups']):
        m = bpy.data.materials.new('WALK3D_baked_%d' % k); m.use_nodes = True; nt2 = m.node_tree
        b = next(n for n in nt2.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
        if a.atlas_from:
            os.makedirs(os.path.join(W, 'gl'), exist_ok=True); import shutil; shutil.copy(os.path.join(a.atlas_from, 'bake_%d.jpg' % k), os.path.join(W, 'gl', 'bake_%d.jpg' % k))
        t = nt2.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(W, 'gl', 'bake_%d.jpg' % k), check_existing=True)
        nt2.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 1.0
        for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d_group') == k]:
            for uv in [u for u in o.data.uv_layers if u.name != 'bake']: o.data.uv_layers.remove(uv)
            o.data.materials.clear(); o.data.materials.append(m)
    gm = bpy.data.materials.new('WALK3D_glass'); gm.use_nodes = True
    gb = next(n for n in gm.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'); gb.inputs['Base Color'].default_value = (0.85, 0.9, 0.92, 1); gb.inputs['Alpha'].default_value = 0.12
    for o in bpy.data.objects:
        if o.get('walk3d') == 'glass': o.data.materials.clear(); o.data.materials.append(gm); o.hide_render = False
    # the ground far below is left out: it would cover the city backdrop below the horizon (the backdrop carries the city)
    keep = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('walk3d') in ('bake', 'glass', 'plant')]
    for o in bpy.data.objects: o.select_set(o in keep)
    out = os.path.join(W, 'gl', 'walk3d.gltf')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLTF_SEPARATE', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88,
                              export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_extras=True)
    log('exported', out); print('WALK3D_EXPORT_OK')
