// gate2 reviewer probe, card 14 (landing). usage: node probe14.cjs <port> <label> <outjson>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [PORT, LABEL, OUT] = process.argv.slice(2);
const VP = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const res = {};
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
  for (const size of Object.keys(VP)) for (const v of ['a', 'b']) for (const lang of ['he', 'en']) for (const nostills of [false, true]) {
    const key = `${size}/${v}/${lang}${nostills ? '/nostills' : ''}`;
    const ctx = await b.newContext({ ...VP[size], locale: lang === 'he' ? 'he-IL' : 'en-US', reducedMotion: 'reduce' });
    const p = await ctx.newPage(); const errs = []; const bad = [];
    p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
    p.on('response', (r) => { if (r.status() >= 400 && !(nostills && /_local\/dist/.test(r.url()))) bad.push(r.status() + ' ' + r.url().slice(0, 100)); });
    if (nostills) await p.route('**/_local/dist/**', (r) => r.fulfill({ status: 404, body: '' }));
    await p.goto(`http://buyer.test:${PORT}/landing.html?project=rainbow&v=${v}${lang === 'en' ? '&lang=en' : ''}`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
      const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
      const legal = $('#legalFull'); const det = $('#legal');
      const wasOpen = det ? det.open : null;
      if (det && det.tagName === 'DETAILS') det.open = true;
      const legalText = legal ? legal.textContent : null;
      if (det && det.tagName === 'DETAILS') det.open = wasOpen;
      const imgs = $$('img').map((i) => (i.currentSrc || i.src || '')).filter(Boolean);
      const bg = $$('*').map((e) => getComputedStyle(e).backgroundImage).filter((x) => x && x !== 'none' && /url\(/.test(x));
      const tiles = $$('#gallery img, .gallery img');
      const gal = $('#gallerySection');
      const badges = $$('.hb-ai-badge').filter((e) => e.getBoundingClientRect().width > 0);
      const tileBadges = $$('#gallery .hb-ai-badge, .gallery .hb-ai-badge');
      const rows = $$('#availList > li, .avail-list > li, .avail-row');
      const rowInfo = rows.map((li) => { const a = li.matches('a') ? li : li.querySelector('a'); return { text: li.innerText.replace(/\s+/g, ' ').trim().slice(0, 80), href: a ? a.getAttribute('href') : null, chip: !!li.querySelector('.hb-chip'), chipText: (li.querySelector('.hb-chip') || {}).textContent || '', bdi: li.querySelectorAll('bdi').length }; });
      const codes = []; for (const ri of rowInfo) { if (!ri.href) { codes.push('nohref'); continue; } try { const x = await fetch(new URL(ri.href, location.href), { method: 'GET' }); codes.push(x.status); } catch (e) { codes.push('err'); } }
      const sum = $('#legalSummary');
      return {
        legalText, legalLen: legalText ? legalText.length : 0, summary: sum ? sum.textContent : null, legalIsDetails: det ? det.tagName : null, openedDefault: wasOpen,
        imgCount: imgs.length, clayOrFixture: [...imgs, ...bg].filter((u) => /clay|fixtures\//i.test(u)), galleryHidden: gal ? gal.hidden || getComputedStyle(gal).display === 'none' : 'absent',
        tiles: tiles.length, tileBadges: tileBadges.length, visibleBadges: badges.length, rows: rowInfo.length, rowInfo, codes,
        devVisible: $$('body *').filter((e) => /תצוגת פיתוח|placeholders|dev view/i.test(e.textContent) && e.children.length === 0 && e.getBoundingClientRect().width > 0).length,
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    r.errors = errs; r.bad = bad;
    // real interaction: click the "full text" control and read what is visible + aria
    const sumEl = await p.$('#legal > summary');
    if (sumEl) {
      await sumEl.click(); await p.waitForTimeout(300);
      r.afterClick = await p.evaluate(() => ({ open: document.querySelector('#legal').open, fullVisible: document.querySelector('#legalFull').getBoundingClientRect().height > 0, moreLabel: [...document.querySelectorAll('.hb-legal__open,.hb-legal__close')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent) }));
      await p.keyboard.press('Enter').catch(() => {}); // summary is focused after click: Enter toggles
      await p.waitForTimeout(200);
      r.afterEnter = await p.evaluate(() => ({ open: document.querySelector('#legal').open }));
    }
    res[key] = r;
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, res }, null, 1));
  for (const [k, r] of Object.entries(res)) console.log(LABEL, k, 'legalLen', r.legalLen, '| imgs', r.imgCount, 'tiles', r.tiles, 'tileBadges', r.tileBadges, 'visibleBadges', r.visibleBadges, '| clay', r.clayOrFixture.length, 'galHidden', r.galleryHidden, '| rows', r.rows, 'codes', [...new Set(r.codes)].join(','), '| errs', r.errors.length, 'bad', r.bad.length, 'dev', r.devVisible, 'hs', r.hscroll);
})();
