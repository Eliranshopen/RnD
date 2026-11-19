"""walk3d-sky.py — the view outside the 3D walk's windows, from ONE tour picture (2026-11-12; consistency: one city everywhere).

  python -I walk3d-sky.py <picture.webp> <picture yaw deg> <first bearing> <last bearing> <band top row> <band bottom row> <out.jpg>

The picture's skyline band (rows <band top>..<band bottom>: the hazy city at the horizon, above the terrace railing) between
<first> and <last> bearing is laid around the horizon of a backdrop at infinity in three.js's equirect layout (u = atan2(z, x),
+x east, +z south; top row = straight up): at its true bearings, mirrored onto the other half, so every window sees the same city.
Above the band: a sky gradient from the band's own top colour (per column) to a clear blue at the zenith. Below the band: the
band's bottom colour (blurred along the horizon) fading to a hazy city tone 40 degrees down (from the 16th floor the street is far
and hazy in the tour's pictures too). No railing, no roof, no floor from the picture. $0.
"""
import sys, math
import numpy as np
from PIL import Image
from scipy import ndimage
src, yaw, b0, b1, r0, r1, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
P = np.asarray(Image.open(src).convert('RGB')).astype(np.float32); H, W = P.shape[:2]
OW, OH = 2048, 1024
u = (np.arange(OW) + 0.5) / OW; th = (u - 0.5) * 2 * math.pi
bearing = np.degrees(np.arctan2(np.cos(th), -np.sin(th)))   # three dir (cos th, ., sin th) -> plan bearing
t = ((bearing - b0) % 360) / 180.0; s = np.where(t <= 1, t, 2 - t)   # 0..1..0 around the circle: true bearings, then mirrored
pc = ((((b0 + s * (b1 - b0)) - yaw) / 360 + 0.5) % 1 * W).astype(int) % W
lat = 90 - (np.arange(OH) + 0.5) * 180 / OH
lt, lb = 90 - r0 * 180 / H, 90 - r1 * 180 / H   # the band's latitudes
band = P[r0:r1][:, pc]                          # (rows, OW, 3) at the picture's own row spacing
top = ndimage.gaussian_filter1d(band[:3].mean(0), 8, axis=0); bot = ndimage.gaussian_filter1d(np.median(band, axis=0), 25, axis=0)   # the band's median: a rail crossing it does not darken the haze
zen = np.array([118, 160, 210], np.float32); ground = np.array([170, 168, 160], np.float32)
img = np.zeros((OH, OW, 3), np.float32)
for r, la in enumerate(lat):
    if la > lt:
        k = ((la - lt) / (90 - lt)) ** 0.7; img[r] = top * (1 - k) + zen * k
    elif la >= lb:
        img[r] = band[min(r1 - r0 - 1, int((lt - la) / (lt - lb) * (r1 - r0)))]
    else:
        k = min(1.0, (lb - la) / 40.0) ** 0.8; img[r] = bot * (1 - k) + ground * k
Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(out, quality=90); print('sky', out, img.shape, 'band lat %.1f..%.1f' % (lt, lb))
