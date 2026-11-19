# card 19 (habait-ux-judge, logs/ux-review.md) fixes: F1, F2, F3 (Q2 default a), F4, F5, F6, F7, F7b, F9, F11. One-shot.
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


A = r"studio\dashboard\app.js"
patch(A, [
    # F1 (Q1 default a): a deliverable made only partly of photoreal scenes is "טיוטה", never "מוכן"; F7b: a poster frame (#t=0.5)
    ("  const chips = { empty: ['hb-chip--plain', 'ריק'], progress: ['hb-chip--info', 'בעבודה'], ready: ['hb-chip--available', 'מוכן'] };",
     "  const chips = { empty: ['hb-chip--plain', 'ריק'], progress: ['hb-chip--info', 'בעבודה'], ready: ['hb-chip--available', 'מוכן'], draft: ['hb-chip--reserved', 'טיוטה'] };"),
    ("    ? resultCard({ key: 'exterior', title: 'סרטון החוץ', stateName: 'ready', media: `<video src=\"${src(ext[0].file)}\" controls preload=\"metadata\" muted playsinline aria-label=\"${esc(ext[0].label)}\"></video>${badge}`, text: `<bdi>${ext.length}</bdi> קטעי חוץ מהסרטון של השרשרת הזו · ${durHtml(sumDur(ext))}`,",
     "    ? resultCard({ key: 'exterior', title: 'סרטון החוץ', stateName: ext.every((c) => c.source === 'photoreal') ? 'ready' : 'draft', media: `<video src=\"${src(ext[0].file)}#t=0.5\" controls preload=\"metadata\" muted playsinline aria-label=\"${esc(ext[0].label)}\"></video>${badge}`, text: `<bdi>${ext.filter((c) => c.source === 'photoreal').length}/${ext.length}</bdi> קטעי חוץ פוטוריאליים${ext.some((c) => c.source !== 'photoreal') ? ' · השאר טיוטה (clay)' : ''} · ${durHtml(sumDur(ext))}`,"),
    ("    c = resultCard({ key: 'apartment', title: `ההדמיה של הדירה · ${esc(v.name_he)}`, stateName: 'ready',\n      media: v.master ? `<video src=\"${src(v.master)}\" controls",
     "    c = resultCard({ key: 'apartment', title: `ההדמיה של הדירה · ${esc(v.name_he)}`, stateName: (v.photoreal ?? 0) >= v.clips.length ? 'ready' : 'draft',\n      media: v.master ? `<video src=\"${src(v.master)}#t=0.5\" controls"),
    # F5: the review step is marked done only when the files were read; otherwise its number
    ("  $('[data-sub=\"review\"]').textContent =",
     "  $$('[data-step=\"review\"] .stepnav__n, #h-review .step-sec__n').forEach((n) => { n.textContent = d.intake ? '✓' : '·'; });\n  $('[data-sub=\"review\"]').textContent ="),
    # F7 (Q3 default b): a raw pipeline note is English — isolated LTR under a Hebrew lead, so bidi cannot scramble it
    ("${hint ? `<p class=\"hb-step__note\" dir=\"auto\">${esc(cleanNote(hint))}</p>` : ''}",
     "${hint ? `<p class=\"hb-step__note\">${/[\\u0590-\\u05FF]/.test(hint) ? esc(hint) : `הערת המערכת: <bdi dir=\"ltr\">${esc(cleanNote(hint))}</bdi>`}</p>` : ''}"),
])
patch(r"studio\dashboard\style.css", [
    (".hb-result__media .hb-ai-badge { position: absolute; }", ".hb-result__media .hb-ai-badge { position: absolute; }\n.hb-result[data-state=\"draft\"] { border-color: var(--status-reserved); }"),
])
patch(r"studio\dashboard\index.html", [
    ('<div><p class="hb-eyebrow">Habait Studio</p><h1 class="hb-h1" id="h-projects">הפרויקטים שלי</h1></div>', '<div><h1 class="hb-h1" id="h-projects">הפרויקטים שלי</h1></div>'),   # F9
    ('<a href="#s-review" data-step="review"><span class="stepnav__n">✓</span>', '<a href="#s-review" data-step="review"><span class="stepnav__n">·</span>'),
    ('<h2 class="hb-h2" id="h-review"><span class="step-sec__n">✓</span> מה המערכת הבינה</h2>', '<h2 class="hb-h2" id="h-review"><span class="step-sec__n">·</span> מה המערכת הבינה</h2>'),
])

# F2: an action on the home page's first screen — the hero carries the project's CTA (one project) or "לפרויקטים" (several)
patch(r"platform\index.html", [
    ("      <p class=\"home-hero__sub\" data-i18n=\"home.heroSub\">טיסה סביב הפרויקט, בחירת דירה מתוך הטיסה, וכניסה פנימה.</p>",
     "      <p class=\"home-hero__sub\" data-i18n=\"home.heroSub\">טיסה סביב הפרויקט, בחירת דירה מתוך הטיסה, וכניסה פנימה.</p>\n      <p class=\"home-hero__cta\"><a class=\"hb-btn hb-btn--primary\" id=\"heroCta\" href=\"#projects\" hidden></a></p>"),
    ("    box.innerHTML = first ? `<img src=\"${esc(`${first.dir}/${first.meta.cover}`)}\" alt=\"\" fetchpriority=\"high\">${AI_BADGE}` : '';\n  }",
     "    box.innerHTML = first ? `<img src=\"${esc(`${first.dir}/${first.meta.cover}`)}\" alt=\"\" fetchpriority=\"high\">${AI_BADGE}` : '';\n"
     "    const cta = document.getElementById('heroCta');\n"
     "    cta.hidden = !projects.length;\n"
     "    if (projects.length === 1) { cta.href = targetOf(projects[0]).href; cta.textContent = t('home.cta'); cta.onclick = () => capture('project_open', { project: projects[0].id, from: 'index-hero' }); }\n"
     "    else { cta.href = '#projects'; cta.textContent = t('home.projects'); cta.onclick = null; }\n  }"),
    ("    grid.querySelectorAll('.home-card__link')", "    renderHero();\n    grid.querySelectorAll('.home-card__link')"),
])
patch(r"platform\css\home.css", [
    (".home-hero__sub {", ".home-hero__cta { margin: var(--sp-3) 0 0; }\n.home-hero__sub {"),
])

# F3 (Q2 default a): on landing arm B the flight speaks — the page's own language toggle and visible title step back
# (the title stays for screen readers); arm A is unchanged
patch(r"platform\css\landing.css", [
    ("/* body */", "/* card 19 F3: arm B — one voice above the fold (the flight's own HUD) */\nbody.page-landing[data-variant=\"b\"] .landing-top .lang-toggle { display: none; }\nbody.page-landing[data-variant=\"b\"] .landing-hero .landing-title { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n\n/* body */"),
])
# F6: '›' is a bidi-mirrored character, so the same glyph points "forward" in both directions
patch(r"platform\js\landing.js", [
    ("el('span', { class: 'avail-row__go', 'aria-hidden': 'true' }, getLang() === 'he' ? '‹' : '›')",
     "el('span', { class: 'avail-row__go', 'aria-hidden': 'true' }, '›')   /* U+203A is bidi-mirrored: it points forward in RTL and LTR */"),
])
# F4: the title row already shows rooms · area · floor; the spec grid shows the facts it does not repeat
patch(r"platform\js\apartment.js", [
    ("$('aptFacts').replaceChildren(...unitFacts().map(",
     "$('aptFacts').replaceChildren(...[...unitFacts().filter(([k]) => !['apt.fact.rooms', 'apt.fact.area', 'apt.fact.floor'].includes(k)), ...(U.type ? [['apt.fact.type', U.type]] : [])].map("),
])
# F11: the tab strip shows that it scrolls (a fade at the end edge on phones)
patch(r"platform\css\apartment.css", [
    (".apt-tabs::-webkit-scrollbar { display: none; }",
     ".apt-tabs::-webkit-scrollbar { display: none; }\n@media (max-width: 520px) {\n  [dir=\"rtl\"] .apt-tabs { -webkit-mask-image: linear-gradient(to left, transparent 0, #000 28px); mask-image: linear-gradient(to left, transparent 0, #000 28px); }\n  [dir=\"ltr\"] .apt-tabs { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px); mask-image: linear-gradient(to right, transparent 0, #000 28px); }\n}"),
])
