// card 04: extract fmtDuration/fmtCost from the working-copy app.js and assert the card's cases. usage: node c04_assert.cjs <app.js>
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const grab = (name) => { const m = src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}\\n`)); if (!m) throw new Error(`${name} not found`); return m[0]; };
const { fmtDuration, fmtCost } = new Function(`${grab('fmtDuration')}${grab('fmtCost')}return { fmtDuration, fmtCost };`)();
const cases = [
  ['fmtDuration(5.041666)', fmtDuration(5.041666), '0:05'],
  ['fmtDuration(65)', fmtDuration(65), '1:05'],
  ['fmtDuration(3725)', fmtDuration(3725), '1:02:05'],
  ['fmtDuration(null)', fmtDuration(null), '—'],
  ['fmtDuration(NaN)', fmtDuration(NaN), '—'],
  ['fmtDuration(59.6)', fmtDuration(59.6), '1:00'],
  ['fmtCost(0.1)', fmtCost(0.1), '$0.10'],
  ['fmtCost(12.345)', fmtCost(12.345), '$12.35'],
  ['fmtCost(0)', fmtCost(0), '$0.00'],
  ['fmtCost(1.005)', fmtCost(1.005), '$1.01'],
  ['fmtCost(null)', fmtCost(null), '—'],
];
let fail = 0;
for (const [label, got, want] of cases) { const ok = got === want; if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${got}${ok ? '' : `  (want ${want})`}`); }
console.log(`${cases.length - fail}/${cases.length} pass · rounding: half-up on the decimal value (n.toFixed(10) then e2 shift), so 12.345 -> $12.35 and 1.005 -> $1.01`);
process.exit(fail ? 1 : 0);
