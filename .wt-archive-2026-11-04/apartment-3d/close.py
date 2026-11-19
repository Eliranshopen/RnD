#!/usr/bin/env python3
"""Card 10 close (board apartment-3d, root CLAUDE.md 8.7, no git): copy every changed/new work-tree file back to the
live tree after checking the live file is still what the work tree started from; record sha256_at_close; verify.

    python -X utf8 close.py            # dry run: what would be copied, and any live drift (stops on drift)
    python -X utf8 close.py --go       # copy back + write the close into manifest.json

Released paths (manifest "released") are never copied back. Never deletes anything.
"""
import datetime
import hashlib
import json
import os
import shutil
import sys

WT = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(WT, "files")
RND = r"C:\RnD"
MANIFEST = os.path.join(WT, "manifest.json")
SKIP_DIRS = {"node_modules", "__pycache__"}
SKIP_FILES = {"events.jsonl"}


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main(go):
    m = json.load(open(MANIFEST, encoding="utf-8"))
    known = {f["path"]: f for f in m["files"]}
    released = {f["path"] for f in m.get("released", [])}
    todo, drift = [], []
    for root, dirs, files in os.walk(FILES):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in files:
            if n in SKIP_FILES:
                continue
            full = os.path.join(root, n)
            rel = os.path.relpath(full, FILES).replace("\\", "/")
            if rel in released:
                continue
            live = os.path.join(RND, rel.replace("/", os.sep))
            f = known.get(rel)
            wsha = sha(full)
            if f is None or f["sha256_at_open"] is None:          # new file
                if os.path.exists(live) and sha(live) != wsha:
                    drift.append((rel, "new here, but a different file now exists live"))
                    continue
                todo.append((rel, full, live, wsha, "new", None))
            elif wsha != f["sha256_at_open"]:                       # changed here
                if not os.path.exists(live) or sha(live) != f["sha256_at_open"]:
                    drift.append((rel, "live changed since open"))
                    continue
                todo.append((rel, full, live, wsha, "changed", f))
    for rel, why in drift:
        print(f"DRIFT {rel}: {why}")
    if drift:
        print("stop: reconcile by hand (root 8.7)", file=sys.stderr)
        return 2
    for rel, *_ , kind, _f in [(t[0], t[1], t[2], t[3], t[4], t[5]) for t in todo]:
        print(f"{kind:8s} {rel}")
    print(f"{len(todo)} files ({sum(1 for t in todo if t[4] == 'new')} new)")
    if not go:
        return 0
    now = datetime.datetime.now().isoformat(timespec="seconds")
    closed = []
    for rel, full, live, wsha, kind, f in todo:
        os.makedirs(os.path.dirname(live), exist_ok=True)
        shutil.copy2(full, live)
        lsha = sha(live)
        if lsha != wsha:
            print(f"FAIL copy {rel}", file=sys.stderr)
            return 3
        if f is None:
            f = {"path": rel, "sha256_at_open": None}
            m["files"].append(f)
        f["sha256_at_close"] = lsha
        f["closed"] = now
        closed.append(rel)
    m["closed"] = {"when": now, "files": len(closed), "by": "card 10 (main session rnd-fd), Eliran's \"good\" 2026-11-03",
                   "note": "dist copied from the work tree: live has no node_modules; every build input is identical live (drift 0, released files unchanged)"}
    json.dump(m, open(MANIFEST, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"closed: {len(closed)} files copied back and verified")
    return 0


if __name__ == "__main__":
    sys.exit(main("--go" in sys.argv))
