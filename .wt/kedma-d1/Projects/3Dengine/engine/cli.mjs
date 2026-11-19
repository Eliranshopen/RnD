// The engine's command line. Commands that change the disk are dry runs unless --go is given.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, pipelineEnv } from './config.mjs';
import { runDoctor, formatReport } from './doctor.mjs';
import { planEnv, applyEnv } from './setup/env.mjs';
import { planAssets, applyAssets } from './setup/assets.mjs';

export const USAGE = [
  'usage: node engine/cli.mjs <command>',
  '  doctor [--json]                 readiness report (exit 0 = ready, or ready except keys)',
  '  env                             the pipeline pointers as NAME=path lines (never keys)',
  '  setup-env [--go]                Python venv + pinned libraries + Node libraries',
  '  bring-assets [--from <dir>] [--go]   copy the sealed render assets from a backup copy',
  '  help                            this text',
].join('\n');

const DEFAULT_DEPS = { loadConfig, runDoctor, planEnv, applyEnv, planAssets, applyAssets };

function optValue(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`${name} needs a value`);
  return v;
}

const human = (n) => (n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2)} GB` : `${(n / (1 << 20)).toFixed(1)} MB`);

async function doctor(argv, io, d, config) {
  const result = await d.runDoctor(config);
  io.stdout.write((argv.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result)) + '\n');
  return result.ready || result.ready_except_keys ? 0 : 1;
}

function env(argv, io, d, config) {
  for (const [k, v] of Object.entries(pipelineEnv(config))) io.stdout.write(`${k}=${v}\n`);
  return 0;
}

async function setupEnv(argv, io, d, config) {
  const plan = d.planEnv(config);
  for (const s of plan.steps) io.stdout.write(`${s.needed ? 'needed ' : 'ok     '}${s.id.padEnd(6)}${s.cmd} ${s.args.join(' ')}\n`);
  if (!plan.steps.some((s) => s.needed)) {
    io.stdout.write('nothing to do\n');
    return 0;
  }
  if (!argv.includes('--go')) {
    io.stdout.write('dry run: pass --go to run the needed steps\n');
    return 0;
  }
  const r = d.applyEnv(plan, config);
  if (!r.ok) {
    io.stderr.write(`setup-env failed: ${r.reason}\n`);
    return 1;
  }
  io.stdout.write(`done: ${r.ran.join(', ')}\n`);
  return 0;
}

async function bringAssets(argv, io, d, config) {
  const from = optValue(argv, '--from') || config.assets.source;
  const plan = await d.planAssets(config, { from });
  const by = (s) => plan.entries.filter((e) => e.state === s);
  const copy = by('copy');
  const missing = by('missing-in-source');
  io.stdout.write(`from ${plan.from}\npresent ${by('present').length} · copy ${copy.length} ` +
    `(${human(copy.reduce((n, e) => n + e.bytes, 0))}) · missing-in-source ${missing.length}\n`);
  for (const e of missing) io.stdout.write(`missing-in-source ${e.id}\n`);
  if (!argv.includes('--go')) {
    if (missing.length) {
      io.stderr.write(`bring-assets: ${missing.length} entries are missing in the source\n`);
      return 1;
    }
    io.stdout.write(copy.length ? 'dry run: pass --go to copy\n' : 'nothing to do\n');
    return 0;
  }
  const r = await d.applyAssets(plan, config);
  io.stdout.write(`copied ${r.copied} · present ${r.present} · failed ${r.failed.length}\n`);
  if (r.failed.length) {
    io.stderr.write(`bring-assets failed: ${r.failed.map((f) => `${f.id} (${f.reason})`).join('; ')}\n`);
    return 1;
  }
  return 0;
}

const COMMANDS = { doctor, env, 'setup-env': setupEnv, 'bring-assets': bringAssets };

export async function main(argv, io = { stdout: process.stdout, stderr: process.stderr, env: process.env }, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const [cmd, ...rest] = argv;
  if (cmd === 'help' || cmd === '--help') {
    io.stdout.write(USAGE + '\n');
    return 0;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    io.stderr.write(`${cmd ? `unknown command: ${cmd}\n` : ''}${USAGE}\n`);
    return 2;
  }
  try {
    const config = d.loadConfig({ env: io.env || process.env });
    return await fn(rest, io, d, config);
  } catch (e) {
    io.stderr.write(`${cmd}: ${e.message}\n`);
    return 1;
  }
}

export function isMain(argv1, moduleUrl) {
  if (!argv1) return false;
  const a = path.resolve(argv1);
  const b = fileURLToPath(moduleUrl);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

if (isMain(process.argv[1], import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
