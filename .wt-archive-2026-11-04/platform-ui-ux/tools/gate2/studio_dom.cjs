// phase 4: Studio structure facts for audit items 1-16 (fixture API on :8853, read-only; no POST honoured)
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [name, hash, empty] of [['projects', '#/', false], ['new', '#/new', false], ['project', '#/p/apt846-rainbow-tlv', false]]) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto('http://127.0.0.1:8853/' + hash); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); };
      const q = (s) => [...document.querySelectorAll(s)].filter(vis);
      return {
        primaryVisible: q('.hb-btn--primary').map((e) => e.textContent.trim().slice(0, 24)),
        steps: q('#timeline > li, .hb-steps > li').map((e) => (e.className.match(/hb-step--\w+|is-\w+/g) || []).join(' ') + ' | ' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 70)),
        stepnav: q('.stepnav a').map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 26)),
        advOpen: document.querySelector('#adv') ? document.querySelector('#adv').open : null,
        advChildren: document.querySelector('#adv') ? document.querySelector('#adv').querySelectorAll('select,input,button,textarea').length : 0,
        drop: !!document.querySelector('#drop') && vis(document.querySelector('#drop')), fileBtn: q('#drop button, #btn-pick, [for=file-input]').length, dropTypes: (document.querySelector('#drop-types') || {}).textContent,
        files: q('#file-list > li').slice(0, 2).map((li) => ({ text: li.textContent.replace(/\s+/g, ' ').trim().slice(0, 90), chip: !!li.querySelector('select,.hb-chip'), remove: !!li.querySelector('[data-remove],[data-cancel]'), progress: !!li.querySelector('[role=progressbar]') })),
        review: { rows: q('.review__row').length, flagged: q('.review__row.is-flagged').length, bulk: q('#review button').map((e) => e.textContent.trim().slice(0, 24)), crops: q('#review img, .review__crop').length },
        results: q('#results > *').map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)).slice(0, 4),
        create: (document.querySelector('#btn-create') || {}).textContent, createCost: (document.querySelector('#create-cost') || {}).textContent, hint: (document.querySelector('#create-hint') || {}).textContent,
        cancelBtn: q('button').filter((e) => /ביטול|עצור|cancel/i.test(e.textContent)).length,
        pctInText: /\d\s?%/.test(document.querySelector('main').innerText),
        emptyBlock: document.querySelector('#projects-empty') ? document.querySelector('#projects-empty').textContent.replace(/\s+/g, ' ').trim().slice(0, 140) + ' | button: ' + !!document.querySelector('#projects-empty a,#projects-empty button') : null,
        liveRegions: document.querySelectorAll('[aria-live],[role=status],[role=alert]').length,
      };
    });
    console.log('ST', name, JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
