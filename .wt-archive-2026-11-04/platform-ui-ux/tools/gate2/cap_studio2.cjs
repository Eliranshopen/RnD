// gate2/phase4: Studio dashboard frames from the read-only fixture API on :8853 (working-copy dashboard). Same names as research/current.
// usage: node cap_studio2.cjs <outdir> [sizes=desk,phone,hd]
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const OUT = process.argv[2]; const WANT = (process.argv[3] || 'desk,phone').split(',');
const ALL = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }, hd: { viewport: { width: 1280, height: 720 } } };
const PID = 'apt846-rainbow-tlv'; const BASE = 'http://127.0.0.1:8853/';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const sz of WANT) {
    for (const [name, hash] of [['10_studio_empty', '#/'], ['11_studio_project', '#/p/' + PID], ['12_studio_new', '#/new']]) {
      const ctx = await b.newContext(ALL[sz]); const p = await ctx.newPage(); const errs = []; let google = 0; const bad = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
      p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 140)); });
      p.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) google++; });
      p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
      await p.goto(BASE + hash, { waitUntil: 'load' }); await p.waitForTimeout(2500);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, heebo: document.fonts.check('16px Heebo') }));
      await p.screenshot({ path: `${OUT}/${sz}_${name}.png`, fullPage: true });
      console.log(sz, name, 'errs', errs.length, JSON.stringify(errs), 'bad', bad.length, JSON.stringify(bad), 'google', google, 'sw/cw', m.sw + '/' + m.cw, 'heebo', m.heebo);
      await ctx.close();
    }
  }
  await b.close();
})();
