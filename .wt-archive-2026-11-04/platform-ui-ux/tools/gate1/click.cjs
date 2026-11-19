const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP buyer.test 127.0.0.1']});
for(const [n,o] of [['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{viewport:{width:1440,height:900}}]]){
const c=await b.newContext(o);const p=await c.newPage();
await p.route('http://127.0.0.1:8899/**',r=>r.fulfill({body:'hold stub',contentType:'text/html'}));
await p.goto('http://buyer.test:8852/',{waitUntil:'networkidle'});await p.waitForSelector('.home-card');
const href=await p.getAttribute('.home-card__link','href');
if(n==='desk') await p.click('.home-card__link'); else await p.tap('.home-card__link');
await p.waitForTimeout(1500);console.log(n,'href',href,'\n  landed',p.url());await c.close();}
await b.close()})();
