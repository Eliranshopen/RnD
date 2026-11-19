"""build-walk3d.py — assemble the 3D walk page (2026-11-12) into one static folder for the test link's /walk3d/.

  python -I build-walk3d.py --gl <work>/gl --grid <dir with walk3d-grid.png/json> --out <site>/walk3d

Copies the page (walk3d/index.html, walk3d.js), three.js 0.170 from the platform's node_modules (three.module.min.js, GLTFLoader,
BufferGeometryUtils — the only modules the page imports; three's MIT licence kept beside them), the baked model (walk3d.gltf + bin +
jpgs; a `<name>_2k.jpg` beside each bake atlas for phones) and the free-floor grid. $0, no network.
"""
import argparse, os, shutil, glob
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('--gl', required=True); ap.add_argument('--grid', required=True); ap.add_argument('--out', required=True); ap.add_argument('--sky', default=None, help='the backdrop (walk3d-sky.py) -> model/sky.jpg'); ap.add_argument('--color', type=float, default=1.0); ap.add_argument('--contrast', type=float, default=1.0)
a = ap.parse_args(); HERE = os.path.dirname(os.path.abspath(__file__))
T = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/node_modules/three'
if os.path.exists(a.out): shutil.rmtree(a.out)
os.makedirs(os.path.join(a.out, 'vendor', 'jsm', 'loaders')); os.makedirs(os.path.join(a.out, 'vendor', 'jsm', 'utils')); os.makedirs(os.path.join(a.out, 'model'))
for f in ('index.html', 'walk3d.js'): shutil.copy(os.path.join(HERE, 'walk3d', f), a.out)
shutil.copy(os.path.join(T, 'build', 'three.module.min.js'), os.path.join(a.out, 'vendor'))
shutil.copy(os.path.join(T, 'LICENSE'), os.path.join(a.out, 'vendor', 'THREE-LICENSE.txt'))
shutil.copy(os.path.join(T, 'examples', 'jsm', 'loaders', 'GLTFLoader.js'), os.path.join(a.out, 'vendor', 'jsm', 'loaders'))
shutil.copy(os.path.join(T, 'examples', 'jsm', 'utils', 'BufferGeometryUtils.js'), os.path.join(a.out, 'vendor', 'jsm', 'utils'))
n = 0
for f in os.listdir(a.gl):
    if f.startswith('bake_') and f.endswith('_2k.jpg'): continue   # remade below from the exported atlas
    shutil.copy(os.path.join(a.gl, f), os.path.join(a.out, 'model')); n += 1
from PIL import ImageEnhance
for f in glob.glob(os.path.join(a.out, 'model', 'bake_*.jpg')):
    # a bright daylight bake comes out pale: colour and contrast lifted so the oak, the boucle and the plaster read as in the tour
    im = Image.open(f).convert('RGB'); im = ImageEnhance.Color(im).enhance(a.color); im = ImageEnhance.Contrast(im).enhance(a.contrast)
    im.save(f, quality=90); small = im.resize((min(2048, im.width), min(2048, im.height)), Image.LANCZOS)
    small.save(f[:-4] + '_2k.jpg', quality=88)
for f in ('walk3d-grid.png', 'walk3d-grid.json'): shutil.copy(os.path.join(a.grid, f), a.out)
if a.sky: shutil.copy(a.sky, os.path.join(a.out, 'model', 'sky.jpg'))
total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(a.out) for f in fs)
print('walk3d site:', a.out, n, 'model files,', round(total / 1e6, 1), 'MB')
