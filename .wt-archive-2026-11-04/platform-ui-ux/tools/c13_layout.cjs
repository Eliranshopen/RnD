// card 13: landmark bounding boxes + frames of every page using the migrated CSS, at 1440 and 390. Run once BEFORE the edit and
// once AFTER; then compare. usage: node c13_layout.cjs <port> <frames-dir> <out-json>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = [
  ['landing', '/landing.html?project=rainbow'],
  ['flow', '/flow.html?project=rainbow&seg=hold-facade'],
  ['apartment', '/apartment.html?project=rainbow&unit=846'],
  ['dashboard', '/dashboard.html'],
];
const SEL = 'header, main, nav, footer, section, [role=tablist], .topbar, .hud, .hud-top, .hud-bottom, .landing-hero, .landing-facts-card, .landing-lead, .landing-legal, .tile, .flight-frame, .kpi, .card, .legal-band, .overlay-card, .picker-legend, .hotspot';
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = {};
  for (const [sz, opts] of Object.entries(SIZES)) for (const [name, path] of PAGES) {
    const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
    await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }).catch((e) => errs.push('goto ' + e.message.slice(0, 80)));
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500);
    const boxes = await p.evaluate((sel) => {
      const seen = new Map();
      return [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).slice(0, 60).map((e) => {
        const base = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
        const n = (seen.get(base) || 0) + 1; seen.set(base, n);
        const r = e.getBoundingClientRect(); return [`${base}[${n}]`, [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]];
      });
    }, SEL);
    await p.screenshot({ path: `${FR}/${sz}_${name}.png`, fullPage: name !== 'flow' });
    report[`${sz}/${name}`] = { boxes: Object.fromEntries(boxes), errors: errs, bodyBg: await p.evaluate(() => getComputedStyle(document.body).backgroundColor) };
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) console.log(k, 'landmarks', Object.keys(v.boxes).length, 'errors', v.errors.length, 'bg', v.bodyBg);
})();
