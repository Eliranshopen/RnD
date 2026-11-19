#!/usr/bin/env python3
"""Work-tree helper for .wt/apartment-3d (root CLAUDE.md 8.7, no git).

    python -X utf8 wt.py open      # write manifest.json (sha256 of every copied file, path relative to C:/RnD)
    python -X utf8 wt.py changes   # write CHANGES.md: every changed / new file vs the live copy, with a diff
    python -X utf8 wt.py drift     # list manifest files whose LIVE copy changed since open (must be empty at close)

Never writes outside this folder.
"""
import datetime, difflib, hashlib, json, os, sys

RND = r"C:\RnD"
WT = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(WT, "files")
MANIFEST = os.path.join(WT, "manifest.json")
SKIP_DIRS = {"node_modules", "__pycache__"}
# test by-products of the local server (serve.mjs events sink) — never part of the work, never copied back
SKIP_FILES = {"events.jsonl"}
TEXT_EXT = {".js", ".mjs", ".cjs", ".html", ".css", ".json", ".md", ".py", ".txt", ".svg"}


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def released():
    """paths handed to another board (manifest "released"): kept here for local runs, never listed, never copied back"""
    try:
        return {f["path"] for f in json.load(open(MANIFEST, encoding="utf-8")).get("released", [])}
    except (OSError, ValueError):
        return set()


def walk():
    skip = released()
    for root, dirs, files in os.walk(FILES):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in files:
            if n in SKIP_FILES:
                continue
            full = os.path.join(root, n)
            rel = os.path.relpath(full, FILES).replace("\\", "/")
            if rel in skip:
                continue
            yield rel, full


def live(rel):
    return os.path.join(RND, rel.replace("/", os.sep))


def cmd_open():
    if os.path.exists(MANIFEST):
        sys.exit("manifest.json exists; open runs once")
    files = []
    for rel, full in walk():
        lv = live(rel)
        files.append({"path": rel, "sha256_at_open": sha(full) if os.path.exists(lv) else None})
    m = {
        "name": "apartment-3d",
        "purpose": "apartment 3D view (dollhouse tab) upgrade; board development/tasks/apartment-3d, plan development/plans/2026-11-03-apartment-3d-ux.md",
        "opened": datetime.datetime.now().isoformat(timespec="seconds"),
        "note": "runnable copy: some files are context only; at close only files whose work-tree hash differs from sha256_at_open are copied back",
        "files": sorted(files, key=lambda x: x["path"]),
    }
    json.dump(m, open(MANIFEST, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"manifest: {len(files)} files")


def load():
    return json.load(open(MANIFEST, encoding="utf-8"))


def cmd_changes():
    m = load()
    known = {f["path"]: f for f in m["files"]}
    out = ["# CHANGES — what this work tree changed vs the live project", "",
           f"Generated {datetime.datetime.now().isoformat(timespec='seconds')} by `wt.py changes`. "
           "Live root: `C:\\RnD`. Nothing here is live until card 10 copies it back.", ""]
    changed, new = [], []
    for rel, full in walk():
        f = known.get(rel)
        if f is None or f["sha256_at_open"] is None:
            new.append((rel, full))
        elif sha(full) != f["sha256_at_open"]:
            changed.append((rel, full))
    missing = [p for p in known if not os.path.exists(os.path.join(FILES, p.replace("/", os.sep)))]
    out.append(f"**{len(changed)} changed · {len(new)} new · {len(missing)} removed**")
    out.append("")
    for rel, full in changed:
        out.append(f"## changed: `{rel}`")
        ext = os.path.splitext(rel)[1].lower()
        lv = live(rel)
        if ext in TEXT_EXT and os.path.getsize(full) < 3_000_000:
            a = open(lv, encoding="utf-8", errors="replace").read().splitlines()
            b = open(full, encoding="utf-8", errors="replace").read().splitlines()
            out += ["```diff"] + list(difflib.unified_diff(a, b, "live", "work tree", lineterm="", n=2)) + ["```"]
        else:
            out.append(f"binary: live {os.path.getsize(lv)} B → work tree {os.path.getsize(full)} B")
        out.append("")
    for rel, full in new:
        out.append(f"## new: `{rel}` ({os.path.getsize(full)} B)")
    for rel in missing:
        out.append(f"## removed in work tree: `{rel}`")
    open(os.path.join(WT, "CHANGES.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"CHANGES.md: {len(changed)} changed, {len(new)} new, {len(missing)} removed")


def cmd_drift():
    bad = [f["path"] for f in load()["files"]
           if f["sha256_at_open"] and (not os.path.exists(live(f["path"])) or sha(live(f["path"])) != f["sha256_at_open"])]
    print(f"live drift: {len(bad)}")
    for p in bad:
        print("  " + p)


if __name__ == "__main__":
    {"open": cmd_open, "changes": cmd_changes, "drift": cmd_drift}[sys.argv[1] if len(sys.argv) > 1 else "changes"]()
