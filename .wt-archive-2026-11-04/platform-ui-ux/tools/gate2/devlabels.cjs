const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const URLS = { home: '/', landingA: '/landing.html?project=rainbow&v=a', landingB: '/landing.html?project=rainbow&v=b', apartment: '/apartment.html?project=rainbow&unit=846', flow: '/flow.html?project=rainbow' };
const RX = /תצוגת פיתוח|placeholders|fixture|dev view|DEV\b|פיקסצ|v0\b/i;
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  for (const [host, label] of [['buyer.test', 'BUYER'], ['127.0.0.1', 'DEV(host)']]) for (const sz of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: sz[0], height: sz[1] } });
    const out = [];
    for (const [n, u] of Object.entries(URLS)) {
      const p = await ctx.newPage(); let google = 0; p.on('request', (r) => { if (/fonts\.(googleapis|gstatic)/.test(r.url())) google++; });
      await p.goto(`http://${host}:8852${u}`, { waitUntil: 'load' }); await p.waitForTimeout(2200);
      const r = await p.evaluate((src) => { const rx = new RegExp(src, 'i'); return [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && rx.test(e.textContent) && e.getBoundingClientRect().width > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim().slice(0, 30)); }, RX.source);
      out.push(`${n}:${r.length}${r.length ? '[' + r.slice(0, 2).join('|') + ']' : ''} g${google}`); await p.close();
    }
    console.log(`DEVLABELS ${label}/${sz[0]}: ${out.join(' ')}`); await ctx.close();
  }
  await b.close();
})();
