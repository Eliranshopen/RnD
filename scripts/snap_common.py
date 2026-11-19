"""Shared rules of the full snapshot of C:/RnD: what is walked, what is left out, what goes to LFS.
No file content is read here."""
import os

ROOT = "C:/RnD"
STATE = "C:/RnD-full.git"

# Re-installable or generated folders: never in the snapshot.
# `.cache` is NOT here on purpose (2026-11-19, from the engine session): the folder
# Projects/3Dengine/pipeline/360walkaround/catalog/.cache holds a furniture pack zip that can no longer be
# downloaded, and all the .cache folders together are about 20 MB.
SKIP_DIRS = {"node_modules", "__pycache__", ".venv", "venv", ".next", ".git"}
REPARSE = 0x400

# Binary / media types: stored through Git LFS.
LFS_EXT = {
    # images
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "exr", "hdr", "psd", "heic", "avif", "tga", "dds",
    "ktx2", "basis", "ico", "icns",
    # video / audio
    "mp4", "mov", "webm", "avi", "mkv", "m4v", "mp3", "m4a", "wav", "ogg", "flac", "aac",
    # 3D
    "glb", "fbx", "blend", "blend1", "usdz", "abc", "stl", "ply", "3ds", "bin", "draco", "drc",
    # documents / archives
    "pdf", "zip", "tgz", "gz", "tar", "7z", "rar", "bz2", "xz", "docx", "xlsx", "pptx", "dwg",
    # fonts
    "woff", "woff2", "ttf", "otf", "eot",
    # data / models / binaries
    "npy", "npz", "pkl", "pt", "pth", "onnx", "safetensors", "sqlite", "db", "exe", "dll", "pyd", "so",
    "dylib", "whl", "bundle", "pack", "idx", "wasm", "dat",
}
# The part of LFS_EXT that is MEDIA: pictures, renders, video, sound, 3D files, and the zip-type packs
# of them. A snapshot made with `commit --no-media` leaves these out and keeps the rest of LFS_EXT
# (documents, fonts, small data) as ordinary git files.
MEDIA_EXT = {
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "exr", "hdr", "psd", "heic", "avif", "tga", "dds",
    "ktx2", "basis", "ico", "icns",
    "mp4", "mov", "webm", "avi", "mkv", "m4v", "mp3", "m4a", "wav", "ogg", "flac", "aac",
    "glb", "fbx", "blend", "blend1", "usdz", "abc", "stl", "ply", "3ds", "bin", "draco", "drc",
    "zip", "7z", "rar",
}
# A file of any other type this large also goes through LFS (listed by path in .gitattributes).
BIG_PLAIN = 40 * 1024 * 1024


def ext_of(name):
    i = name.rfind(".")
    return name[i + 1:].lower() if i > 0 else ""


def walk(root=ROOT, counters=None):
    """Yield (relpath_posix, abspath, size, mtime_ns). Junctions and symlinks are recorded, not followed."""
    c = counters if counters is not None else {}
    c.setdefault("env_skipped", 0)
    c.setdefault("gitfile_skipped", 0)
    c.setdefault("errors", 0)
    c.setdefault("junctions", [])
    c.setdefault("skipped_dirs", {})
    c.setdefault("empty_dirs", 0)
    stack = [(root, "")]
    while stack:
        path, rel = stack.pop()
        try:
            entries = list(os.scandir(path))
        except OSError:
            c["errors"] += 1
            continue
        if not entries and rel:
            c["empty_dirs"] += 1
        for e in entries:
            name = e.name
            if name.lower().startswith(".env"):
                c["env_skipped"] += 1
                continue
            r = rel + "/" + name if rel else name
            try:
                st = e.stat(follow_symlinks=False)
            except OSError:
                c["errors"] += 1
                continue
            is_reparse = bool(getattr(st, "st_file_attributes", 0) & REPARSE)
            if is_reparse:
                c["junctions"].append(r)
                continue
            if e.is_dir(follow_symlinks=False):
                if name in SKIP_DIRS:
                    c["skipped_dirs"][name] = c["skipped_dirs"].get(name, 0) + 1
                    continue
                stack.append((e.path, r))
                continue
            if name == ".git":
                c["gitfile_skipped"] += 1
                continue
            yield r, e.path, st.st_size, st.st_mtime_ns


def kind_of(rel, size):
    """'lfs' (by type), 'lfs-path' (big file of a plain type) or 'git'."""
    name = rel.rsplit("/", 1)[-1]
    if ext_of(name) in LFS_EXT:
        return "lfs"
    if size >= BIG_PLAIN:
        return "lfs-path"
    return "git"
