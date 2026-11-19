"""Secret scan of the whole local git history of C:/RnD (every blob of a plain type reachable from any
ref, plus every commit message). Values are never printed. Reuses the working-tree scan's cache.

  python -I snap_history.py [--max-seconds 420]
"""
import argparse
import hashlib
import os
import pickle
import subprocess
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import snap_common as C  # noqa: E402
import snap_scan as S  # noqa: E402


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-seconds", type=int, default=420)
    a = ap.parse_args()
    t0 = time.time()
    rep = os.path.join(C.STATE, "reports")
    cache_path = os.path.join(rep, "scan-cache.pkl")
    cache = pickle.load(open(cache_path, "rb")) if os.path.isfile(cache_path) else {}
    done_path = os.path.join(rep, "history-done.pkl")
    done = pickle.load(open(done_path, "rb")) if os.path.isfile(done_path) else {}

    out = subprocess.run(["git", "-C", C.ROOT, "-c", "core.quotepath=false", "rev-list", "--objects", "--all"],
                         capture_output=True, check=True).stdout
    path_of = {}
    for ln in out.split(b"\n"):
        sha, _, p = ln.partition(b" ")
        if p:
            path_of.setdefault(sha.decode(), p.decode("utf-8", "replace"))
    plain = {s: p for s, p in path_of.items() if C.ext_of(p.rsplit("/", 1)[-1]) not in C.LFS_EXT}
    todo = [s for s in plain if s not in done]
    print("objects with a path %d | plain-type %d | still to read %d" % (len(path_of), len(plain), len(todo)),
          file=sys.stderr, flush=True)

    cut = False
    if todo:
        cf = subprocess.Popen(["git", "-C", C.ROOT, "cat-file", "--batch"], stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE)
        for i, sha in enumerate(todo):
            if i % 500 == 0 and time.time() - t0 > a.max_seconds:
                cut = True
                break
            cf.stdin.write(sha.encode() + b"\n")
            cf.stdin.flush()
            head = cf.stdout.readline().split()
            if len(head) < 3 or head[1] != b"blob":
                if len(head) == 3:
                    cf.stdout.read(int(head[2]) + 1)
                done[sha] = None
                continue
            data = cf.stdout.read(int(head[2]))
            cf.stdout.read(1)
            h = hashlib.blake2b(data, digest_size=16).digest()
            if h not in cache:
                cache[h] = S.scan_bytes(data)
            done[sha] = h
        cf.stdin.close()
        cf.wait()

    msgs = subprocess.run(["git", "-C", C.ROOT, "log", "--all", "--format=%H%n%B%n"], capture_output=True).stdout
    msg_hits = S.scan_bytes(msgs)

    pickle.dump(cache, open(cache_path, "wb"))
    pickle.dump(done, open(done_path, "wb"))

    by = defaultdict(lambda: defaultdict(list))
    for sha, h in done.items():
        if h is None or sha not in plain:
            continue
        for r in cache.get(h, ()):
            by[r[0]][r[3]].append((plain[sha], r))
    left = sum(1 for s in plain if s not in done)
    print("HISTORY SCAN of %s: %d plain blobs read, %d left%s (%.0f s)" % (
        C.ROOT, len(plain) - left, left, "  ** NOT COMPLETE **" if (cut or left) else "", time.time() - t0))
    for pat in sorted(by):
        vals = by[pat]
        print("  %-20s hits %5d | distinct values %4d" % (pat, sum(len(v) for v in vals.values()), len(vals)))
        for v_id, rows in sorted(vals.items(), key=lambda kv: -len(kv[1]))[:14]:
            flags = Counter(r[1][4] for r in rows).most_common(1)[0][0]
            notes = Counter(r[1][5] for r in rows).most_common(1)[0][0]
            sample = min((r[0] for r in rows), key=len)
            print("       id %s len %3d x%-4d %-12s %s | e.g. %s" % (v_id, rows[0][1][2], len(rows), flags, notes, sample))
    print("  commit messages: %d pattern hits%s" % (
        len(msg_hits), "" if not msg_hits else " -> " + ", ".join("%s(id %s)" % (r[0], r[3]) for r in msg_hits[:8])))
    sys.exit(3 if (cut or left) else 0)


if __name__ == "__main__":
    main()
