# Full snapshot of the RnD working folder

This repository is a complete copy of the `C:\RnD` working folder as it stood on the day of the last
commit. Text and code are ordinary git files. Media and binary files (images, renders, video, 3D
models, PDFs, archives) are stored through Git LFS.

## Download everything

1. Install Git and Git LFS, then run `git lfs install` once.
2. Clone:

   ```
   cd C:\
   git -c core.longpaths=true -c core.autocrlf=false -c core.eol=lf clone https://github.com/Eliranshopen/RnD.git
   ```

The download is about 50 GB. After checkout the folder takes about 150 GB on disk, because the same
media file appears in several working folders and each copy is written out.

Clone into a short folder such as `C:\RnD`: the longest path inside is about 180 characters and
Windows stops at 260 for the whole path. Keep the two line-ending settings of the command: without
them about 1,900 text files come out with Windows line endings (same content).

The "Download ZIP" button on GitHub does not include the media, only small pointer files. Use
`git clone` with Git LFS.

## What is inside

- Every folder and file of `C:\RnD`, at the same path, including the working folders under `.wt/`.
  The `.wt/<name>` folders are plain copies here, not linked git worktrees.
- `_snapshot/RnD-git-history.bundle`: the full local git history with every branch, as one file.
  To open it: `git clone _snapshot/RnD-git-history.bundle RnD-history`.
- `_snapshot/junctions.txt`: folder links that existed on the source machine. They are listed, not
  followed; their targets are other folders of this same tree or installed packages.

Three things here do not exist in the source folder and were added by the snapshot tool: this
`README.md`, the root `.gitattributes` (the Git LFS rules) and the `_snapshot/` folder.

## What is not inside

- Key files (`.env` and any file whose name starts with `.env`). They are never put in git. Copy
  them by hand from the source machine.
- Folders that an install command rebuilds: `node_modules`, Python virtual environments,
  `__pycache__`, `.next`.
- Git's own internal folders. The history is in the bundle above.
- Empty folders. Git cannot store them.

## Updating

A new snapshot is one new commit on `main`. Only the files that changed are uploaded again.
