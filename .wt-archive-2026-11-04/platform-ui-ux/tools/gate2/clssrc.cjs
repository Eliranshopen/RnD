const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP buyer.test 127.0.0.1']});
for(const u of ['http://buyer.test:8852/landing.html?project=rainbow&v=b','http://buyer.test:8852/landing.html?project=rainbow&v=a','http://127.0.0.1:8853/#/p/apt846-rainbow-tlv']){
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.addInitScript(()=>{window.__l=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__l.push({v:e.value,t:Math.round(e.startTime),s:(e.sources||[]).map(s=>(s.node&&(s.node.id||s.node.className||s.node.nodeName))+':'+Math.round(s.previousRect.y)+'>'+Math.round(s.currentRect.y)+' h'+Math.round(s.previousRect.height)+'>'+Math.round(s.currentRect.height))})}).observe({type:'layout-shift',buffered:true})});
await p.goto(u);await p.waitForTimeout(3000);console.log(u.slice(-40),JSON.stringify(await p.evaluate(()=>window.__l)).slice(0,900));}
await b.close();})();
