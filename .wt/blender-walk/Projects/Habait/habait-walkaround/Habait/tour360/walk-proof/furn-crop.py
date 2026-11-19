"""furn-crop.py — a straight (perspective) photo of one piece of furniture cut from a shipped tour picture, for image-to-3D (2026-11-12).

  python -I furn-crop.py <pano.webp> <cam yaw deg> <bearing deg> <pitch deg> <hfov deg> <out.png> [--size 1024]

The panorama's centre column looks along the camera's yaw (bearings: 0 = up on the plan, clockwise); the cut looks along <bearing>,
tilted by <pitch> (negative = down), <hfov> wide, square. Bilinear, $0.
"""
import sys, math, argparse
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser()
for k in ('pano', 'yaw', 'bearing', 'pitch', 'hfov', 'out'): ap.add_argument(k)
ap.add_argument('--size', type=int, default=1024); a = ap.parse_args()
P = np.asarray(Image.open(a.pano).convert('RGB')).astype(np.float32); H, W = P.shape[:2]; N = a.size
f = (N / 2) / math.tan(math.radians(float(a.hfov)) / 2)
yy, xx = np.mgrid[0:N, 0:N]; x = (xx - N / 2 + 0.5) / f; y = -(yy - N / 2 + 0.5) / f
p = math.radians(float(a.pitch)); dz = np.cos(p) - y * np.sin(p); dy = y * np.cos(p) + np.sin(p)   # forward, up (camera tilted)
lon = np.degrees(np.arctan2(x, dz)) + float(a.bearing) - float(a.yaw); lat = np.degrees(np.arctan2(dy, np.hypot(x, dz)))
u = ((0.5 + lon / 360) % 1) * W - 0.5; v = (0.5 - lat / 180) * H - 0.5
u0 = np.floor(u).astype(int); v0 = np.clip(np.floor(v).astype(int), 0, H - 2); fu = (u - u0)[..., None]; fv = (v - v0)[..., None]
u0 %= W; u1 = (u0 + 1) % W
out = (P[v0, u0] * (1 - fu) * (1 - fv) + P[v0, u1] * fu * (1 - fv) + P[v0 + 1, u0] * (1 - fu) * fv + P[v0 + 1, u1] * fu * fv)
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(a.out); print('ok', a.out)
