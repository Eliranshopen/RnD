"""Full snapshot of C:/RnD into the bare repo C:/RnD-full.git (text as git blobs, media through Git LFS).
Nothing under C:/RnD is changed: files are read, and media is hard-linked into the LFS store.

  python -I snap_ingest.py ingest [--kinds git|lfs|all] [--only <subpath>] [--max-seconds 420] [--go]
  python -I snap_ingest.py status
  python -I snap_ingest.py commit [--message "..."] [--go]

Dry-run by default: without --go it only prints what it would do. Resumable: a file with the same
path, size and time as a recorded one is never read again. Exit 0 = complete, 3 = more runs needed.
"""
import argparse
import hashlib
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import snap_common as C  # noqa: E402

RESERVED = {"con", "prn", "aux", "nul"} | {"com%d" % i for i in range(1, 10)} | {"lpt%d" % i for i in range(1, 10)}
POINTER = "version https://git-lfs.github.com/spec/v1\noid sha256:%s\nsize %d\n"


def gb(n):
    return "%.2f GB" % (n / 1024 ** 3)


def bad_name(rel):
    for part in rel.split("/"):
        if part.split(".")[0].lower() in RESERVED or part.endswith((" ", ".")):
            return True
    return False


def db_open(state):
    con = sqlite3.connect(os.path.join(state, "snapshot.sqlite"))
    con.execute("CREATE TABLE IF NOT EXISTS files(rel TEXT PRIMARY KEY, size INT, mtime INT, kind TEXT, oid TEXT)")
    con.execute("CREATE TABLE IF NOT EXISTS blobs(sha TEXT PRIMARY KEY)")
    return con


def git(state, *args, **kw):
    return subprocess.run(["git", "-C", state] + list(args), **kw)


def ensure_repo(state):
    if not os.path.isfile(os.path.join(state, "HEAD")):
        os.makedirs(state, exist_ok=True)
        git(state, "init", "--bare", "-q", "-b", "main", check=True)
        git(state, "config", "gc.auto", "0", check=True)
        git(state, "config", "core.longpaths", "true", check=True)


def load_exclude(state):
    p = os.path.join(state, "reports", "exclude.txt")
    if not os.path.isfile(p):
        return set()
    with open(p, encoding="utf-8") as f:
        return {ln.strip() for ln in f if ln.strip() and not ln.startswith("#")}


def inventory(root, only, state, counters):
    prefix = only.strip("/") + "/" if only else ""
    base = root + ("/" + only.strip("/") if only else "")
    excl = load_exclude(state)
    out = []
    for rel, path, size, mtime in C.walk(base, counters):
        rel = prefix + rel
        if rel in excl:
            counters["excluded"] = counters.get("excluded", 0) + 1
            continue
        if bad_name(rel):
            counters.setdefault("bad_names", []).append(rel)
            continue
        kind = C.kind_of(rel, size)
        if size == 0:
            kind = "git"
        out.append((rel, path, size, mtime, kind))
    return out


def read_text(item):
    try:
        with open(item[1], "rb") as f:
            data = f.read()
        st = os.stat(item[1])
    except OSError:
        return item, None, None
    if st.st_size != item[2] or st.st_mtime_ns != item[3] or len(data) != item[2]:
        return item, None, None
    sha = hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()
    return item, data, sha


def make_lfs_worker(state):
    store = os.path.join(state, "lfs", "objects")

    def work(item):
        path = item[1]
        h = hashlib.sha256()
        try:
            with open(path, "rb", buffering=0) as f:
                while True:
                    b = f.read(4 << 20)
                    if not b:
                        break
                    h.update(b)
            st = os.stat(path)
        except OSError:
            return item, None
        if st.st_size != item[2] or st.st_mtime_ns != item[3]:
            return item, None
        oid = h.hexdigest()
        d = os.path.join(store, oid[:2], oid[2:4])
        target = os.path.join(d, oid)
        if not os.path.exists(target):
            os.makedirs(d, exist_ok=True)
            try:
                os.link(path, target)
            except FileExistsError:
                pass
            except OSError:
                tmp = target + ".tmp%d" % os.getpid()
                shutil.copyfile(path, tmp)
                os.replace(tmp, target)
        return item, oid

    return work


def cmd_ingest(a):
    t0 = time.time()
    counters = {}
    items = inventory(a.root, a.only, a.state, counters)
    have = {}
    if os.path.isfile(os.path.join(a.state, "snapshot.sqlite")):
        con = db_open(a.state)
        have = {r[0]: (r[1], r[2], r[3]) for r in con.execute("SELECT rel,size,mtime,kind FROM files")}
        con.close()
    todo = [it for it in items if have.get(it[0]) != (it[2], it[3], it[4])]
    kinds = ("git", "lfs", "lfs-path") if a.kinds == "all" else (("git",) if a.kinds == "git" else ("lfs", "lfs-path"))
    todo_now = [it for it in todo if it[4] in kinds]
    print("inventory %d files %s | recorded already %d | still to read: text %d (%s), media %d (%s)" % (
        len(items), gb(sum(i[2] for i in items)), len(items) - len(todo),
        sum(1 for i in todo if i[4] == "git"), gb(sum(i[2] for i in todo if i[4] == "git")),
        sum(1 for i in todo if i[4] != "git"), gb(sum(i[2] for i in todo if i[4] != "git"))))
    if counters.get("bad_names"):
        print("left out, names Windows cannot check out: %d" % len(counters["bad_names"]))
    if not a.go:
        print("(dry run: nothing read or written; add --go)")
        return 3 if todo else 0

    ensure_repo(a.state)
    con = db_open(a.state)
    known = {r[0] for r in con.execute("SELECT sha FROM blobs")}
    cut = False
    done_n = done_b = skipped = 0

    text = [it for it in todo_now if it[4] == "git"]
    if text:
        fi = subprocess.Popen(["git", "-C", a.state, "fast-import", "--quiet"], stdin=subprocess.PIPE)
        rows, new_blobs = [], []
        with ThreadPoolExecutor(max_workers=a.threads) as ex:
            for i in range(0, len(text), 400):
                if time.time() - t0 > a.max_seconds:
                    cut = True
                    break
                for item, data, sha in ex.map(read_text, text[i:i + 400]):
                    if data is None:
                        skipped += 1
                        continue
                    if sha not in known:
                        fi.stdin.write(b"blob\ndata %d\n" % len(data))
                        fi.stdin.write(data)
                        fi.stdin.write(b"\n")
                        known.add(sha)
                        new_blobs.append((sha,))
                    rows.append((item[0], item[2], item[3], "git", sha))
                    done_n += 1
                    done_b += item[2]
        fi.stdin.close()
        if fi.wait() != 0:
            print("fast-import failed: nothing recorded for this run", file=sys.stderr)
            return 1
        con.executemany("INSERT OR IGNORE INTO blobs VALUES(?)", new_blobs)
        con.executemany("INSERT OR REPLACE INTO files VALUES(?,?,?,?,?)", rows)
        con.commit()
        print("text: recorded %d files (%s), %d new distinct blobs, %.0f s" % (
            done_n, gb(done_b), len(new_blobs), time.time() - t0))

    media = sorted((it for it in todo_now if it[4] != "git"), key=lambda it: it[0])
    n = b = 0
    if media and not cut:
        work = make_lfs_worker(a.state)
        last = time.time()
        with ThreadPoolExecutor(max_workers=a.threads) as ex:
            for i in range(0, len(media), 64):
                if time.time() - t0 > a.max_seconds:
                    cut = True
                    break
                rows = []
                for item, oid in ex.map(work, media[i:i + 64]):
                    if oid is None:
                        skipped += 1
                        continue
                    rows.append((item[0], item[2], item[3], item[4], oid))
                    n += 1
                    b += item[2]
                con.executemany("INSERT OR REPLACE INTO files VALUES(?,?,?,?,?)", rows)
                con.commit()
                if time.time() - last > 60:
                    last = time.time()
                    print("  ... media %d files, %s, %.0f s" % (n, gb(b), time.time() - t0), file=sys.stderr, flush=True)
        print("media: recorded %d files (%s), %.0f s" % (n, gb(b), time.time() - t0))
    con.close()
    remaining = len(todo) - done_n - n
    print("skipped (changed while read, or unreadable): %d | %s" % (
        skipped, "MORE RUNS NEEDED: %d files left" % remaining if remaining else "everything is recorded"))
    return 3 if remaining else 0


def cmd_status(a):
    con = db_open(a.state)
    for kind, n, s in con.execute("SELECT kind,COUNT(*),SUM(size) FROM files GROUP BY kind"):
        print("  recorded %-9s %7d files %10s" % (kind, n, gb(s or 0)))
    n, s = con.execute("SELECT COUNT(*),SUM(size) FROM (SELECT oid,MAX(size) size FROM files WHERE kind!='git' GROUP BY oid)").fetchone()
    print("  distinct LFS objects: %d, %s  (this is what GitHub stores and bills)" % (n, gb(s or 0)))
    n = con.execute("SELECT COUNT(*) FROM blobs").fetchone()[0]
    print("  distinct text blobs: %d" % n)
    con.close()
    return 0


def attr_pattern(ext):
    return "*." + "".join("[%s%s]" % (ch, ch.upper()) if ch.isalpha() else ch for ch in ext)


def esc_path(rel):
    out = []
    for ch in rel:
        if ch == " ":
            out.append("[[:space:]]")
        elif ch in "[]*?\\#!\"":
            out.append("\\" + ch)
        else:
            out.append(ch)
    return "/" + "".join(out)


def cmd_commit(a):
    counters = {}
    items = inventory(a.root, a.only, a.state, counters)
    con = db_open(a.state)
    have = {r[0]: r[1:] for r in con.execute("SELECT rel,size,mtime,kind,oid FROM files")}
    con.close()
    entries, fresh, stale, missing = [], 0, 0, 0
    exts, by_path = set(), []
    for rel, path, size, mtime, kind in items:
        h = have.get(rel)
        if not h:
            missing += 1
            continue
        if (h[0], h[1]) == (size, mtime):
            fresh += 1
        else:
            stale += 1
        entries.append((rel, h[0], h[2], h[3]))
        if h[2] == "lfs":
            exts.add(C.ext_of(rel.rsplit("/", 1)[-1]))
        elif h[2] == "lfs-path":
            by_path.append(rel)
    lfs_n = sum(1 for e in entries if e[2] != "git")
    print("snapshot: %d files (%d text, %d media) | as on disk now %d | older recorded version %d | not recorded yet %d" % (
        len(entries), len(entries) - lfs_n, lfs_n, fresh, stale, missing))
    print("junctions (listed, not followed) %d | empty folders (listed) %d | env-named left out %d" % (
        len(counters["junctions"]), counters["empty_dirs"], counters["env_skipped"]))
    if not a.go:
        print("(dry run: no commit written; add --go)")
        return 0

    attrs = ["# Written by the full-snapshot tool. Media and binary types are stored through Git LFS.",
             "* -text"]
    attrs += ["%s filter=lfs diff=lfs merge=lfs -text" % attr_pattern(x) for x in sorted(exts) if x]
    attrs += ["%s filter=lfs diff=lfs merge=lfs -text" % esc_path(r) for r in sorted(by_path)]
    extra = {".gitattributes": "\n".join(attrs) + "\n"}
    extra["_snapshot/junctions.txt"] = "".join(r + "\n" for r in sorted(counters["junctions"]))
    if a.readme and os.path.isfile(a.readme):
        with open(a.readme, encoding="utf-8") as f:
            extra["README.md"] = f.read()
    # Files from outside the tree (the history bundle): hashed, linked into the LFS store, added as pointers.
    extra_lfs = []
    for spec in a.extra_lfs:
        dest, _, src = spec.partition("=")
        size = os.path.getsize(src)
        _, oid = make_lfs_worker(a.state)((dest, src, size, os.stat(src).st_mtime_ns, "lfs"))
        if oid is None:
            print("could not read extra file: %s" % src, file=sys.stderr)
            return 1
        extra_lfs.append((dest, size, "lfs", oid))
        exts.add(C.ext_of(dest.rsplit("/", 1)[-1]))
    attrs = attrs[:2] + ["%s filter=lfs diff=lfs merge=lfs -text" % attr_pattern(x) for x in sorted(exts) if x] + \
        ["%s filter=lfs diff=lfs merge=lfs -text" % esc_path(r) for r in sorted(by_path)]
    extra[".gitattributes"] = "\n".join(attrs) + "\n"
    entries += extra_lfs
    if a.no_media:
        # No LFS at all: media stays out (listed with its sha256), documents and small data become git files.
        kept, left_out, too_big = [], [], []
        for e in entries:
            if e[2] == "git":
                kept.append(e)
            elif e in extra_lfs or C.ext_of(e[0].rsplit("/", 1)[-1]) in C.MEDIA_EXT:
                left_out.append(e)
            elif e[1] > 95 * 1024 * 1024:
                too_big.append(e)
            else:
                kept.append((e[0], e[1], "doc", e[3]))
        left_out += too_big
        docs = [e for e in kept if e[2] == "doc"]
        print("no-media snapshot: text %d | documents and data kept as git files %d (%s) | media left out %d (%s)" % (
            len(kept) - len(docs), len(docs), gb(sum(e[1] for e in docs)), len(left_out), gb(sum(e[1] for e in left_out))))
        entries = kept
        extra[".gitattributes"] = "# Written by the full-snapshot tool: keep every file byte for byte.\n* -text\n"
        # Path and size only. The sha256 of each left-out file stays in the local state (snapshot.sqlite):
        # on a public repo a published hash would let anyone fetch an LFS object that was ever uploaded there.
        extra["_snapshot/media-not-included.tsv"] = "path\tsize_bytes\n" + "".join(
            "%s\t%d\n" % (e[0], e[1]) for e in sorted(left_out))
        extra_lfs = []
    clash = [k for k in list(extra) + [e[0] for e in extra_lfs] if k in have]
    if clash:
        print("a generated file would overwrite a real one: %s" % clash, file=sys.stderr)
        return 1

    parent = git(a.state, "rev-parse", "-q", "--verify", a.ref, capture_output=True, text=True).stdout.strip()
    now = int(time.time())
    msg = (a.message or "Full snapshot of C:/RnD").encode("utf-8")
    fi = subprocess.Popen(["git", "-C", a.state, "fast-import", "--quiet"], stdin=subprocess.PIPE)
    w = fi.stdin.write
    w(b"commit %s\n" % a.ref.encode())
    w(b"committer %s %d +0200\n" % (a.identity.encode("utf-8"), now))
    w(b"data %d\n%s\n" % (len(msg), msg))
    if parent:
        w(b"from %s\n" % parent.encode())
    w(b"deleteall\n")
    for k, v in sorted(extra.items()):
        d = v.encode("utf-8")
        w(b"M 100644 inline %s\ndata %d\n%s\n" % (k.encode("utf-8"), len(d), d))
    for rel, size, kind, oid in entries:
        p = rel.encode("utf-8")
        if kind == "git":
            w(b"M 100644 %s %s\n" % (oid.encode(), p))
        elif kind == "doc":
            with open(os.path.join(a.state, "lfs", "objects", oid[:2], oid[2:4], oid), "rb") as f:
                d = f.read()
            if hashlib.sha256(d).hexdigest() != oid:
                print("stored copy of %s no longer matches its hash: read it again with ingest" % rel, file=sys.stderr)
                fi.kill()
                return 1
            w(b"M 100644 inline %s\ndata %d\n" % (p, len(d)))
            w(d)
            w(b"\n")
        else:
            d = (POINTER % (oid, size)).encode()
            w(b"M 100644 inline %s\ndata %d\n%s\n" % (p, len(d), d))
    w(b"\n")
    fi.stdin.close()
    if fi.wait() != 0:
        print("fast-import failed: no commit", file=sys.stderr)
        return 1
    head = git(a.state, "rev-parse", a.ref, capture_output=True, text=True).stdout.strip()
    print("commit %s on %s of %s" % (head, a.ref, a.state))
    return 0


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["ingest", "status", "commit"])
    ap.add_argument("--root", default=C.ROOT)
    ap.add_argument("--state", default=C.STATE)
    ap.add_argument("--only", default="")
    ap.add_argument("--kinds", default="all", choices=["all", "git", "lfs"])
    ap.add_argument("--max-seconds", type=int, default=420)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--message", default="")
    ap.add_argument("--readme", default="")
    ap.add_argument("--extra-lfs", action="append", default=[], help="dest/in/snapshot=C:/source/file")
    ap.add_argument("--identity", default="Eliran Shopen <eliran@habait.ai>")
    ap.add_argument("--ref", default="refs/heads/main", help="local ref of C:/RnD-full.git the commit is written to")
    ap.add_argument("--no-media", action="store_true", help="leave media out, no LFS; documents become git files")
    ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
    sys.exit({"ingest": cmd_ingest, "status": cmd_status, "commit": cmd_commit}[a.cmd](a))


if __name__ == "__main__":
    main()
