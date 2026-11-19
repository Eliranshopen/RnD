const { chromium } = require('C:/RnD/Projects/Habait/tools/appdeps/node_modules/playwright-core');
const lum=(c)=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage();await p.goto('http://127.0.0.1:8852/styleguide.html');
const pairs=[['--text','--surface',4.5],['--text-muted','--surface',4.5],['--text-muted','--surface-raised',4.5],['--line-strong','--surface',3],['--focus','--surface',3],['--status-sold-ink','--status-sold-bg',4.5],['--status-reserved-ink','--status-reserved-bg',4.5],['--status-available-ink','--status-available-bg',4.5],['--brand-on-primary','--brand-primary',4.5]];
for(const th of ['light','dark']){const vals=await p.evaluate(({th,names})=>{const d=document.createElement('div');d.dataset.theme=th;document.body.appendChild(d);const out={};for(const n of names){const t=document.createElement('i');t.style.color=`var(${n})`;d.appendChild(t);const m=getComputedStyle(t).color.match(/[\d.]+/g).map(Number);out[n]=m.slice(0,3)}return out},{th,names:[...new Set(pairs.flat().filter(x=>typeof x==='string'))]});
for(const [f,g,min] of pairs){const r=cr(vals[f],vals[g]);console.log(th,f,JSON.stringify(vals[f]),'on',g,JSON.stringify(vals[g]),r.toFixed(2),r>=min?'ok':'BELOW '+min)}}
await b.close()})();
