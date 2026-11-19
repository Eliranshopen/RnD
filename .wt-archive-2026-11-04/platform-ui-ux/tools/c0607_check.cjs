// cards 06+07 check: the Studio on the read-only fixture API. usage: node c0607_check.cjs <base> <frames-dir> <out-json> [--empty]
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const [BASE, FR, OUT] = process.argv.slice(2); const EMPTY = process.argv.includes('--empty');
fs.mkdirSync(FR, { recursive: true });
const PID = 'apt846-rainbow-tlv';
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const tmpPdf = path.join(os.tmpdir(), 'c06-tiny-plan.pdf');
fs.writeFileSync(tmpPdf, '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj 2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj 3 0 obj<</Type /Page /Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { frames: [], sizes: {} };
  for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage();
    const errs = [], posts = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 160)} @ ${p.url().replace(BASE, '')}`); });
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 160)}`));
    p.on('response', (r) => { if (r.request().method() !== 'GET') posts.push(`${r.request().method()} ${r.url().replace(BASE, '')} -> ${r.status()}`); });
    const R = { errors: errs, nonGET: posts, hscroll: {}, rawFloatHits: {} };
    const shot = async (name, opt = {}) => {
      await p.waitForTimeout(350);
      const m = await p.evaluate(() => { const de = document.documentElement; const txt = document.body.innerText; return { sw: de.scrollWidth, cw: de.clientWidth, floats: txt.match(/\d+\.\d{3,}/g) || [] }; });
      R.hscroll[name] = m.sw > m.cw ? `${m.sw}/${m.cw}` : false; R.rawFloatHits[name] = m.floats;
      const f = `${FR}/${sz}_${name}.png`; await p.screenshot({ path: f, fullPage: Boolean(opt.full) }); report.frames.push(f.replace(/\\/g, '/'));
    };
    const shotEl = async (name, sel) => { await p.waitForTimeout(350); const el = await p.$(sel); const f = `${FR}/${sz}_${name}.png`; await el.screenshot({ path: f }); report.frames.push(f.replace(/\\/g, '/')); };
    await p.goto(`${BASE}/#/`, { waitUntil: 'load' }); await p.waitForTimeout(900);
    if (EMPTY) { await shot('00_projects_empty'); R.emptyStateVisible = await p.isVisible('#projects-empty'); await ctx.close(); report.sizes[sz] = R; continue; }
    await shot('01_projects');
    // new-project wizard + a refused POST
    await p.goto(`${BASE}/#/new`); await p.waitForTimeout(500); await shot('02_new');
    await p.fill('#new-form [name=name]', 'בדיקה · פרויקט'); await p.click('#new-form button[type=submit]'); await p.waitForTimeout(600);
    R.newProject405 = { message: await p.textContent('#new-msg'), bannerShown: await p.isVisible('#fixture-banner'), url: p.url().replace(BASE, '') };
    await shot('03_new_refused');
    // project: upload
    await p.goto(`${BASE}/#/p/${PID}`); await p.waitForTimeout(1200); await shot('04_project_upload');
    R.directPost = await p.evaluate(async () => (await fetch('/api/projects', { method: 'POST', body: '{}' })).status);
    // keyboard: Tab from the top until the drop zone has focus, then Enter opens the file chooser
    await p.goto(`${BASE}/#/p/${PID}`); await p.waitForTimeout(900); await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    let tabs = 0, onDrop = false;
    for (; tabs < 60 && !onDrop; tabs++) { await p.keyboard.press('Tab'); onDrop = await p.evaluate(() => document.activeElement?.id === 'drop'); }
    const chooser = p.waitForEvent('filechooser', { timeout: 4000 }).then(() => true).catch(() => false);
    if (onDrop) await p.keyboard.press('Enter');
    R.keyboardUpload = { tabsToDropZone: onDrop ? tabs : null, enterOpensFileChooser: onDrop ? await chooser : false };
    // a refused upload shows on its row (never a fake success)
    await p.setInputFiles('#file-input', tmpPdf); await p.waitForTimeout(1200);
    R.uploadRefused = await p.evaluate(() => { const row = document.querySelector('.hb-file[data-pending]'); return row ? { state: row.dataset.state, text: row.innerText.replace(/\s+/g, ' ').trim() } : null; });
    await p.evaluate(() => document.getElementById('s-upload').scrollIntoView()); await shot('05_upload_refused');
    // review
    const rv = await p.evaluate(() => {
      const t = document.body.innerText;
      return { conf082Count: (t.match(/0\.82/g) || []).length, flags: [...document.querySelectorAll('.flag')].map((f) => ({ field: f.closest('.review__row').dataset.field, text: f.querySelector('.flag__text').textContent })), flaggedRows: document.querySelectorAll('.review__row.is-flagged').length };
    });
    R.review = rv;
    await shotEl('06_review', '#s-review');
    // keyboard: review → create
    await p.focus('#btn-review-ok'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
    R.keyboardReviewToCreate = await p.evaluate(() => document.activeElement?.id);
    await shotEl('07_create', '#s-create');
    R.timeline = await p.evaluate(() => { const t = document.getElementById('timeline'); return { hasPercent: t.innerText.includes('%'), steps: [...t.querySelectorAll('.hb-step')].map((s) => `${s.dataset.stage}:${s.dataset.state}:${s.querySelector('.hb-step__state').innerText}`) }; });
    R.createButton = await p.evaluate(() => document.getElementById('btn-create').innerText.replace(/\s+/g, ' '));
    // results
    R.results = await p.evaluate(() => [...document.querySelectorAll('#results .hb-result')].map((r) => ({ key: r.dataset.deliverable, state: r.dataset.state, notInChain: r.innerText.includes('עוד לא בשרשרת הזו') })));
    await p.evaluate(() => document.querySelector('.cliplist-wrap')?.setAttribute('open', '')); await shotEl('08_results', '#s-results');
    // advanced
    await p.evaluate(() => { document.getElementById('adv').open = true; document.getElementById('adv').scrollIntoView(); }); await shot('09_advanced');
    R.advancedOneLevel = await p.evaluate(() => document.querySelectorAll('#adv details').length === 0);
    // leave and come back: the state is read from disk again
    const before = await p.evaluate(() => document.getElementById('timeline').innerText);
    await p.goto(`${BASE}/#/`); await p.waitForTimeout(700); await p.goto(`${BASE}/#/p/${PID}`); await p.waitForTimeout(1200);
    R.stateRestoredAfterLeaving = before === await p.evaluate(() => document.getElementById('timeline').innerText);
    await p.evaluate(() => window.scrollTo(0, 0)); await shot('10_project_full', { full: true });
    report.sizes[sz] = R; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.sizes, null, 1).slice(0, 6000));
})();
