/* Habait Studio — the developer portal page (/studio). Login: Clerk (its browser script from the instance's own Frontend API),
   in Hebrew (@clerk/localizations heIL). Files go straight from the browser to the private Blob store; /api/studio-upload only
   issues the token. A PDF is also rendered HERE with pdf.js into an overview + overlapping ~250-dpi tiles (the idea of
   Habait/studio/tools/prep_pdf.py), uploaded beside it under files/.pages/<name>/, so the agent reads the small print off tiles.
   The build: job.json (contract in CLAUDE.md, habait-studio/job.v1) — this page queues it, shows its progress, and holds the
   developer's two fidelity approvals (the reading, the trace). No secret is in this file. */
import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/';
const CLERK_HE = 'https://cdn.jsdelivr.net/npm/@clerk/localizations@3.37.10/+esm';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = (id) => { for (const s of ['st-boot', 'st-signin', 'st-list', 'st-project']) $(s).hidden = s !== id; };
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const safeName = (n) => String(n).normalize('NFC').replace(/[^\p{L}\p{N}._ ()-]+/gu, '_').replace(/^\.+/, '').slice(0, 120) || 'file';

let clerk = null;
let current = null;   // { project, files, spec, chat, spent, steps, job, consent }
let poll = null;

async function token() { return clerk?.session ? clerk.session.getToken() : null; }
async function api(path, opts = {}) {
  const t = await token();
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...(opts.headers || {}) } });
  let j = null; try { j = await r.json(); } catch { /* empty */ }
  if (r.status === 401) { show('st-signin'); mountSignIn(); }
  return { status: r.status, ...(j || {}) };
}

function loadScript(src, attrs = {}) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v); s.onload = res; s.onerror = () => rej(new Error(`script ${src}`)); document.head.appendChild(s); });
}

function mountSignIn() {
  const el = $('st-clerk'); if (!clerk || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  clerk.mountSignIn(el, { fallbackRedirectUrl: '/studio/', signUpFallbackRedirectUrl: '/studio/' });
}

async function boot() {
  const cfg = await fetch('/api/studio-config').then((r) => r.json()).catch(() => null);
  const pk = cfg?.clerkPublishableKey;
  if (!pk) { $('st-boot').innerHTML = '<p class="st-muted">ההתחברות עוד לא מוגדרת בשרת.</p>'; return; }
  const fapi = atob(pk.split('_')[2] || '').replace(/\$$/, '');
  const [he] = await Promise.all([
    import(CLERK_HE).then((m) => m.heIL).catch(() => undefined),
    loadScript(`https://${fapi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, { 'data-clerk-publishable-key': pk }),
  ]);
  clerk = window.Clerk;
  await clerk.load({ localization: he });
  window.addEventListener('hashchange', route);   // always: a visitor who signs in on this page must still move between views
  clerk.addListener(({ user }) => { if (user && !$('st-signin').hidden) route(); });
  if (!clerk.user) { show('st-signin'); mountSignIn(); return; }
  route();
}

function route() {
  if (!clerk?.user) return;
  if (!$('st-user').childElementCount) clerk.mountUserButton($('st-user'));
  const m = /^#p=([A-Za-z0-9_-]{1,64})$/.exec(location.hash);
  if (m) openProject(m[1]); else listProjects();
}

async function listProjects() {
  stopPoll();
  show('st-list');
  const r = await api('/api/studio-projects');
  const ps = r.projects || [];
  $('st-empty').hidden = ps.length > 0;
  $('st-projects').innerHTML = ps.map((p) => {
    const done = Object.values(p.steps || {}).filter((s) => s.state === 'done').length;
    return `<li><a href="#p=${esc(p.id)}"><strong>${esc(p.name)}</strong><span class="st-muted">${new Date(p.created).toLocaleDateString('he-IL')} · ${done ? `${done} שלבים הושלמו` : 'חדש'}</span></a></li>`;
  }).join('');
}

$('st-new').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('st-new-name').value.trim(); if (!name) return;
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ name }) });
  if (r.ok) { $('st-new-name').value = ''; history.replaceState(null, '', `#p=${r.project.id}`); openProject(r.project.id); }
});
$('st-back').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; listProjects(); });

async function openProject(id, { quiet = false } = {}) {
  if (!quiet) show('st-project');
  const r = await api(`/api/studio-projects?id=${encodeURIComponent(id)}`);
  if (!r.ok) { if (!quiet) location.hash = ''; return; }
  current = r;
  render();
  const active = r.job && ['queued', 'running', 'review'].includes(r.job.state);
  if (active && !poll) poll = setInterval(() => { if (current && location.hash === `#p=${id}`) openProject(id, { quiet: true }); else stopPoll(); }, 5000);
  if (!active) stopPoll();
}
function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

/* ---------- the steps: the first three from the project, the rest from the build job ---------- */
// job.stage may be a portal stage or one of the runner's steps (tour360/PROJECT-PACKAGE.md, tools/run-project.mjs); each maps to a portal step
const PHASE = { queued: 'queued', trace: 'trace', trace_approval: 'trace', review: 'trace', trace_check: 'trace',
  platform: 'build', apartment: 'build', cameras: 'build', prompts: 'build', scenes: 'build', furnish: 'build', model: 'build', render: 'build', skin: 'build', sets: 'build', markers: 'build', dollhouse: 'build',
  fidelity: 'fidelity', consistency: 'fidelity',
  build: 'publish', package: 'publish', publish: 'publish', 'publish-local': 'publish', done: 'done' };
const PHASES = ['queued', 'trace', 'build', 'fidelity', 'publish', 'done'];
const STAGE_HE = { queued: 'בתור', trace: 'שרטוט הדירה מתכנית המכר', trace_check: 'בדיקה אוטומטית של השרטוט מול תכנית המכר', trace_approval: 'ממתין לאישור השרטוט', review: 'בבדיקה אצל Habait', platform: 'דף הפרויקט והדירות', apartment: 'נתוני הדירה',
  cameras: 'נקודות הצילום בחדרים', prompts: 'תיאור העיצוב', scenes: 'מפת החדרים והמעברים', furnish: 'ריהוט לפי התכנית', model: 'בניית מודל הדירה', render: 'צילום החדרים מהמודל',
  skin: 'עיצוב החדרים', sets: 'הכנת תמונות הסיור', markers: 'סימון הרהיטים להחלפה', dollhouse: 'מודל תלת-ממד', fidelity: 'בדיקת התאמה לתכנית המכר', consistency: 'בדיקת עקביות בין החדרים',
  build: 'בניית הסיור', package: 'הרכבת חבילת הפרויקט', publish: 'פרסום', 'publish-local': 'פרסום', done: 'מוכן' };
const jIdx = (stage) => PHASES.indexOf(PHASE[stage] || 'build');

const checkVerdict = (job) => String(job?.needs?.check?.verdict || job?.check?.verdict || '').toUpperCase();
const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : esc(v));
function checkTable(check) {
  const rows = Array.isArray(check?.rows) ? check.rows : [];
  if (!rows.length) return '';
  return `<table class="st-spec-table st-check"><thead><tr><th>מידה</th><th>בתכנית (ס"מ)</th><th>בשרטוט (ס"מ)</th><th>הפרש</th><th></th></tr></thead><tbody>${rows.map((r) => {
    const ok = r.ok === true || String(r.verdict || '').toUpperCase() === 'PASS';
    const d = r.delta_cm ?? (Number.isFinite(+r.printed_cm) && Number.isFinite(+r.traced_cm) ? Math.round((+r.traced_cm - +r.printed_cm) * 10) / 10 : null);
    return `<tr class="${ok ? 'ok' : 'bad'}"><td>${fmt(r.label || r.room || r.name)}</td><td>${fmt(r.printed_cm)}</td><td>${fmt(r.traced_cm)}</td><td>${fmt(d)}</td><td>${ok ? '✓' : '✗'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function stepState(id) {
  const st = current.project.steps || {};
  const job = current.job;
  if (id === 'upload') return current.files.length ? 'done' : 'next';
  if (id === 'read' || id === 'approve') {
    if (st[id]?.state) return st[id].state === 'running' ? 'running' : st[id].state;
    const first = ['read', 'approve'].find((s) => st[s]?.state !== 'done');
    return current.files.length && first === id ? 'next' : 'wait';
  }
  if (!job) return id === 'trace' && st.approve?.state === 'done' ? 'next' : 'wait';
  if (id === 'trace' && job.approvals?.trace) return 'done';
  if (id === 'trace' && (job.state === 'review' || checkVerdict(job) === 'FAIL')) return 'running';
  if (id === 'trace' && job.needs?.type === 'trace_approval') return 'next';
  if (job.state === 'done') return 'done';
  const k = jIdx(job.stage); const me = PHASES.indexOf(id);
  if (k > me) return 'done';
  if (k === me) return job.state === 'failed' ? 'next' : 'running';
  return 'wait';
}

function render() {
  const { project, files, spec, chat, spent } = current;
  $('st-pname').textContent = project.name;
  $('st-spent').textContent = `עלות AI בפרויקט: $${Number(spent || 0).toFixed(2)}`;
  $('st-steps').innerHTML = current.steps.map((s) => `<li class="${stepState(s.id)}">${esc(s.he)}</li>`).join('');
  $('st-files').innerHTML = files.map((f) => `<li class="${/\.pdf$/i.test(f.name) && !f.pages ? 'sub' : ''}"><span>${esc(f.name)}</span><span>${kb(f.bytes)}${/\.pdf$/i.test(f.name) ? (f.pages ? ' · עמודים מוכנים' : '') : ''}</span></li>`).join('');
  const hasReadable = files.some((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f.name));
  $('st-file').disabled = false;
  $('st-read').disabled = !hasReadable;
  $('st-read').textContent = spec ? 'קריאה מחדש של תכנית המכר' : 'הסוכן יקרא את תכנית המכר';
  $('st-read-note').textContent = hasReadable ? 'הקריאה לוקחת כדקה או שתיים.' : 'העלו את תכנית המכר (PDF) כדי להתחיל.';
  renderSpec(spec);
  renderBuild();
  renderTrace();
  renderChat(chat);
}

function renderSpec(spec) {
  $('st-spec-card').hidden = !spec;
  if (!spec) return;
  const u = spec.unit || {}; const b = spec.building || {}; const d = spec.drawing || {};
  const other = (u.other_areas || []).map((a) => `${a.label}: ${a.m2} מ"ר`).join(' · ');
  const facts = [['פרויקט', spec.project_name], ['יזם', spec.developer], ['עיר', spec.city], ['כתובת', spec.address], ['בניין', b.name], ['קומה', b.floor_of_unit],
    ['דירה', u.number], ['טיפוס', u.type_mark], ['חדרים', u.rooms_count], ['שטח', u.area_m2 && `${u.area_m2} מ"ר`], ['מרפסת', u.terrace_m2 && `${u.terrace_m2} מ"ר`], ['שטחים נוספים', other],
    ['קנה מידה', d.scale], ['אדריכל', d.architect], ['תאריך', d.date]].filter(([, v]) => v !== null && v !== undefined && v !== '');
  const roomRows = (rooms) => (rooms || []).map((r) => `<tr><td data-l="חדר">${esc(r.name_he)}</td><td data-l="מידות (ס&quot;מ)">${esc((r.printed_dims_cm || []).join(' × ') || '—')}</td><td data-l="מ&quot;ר">${r.area_m2 ?? '—'}</td><td data-l="פתחים">${esc([r.openings, r.glazing].filter(Boolean).join(' · ') || '—')}</td><td data-l="אלמנטים קבועים">${esc(r.fixed_elements || '—')}</td></tr>`).join('');
  const table = (rooms) => `<table class="st-spec-table"><thead><tr><th>חדר</th><th>מידות (ס"מ)</th><th>מ"ר</th><th>פתחים</th><th>אלמנטים קבועים</th></tr></thead><tbody>${roomRows(rooms)}</tbody></table>`;
  const units = (Array.isArray(spec.units) && spec.units.length ? spec.units : [{ ...u, rooms: spec.rooms }])
    .map((x, i) => (i === 0 && !(x.rooms || []).length ? { ...x, rooms: spec.rooms } : x));
  const unitBlock = (x, i) => {
    const head = [x.type_mark && `טיפוס ${x.type_mark}`, x.number && `דירה ${x.number}`, x.rooms_count && `${x.rooms_count} חדרים`, x.area_m2 && `${x.area_m2} מ"ר`, x.terrace_m2 && `מרפסת ${x.terrace_m2} מ"ר`, x.floors && `קומות ${x.floors}`, x.plan_page && `עמוד ${x.plan_page}`].filter(Boolean).join(' · ');
    return `<h3 class="st-unit">${esc(head || `דירה ${i + 1}`)}</h3>${(x.other_areas || []).length ? `<p class="st-muted st-small">${esc((x.other_areas || []).map((a) => `${a.label}: ${a.m2} מ"ר`).join(' · '))}</p>` : ''}${table(x.rooms)}`;
  };
  $('st-spec').innerHTML = `<div class="st-facts">${facts.filter(([k]) => units.length === 1 || !['דירה', 'טיפוס', 'חדרים', 'שטח', 'מרפסת', 'שטחים נוספים'].includes(k)).map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join('')}</div>
    ${units.length > 1 ? `<p class="st-small"><b>${units.length} טיפוסי דירות נקראו</b></p>` : ''}${units.map(unitBlock).join('')}`;
  const un = spec.uncertainties || [];
  $('st-uncert').innerHTML = un.length ? `<b>לבדיקה שלכם (${un.length}):</b><ul>${un.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const approved = current.project.steps?.approve?.state === 'done';
  $('st-approve').disabled = approved;
  $('st-approve').textContent = approved ? 'הנתונים אושרו ✓' : 'הנתונים תואמים לתכנית המכר: אישור';
}

function renderBuild() {
  const approved = current.project.steps?.approve?.state === 'done';
  const job = current.job;
  $('st-build-card').hidden = !approved && !job;
  if ($('st-build-card').hidden) return;
  $('st-consent-text').textContent = current.consent?.he || '';
  const active = job && ['queued', 'running', 'waiting', 'review'].includes(job.state);
  $('st-build-start').hidden = Boolean(active || job?.state === 'done');
  $('st-build').disabled = !$('st-consent').checked;
  $('st-build').textContent = job?.state === 'failed' ? 'נסו לבנות שוב' : 'בנו את ההדמיה';
  $('st-job').hidden = !job;
  if (!job) return;
  const stage = job.state === 'done' ? 'done' : job.state === 'review' ? 'review' : job.needs?.type === 'trace_approval' ? (checkVerdict(job) === 'PASS' ? 'trace_approval' : 'review') : job.stage;
  $('st-job-stage').textContent = job.state === 'failed' ? `נעצר: ${STAGE_HE[stage] || stage}` : (STAGE_HE[stage] || stage);
  const pct = Math.max(0, Math.min(100, Math.round(Number(job.percent) || (job.state === 'done' ? 100 : 0))));
  $('st-job-pct').textContent = `${pct}%`;
  $('st-job-bar').style.width = `${pct}%`;
  $('st-job-log').innerHTML = (job.log || []).slice(-8).reverse().map((l) => `<li dir="auto">${esc(new Date(l.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))} · ${esc(l.line)}</li>`).join('');
  const res = job.result || {};
  const links = [
    res.page ? { label: 'דף הפרויקט', href: res.page } : null,
    res.tour ? { label: 'סיור 360° בדירה', href: res.tour } : null,
    ...(job.links || []),
  ].filter(Boolean).filter((l) => /^(\/|https:\/\/)/.test(l.href));
  $('st-job-results').innerHTML = links.map((l, i) => `<a class="hb-btn ${i === 0 ? 'hb-btn--primary' : 'hb-btn--secondary'}" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  const fid = job.result?.fidelity || job.fidelity || null;
  const rooms = Array.isArray(fid?.rooms) ? fid.rooms : [];
  $('st-job-fid').innerHTML = rooms.length ? `<p class="st-small"><b>בדיקת התאמה לתכנית המכר, לפי חדר${fid.verdict ? `: ${esc(fid.verdict)}` : ''}</b></p><table class="st-spec-table st-check"><thead><tr><th>חדר</th><th>תוצאה</th><th>הערה</th></tr></thead><tbody>${rooms.map((r) => {
    const v = String(r.verdict || r.result || '').toUpperCase(); const ok = v === 'PASS' || r.ok === true;
    return `<tr class="${ok ? 'ok' : 'bad'}"><td>${fmt(r.room || r.name || r.scene)}</td><td>${ok ? '✓ תואם' : v === 'PENDING' ? '…' : '✗ לא תואם'}</td><td>${fmt(r.note)}</td></tr>`;
  }).join('')}</tbody></table>` : '';
  $('st-job-err').hidden = !job.error;
  $('st-job-err').textContent = job.error || '';
}

let traceShown = '';
async function renderTrace() {
  const job = current.job;
  const review = Boolean(job && (job.state === 'review' || (job.needs?.type === 'trace_approval' && checkVerdict(job) !== 'PASS')));
  const need = job?.needs?.type === 'trace_approval' && checkVerdict(job) === 'PASS' ? job.needs : null;
  $('st-trace-card').hidden = !need && !review;
  $('st-trace-review').hidden = !review;
  for (const id of ['st-trace-lead', 'st-trace-img', 'st-trace-note', 'st-trace-ok', 'st-trace-fix']) $(id).hidden = !need;
  const check = job?.needs?.check || job?.check || null;
  $('st-trace-check').innerHTML = need && check ? `<p class="st-small"><b>הבדיקה האוטומטית: ${esc(check.summary || 'כל המידות תואמות לתכנית המכר')}</b></p>${checkTable(check)}` : '';
  if (!need) { traceShown = ''; return; }
  $('st-trace-note').textContent = need.note || '';
  const key = `${current.project.id}:${need.overlay}:${current.job.updated}`;
  if (traceShown === key) return;
  traceShown = key;
  $('st-trace-img').innerHTML = '<p class="st-muted st-small" style="padding:12px">טוען את השרטוט…</p>';
  try {
    const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(need.overlay)}`, { headers: { authorization: `Bearer ${await token()}` } });
    if (!r.ok) throw new Error(String(r.status));
    const url = URL.createObjectURL(await r.blob());
    $('st-trace-img').innerHTML = `<img alt="שרטוט הדירה מונח על תכנית המכר" src="${url}">`;
  } catch { $('st-trace-img').innerHTML = '<p class="st-muted st-small" style="padding:12px">לא הצלחתי לטעון את השרטוט.</p>'; }
}

$('st-consent').addEventListener('change', () => { $('st-build').disabled = !$('st-consent').checked; });
$('st-build').addEventListener('click', async () => {
  $('st-build').disabled = true;
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, build: true, consent: $('st-consent').checked }) });
  if (!r.ok) { note(r.message || 'לא הצלחתי להתחיל את הבנייה'); $('st-build').disabled = false; return; }
  openProject(current.project.id);
});
$('st-trace-ok').addEventListener('click', async () => {
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, approveTrace: true }) });
  if (!r.ok) { note(r.message || 'האישור נכשל'); return; }
  openProject(current.project.id);
});
$('st-trace-fix').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('st-trace-text').value.trim(); if (!text) return;
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, traceCorrection: text }) });
  if (!r.ok) { note(r.message || 'שליחת התיקון נכשלה'); return; }
  $('st-trace-text').value = '';
  openProject(current.project.id);
});

function renderChat(chat) {
  const msgs = chat.length ? chat : [{ role: 'note', content: 'שלום. העלו את תכנית המכר ואני אקרא אותה, אציג לכם את מה שקראתי לאישור, ואלווה אתכם עד הפרסום.' }];
  $('st-msgs').innerHTML = msgs.map((m) => `<div class="st-msg ${m.role === 'user' ? 'user' : m.role === 'note' ? 'note' : 'assistant'}" dir="auto">${esc(m.content)}</div>`).join('');
  $('st-msgs').scrollTop = $('st-msgs').scrollHeight;
}
function note(text) { const d = document.createElement('div'); d.className = 'st-msg note'; d.textContent = text; $('st-msgs').appendChild(d); $('st-msgs').scrollTop = $('st-msgs').scrollHeight; return d; }

/* ---------- uploads (+ the PDF page renders) ---------- */
async function put(pathRel, body, onProgress) {
  return upload(`studio/u/${clerk.user.id}/p/${current.project.id}/files/${pathRel}`, body, {
    access: 'private', handleUploadUrl: '/api/studio-upload', clientPayload: current.project.id, multipart: body.size > 20 * 1048576,
    headers: { authorization: `Bearer ${await token()}` }, onUploadProgress: onProgress,
  });
}

let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${PDFJS}pdf.min.mjs`);
  try {   // a module worker must be same-origin: a blob: wrapper imports the CDN worker (CORS); else pdf.js falls back to the main thread
    const w = URL.createObjectURL(new Blob([`import "${PDFJS}pdf.worker.min.mjs";`], { type: 'text/javascript' }));
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(w, { type: 'module' });
  } catch { pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; }
  return pdfjs;
}
async function renderClip(page, scale, x, y, w, h) {
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
  await page.render({ canvas: c, viewport: vp, transform: [1, 0, 0, 1, -x * scale, -y * scale], background: '#ffffff' }).promise;
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  c.width = 1; c.height = 1;
  return blob;
}
/* files/.pages/<name>/index.json = { pages: N, images: [{ file, kind:'overview'|'tile', page, row, col, dpi, region, side }] }.
   Overviews for every page (≤ 16, long side ≤ 1600 px) are made at upload; tiles (≤ 2000 px, ~250 dpi, ≤ 20 per page) only for the
   pages the survey marks as plans, at read time. The PDF bytes stay in memory for the session; otherwise they are fetched back. */
const pdfCache = new Map();
async function openPdf(blob) {
  const lib = await pdfLib();
  return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
}
async function makeOverviews(doc, name, status) {
  const n = Math.min(doc.numPages, 16);
  const index = { pages: doc.numPages, images: [] };
  for (let pno = 1; pno <= n; pno++) {
    const page = await doc.getPage(pno);
    const { width: W, height: H } = page.getViewport({ scale: 1 });
    const os = Math.min(150 / 72, 1600 / Math.max(W, H));
    status(`עמוד ${pno} מתוך ${n}`);
    await put(`.pages/${name}/page-${pno}.jpg`, await renderClip(page, os, 0, 0, W, H));
    index.images.push({ file: `page-${pno}.jpg`, kind: 'overview', page: pno, dpi: Math.round(os * 72) });
  }
  await put(`.pages/${name}/index.json`, new Blob([JSON.stringify(index)], { type: 'application/json' }));
  return index;
}
async function makeTiles(doc, name, index, pageNos, status) {
  const MAX = 2000;
  const have = new Set(index.images.filter((im) => im.kind === 'tile').map((im) => im.page));
  for (const pno of pageNos.filter((x) => !have.has(x) && x >= 1 && x <= doc.numPages)) {
    const page = await doc.getPage(pno);
    const { width: W, height: H } = page.getViewport({ scale: 1 });
    let dpi = 250; let cols; let rows;
    const fit = () => { const core = MAX / (dpi / 72) / 1.2; cols = Math.max(1, Math.ceil(W / core)); rows = Math.max(1, Math.ceil(H / core)); };
    fit(); while (cols * rows > 20 && dpi > 120) { dpi -= 25; fit(); }
    const tw = W / cols; const th = H / rows; const ox = tw * 0.1; const oy = th * 0.1;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x0 = Math.max(0, j * tw - ox); const y0 = Math.max(0, i * th - oy);
        const x1 = Math.min(W, (j + 1) * tw + ox); const y1 = Math.min(H, (i + 1) * th + oy);
        let sc = dpi / 72; const side = Math.max(x1 - x0, y1 - y0) * sc; if (side > MAX) sc *= MAX / side;
        status(`עמוד ${pno}: חלק ${i * cols + j + 1} מתוך ${rows * cols}`);
        const file = `page-${pno}-r${i + 1}c${j + 1}.jpg`;
        await put(`.pages/${name}/${file}`, await renderClip(page, sc, x0, y0, x1 - x0, y1 - y0));
        index.images.push({ file, kind: 'tile', page: pno, row: i + 1, col: j + 1, dpi: Math.round(sc * 72),
          region: i === 0 ? 'top' : i === rows - 1 ? 'bottom' : 'middle', side: j === 0 ? 'left' : j === cols - 1 ? 'right' : 'centre' });
      }
    }
  }
  await put(`.pages/${name}/index.json`, new Blob([JSON.stringify(index)], { type: 'application/json' }));
  return index;
}
async function pdfBytes(name) {
  if (pdfCache.has(name)) return pdfCache.get(name);
  const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(`files/${name}`)}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new Error(`file ${r.status}`);
  const b = await r.blob(); pdfCache.set(name, b); return b;
}
async function pdfIndex(name) {
  const r = await fetch(`/api/studio-file?id=${encodeURIComponent(current.project.id)}&path=${encodeURIComponent(`files/.pages/${name}/index.json`)}`, { headers: { authorization: `Bearer ${await token()}` } });
  if (!r.ok) return null;
  const j = await r.json(); return Array.isArray(j) ? { pages: 1, images: j } : j;
}

async function uploadFiles(list) {
  if (!current) return;
  const pid = current.project.id;
  for (const file of list) {
    const name = safeName(file.name);
    const li = document.createElement('li'); li.className = 'up'; li.innerHTML = `<span>${esc(name)}</span><span>0%</span>`; $('st-files').appendChild(li);
    try {
      await put(name, file, (e) => { li.lastElementChild.textContent = `${Math.round(e.percentage)}%`; });
      li.lastElementChild.textContent = '✓';
      if (/\.pdf$/i.test(name)) {
        pdfCache.set(name, file);
        const idx = await makeOverviews(await openPdf(file), name, (t) => { li.lastElementChild.textContent = t; });
        li.lastElementChild.textContent = `✓ · ${idx.images.length} עמודים`;
      }
    } catch (e) {
      li.lastElementChild.textContent = 'נכשל'; console.warn('upload', e);
    }
  }
  openProject(pid);
}
$('st-file').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });
const drop = $('st-drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); uploadFiles([...e.dataTransfer.files]); });

/** The read: overviews of every PDF page (made at upload, or now) → for a multi-page file the agent sorts the pages → tiles of the
    plan pages only → the reading. Each paid step is one call; the page shows which step runs. */
const READ_KINDS = new Set(['unit_plan', 'floor_plan', 'site_plan', 'price_list']);
async function prepareRead(status) {
  const pdfs = current.files.filter((x) => /\.pdf$/i.test(x.name));
  const docs = new Map();
  for (const f of pdfs) {
    let idx = f.pages ? await pdfIndex(f.name) : null;
    if (!idx) { status(`מכין את עמודי ${f.name}…`); const doc = await openPdf(await pdfBytes(f.name)); docs.set(f.name, doc); idx = await makeOverviews(doc, f.name, (t) => status(`עמודי ${f.name}: ${t}`)); }
    f.index = idx;
  }
  const multi = pdfs.some((f) => (f.index?.pages || 1) > 1);
  let survey = null;
  if (multi) {
    status('הסוכן ממיין את העמודים: תכניות, הדמיות, טקסט…');
    const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'survey' }) });
    if (!r.ok) throw new Error(r.message || 'survey');
    survey = r.survey;
  }
  for (const f of pdfs) {
    const want = survey ? survey.pages.filter((p) => p.file === f.name && READ_KINDS.has(p.kind)).map((p) => p.page) : [1];
    if (!want.length) continue;
    const doc = docs.get(f.name) || await openPdf(await pdfBytes(f.name));
    await makeTiles(doc, f.name, f.index, want.slice(0, 8), (t) => status(`חיתוכים לקריאה מדויקת · ${f.name}: ${t}`));
  }
  return survey;
}

$('st-read').addEventListener('click', async () => {
  const btn = $('st-read'); btn.disabled = true;
  const n = note('מכין את תכנית המכר לקריאה…');
  try { await prepareRead((t) => { n.textContent = t; }); } catch (e) { console.warn('prepare', e); n.remove(); note(`ההכנה נכשלה: ${e.message || e}`); btn.disabled = false; return; }
  n.textContent = 'הסוכן קורא את תכנית המכר…';
  const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'read' }) });
  n.remove();
  if (!r.ok) { note(r.message || 'הקריאה נכשלה'); btn.disabled = false; return; }
  openProject(current.project.id);
});
$('st-approve').addEventListener('click', async () => {
  const r = await api('/api/studio-projects', { method: 'POST', body: JSON.stringify({ id: current.project.id, approveSpec: true }) });
  if (r.ok) openProject(current.project.id);
});
$('st-ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('st-q').value.trim(); if (!q || !current) return;
  $('st-q').value = '';
  const u = document.createElement('div'); u.className = 'st-msg user'; u.dir = 'auto'; u.textContent = q; $('st-msgs').appendChild(u);
  const n = note('הסוכן חושב…');
  const r = await api('/api/studio-agent', { method: 'POST', body: JSON.stringify({ id: current.project.id, op: 'chat', message: q }) });
  n.remove();
  if (!r.ok) { note(r.message || 'הסוכן לא ענה'); return; }
  current.chat = r.chat; current.spent = r.spent; renderChat(r.chat);
  $('st-spent').textContent = `עלות AI בפרויקט: $${Number(r.spent || 0).toFixed(2)}`;
});

boot().catch((e) => { console.error(e); $('st-boot').innerHTML = '<p class="st-muted">הטעינה נכשלה. רעננו את הדף.</p>'; });
