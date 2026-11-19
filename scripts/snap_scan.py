"""Read-only inventory + secret scan of what the full snapshot would publish.
NEVER prints or stores a matched value: only the pattern name, the path, the line number, the value's
length and a short one-way id (so the same value in many copies is counted once).

  python -I snap_scan.py [--only <subpath>] [--max-seconds 480]
Writes C:/RnD-full.git/reports/scan-findings.tsv and scan-summary.txt; prints the summary.
"""
import argparse
import base64
import hashlib
import json
import math
import os
import pickle
import re
import sys
import tarfile
import time
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snap_common import ROOT, STATE, walk, kind_of, ext_of  # noqa: E402

V = rb"[A-Za-z0-9_\-:.+/=@%~]{16,300}"
# (name, literal that must be present before the pattern is tried, pattern). Every pattern starts with a
# literal and uses bounded repeats, so a megabyte-long line cannot make it crawl.
VENDOR = [
    ("fal-key", b":", rb"-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}"),
    ("openrouter-key", b"sk-or-v1-", rb"sk-or-v1-[0-9a-f]{40,100}"),
    ("anthropic-key", b"sk-ant-", rb"sk-ant-[A-Za-z0-9_\-]{20,200}"),
    ("openai-key", b"sk-", rb"sk-(?:proj-)?[A-Za-z0-9_\-]{32,200}"),
    ("google-api-key", b"AIza", rb"AIza[0-9A-Za-z_\-]{35}"),
    ("github-token", b"gh", rb"gh[pousr]_[A-Za-z0-9]{36,100}"),
    ("github-pat", b"github_pat_", rb"github_pat_[A-Za-z0-9_]{40,120}"),
    ("aws-access-key", b"AKIA", rb"AKIA[0-9A-Z]{16}(?![A-Z0-9])"),
    ("slack-token", b"xox", rb"xox[baprs]-[A-Za-z0-9\-]{10,120}"),
    ("stripe-clerk-secret", b"sk_", rb"sk_(?:live|test)_[A-Za-z0-9]{20,120}"),
    ("webhook-secret", b"whsec_", rb"whsec_[A-Za-z0-9+/=]{20,120}"),
    ("vercel-blob-token", b"vercel_blob_rw_", rb"vercel_blob_rw_[A-Za-z0-9_]{20,120}"),
    ("supabase-secret", b"sb_secret_", rb"sb_secret_[A-Za-z0-9_\-]{20,120}"),
    ("apify-token", b"apify_api_", rb"apify_api_[A-Za-z0-9]{30,120}"),
    ("replicate-token", b"r8_", rb"r8_[A-Za-z0-9]{30,60}"),
    ("huggingface-token", b"hf_", rb"hf_[A-Za-z0-9]{30,60}"),
    ("sendgrid-key", b"SG.", rb"SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}"),
    ("private-key-block", b"-----BEGIN", rb"-----BEGIN [A-Z ]{0,30}PRIVATE KEY-----"),
    ("jwt", b"eyJ", rb"eyJ[A-Za-z0-9_\-]{10,2000}\.eyJ[A-Za-z0-9_\-]{10,4000}\.[A-Za-z0-9_\-]{10,1000}"),
    ("url-with-password", b"://", rb"://[^/\s:@'\"<>]{1,64}:[^/\s:@'\"<>]{6,200}@[A-Za-z0-9.\-]{3,}"),
    ("bearer", b"earer", rb"earer\s{1,3}[A-Za-z0-9_\-.=+/]{30,2000}"),
]
VENDOR_C = [(n, lit, re.compile(p)) for n, lit, p in VENDOR]
BOUNDARY = {"openai-key", "stripe-clerk-secret", "replicate-token", "huggingface-token", "github-token",
            "aws-access-key"}
NAMECH = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
KEYWORDS = (b"key", b"secret", b"token", b"passw", b"auth")
ASSIGN = re.compile(
    rb"(?i)(?:api[_\-]?key|secret|token|password|passwd|private[_\-]?key|access[_\-]?key|fal_key|auth)"
    rb"[A-Za-z0-9_\-]{0,24}[\"']?\s{0,3}[:=]\s{0,3}[\"'`]?(" + V + rb")")

FAKE = (b"fake", b"test", b"plant", b"example", b"dummy", b"sample", b"placeholder", b"redact", b"xxxx",
        b"your", b"changeme", b"0000000", b"1234567", b"abcdef01", b"deadbeef", b"lorem", b"mock", b"demo")
CODEISH = (b"process.env", b"environ", b"getenv", b"import.meta", b"env.", b"config.", b"settings.", b"options.",
           b"this.", b"self.", b"args.", b"props.", b"req.", b"res.", b"=>", b"()", b"http://", b"https://")
NAME_FLAGS = re.compile(
    r"(?i)(^id_(rsa|dsa|ecdsa|ed25519)|\.pem$|\.p12$|\.pfx$|\.keystore$|\.jks$|^\.npmrc$|^\.netrc$|^\.pypirc$|"
    r"^credentials(\..*)?$|service[-_]?account.*\.json$|^secrets?\.|^token(s)?\.json$|^auth\.json$|\.key$)")


def entropy(b):
    if not b:
        return 0.0
    n = len(b)
    return -sum(c / n * math.log2(c / n) for c in Counter(b).values())


def vid(b):
    return hashlib.sha256(b"rnd-scan|" + b).hexdigest()[:10]


def jwt_role(tok):
    try:
        payload = tok.split(b".")[1]
        payload += b"=" * (-len(payload) % 4)
        d = json.loads(base64.urlsafe_b64decode(payload))
        role = str(d.get("role", ""))[:24]
        typ = "role=" + role if role else "claims=" + ",".join(sorted(d.keys()))[:60]
        return typ
    except Exception:  # noqa: BLE001
        return "undecodable"


def looks_real(v):
    low = v.lower()
    if any(w in low for w in FAKE):
        return False
    if any(w in low for w in CODEISH):
        return False
    digits = sum(48 <= c <= 57 for c in v)
    letters = sum((65 <= c <= 90) or (97 <= c <= 122) for c in v)
    return len(v) >= 20 and digits >= 4 and letters >= 6 and entropy(v) >= 3.6


def scan_bytes(data):
    """Findings of one file's bytes, without a path: (pattern, line, value_len, value_id, flag, note)."""
    out = []
    for name, lit, rx in VENDOR_C:
        if lit not in data:
            continue
        for m in rx.finditer(data):
            s = m.start()
            if name in BOUNDARY and s > 0 and data[s - 1] in NAMECH:
                continue
            v = m.group(0)
            if name == "fal-key":
                s = max(0, s - 18)
                v = data[s:m.end()]
                if not re.fullmatch(rb"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}", v):
                    continue
            note = jwt_role(v) if name == "jwt" else ""
            fake = any(w in v.lower() for w in FAKE)
            line = data.count(b"\n", 0, s) + 1
            out.append((name, line, len(v), vid(v), "fake-looking" if fake else "", note))
    low = data.lower()
    if any(k in low for k in KEYWORDS):
        for m in ASSIGN.finditer(data):
            v = m.group(1)
            if not looks_real(v):
                continue
            s = m.start()
            b = s
            while b > 0 and s - b < 30 and data[b - 1] in NAMECH:
                b -= 1
            e = s
            while e < len(data) and e - s < 60 and data[e] in NAMECH:
                e += 1
            key = data[b:e].decode("ascii", "replace")[:60]
            line = data.count(b"\n", 0, s) + 1
            out.append(("assign", line, len(v), vid(v), "", "key=" + key))
    return out


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--max-seconds", type=int, default=480)
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()
    t0 = time.time()
    rep = os.path.join(STATE, "reports")
    os.makedirs(rep, exist_ok=True)

    c = {}
    findings = []
    name_hits = []
    archive_hits = []
    sizes = defaultdict(lambda: [0, 0])
    plain_ext = defaultdict(lambda: [0, 0, 0])
    lfs_paths = []
    scanned = scanned_bytes = fresh = 0
    cut = False
    cache_path = os.path.join(rep, "scan-cache.pkl")
    cache = {}
    if os.path.isfile(cache_path):
        with open(cache_path, "rb") as f:
            cache = pickle.load(f)
    root = ROOT + ("/" + a.only.strip("/") if a.only else "")
    prefix = a.only.strip("/") + "/" if a.only else ""
    plain = []
    for rel, path, size, mtime in walk(root, c):
        rel = prefix + rel
        k = kind_of(rel, size)
        sizes[k][0] += size
        sizes[k][1] += 1
        name = rel.rsplit("/", 1)[-1]
        if NAME_FLAGS.search(name):
            name_hits.append(rel)
        if "/.vercel/" in "/" + rel:
            sizes["(in .vercel folders)"][0] += size
            sizes["(in .vercel folders)"][1] += 1
        x = ext_of(name)
        if k == "lfs-path":
            lfs_paths.append((size, rel))
        if k == "lfs":
            if x in ("zip", "tgz", "gz", "tar") and size < 300 * 1024 * 1024:
                try:
                    if x == "zip":
                        names = zipfile.ZipFile(path).namelist()
                    else:
                        with tarfile.open(path, "r:*") as tf:
                            names = tf.getnames()
                    bad = [n for n in names if os.path.basename(n).lower().startswith(".env")
                           or NAME_FLAGS.search(os.path.basename(n))]
                    if bad:
                        archive_hits.append((rel, len(bad)))
                except Exception:  # noqa: BLE001
                    pass
            continue
        e = plain_ext[x or "(none)"]
        e[0] += size
        e[1] += 1
        e[2] = max(e[2], size)
        plain.append((rel, path, size, mtime))

    # Second pass: read only the files not seen before (same path, size and time = already scanned).
    pc_path = os.path.join(rep, "scan-paths.pkl")
    pcache = {}
    if os.path.isfile(pc_path):
        with open(pc_path, "rb") as f:
            pcache = pickle.load(f)
    todo = [p for p in plain if pcache.get(p[0], (None, None, None))[:2] != (p[2], p[3])]
    print("  plain files %d, still to read %d" % (len(plain), len(todo)), file=sys.stderr, flush=True)

    def read(p):
        try:
            with open(p[1], "rb") as f:
                data = f.read()
        except OSError:
            return p, None, None
        return p, data, hashlib.blake2b(data, digest_size=16).digest()

    with ThreadPoolExecutor(max_workers=a.threads) as ex:
        for i in range(0, len(todo), 400):
            if time.time() - t0 > a.max_seconds:
                cut = True
                break
            for p, data, h in ex.map(read, todo[i:i + 400]):
                if data is None:
                    c["errors"] += 1
                    continue
                scanned += 1
                scanned_bytes += len(data)
                if h not in cache:
                    cache[h] = scan_bytes(data)
                    fresh += 1
                pcache[p[0]] = (p[2], p[3], h)
            if (i // 400) % 25 == 24:
                print("  ... %d files read, %d distinct scanned, %.0f s" % (scanned, fresh, time.time() - t0),
                      file=sys.stderr, flush=True)
    left = 0
    for p in plain:
        e = pcache.get(p[0])
        if not e or e[:2] != (p[2], p[3]):
            left += 1
            continue
        for r in cache.get(e[2], ()):
            findings.append((r[0], p[0]) + tuple(r[1:]))
    cut = cut or left > 0

    with open(cache_path, "wb") as f:
        pickle.dump(cache, f)
    with open(pc_path, "wb") as f:
        pickle.dump(pcache, f)
    with open(os.path.join(rep, "scan-findings.tsv"), "w", encoding="utf-8", newline="\n") as f:
        f.write("pattern\tpath\tline\tvalue_len\tvalue_id\tflag\tnote\n")
        for r in findings:
            f.write("\t".join(str(x) for x in r) + "\n")
    with open(os.path.join(rep, "scan-names.txt"), "w", encoding="utf-8", newline="\n") as f:
        for r in name_hits:
            f.write(r + "\n")
        for r, n in archive_hits:
            f.write("ARCHIVE %d suspicious members: %s\n" % (n, r))
    with open(os.path.join(rep, "junctions.txt"), "w", encoding="utf-8", newline="\n") as f:
        for r in c["junctions"]:
            f.write(r + "\n")

    L = []
    gb = lambda n: "%.2f GB" % (n / 1024 ** 3)  # noqa: E731
    L.append("SCAN of %s%s  (%.0f s)%s" % (root, "", time.time() - t0, "  ** CUT BY TIME: NOT COMPLETE **" if cut else ""))
    for k, v in sorted(sizes.items()):
        L.append("  kind %-22s %10s  %7d files" % (k, gb(v[0]), v[1]))
    L.append("  read in this run: %d files, %s | plain files %d, of them NOT yet scanned: %d" % (
        scanned, gb(scanned_bytes), len(plain), left))
    L.append("  left out: env-named entries %d | worktree .git pointer files %d | skipped folders %s" % (
        c["env_skipped"], c["gitfile_skipped"], dict(c["skipped_dirs"])))
    L.append("  junctions not followed %d | empty folders (git cannot keep) %d | unreadable %d" % (
        len(c["junctions"]), c["empty_dirs"], c["errors"]))
    L.append("  plain-type files of 40 MB or more (go to LFS by path): %d" % len(lfs_paths))
    for s, r in sorted(lfs_paths, reverse=True)[:12]:
        L.append("     %9s  %s" % (gb(s), r))
    L.append("  plain types by size (top 14): " + ", ".join(
        "%s %s/%d max %.0fMB" % (k, gb(v[0]), v[1], v[2] / 1048576)
        for k, v in sorted(plain_ext.items(), key=lambda kv: -kv[1][0])[:14]))
    L.append("== SECRET-PATTERN HITS (values never shown) ==")
    by = defaultdict(lambda: defaultdict(list))
    for r in findings:
        by[r[0]][r[4]].append(r)
    for pat in sorted(by):
        vals = by[pat]
        L.append("  %-20s hits %6d | distinct values %5d | files %6d" % (
            pat, sum(len(v) for v in vals.values()), len(vals), len({r[1] for v in vals.values() for r in v})))
        shown = 0
        for v_id, rows in sorted(vals.items(), key=lambda kv: -len(kv[1])):
            if shown >= 14:
                L.append("       ... %d more distinct values (see scan-findings.tsv)" % (len(vals) - shown))
                break
            shown += 1
            notes = Counter(r[6] for r in rows).most_common(2)
            flags = Counter(r[5] for r in rows).most_common(1)[0][0]
            tops = Counter(r[1].split("/")[0] + ("/" + r[1].split("/")[1] if "/" in r[1] else "") for r in rows)
            sample = min((r[1] for r in rows), key=len)
            L.append("       id %s len %3d x%-5d %-12s %s | in %s | e.g. %s:%d" % (
                v_id, rows[0][3], len(rows), flags, "; ".join(n for n, _ in notes if n),
                ", ".join("%s(%d)" % kv for kv in tops.most_common(3)), sample,
                next(r[2] for r in rows if r[1] == sample)))
    L.append("== FILE NAMES that usually hold credentials: %d (scan-names.txt) ==" % len(name_hits))
    for k, n in Counter(os.path.basename(r) for r in name_hits).most_common(15):
        L.append("     %5d  %s" % (n, k))
    L.append("== ARCHIVES with env-named or credential-named members: %d ==" % len(archive_hits))
    for r, n in archive_hits[:10]:
        L.append("     %d members  %s" % (n, r))
    text = "\n".join(L)
    with open(os.path.join(rep, "scan-summary.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write(text + "\n")
    print(text)
    sys.exit(3 if cut else 0)


if __name__ == "__main__":
    main()
