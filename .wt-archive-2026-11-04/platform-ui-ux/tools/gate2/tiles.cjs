const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP buyer.test 127.0.0.1']});
const p=await (await b.newContext({viewport:{width:390,height:844},isMobile:true})).newPage();
await p.goto('http://buyer.test:8852/landing.html?project=rainbow&v=a');await p.waitForTimeout(2500);
await p.evaluate(()=>document.querySelector('#gallery').scrollIntoView());await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#gallery img')].map(i=>[i.complete,i.naturalWidth,i.loading]))));
console.log(await p.evaluate(()=>{const e=document.querySelector('.facts-price,.landing-facts dd:nth-of-type(5)');return [...document.querySelectorAll('.landing-facts dd')].map(d=>d.textContent+'|'+Math.round(d.getBoundingClientRect().width)).join(' ; ')}));
await p.screenshot({path:'C:/RnD/.wt/platform-ui-ux/after/gate2/after/phone_landing_gallery_scrolled.png'});await b.close();})();
