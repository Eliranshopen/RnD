#!/usr/bin/env node
/* Habait Tour360 — tools/consistency-check.mjs (Eliran 2026-11-04: «דבר כזה לא יכול לקרות חייב שיהיה עקביות» — from 03-dining the kitchen
   was a matte white L, from 02-kitchen a stainless kitchen with a curved counter). A fixed element (the kitchen run, the hob, the sink,
   the wardrobe fronts) must be the SAME element from every scene that sees it, and must sit where the plan puts it.
   For one element group (plan.general.json fixtures by id or by room):
     1. every scene whose camera sees the group (no plan wall between the camera and the group's centre, within 12 m) is found;
     2. from each, a perspective view is cut at the group's plan bearing (wide enough for its whole footprint), from the designed set and
        from the CG render of the same camera (the structure reference);
     3. a sheet: one row per scene, designed | CG, with the scene name and bearing → _local/fidelity/consistency__<group>__<hash>.jpg;
     4. --judge: ONE vision call with every designed view (google/gemini-3.7-flash via the chat transport, ledgered before it runs,
        ≈ $0.01): "the same kitchen in every view? where are the hob and the sink?" → JSON. FAIL (exit 1) when it answers not the same,
        or names the hob/sink on a run the plan does not (--expect "hob:long,sink:long").
   usage: node Habait/tour360/tools/consistency-check.mjs apt846 --group kitchen [--set balanced|picks] [--judge] [--expect hob:long/corner,sink:long/middle,tall:far]
          [--scenes 02-kitchen,03-dining,04-living] [--skin <asset>=<file> ...]
   Groups: kitchen = k-counter, k-counter-2, k-tall · wardrobe = w-closet-1, w-closet-2 · any fixture id list "a,b". FAL_KEY by name only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { loadPano, render } from './pano-geometry.mjs';
import { chatFetch } from '../server/chat-transport.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const flags = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const VALUE = ['--group', '--set', '--expect', '--scenes', '--skin', '--cg-tour', '--tol', '--at'];
const aptId = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(args[i - 1])))[0];
const group = flag('--group', 'kitchen');
if (!aptId) { console.error('usage: consistency-check.mjs <apartment> --group kitchen [--set balanced|picks] [--judge] [--expect hob:long/corner,sink:long/middle,tall:far]'); process.exit(2); }
const GROUPS = { kitchen: ['k-counter', 'k-counter-2', 'k-tall'], wardrobe: ['w-closet-1', 'w-closet-2'] };
// --all-groups (2026-11-05): every element group seen from >= 2 cameras, derived from the plan — fixtures clustered by their id prefix
// (k-, l-, d-, bm-, w-, b2-, bg-) plus the terrace railing (the railing panes); each group gets a sheet and a generic judge.
const ALL_GROUPS = (() => {
  const plan0 = JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'plan.general.json'), 'utf8'));
  // one group per ROOM (project-runner fork F, 2026-11-05: the same rule for every project — a portal plan's fixture ids are the
  // tracer's, not apt846's prefixes). The name is the room id without "r-", the kitchen room is "kitchen"; for apt846 this gives the
  // same groups as the old id-prefix clusters (kitchen, living, dining, bedroom-main, wardrobe, bedroom-2, bath-main, bath-guest).
  const out = {};
  const nameOf = (rid) => { const r = (plan0.rooms || []).find((x) => x.id === rid) || {}; return r.type === 'kitchen' ? 'kitchen' : String(rid).replace(/^r-/, ''); };
  for (const f of plan0.fixtures || []) { if (!f.room_id) continue; const n = nameOf(f.room_id); (out[n] = out[n] || []).push(f.id); }
  if ((plan0.panes || []).some((q) => q.kind === 'railing')) out['terrace-railing'] = ['railing'];
  return out;
})();
const allGroups = args.includes('--all-groups');
// apt846's named groups apply only where the plan carries those ids (Rainbow); any other plan uses its rooms (ALL_GROUPS)
const planIds = new Set(JSON.parse(fs.readFileSync(path.join(TOUR, 'apartments', aptId, 'plan.general.json'), 'utf8')).fixtures?.map((f) => f.id) || []);
const named = GROUPS[group] && GROUPS[group].some((x) => planIds.has(x)) ? GROUPS[group] : null;
const ids = allGroups ? [] : (named || ALL_GROUPS[group] || group.split(','));
const LIST = args.includes('--list');   // $0: which scenes see the group(s), as JSON lines; no picture needed, no judge
const setName = flag('--set', 'balanced');
const cgTour = flag('--cg-tour', aptId);
const APT = path.join(TOUR, 'apartments', aptId);
const OUTD = path.join(APT, '_local', 'fidelity'); fs.mkdirSync(OUTD, { recursive: true });
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const picks = (() => { try { return JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8')); } catch { return {}; } })();
const skinOverride = Object.fromEntries(flags('--skin').map((s) => s.split('=')));
const railingFx = ids.includes('railing') ? plan.panes.filter((q) => q.kind === 'railing').map((q) => ({ id: q.id, polygon_cm: q.polygon_cm, kind: 'railing' })) : [];
const fx = plan.fixtures.filter((f) => ids.includes(f.id)).concat(railingFx);
if (!allGroups && !fx.length) { console.error(`no fixtures ${ids.join(',')} in the plan`); process.exit(2); }
const pts = fx.flatMap((f) => f.polygon_cm || [f.centre_cm]);
const centre = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

const walls = plan.walls.flatMap((w) => w.polygon_cm.map((a, i) => [a, w.polygon_cm[(i + 1) % w.polygon_cm.length]]))
  // a door opening blocks the sight line too (2026-11-05): a peek through a doorway depends on the leaf and is no basis for a verdict
  .concat((plan.openings || []).filter((o) => o.kind !== 'opening' && o.a_cm && o.b_cm).map((o) => [o.a_cm, o.b_cm]));
const cross = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (Math.abs(d) < 1e-9) return false; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, s = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t > 0.02 && t < 0.98 && s >= 0 && s <= 1; };
const bearing = (from, to) => (((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI) % 360) + 360) % 360;
const norm = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

if (allGroups) {
  const { spawnSync } = await import('node:child_process');
  const pass = [], fail = [], skipped = [];
  for (const g of Object.keys(ALL_GROUPS)) {
    const sub = args.filter((a) => a !== '--all-groups' && !(a === '--group' || (args[args.indexOf(a) - 1] === '--group')));
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...sub, '--group', g], { encoding: 'utf8', env: process.env });
    const out = (r.stdout || '') + (r.stderr || '');
    if (LIST) { const j = out.split(/\r?\n/).find((l) => l.startsWith('{')); if (j) console.log(j); continue; }
    const line = out.trim().split(/\r?\n/).filter(Boolean);
    console.log(`[${g}] ` + line.slice(-2).join(' / '));
    if (r.status === 0) pass.push(g); else if (/nothing to compare|seen from/.test(out)) skipped.push(g); else fail.push(g);
  }
  if (LIST) process.exit(0);
  console.log(`all groups: PASS ${pass.length} [${pass.join(', ')}] · FAIL ${fail.length} [${fail.join(', ')}] · single-camera ${skipped.length} [${skipped.join(', ')}]`);
  process.exit(fail.length ? 1 : 0);
}
const want = flag('--scenes') ? flag('--scenes').split(',') : null;
const views = [];
for (const s of scenes) {
  if (want && !want.includes(s.asset)) continue;
  const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${s.id}`.toLowerCase());
  if (!cam) continue;
  const C = [cam.x, cam.y];
  const dist = Math.hypot(centre[0] - C[0], centre[1] - C[1]);
  // seen when at least one of the group's points has a clear line (no wall) from the camera
  const seen = pts.some((p) => !walls.some(([a, b]) => cross(C, p, a, b)));
  if (!want && (!seen || dist > 1200)) continue;
  const bs = pts.map((p) => bearing(C, p)); const mid = bearing(C, centre);
  const span = Math.max(...bs.map((b) => Math.abs(norm(b - mid))));
  const hfov = Math.max(70, Math.min(120, 2 * span + 24));
  const yaw = norm(mid - s.centreBearingDeg);
  const skin = skinOverride[s.asset] ? path.resolve(skinOverride[s.asset]) : setName === 'picks' ? path.join(APT, '_local', 'generated', picks[s.asset] || '') : path.join(APT, 'panos', setName, `${s.asset}.webp`);
  const cg = path.join(REPO, '360walkaround', 'tours', cgTour, 'renders', cam.id, 'pano.webp');
  if (!fs.existsSync(skin) && !LIST) { console.error(`${s.asset}: no picture ${skin}`); process.exit(2); }
  views.push({ asset: s.asset, cam: cam.id, dist: Math.round(dist), bearing: Math.round(mid), yaw, hfov, skin, cg: fs.existsSync(cg) ? cg : null });
}
if (LIST) { console.log(JSON.stringify({ group, fixtures: fx.map((f) => f.id), views: views.map((v) => ({ asset: v.asset, dist: v.dist, bearing: v.bearing })) })); process.exit(0); }
if (views.length < 2) { console.error(`${group}: seen from ${views.length} scene(s); nothing to compare`); process.exit(2); }

const VW = 720, VH = 480;
const cut = async (file, v) => { const p = await loadPano(sharp, file); const buf = render(p, v.yaw, -12, v.hfov, VW, VH); return sharp(buf, { raw: { width: VW, height: VH, channels: 3 } }).jpeg({ quality: 86 }).toBuffer(); };
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="28"><rect width="${VW}" height="28" fill="#000"/><text x="8" y="19" fill="#fff" font-size="15" font-family="Arial">${t}</text></svg>`);
const parts = []; let y = 0; const designed = [];
for (const v of views) {
  const a = await cut(v.skin, v); designed.push(a);
  parts.push({ input: await sharp(label(`${v.asset} — designed (${setName}) · plan bearing ${v.bearing}° · ${v.dist} cm`)).png().toBuffer(), left: 0, top: y });
  parts.push({ input: await sharp(label(`${v.asset} — CG (${cgTour}) · the structure reference`)).png().toBuffer(), left: VW + 8, top: y });
  parts.push({ input: a, left: 0, top: y + 28 });
  if (v.cg) parts.push({ input: await cut(v.cg, v), left: VW + 8, top: y + 28 });
  y += VH + 28 + 8;
}
const h = crypto.createHash('sha256').update(Buffer.concat(designed)).digest('hex').slice(0, 12);
const sheet = path.join(OUTD, `consistency__${group}__${setName}__${h}.jpg`);
await sharp({ create: { width: VW * 2 + 8, height: y, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 84 }).toFile(sheet);
console.log(`${group}: ${views.map((v) => `${v.asset}@${v.bearing}°`).join(', ')} → ${path.relative(APT, sheet)}`);

let verdict = 'SHEET-ONLY', judge = null, misplaced = [];
if (args.includes('--judge')) {
  const env = loadEnv(REPO);
  if (!env.FAL_KEY && !env.OPENROUTER_API_KEY) { console.error('consistency-check: no FAL_KEY / OPENROUTER_API_KEY by name'); process.exit(2); }
  const MODEL = 'google/gemini-3.7-flash', EST = 0.01;
  const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
  const row = ledger.reserve({ ts: new Date().toISOString(), op: 'consistency_judge', apartment: aptId, scene: group, model: MODEL, inputs_hash: h, reserved_usd: EST, status: 'reserved' });
  const generic = group !== 'kitchen' || !named;   // the L-kitchen words below are apt846's kitchen; any other plan's kitchen gets the generic judge
  const sysGeneric = `You check an architectural visualisation for consistency. You get ${views.length} photos of ONE apartment taken from different rooms; each photo looks toward the same ${group} (the element group: ${ids.join(', ')}). Return ONLY JSON: {"same": true|false, "differences": ["..."], "per_view": [{"view": 1, "visible": true|false, "material": "...", "colour": "...", "shape": "...", "position_note": "..."}]}. "same" is true only if every part of the element that is visible in two or more photos is the same element in each (the same shape, material, colour, size and place against the same walls/glass); furniture dressing that differs (a cushion, a plant, a book) does not count, but a different sofa, a different bed, a different railing, a different floor or a different wall finish does. Photos where the element is not visible are not differences.`;
  const sys = generic ? sysGeneric : `You check an architectural visualisation for consistency. You get ${views.length} photos of ONE apartment taken from different rooms; each photo looks toward the same ${group}. Return ONLY JSON: {"same": true|false, "differences": ["..."], "per_view": [{"view": 1, "fronts": "...", "worktop": "...", "splashback": "...", "hob_on": "long_run|short_return|not_visible", "hob_position": "corner_end|middle|far_end|not_visible", "sink_on": "long_run|short_return|not_visible", "sink_position": "corner_end|middle|far_end|not_visible", "tall_column_at": "corner_end|far_end|not_visible", "hob_x": number|null, "sink_x": number|null, "tall_x": number|null, "short_return_shape": "rectangular|rounded|not_visible"}]}. "hob_x", "sink_x" and "tall_x" are the horizontal centre of the hob, the sink and the tall column in THAT photo, 0 = left edge, 1000 = right edge, null when not visible. "same" is true only if every visible part (front colour and material, worktop material, splashback, appliances, the L shape and where the hob, the sink and the tall column are) is the same in every photo where it is visible. The long run is the long leg of the L against the partition wall; the short return is the short leg toward the facade glass. On the long run, the CORNER end is the end that meets the short return (near the glass); the FAR end is the opposite end, away from the glass. Judge positions by where a thing sits along the run, not by which side of the photo it is on.`;
  const content = [{ type: 'text', text: `Photos 1..${views.length}: ${views.map((v, i) => `${i + 1} = from ${v.asset}`).join('; ')}.` }, ...designed.map((b) => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b.toString('base64') } }))];
  let res, j;
  try {
    res = await chatFetch(env)('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + (env.OPENROUTER_API_KEY || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 2500, messages: [{ role: 'system', content: sys }, { role: 'user', content }] }), signal: AbortSignal.timeout(180000) });
    j = await res.json();
  } catch (e) { ledger.settle(row, EST, { status: 'error-unknown-billing', note: String(e.message).slice(0, 120) }); throw e; }
  const usd = Number(j?.usage?.cost) || EST;
  ledger.settle(row, usd, { status: res.ok ? 'ok' : `http-${res.status}` });
  const text = j?.choices?.[0]?.message?.content || '';
  try { const s = text.indexOf('{'), e = text.lastIndexOf('}'); judge = JSON.parse(text.slice(s, e + 1)); } catch { judge = { same: false, differences: ['the judge returned no JSON'], raw: text.slice(0, 300) }; }
  const expect = Object.fromEntries((flag('--expect') || '').split(',').filter(Boolean).map((kv) => kv.split(':')));
  // --expect hob:long/corner,sink:long/middle,tall:far — each value is "<on>[/<position>]"; a view fails when a visible element is not where the plan puts it
  const bad = (p, key, on, pos) => { const e = expect[key]; if (!e) return false; const [eo, ep] = e.split('/'); const vo = p[on], vp = pos ? p[pos] : null; if (!vo || vo === 'not_visible') return false; if (eo && !vo.startsWith(eo)) return true; if (ep && vp && vp !== 'not_visible' && !vp.startsWith(ep)) return true; return false; };
  // the mechanical check (2026-11-04): x in the view → plan bearing (the view's yaw + hfov), against where the plan puts the hob, the sink
  // and the tall column (the furnished plan's fixture_hints, or --at "hob=x,y;sink=x,y;tall=x,y"), within --tol degrees (default 15)
  const TOL = Number(flag('--tol', 15));
  const at = {};
  try { const fp = JSON.parse(fs.readFileSync(path.join(REPO, '360walkaround', 'tours', cgTour, 'plan.json'), 'utf8')); const hints = fp.furnishing?.fixture_hints || {}; for (const h of Object.values(hints)) { if (h.hob_at_cm) at.hob = h.hob_at_cm; if (h.sink_at_cm) at.sink = h.sink_at_cm; } const tall = fp.fixtures.find((f) => f.kind === 'tall_unit' && ids.includes(f.id)); if (tall) at.tall = tall.centre_cm; } catch { /* no furnished plan */ }
  for (const kv of (flag('--at') || '').split(';').filter(Boolean)) { const [k, v] = kv.split('='); at[k] = v.split(',').map(Number); }
  (judge.per_view || []).forEach((p, i) => {
    const v = views[i]; if (!v) return;
    const camP = plan.camera_points.find((c) => c.id === v.cam);
    for (const [key, xk] of [['hob', 'hob_x'], ['sink', 'sink_x'], ['tall', 'tall_x']]) {
      if (!at[key] || typeof p[xk] !== 'number') continue;
      const off = Math.atan(((p[xk] / 1000) - 0.5) * 2 * Math.tan((v.hfov * Math.PI / 180) / 2)) * 180 / Math.PI;
      const got = (v.bearing + off + 360) % 360;
      const want = bearing([camP.x, camP.y], at[key]);
      const d = Math.abs(norm(got - want));
      p[`${key}_bearing`] = Math.round(got); p[`${key}_plan_bearing`] = Math.round(want); p[`${key}_off_deg`] = Math.round(d);
      if (d > TOL) misplaced.push(`view ${p.view} (${v.asset}) ${key} at ${Math.round(got)}°, the plan has it at ${Math.round(want)}° (${Math.round(d)}° off)`);
    }
  });
  const wrongPlace = generic ? [] : (judge.per_view || []).filter((p) => bad(p, 'hob', 'hob_on', 'hob_position') || bad(p, 'sink', 'sink_on', 'sink_position') || (expect.tall && p.tall_column_at && p.tall_column_at !== 'not_visible' && !p.tall_column_at.startsWith(expect.tall)));
  verdict = judge.same && !wrongPlace.length && !misplaced.length ? 'PASS' : 'FAIL';
  if (misplaced.length) console.log(`misplaced vs the plan (±${TOL}°): ${misplaced.join(' | ')}`);
  console.log(`judge (${MODEL}, $${usd.toFixed(4)}): ${verdict} — same: ${judge.same}; ${(judge.differences || []).slice(0, 6).join(' | ')}${wrongPlace.length ? ` | not where the plan puts it: ${wrongPlace.map((p) => `view ${p.view} hob ${p.hob_on}/${p.hob_position} sink ${p.sink_on}/${p.sink_position} tall ${p.tall_column_at}`).join(', ')}` : ''}`);
}
const gj = path.join(OUTD, 'consistency.json');
const doc = (() => { try { return JSON.parse(fs.readFileSync(gj, 'utf8')); } catch { return { $schema: 'tour360/consistency.v1', rows: [] }; } })();
doc.rows.push({ at: new Date().toISOString(), group, set: setName, misplaced, views: views.map(({ asset, bearing, dist, hfov, skin }) => ({ asset, bearing, dist, hfov, picture: path.relative(APT, skin) })), sheet: path.relative(APT, sheet), verdict, judge });
fs.writeFileSync(gj, JSON.stringify(doc, null, 1));
process.exit(verdict === 'FAIL' ? 1 : 0);
