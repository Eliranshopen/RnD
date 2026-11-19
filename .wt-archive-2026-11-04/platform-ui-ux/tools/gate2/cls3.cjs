const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const VP = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  for (const sz of ['desk', 'phone']) for (const v of ['a', 'b']) {
    const vals = [];
    for (let i = 0; i < 3; i++) {
      const p = await (await b.newContext(VP[sz])).newPage();
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(`http://buyer.test:8852/landing.html?project=rainbow&v=${v}`, { waitUntil: 'load' }); await p.waitForTimeout(3000);
      const load = await p.evaluate(() => Math.round(window.__cls * 1000) / 1000);
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }); await p.waitForTimeout(600);
      vals.push([load, Math.round(await p.evaluate(() => window.__cls) * 1000) / 1000]); await p.close();
    }
    console.log(`CLS ${sz}/${v}: load/total per run ${JSON.stringify(vals)} worst ${Math.max(...vals.map((x) => x[1]))}`);
  }
  // error path
  for (const sz of ['desk', 'phone']) {
    const p = await (await b.newContext(VP[sz])).newPage(); await p.route('**/projects.json', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto('http://buyer.test:8852/landing.html?project=rainbow&v=a', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    console.log('ERRPATH', sz, JSON.stringify(await p.evaluate(() => { const e = document.querySelector('#projectName'); const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); let vis = true; for (let n = e; n; n = n.parentElement) if (getComputedStyle(n).visibility === 'hidden' || getComputedStyle(n).display === 'none') vis = false; return { text: e.textContent.trim().slice(0, 60), visible: vis, w: Math.round(r.width), bodyReady: document.body.classList.contains('ready') }; })));
  }
  await b.close();
})();
