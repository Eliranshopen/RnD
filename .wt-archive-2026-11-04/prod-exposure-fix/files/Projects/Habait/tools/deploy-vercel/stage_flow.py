import os, shutil, re, json, sys
R = r"C:\RnD\Projects\Habait\habait-walkaround"
OUT = os.path.join(sys.argv[1])
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
# 1. platform at /
P = os.path.join(R, "Habait", "platform")
for f in os.listdir(P):
    src = os.path.join(P, f)
    # never deployed: machine-local data, the analytics dashboard (habait-4b, card 24: takes a personal phx_ key), node tooling, tests
    # demo-transition.html: developer test page (needs `node test/transition.test.mjs --prep` assets); linked from no page and showed
    # a developer error on production (flow deploy 5 QA, 2026-11-04) — local only (prod-exposure-fix, Eliran 2026-11-04)
    if f in ("_local", "_local_serve.log", "node_modules", "package.json", "package-lock.json", "contracts", "dashboard.html", "apps-script", "tools", "test", "serve.mjs", "README.md", "demo-transition.html"): continue
    if os.path.isdir(src): shutil.copytree(src, os.path.join(OUT, f))
    elif f.endswith((".html", ".json", ".js", ".css", ".ico", ".svg", ".png", ".webp", ".jpg")): shutil.copy2(src, OUT)
# 1b. the built apartment pages' media (platform-ui-ux card 03, 2026-11-03). `_local` stays excluded as a whole (above); only
# `_local/dist/<project>/<unit>/` is staged, for each project the site stages (fixtures/<project>/), so landing.js / apartment.js
# find `_local/dist/<p>/<u>/apartment.json` instead of a 404 and the clay fallback. Staged: the manifest, `media/` (stills, panos,
# plan, glb, dollhouse) and the unit ZIP the manifest links (`zip.src`, the apartment page's download button). Not staged: the
# standalone page copy (`index.html`, `assets/`) — the site serves its own apartment.html. Never `_local/projects`; `_local/segments` only via 1c.
DIST = os.path.join(P, "_local", "dist")
dist_files = []
if os.path.isdir(DIST):
    for proj in sorted(os.listdir(DIST)):
        if not os.path.isdir(os.path.join(P, "fixtures", proj)): continue
        for unit in sorted(os.listdir(os.path.join(DIST, proj))):
            u = os.path.join(DIST, proj, unit)
            mf = os.path.join(u, "apartment.json")
            if not os.path.isfile(mf): continue
            keep = ["apartment.json"]
            zsrc = (json.load(open(mf, encoding="utf-8")).get("zip") or {}).get("src")
            if zsrc and "/" not in zsrc and ".." not in zsrc and os.path.isfile(os.path.join(u, zsrc)): keep.append(zsrc)
            for root, dirs, files in os.walk(os.path.join(u, "media")):
                dirs.sort()
                keep += [os.path.relpath(os.path.join(root, f), u).replace("\\", "/") for f in sorted(files) if f != "CLAUDE.md"]
            for rel in keep:
                dst = os.path.join(OUT, "_local", "dist", proj, unit, *rel.split("/"))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(os.path.join(u, *rel.split("/")), dst)
                dist_files.append(f"_local/dist/{proj}/{unit}/{rel}")
print("dist media staged:", len(dist_files), "files | %.1f MB" % (sum(os.path.getsize(os.path.join(OUT, *f.split("/"))) for f in dist_files) / 1048576))
# 1c. the cinematic flight's clips (platform-ui-ux card 22 FAIL, 2026-11-04; Eliran: "Upload the clips"). flow.html and landing arm B
# play fixtures/<project>/flow.cine.json, whose clips live in _local/segments/<project>-cine/. Without them the flight painted a black
# stage on Vercel. Staged: ONLY the paths flow.cine.json references inside _local/segments/ (a referenced folder, e.g. a 'frames'
# hold track, is copied whole); never the dev/ renders, manifest.dev.json or context files.
seg_files = []
SEGS = os.path.normpath(os.path.join(P, "_local", "segments"))
for proj in sorted(os.listdir(os.path.join(P, "fixtures"))):
    cf = os.path.join(P, "fixtures", proj, "flow.cine.json")
    if not os.path.isfile(cf): continue
    refs = set()
    def _walk(x):
        if isinstance(x, dict):
            for v in x.values(): _walk(v)
        elif isinstance(x, list):
            for v in x: _walk(v)
        elif isinstance(x, str) and "_local/segments/" in x and "://" not in x:
            refs.add(x)
    _walk(json.load(open(cf, encoding="utf-8")).get("segments", []))
    for ref in sorted(refs):
        src = os.path.normpath(os.path.join(P, "fixtures", proj, *ref.split("/")))
        if not src.startswith(SEGS + os.sep): sys.exit("stage_flow: cine ref escapes _local/segments: " + ref)
        if os.path.isdir(src):
            items = [os.path.join(r, f) for r, _, fs in os.walk(src) for f in fs if f != "CLAUDE.md"]
        elif os.path.isfile(src):
            items = [src]
        else:
            sys.exit("stage_flow: cine ref missing on disk: " + ref)
        for it in items:
            rel = os.path.relpath(it, P).replace("\\", "/")
            if rel in seg_files: continue
            dst = os.path.join(OUT, *rel.split("/"))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(it, dst)
            seg_files.append(rel)
print("cine clips staged:", len(seg_files), "files | %.1f MB" % (sum(os.path.getsize(os.path.join(OUT, *f.split("/"))) for f in seg_files) / 1048576))
# picker.js (habait-ab/4b): resolveOverlaps() measured offsetWidth of pills ALREADY in compact form, so a pair flipped
# compact/full every frame (52 px <-> 151 px, seen 2.11 evening as "הבוחר נתקע" and unclickable pills). Until the source is
# fixed by its owner (reported to habait-4b), the STAGED copy measures the full width once and caches it per marker.
pj = os.path.join(OUT, "js", "picker.js")
if os.path.exists(pj):
    t = open(pj, encoding="utf-8").read()
    bug = "const wa = a.offsetWidth || 150, wb = b.offsetWidth || 150;"
    fix = "const fw = (m) => { if (!m.classList.contains('compact')) m._fullW = m.offsetWidth || 150; return m._fullW || 150; }; const wa = fw(a), wb = fw(b);"
    if bug in t: open(pj, "w", encoding="utf-8").write(t.replace(bug, fix)); print("picker.js: resolveOverlaps width-flicker patched in the staged copy")
    elif "_fullW" in t: print("picker.js: source already fixed")
    else: print("WARNING picker.js: resolveOverlaps changed upstream, flicker patch not applied — check")
# Vercel drops node_modules from static deploys → vendor the one module file and point the importmap at it
os.makedirs(os.path.join(OUT, "vendor"))
shutil.copy2(os.path.join(P, "node_modules", "three", "build", "three.module.js"), os.path.join(OUT, "vendor", "three.module.js"))
# 2. hold at /hold (flyover3d: index/app/picker + lib + data)
H = r"C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\flyover3d"
os.makedirs(os.path.join(OUT, "hold"))
for f in ("index.html", "app.js", "picker.js", "holdarc.js", "birds.js"): shutil.copy2(os.path.join(H, f), os.path.join(OUT, "hold", f))
# data: only what the buyer flow loads (panos + depth8 + nodes/units json + the descent clip). The 50 MB site.glb, the baked glb and the
# 16-bit depth intermediates serve only the local debug flights (?t=, ?fly=3d, ?intro=1) and stay out of the deploy (habait-98, v3 of the hold).
# the living hold ships only once its manifest points at the Kling frames (dir "jpg"); the clay placeholder never goes live
def _arc_placeholder(d):
    try: return json.load(open(os.path.join(d, "manifest.json"), encoding="utf-8")).get("dir") != "jpg"
    except Exception: return True
SKIP_DATA = lambda d, names: [n for n in names if n.endswith((".glb", ".depth.png", ".bak.json", ".orig.jpg")) or (("holdarc" in d or "holdpan" in d or "holdpull" in d or "holdring" in d) and (n in ("frames", "arc_clay.mp4", "pan_clay.mp4", "ring_clay.mp4", "arc_test.jpg", "jpg_clay", "jpg_hi", "kling_args.json", "kling_args_1080.json", "arc_real.mp4.json", "arc_real_1080.mp4.json", "pan_real.mp4.json") or n.endswith((".png", ".mp4", ".log")) or (n == "manifest.json" and _arc_placeholder(d))))]
shutil.copytree(os.path.join(H, "lib"), os.path.join(OUT, "hold", "lib"))
shutil.copytree(os.path.join(H, "data"), os.path.join(OUT, "hold", "data"), ignore=SKIP_DATA)
# a clay-placeholder manifest is replaced by a DISABLED one (no 404 in the console; holdarc.js falls back to the sphere before fetching anything)
for track in ("holdarc", "holdpan", "holdpull", "holdring"):                            # v8: three frame tracks; a track without Kling frames ships a DISABLED manifest
    if _arc_placeholder(os.path.join(H, "data", track)):
        os.makedirs(os.path.join(OUT, "hold", "data", track), exist_ok=True)
        json.dump({"frames": 0, "disabled": True, "note": f"{track} not deployed: no Kling frames yet (manifest dir != jpg)"}, open(os.path.join(OUT, "hold", "data", track, "manifest.json"), "w", encoding="utf-8"))
# 3. tour at /tour
shutil.copytree(os.path.join(R, "Habait", "tour360", "dist", "apt846"), os.path.join(OUT, "tour"))
# 3b. context files never ship (root CLAUDE.md §8.6 puts one in every folder; the copytree calls above carried 23 of them to
# production, e.g. /js/CLAUDE.md 200 — flow deploy 5 QA, 2026-11-04). Removed from the STAGED copy only; any other .md is reported.
ctx = [os.path.join(r, f) for r, _, fs in os.walk(OUT) for f in fs if f == "CLAUDE.md"]
for c in ctx: os.remove(c)
print("context files removed from stage:", len(ctx))
other_md = [os.path.relpath(os.path.join(r, f), OUT) for r, _, fs in os.walk(OUT) for f in fs if f.lower().endswith(".md")]
if other_md: print("WARNING other .md files staged:", other_md[:10])
# 4. rewrite hosts in text files of the STAGED copy only
subs = [("./node_modules/three/build/three.module.js", "/vendor/three.module.js"), ("node_modules/three/build/three.module.js", "/vendor/three.module.js"),
        ("http%3A%2F%2F127.0.0.1%3A8850", ""), ("http%3A%2F%2F127.0.0.1%3A8899", "%2Fhold"), ("http%3A%2F%2F127.0.0.1%3A8848", "%2Ftour"),
        ("http://127.0.0.1:8850", ""), ("http://127.0.0.1:8899", "/hold"), ("http://127.0.0.1:8848", "/tour"),
        ("http://localhost:8850", ""), ("http://localhost:8899", "/hold"), ("http://localhost:8848", "/tour")]
n = 0
for root, dirs, files in os.walk(OUT):
    for f in files:
        if not f.endswith((".html", ".js", ".json", ".css")): continue
        p = os.path.join(root, f)
        try: s = open(p, encoding="utf-8").read()
        except UnicodeDecodeError: continue
        t = s
        for a, b in subs: t = t.replace(a, b)
        if t != s: open(p, "w", encoding="utf-8").write(t); n += 1
json.dump({"headers": [{"source": "/(.*)", "headers": [{"key": "X-Robots-Tag", "value": "noindex, nofollow"}]}]}, open(os.path.join(OUT, "vercel.json"), "w"))
for root, dirs, files in os.walk(OUT):
    for f in files:
        if f.endswith((".html", ".js", ".json", ".css")):
            try: t = open(os.path.join(root, f), encoding="utf-8").read()
            except UnicodeDecodeError: continue
            if "node_modules" in t: print("still references node_modules:", os.path.relpath(os.path.join(root, f), OUT))
left = []
for root, dirs, files in os.walk(OUT):
    for f in files:
        if f.endswith((".html", ".js", ".json", ".css")):
            try: s = open(os.path.join(root, f), encoding="utf-8").read()
            except UnicodeDecodeError: continue
            if "127.0.0.1" in s or "localhost:8" in s: left.append(os.path.relpath(os.path.join(root, f), OUT))
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print("rewritten files:", n, "| leftovers with 127.0.0.1:", left[:10], "| total MB: %.1f" % (tot / 1048576))
