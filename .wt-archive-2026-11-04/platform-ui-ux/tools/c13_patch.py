# card 13: the existing CSS onto the tokens. Explicit replacements; each anchor must occur the stated number of times.
import os, re
P = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform"
S = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\studio\dashboard"


def patch(path, pairs, regex_all=()):
    s = open(path, encoding="utf-8").read()
    for a, b, *n in pairs:
        want = n[0] if n else 1
        got = s.count(a)
        assert got == want, (os.path.basename(path), a[:60], got, want)
        s = s.replace(a, b)
    for a, b in regex_all:
        s = re.sub(a, b, s)
    open(path, "w", encoding="utf-8", newline="").write(s)
    print("patched", os.path.basename(path))


# ---------------- style.css ----------------
ROOT_OLD = """/* Habait platform v0 - mobile-first, RTL-aware (logical properties), white-label via CSS vars set from project.json */
:root {
  --primary: #0f5c8f;
  --accent: #f2a900;
  --bg: #0b1220;
  --fg: #f4f6fb;
  --muted: rgba(244, 246, 251, 0.66);
  --panel: rgba(12, 18, 32, 0.82);
  --panel-solid: #121a2c;
  --line: rgba(255, 255, 255, 0.12);
  --ok: #3ddc84;
  --warn: #f2a900;
  --sold: #ff5c6c;
  --radius: 16px;
  --shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
  --font: 'Heebo', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;"""
ROOT_NEW = """/* Habait platform - mobile-first, RTL-aware (logical properties), white-label via CSS vars set from project.json.
   platform-ui-ux card 13: every value comes from the design tokens. The legacy names below stay (the flight, landing, apartment
   page, js/picker.js and the :8899 hold use them) and map onto the CHROME tokens: dark over the media in both themes.
   tokens.css is imported here so a host that loads only this file (the hold viewer, cross-origin) still gets them.
   --line was renamed --chrome-line: tokens.css owns --line (the theme's divider), and a second :root --line here shadowed it. */
@import url("tokens.css");
:root {
  --primary: var(--brand-primary);
  --accent: var(--brand-accent);
  --bg: var(--chrome-bg);
  --fg: var(--chrome-fg);
  --muted: var(--chrome-muted);
  --panel: var(--chrome-panel);
  --panel-solid: var(--chrome-panel-solid);
  --ok: var(--chrome-ok);
  --warn: var(--chrome-warn);
  --sold: var(--chrome-sold);
  --radius: var(--r-md);
  --shadow: var(--chrome-shadow);
  --font: var(--font-text);"""
style = os.path.join(P, "css", "style.css")
patch(style, [
    (ROOT_OLD, ROOT_NEW),
    (".btn { \n", ".btn { \n", 0),
    ("border: 1px solid transparent; border-radius: 999px; padding: 10px 18px;", "border: 1px solid transparent; border-radius: var(--r-full); padding: 10px 18px;"),
    (".btn-primary { background: var(--primary); color: #fff; }", ".btn-primary { background: var(--primary); color: var(--brand-on-primary); }"),
    (".btn-accent { background: var(--accent); color: #111; }", ".btn-accent { background: var(--accent); color: var(--brand-on-accent); }"),
    (".btn-whatsapp { background: #25d366; color: #0b1a10; }", ".btn-whatsapp { background: var(--whatsapp); color: var(--on-whatsapp); }"),
    ("display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px;", "display: inline-block; padding: 3px 10px; border-radius: var(--r-full); font-size: 12px;"),
    (".badge-fixture { background: rgba(242, 169, 0, 0.18); color: var(--accent); border: 1px solid rgba(242,169,0,.4); }",
     ".badge-fixture { background: color-mix(in srgb, var(--chrome-warn) 18%, transparent); color: var(--chrome-warn); border: 1px solid color-mix(in srgb, var(--chrome-warn) 40%, transparent); }"),
    (".badge-for-sale { background: rgba(61, 220, 132, .16); color: var(--ok); }", ".badge-for-sale { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }"),
    (".badge-reserved { background: rgba(242, 169, 0, .16); color: var(--warn); }", ".badge-reserved { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }"),
    (".badge-sold { background: rgba(255, 92, 108, .16); color: var(--sold); }", ".badge-sold { background: color-mix(in srgb, var(--sold) 16%, transparent); color: var(--sold); }"),
    (".badge-unknown { background: rgba(154, 164, 178, .16); color: #9aa4b2; }", ".badge-unknown { background: color-mix(in srgb, var(--chrome-unknown) 16%, transparent); color: var(--chrome-unknown); }"),
    (".brand-mark { width: 26px; height: 26px; border-radius: 7px;", ".brand-mark { width: 26px; height: 26px; border-radius: var(--r-sm);"),
    ("border: 3px solid var(--accent); border-bottom: 0; border-radius: 12px 12px 0 0; }", "border: 3px solid var(--accent); border-block-end: 0; border-start-start-radius: var(--r-md); border-start-end-radius: var(--r-md); }"),
    (".lang-toggle { background: transparent; border: 1px solid var(--line); border-radius: 999px;", ".lang-toggle { background: transparent; border: 1px solid var(--line); border-radius: var(--r-full);"),
    (".project-cover { aspect-ratio: 16 / 9; background: #223 center / cover no-repeat; }", ".project-cover { aspect-ratio: 16 / 9; background: var(--chrome-panel-solid) center / cover no-repeat; }"),
    (".project-logo { background: #fffcf9; padding: 6px 10px; border-radius: 6px; box-sizing: content-box; }", ".project-logo { background: var(--n-0); padding: 6px 10px; border-radius: var(--r-sm); box-sizing: content-box; }"),
    (".stage { position: absolute; inset: 0; background: #000; }", ".stage { position: absolute; inset: 0; background: var(--chrome-bg); }"),
    ("padding: 6px 10px 6px 8px; border-radius: 999px; background: var(--panel); backdrop-filter: blur(8px);", "padding: 6px 10px 6px 8px; border-radius: var(--r-full); background: var(--panel); backdrop-filter: blur(8px);"),
    ("  box-shadow: 0 4px 16px rgba(0,0,0,.4); white-space: nowrap;", "  box-shadow: var(--chrome-shadow-sm); white-space: nowrap;"),
    (".hotspot:hover, .hotspot:focus-visible { border-color: var(--accent); background: rgba(20, 30, 50, .95); }", ".hotspot:hover, .hotspot:focus-visible { border-color: var(--accent); background: var(--chrome-panel-hover); }"),
    (".hotspot .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px rgba(61,220,132,.25); }",
     ".hotspot .dot { width: 10px; height: 10px; border-radius: var(--r-full); background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 25%, transparent); }"),
    (".hotspot.status-reserved .dot { background: var(--warn); box-shadow: 0 0 0 3px rgba(242,169,0,.25); }", ".hotspot.status-reserved .dot { background: var(--warn); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 25%, transparent); }"),
    (".hotspot.status-sold .dot { background: var(--sold); box-shadow: 0 0 0 3px rgba(255,92,108,.25); }", ".hotspot.status-sold .dot { background: var(--sold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sold) 25%, transparent); }"),
    (".hotspot.status-unknown .dot { background: #9aa4b2; box-shadow: 0 0 0 3px rgba(154,164,178,.25); }", ".hotspot.status-unknown .dot { background: var(--chrome-unknown); box-shadow: 0 0 0 3px color-mix(in srgb, var(--chrome-unknown) 25%, transparent); }"),
    (".hotspot.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,.4); }", ".hotspot.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent), var(--chrome-shadow-sm); }"),
    ("background: linear-gradient(to bottom, rgba(0,0,0,.55), transparent); }", "background: linear-gradient(to bottom, var(--chrome-shade), transparent); }"),
    ("background: linear-gradient(to top, rgba(0,0,0,.55), transparent); }", "background: linear-gradient(to top, var(--chrome-shade), transparent); }"),
    ("color: var(--fg); text-shadow: 0 1px 6px rgba(0,0,0,.7); overflow: hidden;", "color: var(--fg); text-shadow: var(--chrome-text-shadow); overflow: hidden;"),
    ("  width: 40px; height: 36px; border-radius: 999px; border: 1px solid var(--line);", "  width: 40px; height: 36px; border-radius: var(--r-full); border: 1px solid var(--line);"),
    ("backdrop-filter: blur(8px); border-radius: 999px; padding: 8px 14px; cursor: pointer; font-weight: 600; min-height: 40px; }", "backdrop-filter: blur(8px); border-radius: var(--r-full); padding: 8px 14px; cursor: pointer; font-weight: 600; min-height: 40px; }"),
    (".hud-hint { font-size: 12px; color: var(--muted); text-shadow: 0 1px 4px rgba(0,0,0,.8); }", ".hud-hint { font-size: 12px; color: var(--muted); text-shadow: var(--chrome-text-shadow); }"),
    (".progress { height: 3px; background: rgba(255,255,255,.18); border-radius: 2px; overflow: hidden; }", ".progress { height: 3px; background: var(--chrome-track); border-radius: var(--r-full); overflow: hidden; }"),
    ("  padding: 24px 16px; background: radial-gradient(ellipse at center, rgba(11,18,32,.55), rgba(11,18,32,.92));", "  padding: 24px 16px; background: radial-gradient(ellipse at center, var(--chrome-shade), var(--chrome-scrim));"),
    ("  background: var(--panel-solid); border-radius: 20px 20px 0 0; box-shadow: var(--shadow); border-top: 1px solid var(--line);",
     "  background: var(--panel-solid); border-start-start-radius: var(--r-md); border-start-end-radius: var(--r-md); box-shadow: var(--shadow); border-block-start: 1px solid var(--line);"),
    (".sheet-handle { width: 44px; height: 4px; border-radius: 2px;", ".sheet-handle { width: 44px; height: 4px; border-radius: var(--r-full);"),
    ("width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: transparent; cursor: pointer; font-size: 20px;", "width: 36px; height: 36px; border-radius: var(--r-full); border: 1px solid var(--line); background: transparent; cursor: pointer; font-size: 20px;"),
    ("background: none; border: 1px solid rgba(255,255,255,.18); color: var(--muted); border-radius: 999px;", "background: none; border: 1px solid var(--chrome-line-strong); color: var(--muted); border-radius: var(--r-full);"),
    (".fact { background: rgba(255,255,255,.05); border: 1px solid var(--line); border-radius: 12px;", ".fact { background: var(--chrome-well); border: 1px solid var(--line); border-radius: var(--r-md);"),
    ("  font: inherit; color: var(--fg); background: rgba(255,255,255,.06); border: 1px solid var(--line); border-radius: 10px;", "  font: inherit; color: var(--fg); background: var(--chrome-well); border: 1px solid var(--line); border-radius: var(--r-sm);"),
    ("max-height: calc(100dvh - 180px); border-radius: 20px; border: 1px solid var(--line); padding-top: 14px; }", "max-height: calc(100dvh - 180px); border-radius: var(--r-md); border: 1px solid var(--line); padding-top: 14px; }"),
    ("text-align: start; padding: 10px; border-radius: 12px;", "text-align: start; padding: 10px; border-radius: var(--r-md);"),
    (".unit-row:hover { background: rgba(255,255,255,.05); border-color: var(--line); }", ".unit-row:hover { background: var(--chrome-well); border-color: var(--line); }"),
    ("backdrop-filter: blur(8px); border-radius: 999px; padding: 10px 16px; font-size: 13px; max-width: 92vw;", "backdrop-filter: blur(8px); border-radius: var(--r-full); padding: 10px 16px; font-size: 13px; max-width: 92vw;"),
    (".spinner { width: 42px; height: 42px; border-radius: 50%; border: 3px solid rgba(255,255,255,.2);", ".spinner { width: 42px; height: 42px; border-radius: var(--r-full); border: 3px solid var(--chrome-track);"),
    ("max-width: calc(100% - 24px); padding: 8px 18px; border-radius: 999px; background: var(--panel);", "max-width: calc(100% - 24px); padding: 8px 18px; border-radius: var(--r-full); background: var(--panel);"),
    ("display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 6px 12px; border-radius: 999px;", "display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 6px 12px; border-radius: var(--r-full);"),
    (".picker-legend .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); }", ".picker-legend .dot { width: 9px; height: 9px; border-radius: var(--r-full); background: var(--ok); }"),
    (".picker-legend .status-unknown .dot { background: #9aa4b2; }", ".picker-legend .status-unknown .dot { background: var(--chrome-unknown); }"),
    (".picker-hint { font-size: 13px; color: var(--fg); text-shadow: 0 1px 4px rgba(0,0,0,.8); }", ".picker-hint { font-size: 13px; color: var(--fg); text-shadow: var(--chrome-text-shadow); }"),
    ("color: var(--muted); text-align: center; text-shadow: 0 1px 4px rgba(0,0,0,.8); }", "color: var(--muted); text-align: center; text-shadow: var(--chrome-text-shadow); }"),
], regex_all=[(r"var\(--line\)", "var(--chrome-line)")])

# ---------------- landing.css ----------------
patch(os.path.join(P, "css", "landing.css"), [
    ("border: 1px solid var(--line); border-radius: 12px; overflow: hidden;", "border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden;"),
    ("font-size: 13px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,.8); }", "font-size: 13px; font-weight: 700; text-shadow: var(--chrome-text-shadow); }"),
    ("font-size: 10px; color: rgba(255,255,255,.8); text-shadow: 0 1px 3px rgba(0,0,0,.9); }", "font-size: 10px; color: var(--chrome-muted); text-shadow: var(--chrome-text-shadow); }"),
    (".lightbox::backdrop { background: rgba(0,0,0,.8); }", ".lightbox::backdrop { background: var(--chrome-scrim); }"),
    ("max-height: 72vh; object-fit: contain; background: #000; }", "max-height: 72vh; object-fit: contain; background: var(--chrome-bg); }"),
    (".flight-frame { border-radius: var(--radius); overflow: hidden; background: #000;", ".flight-frame { border-radius: var(--radius); overflow: hidden; background: var(--chrome-bg);"),
], regex_all=[(r"var\(--line\)", "var(--chrome-line)")])

# ---------------- flow-real.css: only the forced --line rename (its token pass is card 15) ----------------
patch(os.path.join(P, "css", "flow-real.css"), [], regex_all=[(r"var\(--line\)", "var(--chrome-line)")])

# ---------------- dashboard.css (dev analytics page, never deployed) ----------------
patch(os.path.join(P, "css", "dashboard.css"), [
    ("""  --bg: #0b1220; --fg: #f4f6fb; --muted: rgba(244, 246, 251, 0.66); --panel: #121a2c; --line: rgba(255, 255, 255, 0.12);
  --primary: #0f5c8f; --hot: #ff6b3d; --warm: #f2a900; --cold: #4fa3ff; --ok: #3ddc84; --sold: #ff5c6c;
  --radius: 14px; --font: 'Heebo', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;""",
     """  --bg: var(--chrome-bg); --fg: var(--chrome-fg); --muted: var(--chrome-muted); --panel: var(--chrome-panel-solid);
  --primary: var(--brand-primary); --hot: var(--heat-hot); --warm: var(--heat-warm); --cold: var(--heat-cold); --ok: var(--chrome-ok); --sold: var(--chrome-sold);
  --radius: var(--r-md); --font: var(--font-text);"""),
    ("padding: calc(10px + var(--safe-top)) 16px 10px; background: rgba(11, 18, 32, 0.92);", "padding: calc(10px + var(--safe-top)) 16px 10px; background: var(--chrome-panel);"),
    ("border: 1px solid var(--line); border-radius: 999px;", "border: 1px solid var(--line); border-radius: var(--r-full);"),
    ("padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #0b1220; }", "padding: 2px 10px; border-radius: var(--r-full); font-size: 12px; font-weight: 700; color: var(--chrome-on-light); }"),
    ("color: var(--fg); background: #0b1220; border: 1px solid var(--line); border-radius: 10px;", "color: var(--fg); background: var(--chrome-bg); border: 1px solid var(--line); border-radius: var(--r-sm);"),
    (".adv-form fieldset { border: 1px solid var(--line); border-radius: 10px;", ".adv-form fieldset { border: 1px solid var(--line); border-radius: var(--r-sm);"),
], regex_all=[(r"var\(--line\)", "var(--chrome-line)")])
# dashboard.css loads no tokens today: import them first
d = os.path.join(P, "css", "dashboard.css")
s = open(d, encoding="utf-8").read()
if not s.startswith('@import url("tokens.css");'):
    s = '@import url("tokens.css"); /* platform-ui-ux card 13: values from the design tokens */\n' + s
open(d, "w", encoding="utf-8", newline="").write(s)

# ---------------- Studio style.css: the two radius literals left ----------------
patch(os.path.join(S, "style.css"), [
    ("border-block-end: 0; border-radius: 10px 10px 0 0; }", "border-block-end: 0; border-start-start-radius: var(--r-md); border-start-end-radius: var(--r-md); }"),
    (".wizard__steps span { inline-size: 24px; block-size: 24px; border-radius: 50%;", ".wizard__steps span { inline-size: 24px; block-size: 24px; border-radius: var(--r-full);"),
    (".stepnav__n { grid-row: span 2; inline-size: 28px; block-size: 28px; border-radius: 50%;", ".stepnav__n { grid-row: span 2; inline-size: 28px; block-size: 28px; border-radius: var(--r-full);"),
    (".step-sec__n { inline-size: 32px; block-size: 32px; border-radius: 50%;", ".step-sec__n { inline-size: 32px; block-size: 32px; border-radius: var(--r-full);"),
])
