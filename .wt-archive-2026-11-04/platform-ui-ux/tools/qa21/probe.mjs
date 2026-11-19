import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/Habait/tools/appdeps/');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const pages = ['/', '/landing.html?project=rainbow', '/apartment.html?project=rainbow&unit=846'];
const vps = [[1440,900],[390,844]];
const out=[];
for (const host of ['buyer.test','127.0.0.1']) {
 const b = await chromium.launch({ channel:'msedge', headless:true, args:['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
 for (const [w,h] of vps) for (const p of pages) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  const pg = await ctx.newPage();
  const errs=[], bad=[], reqs=[];
  pg.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
  pg.on('pageerror', e=>errs.push('PAGEERR '+e.message.slice(0,160)));
  pg.on('response', r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url().slice(0,120)); });
  pg.on('request', r=>reqs.push(r.url()));
  await pg.goto(`http://${host}:8852${p}`, { waitUntil:'networkidle', timeout:45000 }).catch(e=>errs.push('GOTO '+e.message.slice(0,100)));
  await pg.waitForTimeout(1500);
  const info = await pg.evaluate(async()=>{ await document.fonts.ready;
    const fonts=[...document.fonts].map(f=>f.family+':'+f.status);
    const dev=[...document.querySelectorAll('*')].filter(e=>/\bDEV\b/.test(e.textContent||'') && e.children.length===0).map(e=>e.className+'|'+e.textContent.trim().slice(0,30));
    return { theme:document.documentElement.dataset.theme, fonts, dev, heebo:document.fonts.check('16px Heebo'), ff:getComputedStyle(document.body).fontFamily.slice(0,50), sw:document.documentElement.scrollWidth, iw:innerWidth };});
  const g = reqs.filter(u=>/fonts\.(googleapis|gstatic)\.com/.test(u));
  out.push({host,w,p,errs,bad,google:g.length,...info,fonts:info.fonts.join(',')});
  await ctx.close();
 }
 await b.close();
}
for (const o of out) console.log(JSON.stringify(o));
