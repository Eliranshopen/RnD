# continuation of ux_fix2.py (its index.html anchor matched twice; app.js was already patched): F9 markup, F11, F23.
import os
W = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait"


def patch(rel, pairs):
    p = os.path.join(W, rel)
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a[:70], s.count(a))
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("patched", rel)


patch(r"studio\dashboard\index.html", [
    ('<h1 class="hb-h1" id="h-projects">הפרויקטים שלי</h1></div>\n      <a class="hb-btn hb-btn--primary" href="#/new">',
     '<h1 class="hb-h1" id="h-projects">הפרויקטים שלי</h1></div>\n      <a class="hb-btn hb-btn--primary" id="projects-new" href="#/new">'),
])
patch(r"platform\css\apartment.css", [
    ('  [dir="rtl"] .apt-tabs { -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px); mask-image: linear-gradient(to left, transparent 0, #000 28px); }\n'
     '  [dir="ltr"] .apt-tabs { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px); mask-image: linear-gradient(to right, transparent 0, #000 28px); }',
     '  [dir="rtl"] .apt-tabs { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px); mask-image: linear-gradient(to right, transparent 0, #000 28px); }\n'
     '  [dir="ltr"] .apt-tabs { -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px); mask-image: linear-gradient(to left, transparent 0, #000 28px); }'),
    (".apt-spec { margin-block-start: var(--sp-1); grid-template-columns: repeat(4, minmax(0, 1fr)); }\n@media (max-width: 420px) { .apt-spec { grid-template-columns: repeat(2, minmax(0, 1fr)); } }",
     ".apt-spec { margin-block-start: var(--sp-1); grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); max-inline-size: 560px; }"),
])
patch(r"platform\js\apartment.js", [
    ("      btn.setAttribute('aria-selected', on ? 'true' : 'false');\n      btn.tabIndex = on ? 0 : -1;\n",
     "      btn.setAttribute('aria-selected', on ? 'true' : 'false');\n      btn.tabIndex = on ? 0 : -1;\n"
     "      if (on && btn.parentElement.scrollWidth > btn.parentElement.clientWidth) btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });   // platform-ui-ux F11\n"),
])
