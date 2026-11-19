// card 10 check. Buyer view = host "buyer.test" (mapped to 127.0.0.1, so DEV is false: not localhost, no ?dev). usage: node c10_check.cjs <port> <frames> <out>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const sharp = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/sharp');
const fs = require('fs');
const [PORT, FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const PAGES = [['home', '/'], ['landing', '/landing.html?project=rainbow'], ['flow', '/flow.html?project=rainbow']];
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const report = {};
  for (const dev of [false, true]) {
    for (const [name, path] of PAGES) {
      const p = await ctx.newPage(); const errs = [], google = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
      p.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) google.push(r.url()); });
      const url = `http://buyer.test:${PORT}${path}${dev ? (path.includes('?') ? '&' : '?') + 'dev=1' : ''}`;
      await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await p.waitForTimeout(2500);
      const r = await p.evaluate(async () => { await document.fonts.ready; const t = document.body.innerText; return { dev: document.documentElement.dataset.dev || null, dev_label: (t.match(/תצוגת פיתוח/g) || []).length, placeholders: (t.match(/placeholders/g) || []).length, heebo: document.fonts.check('16px Heebo', 'שלום'), heebo_loaded: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Heebo' && f.status === 'loaded') }; });
      report[`${name}${dev ? ' ?dev=1' : ' buyer'}`] = { ...r, google_requests: google.length, pageerrors: errs };
      if (!dev) await p.screenshot({ path: `${FR}/phone_${name}.png` });
      if (!dev && name === 'home') {
        const el = await p.$('.project-logo');
        if (el) {
          const box = await el.boundingBox(); const png = await el.screenshot();
          const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
          const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
          // the plate = the most common colour inside the element (a corner pixel can be the card behind the rounded plate)
          const freq = new Map(); for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const k = px(x, y).join(','); freq.set(k, (freq.get(k) || 0) + 1); }
          const plateKey = [...freq.entries()].sort((p2, q) => q[1] - p2[1])[0][0]; const plate = plateKey.split(',').map(Number);
          let plateXY = null; for (let y = 0; y < info.height && !plateXY; y++) for (let x = 0; x < info.width; x++) if (px(x, y).join(',') === plateKey) { plateXY = [x, y]; break; }
          // classify every pixel; the mark = pixels far from the plate. Report each colour cluster with a sample coordinate.
          const clusters = new Map();
          for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
            const c = px(x, y); if (Math.abs(lum(c) - lum(plate)) < 0.08 && Math.max(...c.map((v, i) => Math.abs(v - plate[i]))) < 40) continue;
            const key = c.map((v) => Math.round(v / 24) * 24).join(','); const e = clusters.get(key) || { n: 0, sample: [x, y], c }; e.n++; clusters.set(key, e);
          }
          const top = [...clusters.values()].sort((p2, q) => q.n - p2.n).slice(0, 4).map((e) => ({ rgb: e.c, pixels: e.n, sample_xy_in_logo_px: e.sample, contrast_vs_plate: +ratio(e.c, plate).toFixed(2) }));
          report.developer_mark = { element_css_box: box, image_px: [info.width, info.height], plate_rgb_at: { xy: plateXY, rgb: plate, pixels: freq.get(plateKey) }, mark_clusters: top };
          await el.screenshot({ path: `${FR}/phone_home_mark.png` });
        } else report.developer_mark = 'no .project-logo on the home page';
      }
      await p.close();
    }
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})();
