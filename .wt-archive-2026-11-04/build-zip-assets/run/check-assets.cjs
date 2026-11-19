// build-zip-assets check: the standalone dist page (dist-b, with platform-ui-ux's tokens/components/fonts) opens from
// file:// with every css/font request served (no failed request), and the Heebo / Frank Ruhl Libre faces load.
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const F = 'file:///C:/RnD/.wt/build-zip-assets/run/Projects/Habait/habait-walkaround/Habait/platform/_local/dist-b/index.html';
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const failed = []; const assets = [];
    p.on('requestfailed', (r) => { if (/\.(css|woff2)$/.test(r.url())) failed.push(r.url()); });
    p.on('requestfinished', (r) => { if (/\.(css|woff2)$/.test(r.url())) assets.push(r.url().split('/').slice(-2).join('/')); });
    await p.goto(F, { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    const fonts = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')); });
    out.push([failed.length === 0, `css/font requests: ${assets.length} ok, ${failed.length} failed ${failed.join(' ')}`]);
    out.push([assets.some((a) => /tokens\.css/.test(a)) && assets.some((a) => /components\.css/.test(a)), 'tokens.css + components.css loaded']);
    out.push([fonts.length > 0, `font faces loaded: ${[...new Set(fonts)].join(', ') || 'none'}`]);
  } finally { await b.close(); }
  for (const [ok, m] of out) console.log(`${ok ? 'ok  ' : 'FAIL'} ${m}`);
  process.exit(out.every(([ok]) => ok) ? 0 : 1);
})();
