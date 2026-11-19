# card 10: dev gates, font links, developer-mark plate. One-shot; refuses if an anchor is not unique.
import os
P = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform"
HEAD = ('<link rel="preload" href="fonts/heebo-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n'
        '<link rel="stylesheet" href="css/tokens.css">\n')


def patch(rel, pairs):
    p = os.path.join(P, rel)
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a[:70], s.count(a))
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("patched", rel)


patch("index.html", [
    ('<link rel="stylesheet" href="css/style.css">', HEAD + '<link rel="stylesheet" href="css/style.css">'),
    ("  import { capture } from './js/analytics.js';\n", "  import { capture } from './js/analytics.js';\n  import { DEV } from './js/dev.js';\n"),
    ("  // Development artefacts (fixture badge, backup-flow link, the v0 footer) show only on the laptop or with ?dev=1 (habait-98's request, 2026-11-02).\n  const DEV = new URLSearchParams(location.search).get('dev') === '1' || ['127.0.0.1', 'localhost'].includes(location.hostname);\n",
     "  // Development artefacts (fixture badge, backup-flow link, the v0 footer) show only on the laptop or with ?dev=1 (habait-98's request, 2026-11-02); DEV lives in js/dev.js.\n"),
])
patch("landing.html", [
    ('<link rel="stylesheet" href="css/style.css">', HEAD + '<link rel="stylesheet" href="css/style.css">'),
])
patch("flow.html", [
    ('<link rel="stylesheet" href="css/style.css">', HEAD + '<link rel="stylesheet" href="css/style.css">\n<script type="module" src="js/dev.js"></script>'),
])
patch("js/landing.js", [
    ("  $('fixtureBadge').hidden = !ctx.meta.fixture;", "  $('fixtureBadge').hidden = !(DEV && ctx.meta.fixture);   // dev label: laptop or ?dev=1 only (js/dev.js)"),
])
# import DEV at the top of landing.js, after its last import line
p = os.path.join(P, "js", "landing.js")
lines = open(p, encoding="utf-8").read().split("\n")
last = max(i for i, l in enumerate(lines) if l.startswith("import "))
lines.insert(last + 1, "import { DEV } from './dev.js';")
open(p, "w", encoding="utf-8", newline="").write("\n".join(lines))
print("landing.js: DEV import after line", last + 1)
patch("css/style.css", [
    (".project-logo { height: 28px; width: auto; justify-self: start; color: var(--fg); }",
     ".project-logo { height: 28px; width: auto; justify-self: start; color: var(--fg); }\n"
     "/* platform-ui-ux card 10: the developer mark sits on a light plate (the logo has no light variant in project.json); measured ≥ 3:1 */\n"
     ".project-logo { background: #fffcf9; padding: 6px 10px; border-radius: 6px; box-sizing: content-box; }\n"
     "/* dev labels a script outside this board toggles (flow.js #fixtureNote): hidden unless js/dev.js marked <html data-dev=\"1\"> */\n"
     "html:not([data-dev=\"1\"]) #fixtureNote { display: none !important; }"),
])
