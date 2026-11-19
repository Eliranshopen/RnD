// text over images: pixel-measured contrast. hide the text, screenshot its box, compare the resolved text colour to the pixels behind it.
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const T = [
  ['home', 'http://buyer.test:8852/', '.home-hero h1,.home-hero__sub,.hb-media-card__title,.hb-media-card__meta,.hb-media-card__eyebrow'],
  ['landing', 'http://buyer.test:8852/landing.html?project=rainbow&v=a', '.hero-play span:not(.hero-play__icon),.tile-label,.tile-legal,.hero-badge,.tile-badge'],
];
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  for (const [n, u, sel] of T) for (const theme of ['light', 'dark']) for (const sz of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: sz[0], height: sz[1] }, colorScheme: theme, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(u + (u.includes('?') ? '&' : '?') + 'theme=' + theme); await p.waitForTimeout(2500);
    const els = await p.$$(sel); const out = [];
    for (const e of els) {
      await e.scrollIntoViewIfNeeded();
      const info = await e.evaluate((el) => { const cs = getComputedStyle(el); const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.fillStyle = cs.color; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; const r = el.getBoundingClientRect(); return { fg: [d[0], d[1], d[2]], vis: r.width > 2 && r.height > 2 && cs.visibility !== 'hidden', txt: el.textContent.trim().slice(0, 16), size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700 }; });
      if (!info.vis) continue;
      await e.evaluate((el) => { el.__c = el.style.color; el.__s = el.style.textShadow; el.style.color = 'transparent'; el.style.textShadow = 'none'; });
      const buf = await e.screenshot();
      await e.evaluate((el) => { el.style.color = el.__c; el.style.textShadow = el.__s; });
      const px = await p.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const L = []; for (let i = 0; i < d.length; i += 28) L.push([d[i], d[i + 1], d[i + 2]]); return L; }, buf.toString('base64'));
      const lf = lum(...info.fg); const crs = px.map((q) => { const lb = lum(...q); return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05); }).sort((a, c) => a - c);
      const need = (info.size >= 24 || (info.bold && info.size >= 18.66)) ? 3 : 4.5;
      out.push({ t: info.txt, mean: +(crs.reduce((s, v) => s + v, 0) / crs.length).toFixed(2), p5: +crs[Math.floor(crs.length * 0.05)].toFixed(2), min: +crs[0].toFixed(2), need });
    }
    const bad = out.filter((o) => o.mean < o.need);
    console.log(`OI ${n}/${theme}/${sz[0]}: ${out.length} measured, mean<need: ${bad.length} ${JSON.stringify(bad.slice(0, 4))} | worst mean ${Math.min(...out.map((o) => o.mean))} worst p5 ${Math.min(...out.map((o) => o.p5))}`);
    await ctx.close();
  }
  await b.close();
})();
