// card 14: the project landing, buyer view (host buyer.test), arms A and B, he + en legal text, frames, and the acceptance probes.
// usage: node c14_check.cjs <port> <frames> <out> [--before]
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2); const BEFORE = process.argv.includes('--before');
fs.mkdirSync(FR, { recursive: true });
const BASE = `http://buyer.test:${PORT}`;
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const report = {};
  for (const [sz, opts] of Object.entries(SIZES)) for (const arm of ['a', 'b']) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' }); const p = await ctx.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(`${BASE}/landing.html?project=rainbow&v=${arm}`, { waitUntil: 'load' }); await p.waitForSelector('body.ready', { timeout: 30000 });
    await p.evaluate(async () => { await document.fonts.ready; for (const i of document.images) i.loading = 'eager'; for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 0 && !i.closest('dialog'));
      const urls = imgs.map((i) => i.currentSrc || i.src);
      const stills = [...document.querySelectorAll('#gallery .tile')];
      return {
        legal_he_full: document.getElementById('legalFull')?.textContent || null,
        imgs: urls.length, clay_or_fixture_imgs: urls.filter((u) => /clay|\/fixtures\/[^/]+\/(node-|approach|descend)/i.test(u)).map((u) => u.replace(location.origin, '')),
        stills: stills.length, stills_with_badge: stills.filter((t) => t.querySelector('.hb-ai-badge')).length,
        hero_badge: !!document.querySelector('#variantA .hb-ai-badge, .landing-media .hb-ai-badge'),
        gallery_visible: !!document.getElementById('gallerySection') && !document.getElementById('gallerySection').hidden,
        avail: [...document.querySelectorAll('#availability .avail-row')].map((a) => ({ href: a.getAttribute('href'), status: a.querySelector('.hb-chip')?.innerText || '', text: a.innerText.replace(/\s+/g, ' ') })),
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        legalOpen: document.getElementById('legal')?.open ?? null, summary: document.getElementById('legalSummary')?.textContent || null,
      };
    });
    await p.screenshot({ path: `${FR}/${sz}_${arm}.png` }); await p.screenshot({ path: `${FR}/${sz}_${arm}_full.png`, fullPage: true });
    // English legal text
    await p.click('#langToggle'); await p.waitForTimeout(400);
    r.legal_en_full = await p.evaluate(() => document.getElementById('legalFull')?.textContent || null);
    // every availability link answers 200
    r.avail_status = await p.evaluate((hrefs) => Promise.all(hrefs.map((h) => fetch(h, { cache: 'no-store' }).then((x) => x.status))), (r.avail || []).map((a) => a.href));
    report[`${sz}/${arm}`] = { ...r, errors: errs, hscroll: r.sw > r.cw };
    await ctx.close();
  }
  // no real stills: the dist manifest answers 404 -> no gallery, never clay
  { const ctx = await b.newContext(SIZES.phone); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/_local/dist/**', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(`${BASE}/landing.html?project=rainbow&v=a`); await p.waitForSelector('body.ready', { timeout: 30000 }); await p.waitForTimeout(800);
    report.no_stills = await p.evaluate(() => ({ gallery_visible: !!document.getElementById('gallerySection') && !document.getElementById('gallerySection').hidden, tiles: document.querySelectorAll('#gallery .tile').length,
      clay_imgs: [...document.images].map((i) => i.currentSrc || i.src).filter((u) => /clay|\/fixtures\/[^/]+\/(node-|approach|descend)/i.test(u)).length }));
    report.no_stills.errors = errs; await p.screenshot({ path: `${FR}/phone_no_stills.png`, fullPage: true }); await ctx.close(); }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify({ errors: v.errors?.length, hscroll: v.hscroll, imgs: v.imgs, clay: v.clay_or_fixture_imgs ?? v.clay_imgs, stills: v.stills ?? v.tiles, badges: v.stills_with_badge, gallery: v.gallery_visible, avail: v.avail?.length, avail200: v.avail_status?.every((s) => s === 200), legalOpen: v.legalOpen, summary: v.summary }));
})();
