// card 15: anchor boxes of the chrome over the hold (flow.html?seg=hold-facade): caption band, caption overlay, pill 846, and the
// unit card after a tap on 846; frames at 1440 and 390. usage: node c15_anchor.cjs <port> <frames> <out>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width ? [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) : null; }, sel);
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = {};
  for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
    await p.goto(`http://127.0.0.1:${PORT}/flow.html?project=rainbow&seg=hold-facade`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(3500);
    const r = { band: await box(p, '#legalBand'), overlay: await box(p, '#legalOverlay'), pill846: await box(p, '.hotspot[data-unit="846"]') };
    await p.screenshot({ path: `${FR}/${sz}_hold.png` });
    const pill = await p.$('.hotspot[data-unit="846"]');
    if (pill) { await pill.click({ force: true }); await p.waitForTimeout(1200); }
    r.card = await box(p, '#unitSheet'); r.bandWithCard = await box(p, '#legalBand');
    await p.screenshot({ path: `${FR}/${sz}_card.png` });
    report[sz] = { ...r, errors: errs };
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1)); console.log(JSON.stringify(report));
})();
