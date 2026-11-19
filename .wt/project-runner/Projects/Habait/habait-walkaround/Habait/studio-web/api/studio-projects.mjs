/* /api/studio-projects — one developer's projects (signed in, own prefix only).
   GET                                → { projects: [{ id, name, created, steps }] }
   GET  ?id=<pid>                     → { project, files, spec, chat, spent, steps, job }
   POST { name }                      → creates a project → { project }
   POST { id, approveSpec: true }     → the developer confirms what the agent read (the sales-plan fidelity gate, step 1)
   POST { id, build: true, consent }  → queues the build job (job.json + studio/queue/<job>.json; contract in ../CLAUDE.md)
   POST { id, approveTrace: true }    → the developer confirms the auto-trace against the sales plan (fidelity gate, step 2)
   POST { id, traceCorrection: text } → sends the trace back with the developer's correction */
import crypto from 'node:crypto';
import { json, userId, udir, pdir, isPid, readJson, writeJson, listAll, files, spent, jobPath, enqueue, logLine } from './_studio.mjs';

export const STEPS = [
  { id: 'upload', he: 'העלאת קבצים' },
  { id: 'read', he: 'קריאת תכנית המכר' },
  { id: 'approve', he: 'אישור הנתונים מול תכנית המכר' },
  { id: 'trace', he: 'שרטוט הדירה ואישורו' },
  { id: 'build', he: 'בניית ההדמיה' },
  { id: 'fidelity', he: 'בדיקת התאמה לתכנית המכר' },
  { id: 'publish', he: 'פרסום בקישור' },
];

// DRAFT for Eliran's wording (root §6: legal and disclosure wording is his call) — the version id travels in job.json
export const CONSENT = {
  version: 'draft-2026-11-04',
  he: 'אני מאשר/ת שיש לי את הזכויות בקבצים שהעליתי, ושמותר ל-Habait להשתמש בהם כדי לבנות הדמיה של הפרויקט. ידוע לי שהתוצאה תפורסם כהדמיה, מסומנת «הדמיה · AI-generated», שהיא בנויה לפי תכנית המכר והנתונים שאישרתי, ושהריהוט והגימורים בה להמחשה בלבד.',
};

function newJob(uid, pid, project, fl, consent) {
  const base = pdir(uid, pid);
  const now = new Date().toISOString();
  const job = {
    schema: 'habait-studio/job.v1',
    id: `j${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
    project: pid, owner: uid, name: project.name,
    state: 'queued', stage: 'queued', percent: 0,
    created: now, updated: now,
    inputs: {
      prefix: base,
      spec: `${base}spec.json`,
      files: fl.map((f) => f.pathname),
      pages: `${base}files/.pages/`,
      trace: null,
    },
    consent: { version: CONSENT.version, text: CONSENT.he, at: now, by: uid, accepted: Boolean(consent) },
    needs: null,
    approvals: { spec: project.steps?.approve || null, trace: null },
    corrections: [],
    result: null,      // { package: '<path of out/<pid>/package/>', page: '/p/<pid>/', tour: '/p/<pid>/tour/', fidelity: { verdict, report } }
    links: [],         // [{ label, href }] — set by the runner as results land
    log: [],
    error: null,
  };
  logLine(job, 'נכנס לתור הבנייה');
  return job;
}

export async function GET(request) {
  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    if (!isPid(id)) return json(400, { ok: false, reason: 'id' });
    const project = await readJson(`${pdir(uid, id)}meta.json`);
    if (!project) return json(404, { ok: false, reason: 'missing' });
    const [fl, spec, chat, usd, job] = await Promise.all([files(uid, id), readJson(`${pdir(uid, id)}spec.json`), readJson(`${pdir(uid, id)}chat.json`, []), spent(uid, id), readJson(jobPath(uid, id))]);
    return json(200, { ok: true, project, files: fl.map(({ pathname, ...f }) => f), spec, chat, spent: usd, steps: STEPS, job, consent: CONSENT });
  }
  const metas = (await listAll(udir(uid))).filter((b) => /\/p\/[A-Za-z0-9_-]+\/meta\.json$/.test(b.pathname));
  const projects = (await Promise.all(metas.map((b) => readJson(b.pathname)))).filter(Boolean).sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return json(200, { ok: true, projects, steps: STEPS });
}

export async function POST(request) {
  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  let body = {};
  try { body = await request.json(); } catch { return json(400, { ok: false, reason: 'body' }); }

  if (body.id) {
    if (!isPid(body.id)) return json(400, { ok: false, reason: 'id' });
    const base = pdir(uid, body.id);
    const f = `${base}meta.json`;
    const project = await readJson(f);
    if (!project) return json(404, { ok: false, reason: 'missing' });
    const now = new Date().toISOString();

    if (body.approveSpec) {
      if (!(await readJson(`${base}spec.json`))) return json(409, { ok: false, reason: 'no_spec' });
      project.steps = { ...(project.steps || {}), approve: { state: 'done', at: now } };
      await writeJson(f, project);
      return json(200, { ok: true, project });
    }

    if (body.build) {
      if (project.steps?.approve?.state !== 'done') return json(409, { ok: false, reason: 'not_approved', message: 'קודם מאשרים את הנתונים מול תכנית המכר' });
      if (!body.consent) return json(409, { ok: false, reason: 'consent', message: 'צריך לסמן את ההסכמה' });
      const cur = await readJson(jobPath(uid, body.id));
      if (cur && ['queued', 'running', 'waiting', 'review'].includes(cur.state)) return json(409, { ok: false, reason: 'busy', message: 'הבנייה כבר רצה', job: cur });
      const job = newJob(uid, body.id, project, await files(uid, body.id), body.consent);
      await enqueue(uid, body.id, job);
      project.steps = { ...(project.steps || {}), build: { state: 'running', at: now, job: job.id } };
      await writeJson(f, project);
      return json(200, { ok: true, job });
    }

    if (body.approveTrace || typeof body.traceCorrection === 'string') {
      const job = await readJson(jobPath(uid, body.id));
      if (!job || job.needs?.type !== 'trace_approval') return json(409, { ok: false, reason: 'no_trace', message: 'אין שרטוט שממתין לאישור' });
      // Eliran 2026-11-04: the agent checks fidelity automatically; the developer's approval is not relied on. Only a trace whose
      // automatic check PASSED (every printed dimension vs the traced one) can be approved; anything else is Habait's review.
      if (body.approveTrace && String(job.needs.check?.verdict || '').toUpperCase() !== 'PASS') return json(409, { ok: false, reason: 'review', message: 'השרטוט עדיין לא עבר את בדיקת ההתאמה. המערכת ממשיכה לתקן' });
      if (body.approveTrace) {
        job.approvals = { ...(job.approvals || {}), trace: { at: now, by: uid, trace: job.needs.trace || null } };
        job.inputs = { ...(job.inputs || {}), trace: job.needs.trace || job.inputs?.trace || null };
        job.stage = 'queued';
        logLine(job, 'היזם אישר את השרטוט מול תכנית המכר');
        project.steps = { ...(project.steps || {}), trace: { state: 'done', at: now } };
      } else {
        const text = body.traceCorrection.trim().slice(0, 2000);
        if (!text) return json(400, { ok: false, reason: 'empty' });
        job.corrections = [...(job.corrections || []), { at: now, by: uid, text }];
        job.stage = 'trace';
        logLine(job, `תיקון לשרטוט: ${text}`);
      }
      job.needs = null;
      job.state = 'queued';
      await enqueue(uid, body.id, job);
      await writeJson(f, project);
      return json(200, { ok: true, job });
    }
    return json(400, { ok: false, reason: 'op' });
  }

  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) return json(400, { ok: false, reason: 'name' });
  const id = `p${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  const project = { id, name, created: new Date().toISOString(), steps: {} };
  await writeJson(`${pdir(uid, id)}meta.json`, project);
  return json(200, { ok: true, project });
}
