# fonts/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The platform's self-hosted web fonts (OFL): Heebo variable (UI and body) and Frank Ruhl Libre 500/700 (display headings), declared in `../css/tokens.css`. Board platform-ui-ux, card 05. Since round 9 of the Rainbow landing (2026-11-09) also Bellefair 400 (display) and Assistant variable (text), declared in `../css/rainbow-landing.css` for the landing only.

## What's here
`*.woff2` (Hebrew, Latin and Latin-ext subsets) · `OFL-Heebo.txt`, `OFL-FrankRuhlLibre.txt`, `OFL-Bellefair.txt`, `OFL-Assistant.txt` (licences) · `SOURCES.md` (each file's URL, version, sha256, the first-paint budget).

## Gotchas
- Never add a Google Fonts `<link>`; a new face is fetched here with its URL and sha256 in `SOURCES.md`.
- A commercial Israeli face costs money and is Eliran's call (plan default 3).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
