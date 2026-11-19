const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto('http://buyer.test:8852/apartment.html?project=rainbow&unit=846&tab=photos'); await p.waitForTimeout(2500);
  console.log('APT photos', JSON.stringify(await p.evaluate(() => ({ imgs: [...document.querySelectorAll('#photoGrid img')].length, badges: [...document.querySelectorAll('#photoGrid .hb-ai-badge,#photoGrid [class*=badge]')].length, lightboxBadge: !!document.querySelector('.apt-lightbox [class*=badge]'), planBadge: !!document.querySelector('#panel-plan [class*=badge]') }))));
  await p.goto('http://buyer.test:8852/'); await p.waitForTimeout(2500);
  console.log('HOME bdi', JSON.stringify(await p.evaluate(() => ({ bdi: [...document.querySelectorAll('bdi')].map((e) => e.textContent.trim().slice(0, 10)), summary: (document.querySelector('.hb-media-card__meta,.home-card__meta') || {}).textContent, badge: [...document.querySelectorAll('.hb-ai-badge')].length }))));
  const s = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await s.goto('http://127.0.0.1:8853/#/p/apt846-rainbow-tlv'); await s.waitForTimeout(2500);
  console.log('STEPNAV', JSON.stringify(await s.evaluate(() => [...document.querySelectorAll('.stepnav a')].map((a) => a.getAttribute('aria-current') + '|' + a.className + '|' + getComputedStyle(a).fontWeight))));
  await b.close();
})();
