# dollhouse/ — context file
<!-- last-updated: 2026-11-03 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
The apartment-846 dollhouse that the platform's 3D tab shows: the cut GLB in three floor finishes (one shared BIN), the baked light atlas (`light.webp`, scale in `report.json` `bake.scale`) and the real floor textures taken from the tour's panoramas (`floor-<finish>.webp`, picks in `floor-textures.json`). Built by board apartment-3d (2026-11-03).

## What's here (2026-11-03)
16 files here · 0 subfolders · 16 files / 4.3 MB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `apt846-concrete.glb` | 250.8 KB | 2026-11-03 |
| `apt846-marble.glb` | 250.8 KB | 2026-11-03 |
| `apt846-parquet.glb` | 250.8 KB | 2026-11-03 |
| `apt846.glb` | 250.8 KB | 2026-11-03 |
| `export.log` | 16.1 KB | 2026-11-02 |
| `floor-concrete.webp` | 4.1 KB | 2026-11-03 |
| `floor-marble.webp` | 9.5 KB | 2026-11-03 |
| `floor-parquet.webp` | 7.5 KB | 2026-11-03 |
| `floor-textures.json` | 1.5 KB | 2026-11-03 |
| `light-1024.webp` | 64.1 KB | 2026-11-03 |
| `light.webp` | 153.0 KB | 2026-11-03 |
| `loadtest-cpu4.json` | 786 B | 2026-11-02 |
| `loadtest.json` | 785 B | 2026-11-02 |
| `loadtest.mjs` | 5.3 KB | 2026-11-02 |
| `report.json` | 20.2 KB | 2026-11-03 |
| `top.png` | 3.0 MB | 2026-11-03 |

## Gotchas
- Rebuild the GLBs + light with `360walkaround/pipeline/export_dollhouse.py --bake-light` (the exact command and every run: `C:/RnD/development/tasks/apartment-3d/logs/c07-bake-manifest.json`; ~5 min CPU, Blender, $0); the floor textures with `360walkaround/pipeline/floor_textures.py --pick` (the picks in `floor-textures.json`). Then `Habait/platform/tools/build_zip.mjs` inlines them.
- `light.webp` and the GLBs' UVs belong together: never ship a light atlas from another bake.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../../../../../../CLAUDE.md](../../../../../../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
