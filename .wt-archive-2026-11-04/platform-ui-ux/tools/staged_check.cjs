// headless pass over a staged site (local or deployed): every page, responses >= 400 and page errors, at 390 and 1440.
// usage: node staged_check.cjs <base-url> [out-json]
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [BASE, OUT] = process.argv.slice(2);
const PAGES = ['/', '/landing.html?project=rainbow&v=a', '/landing.html?project=rainbow&v=b', '/apartment.html?project=rainbow&unit=846', '/flow.html?project=rainbow', '/hold/?project=rainbow', '/styleguide.html'];
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const report = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    for (const path of PAGES) {
      const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const bad = [], errs = [];
      p.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 110)}`); });
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
      let status = null;
      try { const r = await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 }); status = r && r.status(); } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
      await p.waitForTimeout(3000);
      const fontsOk = await p.evaluate(() => document.fonts.check('16px Heebo', 'שלום')).catch(() => null);
      report.push({ vp: vp.width, path, status, bad, errs, fontsOk });
      await ctx.close();
    }
  }
  await b.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.vp, r.status, r.path, '| >=400:', r.bad.length, r.bad.slice(0, 3).join(' ; '), '| errors:', r.errs.length, r.errs.slice(0, 2).join(' ; '));
})();
