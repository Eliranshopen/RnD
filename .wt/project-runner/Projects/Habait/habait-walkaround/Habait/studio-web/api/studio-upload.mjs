/* POST /api/studio-upload — the browser uploads straight to the private Blob store (files up to 200 MB, past the 4.5 MB
   function body limit). This route only issues the short-lived client token, after checking the Clerk session and that the
   path is inside the signed-in developer's own project: studio/u/<uid>/p/<pid>/files/<name>. */
import { handleUpload } from '@vercel/blob/client';
import { json, userId, pdir, isPid, readJson, uploadRelOk } from './_studio.mjs';

const TYPES = ['application/pdf', 'application/json', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv', 'application/zip', 'application/octet-stream', 'image/vnd.dwg', 'application/acad', 'image/vnd.dxf', 'application/dxf'];

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, reason: 'body' }); }
  const uid = body?.type === 'blob.generate-client-token' ? await userId(request) : null;
  try {
    const out = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!uid) throw new Error('login');
        const pid = String(clientPayload || '');
        if (!isPid(pid) || !(await readJson(`${pdir(uid, pid)}meta.json`))) throw new Error('project');
        const pre = `${pdir(uid, pid)}files/`;
        if (!pathname.startsWith(pre) || !uploadRelOk(pathname.slice(pre.length))) throw new Error('path');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: true };
      },
    });
    return json(200, out);
  } catch (e) {
    const m = String(e?.message || e);
    return json(m === 'login' ? 401 : 400, { ok: false, reason: ['login', 'project', 'path'].includes(m) ? m : 'upload' });
  }
}
