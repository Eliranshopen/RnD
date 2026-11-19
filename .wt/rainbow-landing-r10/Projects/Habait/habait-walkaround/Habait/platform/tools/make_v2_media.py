#!/usr/bin/env python3
r"""Rainbow v2 test page media (plan development/plans/2026-11-09-rainbow-v2.md). $0: local ffmpeg + headless Chrome only, no paid call.

Writes platform/v2/media/ from media already on disk, every output with a manifest row (input, sha256, args, cost 0):
  * tower-16-{1920,960}.jpg, tower-16-portrait.jpg  the hold's stop pose = frame 91 of its Kling arc track (research/.../flyover3d/data/
        holdarc/jpg_hi/frame_0091.jpg, camera.json centre_frame 91 = the orbit clip's end pose). Re-encode / 2:3 crop only, no edit.
        Apartment 846's terrace point (site_nodes.json apartment_hotspot_world) projects through that frame's camera to
        (0.4979, 0.7883) of the frame, floor band ±1.6 m = y 0.7565 … 0.8201 (FLOOR16 below; the page reads it from media/manifest.json).
  * room-<id>-{wide,tall}.webp, room-<id>-thumb.webp  flat straight-ahead views (ffmpeg v360 reprojection, no edit) of the GATED tour
        panoramas tour360/dist/apt846/panos/*.webp (2048x1024). Yaw per room picked by eye from an 8-yaw contact sheet.
  * dollhouse.webp  a still of the live apartment dollhouse (tour360/dist/apt846/3d/dollhouse.html, preset 3d), captured in headless
        Chrome with its own UI and labels hidden and a transparent background (tools/capture_v2_dollhouse.mjs), trimmed.
Every output is AI-made property imagery (Kling film frames, AI-skinned panoramas, the AI-assisted dollhouse): the page shows
«הדמיה · AI-generated» on each (root §6).

usage: python tools/make_v2_media.py          dry run: prints what it would run
       python tools/make_v2_media.py --go     runs it (idempotent: a step whose output, input hash and args match its row is skipped)
Exit non-zero with the reason on stderr on any failure (root §5).
"""
import datetime, hashlib, json, math, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLATFORM = os.path.dirname(HERE)
OUT = os.path.join(PLATFORM, "v2", "media")
HABAIT = os.path.normpath(os.path.join(PLATFORM, "..", "..", ".."))     # Projects/Habait
MAIN = r"C:\RnD\Projects\Habait"                                      # media outside git (research/, tour dist) is read from the main checkout

def src(rel):
    for base in (HABAIT, MAIN):
        p = os.path.join(base, *rel.split("/"))
        if os.path.isfile(p): return p
    sys.exit(f"make_v2_media: input missing: {rel}")

HOLD_REL = "research/fal-bench-2026-11-02/flyover3d/data/holdarc/jpg_hi/frame_0091.jpg"
DOLL_REL = "habait-walkaround/Habait/tour360/dist/apt846/3d/dollhouse.html"
PANOS = "habait-walkaround/Habait/tour360/dist/apt846/panos/"
# grounded in the hold's own camera (holdarc/camera.json frame 91) and the 3D site anchor (site_nodes.json apartment_hotspot_world)
FLOOR16 = {"anchor": [0.4979, 0.7883], "band": [0.7565, 0.8201], "frame": HOLD_REL, "floor_to_floor_m": 3.2,
           "source": "projection of site_nodes.json apartment_hotspot_world (10.325, -11.148, 1.0) and ±1.6 m through holdarc/camera.json frame 91"}
# portrait crop of the 1920x1080 frame: 720 px wide around the tower (x 0.18-0.58 of the frame), anchor x 956 falls inside
PORTRAIT_X = 367

# tour room id, pano, yaw, pitch (picked by eye, scratch contact sheet of 8 yaws per room, 2026-11-09)
ROOMS = [
    ("entrance", "01-entrance", 0, -4),
    ("living", "04-living", -40, -4),
    ("kitchen", "02-kitchen", -150, -6),
    ("dining", "03-dining", -30, -6),
    ("terraceLiving", "05-terrace-living", 30, -4),
    ("bedroomMain", "07-bedroom-main", -135, -6),
    ("bathMain", "09-bath-main", -15, 2),
    ("bedroom2", "10-bedroom-2", -60, -6),
]

def vfov(h, w_px, h_px):   # rectilinear: tan(v/2) = tan(h/2) * H / W
    return round(math.degrees(2 * math.atan(math.tan(math.radians(h / 2)) * h_px / w_px)), 2)

def flat(yaw, pitch, hf, w, h):
    return f"v360=input=e:output=flat:h_fov={hf}:v_fov={vfov(hf, w, h)}:yaw={yaw}:pitch={pitch}:w={w}:h={h}:interp=lanczos"

WEBP = ["-c:v", "libwebp", "-quality", "80", "-compression_level", "6", "-map_metadata", "-1"]
STEPS = [
    ("tower-16-1920.jpg", HOLD_REL, ["-q:v", "3", "-map_metadata", "-1"]),
    ("tower-16-960.jpg", HOLD_REL, ["-vf", "scale=960:-2:flags=lanczos", "-q:v", "3", "-map_metadata", "-1"]),
    ("tower-16-portrait.jpg", HOLD_REL, ["-vf", f"crop=720:1080:{PORTRAIT_X}:0", "-q:v", "3", "-map_metadata", "-1"]),
]
for rid, pano, yaw, pitch in ROOMS:
    STEPS += [
        (f"room-{rid}-wide.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 84, 1600, 900), *WEBP]),
        (f"room-{rid}-tall.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 62, 900, 1350), *WEBP]),
        (f"room-{rid}-thumb.webp", PANOS + pano + ".webp", ["-frames:v", "1", "-vf", flat(yaw, pitch, 84, 320, 180), *WEBP]),
    ]
STEPS.append(("dollhouse.webp", DOLL_REL, ["@capture", "viewport=1600x1000", "dpr=1.5", "preset=3d", "ui+labels hidden", "alpha", "trim", "webp q86"]))

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def main():
    go = "--go" in sys.argv
    ff = shutil.which("ffmpeg") or sys.exit("make_v2_media: ffmpeg not on PATH")
    if go: os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, "manifest.json")
    man = json.load(open(mpath, encoding="utf-8")) if os.path.isfile(mpath) else {"schema": "habait.media-manifest.v0", "plan": "development/plans/2026-11-09-rainbow-v2.md", "rows": []}
    man["floor16"] = FLOOR16
    man["rooms"] = [{"id": r, "pano": p, "yaw": y, "pitch": pt} for r, p, y, pt in ROOMS]
    done = {r["output"]: r for r in man["rows"]}
    for name, rel, args in STEPS:
        inp, dst = src(rel), os.path.join(OUT, name)
        in_sha = sha(inp)
        prev = done.get(name)
        if prev and os.path.isfile(dst) and prev.get("sha256") == sha(dst) and prev.get("input_sha256") == in_sha and prev.get("args") == args:
            print("skip (checkpoint):", name); continue
        if args[0] == "@capture":
            cmd = ["node", os.path.join(HERE, "capture_v2_dollhouse.mjs"), inp, dst]
            tool = "headless Chrome (playwright-core, appdeps) + sharp"
        else:
            cmd = [ff, "-v", "error", "-y", "-i", inp, *args, dst]
            tool = "ffmpeg " + subprocess.run([ff, "-version"], capture_output=True, text=True).stdout.split()[2]
        print(("run: " if go else "dry: ") + " ".join(f'"{c}"' if " " in c or ";" in c else c for c in cmd))
        if not go: continue
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=540)
        if r.returncode != 0 or not os.path.isfile(dst):
            sys.stderr.write(f"make_v2_media: failed on {name}: {(r.stderr or r.stdout)[-800:]}\n"); sys.exit(1)
        done[name] = {"output": name, "bytes": os.path.getsize(dst), "sha256": sha(dst), "input": rel, "input_sha256": in_sha,
                      "args": args, "tool": tool, "cost_usd": 0, "ai_generated": True,
                      "disclosure": "הדמיה · AI-generated (root §6)", "at": datetime.datetime.now().isoformat(timespec="seconds")}
        print(f"  {name}: {done[name]['bytes'] / 1024:.0f} KB sha256 {done[name]['sha256'][:12]}")
    if go:
        man["rows"] = [done[n] for n, _, _ in STEPS if n in done]
        json.dump(man, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("manifest:", mpath)

if __name__ == "__main__":
    main()
