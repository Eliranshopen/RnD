// Studio fixture API (board platform-ui-ux, cards 06-08 dev scaffolding; never copied back).
// Mirrors the routes of the live Habait/studio/server.mjs (read 2026-11-03), answering every GET from disk READ-ONLY:
//   statics  <- the WORKING COPY studio/dashboard/        projects <- the LIVE studio/_local/projects/ (read-only)
//   /api/stages <- parsed from the live pipeline/stages/*.mjs (no import: the real server needs zod, not installed)
// Every POST / PATCH / PUT / DELETE answers 405 {"error":"fixture: read-only"}. Nothing on disk is ever written.
// usage: node studio-fixture-api.cjs [--port 8853] [--empty]     (--empty: /api/projects answers [] for the empty-state frames)
const http = require('http'); const fs = require('fs'); const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8853)); const EMPTY = process.argv.includes('--empty');
const LIVE = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/studio';
const WT = 'C:/RnD/.wt/platform-ui-ux/files/Projects/Habait/habait-walkaround/Habait/studio';
const DASH = `${WT}/dashboard`; const PROJ = `${LIVE}/_local/projects`;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const rj = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
function serveFile(res, file, req) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const size = fs.statSync(file).size; const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) { const s = Number(range[1] || 0), e = range[2] ? Number(range[2]) : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); return fs.createReadStream(file, { start: s, end: e }).pipe(res); }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
}
const safe = (root, rel) => { const f = path.normalize(path.join(root, rel)); if (!f.startsWith(path.normalize(root))) throw new Error('escape'); return f; };
// stages: same order as pipeline/index.mjs STAGES
const STAGE_ORDER = ['intake', 'site', 'plan', 'shots', 'scene', 'clay', 'keyframes', 'video', 'assemble'];
const STAGES = STAGE_ORDER.map((id) => { const t = fs.readFileSync(`${LIVE}/pipeline/stages/${id}.mjs`, 'utf8'); const g = (k) => (new RegExp(`${k}:\\s*'([^']*)'`).exec(t) || [])[1] || id; return { id, title_he: g('title_he'), title_en: g('title_en'), paid: /\bpaid:\s*true/.test(t), local: /\blocal:\s*true/.test(t) }; });
const exists = (id) => /^[a-z0-9\u0590-\u05ff-]+$/i.test(id) && fs.existsSync(`${PROJ}/${id}/project.json`);
const files = (id) => { const d = `${PROJ}/${id}/intake`; return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => !f.startsWith('.') && f !== 'CLAUDE.md').map((f) => { const s = fs.statSync(`${d}/${f}`); return { name: f, bytes: s.size, mtime: s.mtime.toISOString() }; }) : []; };
const ledger = (id) => rj(`${PROJ}/${id}/ledger.json`, []);
const state = (id) => rj(`${PROJ}/${id}/state.json`, { stages: {}, running: false, ledger_usd: 0 });
function summary(id) {
  const meta = rj(`${PROJ}/${id}/project.json`); const der = (n) => rj(`${PROJ}/${id}/derived/${n}`);
  const dd = `${PROJ}/${id}/derived`; const derived = fs.existsSync(dd) ? fs.readdirSync(dd).filter((f) => f.endsWith('.json')) : [];
  const intake = der('intake.json'), shots = der('shots.json'), keyframes = der('keyframes.json'), clay = der('clay.json'), video = der('video.json'), site = der('site.json');
  return { ...meta, state: state(id), files: files(id), ledger: ledger(id), ledger_usd: ledger(id).reduce((s, r) => s + (Number(r.usd) || 0), 0), derived,
    intake: intake ? { ...intake, _meta: intake._meta } : null, site: site ? { origin: site.origin, north_deg: site.north_deg, floor_of_unit: site.floor_of_unit, floors_total: site.floors_total, buildings: site.context?.buildings?.length || 0, notes: site.notes } : null,
    shots: shots ? shots.shots.map((s) => ({ id: s.id, kind: s.kind, duration_s: s.duration_s, room_name_he: s.room_name_he, room_name_en: s.room_name_en })) : null,
    clay: clay ? { res: clay.res, samples: clay.samples, engine: clay.engine, shots: clay.shots, failed: clay.failed } : null,
    keyframes: keyframes ? keyframes.picks : null, video: video ? { rows: video.rows, estimate_usd: video.estimate_usd, spent_usd: video.spent_usd } : null,
    outputs: rj(`${PROJ}/${id}/outputs/tour.json`), running: false };
}
const log = [];
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  log.push(`${req.method} ${url.pathname}`);
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'fixture: read-only' });
    if (!parts.length) return serveFile(res, `${DASH}/index.html`, req);
    if (parts[0] === 'api') {
      const [, kind, id, sub] = parts;
      if (kind === 'env') return send(res, 200, { llm: 'missing: fixture (no LLM)', llm_backend: null, fal: 'missing FAL_KEY', blender: 'not found (fixture)', python: 'python', allow_spend: false, cap_usd: 10, projects_dir: 'fixture: read-only', fixture: true });
      if (kind === 'styles') return serveFile(res, `${WT}/styles/presets.json`, req);
      if (kind === 'stages') return send(res, 200, STAGES);
      if (kind === 'projects' && !id) return send(res, 200, EMPTY ? [] : fs.readdirSync(PROJ).filter(exists).map((p) => ({ ...rj(`${PROJ}/${p}/project.json`), state: state(p), running: false })));
      if (kind === 'projects' && id) {
        if (!exists(id)) return send(res, 404, { error: 'no such project' });
        if (!sub) return send(res, 200, summary(id));
        if (sub === 'events') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); res.write(': fixture\n\n'); return; }
        if (sub === 'derived' && parts[4]) return serveFile(res, safe(`${PROJ}/${id}/derived`, parts[4]), req);
      }
      return send(res, 404, { error: 'unknown api route' });
    }
    if (parts[0] === 'projects' && parts[1]) { if (!exists(parts[1])) { res.writeHead(404); return res.end(); } return serveFile(res, safe(`${PROJ}/${parts[1]}`, parts.slice(2).join('/')), req); }
    return serveFile(res, safe(DASH, parts.join('/')), req);
  } catch (e) { return send(res, 500, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => console.log(`studio fixture API http://127.0.0.1:${PORT}/ (read-only${EMPTY ? ', empty project list' : ''}) pid ${process.pid}`));
process.on('SIGTERM', () => process.exit(0));
