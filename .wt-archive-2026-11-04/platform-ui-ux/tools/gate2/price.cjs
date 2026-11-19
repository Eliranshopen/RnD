const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP buyer.test 127.0.0.1']});
for(const [w,h,m] of [[390,844,true],[360,640,true],[320,568,true],[1440,900,false]]){
const p=await (await b.newContext({viewport:{width:w,height:h},isMobile:m})).newPage();
await p.goto('http://buyer.test:8852/landing.html?project=rainbow&v=a');await p.waitForTimeout(2500);
console.log(w,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('.landing-facts dd')].map(d=>{const r=document.createRange();r.selectNodeContents(d);const ys=new Set([...r.getClientRects()].map(x=>Math.round(x.top)));return d.textContent.trim()+': lines '+ys.size+' dd '+Math.round(d.getBoundingClientRect().width)+' overflow '+(d.scrollWidth>d.clientWidth)}))));}
await b.close();})();
