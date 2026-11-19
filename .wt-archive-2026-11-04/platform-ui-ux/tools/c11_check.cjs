// card 11 check: home page, light + dark x 1440 + 390 (viewport + full), empty state, keyboard path. Buyer host (DEV false).
// usage: node c11_check.cjs <port> <frames> <out>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const BASE = `http://buyer.test:${PORT}`;
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const report = { runs: {} };
  for (const theme of ['light', 'dark']) for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(`${BASE}/?theme=${theme}`, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      status: [...document.querySelectorAll('.home-card__status')].map((e) => e.innerText), cards: document.querySelectorAll('.home-card').length, devText: /תצוגת פיתוח|TODO|fixture/.test(document.body.innerText), heebo: document.fonts.check('16px Heebo', 'שלום') }));
    await p.screenshot({ path: `${FR}/${sz}_${theme}.png` }); await p.screenshot({ path: `${FR}/${sz}_${theme}_full.png`, fullPage: true });
    // keyboard path from the top of the page, with the focus ring measured on the focused element (or its ::after for the stretched card link)
    const path = [];
    await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    for (let i = 0; i < 8; i++) {
      await p.keyboard.press('Tab');
      const f = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a), ca = getComputedStyle(a, '::after');
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ? `outline ${cs.outlineWidth} ${cs.outlineColor}` : (ca.outlineStyle !== 'none' && parseFloat(ca.outlineWidth) > 0) ? `::after outline ${ca.outlineWidth} ${ca.outlineColor}` : 'NO RING';
        return `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.className ? '.' + String(a.className).split(' ')[0] : ''} "${(a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 30)}" [${ring}]`; });
      if (!f || path.includes(f)) break; path.push(f);
      if (i === 2 && sz === 'desk' && theme === 'light') await p.screenshot({ path: `${FR}/desk_light_focus_card.png` });
    }
    report.runs[`${theme}/${sz}`] = { ...r, hscroll: r.sw > r.cw, errors: errs, keyboard: path };
    await ctx.close();
  }
  // empty state: projects.json answered with an empty list
  for (const [sz, opts] of Object.entries(SIZES)) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/projects.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"projects":[]}' }));
    await p.goto(`${BASE}/`, { waitUntil: 'load' }); await p.waitForTimeout(900);
    report.runs[`empty/${sz}`] = { emptyVisible: await p.isVisible('#projectsEmpty'), text: (await p.innerText('#projectsEmpty')).replace(/\s+/g, ' '), errors: errs, hscroll: await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) };
    await p.screenshot({ path: `${FR}/${sz}_empty.png` }); await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report.runs)) console.log(k, JSON.stringify({ errors: v.errors.length, hscroll: v.hscroll, status: v.status, cards: v.cards, devText: v.devText, theme: v.theme, bg: v.bg, empty: v.emptyVisible }));
  console.log('keyboard desk/light:\n  ' + report.runs['light/desk'].keyboard.join('\n  '));
  console.log('keyboard phone/dark:\n  ' + report.runs['dark/phone'].keyboard.join('\n  '));
})();
