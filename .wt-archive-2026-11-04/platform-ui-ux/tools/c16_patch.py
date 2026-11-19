# card 16: the apartment page frame (apartment.html, page-level apartment.js). The 3D tab and js/apartment-3d.js are untouched.
import os
P = r"C:\RnD\.wt\platform-ui-ux\files\Projects\Habait\habait-walkaround\Habait\platform"


def patch(rel, pairs):
    p = os.path.join(P, rel)
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert s.count(a) == 1, (rel, a[:70], s.count(a))
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="").write(s)
    print("patched", rel)


patch("apartment.html", [
    ('<html lang="he" dir="rtl">', '<html lang="he" dir="rtl" data-theme="light">'),
    ('<meta name="theme-color" content="#0b1220">', '<meta name="theme-color" content="#fffcf9">'),
    ('<link rel="stylesheet" href="css/style.css">\n<link rel="stylesheet" href="css/apartment.css">',
     '<link rel="preload" href="fonts/heebo-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n'
     '<link rel="stylesheet" href="css/tokens.css">\n<link rel="stylesheet" href="css/components.css">\n'
     '<link rel="stylesheet" href="css/style.css">\n<link rel="stylesheet" href="css/apartment.css">'),
    ('<body class="page-apartment">', '<body class="page-apartment hb-base">'),
    ('    <p class="apt-project" id="aptProject"></p>', '    <p class="apt-summary" id="aptSummary"></p>\n    <p class="apt-project" id="aptProject"></p>'),
    ('    <div class="unit-facts" id="aptFacts"></div>', '    <dl class="hb-spec apt-spec" id="aptFacts"></dl>'),
    ('  <a class="btn btn-ghost" id="callBtn2" data-i18n="apt.agent.call">התקשרו</a>\n</div>',
     '  <a class="btn btn-ghost" id="callBtn2" data-i18n="apt.agent.call">התקשרו</a>\n  <a class="btn btn-ghost" id="zipBtn2" href="#" aria-label="ZIP">ZIP</a>\n</div>'),
])

patch(os.path.join("js", "apartment.js"), [
    # title row: the unit number in <bdi>; a summary line rooms · area · floor, numbers in <bdi>
    ("    $('aptTitle').textContent = t('apt.title', { unit: U.id });",
     """    // platform-ui-ux card 16: title + summary with every number in <bdi>
    const withBdi = (node, text, value) => { const [pre, post] = text.split('\\u0000'); const b = document.createElement('bdi'); b.textContent = String(value); node.replaceChildren(pre, b, post ?? ''); };
    withBdi($('aptTitle'), t('apt.title', { unit: '\\u0000' }), U.id);
    const sum = $('aptSummary'); sum.replaceChildren();
    for (const [k, v, unit] of [['apt.fact.rooms', U.rooms], ['apt.fact.area', U.area_m2, true], ['apt.fact.floor', U.floor]]) {
      if (v === undefined || v === null) continue;
      if (sum.childNodes.length) sum.append(' · ');
      const b = document.createElement('bdi'); b.textContent = String(v);
      if (k === 'apt.fact.floor') sum.append(`${t(k)} `, b); else sum.append(b, ` ${t(k)}`);
    }"""),
    ("    if (U.status) { st.hidden = false; st.className = `badge badge-${U.status}`; st.textContent = t(`status.${U.status}`); }",
     "    const CHIP = { 'for-sale': 'hb-chip--available', reserved: 'hb-chip--reserved', sold: 'hb-chip--sold' };\n"
     "    if (U.status) { st.hidden = false; st.className = `hb-chip ${CHIP[U.status] || ''}`; st.textContent = t(`status.${U.status}`); }"),
    ("    $('aptFacts').innerHTML = unitFacts().map(([k, v]) => `<div class=\"fact\"><b>${v}</b><span>${t(k)}</span></div>`).join('');",
     "    // the spec grid (components.css .hb-spec): label + value, numbers in <bdi>\n"
     "    $('aptFacts').replaceChildren(...unitFacts().map(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = t(k); const dd = document.createElement('dd'); const b = document.createElement('bdi'); b.textContent = String(v); dd.append(b); d.append(dt, dd); return d; }));"),
    # the phone bar's ZIP: the same target and the same handler as the card's ZIP button
    ("  zipBtn.addEventListener('click', async (e) => {",
     "  const zipBtn2 = $('zipBtn2');\n"
     "  if (zipBtn2) { if (m.zip?.src) { zipBtn2.href = zipBtn.href; zipBtn2.setAttribute('download', zipBtn.getAttribute('download')); }\n"
     "    zipBtn2.addEventListener('click', (e) => { e.preventDefault(); zipBtn.click(); }); }\n"
     "  zipBtn.addEventListener('click', async (e) => {"),
])

# style.css: the temporary --line alias for the held apartment.css goes (apartment.css is migrated now)
patch(os.path.join("css", "style.css"), [
    ("/* TEMPORARY until card 16: css/apartment.css is still held by .wt/apartment-3d and reads var(--line) for its dark-page dividers.\n"
     "   Scoped to that page so the tokens' --line stays the theme divider everywhere else. Card 16 renames it there and removes this. */\n"
     ".page-apartment { --line: var(--chrome-line); }\n", ""),
])
