const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP buyer.test 127.0.0.1']});
for(const lang of ['','&lang=en'])for(const w of [320,360]){const p=await (await b.newContext({viewport:{width:w,height:640},isMobile:true})).newPage();
await p.goto('http://buyer.test:8852/landing.html?project=rainbow&v=a'+lang);await p.waitForTimeout(2500);
console.log(w,lang||'he',JSON.stringify(await p.evaluate(()=>{const g=document.querySelector('.landing-facts').getBoundingClientRect();const cells=[...document.querySelectorAll('.landing-fact')].map(c=>c.getBoundingClientRect());const dd=[...document.querySelectorAll('.landing-fact dd')].map(d=>{const r=document.createRange();r.selectNodeContents(d);const q=r.getBoundingClientRect();return [Math.round(q.left),Math.round(q.right)]});
return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,grid:[Math.round(g.left),Math.round(g.right)],ddOutsideGrid:dd.filter(x=>x[0]<g.left-0.5||x[1]>g.right+0.5).length,ddOutsideCell:dd.filter((x,i)=>x[0]<cells[i].left-0.5||x[1]>cells[i].right+0.5).length}})));}
await b.close();})();
