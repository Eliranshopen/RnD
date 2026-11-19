// gate2 / phase4 capture of the platform shell. Same names + URLs as research/current/cap_shell.cjs, plus tab=photos and tab=3d,
// run against a LOCAL server through the buyer host (DEV off). usage: node cap2.cjs <base> <outdir> [sizes=desk,phone,hd]
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.argv[2]; const OUT = process.argv[3];
const WANT = (process.argv[4] || 'desk,phone').split(',');
const PAGES = [
  ['01_home', '/'],
  ['02_home_rainbow', '/?project=rainbow'],
  ['03_landing_a', '/landing.html?project=rainbow&v=a'],
  ['04_landing_b', '/landing.html?project=rainbow&v=b'],
  ['05_apartment', '/apartment.html?project=rainbow&unit=846'],
  ['06_apartment_plan', '/apartment.html?project=rainbow&unit=846&tab=plan'],
  ['07_apartment_images', '/apartment.html?project=rainbow&unit=846&tab=photos'],
  ['07b_apartment_photos', '/apartment.html?project=rainbow&unit=846&tab=photos'],
  ['07c_apartment_3d', '/apartment.html?project=rainbow&unit=846&tab=3d'],
  ['08_apartment_about', '/apartment.html?project=rainbow&unit=846&tab=about'],
  ['09_flow', '/flow.html?project=rainbow'],
];
const ALL = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, hd: { viewport: { width: 1280, height: 720 } } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const report = [];
  for (const sz of WANT) {
    const ctx = await b.newContext(ALL[sz]);
    for (const [name, path] of PAGES) {
      const p = await ctx.newPage();
      const errs = []; const bad = []; let google = 0;
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
      p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 140)); });
      p.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) google++; });
      p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 120)); });
      try { await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
      await p.waitForTimeout(3500);
      const info = await p.evaluate(() => ({ title: document.title, h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, dir: document.documentElement.dir, text: document.body.innerText.slice(0, 600) })).catch(() => ({}));
      await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; } await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 6000); }))); for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); await Promise.all([...document.images].map((i) => i.decode ? i.decode().catch(() => 0) : 0)); }); await p.waitForTimeout(600);
      await p.screenshot({ path: `${OUT}/${sz}_${name}.png` });
      await p.screenshot({ path: `${OUT}/${sz}_${name}_full.png`, fullPage: true }).catch(() => {});
      report.push({ sz, name, path, errs, bad, google, ...info });
      await p.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/capture-report.json`, JSON.stringify(report, null, 1));
  console.log(report.map((r) => `${r.sz} ${r.name} h=${r.h} w=${r.w}/${r.cw} errs=${r.errs.length} bad=${r.bad.length} google=${r.google}`).join('\n'));
  await b.close();
})();
