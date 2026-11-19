#!/usr/bin/env node
/* Habait Tour360 — tools/skin-project.mjs (project-runner, fork F, 2026-11-05). The designed look of a NEW apartment with no human step:
   the same recipe that made Rainbow apt846 (fix-846-fidelity, 2026-11-04/05), run by rule for every scene, gated, and repaired until it
   passes. Eliran 2026-11-05: «הפורטל צריך להיות עצמאי» and «אם יש סטייה … תעשה הכל כדי שהכל יהיה תקין והכל יופיע כמו בתכנית מכר».

   First, $0: the sight-line map — every room with fixtures is one element group; consistency-check.mjs --all-groups --list (one group per room with fixtures + the railing) names the scenes that see
   it within --see-cm (700 cm); the camera inside the room is the group's HOME. Per scene, in this order: the anchor room (living) first,
   then the homes the most other scenes see, then the rest —
     1. make-skin-prompts.mjs --roll auto       the prompt from the house material board + the plan (openings, fixtures by bearing); image 1 =
                                                the CG render of this camera, image 2 = the anchor's final, image 3 = the house style
                                                (house-style/style-living.png); a scene that sees another room's elements gets that
                                                room's passed picture too (nearest 3), with the words "EXACTLY as in Image n"
     2. gen-pano.mjs <scene> gpt25              GPT Image 2.5 at 2048×1024 (booked $0.60), the Rainbow lane
     3. close-seam.mjs --lite                   only when the wrap seam steps (> max(6, 2.5 × the neighbours' step)), kept only if it helps
     4. fidelity-gate.mjs --set picks           the per-room deviation against the plan at fidelity.json's bar
     5. the fix loop (fidelity.json fix_loop)   FAIL / STALE → regenerate with the next seed; from attempt 3, CG-guided band repairs at
                                                the flagged bearings; up to max_attempts. A deviation the trace or the CG itself carries
                                                (UNRESOLVED, dims, cg_vs_plan) is NOT a skin problem: the scene stops and says so.
   Then, for the whole apartment:
     6. consistency-check.mjs --group <g> --judge       for EVERY group seen from 2+ scenes (kitchen with its hob/sink judge, every other
                                                         room generic): the judge's list must be empty; a FAIL regenerates the non-home
                                                         viewers (up to 2 rounds); any FAIL left = the project is not packaged
     7. make-sets.mjs                                    the web sets from the picks, then the gate again on the balanced set (the build
                                                         checks the exact bytes it ships)
     8. finish-pano.mjs per scene × floor                parquet / concrete / marble (videos.json), each gated, retried with --attempt
   No room is ever dropped: a scene that does not pass keeps the run's exit code non-zero and build-tour refuses to package.

   Money (root §7): every paid call is reserved in apartments/<id>/_local/ledger.json by the tool BEFORE it is sent (the tools' own
   reserve/settle); this runner checks the job's spend against --soft / --hard BEFORE each call and mirrors every new row into the job's
   ledger (out/<id>/ledger.json, op skin.*). At --soft it stops with exit 4 (a checkpoint: re-run to continue — every answer is cached by
   its inputs hash, a re-run never re-bills); --hard is never crossed (exit 3).
   Keys by NAME only: FAL_KEY from the process environment, or from <--env-root>/.env read by file-ledger's loadEnv; never printed.

   usage: node Habait/tour360/tools/skin-project.mjs <apartment> [--scenes a,b] [--soft 40] [--hard 60] [--max-attempts N]
          [--floors parquet,concrete,marble | --no-floors] [--model gpt25] [--anchor living] [--env-root <dir>] [--dry]
   exit 0 = every scene (and finish) PASSES, 1 = something still fails after the loop (report in _local/skin-report.json),
        2 = usage / missing input, 3 = the hard cap would be crossed, 4 = the soft checkpoint reached */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileLedger, loadEnv } from './file-ledger.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOLS, '..');            // Habait/tour360
const REPO = path.resolve(ROOT, '..', '..');       // habait-walkaround
const argv = process.argv.slice(2);
const VALUE = ['--scenes', '--soft', '--hard', '--max-attempts', '--floors', '--model', '--anchor', '--env-root'];
const id = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1])))[0];
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
if (!id) { console.error('usage: skin-project.mjs <apartment> [--scenes a,b] [--soft 40] [--hard 60] [--max-attempts N] [--floors a,b|--no-floors] [--dry]'); process.exit(2); }

const APT = path.join(ROOT, 'apartments', id);
const OUT = path.join(ROOT, 'out', id);
const LOCAL = path.join(APT, '_local');
const GEN = path.join(LOCAL, 'generated');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1) + '\n'); };
for (const f of ['plan.general.json', 'scenes.json', 'cameras.json', 'material-board.json']) if (!fs.existsSync(path.join(APT, f))) { console.error(`skin-project: ${id} has no ${f}`); process.exit(2); }
const RULE = readJson(path.join(ROOT, 'fidelity.json'));
const MAX_ATTEMPTS = Number(opt('--max-attempts', RULE.max_attempts || 3));
const SOFT = Number(opt('--soft', '40')), HARD = Number(opt('--hard', '60'));
const MODEL = opt('--model', 'gpt25');
const DRY = has('--dry');
const plan = readJson(path.join(APT, 'plan.general.json'));
const scenesDoc = readJson(path.join(APT, 'scenes.json'));
const cams = readJson(path.join(APT, 'cameras.json'));
const interiorAssets = scenesDoc.scenes.filter((s) => s.kind !== 'exterior' && !s.exterior && /^\d\d-/.test(s.asset));
const want = opt('--scenes') ? opt('--scenes').split(',') : interiorAssets.map((s) => s.asset);

// ── keys by name: the children read FAL_KEY from the process env (no worktree has a .env of its own). OPENROUTER_API_KEY is NOT passed:
// the judges then go through fal's router (chat-transport.mjs), the one account this machine keeps funded.
if (!process.env.FAL_KEY) { const e = loadEnv(opt('--env-root', process.env.HABAIT_ENV_ROOT || 'C:/RnD/Projects/Habait/habait-walkaround')); if (e.FAL_KEY) process.env.FAL_KEY = e.FAL_KEY; }
if (!process.env.FAL_KEY && !DRY) { console.error('skin-project: FAL_KEY missing (by name: the environment or <env-root>/.env)'); process.exit(2); }
const childEnv = { ...process.env }; delete childEnv.OPENROUTER_API_KEY;

// ── the money: the apartment ledger (the tools reserve there before every call) and the job's spend window
const ledger = fileLedger(path.join(LOCAL, 'ledger.json'));
const T0 = ledger.total();
const jobLedgerFile = path.join(OUT, 'ledger.json');
let mirrored = ledger.load().rows.length;
const spent = () => +(ledger.total() - T0).toFixed(4);
const capAbs = () => +(T0 + HARD).toFixed(2);   // the absolute --cap every tool refuses past
function mirror(tag) {
  const rows = ledger.load().rows; const fresh = rows.slice(mirrored); mirrored = rows.length;
  if (!fresh.length) return;
  const j = fs.existsSync(jobLedgerFile) ? readJson(jobLedgerFile) : { $schema: 'tour360/ledger.v1', note: 'the job ledger; skin.* rows mirror the apartment ledger, where each call was reserved before it was sent', rows: [] };
  for (const r of fresh) j.rows.push({ seq: j.rows.length + 1, ts: r.at || r.ts, op: `skin.${r.op || tag}`, apartment: id, scene: r.scene, model: r.model, inputs_hash: r.inputs_hash, reserved_usd: r.reserved_usd, settled_usd: r.settled_usd ?? null, status: r.status, source: 'apartments/<id>/_local/ledger.json' });
  writeJson(jobLedgerFile, j);
}
function budget(booked, what) {
  if (spent() + booked > HARD) { stopReport(3, `hard cap: ${what} (booked $${booked}) would take the job's spend $${spent()} past $${HARD}`); }
  if (spent() + booked > SOFT && !has('--past-soft')) { stopReport(4, `soft checkpoint: the job has spent $${spent()} of the $${SOFT} soft cap; ${what} not sent. Re-run with --past-soft to continue (cached answers cost $0)`); }
}

// ── running a tool
function tool(name, args, { timeoutS = 600 } = {}) {
  const r = spawnSync('node', [path.join(TOOLS, name), ...args], { cwd: REPO, encoding: 'utf8', env: childEnv, maxBuffer: 64 * 1024 * 1024, timeout: timeoutS * 1000, windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  fs.appendFileSync(path.join(OUT, 'skin.log'), `\n$ ${name} ${args.join(' ')}\n${out}`);
  mirror(name);
  return { status: r.status, out };
}
const lastLine = (out, re) => { const m = out.split('\n').map((l) => l.match(re)).filter(Boolean); return m.length ? m[m.length - 1] : null; };

// ── state
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(GEN, { recursive: true });
const picksFile = path.join(LOCAL, 'picks.json');
const readPicks = () => (fs.existsSync(picksFile) ? readJson(picksFile) : {});
const setPick = (asset, file) => { const p = readPicks(); p[asset] = file; writeJson(picksFile, p); };
const report = { $schema: 'tour360/skin-report.v1', apartment: id, started: new Date().toISOString(), rule: { max_deviation_pct: RULE.max_deviation_pct, max_attempts: MAX_ATTEMPTS }, model: MODEL, caps: { soft: SOFT, hard: HARD }, scenes: {}, consistency: null, finishes: {}, spend_usd: 0, verdict: null };
function save() { report.spend_usd = spent(); writeJson(path.join(LOCAL, 'skin-report.json'), report); writeJson(path.join(OUT, 'skin-report.json'), report); }
function stopReport(code, why) { report.verdict = code === 3 ? 'HARD-CAP' : code === 4 ? 'SOFT-CHECKPOINT' : report.verdict; report.stopped = why; save(); console.error(`skin-project: ${why}`); process.exit(code); }

// ── the house style (image 3) and the floor finishes (videos.json), from the template — never per-project words
const styleRef = path.join(LOCAL, 'refs', 'style-living.png');
if (!fs.existsSync(styleRef)) { fs.mkdirSync(path.dirname(styleRef), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'house-style', 'style-living.png'), styleRef); }
const videosFile = path.join(APT, 'videos.json');
if (!fs.existsSync(videosFile)) {
  const ref = readJson(path.join(ROOT, 'apartments', 'apt846', 'videos.json'));   // parity-ok: the house floor finishes are Rainbow's (parity #5)
  writeJson(videosFile, { $schema: 'tour360/videos.v1', note: `written by tools/skin-project.mjs: the house floor finishes (no video), ${new Date().toISOString().slice(0, 10)}`, floors: ref.floors, defaultFloor: ref.defaultFloor, sets: Object.fromEntries(ref.floors.map((f) => [f.id, { rooms: {} }])) });
}
const FLOORS = has('--no-floors') ? [] : (opt('--floors') ? opt('--floors').split(',') : readJson(videosFile).floors.map((f) => f.id));

// ── the sight-line map ($0): which scenes see which room's elements (consistency-check.mjs --list, the same sight-line code the judge
// uses — one code path). Every room with fixtures is one group; the kitchen keeps its own judge (hob / sink / tall column by the plan).
// The group's HOME scene is the camera inside that room; every other scene that sees the group gets the home's passed picture as a
// reference, so the element is painted once and copied (Eliran 2026-11-05: consistency «זה כלל שצריך להיות גם בתוצאות מהפורטל»).
const SEE_CM = Number(opt('--see-cm', '700'));   // farther than this a piece is a few pixels: not a reference, not judged
const camOf = (asset) => cams.scenes.find((s) => s.asset === asset);
const roomOf = (asset) => { const c = plan.camera_points.find((p) => p.id.toLowerCase() === `cp-${camOf(asset)?.id}`.toLowerCase()); return c ? plan.rooms.find((r) => r.id === c.room_id) : null; };
const anchorCam = opt('--anchor') || (cams.scenes.find((s) => s.id === 'living') || cams.scenes.find((s) => s.type === 'living') || cams.scenes[0]).id;
const anchorAsset = cams.scenes.find((s) => s.id === anchorCam)?.asset;
// the groups are consistency-check.mjs's own (--all-groups: one per room with fixtures, named by the room, plus the terrace railing —
// the same groups fork A judges on Rainbow), listed for $0 with --list
const groupRoomName = (rid) => { const r = plan.rooms.find((x) => x.id === rid) || {}; return r.type === 'kitchen' ? 'kitchen' : String(rid).replace(/^r-/, ''); };
const groups = [];
{
  const r = tool('consistency-check.mjs', [id, '--all-groups', '--list']);
  for (const l of r.out.split(/\r?\n/).filter((x) => x.startsWith('{'))) {
    let j = null; try { j = JSON.parse(l); } catch { continue; }
    const near = j.views.filter((v) => v.dist <= SEE_CM && want.includes(v.asset));
    const homeScene = cams.scenes.find((s) => { const rm = roomOf(s.asset); return rm && groupRoomName(rm.id) === j.group; });
    const room = homeScene ? roomOf(homeScene.asset) : null;
    if (near.length >= 2) groups.push({ group: j.group, room: room?.id || null, name: room?.name_en || j.group.replace(/-/g, ' '), home: homeScene?.asset || null, viewers: near.map((v) => v.asset), dist: Object.fromEntries(near.map((v) => [v.asset, v.dist])) });
  }
}
report.sight_lines = groups.map(({ group, home, viewers }) => ({ group, home, viewers }));
// the order: the anchor, then the scenes whose elements the most other scenes see (their passed pictures become references), then the rest
const homeRank = (a) => groups.filter((g) => g.home === a).reduce((n, g) => n + g.viewers.length, 0);
const order = [anchorAsset, ...[...want].sort((x, y) => homeRank(y) - homeRank(x))].filter((a, i, arr) => a && want.includes(a) && arr.indexOf(a) === i);
const finalOf = (camId) => path.join(LOCAL, 'skins', `${camId}__final.png`);
const passedPick = (asset) => { const s = report.scenes[asset]; return s && s.verdict === 'PASS' && s.pick ? path.join(GEN, s.pick) : null; };

function prompts(asset) {
  const r = tool('make-skin-prompts.mjs', [id, '--roll', 'auto', '--anchor', anchorCam]);
  if (r.status !== 0) { report.scenes[asset].error = `make-skin-prompts exited ${r.status}`; return false; }
  const f = path.join(APT, 'skin-prompts.json'); const sp = readJson(f);
  const e = sp.find((x) => x.id === asset);
  if (e) {
    // the home pictures of every group this scene sees from outside (nearest first, at most 3 — the model takes 4–6 images well)
    const refs = groups.filter((g) => g.viewers.includes(asset) && g.home && g.home !== asset && passedPick(g.home))
      .sort((x, y) => x.dist[asset] - y.dist[asset]).slice(0, 3);
    const lines = [];
    for (const g of refs) {
      const rel = path.relative(APT, passedPick(g.home)).split(path.sep).join('/');
      if (!e.references.includes(rel)) e.references.push(rel);
      const n = e.references.indexOf(rel) + 1;
      lines.push(g.group === 'kitchen'
        ? `The kitchen in this view is EXACTLY the kitchen of Image ${n}: the same fronts, worktop, splashback, shelves, hob, sink and tall column, at the same place.`
        : `Every piece of the ${g.name.toLowerCase()} visible in this view is EXACTLY as in Image ${n}: the same pieces, materials, colours, shapes and places, and the same floor.`);
    }
    if (lines.length) e.prompt += ' ' + lines.join(' ');
    e.consistency_refs = refs.map((g) => g.group);
  }
  writeJson(f, sp);
  return true;
}
function generate(asset, seed) {
  budget(MODEL === 'gpt25' ? 0.6 : 2.4, `${asset} skin seed ${seed}`);
  const r = tool('gen-pano.mjs', [id, asset, MODEL, '--prompts', 'skin-prompts.json', '--seed', String(seed), '--cap', String(capAbs()), ...(DRY ? ['--dry'] : [])]);
  if (r.status === 3) stopReport(3, `gen-pano refused ${asset}: the hard cap`);
  if (DRY) { const c = lastLine(r.out, /^(cache hit \(\$0\)): (\S+)/); const b = lastLine(r.out, /booked \$([\d.]+)/); return { dry: true, cached: !!c, booked: b ? Number(b[1]) : null, refs: (readJson(path.join(APT, 'skin-prompts.json')).find((e) => e.id === asset) || {}).references }; }
  const m = lastLine(r.out, /^(?:ok|cache hit \(\$0\)|finished from the saved raw answer, no call): (\S+)/);
  if (r.status !== 0 || !m) return null;
  const file = path.basename(m[1]); setPick(asset, file); return file;
}
function seam(asset) {
  const d = tool('close-seam.mjs', [id, asset, '--lite', '--dry', '--cap', String(capAbs())]);
  const m = lastLine(d.out, /seam step before ([\d.]+) \(neighbours ([\d.]+)\)/);
  if (!m) return { skipped: 'no measure' };
  const wrap = Number(m[1]), base = Number(m[2]);
  if (wrap <= Math.max(6, 2.5 * base)) return { wrap, base, closed: false };
  if (DRY) return { wrap, base, closed: 'dry' };
  budget(0.6, `${asset} seam close`);
  const before = readPicks()[asset];
  const r = tool('close-seam.mjs', [id, asset, '--lite', '--pick', '--cap', String(capAbs())]);
  const a = lastLine(r.out, /the seam step ([\d.]+) → ([\d.]+)/);
  if (r.status !== 0 || !a) { setPick(asset, before); return { wrap, base, closed: false, error: `close-seam exited ${r.status}` }; }
  if (Number(a[2]) >= Number(a[1])) { setPick(asset, before); return { wrap, base, closed: false, tried: `${a[1]} → ${a[2]} (worse, kept the original)` }; }
  return { wrap, base, closed: true, after: Number(a[2]) };
}
function gate(asset, args = ['--set', 'picks']) {
  if (DRY) { tool('fidelity-gate.mjs', [id, '--scenes', asset, ...args, '--dry']); return { verdict: 'DRY' }; }
  budget(0.01, `${asset} gate`);
  const r = tool('fidelity-gate.mjs', [id, '--scenes', asset, ...args], { timeoutS: 900 });
  const g = readJson(path.join(LOCAL, 'fidelity', 'gate.json'));
  const row = [...g.rows].reverse().find((x) => x.asset === asset);
  if (r.status === 2 || !row) return { verdict: 'ERROR', note: r.out.trim().split('\n').slice(-2).join(' | ').slice(0, 300) };
  return row;
}
// a deviation the skin cannot fix: the trace or the CG itself (fidelity.json fix_loop step 4)
const traceSide = (row) => row.verdict === 'UNRESOLVED' || (!(row.findings || []).length && row.verdict === 'FAIL');
function bandRepair(asset, row, k) {
  const scene = scenesDoc.scenes.find((s) => s.asset === asset); const cb = scene.centreBearingDeg ?? 0;
  const worst = [...(row.findings || [])].sort((a, b) => b.width_cm - a.width_cm)[0];
  if (!worst) return false;
  const rel = ((worst.at_bearing - cb + 540) % 360) - 180; const u = +((0.5 + rel / 360 + 1) % 1).toFixed(4);
  const band = Math.max(12, Math.min(60, Math.round(worst.deg + 10)));
  budget(0.6, `${asset} band repair ${k}`);
  const extra = worst.direction.startsWith('farther')
    ? 'Inside the band follow Image 2 (the CG render of this camera) exactly: where Image 2 shows a solid wall there is a solid painted wall, never glass, a window, a doorway or an opening; glass only where Image 2 shows glass. Keep the finishes, light and furniture style of Image 1.'
    : 'Inside the band follow Image 2 (the CG render of this camera) exactly: the room continues as far as Image 2 shows it, with no added wall, end, partition or furniture closing it off. Keep the finishes, light and furniture style of Image 1.';
  const r = tool('close-seam.mjs', [id, asset, '--lite', '--pick', '--u', String(u), '--band-deg', String(band), '--extra', extra, '--cap', String(capAbs())]);
  return r.status === 0;
}

// ── 1–5: every scene through the fix loop
for (const asset of order) {
  const cam = camOf(asset); if (!cam) { report.scenes[asset] = { verdict: 'ERROR', error: 'no camera' }; continue; }
  report.scenes[asset] = { camera: cam.id, attempts: [] }; save();
  const S = report.scenes[asset];
  let row = null;
  for (let k = 1; k <= MAX_ATTEMPTS; k++) {
    const att = { attempt: k };
    if (k === 1 || row?.verdict === 'STALE' || k === 2) {
      if (!prompts(asset)) break;
      const file = generate(asset, 6 + k);   // seed 7 first (the Rainbow seed), then 8, 9 …
      if (!file) { att.error = 'gen-pano produced no answer'; S.attempts.push(att); break; }
      if (file.dry) { att.dry = file; S.attempts.push(att); row = { verdict: 'DRY' }; break; }
      att.generated = file; att.seam = seam(asset);
    } else {
      att.band_repair = bandRepair(asset, row, k);
      if (!att.band_repair) { att.error = 'no band to repair'; S.attempts.push(att); break; }
    }
    row = gate(asset);
    att.gate = { verdict: row.verdict, deviation_pct: row.deviation_pct, resolution_pct: row.resolution_pct, findings: (row.findings || []).length, cg_pct: row.cg_vs_plan?.pct ?? null, dims: row.dims || null, evidence: row.evidence };
    att.pick = readPicks()[asset]; S.attempts.push(att); save();
    console.log(`${asset} attempt ${k}: ${row.verdict} ${row.deviation_pct ?? ''}%`);
    if (row.verdict === 'PASS' || row.verdict === 'DRY') break;
    if (row.verdict !== 'STALE' && traceSide(row)) { S.trace_side = `the deviation is in the trace or the CG, not the skin (${row.verdict}; dims ${JSON.stringify(row.dims || {})}; cg ${row.cg_vs_plan?.pct ?? '–'}%): fix the trace and re-render`; break; }
  }
  S.verdict = row ? row.verdict : 'ERROR'; S.deviation_pct = row?.deviation_pct ?? null; S.pick = readPicks()[asset];
  if (S.verdict === 'PASS' || S.verdict === 'DRY') {
    fs.mkdirSync(path.join(LOCAL, 'skins'), { recursive: true });
    if (!DRY && asset === anchorAsset) fs.copyFileSync(path.join(GEN, S.pick), finalOf(cam.id));   // image 2 of every other scene (make-skin-prompts)
  }
  save();
}

// ── 6: every element seen from more than one scene is the same element (the judge's list must be empty); a FAIL regenerates the
// other viewers (they carry the home's picture); a regenerated scene that no longer passes the gate is put back
const passed = () => order.filter((a) => ['PASS', 'DRY'].includes(report.scenes[a]?.verdict));
report.consistency = {};
for (const g of DRY ? [] : groups) {
  const C = report.consistency[g.group] = { home: g.home, rounds: [] };
  for (let round = 1; round <= 3; round++) {
    const viewers = g.viewers.filter((a) => passed().includes(a));
    if (viewers.length < 2) { C.verdict = 'NOT-COMPARABLE'; C.note = `${viewers.length} passed viewer(s)`; break; }
    budget(0.02, `${g.group} consistency judge`);
    const c = tool('consistency-check.mjs', [id, '--group', g.group, '--set', 'picks', '--judge', '--scenes', viewers.join(',')], { timeoutS: 900 });
    const line = lastLine(c.out, /^judge .*?: (PASS|FAIL) — (.*)$/);
    C.verdict = c.status === 0 ? 'PASS' : c.status === 2 ? 'NOT-COMPARABLE' : 'FAIL';
    C.rounds.push({ round, viewers, verdict: C.verdict, note: line ? line[2].slice(0, 500) : c.out.trim().split('\n').slice(-1)[0] }); save();
    if (C.verdict !== 'FAIL' || round === 3) break;
    for (const a of viewers.filter((x) => x !== g.home)) {
      const keep = readPicks()[a];
      prompts(a); const f = generate(a, 20 + round); if (!f) continue; seam(a); const gt = gate(a);
      report.scenes[a].attempts.push({ attempt: `consistency-${g.group}-${round}`, generated: f, gate: { verdict: gt.verdict, deviation_pct: gt.deviation_pct } });
      if (gt.verdict === 'PASS') report.scenes[a].pick = readPicks()[a]; else setPick(a, keep);
      save();
    }
  }
}
const consistencyOk = Object.values(report.consistency).every((c) => c.verdict !== 'FAIL');

// ── 7: the web sets from the picks, then the gate on the exact bytes the build ships
if (!DRY) {
  const ms = tool('make-sets.mjs', [id]);
  report.sets = ms.status === 0 ? 'ok' : `make-sets exited ${ms.status}`;
  for (const a of passed()) { const g = gate(a, ['--set', 'balanced']); report.scenes[a].balanced = { verdict: g.verdict, deviation_pct: g.deviation_pct }; if (g.verdict !== 'PASS') report.scenes[a].verdict = `BALANCED-${g.verdict}`; }
  save();
}

// ── 8: the floor finishes of every passing scene, each gated, retried
for (const a of DRY ? [] : passed()) {
  report.finishes[a] = {};
  for (const fl of FLOORS) {
    const F = report.finishes[a][fl] = { attempts: [] };
    for (let k = 1; k <= MAX_ATTEMPTS; k++) {
      budget(0.61, `${a} ${fl} finish ${k}`);
      const r = tool('finish-pano.mjs', [id, a, fl, '--cap', String(capAbs()), ...(k > 1 ? ['--seed', String(6 + k)] : [])]);   // fork A's --seed: a fresh answer under its own hash
      if (r.status === 3) stopReport(3, `finish-pano refused ${a} ${fl}: the hard cap`);
      if (r.status !== 0) { F.attempts.push({ k, error: `finish-pano exited ${r.status}` }); break; }
      const g = gate(a, ['--skin', path.join(LOCAL, `panos-${fl}`, `${a}.webp`)]);
      F.attempts.push({ k, verdict: g.verdict, deviation_pct: g.deviation_pct, findings: (g.findings || []).length });
      F.verdict = g.verdict; save();
      if (g.verdict === 'PASS') break;
    }
  }
}

const allScenes = order.every((a) => ['PASS', 'DRY'].includes(report.scenes[a]?.verdict));
const allFinishes = Object.values(report.finishes).every((fs_) => Object.values(fs_).every((f) => f.verdict === 'PASS'));
report.verdict = DRY ? 'DRY' : allScenes && allFinishes && consistencyOk ? 'PASS' : 'FAIL';
report.finished = new Date().toISOString(); save();
console.log(`skin-project ${id}: ${report.verdict} · ${order.length} scenes · spend $${spent().toFixed(2)} (soft $${SOFT}, hard $${HARD}) · report ${path.relative(REPO, path.join(LOCAL, 'skin-report.json'))}`);
process.exit(report.verdict === 'PASS' || report.verdict === 'DRY' ? 0 : 1);
