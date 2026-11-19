/* Habait Tour360 — the Vercel function `api/edit.mjs` (copied there by tools/build-tour.mjs beside `api/_handler.mjs`).
   GET  → { configured, models, limits }  (no secrets, ever)
   POST → one live edit turn through server/handler.mjs. Keys come from the project's environment — FAL_KEY, OPENROUTER_API_KEY
   and TOUR_EDIT_CODE — pasted by Slava, never by an agent (D-T360-18). Until they exist the function answers 503 and the page
   keeps the typed field disabled. The day's cap is counted in memory per instance (best effort on this host; the laptop server
   keeps the exact file ledger). */
import fs from 'node:fs';
import { describe, handleEdit, memoryLedger, catalogIndex, EditError } from './_handler.mjs';

export const config = { maxDuration: 300 };

const ledger = memoryLedger();
// the catalog (T14b): build-tour.mjs --catalog writes api/catalog.json beside this file; without it there is no catalog turn
let catalog = null;
try { catalog = catalogIndex(JSON.parse(fs.readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))); } catch { catalog = null; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'GET') {
    res.status(200).json(describe(process.env, catalog, req.headers['x-tour-code'] === undefined ? undefined : String(req.headers['x-tour-code']))); // T18i: the code up front
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, reason: 'method' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const out = await handleEdit(body, process.env, ledger, { log: (m) => console.log('[tour-edit]', m), catalog });
    res.status(200).json(out);
  } catch (e) {
    if (e instanceof EditError) {
      res.status(e.status).json({ ok: false, reason: e.reason, message: e.reason === 'vendor' || e.reason === 'vendor_refused' ? undefined : e.message });
      return;
    }
    console.error('[tour-edit]', String(e && e.message || e).slice(0, 200));
    res.status(500).json({ ok: false, reason: 'error' });
  }
}
