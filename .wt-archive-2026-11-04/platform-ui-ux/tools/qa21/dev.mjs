import { createRequire } from 'module';
const require = createRequire('C:/RnD/Projects/Habait/tools/appdeps/');
const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const b = await chromium.launch({ channel:'msedge', headless:true, args:['--host-resolver-rules=MAP buyer.test 127.0.0.1'] });
for (const host of ['buyer.test','127.0.0.1']) for (const p of ['/','/landing.html?project=rainbow','/apartment.html?project=rainbow&unit=846']) {
 const pg = await b.newPage({viewport:{width:1440,height:900}});
 await pg.goto(`http://${host}:8852${p}`,{waitUntil:'networkidle'}); await pg.waitForTimeout(1200);
 const r = await pg.evaluate(()=>{const t=document.body.innerText; const els=[...document.querySelectorAll('[class*=dev],[data-dev],[id*=dev],.hb-dev')].filter(e=>e.offsetParent&&getComputedStyle(e).display!=='none').map(e=>e.className||e.id);
  return {txtDEV:/\bDEV\b|\bdev\b|פיתוח|דמו/i.test(t), m:(t.match(/.{0,20}\b(DEV|dev)\b.{0,20}/g)||[]).slice(0,3), els}});
 console.log(host,p,JSON.stringify(r)); await pg.close();
}
await b.close();
