#!/usr/bin/env node
/* Habait Tour360 — tools/close-seam.mjs (WALKAROUND-QUALITY-PLAN.md OQ-2, D-WQ-33 step 3/4, 2026-10-29): close a skin's wrap seam.
   A generative skin does not join its own left and right edges (the living room's armchair and island were cut at the entrance).
   The close: the picked final and its CG render are rolled half a turn so the wrap edge sits at the centre column; a mask marks a
   band of --band-deg (default 12°) around it; GPT Image 2.5's edit is asked to repaint ONLY the band so floor, walls and furniture
   continue across it, with the rolled CG as Image 2 for the true geometry inside the band; the answer's band is pasted back onto the
   rolled final with a feathered edge (nothing outside the band changes, whatever the model returned), the picture is rolled back and
   saved as a new generated answer; --pick makes it the scene's pick (tools/make-sets.mjs then carries it).
   Money: one ledgered call per close (booked $2.40, reserve-and-settle in _local/ledger.json under --cap, as gen-pano.mjs); the
   inputs hash names the output, so a re-run of the same close is $0. FAL_KEY by name, never printed. Prints the seam step before and
   after (openings-test.mjs's measure) and writes a before/after strip beside the answer for the eye.
   2026-11-01 (habait-de): the close now rolls the skin's OWN join to the centre — for a rolled skin (make-skin-prompts.mjs --roll auto)
   that is u = roll.u_edge (tools/skin-seam.mjs), not x 0; before, every rolled room's close repainted a column inside the answer and
   left the real cut. An unrolled skin (u 0) rolls by exactly half as before, so its inputs hash and its cached answers are unchanged.
     timeout 540 node Habait/tour360/tools/close-seam.mjs <apartment> <asset> [--band-deg 12] [--cap USD] [--dry] [--pick] [--no-cg] [--u <u>] [--extra "<words>"]
   --extra appends room-specific words to the prompt (e.g. "no plant in front of the open view"); absent, the prompt and hash are as before. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';
import { skinSeamU } from './skin-seam.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const HARNESS = path.resolve(TOUR, '..', '..');
const sharp = appRequire(HARNESS)('sharp');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VALUE_FLAGS = ['--band-deg', '--cap', '--u', '--extra', '--cg-tour'];
const [aptId, asset] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
if (!aptId || !asset) { console.error('usage: close-seam.mjs <apartment> <asset> [--band-deg 12] [--cap USD] [--dry] [--pick]'); process.exit(2); }
const bandDeg = Number(flag('--band-deg') || 12);
const capFlag = Number(flag('--cap') || 0);
const HARD_USD = capFlag > 0 ? capFlag : 10, SOFT_USD = capFlag > 0 ? capFlag / 2 : 5;
const dry = args.includes('--dry'), pick = args.includes('--pick');
// 2026-11-01 (Eliran): --no-cg closes the seam without the CG render (Image 2) when the renders are not on this machine; the band is then
// repainted from the final alone — the prompt asks for continuity only, and the inputs hash carries no CG.
const noCg = args.includes('--no-cg');
// --lite (2026-11-04, fix-846-fidelity): the site ships the 2048×1024 balanced set, so a 2048 skin is closed at 2048 (booked $0.60, the
// gpt25 lane of gen-pano.mjs) instead of 4096 ($2.40); the hash carries the size, so a lite close never collides with a full one.
const LITE = args.includes('--lite');
const ENDPOINT = 'openai/gpt-image-2.5/sunburst/edit', USD = LITE ? 0.6 : 2.4, SIZE = LITE ? { width: 2048, height: 1024 } : { width: 4096, height: 2048 };

const APT = path.join(TOUR, 'apartments', aptId);
const GEN = path.join(APT, '_local', 'generated');
const picksFile = path.join(APT, '_local', 'picks.json');
const picks = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, 'utf8')) : {};
if (!picks[asset]) { console.error(`${asset}: no pick in _local/picks.json`); process.exit(2); }
const finalFile = path.join(GEN, picks[asset]);
const scenes = JSON.parse(fs.readFileSync(path.join(APT, 'scenes.json'), 'utf8')).scenes;
const scene = scenes.find((s) => s.asset === asset);
if (!scene) { console.error(`${asset}: no scene carries this asset`); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.join(APT, 'plan.general.json'), 'utf8'));
const cam = plan.camera_points.find((c) => c.id.toLowerCase() === `cp-${scene.id}`.toLowerCase());
if (!cam) { console.error(`${asset}: no camera point cp-${scene.id} in the plan`); process.exit(2); }
const cgFile = path.resolve(HARNESS, '360walkaround', 'tours', flag('--cg-tour') || aptId, 'renders', cam.id, 'pano.webp');
if (!noCg && !fs.existsSync(cgFile)) { console.error(`${asset}: no CG render at ${cgFile} (pass --no-cg to close without it)`); process.exit(2); }
if (noCg) console.warn(`${asset}: closing WITHOUT the CG render (--no-cg)`);
const roomEn = (scene.name && scene.name.en) || scene.id;

// --- the pictures, rolled so the skin's own join sits at the centre column (half a turn for an unrolled skin)
const meta = await sharp(finalFile).metadata(); const W = meta.width, H = meta.height, half = W / 2;
if (Math.abs(W / H - 2) > 0.01) { console.error(`${asset}: ${W}x${H} is not 2:1`); process.exit(2); }
const seam = flag('--u') != null ? { u: Number(flag('--u')), from: '--u' } : skinSeamU(APT, finalFile, { asset });
const xs = Math.round(seam.u * W) % W, dx = (((half - xs) % W) + W) % W;
// shift right by d px, wrapping (d = half is the old half-turn roll, byte for byte)
const shift = async (input, d) => { d = ((d % W) + W) % W; if (!d) return sharp(input).png().toBuffer(); const A = await sharp(input).extract({ left: W - d, top: 0, width: d, height: H }).toBuffer(); const B = await sharp(input).extract({ left: 0, top: 0, width: W - d, height: H }).toBuffer(); return sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: d, top: 0 }]).png().toBuffer(); };
const roll = (input) => shift(input, dx), unroll = (input) => shift(input, W - dx);
const finalRolled = await roll(finalFile);
const cgRolled = noCg ? null : await roll(await sharp(cgFile).resize({ width: W, height: H, fit: 'fill' }).png().toBuffer());
const bandPx = Math.round((bandDeg / 360) * W), b0 = half - Math.floor(bandPx / 2), b1 = b0 + bandPx;
const mask = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite([{ input: { create: { width: bandPx, height: H, channels: 3, background: '#fff' } }, left: b0, top: 0 }]).png().toBuffer();

// --- the seam step, openings-test.mjs's measure (8-px strips, rows 25–85 %, against neighbouring strips), at the skin's own join
const seamStep = async (buf) => { const { data: g, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true }); const Wd = info.width, Hd = info.height, r0 = Math.floor(Hd * 0.25), r1 = Math.floor(Hd * 0.85), S = 8, xj = Math.round(seam.u * Wd) % Wd;
  const strip = (r, c0) => { let s = 0; for (let c = c0; c < c0 + S; c++) s += g[r * Wd + (((c % Wd) + Wd) % Wd)]; return s / S; };
  let wrap = 0, n = 0; for (let r = r0; r < r1; r += 2) { wrap += Math.abs(strip(r, xj) - strip(r, xj - S)); n++; }
  let base = 0, m = 0; for (let r = r0; r < r1; r += 8) for (let c = 64; c < Wd - 64; c += 97) { base += Math.abs(strip(r, c - S) - strip(r, c)); m++; }
  return { wrap: +(wrap / n).toFixed(2), base: +(base / m).toFixed(2) }; };
const before = await seamStep(fs.readFileSync(finalFile));
console.log(`${aptId}/${asset} (${roomEn}, ${cam.id}): ${W}x${H}, the skin's join at u ${seam.u} (x ${xs}, ${seam.from}); the seam step before ${before.wrap} (neighbours ${before.base}); band ${bandDeg}° = ${bandPx} px at ${b0}..${b1}`);

const prompt = `Image 1 is a 360-degree equirectangular photograph (2:1) of the ${roomEn} of a real apartment, rotated half a turn so that the picture's original left and right edges now meet along a vertical line at the centre; the white band of the mask covers that join. Repaint ONLY inside the band so that the floor, the walls, the ceiling and every object cross it continuously from the left side to the right side with no visible join: the same materials, the same light, the same furniture continued through the band. ${noCg ? 'Inside the band continue exactly what touches it on both sides (the same wall, counter, floor tiles and grout lines, ceiling, window frames or furniture) and add no new object.' : 'Image 2 is the plain computer render of the same room at the same rotation: inside the band it shows the true walls, openings, floor and furniture placeholders; follow its geometry and add no object the render does not show.'} Keep everything outside the band exactly as it is. No text, no people, no watermark.${flag('--extra') ? ' ' + flag('--extra') : ''}`;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hash = sha(JSON.stringify({ e: ENDPOINT, p: prompt, f: sha(finalRolled), c: cgRolled ? sha(cgRolled) : null, m: sha(mask), ...(LITE ? { s: SIZE } : {}) })).slice(0, 12);
const outFile = path.join(GEN, `${asset}__seam__s7__${hash}.png`);
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
const rawFile = outFile.replace(/\.png$/, '.raw.png');

async function finish(answerPng) {
  // the answer's band, resized to our frame if the model answered another size, pasted with a 24-px linear feather on each side
  const a = await sharp(answerPng).resize({ width: W, height: H, fit: 'fill' }).removeAlpha().raw().toBuffer();
  const f = await sharp(finalRolled).removeAlpha().raw().toBuffer();
  const F = 24; const out = Buffer.from(f);
  for (let y = 0; y < H; y++) for (let x = b0 - F; x < b1 + F; x++) { if (x < 0 || x >= W) continue; const w = x < b0 ? (x - (b0 - F)) / F : x >= b1 ? ((b1 + F) - x) / F : 1; const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) out[i + c] = Math.round(f[i + c] * (1 - w) + a[i + c] * w); }
  const merged = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const unrolled = await unroll(merged);
  fs.writeFileSync(outFile, unrolled);
  const after = await seamStep(unrolled);
  // the strip for the eye: the centre of the rolled picture before and after, side by side
  const cw = Math.floor(W * 0.22), ch = Math.floor(H * 0.6), top = Math.floor(H * 0.22);
  const sb = await sharp(finalRolled).extract({ left: half - Math.floor(cw / 2), top, width: cw, height: ch }).resize({ width: 700 }).toBuffer();
  const sa = await sharp(merged).extract({ left: half - Math.floor(cw / 2), top, width: cw, height: ch }).resize({ width: 700 }).toBuffer();
  const sbm = await sharp(sb).metadata();
  await sharp({ create: { width: 1420, height: sbm.height, channels: 3, background: '#222' } }).composite([{ input: sb, left: 0, top: 0 }, { input: sa, left: 720, top: 0 }]).jpeg({ quality: 86 }).toFile(outFile.replace(/\.png$/, '.strip.jpg'));
  console.log(`ok: ${path.relative(TOUR, outFile)} — the seam step ${before.wrap} → ${after.wrap} (neighbours ${after.base}); strip ${path.basename(outFile).replace(/\.png$/, '.strip.jpg')}`);
  if (pick) { picks[asset] = path.basename(outFile); fs.writeFileSync(picksFile, JSON.stringify(picks, null, 1)); console.log(`pick: ${asset} → ${path.basename(outFile)}`); }
  return after;
}

if (fs.existsSync(outFile)) { console.log(`cache hit ($0): ${path.relative(TOUR, outFile)}`); if (pick) { picks[asset] = path.basename(outFile); fs.writeFileSync(picksFile, JSON.stringify(picks, null, 1)); console.log(`pick: ${asset} → ${path.basename(outFile)}`); } process.exit(0); }
if (fs.existsSync(rawFile)) { await finish(fs.readFileSync(rawFile)); const d = ledger.load(); d.rows.forEach((x, i) => { if (x.inputs_hash === hash && x.status === 'reserved') ledger.settle(i, x.reserved_usd, { status: 'ok', out: path.relative(APT, outFile), note: 'finished locally from the saved raw answer' }); }); process.exit(0); }
const spent = ledger.total();
console.log(`close-seam via ${ENDPOINT} — booked $${USD.toFixed(2)}; ledger so far $${spent.toFixed(2)} (soft $${SOFT_USD}, hard $${HARD_USD})`);
if (spent + USD > HARD_USD) { console.error('close-seam: REFUSED — this call would cross the hard cap'); process.exit(3); }
if (spent + USD > SOFT_USD) console.warn('close-seam: WARNING — past the soft cap; Slava is told before the next call');
if (dry) { fs.mkdirSync(GEN, { recursive: true }); await sharp(mask).resize({ width: 960 }).png().toFile(path.join(GEN, `${asset}__seam__mask-preview.png`)); console.log('dry run: no call made; the mask preview written beside the answers'); process.exit(0); }

let env = loadEnv(HARNESS);
for (let dir = HARNESS, i = 0; !env.FAL_KEY && i < 5; i++) { dir = path.dirname(dir); env = loadEnv(dir); }
if (!env.FAL_KEY) { console.error('close-seam: FAL_KEY missing (read by name from the environment or a root .env)'); process.exit(1); }
const doc = ledger.load(); if (doc.cap_usd !== HARD_USD) { doc.cap_usd = HARD_USD; doc.soft_usd = SOFT_USD; ledger.save(doc); }
const row = ledger.reserve({ at: new Date().toISOString(), apartment: aptId, scene: `${asset}-seam`, model: ENDPOINT, seed: 7, inputs_hash: hash, reserved_usd: USD, status: 'reserved' });
const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
let res, json;
try {
  res = await fetch(`https://fal.run/${ENDPOINT}`, {
    method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_urls: cgRolled ? [uri(finalRolled), uri(cgRolled)] : [uri(finalRolled)], mask_url: uri(mask), image_size: SIZE, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }),
    signal: AbortSignal.timeout(300000),
  });
  json = await res.json().catch(() => ({}));
} catch (e) { ledger.settle(row, USD, { status: 'error-unknown-billing', note: String(e.message).slice(0, 160) }); console.error('close-seam: call failed before an answer; booked at the worst case:', String(e.message).slice(0, 160)); process.exit(1); }
if (!res.ok) { ledger.settle(row, 0, { status: `http-${res.status}`, note: JSON.stringify(json).slice(0, 200) }); console.error(`close-seam: HTTP ${res.status}`, JSON.stringify(json).slice(0, 300)); process.exit(1); }
const img = json.images?.[0];
if (!img?.url) { ledger.settle(row, USD, { status: 'billed-no-image', note: JSON.stringify(json).slice(0, 200) }); console.error('close-seam: no image in the answer'); process.exit(1); }
const bytes = img.url.startsWith('data:') ? Buffer.from(img.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
fs.mkdirSync(GEN, { recursive: true });
fs.writeFileSync(rawFile, bytes);
ledger.settle(row, USD, { status: 'billed-raw-saved' });
const after = await finish(bytes);
ledger.settle(row, USD, { status: 'ok', out: path.relative(APT, outFile), width: W, height: H, note: `seam ${before.wrap} -> ${after.wrap}` });
console.log(`ledger now $${ledger.total().toFixed(2)}`);
