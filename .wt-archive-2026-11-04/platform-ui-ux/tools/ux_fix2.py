# card 19 re-check fixes: F5 leftover, F7, F11, F23, F9. One-shot; anchors must be unique.
import os, re
W = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait"


def patch(rel, pairs):
    p = os.path.join(W, rel)
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a[:70], s.count(a))
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("patched", rel)


A = os.path.join(W, r"studio\dashboard\app.js")
s = open(A, encoding="utf-8").read()
# F5: "·" not read yet · "!" read, with items to check · "✓" read and nothing uncertain
old5 = "n.textContent = d.intake ? '✓' : '·';"
assert s.count(old5) == 1
s = s.replace(old5, "n.textContent = !d.intake ? '·' : (d.intake.uncertainties?.length ? '!' : '✓');")
# F7: a note is shown raw only when it is mostly Hebrew; otherwise isolated LTR under a Hebrew lead
m = re.search(r"\$\{/\[\\u0590-\\u05FF\]/\.test\(hint\) \? esc\(hint\) : ", s)
assert m, "F7 anchor"
s = s.replace(m.group(0), "${((hint.match(/[\\u0590-\\u05FF]/g) || []).length > (hint.match(/[A-Za-z]/g) || []).length) ? esc(hint) : ", 1)
# F9: one "פרויקט חדש" on the empty list (the empty state carries it)
old9 = "  $('#projects-empty').hidden = state.projects.length > 0;"
assert s.count(old9) == 1
s = s.replace(old9, old9 + "\n  $('#projects-new').hidden = !state.projects.length;")
open(A, "w", encoding="utf-8", newline="").write(s)
print("patched studio app.js")
patch(r"studio\dashboard\index.html", [
    ('      <a class="hb-btn hb-btn--primary" href="#/new">פרויקט חדש</a>\n    </div>', '      <a class="hb-btn hb-btn--primary" id="projects-new" href="#/new">פרויקט חדש</a>\n    </div>'),
])

# F11: in RTL the hidden tabs are at the LEFT (end) edge — fade there; the selected tab scrolls into view
patch(r"platform\css\apartment.css", [
    ('  [dir="rtl"] .apt-tabs { -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px); mask-image: linear-gradient(to left, transparent 0, #000 28px); }\n'
     '  [dir="ltr"] .apt-tabs { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px); mask-image: linear-gradient(to right, transparent 0, #000 28px); }',
     '  [dir="rtl"] .apt-tabs { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px); mask-image: linear-gradient(to right, transparent 0, #000 28px); }\n'
     '  [dir="ltr"] .apt-tabs { -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px); mask-image: linear-gradient(to left, transparent 0, #000 28px); }'),
    # F23: the spec grid fits its cells (two cells = two columns), never an empty slab
    (".apt-spec { margin-block-start: var(--sp-1); grid-template-columns: repeat(4, minmax(0, 1fr)); }\n@media (max-width: 420px) { .apt-spec { grid-template-columns: repeat(2, minmax(0, 1fr)); } }",
     ".apt-spec { margin-block-start: var(--sp-1); grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); max-inline-size: 560px; }"),
])
patch(r"platform\js\apartment.js", [
    ("      btn.setAttribute('aria-selected', on ? 'true' : 'false');\n      btn.tabIndex = on ? 0 : -1;\n",
     "      btn.setAttribute('aria-selected', on ? 'true' : 'false');\n      btn.tabIndex = on ? 0 : -1;\n"
     "      if (on && btn.parentElement.scrollWidth > btn.parentElement.clientWidth) btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });   // platform-ui-ux F11\n"),
])
