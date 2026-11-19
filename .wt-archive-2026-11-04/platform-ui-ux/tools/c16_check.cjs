// card 16: the apartment page frame, every tab at 1440 and 390; at 390 the CTA bar vs the tab's media after scrolling it fully into
// view. Buyer host (DEV false). usage: node c16_check.cjs <port> <frames> <out>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const BASE = `http://buyer.test:${PORT}`;
const TABS = { tour: '#panel-tour .apt-frame', plan: '#planLink', photos: '#photoGrid', '3d': '#panel-3d .apt-frame', about: '#aboutLegal' };
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' }); const p = await ctx.newPage(); const errs = [], bad = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    p.on('response', (r) => { if (r.status() >= 400 && r.url().includes(String(PORT))) bad.push(`${r.status()} ${r.url().split(String(PORT))[1]}`); });
    await p.goto(`${BASE}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500);
    const head = await p.evaluate(() => ({ title: document.getElementById('aptTitle').innerHTML, summary: document.getElementById('aptSummary').innerHTML, spec: document.querySelectorAll('#aptFacts > div').length, specBdi: document.querySelectorAll('#aptFacts bdi').length, status: document.getElementById('aptStatus').className + ' ' + document.getElementById('aptStatus').textContent,
      back: document.getElementById('backBtn').getAttribute('href'), zip2: document.getElementById('zipBtn2')?.getAttribute('href'), heebo: document.fonts.check('16px Heebo', 'שלום'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const tabs = {};
    for (const [tab, media] of Object.entries(TABS)) {
      await p.click(`#tab-${tab}`); await p.waitForTimeout(tab === '3d' || tab === 'tour' ? 2500 : 900);
      const m = await p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: 'end' }); return true; }, media);
      await p.waitForTimeout(400);
      const r = await p.evaluate((sel) => {
        const el = document.querySelector(sel); const bar = document.getElementById('mobileBar');
        const a = el ? el.getBoundingClientRect() : null; const bb = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
        const inter = a && bb ? Math.max(0, Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top)) : 0;
        return { media: a && [Math.round(a.top), Math.round(a.bottom)], bar: bb && [Math.round(bb.top), Math.round(bb.bottom)], overlap_px: Math.round(inter), sw: document.documentElement.scrollWidth };
      }, media);
      tabs[tab] = { found: !!m, ...r };
      await p.screenshot({ path: `${FR}/${sz}_${tab}.png` });
    }
    await p.click('#tab-tour'); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${FR}/${sz}_top_full.png`, fullPage: true });
    report[sz] = { head, tabs, errors: errs, bad, urlError: errs.some((e) => /construct 'URL'/.test(e)) };
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) { console.log(k, 'errors', v.errors.length, v.errors.slice(0, 2), '| >=400', v.bad, '| URL error', v.urlError, '| h-scroll', v.head.sw > v.head.cw); console.log('  head', JSON.stringify(v.head)); for (const [t, x] of Object.entries(v.tabs)) console.log('  tab', t, JSON.stringify(x)); }
})();
