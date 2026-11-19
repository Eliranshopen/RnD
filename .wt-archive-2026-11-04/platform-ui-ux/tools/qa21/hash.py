import json,hashlib,os
m=json.load(open('C:/RnD/.wt/platform-ui-ux/manifest.json'))
rel={r['path'] for r in m['released']}
bad=0;n=0
for f in m['files']:
    p='C:/RnD/'+f['path']
    c=f.get('sha256_at_close')
    if f['path'] in rel: print('RELEASED-IN-FILES',f['path'])
    if not c: print('NOCLOSE',f['path']); continue
    n+=1
    if not os.path.exists(p): print('MISSING',f['path']);bad+=1;continue
    h=hashlib.sha256(open(p,'rb').read()).hexdigest()
    if h!=c: print('MISMATCH',f['path']);bad+=1
print('checked',n,'bad',bad)
for r in m['released']:
    p='C:/RnD/'+r['path']; h=hashlib.sha256(open(p,'rb').read()).hexdigest()
    print('released',r['path'].split('platform/')[-1],'live==open' if h==r['sha256_at_open'] else 'live!=open')
for k in ['flow.js','viewer360.js','cine.js']:
    print(k,[f['path'] for f in m['files'] if f['path'].endswith('/'+k)])
print('studio server/pipeline in files:',[f['path'] for f in m['files'] if '/studio/' in f['path'] and ('server' in f['path'] or 'pipeline' in f['path'])][:10])
