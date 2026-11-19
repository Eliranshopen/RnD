# Build a THROWAWAY runnable platform tree for tests and the :8852 preview (board platform-ui-ux, card 09+).
#   base    = the LIVE Habait/platform (read-only; includes the files other working folders hold — read, never edited)
#   overlay = this board's working copies under .wt/platform-ui-ux/files/.../platform (what the board changes)
#   three   = node_modules/three from .wt/apartment-3d (read-only; the live platform has none, OWED-023)
#   extras  = what the flow tests read outside the platform, copied read-only at the same relative depth (card 15):
#             Habait/tour360/dist/apt846, Habait/tour360/apartments/apt846/scenes.json, Projects/Habait/data/sales-plans/legal
# Layout: <out>/habait-walkaround/Habait/platform (so platform/../.. = <out>, where data/ lives, as in Projects/Habait).
# Rebuilt from scratch on each run, outside the working folder, never copied back anywhere.
# usage: python preview.py <out-dir named 'preview'>        prints the platform root
import os, shutil, sys
OUT = os.path.abspath(sys.argv[1])
LIVE_HW = r"C:\RnD\Projects\Habait\habait-walkaround"
LIVE = os.path.join(LIVE_HW, "Habait", "platform")
WT = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform"
THREE = r"C:\RnD\.wt\apartment-3d\files\Projects\Habait\habait-walkaround\Habait\platform\node_modules\three"
if os.path.basename(OUT.rstrip("\\/")) != "preview":
    sys.exit("refusing: the out dir must be a folder named 'preview' (it is wiped on each run)")
for old in ("platform", "habait-walkaround", "data"):
    if os.path.exists(os.path.join(OUT, old)):
        shutil.rmtree(os.path.join(OUT, old))
dst = os.path.join(OUT, "habait-walkaround", "Habait", "platform")


def ignore(d, names):
    rel = os.path.relpath(d, LIVE).replace("\\", "/")
    skip = {"node_modules", "_local_serve.log"}
    if rel == "_local":
        return [n for n in names if n not in ("dist", "segments")]
    if rel.startswith("test") and "shots" in names:
        skip.add("shots")
    return [n for n in names if n in skip]


shutil.copytree(LIVE, dst, ignore=ignore)
n = 0
BASE_ONLY = '--base-only' in sys.argv   # the live platform alone (a pre-board baseline), no working copies on top
for root, _, files in ([] if BASE_ONLY else os.walk(WT)):
    for f in files:
        src = os.path.join(root, f)
        out = os.path.join(dst, os.path.relpath(src, WT))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copy2(src, out)
        n += 1
if os.path.isdir(THREE):
    shutil.copytree(THREE, os.path.join(dst, "node_modules", "three"), ignore=shutil.ignore_patterns("examples", "src", "*.md"))
    shutil.copytree(os.path.join(THREE, "examples", "jsm"), os.path.join(dst, "node_modules", "three", "examples", "jsm"))
H = os.path.join(OUT, "habait-walkaround", "Habait")
shutil.copytree(os.path.join(LIVE_HW, "Habait", "tour360", "dist", "apt846"), os.path.join(H, "tour360", "dist", "apt846"))
os.makedirs(os.path.join(H, "tour360", "apartments", "apt846"), exist_ok=True)
shutil.copy2(os.path.join(LIVE_HW, "Habait", "tour360", "apartments", "apt846", "scenes.json"), os.path.join(H, "tour360", "apartments", "apt846", "scenes.json"))
shutil.copytree(r"C:\RnD\Projects\Habait\data\sales-plans\legal", os.path.join(OUT, "data", "sales-plans", "legal"))
print(dst)
print(f"overlay files: {n}", file=sys.stderr)
