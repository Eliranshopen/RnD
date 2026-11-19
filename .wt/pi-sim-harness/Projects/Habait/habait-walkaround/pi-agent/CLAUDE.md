# pi-agent/ — the Pi agent wrapper (context file)
<!-- last-updated: 2026-11-15 -->

The wrapper that turns the Pi coding agent (`pi`, @earendil-works/pi-coding-agent) into Habait's simulation agent for EVERY Pi session on this machine (Eliran 2026-11-15: «מעטפת לPI שתהיה קיימת כל הזמן ולא רק בייחס לפרויקט»). `install-global.py` registers it in the user config (`~/.pi/agent/settings.json`: skills, prompts, extensions point HERE; `APPEND_SYSTEM.md` copied to `~/.pi/agent/`); re-run it after editing `APPEND_SYSTEM.md`. Contents: `APPEND_SYSTEM.md` (role, machine, Eliran's standing rules), `skills/` (procedures), `prompts/` (/simulate /fix /check /ship-test), `extensions/habait-guard/` (the safety gate + two tools). How to start: `README-he.md`. Plan: C:/RnD/development/plans/2026-11-15-pi-simulation-harness.md.

Parent: [../CLAUDE.md](../CLAUDE.md)
