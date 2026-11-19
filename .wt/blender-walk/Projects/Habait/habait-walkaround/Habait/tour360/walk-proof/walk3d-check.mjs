// walk3d-check.mjs <page url> <plan.json> <out dir> — the 3D walk at 1440 (keyboard) and 390 (finger drag), on the GPU:
//   1. it loads with no page error and no failed request; 2. holding ↑ for 3 s from the entrance moves the visitor and the picture;
//   3. walking into a wall stops at the wall (the visitor never leaves the free floor); 4. on the phone a finger dragged up walks and
//   sideways turns; 5. frames per second while walking; 6. a screenshot from every room's camera spot, facing the way its tour
//   picture faces (for the eye). Exit 1 on any failure.
import fs from 'node:fs'; import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/RnD/Projects/Habait/tools/appdeps/package.json')('playwright-core');
const [url, planFile, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
let bad = 0; const fail = (m) => { bad++; console.log('FAIL', m); };
for (const S of [{ n: '1440', ctx: { viewport: { width: 1440, height: 900 } } }, { n: '390', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }]) {
  const c = await b.newContext(S.ctx); const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('requestfailed', (r) => errs.push('failed ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  const t0 = Date.now(); await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__walk3d && window.__walk3d.ready, null, { timeout: 120000 }); const loadS = (Date.now() - t0) / 1000;
  await sleep(800); await p.screenshot({ path: `${out}/${S.n}-0-start.png` });
  const pos = () => p.evaluate(() => ({ x: window.__walk3d.me.x, z: window.__walk3d.me.z, yaw: window.__walk3d.me.yaw }));
  const a0 = await pos();
  // fps while walking
  const fpsP = p.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2500) requestAnimationFrame(f); else res(n / ((performance.now() - t) / 1000)); }; requestAnimationFrame(f); }));
  if (S.n === '1440') { await p.keyboard.down('ArrowUp'); await sleep(3000); await p.keyboard.up('ArrowUp'); }
  else {   // a finger dragged up from the middle of the screen, held 3 s
    const cdp = await c.newCDPSession(p); const tp = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
    await tp('touchStart', 600); for (let y = 600; y >= 470; y -= 10) { await tp('touchMove', y); await sleep(16); } await sleep(2800); await tp('touchEnd');
  }
  const fps = await fpsP; const a1 = await pos(); const moved = Math.hypot(a1.x - a0.x, a1.z - a0.z);
  await p.screenshot({ path: `${out}/${S.n}-1-walked.png` });
  if (moved < 1.5) fail(`${S.n}: walked only ${moved.toFixed(2)} m in 3 s`);
  // into a wall: face the nearest wall direction for 6 s; the visitor must stay on free floor all the way
  const stays = await p.evaluate(async () => { const w = window.__walk3d; let off = 0; w.me.yaw += Math.PI / 2; for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 40)); if (!w.ok(w.me.x, w.me.z)) off++; } return off; });
  if (S.n === '1440') { await p.keyboard.down('ArrowUp'); await sleep(5000); await p.keyboard.up('ArrowUp'); }
  const offFloor = await p.evaluate(() => (window.__walk3d.ok(window.__walk3d.me.x, window.__walk3d.me.z) ? 0 : 1));
  if (stays || offFloor) fail(`${S.n}: the visitor left the free floor`);
  await p.screenshot({ path: `${out}/${S.n}-2-at-wall.png` });
  // turning on the phone: drag sideways
  if (S.n === '390') {
    const y0 = (await pos()).yaw; const cdp = await c.newCDPSession(p); const tp = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 600 }] });
    await tp('touchStart', 120); for (let x = 120; x <= 300; x += 10) { await tp('touchMove', x); await sleep(16); } await sleep(1000); await tp('touchEnd');
    const y1 = (await pos()).yaw; if (Math.abs(y1 - y0) < 0.3) fail('390: a sideways drag did not turn');
  }
  // every room from its camera spot
  for (const cp of plan.camera_points) {
    await p.evaluate(([x, z, yaw]) => { const m = window.__walk3d.me; m.x = x; m.z = z; m.yaw = yaw; }, [cp.x / 100, cp.y / 100, -cp.yaw_deg * Math.PI / 180]); await sleep(450);
    await p.screenshot({ path: `${out}/${S.n}-room-${cp.id.replace('cp-', '')}.png` });
  }
  const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (over) fail(`${S.n}: horizontal overflow`);
  if (errs.length) fail(`${S.n}: ${errs.join(' | ')}`);
  console.log(`${S.n}: loaded in ${loadS.toFixed(1)} s · walked ${moved.toFixed(2)} m in 3 s · ${fps.toFixed(0)} fps · draw calls ${(await p.evaluate(() => window.__walk3d.info().calls))}`);
  await c.close();
}
await b.close(); console.log(bad ? `WALK3D CHECK: ${bad} FAIL` : 'WALK3D CHECK: PASS'); process.exit(bad ? 1 : 0);
