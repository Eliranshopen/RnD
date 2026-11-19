const [A, B] = process.argv.slice(2);
const a = require(A), b = require(B);
for (const k of Object.keys(a)) {
  const ba = a[k].boxes, bb = b[k].boxes; const rows = [];
  let maxd = 0; let beyond = 0; const only = [];
  for (const n of Object.keys(ba)) {
    if (!bb[n]) { only.push('missing-after:' + n); continue; }
    const d = Math.max(...ba[n].map((v, i) => Math.abs(v - bb[n][i]))); maxd = Math.max(maxd, d);
    if (d > 2) { beyond++; rows.push(`${n} ${JSON.stringify(ba[n])} -> ${JSON.stringify(bb[n])}`); }
  }
  for (const n of Object.keys(bb)) if (!ba[n]) only.push('new-after:' + n);
  console.log(`${k}: ${Object.keys(ba).length} landmarks before / ${Object.keys(bb).length} after, max delta ${maxd}px, beyond +-2px: ${beyond}, errors ${a[k].errors.length}/${b[k].errors.length}`);
  rows.slice(0, 14).forEach((r) => console.log('   ' + r));
  if (only.length) console.log('   ' + only.slice(0, 8).join(' | '));
}
