/* GET /api/studio-file?id=<pid>&path=<project-relative path> — streams one PRIVATE blob of the signed-in developer's own
   project (the trace overlay to approve, a result preview). Only these folders: files/, trace/, results/, out/. */
import { get } from '@vercel/blob';
import { json, userId, pdir, isPid } from './_studio.mjs';

const OK = /^(files|trace|results|out|debug)\/[^\0]{1,300}$/;

export async function GET(request) {
  const uid = await userId(request);
  if (!uid) return json(401, { ok: false, reason: 'login' });
  const u = new URL(request.url);
  const id = u.searchParams.get('id'); const rel = u.searchParams.get('path') || '';
  if (!isPid(id) || !OK.test(rel) || rel.split('/').some((s) => s === '..' || s === '.' || s === '')) return json(400, { ok: false, reason: 'path' });
  try {
    const r = await get(`${pdir(uid, id)}${rel}`, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return json(404, { ok: false, reason: 'missing' });
    return new Response(r.stream, { status: 200, headers: { 'content-type': r.blob.contentType || 'application/octet-stream', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' } });
  } catch { return json(404, { ok: false, reason: 'missing' }); }
}
