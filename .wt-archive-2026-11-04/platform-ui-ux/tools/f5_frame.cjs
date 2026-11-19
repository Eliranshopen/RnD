// card 19 F5: the Studio project page BEFORE its files are read (the real server, project ui-check: no intake). usage: node f5_frame.cjs <frames>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const FR = process.argv[2]; fs.mkdirSync(FR, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [sz, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: sz === 'phone' ? 2 : 1 });
    await p.goto('http://127.0.0.1:8853/#/p/ui-check'); await p.waitForTimeout(1500);
    const marks = await p.evaluate(() => [...document.querySelectorAll('[data-step="review"] .stepnav__n, #h-review .step-sec__n')].map((n) => n.textContent));
    await p.screenshot({ path: `${FR}/${sz}_unread_top.png` });
    await p.evaluate(() => document.getElementById('s-review').scrollIntoView()); await p.waitForTimeout(300);
    await p.screenshot({ path: `${FR}/${sz}_unread_review.png` });
    console.log(sz, 'review markers', JSON.stringify(marks), '| sub', await p.textContent('[data-sub="review"]'));
    await p.close();
  }
  await b.close();
})();
