// plan studio-agent-fal: frames of the agent panel on the working-copy server (:8853) for the fal-check project; no new paid call.
// usage: node chat_frames.cjs <project-id> <frames>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [ID, FR] = process.argv.slice(2); fs.mkdirSync(FR, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [sz, vp, dpr] of [['desk', { width: 1440, height: 900 }, 1], ['phone', { width: 390, height: 844 }, 2]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr }); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`http://127.0.0.1:8853/#/p/${ID}`); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({ msgs: document.querySelectorAll('#agent-log .agent__msg').length, env: document.getElementById('env-summary').innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      primaries: [...document.querySelectorAll('#view-project .hb-btn--primary')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()) }));
    await (await p.$('#s-agent')).screenshot({ path: `${FR}/${sz}_agent.png` });
    await p.evaluate(() => document.getElementById('s-review').scrollIntoView()); await p.screenshot({ path: `${FR}/${sz}_review.png` });
    console.log(sz, JSON.stringify({ ...r, errors: errs }));
    await p.close();
  }
  await b.close();
})();
