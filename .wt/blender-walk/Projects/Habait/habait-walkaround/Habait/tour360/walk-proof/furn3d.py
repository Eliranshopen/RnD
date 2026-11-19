"""furn3d.py — a real 3D copy of one piece of the tour's furniture, for the 3D walk (2026-11-12, Eliran: «כן 2», cap $5).

  python furn3d.py <work dir> <piece id> <crop.png> "<what the piece is>" [--model trellis|hunyuan] [--go] [--cap 5.0] [--ledger <file>]

Two fal calls per piece: (1) nano-banana-2 edit turns the crop cut from the tour picture (furn-crop.py) into a clean catalogue
photo of that one piece on white, same design, colours and proportions ($0.08); (2) image-to-3D on that photo: TRELLIS
($0.02, textured GLB) or Hunyuan3D v2 textured (booked $0.48: fal lists $0.16 per generation, textured may cost more). Dry by
default: prints what it would send. With --go: books the estimate in the ledger BEFORE each call, refuses over --cap, saves the
request id at submit, downloads with httpx. The key is read by name (kling_v2v.load_fal_key) and never printed. Outputs:
<work>/<piece>/photo.png, model.glb, call.json. A step whose output exists is not re-run (a retry never re-bills).
"""
import sys, os, json, time, base64, argparse, datetime
import httpx
sys.path.insert(0, 'C:/RnD/Projects/Habait/habait-walkaround/Habait/engine/video'); import kling_v2v as K
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('piece'); ap.add_argument('crop'); ap.add_argument('what')
ap.add_argument('--model', default='trellis', choices=('trellis', 'hunyuan')); ap.add_argument('--go', action='store_true')
ap.add_argument('--cap', type=float, default=5.0); ap.add_argument('--ledger', required=True); ap.add_argument('--photo-only', action='store_true')
a = ap.parse_args(); D = os.path.join(a.dir, a.piece); os.makedirs(D, exist_ok=True)
EP = {'photo': ('fal-ai/nano-banana-2/edit', 0.08), 'trellis': ('fal-ai/trellis', 0.02), 'hunyuan': ('fal-ai/hunyuan3d/v2', 0.48)}
def ledger():
    return json.load(open(a.ledger, encoding='utf-8')) if os.path.exists(a.ledger) else []
def booked(): return round(sum(r['usd'] for r in ledger()), 2)
def book(row):
    rows = ledger(); rows.append(row); json.dump(rows, open(a.ledger, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
def uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
def call(step, ep, usd, body, out_key, out_file):
    if os.path.exists(out_file): print(step, 'cached', out_file); return
    if booked() + usd > a.cap: raise SystemExit(f'REFUSED: {step} ${usd} would pass the cap ${a.cap} (booked ${booked()})')
    if not a.go: print('DRY', step, ep, f'${usd}', 'booked so far', booked()); return
    K.load_fal_key(); k = os.environ['FAL_KEY']; H = {'Authorization': 'Key ' + k}
    row = {'at': datetime.datetime.now().isoformat(timespec='seconds'), 'piece': a.piece, 'step': step, 'endpoint': ep, 'usd': usd, 'state': 'booked before the call', 'approved': 'Eliran 2026-11-12 «כן 2» (the tour look on the 3D walk), cap $5'}
    book(row)
    r = httpx.post(f'https://queue.fal.run/{ep}', headers=H, json=body, timeout=120)
    if r.status_code >= 300: raise SystemExit(f'{step}: submit {r.status_code} {r.text.replace(k, "***")[:300]}')
    j = r.json(); rid = j['request_id']; json.dump({'step': step, 'endpoint': ep, 'request_id': rid, 'status_url': j.get('status_url'), 'response_url': j.get('response_url')}, open(os.path.join(D, step + '.call.json'), 'w'), indent=1)
    print(step, 'submitted', rid)
    for _ in range(200):
        s = httpx.get(j['status_url'], headers=H, timeout=60).json()
        if s.get('status') == 'COMPLETED': break
        time.sleep(4)
    res = httpx.get(j['response_url'], headers=H, timeout=120).json()
    item = res[out_key][0] if isinstance(res.get(out_key), list) else res[out_key]
    data = httpx.get(item['url'], timeout=300, follow_redirects=True).content; open(out_file, 'wb').write(data)
    json.dump({k2: v for k2, v in res.items() if k2 != out_key}, open(os.path.join(D, step + '.result.json'), 'w'), indent=1)
    print(step, 'done', out_file, len(data), 'bytes; booked', booked())
photo = os.path.join(D, 'photo.png')
PROMPT = (f"Image 1 is a photograph of a room. Show ONLY {a.what} from Image 1 as a clean product catalogue photograph: the SAME piece with exactly "
          "the same design, shape, proportions, number of parts, materials, fabric texture and colours as in Image 1, complete and whole (nothing cut "
          "off, including the parts hidden in Image 1, completed in the same style), seen from a three-quarter front view slightly from above, standing "
          "alone on a plain pure white background with a soft contact shadow. No other furniture, no room, no floor pattern, no rug, no plants, no text.")
call('photo', EP['photo'][0], EP['photo'][1], {'prompt': PROMPT, 'image_urls': [uri(a.crop)], 'num_images': 1, 'output_format': 'png', 'aspect_ratio': '1:1', 'sync_mode': False}, 'images', photo)
if not a.photo_only and (os.path.exists(photo) or not a.go):
    src = photo if os.path.exists(photo) else a.crop
    ep, usd = EP[a.model]
    body = {'image_url': uri(src), 'texture_size': 2048, 'mesh_simplify': 0.95} if a.model == 'trellis' else {'input_image_url': uri(src), 'textured_mesh': True, 'octree_resolution': 256}
    call('model_' + a.model, ep, usd, body, 'model_mesh', os.path.join(D, f'model_{a.model}.glb'))
print('booked total $', booked())
