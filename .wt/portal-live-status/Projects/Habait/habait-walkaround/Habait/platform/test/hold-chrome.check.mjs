#!/usr/bin/env node
/* The hold's chrome at the stop (the first screen after the landing's «לסיור בפרויקט»; rainbow-landing round 3, 2026-11-08). Headless
   Chrome on a STAGE at 360×780, 390×844, 430×932 (phones) and 1440×900: landing CTA → the film → the stop; then the bounding boxes of the
   top elements — «הדמיית הבניין והסביבה», the sound button, the picker title, the legend, «דירות», the hint, the legal line, the drag
   hint — must not intersect each other, must sit inside the viewport, must not cover a visible apartment pill; the legal line (the AI
   disclosure) must be visible; the drag hint must go after the first drag. Screenshots + hold-chrome.json into --out. $0.
   usage: node test/hold-chrome.check.mjs <stage> --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const stage = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const OUT = argv[argv.indexOf('--out') + 1];
if (!stage || argv.indexOf('--out') < 0) { console.error('usage: hold-chrome.check.mjs <stage> --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.HABAIT_APP_DIR || 'C:/RnD/Projects/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(APP, 'package.json'))('playwright-core');
const { serveStatic } = await import(pathToFileURL(path.join(HERE, '..', '..', 'tools', 'qa', 'responsive-gate.mjs')).href);
const rw = fs.existsSync(path.join(stage, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(stage, 'vercel.json'), 'utf8')).rewrites : null;
const srv = serveStatic(path.resolve(stage), rw); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const phone = (w, h) => ({ name: String(w), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const SIZES = [phone(360, 780), phone(390, 844), phone(430, 932), { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }];
const res = { at: new Date().toISOString(), base, sizes: {}, fails: [] };
const fail = (s, m) => { res.fails.push(`${s}: ${m}`); console.log(`  FAIL ${s}: ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOP = { building: '#buildingBtn', sound: '#soundBtn', title: '#pickerStage .picker-title', legend: '#pickerStage .picker-legend', units: '#pickerStage .picker-units-btn', hint: '#pickerStage .picker-hint', legal: '#pickerStage .picker-disclaimer', drag: '#dragHint' };
const boxes = (page) => page.evaluate((TOP) => {
  const out = {};
  for (const [k, sel] of Object.entries(TOP)) {
    const e = document.querySelector(sel); if (!e) continue;
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    let vis = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    for (let a = e.parentElement; a && vis; a = a.parentElement) if (getComputedStyle(a).display === 'none' || a.hidden) vis = false;
    if (k === 'drag' && !e.classList.contains('on')) vis = false;
    if (vis) out[k] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), opacity: cs.opacity };
  }
  const pills = [...document.querySelectorAll('#pickerStage .hotspot')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.unit, x: r.left, y: r.top, r: r.right, b: r.bottom }; }).filter((p) => p.r > 0 && p.x < innerWidth && p.b > 0 && p.y < innerHeight);
  return { out, pills, W: innerWidth, H: innerHeight };
}, TOP);
const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1;

for (const S of SIZES) {
  const R = res.sizes[S.name] = {}; console.log(`== ${S.name}`);
  const ctx = await browser.newContext({ ...S }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => /hold/.test(document.getElementById('heroCta').href));
  await Promise.all([page.waitForURL(/\/hold\//, { timeout: 20000 }), page.click('#heroCta')]);
  try { await page.waitForFunction(() => window.__orbit && window.__orbit.done, null, { timeout: 60000 }); } catch { fail(S.name, 'no stop'); }
  try { await page.waitForFunction(() => document.getElementById('dragHint').classList.contains('on'), null, { timeout: 8000 }); R.dragShown = true; } catch { R.dragShown = false; }
  await sleep(2600);
  const m = await boxes(page); R.boxes = m.out; R.pills = m.pills.map((p) => p.id);
  const keys = Object.keys(m.out);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (hit(m.out[keys[i]], m.out[keys[j]])) fail(S.name, `${keys[i]} overlaps ${keys[j]} ${JSON.stringify([m.out[keys[i]], m.out[keys[j]]])}`);
  for (const k of keys) { const b = m.out[k]; if (b.x < -1 || b.r > m.W + 1 || b.y < -1 || b.b > m.H + 1) fail(S.name, `${k} leaves the viewport ${JSON.stringify(b)}`); }
  for (const k of keys) for (const p of m.pills) if (hit(m.out[k], p)) fail(S.name, `${k} covers pill ${p.id}`);
  if (!m.out.legal) fail(S.name, 'the legal line (AI disclosure) is not visible');
  R.legalText = await page.evaluate(() => document.querySelector('#pickerStage .picker-disclaimer')?.textContent.slice(0, 80));
  await page.screenshot({ path: path.join(OUT, `h1-stop-${S.name}.png`) });
  // the first drag: the hint goes
  const cx = m.W / 2, cy = m.H * 0.55;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 80, cy, { steps: 8 }); await page.mouse.up();
  if (S.hasTouch) { try { await page.touchscreen.tap(5, m.H - 5); } catch { /* not needed */ } }
  await sleep(1200);
  R.dragAfter = await page.evaluate(() => document.getElementById('dragHint').classList.contains('on'));
  if (R.dragShown && R.dragAfter) fail(S.name, 'the drag hint stays after the first drag');
  await page.screenshot({ path: path.join(OUT, `h2-after-drag-${S.name}.png`) });
  R.errors = errors; if (errors.length) fail(S.name, 'page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
res.pass = res.fails.length === 0;
fs.writeFileSync(path.join(OUT, 'hold-chrome.json'), JSON.stringify(res, null, 1));
console.log(res.pass ? `PASS · ${OUT}` : `FAIL · ${res.fails.length} · ${OUT}`);
process.exit(res.pass ? 0 : 1);
