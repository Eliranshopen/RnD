"""walk3d-project.py — the 3D walk dressed in the TOUR'S OWN pictures (2026-11-12, Eliran: «אתה לא יכול להלביש את הפיצ'ר של ההליכה על
rainbow-v2-test?»): every texel of the model's atlases takes its colour from the shipped tour picture that sees it best. $0.

  python -I walk3d-project.py --work <walk3d work dir with geom_*.npy and gl/bake_K.jpg> --apt <apartments/apt846> --cg <apt846-furnished>
         --set panos-parquet --out <dir> [--groups 5] [--shift dining=-7]

Per texel (world position P, normal n from walk3d_bake.py --stage geom) and per tour viewpoint i (its camera from the CG render's
pano.render.json — the pictures were skinned from those renders, so they share the camera): the direction P - C_i gives the picture
pixel (equirect, the CG's own mapping, + a measured yaw shift where the picture sits off its render); the CG depth from the same spot
says whether P is the first thing that camera sees (visible) or hidden behind something. Weight = visible × facing (n · view) ×
1 / distance², sharpened (^4) so the nearest clear view wins and far views barely blend in. A texel no picture sees keeps the light
bake's colour. Writes <out>/bake_K.jpg (top row first) and a coverage report.
"""
import argparse, json, os, math
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser()
ap.add_argument('--work', required=True); ap.add_argument('--apt', required=True); ap.add_argument('--cg', required=True)
ap.add_argument('--set', default='panos-parquet'); ap.add_argument('--out', required=True); ap.add_argument('--groups', type=int, default=5)
ap.add_argument('--shift', action='append', default=[], help='scene=degrees: the picture sits that far off its render (align.py)')
ap.add_argument('--sharp', type=float, default=4.0)
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
scenes = [s for s in json.load(open(os.path.join(a.apt, 'scenes.json'), encoding='utf-8'))['scenes'] if not s.get('exterior') and s['asset'][:2].isdigit()]
SH = {k: float(v) for k, v in (x.split('=') for x in a.shift)}
cams = []
for s in scenes:
    R = os.path.join(a.cg, 'renders', 'cp-' + s['id'])
    pt = json.load(open(os.path.join(R, 'pano.render.json'), encoding='utf-8'))['point']
    d = np.asarray(Image.open(os.path.join(R, 'depth.png')).convert('RGB'), dtype=np.int64); depth = ((d[..., 0] << 16) | (d[..., 1] << 8) | d[..., 2]) / 100.0
    pic = np.asarray(Image.open(os.path.join(a.apt, '_local', a.set, s['asset'] + '.webp')).convert('RGB'), dtype=np.float32)
    cams.append({'id': s['id'], 'C': np.array(pt['world_m'], dtype=np.float64), 'yaw': pt['yaw_deg'], 'depth': depth, 'pic': pic, 'shift': SH.get(s['id'], 0.0)})
    print('camera', s['id'], pt['world_m'], 'yaw', pt['yaw_deg'], 'shift', SH.get(s['id'], 0.0), 'pic', pic.shape[1], 'depth', depth.shape[1])

def sample(img, u, v):   # bilinear, u wraps, v clamps; u, v in pixels
    H, W = img.shape[:2]; u0 = np.floor(u).astype(np.int64); v0 = np.clip(np.floor(v).astype(np.int64), 0, H - 2)
    fu = (u - u0)[:, None]; fv = (v - v0)[:, None]; u0 %= W; u1 = (u0 + 1) % W
    return img[v0, u0] * (1 - fu) * (1 - fv) + img[v0, u1] * fu * (1 - fv) + img[v0 + 1, u0] * (1 - fu) * fv + img[v0 + 1, u1] * fu * fv

report = []
for k in range(a.groups):
    P = np.load(os.path.join(a.work, 'geom_position_%d.npy' % k)); N = np.load(os.path.join(a.work, 'geom_normal_%d.npy' % k))
    H, W = P.shape[:2]; lit = np.flipud(np.asarray(Image.open(os.path.join(a.work, 'gl', 'bake_%d.jpg' % k)).convert('RGB').resize((W, H)), dtype=np.float32))
    m = np.abs(P[..., :3]).sum(-1) > 1e-6; idx = np.nonzero(m.reshape(-1))[0]
    p = P.reshape(-1, 4)[idx, :3].astype(np.float64); n = N.reshape(-1, 4)[idx, :3].astype(np.float64) * 2 - 1
    n /= np.maximum(1e-6, np.linalg.norm(n, axis=1, keepdims=True))
    acc = np.zeros((len(idx), 3)); wsum = np.zeros(len(idx)); best = np.zeros(len(idx))
    for c in cams:
        v = p - c['C']; dist = np.linalg.norm(v, axis=1); dv = v / dist[:, None]
        bearing = np.degrees(np.arctan2(dv[:, 0], dv[:, 1]))   # plan bearing: 0 = +Y world (up on the plan), clockwise
        lat = np.degrees(np.arcsin(np.clip(dv[:, 2], -1, 1)))
        uc = ((0.5 + (((bearing - c['yaw']) + 540) % 360 - 180) / 360) % 1)
        dH, dW = c['depth'].shape; du = np.clip((uc * dW).astype(np.int64), 0, dW - 1); dvv = np.clip(((0.5 - lat / 180) * dH).astype(np.int64), 0, dH - 1)
        seen = c['depth'][dvv, du]; vis = dist <= seen * 1.02 + 0.06
        face = np.clip(-(n * dv).sum(1), 0, 1); w = vis * face ** 1.5 / np.maximum(dist, 0.3) ** 2
        w = w ** a.sharp
        if not w.any(): continue
        sel = w > 0; ph, pw = c['pic'].shape[:2]
        up = ((uc[sel] + c['shift'] / 360) % 1) * pw - 0.5; vp = (0.5 - lat[sel] / 180) * ph - 0.5
        acc[sel] += sample(c['pic'], up, vp) * w[sel, None]; wsum[sel] += w[sel]; best[sel] = np.maximum(best[sel], w[sel])
    out = lit.reshape(-1, 3).copy(); got = wsum > 0
    out[idx[got]] = acc[got] / wsum[got, None]
    img = np.flipud(out.reshape(H, W, 3)).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(os.path.join(a.out, 'bake_%d.jpg' % k), quality=90)
    cov = float(got.mean()); report.append({'group': k, 'texels': int(len(idx)), 'from_pictures': round(cov, 3)})
    print('group', k, 'texels', len(idx), 'coloured from the pictures %.1f%%' % (100 * cov), '(the rest keeps the light bake)')
json.dump({'set': a.set, 'shift': SH, 'sharp': a.sharp, 'groups': report}, open(os.path.join(a.out, 'project.json'), 'w'), indent=1)
