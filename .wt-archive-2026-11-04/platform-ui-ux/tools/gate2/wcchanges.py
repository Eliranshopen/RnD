import json, hashlib, os
root = 'C:/RnD/.wt/platform-ui-ux/files/'
m = json.load(open('C:/RnD/.wt/platform-ui-ux/manifest.json'))['files']
items = dict(m.items()) if isinstance(m, dict) else {f['path']: f for f in m}
on_disk = []
for dp, dn, fn in os.walk(root):
    dn[:] = [d for d in dn if d != 'node_modules']
    for f in fn:
        on_disk.append(os.path.relpath(os.path.join(dp, f), root).replace(chr(92), '/'))
print('wc files', len(on_disk), 'manifest', len(items))
print('on disk, not in manifest:', [p for p in on_disk if p not in items])
print('in manifest, not on disk:', [p for p in items if p not in on_disk])
ch = []
for p, f in items.items():
    w = root + p
    if not os.path.exists(w):
        continue
    h = hashlib.sha256(open(w, 'rb').read()).hexdigest()
    if h != f.get('sha256_at_open'):
        ch.append(p)
print('CHANGED vs open:', len(ch))
for c in ch:
    print('  ', c.replace('Projects/Habait/habait-walkaround/', ''))
print('out-of-scope check (must be empty):')
for k in ['apartment-3d.js', 'cine.css', 'transition.css', 'flow.js', 'viewer360.js', 'cine.js', 'build_zip', 'studio/server.mjs', 'studio/pipeline', 'studio/api', '/hold', 'tour360']:
    print('  ', k, [p for p in ch if k in p])
