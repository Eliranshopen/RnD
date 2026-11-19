// phase 4 audit probe. usage: node p4.cjs <section>   (platform on :8852 buyer.test, Studio fixture on :8853)
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const sec = process.argv[2];
const VP = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const PAGES = { home: 'http://buyer.test:8852/', landing: 'http://buyer.test:8852/landing.html?project=rainbow&v=a', landingB: 'http://buyer.test:8852/landing.html?project=rainbow&v=b', apartment: 'http://buyer.test:8852/apartment.html?project=rainbow&unit=846', flow: 'http://buyer.test:8852/flow.html?project=rainbow',
  studio: 'http://127.0.0.1:8853/#/', studioProject: 'http://127.0.0.1:8853/#/p/apt846-rainbow-tlv', studioNew: 'http://127.0.0.1:8853/#/new' };
const launch = () => chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

async function keyboard() { // tab path: each stop, focus ring visible?
  const b = await launch();
  for (const [name, url] of Object.entries(PAGES)) for (const sz of ['desk', 'phone']) {
    const ctx = await b.newContext({ ...VP[sz], reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(2000);
    const stops = []; let first = null;
    for (let i = 0; i < 45; i++) {
      await p.keyboard.press('Tab');
      const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        const ow = parseFloat(cs.outlineWidth) || 0; const ring = (cs.outlineStyle !== 'none' && ow > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
        const after = getComputedStyle(e, '::after'); const ringAfter = after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0;
        return { id: (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')), ring: !!(ring || ringAfter), vis: r.width > 0 && r.height > 0, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18) }; });
      if (!s) break; if (first === s.id + s.label && stops.length > 2) break; if (!first) first = s.id + s.label; stops.push(s);
    }
    const noRing = stops.filter((s) => !s.ring).map((s) => s.id); const invis = stops.filter((s) => !s.vis).map((s) => s.id);
    console.log(`KB ${name}/${sz}: ${stops.length} stops | no visible ring: ${noRing.length} ${noRing.slice(0, 4).join(',')} | zero-size focus: ${invis.length} ${invis.slice(0, 3).join(',')} | first: ${stops.slice(0, 5).map((s) => s.id.slice(0, 22)).join(' > ')}`);
    await ctx.close();
  }
  await b.close();
}

async function motion() {
  const b = await launch();
  for (const [name, url] of Object.entries(PAGES)) {
    const ctx = await b.newContext({ ...VP.desk, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const sec = (s) => s.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1)); let mt = 0, ma = 0, off = [];
      for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); const t = Math.max(...sec(cs.transitionDuration)), a = Math.max(...sec(cs.animationDuration)); const it = cs.animationIterationCount; if (t > mt) mt = t; if (a > ma) ma = a; if ((t > 0.01 || a > 0.01) && off.length < 4) off.push(e.tagName + '.' + String(e.className).split(' ')[0] + ' t' + t + ' a' + a + ' ' + it); }
      const vids = [...document.querySelectorAll('video')].map((v) => ({ autoplay: v.autoplay, paused: v.paused, src: (v.currentSrc || '').slice(-30) })); return { mt, ma, off, vids }; });
    console.log(`RM ${name}: max transition ${r.mt}s max animation ${r.ma}s offenders ${JSON.stringify(r.off)} videos ${JSON.stringify(r.vids)}`);
    await ctx.close();
  }
  await b.close();
}

async function targets() { // interactive targets >= 44px on phone, visible only
  const b = await launch();
  for (const name of ['home', 'landing', 'apartment', 'studio', 'studioProject', 'studioNew']) {
    const ctx = await b.newContext({ ...VP.phone }); const p = await ctx.newPage(); await p.goto(PAGES[name], { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=tab],[role=button]')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); }).map((e) => { const r = e.getBoundingClientRect(); return { id: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0], w: Math.round(r.width), h: Math.round(r.height), t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 14) }; }).filter((x) => x.h < 44 || x.w < 44));
    console.log(`TGT ${name}/phone: ${r.length} under 44px: ${JSON.stringify(r.slice(0, 8))}`);
    await ctx.close();
  }
  await b.close();
}

async function cls() { // layout shift during load + scroll, images with reserved boxes
  const b = await launch();
  for (const name of ['home', 'landing', 'landingB', 'apartment', 'studio', 'studioProject']) for (const sz of ['desk', 'phone']) {
    const ctx = await b.newContext(VP[sz]); const p = await ctx.newPage();
    await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await p.goto(PAGES[name], { waitUntil: 'load' }); await p.waitForTimeout(2500); const clsLoad = await p.evaluate(() => Math.round(window.__cls * 1000) / 1000); await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }); await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, imgs: [...document.images].filter((i) => i.getBoundingClientRect().width > 0).length, noBox: [...document.images].filter((i) => { const cs = getComputedStyle(i); const par = i.parentElement; const ps = par ? getComputedStyle(par) : {}; return i.getBoundingClientRect().width > 0 && !(i.getAttribute('width') && i.getAttribute('height')) && cs.aspectRatio === 'auto' && !(ps.aspectRatio && ps.aspectRatio !== 'auto') && !/absolute/.test(cs.position); }).length, loaders: [...document.querySelectorAll('[class*=spinner],[class*=loader],.loading-overlay')].filter((e) => e.getBoundingClientRect().width > window.innerWidth * 0.8 && e.getBoundingClientRect().height > window.innerHeight * 0.8).length }));
    await p.evaluate(() => { window.__src = []; }); console.log(`CLS ${name}/${sz}: load ${clsLoad} total ${JSON.stringify(r)}`);
    await ctx.close();
  }
  await b.close();
}

async function contrast() { // measured text contrast on solid backgrounds, both pages; flag < 4.5 (or 3 for >= 24px / bold 18.66px)
  const b = await launch();
  for (const name of ['home', 'landing', 'landingB', 'apartment', 'studio', 'studioProject', 'studioNew']) for (const sz of ['desk', 'phone']) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ ...VP[sz], colorScheme: theme, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    const url = PAGES[name] + (name === 'home' || name === 'landing' || name === 'landingB' ? (PAGES[name].includes('?') ? '&' : '?') + 'theme=' + theme : ''); await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    if (name.startsWith('studio')) await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const r = await p.evaluate(() => {
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const x = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: x[0], g: x[1], b: x[2], a: x[3] === undefined ? 1 : x[3] }; };
      const bgOf = (e) => { let acc = null; const layers = []; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return { img: true }; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; } } let base = { r: 255, g: 255, b: 255 }; for (const l of layers.reverse()) base = { r: base.r * (1 - l.a) + l.r * l.a, g: base.g * (1 - l.a) + l.g * l.a, b: base.b * (1 - l.a) + l.b * l.a }; return base; };
      const out = []; const seen = new Set();
      for (const e of document.querySelectorAll('body *')) { if (!e.childNodes.length) continue; const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own.length) continue; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.opacity === '0' || e.closest('[hidden]') || e.closest('template,script,style,option')) continue;
        const bg = bgOf(e); if (bg.img) continue; const fg = parse(cs.color); if (!fg) continue; const fa = fg.a; const f = { r: fg.r * fa + bg.r * (1 - fa), g: fg.g * fa + bg.g * (1 - fa), b: fg.b * fa + bg.b * (1 - fa) };
        out.push({ sel: e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0], fg: f, bg, size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700, txt: own[0].textContent.trim().slice(0, 22) }); }
      return out;
    });
    const L = (c) => lum(c.r, c.g, c.b); const bad = []; let worst = 99;
    for (const o of r) { const a = L(o.fg), bb = L(o.bg); const cr = (Math.max(a, bb) + 0.05) / (Math.min(a, bb) + 0.05); const large = o.size >= 24 || (o.bold && o.size >= 18.66); const need = large ? 3 : 4.5; if (cr < worst) worst = cr; if (cr < need) bad.push(`${o.sel} "${o.txt}" ${cr.toFixed(2)}`); }
    const uniq = [...new Set(bad)];
    console.log(`CT ${name}/${sz}/${theme}: ${r.length} text nodes measured, worst ${worst.toFixed(2)}, below threshold: ${uniq.length} ${uniq.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
  await b.close();
}

async function misc() {
  const b = await launch();
  for (const name of ['home', 'landing', 'apartment', 'flow']) {
    const ctx = await b.newContext(VP.phone); const p = await ctx.newPage(); await p.goto(PAGES[name], { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, a11yLink: [...document.querySelectorAll('a')].filter((a) => /נגישות|accessib/i.test(a.textContent + a.getAttribute('href'))).map((a) => a.href).slice(0, 2), liveRegions: document.querySelectorAll('[aria-live],[role=status],[role=alert]').length, primaryVisible: [...document.querySelectorAll('.hb-btn--primary,.btn-primary')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]')).length, inputs: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((e) => e.getBoundingClientRect().width > 0).length, h1: document.querySelectorAll('h1').length, skip: !!document.querySelector('a[href^="#main"],a.skip'), mainLandmark: !!document.querySelector('main') }));
    console.log(`MISC ${name}: ${JSON.stringify(r)}`);
    await ctx.close();
  }
  await b.close();
}
({ keyboard, motion, targets, cls, contrast, misc }[sec])();
