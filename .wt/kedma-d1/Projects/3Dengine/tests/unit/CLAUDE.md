# tests/unit/ — unit tests of the engine's own code
<!-- last-updated: 2026-11-16 -->

## What's here
One file per module of `engine/`: `config`, `lib`, `doctor`, `setup-env`, `setup-assets`, `cli`. Two more guard the whole:
- `all-modules.test.mjs` imports every `.mjs` under `engine/`, so no file can be missing from the coverage table.
- `env-pointers.test.mjs` scans the brought-in tools for an environment name that falls back to a machine path (`process.env.NAME || 'C:…'`) and fails if the settings file does not feed that name.

## Conventions / gotchas
- No real Python, Blender, assets or network: the outside world comes from `../helpers/fakes.mjs` or from a temp folder.
- A test that plants a fake secret must look for it in every output of the code under test.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
