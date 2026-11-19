#!/usr/bin/env node
/* Habait Tour360 — tools/finish-pano.mjs (fix-846-fidelity, 2026-11-04). The floor-finish variant of ONE scene's picked panorama, the
   same edit as Habait/studio/_local/pano_floors.mjs (Eliran 2026-11-01: «מאשר תמיד»; the three finishes of apt846): one whole-image
   GPT Image 2.5 edit at 2048×1024 that changes the floor (and only the finishes pano_floors changes), every wall, opening and piece at
   the same pixel. It exists because a re-generated scene (a fidelity fix) makes its old finish variants wrong: they still show the old
   structure. Output: apartments/<id>/_local/panos-<floor>/<asset>.webp (the set build-tour carries when videos.json names it) and the
   PNG answer in _local/generated/<asset>__floor-<floor>__s7__<hash>.png. Money: reserve before send ($0.60 booked, the gpt25 lane of
   gen-pano.mjs), settle after, in _local/ledger.json; --cap refuses a call past the hard cap. The inputs hash names the answer: a re-run
   is $0. Run tools/fidelity-gate.mjs on the answer before it ships (--skin).
   usage: timeout 540 node Habait/tour360/tools/finish-pano.mjs <apartment> <asset> <parquet|concrete|marble> [--cap USD] [--attempt N] [--dry] */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appRequire } from './app-require.mjs';
import { fileLedger, loadEnv } from './file-ledger.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOUR = path.resolve(HERE, '..');
const REPO = path.resolve(TOUR, '..', '..');
const sharp = appRequire(REPO)('sharp');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const [aptId, asset, floorId] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--cap', '--attempt'].includes(args[i - 1])));
// --attempt N (project-runner fork F, 2026-11-05): the fix loop's next try of a finish the gate failed — the model has no seed, so a new
// attempt number in the inputs hash buys a fresh answer; attempt 1 keeps the old hash (every cached answer stays valid)
const attempt = Math.max(1, Number(flag('--attempt') || 1));
// the words of Habait/studio/_local/floors.mjs (2026-11-01), verbatim
const FLOORS = {
  parquet: 'a wide-plank natural oak parquet floor, matte, pale honey tone, long planks laid lengthwise, no gloss',
  concrete: 'a seamless smooth polished micro-concrete floor in warm light grey, matte, no joints, no tiles, no grout lines',
  marble: 'a seamless smooth honed white marble floor with soft grey veining, book-matched, no visible joints, no grout lines',
};
if (!aptId || !asset || !FLOORS[floorId]) { console.error('usage: finish-pano.mjs <apartment> <asset> <parquet|concrete|marble> [--cap USD] [--dry]'); process.exit(2); }
const HARD = Number(flag('--cap') || 0) || 10, USD = 0.6, ENDPOINT = 'openai/gpt-image-2.5/sunburst/edit';
const APT = path.join(TOUR, 'apartments', aptId);
const GEN = path.join(APT, '_local', 'generated');
const picks = JSON.parse(fs.readFileSync(path.join(APT, '_local', 'picks.json'), 'utf8'));
if (!picks[asset]) { console.error(`${asset}: no pick`); process.exit(2); }
const src = path.join(GEN, picks[asset]);
// pano_floors.mjs prompt(false), verbatim
const prompt = `Image 1 is a 360-degree equirectangular panorama (2:1) of a room in an apartment. Return the SAME equirectangular panorama with EXACTLY the same projection, framing and geometry: every wall, ceiling, window, glass slider, wardrobe, kitchen unit, sanitary fixture and piece of furniture at exactly the same pixel position, the same light and colours, nothing added, removed, moved or resized. Change ONLY these finishes: (1) the floor everywhere becomes ${FLOORS[floorId]}, one continuous surface with no grout lines and no tiles (in bathrooms and on terraces the same floor); (2) every interior door becomes a zero-line flush door in cream, frameless, no architrave, no panels, with a slim matte black lever (a dark blue or wooden door too); (3) remove every skirting board so the floor meets the walls in a clean line; (4) where a kitchen is visible its cabinetry continues to the end of its wall with matching handleless sand-grey lacquer fronts, no bare wall strip. Photoreal, sharp, a very high-end luxury finish. No people, no text, no logos.`;
const input = await sharp(src).resize({ width: 2048, height: 1024, fit: 'fill' }).removeAlpha().png().toBuffer();
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hash = sha(JSON.stringify({ e: ENDPOINT, p: prompt, i: sha(input), s: [2048, 1024], ...(attempt > 1 ? { a: attempt } : {}) })).slice(0, 12);
const outPng = path.join(GEN, `${asset}__floor-${floorId}__s7__${hash}.png`);
const outWebp = path.join(APT, '_local', `panos-${floorId}`, `${asset}.webp`);
const write = async (png) => { fs.mkdirSync(path.dirname(outWebp), { recursive: true }); await sharp(png).resize({ width: 2048, height: 1024, fit: 'fill' }).webp({ quality: 90 }).toFile(outWebp); console.log(`ok: ${path.relative(APT, outPng)} → ${path.relative(APT, outWebp)}`); };
if (fs.existsSync(outPng)) { console.log('cache hit ($0)'); await write(outPng); process.exit(0); }
const ledger = fileLedger(path.join(APT, '_local', 'ledger.json'));
const spent = ledger.total();
console.log(`${asset} → ${floorId} via ${ENDPOINT} (2048, high) — booked $${USD.toFixed(2)}; ledger $${spent.toFixed(2)} (hard $${HARD})`);
if (spent + USD > HARD) { console.error('finish-pano: REFUSED — past the hard cap'); process.exit(3); }
if (args.includes('--dry')) { console.log('dry run: no call'); process.exit(0); }
const env = loadEnv(REPO);
if (!env.FAL_KEY) { console.error('finish-pano: FAL_KEY missing (by name)'); process.exit(2); }
const row = ledger.reserve({ at: new Date().toISOString(), op: 'floor_finish', apartment: aptId, scene: `${asset}-${floorId}`, model: ENDPOINT, seed: 7, inputs_hash: hash, reserved_usd: USD, status: 'reserved' });
let res, j;
try {
  res = await fetch(`https://fal.run/${ENDPOINT}`, { method: 'POST', headers: { Authorization: `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_urls: [`data:image/png;base64,${input.toString('base64')}`], image_size: { width: 2048, height: 1024 }, quality: 'high', num_images: 1, output_format: 'png', sync_mode: true }), signal: AbortSignal.timeout(300000) });
  j = await res.json().catch(() => ({}));
} catch (e) { ledger.settle(row, USD, { status: 'error-unknown-billing', note: String(e.message).slice(0, 120) }); console.error('finish-pano: call failed:', String(e.message).slice(0, 160)); process.exit(1); }
if (!res.ok) { ledger.settle(row, 0, { status: `http-${res.status}`, note: JSON.stringify(j).slice(0, 200) }); console.error(`finish-pano: HTTP ${res.status}`); process.exit(1); }
const img = j.images?.[0];
if (!img?.url) { ledger.settle(row, USD, { status: 'billed-no-image' }); console.error('finish-pano: no image'); process.exit(1); }
const bytes = img.url.startsWith('data:') ? Buffer.from(img.url.split(',')[1], 'base64') : Buffer.from(await (await fetch(img.url)).arrayBuffer());
fs.writeFileSync(outPng, bytes);
ledger.settle(row, USD, { status: 'ok', out: path.relative(APT, outPng) });
await write(outPng);
console.log(`ledger now $${ledger.total().toFixed(2)}`);
