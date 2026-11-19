// gate2 reviewer probe, card 16 (apartment frame). usage: node probe16.cjs <port>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const PORT = process.argv[2];
const inter = (a, b) => !a || !b ? 0 : Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) * Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  const MEDIA = { tour: '.apt-frame-tour', plan: '#planImg', photos: '#photoGrid', '3d': '.apt-frame-3d', about: '#panel-about' };
  for (const [wname, vp] of [['390x844', { width: 390, height: 844 }], ['360x640', { width: 360, height: 640 }], ['600x900', { width: 600, height: 900 }], ['601x900', { width: 601, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: vp.width < 601, hasTouch: vp.width < 601, reducedMotion: 'reduce' });
    for (const tab of Object.keys(MEDIA)) {
      const p = await ctx.newPage(); const errs = []; const bad = [];
      p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)));
      p.on('console', (m) => { if (m.type() === 'error' || /Failed to construct/.test(m.text())) errs.push(m.text().slice(0, 140)); });
      p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 90)); });
      await p.goto(`http://buyer.test:${PORT}/apartment.html?project=rainbow&unit=846&tab=${tab}`, { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500);
      const bar = () => p.evaluate(() => { const e = document.querySelector('#mobileBar'); const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { display: cs.display, pos: cs.position, rect: r.height ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height } : null }; });
      const rectOf = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; }, MEDIA[tab]);
      // (1) media's end scrolled to the viewport bottom (default scroll-padding applies)
      await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'end' }), MEDIA[tab]); await p.waitForTimeout(250);
      const m1 = await rectOf(MEDIA[tab]); const b1 = await bar();
      // (2) page bottom: the bar vs the last content (footer summary) and the document padding
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(250);
      const b2 = await bar();
      const foot = await p.evaluate(() => { const e = document.querySelector('.apt-foot summary'); const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
      const lastAgent = await p.evaluate(() => { const e = document.querySelector('#agent'); const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vis: r.height > 0 }; });
      const sw = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      console.log(wname, tab, 'bar', b1.display + '/' + b1.pos, b1.rect ? Math.round(b1.rect.top) + '-' + Math.round(b1.rect.bottom) : '-', '| media-end overlap(area px2)', inter(m1, b1.rect), 'mediaBottom', m1 && Math.round(m1.bottom), 'mediaH', m1 && Math.round(m1.h), '| page-bottom: footer overlap', inter(foot, b2.rect), 'agent overlap', inter(lastAgent, b2.rect), '| hscroll', sw.sw > sw.cw, '| errs', errs.length, JSON.stringify(errs), 'bad', bad.length);
      await p.close();
    }
    await ctx.close();
  }
  // media touch-target of the bar buttons and tabs at 390
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); await p.goto(`http://buyer.test:${PORT}/apartment.html?project=rainbow&unit=846`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  console.log('targets', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#mobileBar a, [role=tab]')].map((e) => { const r = e.getBoundingClientRect(); return e.id + ':' + Math.round(r.width) + 'x' + Math.round(r.height); }))));
  console.log('hrefs', JSON.stringify(await p.evaluate(() => ({ wa: document.querySelector('#waBtn').href, wa2: document.querySelector('#waBtn2').href, call: document.querySelector('#callBtn').href, call2: document.querySelector('#callBtn2').href, zip: document.querySelector('#zipBtn').href, zip2: document.querySelector('#zipBtn2').href, back: (document.querySelector('#backBtn') || {}).href }))));
  await b.close();
})();
