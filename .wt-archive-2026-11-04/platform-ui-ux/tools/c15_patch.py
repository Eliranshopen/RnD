# card 15: flow-real.css onto the chrome tokens — colour, font and radius values only (no position, size, timing).
p = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform\css\flow-real.css"
s = open(p, encoding="utf-8").read()
pairs = [
    ("background: rgba(4, 7, 14, .94); border-top: 1px solid var(--chrome-line);", "background: color-mix(in srgb, var(--chrome-bg) 94%, transparent); border-top: 1px solid var(--chrome-line);"),
    ("  color: rgba(244, 246, 251, .88); font-size: 11px;", "  color: color-mix(in srgb, var(--chrome-fg) 88%, transparent); font-size: 11px;"),
    ("width: min(560px, calc(100% - 24px)); padding: 8px 12px; border-radius: 12px;", "width: min(560px, calc(100% - 24px)); padding: 8px 12px; border-radius: var(--r-md);"),
    ("background: rgba(4, 7, 14, .66); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border: 1px solid rgba(255, 255, 255, .10);",
     "background: color-mix(in srgb, var(--chrome-bg) 66%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border: 1px solid var(--chrome-line);"),
    ("  color: #f4f6fb; font-size: 11.5px; line-height: 1.45; text-align: center; pointer-events: none; text-shadow: 0 1px 3px rgba(0, 0, 0, .6);",
     "  color: var(--chrome-fg); font-size: 11.5px; line-height: 1.45; text-align: center; pointer-events: none; text-shadow: var(--chrome-text-shadow);"),
    ("  color: var(--fg); border-radius: 999px; padding: 10px 18px;", "  color: var(--fg); border-radius: var(--r-full); padding: 10px 18px;"),
]
for a, b in pairs:
    assert s.count(a) == 1, (a[:60], s.count(a))
    s = s.replace(a, b)
s = s.replace("/* card 34 (2026-11-03): the legal caption v1", "/* platform-ui-ux card 15: colour, font and radius come from the chrome tokens (css/tokens.css); positions, sizes and timing unchanged.\n   card 34 (2026-11-03): the legal caption v1", 1)
open(p, "w", encoding="utf-8", newline="").write(s)
print("flow-real.css patched")
