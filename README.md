# Snapshot of the RnD working folder, without media

This repository is a copy of the `C:\RnD` working folder as it stood on the day of the last commit:
every folder and every text, code and document file, at the same path, including the working folders
under `.wt/`. Media files are not included.

## Download

```
cd C:\
git -c core.longpaths=true -c core.autocrlf=false -c core.eol=lf clone https://github.com/Eliranshopen/RnD.git
```

No Git LFS is needed. The "Download ZIP" button on GitHub gives the same files.

Two things make the download equal to the source byte for byte (checked on 2026-11-19: 116,261 of
116,261 files identical):

- Clone into a short folder such as `C:\RnD`. The longest path inside is 182 characters, and Windows
  stops at 260 for the whole path.
- Keep the two line-ending settings of the command above. Without them about 1,900 text files come
  out with Windows line endings; their content is the same.

## What is inside

- All text and code: Markdown, JSON, JavaScript, Python, HTML, CSS, logs, CSV and the rest.
- Documents and small data files: PDF, Excel, fonts, `.npy`, `.tgz`.
- The `.wt/<name>` folders as plain copies of the working folders, not linked git worktrees.
- `_snapshot/media-not-included.tsv`: every media file that was left out, with its path and size. It
  tells exactly what is missing here.
- `_snapshot/junctions.txt`: folder links that existed on the source machine (listed, not followed).

Three things here do not exist in the source folder and were added by the snapshot tool: this
`README.md`, the root `.gitattributes` and the `_snapshot/` folder.

## What is not inside

- **Media**: pictures, renders, video, sound, 3D models and Blender files, and zip packs of them
  (`png jpg webp exr hdr mp4 mp3 glb blend bin zip` and similar). They exist only on the source
  machine. The folder cannot be rebuilt in full from this repository alone.
- The git history and branches of the source machine. This repository holds snapshots only.
- Key files (`.env` and any file whose name starts with `.env`). They are never put in git.
- Folders that an install command rebuilds: `node_modules`, Python virtual environments,
  `__pycache__`, `.next`, `.cache`.
- Empty folders. Git cannot store them.

## Updating

A new snapshot is one new commit on `main`.
