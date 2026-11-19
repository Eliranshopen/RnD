// Gate 1 reviewer probe (scaffolding, never copied back). usage: node probe.cjs <section> ; base http://127.0.0.1:8852 / buyer.test:8852
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const SHOTS = process.env.SHOTS;
const sec = process.argv[2];
const VP = { desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const out = (...a) => console.log(...a);
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function launch() { return chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] }); }
async function mk(browser, size, extra = {}) {
  const ctx = await browser.newContext({ ...VP[size], locale: 'he-IL', ...extra });
  const page = await ctx.newPage();
  const m = { errors: [], warns: [], google: 0, bad: [], woff: [] };
  page.on('console', (x) => { if (x.type() === 'error') m.errors.push(x.text()); if (x.type() === 'warning') m.warns.push(x.text()); });
  page.on('pageerror', (e) => m.errors.push('pageerror ' + e.message));
  page.on('requestfailed', (r) => m.errors.push('reqfailed ' + r.url()));
  page.on('response', (r) => { const u = r.url(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) m.google++; if (r.status() >= 400) m.bad.push(r.status() + ' ' + u); if (/\.woff2/.test(u)) m.woff.push(r.status() + ' ' + new URL(u).origin + ' ' + u.split('/').pop()); });
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) m.google++; });
  return { ctx, page, m };
}

async function styleguide() {
  const b = await launch();
  for (const size of ['desk', 'phone']) for (const rm of ['no-preference', 'reduce']) {
    const { ctx, page, m } = await mk(b, size, { reducedMotion: rm });
    await page.goto('http://127.0.0.1:8852/styleguide.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')];
      let maxT = 0, maxA = 0, offenders = [];
      const sec = (s) => s.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1));
      for (const e of els) { const cs = getComputedStyle(e); const t = Math.max(...sec(cs.transitionDuration)), a = Math.max(...sec(cs.animationDuration)); if (t > maxT) maxT = t; if (a > maxA) maxA = a; if ((t > 0 || a > 0) && offenders.length < 5) offenders.push(e.tagName + '.' + e.className + ' t' + t + ' a' + a); }
      const btns = [...document.querySelectorAll('.hb-btn')].map((e) => getComputedStyle(e).transitionDuration);
      // elements overflowing horizontally beyond the viewport
      const vw = document.documentElement.clientWidth;
      const over = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).slice(0, 5).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().left) + '..' + Math.round(e.getBoundingClientRect().right));
      return { sw: document.documentElement.scrollWidth, cw: vw, bsw: document.body.scrollWidth, check1: document.fonts.check('16px Heebo'), check2: document.fonts.check('32px "Frank Ruhl Libre"'),
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ':' + f.weight), declared: [...document.fonts].length,
        maxT, maxA, offenders, btnN: btns.length, btnSet: [...new Set(btns)], over, themes: [...document.querySelectorAll('[data-theme]')].map((e) => e.dataset.theme), title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir };
    });
    out(`SG ${size}/${rm}`, JSON.stringify({ errors: m.errors, google: m.google, bad: m.bad, woff: m.woff.sort(), warns: m.warns.slice(0, 3), ...r }));
    if (rm === 'no-preference') await page.screenshot({ path: `${SHOTS}/sg_${size}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
}

async function pages() {
  const b = await launch();
  const URLS = { home: '/', landing: '/landing.html?project=rainbow', flow: '/flow.html?project=rainbow', apartment: '/apartment.html?project=rainbow&unit=846' };
  for (const host of ['buyer.test', '127.0.0.1']) for (const size of ['phone', 'desk']) for (const dev of [false, true]) for (const [name, path] of Object.entries(URLS)) {
    if (host === '127.0.0.1' && dev) continue; // 127.0.0.1 is DEV anyway
    const { ctx, page, m } = await mk(b, size);
    const url = `http://${host}:8852${path}${dev ? (path.includes('?') ? '&dev=1' : '?dev=1') : ''}`;
    await page.goto(url, { waitUntil: 'load' }).catch((e) => m.errors.push('goto ' + e.message));
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const all = [...document.querySelectorAll('body *')];
      const has = (s) => all.filter((e) => e.children.length === 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(s))).filter((e) => (e.textContent || '').includes(s));
      const vis = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); for (let p = e; p; p = p.parentElement) { if (getComputedStyle(p).display === 'none' || p.hidden || getComputedStyle(p).visibility === 'hidden') return false; } return r.width > 0 && r.height > 0; };
      const cnt = (s) => { const els = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(s))); return { dom: els.length, visible: els.filter(vis).length }; };
      const faces = [...document.fonts].filter((f) => /Heebo/.test(f.family));
      return { dev: document.documentElement.dataset.dev || null, devtxt: cnt('תצוגת פיתוח'), placeholders: cnt('placeholders'), clay: cnt('clay'), check: document.fonts.check('16px Heebo'), heeboFaces: faces.map((f) => f.status).join(','), bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 40), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    const cdp = await ctx.newCDPSession(page);
    let used = '';
    try { await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const doc = await cdp.send('DOM.getDocument'); const n = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'h1, h2, p, button, a' }); const f = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: n.nodeId }); used = f.fonts.map((x) => x.familyName + '(' + x.glyphCount + (x.isCustomFont ? ',custom' : '') + ')').join('|'); } catch (e) { used = 'cdp-err ' + e.message.slice(0, 60); }
    out(`PG ${host} ${size} dev=${dev} ${name}`, JSON.stringify({ ...r, platformFont: used, errors: m.errors, google: m.google, bad: m.bad, woff: m.woff.length, warns: m.warns.filter((w) => /preload|font/i.test(w)) }));
    await ctx.close();
  }
  await b.close();
}

async function home() {
  const b = await launch();
  const units = JSON.parse(fs.readFileSync('C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/fixtures/rainbow/units.json', 'utf8')).units;
  const tot = units.length, av = units.filter((u) => u.status === 'for-sale').length;
  out('EXPECTED summary from units.json:', tot, 'דירות', av, 'פנויות');
  for (const theme of ['light', 'dark']) for (const size of ['desk', 'phone']) for (const lang of ['he', 'en']) {
    const { ctx, page, m } = await mk(b, size);
    await page.addInitScript((l) => { try { localStorage.setItem('habait_lang', l); localStorage.setItem('lang', l); localStorage.setItem('habait.lang', l); } catch (e) {} }, lang);
    await page.goto(`http://buyer.test:8852/?theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.home-card', { timeout: 8000 }).catch(() => {});
    if (lang === 'en') { const lt = await page.textContent('#langToggle'); if (lt.trim() === 'EN') { await page.click('#langToggle'); await page.waitForTimeout(300); } }
    const r = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, lang: document.documentElement.lang, dir: document.documentElement.dir,
      status: [...document.querySelectorAll('.home-card__status')].map((e) => e.textContent.trim()), cards: document.querySelectorAll('.home-card').length,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: document.querySelector('h1').textContent.trim(),
      imgsBroken: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src), devVisible: /תצוגת פיתוח|TODO|placeholders|v0/.test(document.body.innerText),
      mark: (() => { const e = document.querySelector('.hb-media-card__mark img'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, nat: e.naturalWidth }; })(),
    }));
    // contrast of every text element vs nearest opaque background (rendered, not declared)
    const ct = await page.evaluate(() => {
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
      const bgOf = (e) => { for (let p = e; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c && c.a > 0.99) return c; if (getComputedStyle(p).backgroundImage !== 'none') return { img: p.className }; } return { r: 255, g: 255, b: 255, a: 1 }; };
      const res = [];
      for (const e of document.querySelectorAll('body *')) {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const fg = parse(cs.color); const bg = bgOf(e);
        res.push({ tag: e.tagName + '.' + (e.className || '').toString().split(' ')[0], txt: e.textContent.trim().slice(0, 24), fg, bg, fs: cs.fontSize, fw: cs.fontWeight });
      }
      return res;
    });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bad = [], overImg = [];
    for (const x of ct) { if (x.bg.img) { overImg.push(x.tag + ' over bg-image ' + x.bg.img); continue; } const a = lum(x.fg), c = lum(x.bg); const ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); const large = parseFloat(x.fs) >= 24 || (parseFloat(x.fs) >= 18.66 && +x.fw >= 700); if (ratio < (large ? 3 : 4.5)) bad.push(`${x.tag} "${x.txt}" ${ratio.toFixed(2)} fs${x.fs}`); }
    out(`HOME ${theme}/${size}/${lang}`, JSON.stringify({ ...r, errors: m.errors, bad: m.bad, google: m.google, lowContrast: bad, overImg: [...new Set(overImg)] }));
    await page.screenshot({ path: `${SHOTS}/home_${theme}_${size}_${lang}.png`, fullPage: false });
    await ctx.close();
  }
  await b.close();
}

async function mark() {
  const b = await launch();
  for (const theme of ['light', 'dark']) for (const size of ['desk', 'phone']) {
    const { ctx, page } = await mk(b, size);
    await page.goto(`http://buyer.test:8852/?theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hb-media-card__mark img');
    await page.waitForTimeout(500);
    const el = await page.$('.hb-media-card__mark');
    const buf = await el.screenshot();
    const p2 = await ctx.newPage();
    const px = await p2.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const m = new Map(); for (let i = 0; i < d.length; i += 4) { const k = [d[i] >> 3 << 3, d[i + 1] >> 3 << 3, d[i + 2] >> 3 << 3].join(','); const e = m.get(k) || { n: 0, i, x: (i / 4) % c.width, y: Math.floor(i / 4 / c.width) }; e.n++; m.set(k, e); } return { w: c.width, h: c.height, top: [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, v]) => ({ k, n: v.n, x: v.x, y: v.y, raw: [d[v.i], d[v.i + 1], d[v.i + 2]] })) }; }, buf.toString('base64'));
    const plate = px.top[0].raw;
    out(`MARK ${theme}/${size} ${px.w}x${px.h} plate=${plate}`);
    for (const t of px.top.slice(1)) out(`   cluster ${t.raw} n=${t.n} @(${t.x},${t.y}) contrast_vs_plate=${cr(t.raw, plate).toFixed(2)}`);
    fs.writeFileSync(`${SHOTS}/mark_${theme}_${size}.png`, buf);
    await ctx.close();
  }
  await b.close();
}

async function kbd() {
  const b = await launch();
  for (const theme of ['light', 'dark']) for (const size of ['desk', 'phone']) for (const dev of [false, true]) {
    const { ctx, page } = await mk(b, size);
    await page.goto(`http://buyer.test:8852/?theme=${theme}${dev ? '&dev=1' : ''}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.home-card');
    const seq = [];
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const af = getComputedStyle(e, '::after'); const bf = getComputedStyle(e, '::before'); const r = e.getBoundingClientRect(); return { t: e.tagName + '.' + (e.className || '').toString().split(' ')[0] + (e.id ? '#' + e.id : ''), txt: (e.textContent || '').trim().slice(0, 16), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, afterOutline: af.outlineStyle + ' ' + af.outlineWidth + ' ' + af.outlineColor, shadow: cs.boxShadow.slice(0, 40), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], inView: r.bottom > 0 && r.top < innerHeight }; });
      seq.push(d);
      if (!d) break;
    }
    out(`KBD ${theme}/${size}/dev=${dev}`); seq.forEach((s) => out('   ', JSON.stringify(s)));
    if (theme === 'light' && size === 'desk' && !dev) { await page.keyboard.press('Shift+Tab'); }
    await ctx.close();
  }
  await b.close();
}

async function edge() {
  const b = await launch();
  const mockUnits = (arr) => (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ units: arr }) });
  const cases = { empty: async (p) => p.route('**/projects.json', (r) => r.fulfill({ contentType: 'application/json', body: '{"projects":[]}' })), projectsFail: async (p) => p.route('**/projects.json', (r) => r.abort()),
    oneUnitZeroFree: async (p) => p.route('**/units.json', mockUnits([{ id: 'x', status: 'sold' }])), noUnits: async (p) => p.route('**/units.json', (r) => r.fulfill({ status: 404, body: 'no' })),
    emptyUnits: async (p) => p.route('**/units.json', mockUnits([])), badUnits: async (p) => p.route('**/units.json', (r) => r.fulfill({ contentType: 'application/json', body: '{"units":null}' })) };
  for (const [name, setup] of Object.entries(cases)) for (const size of ['desk', 'phone']) {
    const { ctx, page, m } = await mk(b, size);
    await setup(page);
    await page.goto('http://buyer.test:8852/?theme=light', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({ cards: document.querySelectorAll('.home-card').length, status: [...document.querySelectorAll('.home-card__status')].map((e) => e.textContent.trim()), emptyVis: !document.getElementById('projectsEmpty').hidden, gridHidden: document.getElementById('projects').hidden, busy: document.getElementById('projects').getAttribute('aria-busy'), emptyParts: [...document.querySelectorAll('#projectsEmpty .hb-empty__icon, #projectsEmpty .hb-empty__title, #projectsEmpty .hb-empty__text, #projectsEmpty button')].map((e) => e.className || e.tagName), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    out(`EDGE ${name}/${size}`, JSON.stringify({ ...r, errors: m.errors.slice(0, 2) }));
    if (name === 'empty') await page.screenshot({ path: `${SHOTS}/empty_${size}.png` });
    await ctx.close();
  }
  await b.close();
}

async function flowdev() {
  const b = await launch();
  for (const host of ['buyer.test', '127.0.0.1']) for (const q of ['', '&dev=1']) {
    const { ctx, page } = await mk(b, 'phone');
    await page.goto(`http://${host}:8852/flow.html?project=rainbow${q}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => { const n = document.getElementById('fixtureNote'); const cs = getComputedStyle(n); const hid = n.hidden; n.hidden = false; const forced = getComputedStyle(n).display; n.hidden = hid; return { text: n.textContent.trim().slice(0, 30), hiddenAttr: hid, display: cs.display, displayWhenForcedUnhidden: forced, dev: document.documentElement.dataset.dev || null, overlayVisible: !document.getElementById('startOverlay').hidden && getComputedStyle(document.getElementById('startOverlay')).display !== 'none' }; });
    out(`FLOWDEV ${host} ${q || '(none)'}`, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
}


async function hero() {
  const b = await launch();
  for (const theme of ['light', 'dark']) for (const size of ['desk', 'phone']) {
    const { ctx, page } = await mk(b, size);
    await page.goto(`http://buyer.test:8852/?theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => { const st = document.createElement('style'); st.id = 'hide'; st.textContent = '.home-hero__text h1, .home-hero__text p { color: transparent !important; text-shadow: none !important; }'; document.head.appendChild(st); const rects = {}; for (const sel of ['.home-hero__text h1', '.home-hero__text p']) { const e = document.querySelector(sel); const r = document.createRange(); r.selectNodeContents(e); rects[sel] = [...r.getClientRects()].map((q) => ({ x: q.left, y: q.top + scrollY, w: q.width, h: q.height })); } window.__c = getComputedStyle(document.querySelector('.home-hero__text h1')); return { rects, color: null, shadow: null }; });
    const cols = await (async () => { await page.evaluate(() => document.getElementById('hide').remove()); return page.evaluate(() => [getComputedStyle(document.querySelector('.home-hero__text h1')).color, getComputedStyle(document.querySelector('.home-hero__text h1')).textShadow, getComputedStyle(document.querySelector('.home-hero__text p')).color, getComputedStyle(document.querySelector('.home-hero__text p')).textShadow]); })();
    await page.evaluate(() => { const st = document.createElement('style'); st.id = 'hide'; st.textContent = '.home-hero__text h1, .home-hero__text p { color: transparent !important; text-shadow: none !important; }'; document.head.appendChild(st); });
    const buf = await page.screenshot({ fullPage: true });
    const p2 = await ctx.newPage();
    const dpr = VP[size].deviceScaleFactor;
    for (const [sel, rs] of Object.entries(info.rects)) for (const q of rs) {
      const res = await p2.evaluate(async ({ b64, q, dpr }) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = Math.ceil(q.w * dpr); c.height = Math.ceil(q.h * dpr); const g = c.getContext('2d'); g.drawImage(im, q.x * dpr, q.y * dpr, q.w * dpr, q.h * dpr, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data; const L = []; for (let i = 0; i < d.length; i += 4) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; L.push(0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2])); } L.sort((a, b) => a - b); return { mean: L.reduce((a, b) => a + b, 0) / L.length, p90: L[Math.floor(L.length * 0.9)], max: L[L.length - 1] }; }, { b64: buf.toString('base64'), q, dpr });
      const white = 1.0; const r = (l) => (white + 0.05) / (l + 0.05);
      out(`HERO ${theme}/${size} ${sel} line@(${Math.round(q.x)},${Math.round(q.y)}) text ${cols[sel.includes(' p') ? 2 : 0]} shadow ${cols[sel.includes(' p') ? 3 : 1].slice(0, 30)} | white-vs-bg contrast mean ${r(res.mean).toFixed(2)} p90-brightest ${r(res.p90).toFixed(2)} brightest ${r(res.max).toFixed(2)}`);
    }
    await ctx.close();
  }
  await b.close();
}

({ hero, styleguide, pages, home, mark, kbd, edge, flowdev })[sec]().catch((e) => { console.error('PROBE ERR', e); process.exit(1); });
