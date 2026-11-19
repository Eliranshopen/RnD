// loadtest.mjs (task 09): does apt846.glb load in <model-viewer> in < 2 s on a simulated mobile 4G link?
//   HABAIT_APP_DIR=C:/Habait/tools/appdeps node loadtest.mjs [glb] [--cpu 4]
// Serves this folder on 127.0.0.1, opens headless Edge (playwright-core from HABAIT_APP_DIR), loads model-viewer
// from Google's CDN UNTHROTTLED, then turns on the throttle (CDP Network.emulateNetworkConditions, cache off) and
// times `src = glb` -> the element's `load` event. The Draco decoder (gstatic) is fetched under the throttle too,
// as a first-time visitor would (cache disabled). Each profile runs RUNS times in a fresh context; the verdict uses the
// median (the first run of a process also pays DNS/TLS to the CDNs). Profiles = Chrome DevTools presets.
// Exit 0 = Fast 4G median under 2000 ms and no console errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const glb = args.find((a) => a.endsWith('.glb')) || 'apt846.glb';
const RUNS = 3;
const cpu = Number((args[args.indexOf('--cpu') + 1]) || 1) || 1;
const appDir = process.env.HABAIT_APP_DIR || 'C:/Habait/tools/appdeps';
const { chromium } = createRequire(path.join(appDir, 'package.json'))('playwright-core');
const MV = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
const PROFILES = {   // DevTools presets (bytes/s, ms)
  'fast-4g': { downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9, latency: 60 * 2.75 },
  'slow-4g': { downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (0.75e6 / 8) * 0.9, latency: 150 * 3.75 },
};
const page_html = `<!doctype html><html><head><meta charset="utf-8">
<script type="module" src="${MV}"></script>
<style>html,body{margin:0;height:100%}model-viewer{width:100%;height:100%}</style></head>
<body><model-viewer id="mv" camera-controls shadow-intensity="1" exposure="1"></model-viewer></body></html>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
  const f = path.join(here, path.basename(u));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream',
    'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const bytes = fs.statSync(path.join(here, glb)).size;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const out = { glb, bytes, cpu_throttle: cpu, model_viewer: MV, runs: {}, console_errors: [] };
try {
  for (const [name, prof] of Object.entries(PROFILES)) for (let run = 0; run < RUNS; run++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') out.console_errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', (e) => out.console_errors.push(`${name}: ${e.message}`));
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!customElements.get('model-viewer'), null, { timeout: 30000 });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...prof });
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const r = await page.evaluate((src) => new Promise((resolve) => {
      const mv = document.getElementById('mv');
      const t0 = performance.now();
      const done = (ok, why) => resolve({ ok, why, ms: Math.round(performance.now() - t0) });
      mv.addEventListener('load', () => done(true, 'load'), { once: true });
      mv.addEventListener('error', (e) => done(false, `error ${JSON.stringify(e.detail || {})}`), { once: true });
      setTimeout(() => done(false, 'timeout 30 s'), 30000);
      mv.src = src;
    }), `${base}/${glb}?t=${Date.now()}`);
    (out.runs[name] ||= []).push(r);
    console.log(`${name} #${run + 1}: ${r.ok ? 'loaded' : 'FAILED'} in ${r.ms} ms (${r.why})`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const med = (a) => { const v = a.map((r) => (r.ok ? r.ms : 1e9)).sort((x, y) => x - y); return v[(v.length - 1) >> 1]; };
out.median_ms = Object.fromEntries(Object.entries(out.runs).map(([k, v]) => [k, med(v)]));
fs.writeFileSync(path.join(here, `loadtest${cpu > 1 ? `-cpu${cpu}` : ''}.json`), JSON.stringify(out, null, 2));
const pass = out.median_ms['fast-4g'] < 2000 && out.console_errors.length === 0;
console.log(`bytes ${bytes}; medians ${JSON.stringify(out.median_ms)}; console errors ${out.console_errors.length}; ` +
  `fast-4g median < 2000 ms: ${pass ? 'PASS' : 'FAIL'}`);
for (const e of out.console_errors) console.log('  console:', e);
process.exit(pass ? 0 : 1);
