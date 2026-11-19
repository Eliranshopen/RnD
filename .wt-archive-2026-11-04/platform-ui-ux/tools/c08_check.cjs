// card 08: the Studio on its REAL server (:8853, working copy). Creates "ui-check", uploads one image, checks the row and the
// projects card. Never presses create/approve and never calls a stage endpoint. usage: node c08_check.cjs <frames> <out>
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const fs = require('fs');
const [FR, OUT] = process.argv.slice(2);
fs.mkdirSync(FR, { recursive: true });
const BASE = 'http://127.0.0.1:8853';
const IMG = 'C:/RnD/Projects/Habait/research/platform-ui-ux-2026-11-03/current/desk_01_home.png';
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [], calls = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  p.on('request', (r) => { if (r.method() !== 'GET') calls.push(`${r.method()} ${r.url().replace(BASE, '')}`); });
  const R = {};
  await p.goto(`${BASE}/#/new`); await p.waitForTimeout(800);
  await p.fill('#new-form [name=name]', 'ui-check'); await p.click('#new-form button[type=submit]');
  await p.waitForFunction(() => location.hash.startsWith('#/p/'), null, { timeout: 10000 });
  R.projectId = decodeURIComponent((await p.evaluate(() => location.hash)).slice(3));
  await p.waitForTimeout(800); await p.screenshot({ path: `${FR}/01_new_project.png` });
  // upload: watch the row go uploading -> done
  const states = [];
  const watch = p.evaluate(() => new Promise((res) => { const seen = []; const obs = new MutationObserver(() => { document.querySelectorAll('#file-list .hb-file').forEach((r) => { const s = r.dataset.state + (r.querySelector('.hb-file__progress') ? ':progress' : ''); if (seen[seen.length - 1] !== s) seen.push(s); }); }); obs.observe(document.getElementById('file-list'), { subtree: true, childList: true, attributes: true }); setTimeout(() => { obs.disconnect(); res(seen); }, 6000); }));
  await p.setInputFiles('#file-input', IMG);
  states.push(...await watch);
  await p.waitForTimeout(500);
  R.rowStates = states;
  R.row = await p.evaluate(() => { const r = document.querySelector('#file-list .hb-file'); return r ? { state: r.dataset.state, name: r.querySelector('.hb-file__name').innerText, meta: r.querySelector('.hb-file__meta').innerText, role: r.querySelector('.hb-chip-select')?.selectedOptions[0]?.textContent } : null; });
  R.fixtureBanner = await p.isVisible('#fixture-banner');
  await p.evaluate(() => document.getElementById('s-upload').scrollIntoView()); await p.screenshot({ path: `${FR}/02_uploaded.png` });
  await p.goto(`${BASE}/#/`); await p.waitForTimeout(1200);
  R.projectCards = await p.evaluate(() => [...document.querySelectorAll('.pcard .hb-media-card__title')].map((e) => e.innerText));
  await p.screenshot({ path: `${FR}/03_projects.png` });
  R.nonGetCalls = calls; R.errors = errs;
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
})();
