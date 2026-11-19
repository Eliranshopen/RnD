# card 09: list the platform files this board may add now (not held by another open working folder, not excluded, not added yet).
# usage: python c09_paths.py > logs/c09-paths.txt   (prints the addable list; held/excluded counts go to stderr)
import json, os, sys
ROOT = r"C:\RnD"
PLAT = "Projects/Habait/habait-walkaround/Habait/platform"
mine = {e["path"] for e in json.load(open(os.path.join(ROOT, ".wt/platform-ui-ux/manifest.json"), encoding="utf-8"))["files"]}
held = set()
for d in os.listdir(os.path.join(ROOT, ".wt")):
    mp = os.path.join(ROOT, ".wt", d, "manifest.json")
    if d == "platform-ui-ux" or not os.path.isfile(mp):
        continue
    m = json.load(open(mp, encoding="utf-8"))
    if m.get("closed"):
        continue
    held |= {e["path"] for e in m.get("files", [])}
out, n_held, n_excl = [], 0, 0
for root, dirs, files in os.walk(os.path.join(ROOT, PLAT)):
    dirs.sort()
    rel_root = os.path.relpath(root, ROOT).replace("\\", "/")
    if "/node_modules" in rel_root + "/" or rel_root.startswith(PLAT + "/_local"):
        n_excl += len(files)
        continue
    for f in sorted(files):
        rel = f"{rel_root}/{f}"
        if rel == f"{PLAT}/fixtures/rainbow/orbit_real.mp4" or f == "_local_serve.log":
            n_excl += 1
            continue
        if rel in mine:
            continue
        if rel in held:
            n_held += 1
            continue
        out.append(rel)
print("\n".join(out))
print(f"addable {len(out)} · held elsewhere {n_held} (used read-only, never copied in) · excluded {n_excl} (node_modules, _local, orbit_real.mp4, logs) · already mine {len(mine)}", file=sys.stderr)
