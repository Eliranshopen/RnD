# card 04: route every Studio duration/cost render site through fmtDuration/fmtCost, numbers in <bdi>. One-shot, refuses if any anchor is not unique.
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def r(old, new):
    global s
    assert s.count(old) == 1, (old[:70], s.count(old))
    s = s.replace(old, new)


r("""function parseLatLon(s) {""", """// platform-ui-ux card 04: every duration and cost shown goes through these two; a number inside Hebrew sits in <bdi dir="ltr">.
// fmtDuration: m:ss, h:mm:ss from one hour up, '—' for null/NaN/negative; whole seconds, rounded half-up.
function fmtDuration(sec) {
  const n = Number(sec);
  if (sec == null || sec === '' || !Number.isFinite(n) || n < 0) return '—';
  const t = Math.round(n), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// fmtCost: $0.00, rounded half-up on the decimal value (12.345 → $12.35, not the binary-float $12.34); '—' for null/NaN.
function fmtCost(usd) {
  const n = Number(usd);
  if (usd == null || usd === '' || !Number.isFinite(n)) return '—';
  return `$${(Math.round(Number(`${n.toFixed(10)}e2`)) / 100).toFixed(2)}`;
}
const bdi = (s) => `<bdi dir="ltr">${esc(s)}</bdi>`;
const costHtml = (usd) => bdi(fmtCost(usd));
const durHtml = (sec) => bdi(fmtDuration(sec));
function parseLatLon(s) {""")
r("""    ['קריאת מסמכים', e.llm === 'ready' ? (e.llm_backend === 'cli' ? 'מוכן · המנוי שלך ב-Claude' : 'מוכן · API') : e.llm === 'mock' ? 'מצב דמו' : 'אין LLM', e.llm === 'ready' ? 'ok' : 'warn'],""",
  """    ['קריאת מסמכים', esc(e.llm === 'ready' ? (e.llm_backend === 'cli' ? 'מוכן · המנוי שלך ב-Claude' : 'מוכן · API') : e.llm === 'mock' ? 'מצב דמו' : 'אין LLM'), e.llm === 'ready' ? 'ok' : 'warn'],""")
r("""`מוכן · תקרה $${e.cap_usd}`""", """`מוכן · תקרה ${costHtml(e.cap_usd)}`""")
r("""<span class="chip ${c}"><b>${k}</b> ${esc(v)}</span>""", """<span class="chip ${c}"><b>${k}</b> ${v}</span>""")
r("""p.running ? ' · בעבודה…' : pct ? ` · ${pct}%` : ''}""", """p.running ? ' · בעבודה…' : pct ? ` · <bdi>${pct}%</bdi>` : ''}""")
r("""  $('#p-ledger').textContent = `הוצאה עד כה: $${(d.ledger_usd || 0).toFixed(2)}`;""", """  $('#p-ledger').innerHTML = `הוצאה עד כה: ${costHtml(d.ledger_usd || 0)}`;""")
r("""<span>${(f.bytes / 1024).toFixed(0)} KB <span""", """<span>${bdi(`${(f.bytes / 1024).toFixed(0)} KB`)} <span""")
r("""  $('#create-hint').textContent = !d.files.length""", """  $('#create-hint').innerHTML = !d.files.length""")
r("""`הערכת עלות למודלים: כ-$${est.toFixed(0)} (${variants} גרסאות × ${n} סצנות)${""", """`הערכת עלות למודלים: כ-${costHtml(est)} (<bdi>${variants}</bdi> גרסאות × <bdi>${n}</bdi> סצנות)${""")
r("""${s.seconds ? `<span class="tag"> ${s.seconds}s</span>` : ''}""", """${s.seconds ? `<span class="tag"> ${durHtml(s.seconds)}</span>` : ''}""")
r("""`${it._meta.model} · $${(it._meta.usd || 0).toFixed(2)}`""", """{ html: `${esc(it._meta.model)} · ${costHtml(it._meta.usd || 0)}` }""")
r("""<tr><td>${k}</td><td>${esc(v)}</td></tr>""", """<tr><td>${k}</td><td>${v && typeof v === 'object' ? v.html : esc(v)}</td></tr>""")
r("""<span class="tag">${v.photoreal}/${v.clips.length} סצנות""", """<span class="tag"><bdi>${v.photoreal}/${v.clips.length}</bdi> סצנות""")
r("""'draft'} · ${c.duration_s}s</span>""", """'draft'} · ${durHtml(c.duration_s)}</span>""")
open(p, "w", encoding="utf-8", newline="").write(s)
print("patched")
