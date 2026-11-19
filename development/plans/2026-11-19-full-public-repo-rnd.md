# A full GitHub repo of the whole C:\RnD folder (public, Git LFS)

**Date:** 2026-11-19 · **Owner:** Eliran · **State:** `DONE` for the snapshot without media (his changed ruling, below); one cleanup call is open with him · **Board:** none (harness work, steps below)

## Changed ruling, the same day (read this first)
About 90 minutes into the media upload Eliran wrote: «תעלה לי הכל אבל ללא קבצי המדיה» (and, a minute earlier: «אני רוצה להגיע למצב שאני מוריד הכל מהריפו בגיטהאב בלי תלות במחשב הזה»). The media upload was stopped and the repo now holds a snapshot WITHOUT media:

- `Eliranshopen/RnD`, public, `main` = `a195535f`: 116,261 files = 114,897 text and code files + 1,360 documents and small data files kept as ordinary git files (PDF, Excel, fonts, `.npy`, `.tgz`; 0.34 GB) + 4 generated files. No Git LFS. 250 MB.
- Left out: 79,064 media files, 93.41 GB (pictures, renders, video, sound, 3D and Blender files, zip packs). They are listed by path and size in `_snapshot/media-not-included.tsv`. The git history bundle is left out too (it carries media).
- Checked by a real anonymous download from GitHub: every one of the 116,261 files equals the snapshot byte for byte, when the clone goes into a short folder (longest inner path 182 characters) and with `-c core.autocrlf=false -c core.eol=lf` (without them 1,917 text files come out with Windows line endings, same content).
- **Not met, and said to him:** without media the repo does not rebuild the folder in full; the media exists only on this machine.
- **Open with him:** about 18 GB of media objects were uploaded to the repo's LFS store before he stopped it. No commit points at them, but a check showed GitHub serves such an object to anyone who knows its SHA-256, and they are billed as LFS storage (about 8 GiB over the free 10). Only deleting the repo removes them; the session's GitHub token has no `delete_repo` scope, so the delete is his act (then: create again + push, about two minutes). The first push (`aa0e2862`, replaced by a forced push 25 minutes later) carried a list WITH the SHA-256 of every media file; the list now holds path and size only.
- The full snapshot with media (`a92107db`, local ref `main` of `C:\RnD-full.git`, LFS store complete) stays on the disk, so a media upload can be resumed later without reading the folder again.

The sections below describe the first ruling and what was built for it.

## The ask
Eliran, 2026-11-19: «אני רוצה ריפו מלא של כל התיקיית פרויקט שלנו RnD שכשאני אוריד אותו ירד לי כל התיקיית פרויקט C:\RnD».
The existing mirror `Eliranshopen/HABAIT` holds text and code only (no media, no history, no branches).

## His decisions (question dialogs, 2026-11-19)
| Question | His answer |
|---|---|
| What goes up | Everything, the working folders under `.wt` included |
| What kind of repo | A full backup to download: a snapshot of the folder as it is on the disk, with the whole local git history and every branch inside it as one file; refreshed on his word; `main` is not pushed |
| Where | A new repo named `RnD` in the account `Eliranshopen` |
| Private or public | **Public** («ציבורי בכל זאת»), after he was told: developers' materials, the internal memory and the logs become downloadable by anyone, strangers' downloads are billed to him, and a public upload cannot be taken back |
| Cost | Accepted with the first answer: Git LFS storage beyond the free 10 GiB, and download traffic |

`Eliranshopen/HABAIT` stays as it is: public, text and code only, each sync on his word.

## What was measured (2026-11-19)
- The snapshot: 195,313 files, 96.0 GB on the disk. 114,889 text and code files (2.25 GB, 13,373 distinct), 80,424 media and binary files (93.75 GB).
- After folding identical copies (the same media sits in many working folders): **18,231 distinct media objects, 49.09 GB**. Plus the history file, 0.78 GB.
- No file over 0.39 GB; 40 files over 100 MB. The plain-git part of the push is 54 MB.
- Left out by rule: 4 entries whose name starts with `.env`, `node_modules`, Python virtual environments, `__pycache__`, `.next`, `.cache`, git's own folders. 50 junctions are listed, not followed. 54 empty folders cannot be kept by git.

## Mechanism
- A separate bare repo, `C:\RnD-full.git` (outside the tree). Nothing under `C:\RnD` is changed: files are read; media is hard-linked into that repo's LFS store.
- Tools, in `scripts/` (dry-run by default, `--go` to write, resumable):
  - `snap_scan.py` — inventory + secret scan of the working tree (values never printed).
  - `snap_history.py` — the same scan over every blob of the local git history and every commit message.
  - `snap_ingest.py ingest | status | commit` — records each file (text as a git blob, media as an LFS object), then writes one snapshot commit: the tree at the same paths + `README.md`, `.gitattributes`, `_snapshot/` (the history bundle, the junction list).
- Refresh on his word: `ingest --go` until exit 0 → both scans → `commit --go` → upload. Only changed files are read and uploaded again.

## Steps
| # | Step | State |
|---|---|---|
| 1 | Measure the folder | done: 96 GB, 195,313 files |
| 2 | Secret scan, working tree | done: 114,210 files, 0 real keys (four planted test fakes, one public widget key in a saved third-party page) |
| 3 | Proof on the smallest thing | done: one folder of 19 files → snapshot → clone → 19 of 19 byte-identical, Hebrew names included |
| 4 | Full ingest | done: everything recorded, LFS store 18,231 of 18,231 present |
| 5 | Secret scan, git history | done: 21,734 blobs + all commit messages, the same five harmless values |
| 6 | History bundle | done: 780 MB, verified, 66 refs |
| 7 | Local snapshot commit | done: `a92107db` in `C:\RnD-full.git` |
| 8 | Create the public repo and upload | repo created; media upload STOPPED on his changed ruling after about 18 GB of 49.9 GB (seven bounded rounds, about 6 MB/s; one round lost to a DNS failure at 16 parallel uploads) |
| 8b | Snapshot without media: `commit --no-media --ref refs/heads/no-media-2`, plain `git push` | done: `a195535f` on `main` of `Eliranshopen/RnD` |
| 9 | Check the upload: a fresh anonymous clone compared byte for byte | done: 116,261 of 116,261 identical (short folder, `core.eol=lf`) |
| 10 | Remove the uploaded media objects from GitHub (delete the repo, create again, push) | his call and his act |

## Cost (root §7)
Git LFS, account `Eliranshopen`: about 49.9 GiB stored, 10 GiB free → about 40 GiB billed, about **$2.8 a month** at $0.07 per GiB. Each full download of about 50 GiB → about **$3.5** at $0.0875 per GiB beyond the free 10 GiB a month, and on a public repo strangers' downloads count too. The two prices come from GitHub's pricing calculator page as read on 2026-11-19 and are not confirmed against his billing page. The account needs a Git LFS budget above $0, or GitHub blocks LFS after the free quota.

## Risks
- Public and not reversible: accepted by him.
- The scan finds key shapes and assignments; it cannot prove that no secret of an unknown shape exists.
- The tree changes while it is read (other sessions work): a file is recorded as it stood when it was read.
- A hard-linked media file that a program rewrites in place would change inside the LFS store too; the upload fails on that object and it is read again.

## Done when
The repo `Eliranshopen/RnD` holds the snapshot commit with every LFS object, and a fresh clone of a sample folder equals `C:\RnD` byte for byte.
