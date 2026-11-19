// plan studio-agent-fal, step 7: the paid live check on the working-copy server (:8853). Creates a throwaway project, uploads a copy
// of apt846's sales plan, runs ONLY the intake stage (fal LLM), then asks the agent two questions. Prints every cost. ≤ $1 budget.
// usage: node live_check.mjs <out-json>
import fs from 'node:fs';
const OUT = process.argv[2];
const B = 'http://127.0.0.1:8853';
const PDF = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/intake/דירה 846- 16.pdf';
const j = async (p, o = {}) => { const r = await fetch(B + p, { ...o, headers: o.body && !(o.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {} }); const t = await r.text(); let x; try { x = JSON.parse(t); } catch { x = t; } return { status: r.status, body: x }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { steps: [] };
const log = (k, v) => { report.steps.push([k, v]); console.log(k, typeof v === 'string' ? v : JSON.stringify(v).slice(0, 400)); };

const p = await j('/api/projects', { method: 'POST', body: JSON.stringify({ name: `fal-check-${Date.now().toString(36)}`, address: 'שדה דב, תל אביב', notes: 'בדיקת קריאה דרך fal (plan studio-agent-fal); פרויקט זמני' }) });
log('create', { status: p.status, id: p.body.id });
const id = p.body.id;
const fd = new FormData(); fd.append('files', new Blob([fs.readFileSync(PDF)], { type: 'application/pdf' }), 'דירה 846- 16.pdf');
log('upload', (await j(`/api/projects/${id}/files`, { method: 'POST', body: fd })).body.saved);
log('run intake', (await j(`/api/projects/${id}/run`, { method: 'POST', body: JSON.stringify({ stages: ['intake'] }) })).body);
const t0 = Date.now(); let st;
for (;;) {
  await sleep(4000);
  const d = (await j(`/api/projects/${id}`)).body;
  st = d.state?.stages?.intake;
  if (!d.running && st && st.status !== 'running') { report.intake = { status: st.status, note: st.note, seconds: st.seconds, ledger_usd: d.ledger_usd, ledger: d.ledger, uncertainties: d.intake?.uncertainties?.length, confidence: d.intake?.confidence, rooms: d.intake?.rooms?.length, unit: d.intake?.unit }; break; }
  if (Date.now() - t0 > 8 * 60 * 1000) { report.intake = { status: 'TIMEOUT' }; break; }
}
log('intake', report.intake);
for (const q of ['כמה חדרים יש בדירה ומה השטח שלה?', 'מה המערכת לא הייתה בטוחה לגביו בתכנית?']) {
  const r = await j(`/api/projects/${id}/chat`, { method: 'POST', body: JSON.stringify({ message: q }) });
  log('chat', { q, status: r.status, usd: r.body.usd, model: r.body.model, reply: r.body.reply || r.body.error });
}
const fin = (await j(`/api/projects/${id}`)).body;
report.project = id; report.ledger_usd = fin.ledger_usd; report.ledger = fin.ledger;
log('total spent', fin.ledger_usd);
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
