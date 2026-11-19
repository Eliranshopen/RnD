// card 10: why is #fixtureNote not visible on flow.html?dev=1 ? usage: node c10_flowdev.cjs <port> <host>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const [PORT, HOST] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  for (const q of ['?project=rainbow&dev=1', '?project=rainbow']) {
    await p.goto(`http://${HOST}:${PORT}/flow.html${q}`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    console.log(HOST, q, JSON.stringify(await p.evaluate(() => { const n = document.getElementById('fixtureNote'), o = document.getElementById('startOverlay'); const o2 = document.getElementById('startOverlay'), n2 = document.getElementById('fixtureNote'); o2.hidden = false; n2.hidden = false; const forced = getComputedStyle(n2).display + '/' + (o2.innerText.includes('placeholders') ? 'text-visible' : 'text-not-visible'); return { forcedShown: forced, dev: document.documentElement.dataset.dev || null, noteHiddenAttr: n.hidden, noteDisplay: getComputedStyle(n).display, overlayHidden: o.hidden, overlayDisplay: getComputedStyle(o).display, overlayClass: o.className }; })));
  }
  await b.close();
})();
