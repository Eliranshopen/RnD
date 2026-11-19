// card 03 check: headless pass over a STAGED scratch copy served on :8852; records every response, counts >= 400.
// usage: node c03_check.cjs <base-url> <out-json>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [BASE, OUT] = process.argv.slice(2);
const PAGES = ['/landing.html?project=rainbow', '/apartment.html?project=rainbow&unit=846'];
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const report = [];
  for (const path of PAGES) {
    const p = await ctx.newPage();
    const resp = [], errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    p.on('response', (r) => resp.push([r.status(), r.url().replace(BASE, '')]));
    try { await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
    await p.waitForTimeout(2000);
    await p.evaluate(async () => { for (const i of document.images) i.loading = 'eager'; for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
    await p.waitForTimeout(2000);
    const imgs = await p.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src));
    const dist = resp.filter(([, u]) => u.includes('/_local/dist/'));
    report.push({
      page: path,
      responses: resp.length,
      bad: resp.filter(([s]) => s >= 400),
      dist_requests: dist.length,
      dist_bad: dist.filter(([s]) => s >= 400),
      dist_sample: dist.slice(0, 6),
      img_total: imgs.length,
      img_from_dist: imgs.filter((u) => u.includes('/_local/dist/')).length,
      img_from_fixtures: imgs.filter((u) => u.includes('/fixtures/')).length,
      pageerrors: errs,
    });
    await p.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.page, '| responses', r.responses, '| >=400', r.bad.length, '| _local/dist', r.dist_requests, 'bad', r.dist_bad.length, '| img dist/fixture', r.img_from_dist + '/' + r.img_from_fixtures, '| pageerrors', JSON.stringify(r.pageerrors));
})();
