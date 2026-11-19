# Phase 4 audit fixes A1-A5 (logs/phase4-report.md). One-shot; anchors must be unique.
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


# A1: one primary action on the Studio project view — "צור" stays primary; the review's "continue" is secondary
patch(r"studio\dashboard\app.js", [
    ('<button class="hb-btn hb-btn--primary" type="button" id="btn-review-ok">', '<button class="hb-btn hb-btn--secondary" type="button" id="btn-review-ok">'),
    # A2 (Studio): the project view stays hidden until its data is in (no content jumping in after paint)
    ("  for (const v of ['projects', 'new', 'project']) $(`#view-${v}`).hidden = v !== view;",
     "  // Phase 4 A2: a view is shown only once its data is rendered (the project page jumped 0.19 CLS while it filled in)\n"
     "  for (const v of ['projects', 'new', 'project']) if (v !== view) $(`#view-${v}`).hidden = true;\n"
     "  if (view === 'new') $('#view-new').hidden = false;"),
    ("  done.then(() => {\n    if (!changed) return;",
     "  done.then(() => {\n    $(`#view-${view}`).hidden = false;\n    if (!changed) return;"),
    ("  }).catch((e) => { toast(`שגיאה: ${e.message}`); });\n}",
     "  }).catch((e) => { $(`#view-${view}`).hidden = false; toast(`שגיאה: ${e.message}`); });\n}"),
])

# A2 (landing): the arm is resolved synchronously (URL / this tab / hash of the session id) BEFORE the project loads, so the
# media section is in place at first paint; the later resolution is identical (the same pure function on the same inputs)
patch(r"platform\js\landing.js", [
    ("async function boot() {\n  const q = new URLSearchParams(location.search);\n  setLang(getLang());",
     "async function boot() {\n  const q = new URLSearchParams(location.search);\n  setLang(getLang());\n"
     "  // Phase 4 A2: show the arm's media section before anything is fetched (desktop CLS was 0.5 when it appeared ~100 ms in)\n"
     "  const early = resolveVariant({ search: location.search, sessionId: sessionId(), registered: registeredVariant() }).variant;\n"
     "  $('variantA').hidden = early !== 'a'; $('variantB').hidden = early !== 'b';"),
])
# the media boxes reserve their height before the image / frame arrives
patch(r"platform\css\landing.css", [
    (".hero-shot__media { position: relative; }", ".hero-shot__media { position: relative; aspect-ratio: 16 / 9; max-block-size: 72vh; background: var(--chrome-panel-solid); }"),
    (".flight-frame { background: var(--chrome-bg); }", ".flight-frame { background: var(--chrome-bg); min-block-size: max(420px, min(74vh, 640px)); }"),
    # A5: a deeper scrim under the tile labels (3.9:1 → ≥ 4.5:1 over bright photos)
    (".tile::after { content: ''; position: absolute; inset: 40% 0 0; background: linear-gradient(to top, var(--chrome-scrim), transparent); pointer-events: none; }",
     ".tile::after { content: ''; position: absolute; inset: 35% 0 0; background: linear-gradient(to top, var(--chrome-scrim) 0%, var(--chrome-scrim) 38%, transparent 100%); pointer-events: none; }"),
    # A3: header tap targets ≥ 44 px
    (".landing-top .lang-toggle { min-inline-size: var(--tap-min); }", ".landing-top .lang-toggle { min-inline-size: var(--tap-min); min-block-size: var(--tap-min); }\n.landing-top .brand { min-block-size: var(--tap-min); display: inline-flex; align-items: center; }"),
])
patch(r"platform\css\home.css", [
    (".home-brand { display: inline-flex; align-items: center; gap: var(--sp-3); color: var(--text); text-decoration: none; }",
     ".home-brand { display: inline-flex; align-items: center; gap: var(--sp-3); color: var(--text); text-decoration: none; min-block-size: var(--tap-min); }\n#langToggle { min-block-size: var(--tap-min); min-inline-size: var(--tap-min); }"),
])
patch(r"platform\css\apartment.css", [
    (".apt-brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: var(--fw-bold); font-size: var(--fs-h2); min-height: 36px;",
     ".apt-brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: var(--fw-bold); font-size: var(--fs-h2); min-height: var(--tap-min);"),
    (".page-apartment .lang-toggle { border-color: var(--line-strong); color: var(--brand-ink); }",
     ".page-apartment .lang-toggle { border-color: var(--line-strong); color: var(--brand-ink); min-block-size: var(--tap-min); min-inline-size: var(--tap-min); }"),
    # A4: the disclosure badge on every still of the photos tab and in its lightbox
    (".apt-photo button { padding: 0;", ".apt-photo button { position: relative; padding: 0;"),
    (".apt-lightbox { width: min(1100px, 96vw);", ".apt-photo .hb-ai-badge, .apt-lightbox .hb-ai-badge { position: absolute; inset-block-start: var(--sp-2); inset-inline-end: var(--sp-2); z-index: 1; }\n.apt-lightbox { position: relative; width: min(1100px, 96vw);"),
])
patch(r"platform\js\apartment.js", [
    ("      fig.innerHTML = `<button type=\"button\" data-i=\"${i}\"><img loading=\"lazy\" decoding=\"async\" alt=\"\"></button><figcaption></figcaption>`;",
     "      // platform-ui-ux Phase 4 A4: every AI still carries the disclosure badge (root CLAUDE.md §6)\n"
     "      fig.innerHTML = `<button type=\"button\" data-i=\"${i}\"><img loading=\"lazy\" decoding=\"async\" alt=\"\"><span class=\"hb-ai-badge\">הדמיה · <bdi>AI-generated</bdi></span></button><figcaption></figcaption>`;"),
])
patch(r"platform\apartment.html", [
    ("  <img id=\"lbImg\" alt=\"\">", "  <img id=\"lbImg\" alt=\"\">\n  <span class=\"hb-ai-badge\">הדמיה · <bdi>AI-generated</bdi></span>"),
])
