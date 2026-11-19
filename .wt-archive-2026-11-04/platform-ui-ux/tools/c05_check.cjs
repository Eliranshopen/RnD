// card 05 check: styleguide.html headless at 1440x900 and 390x844 (+ reduced motion). usage: node c05_check.cjs <base-url> <frames-dir> <out-json>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [BASE, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const SIZES = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const report = {};
  for (const [sz, opts] of Object.entries(SIZES)) {
    for (const motion of ['no-preference', 'reduce']) {
      const ctx = await b.newContext({ ...opts, reducedMotion: motion });
      const p = await ctx.newPage();
      const errs = [], resp = [];
      p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
      p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
      p.on('response', (r) => resp.push([r.status(), r.url()]));
      await p.goto(`${BASE}/styleguide.html`, { waitUntil: 'load', timeout: 30000 });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(600);
      const r = await p.evaluate(() => {
        const btn = document.querySelector('.sg-col .hb-btn--primary');
        const de = document.documentElement;
        return {
          heebo: document.fonts.check('16px Heebo', 'שלום'), frank: document.fonts.check('32px "Frank Ruhl Libre"', 'שלום'),
          heebo_bold: document.fonts.check('700 16px Heebo', 'שלום'),
          loaded_faces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
          scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, hscroll: de.scrollWidth > de.clientWidth,
          btn_transition_duration: getComputedStyle(btn).transitionDuration,
          btn_font: getComputedStyle(btn).fontFamily,
          h1_font: getComputedStyle(document.querySelector('.sg-col .hb-h1')).fontFamily,
          cols: [...document.querySelectorAll('.sg-col')].map((c) => { const x = c.getBoundingClientRect(); return [Math.round(x.x), Math.round(x.y), Math.round(x.width)]; }),
          themes: [...document.querySelectorAll('.sg-col')].map((c) => `${c.dataset.theme}:${getComputedStyle(c).backgroundColor}`),
        };
      });
      const fonts = resp.filter(([, u]) => u.endsWith('.woff2')).map(([s, u]) => [s, u.replace(BASE, '')]);
      const google = resp.filter(([, u]) => /fonts\.(googleapis|gstatic)\.com/.test(u));
      const bad = resp.filter(([s]) => s >= 400);
      if (motion === 'no-preference') {
        await p.screenshot({ path: `${FR}/${sz}_styleguide.png`, fullPage: false });
        await p.screenshot({ path: `${FR}/${sz}_styleguide_full.png`, fullPage: true });
      }
      report[`${sz}/${motion}`] = { ...r, errors: errs, font_responses: fonts, google_requests: google.length, bad_responses: bad };
      await ctx.close();
    }
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) console.log(k, '| errors', v.errors.length, '| hscroll', v.hscroll, `(${v.scrollWidth}/${v.clientWidth})`, '| Heebo', v.heebo, '| Frank', v.frank, '| woff2', JSON.stringify(v.font_responses.map(([s, u]) => `${s} ${u.split('/').pop()}`)), '| google', v.google_requests, '| >=400', v.bad_responses.length, '| btn transition', v.btn_transition_duration, '| cols', JSON.stringify(v.cols));
})();
