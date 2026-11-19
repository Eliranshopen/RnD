# card 11 fixes after Gate 1 FAIL (fresh reviewer, logs/gate1-report.md). One-shot; refuses if an anchor is not unique.
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


# 1. browser.mjs follows the redesigned home page (card 11); the intent of both steps is unchanged
patch("test/browser.mjs", [
    ("""    await page.waitForSelector('.project-card');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.match(await page.textContent('.project-card h2'), /Rainbow/);""",
     """    // platform-ui-ux card 11 redesigned the home page: the project card is .home-card, its title .hb-media-card__title (h3)
    await page.waitForSelector('.home-card');
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
    assert.match(await page.textContent('.home-card .hb-media-card__title'), /Rainbow/);"""),
    ("""    assert.match(await page.textContent('.index-title'), /Choose a project/);""",
     """    assert.match(await page.textContent('#galleryTitle'), /Projects/);   // card 11: the gallery heading replaced .index-title"""),
])
# 2. Hebrew singular + no summary without units
patch("index.html", [
    ("""      const summary = c ? `${t('home.units', { n: `<bdi>${c.total}</bdi>` })} · ${t('home.available', { n: `<bdi>${c.available}</bdi>` })}` : '';""",
     """      const count = (key, n) => (n === 1 ? t(`${key}1`) : t(key, { n: `<bdi>${n}</bdi>` }));
      const summary = c && c.total ? `${count('home.units', c.total)} · ${count('home.available', c.available)}` : '';"""),
])
patch("js/i18n.js", [
    ("""    'home.available': '{n} פנויות',""", """    'home.available': '{n} פנויות',
    'home.units1': 'דירה אחת',
    'home.available1': 'פנויה אחת',"""),
    ("""    'home.available': '{n} available',""", """    'home.available': '{n} available',
    'home.units1': '1 apartment',
    'home.available1': '1 available',"""),
])
# 3. hero subtitle: a deeper scrim under the text block (the reviewer measured 2.5-3.1:1 over the brightest pixels)
patch("css/home.css", [
    (""".home-hero__media::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, var(--scrim) 0%, transparent 62%); pointer-events: none; }""",
     """.home-hero__media::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, var(--scrim) 0%, var(--scrim) 38%, transparent 78%), linear-gradient(to top, var(--scrim) 0%, transparent 45%); pointer-events: none; }"""),
])
