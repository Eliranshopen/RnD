#!/usr/bin/env node
/* The flow behind the landing's «לסיור בפרויקט» (Eliran 2026-11-08: «מעבר לסיור בפרויקט ואז מתחיל כל הסרטון ריחוף של הבניין ועצירה ומראה של כל
   הדירות … ואוכל לבחור כמו שהיה עד עכשיו»). Headless Chrome on a STAGE (stage_flow.py output) at 1440×900 and 390×844:
     landing → the CTA → the hold plays the fly-around film (#clip advances) → the film ends and the hold stops in front of the tower →
     the picker shows the apartments (pills counted; every unit of units.json has a marker) → pick one (its card) → pick 846 → «המשיכו
     אל הדירה» → the APARTMENT JOURNEY (/apartment-journey/?from=hold…, 2026-11-09 round 2: floor 16 lit, «16», «דירה 846») → its
     «לסיור 360° בדירה» → the tour in the journey's frame (#tourFrame, /tour/, the AudioContext unlocked in that tap) → back: «חזרה לבניין»
     → the hold at the stop → 846's «לסיור 360°» (the direct way, unchanged) → the descent → the tour (#tourFrame) in front.
   Also: the CTA href equals the one the production home page (the pre-landing page, 1a54ce0) gives, origins stripped — the route is unchanged.
   Screenshots f1…f7 + flow.json into --out. $0 (prod is only read). usage: node test/rainbow-flow.check.mjs <stage> --out <dir> [--prod <url>] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const stage = argv.find((a, i) => !a.startsWith('--') && !['--out', '--prod'].includes(argv[i - 1]));
const OUT = opt('--out'); const PROD = opt('--prod', 'https://habait-flow.vercel.app/');
if (!stage || !OUT) { console.error('usage: rainbow-flow.check.mjs <stage> --out <dir> [--prod url]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const units = JSON.parse(fs.readFileSync(path.join(stage, 'fixtures', 'rainbow', 'units.json'), 'utf8')).units.map((u) => String(u.id));
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const SIZES = [{ name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const res = { at: new Date().toISOString(), base, units, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the orbit clip's FILE may change (2026-11-09: orbit_real.mp4 -> orbit_fast.mp4, the same film at 2x); the route and every other param may not
const norm = (href) => { const u = new URL(href); const q = [...u.searchParams].map(([k, v]) => [k, v.replace(/^https?:\/\/[^/]+/, '').replace(/orbit_(real|fast)\.mp4$/, 'orbit_*.mp4')]).sort(); return u.pathname + '?' + q.map(([k, v]) => `${k}=${v}`).join('&'); };

// the production home page = the page before the landing (1a54ce0): its CTA route
try {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load', timeout: 45000 });
  await p.waitForFunction(() => { const a = document.getElementById('heroCta'); return a && !a.hidden && /hold/.test(a.href); }, null, { timeout: 20000 });
  res.prodCta = await p.getAttribute('#heroCta', 'href'); await ctx.close();
} catch (e) { res.prodCta = null; res.prodCtaError = e.message; }

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `f1-landing-${S.name}.png`) });
  R.cta = await page.getAttribute('#heroCta', 'href');
  if (res.prodCta) { R.sameRouteAsProd = norm(new URL(R.cta, base).href) === norm(res.prodCta); if (!R.sameRouteAsProd) fail(S.name, `CTA route differs from prod: ${norm(new URL(R.cta, base).href)} vs ${norm(res.prodCta)}`); }
  // the CTA → the hold; the fly-around film plays
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  try { await page.waitForFunction(() => { const v = document.getElementById('clip'); return v && v.currentTime > 2; }, null, { timeout: 30000 }); } catch { fail(S.name, 'the fly-around film did not play'); }
  R.film = await page.evaluate(() => { const v = document.getElementById('clip'); return { src: (v.currentSrc || '').split('/').pop(), t: v.currentTime, dur: v.duration }; });
  await page.screenshot({ path: path.join(OUT, `f2-film-${S.name}.png`) });
  // the stop: the film ends, the hold rests in front of the tower and the pills come up
  try { await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 }); } catch { fail(S.name, 'the film never handed over to the hold'); }
  try { await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].filter((b) => b.offsetParent && getComputedStyle(b).display !== 'none').length > 0, null, { timeout: 20000 }); } catch { fail(S.name, 'no apartment pills at the hold'); }
  await sleep(3500);   // the hold eases onto the units (holdEase ~2.6 s)
  R.picker = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#pickerStage .hotspot')];
    const vis = all.filter((b) => { const r = b.getBoundingClientRect(); return r.width && getComputedStyle(b).display !== 'none' && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });
    return { markers: all.map((b) => b.dataset.unit), visible: vis.map((b) => b.dataset.unit) };
  });
  const missing = units.filter((u) => !R.picker.markers.includes(u));
  if (missing.length) fail(S.name, `units without a marker: ${missing.join(',')}`);
  if (R.picker.visible.length < 2) fail(S.name, `only ${R.picker.visible.length} pills visible at the stop`);
  await page.screenshot({ path: path.join(OUT, `f3-stop-all-apartments-${S.name}.png`) });
  // pick another apartment: its card opens (the same picker as before)
  const other = R.picker.visible.find((u) => u !== '846');
  if (other) {
    await page.click(`#pickerStage .hotspot[data-unit="${other}"]`); await sleep(800);
    R.otherCard = await page.evaluate(() => { const s = document.getElementById('unitSheet'); return { open: s && !s.hidden, text: s ? s.innerText.slice(0, 160) : '' }; });
    if (!R.otherCard.open) fail(S.name, `card did not open for ${other}`);
    await page.screenshot({ path: path.join(OUT, `f4-pick-${other}-${S.name}.png`) });
    await page.click('#unitClose').catch(() => {}); await sleep(400);
  }
  // pick 846 and enter
  if (R.picker.visible.includes('846')) await page.click('#pickerStage .hotspot[data-unit="846"]');
  else await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click());
  await sleep(800);
  R.card846 = await page.evaluate(() => { const s = document.getElementById('unitSheet'); const b = document.getElementById('unitContinue'); return { open: s && !s.hidden, enter: b ? { text: b.textContent.trim(), disabled: b.disabled } : null }; });
  await page.screenshot({ path: path.join(OUT, `f5-pick-846-${S.name}.png`) });
  if (!R.card846.enter || R.card846.enter.disabled) fail(S.name, 'no enabled enter button on 846');
  R.card846.direct = await page.evaluate(() => { const b = document.getElementById('unitTour360'); return b ? b.textContent.trim() : null; });
  R.card846.glow = await page.evaluate(() => (window.__glow ? { on: window.__glow.on, points: window.__glow.points } : null));
  if (!R.card846.glow || !R.card846.glow.on) fail(S.name, '846 picked but its floor does not glow at the hold');
  if (!R.card846.direct) fail(S.name, '846 card lacks the direct «לסיור 360°»');
  // «המשיכו אל הדירה» → the apartment journey
  await Promise.all([page.waitForURL(/\/apartment-journey\//, { timeout: 20000 }), page.click('#unitContinue')]);
  R.journey = { url: page.url().replace(base, '') };
  if (!/from=hold/.test(R.journey.url) || !/unit=846/.test(R.journey.url)) fail(S.name, 'journey URL lacks from=hold / unit=846');
  await page.screenshot({ path: path.join(OUT, `f6-journey-open-${S.name}.png`) });
  try { await page.waitForFunction(() => document.querySelector('[data-floor-num]').textContent.trim() === '16' && getComputedStyle(document.querySelector('[data-band]')).opacity === '1', null, { timeout: 15000 }); } catch { fail(S.name, 'the journey did not reveal floor 16 by itself'); }
  await sleep(800);
  R.journey.floor = await page.evaluate(() => ({ num: document.querySelector('[data-floor-num]').textContent.trim(), unit: document.querySelector('[data-floor-unit]').innerText.trim(), hero: getComputedStyle(document.getElementById('hero')).display, back: document.getElementById('backHold').href, badge: !!document.querySelector('.v2-floor .hb-ai-badge') }));
  if (R.journey.floor.hero !== 'none') fail(S.name, 'the journey shows the project hero');
  if (!/\/hold\//.test(R.journey.floor.back) || /orbit=/.test(R.journey.floor.back)) fail(S.name, '«חזרה לבניין» is not the hold at the stop');
  await page.screenshot({ path: path.join(OUT, `f7-journey-floor16-${S.name}.png`) });
  // down the journey: the cutaway, the rooms, the way on
  for (const [id, k, f] of [['cutaway', 0.4, 'f8-journey-cutaway'], ['rooms', 0.3, 'f9-journey-rooms'], ['go', 0.6, 'f10-journey-cta']]) {
    await page.evaluate(([id, k]) => { const el = document.getElementById(id); const y = el.offsetTop + Math.max(0, el.offsetHeight - innerHeight) * k; if (window.__v2 && window.__v2.lenis) window.__v2.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }, [id, k]);
    await sleep(1800); await page.screenshot({ path: path.join(OUT, `${f}-${S.name}.png`) });
  }
  await page.click('#ctaTour');
  try { await page.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && f.classList.contains('is-on') && /\/tour\//.test(f.src); }, null, { timeout: 25000 }); } catch { fail(S.name, 'the journey did not open the tour'); }
  await sleep(3000);
  R.journey.tour = await page.evaluate(() => { const f = document.getElementById('tourFrame'); const H = window.__habaitAudio; return { src: f ? f.src.replace(location.origin, '') : null, audio: !!(H && H.ac) }; });
  if (!R.journey.tour.audio) fail(S.name, 'no AudioContext unlocked in the tour tap');
  await page.screenshot({ path: path.join(OUT, `f11-journey-tour-${S.name}.png`) });
  // back to the building, then the direct way (unchanged): 846 → «לסיור 360°» → the descent → the tour
  await page.evaluate(() => { const f = document.getElementById('tourFrame'); if (f) f.remove(); document.documentElement.classList.remove('is-tour'); });
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.evaluate(() => { location.href = document.getElementById('backHold').href; })]);
  try { await page.waitForFunction(() => [...document.querySelectorAll('#pickerStage .hotspot')].some((b) => b.dataset.unit === '846' && b.offsetParent), null, { timeout: 40000 }); } catch { fail(S.name, 'back at the hold: no 846 pill'); }
  await sleep(2500);
  await page.evaluate(() => document.querySelector('#pickerStage .hotspot[data-unit="846"]').click()); await sleep(800);
  await page.click('#unitTour360'); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `f12-direct-descent-${S.name}.png`) });
  try { await page.waitForFunction(() => { const f = document.getElementById('tourFrame'); return f && getComputedStyle(f).opacity === '1'; }, null, { timeout: 25000 }); } catch { fail(S.name, 'the direct way: the apartment tour did not come in front'); }
  await sleep(4000);
  R.entered = await page.evaluate(() => { const f = document.getElementById('tourFrame'); return f ? { src: f.src.replace(location.origin, ''), opacity: getComputedStyle(f).opacity, audio: !!(window.__habaitAudio && window.__habaitAudio.ac) } : null; });
  if (!R.entered || !/\/tour\//.test(R.entered.src)) fail(S.name, 'tour frame is not the /tour/ page');
  await page.screenshot({ path: path.join(OUT, `f13-direct-tour-${S.name}.png`) });
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
// the old test link /v2/ forwards to the project landing, never to the apartment journey (Eliran 2026-11-09: no entry point about one apartment)
{
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto(base + '/v2/', { waitUntil: 'load' });
  try { await p.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }); } catch { /* checked below */ }
  res.v2 = new URL(p.url()).pathname;
  if (res.v2 !== '/') fail('v2', `/v2/ forwards to ${res.v2}, not to the landing /`);
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'flow.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
