"""One bounded round of the Git LFS upload of C:/RnD-full.git to its remote `origin`, then (when every
object is up) the push of the snapshot commit. Resumable: Git LFS skips what the server already holds.

  python -I scripts/snap_upload.py [--seconds 500] [--go]

Dry-run by default: prints what it would run. Exit 0 = the commit is on the remote, 3 = run it again.
The credential comes from the GitHub CLI for this one command; no git config is changed.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

STATE = "C:/RnD-full.git"
REP = STATE + "/reports"
PROG = REP + "/lfs-progress.txt"
CUM = REP + "/lfs-uploaded.json"
BASE = ["git", "-C", STATE, "-c", "credential.helper=!gh auth git-credential"]


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=500)
    ap.add_argument("--transfers", type=int, default=8, help="parallel uploads; 16 choked the line once")
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--ref", default="refs/heads/main", help="local ref of C:/RnD-full.git whose objects go up")
    ap.add_argument("--no-push", action="store_true", help="upload the LFS objects only, do not push the commit")
    a = ap.parse_args()
    lfs = BASE + ["-c", "lfs.concurrenttransfers=%d" % a.transfers, "-c", "lfs.activitytimeout=120",
                  "lfs", "push", "origin", a.ref]
    push = BASE + ["push", "origin", "%s:refs/heads/main" % a.ref]
    if not a.go:
        print("would run, for at most %d s: %s\nthen, once it exits 0: %s\n(dry run; add --go)" % (
            a.seconds, " ".join(lfs[1:]), " ".join(push[1:])))
        return 0
    if os.path.exists(PROG):
        os.remove(PROG)
    nums = [int(m.group(1)) for m in (re.match(r"lfs-push-(\d+)\.log$", f) for f in os.listdir(REP)) if m]
    n = max(nums + [0]) + 1
    log = "%s/lfs-push-%d.log" % (REP, n)
    t0 = time.time()
    with open(log, "wb") as lf:
        p = subprocess.Popen(lfs, env=dict(os.environ, GIT_LFS_PROGRESS=PROG), stdout=lf, stderr=subprocess.STDOUT)
        try:
            rc = p.wait(timeout=a.seconds)
        except subprocess.TimeoutExpired:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
            p.wait()
            rc = 124
    cum = json.load(open(CUM, encoding="utf-8")) if os.path.isfile(CUM) else {}
    done, part = {}, {}
    if os.path.isfile(PROG):
        with open(PROG, "rb") as f:
            for ln in f.read().replace(b"\r", b"\n").split(b"\n"):
                m = re.match(rb"\w+ \d+/\d+ (\d+)/(\d+) (.*)", ln)
                if not m:
                    continue
                cur, tot, name = int(m.group(1)), int(m.group(2)), m.group(3).decode("utf-8", "replace")
                if cur >= tot:
                    done[name] = tot
                    part.pop(name, None)
                else:
                    part[name] = cur
    cum.update(done)
    json.dump(cum, open(CUM, "w", encoding="utf-8"))
    secs = time.time() - t0
    sent = sum(done.values()) + sum(part.values())
    print("round %d: exit %d after %.0f s | finished %d objects, %.2f GB | %.1f MB/s | counted so far %d objects, %.2f GB" % (
        n, rc, secs, len(done), sum(done.values()) / 1024 ** 3, sent / max(secs, 1) / 1e6,
        len(cum), sum(cum.values()) / 1024 ** 3))
    with open(log, "rb") as f:
        lines = [ln for ln in f.read().replace(b"\r", b"\n").split(b"\n")
                 if ln.strip() and not ln.startswith(b"Uploading LFS objects")]
    for ln in lines[-6:]:
        print("  log: " + ln.decode("utf-8", "replace")[:300])
    if rc != 0:
        return 3
    if a.no_push:
        print("every LFS object of %s is on the remote; the commit was not pushed (--no-push)" % a.ref)
        return 0
    r = subprocess.run(push, capture_output=True, text=True)
    print("push of the commit: exit %d\n%s" % (r.returncode, (r.stdout + r.stderr).strip()[-600:]))
    return 0 if r.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
