// The engine's command line. Commands that change the disk are dry runs unless --go is given.
import { loadConfig, pipelineEnv } from './config.mjs';
import { runDoctor, formatReport } from './doctor.mjs';
import { planEnv, applyEnv } from './setup/env.mjs';
import { planAssets, applyAssets } from './setup/assets.mjs';
import { isMain } from './lib/main.mjs';
import { readJob, formatJob, STAGES } from './jobs.mjs';
import { startServe } from './serve.mjs';
import { shownJob, isStalled, startOrResume, spawnRunnerDefault, runnerAlive } from './control.mjs';
import { readManifest, readOwnJob, listOwnJobs } from './manifest.mjs';
import { readLedger, ledgerTotals, formatLedger } from './ledger.mjs';

export { isMain };

export const USAGE = [
  'usage: node engine/cli.mjs <command>',
  '  doctor [--json]                 readiness report (exit 0 = ready, or ready except keys)',
  '  env                             the pipeline pointers as NAME=path lines (never keys)',
  '  setup-env [--go]                Python venv + pinned libraries + Node libraries',
  '  bring-assets [--from <dir>] [--go]   copy the sealed render assets from a backup copy',
  '  job <job_id> [--json]           one job: its stages and manifest rows, the ledger, STALLED (exit 1 when there is no such job)',
  '  jobs [--json]                   the newest jobs',
  '  resume <job_id>                 start a runner for a stalled job, or restart a cancelled / failed / review one',
  '  ledger <job_id> [--json]        the paid calls of a job: reserved, settled, failed, orphaned',
  '  serve --root <dir> [--port N] [--host H]   static server for a folder (foreground)',
  '  mcp                             the MCP server on stdio (habait-engine)',
  '  help                            this text',
].join('\n');

const runMcp = async (opts) => (await import('../mcp/server.mjs')).runStdio(opts);

const DEFAULT_DEPS = { loadConfig, runDoctor, planEnv, applyEnv, planAssets, applyAssets, startServe, runMcp,
  spawnRunner: spawnRunnerDefault, isRunnerAlive: runnerAlive };

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

function jobArg(argv, cmd) {
  const id = argv.find((a) => !a.startsWith('--'));
  if (!id) throw new Error(`${cmd} needs a job_id`);
  return id;
}

const shown = (config, j, d) => shownJob(config, j, { isAlive: d.isRunnerAlive });
const lineOf = (j) => `${formatJob(j)}${isStalled(j) ? ' · STALLED' : ''}`;

// The job, its runner, its stages with their manifest rows, the ledger total and the orphaned rows.
export function formatJobDetail(j, manifest, ledger) {
  const lines = [lineOf(j)];
  const r = j.runner;
  lines.push(r.alive ? `runner: alive, pid ${r.pid}, heartbeat ${r.heartbeat_age_s} s ago`
    : `runner: not alive${isStalled(j) ? ' - STALLED: the job is in a working state and nothing moves it (engine resume)' : ''}`);
  if (j.waiting_for) lines.push(`waiting for: ${j.waiting_for}`);
  lines.push('stages:');
  for (const stage of STAGES) {
    const rows = manifest.rows.filter((x) => x.stage === stage);
    const now = j.state === stage ? '  <- now' : '';
    const tries = j.attempts?.[stage] ?? 0;
    if (!rows.length) lines.push(`  ${stage.padEnd(10)} ${tries ? `started ${tries}x, no row` : '-'}${now}`);
    for (const x of rows) {
      lines.push(`  ${stage.padEnd(10)} ${x.status} attempt ${x.attempt}  ${x.seconds} s  $${x.cost_usd}  ${x.finished_at}  pid ${x.runner_pid}` +
        `${x.superseded ? '  (superseded)' : ''}${now}`);
    }
  }
  const t = ledgerTotals(ledger);
  lines.push(`ledger: settled $${t.settled_usd} · held $${t.held_usd} · ${ledger.rows.length} row(s)`);
  for (const o of t.orphaned) {
    lines.push(`  ORPHANED #${o.seq} ${o.stage} attempt ${o.attempt}: $${o.reserved_usd} reserved, outcome unknown (counts toward the cap)`);
  }
  return lines.join('\n');
}

function mustRead(config, id, io) {
  const raw = readJob(config.jobsDir, id);
  if (!raw) io.stderr.write(`job ${id}: not found\n`);
  return raw;
}

// The ledger and the manifest of a job, for the commands that print them. A file that is damaged (cut
// short, not JSON, another shape) is named in the error instead of a parser's message.
function readBooks(config, id, raw) {
  try {
    const ledger = readLedger(config.jobsDir, id, raw.cost?.cap_usd ?? null);
    const manifest = readManifest(config.jobsDir, id);
    ledgerTotals(ledger);
    if (!Array.isArray(manifest.rows)) throw new Error('manifest.json has no rows');
    return { ledger, manifest };
  } catch (e) {
    throw new Error(`ledger.json or manifest.json of job ${id} cannot be read (${e.message}); "job ${id} --json" still prints the job file`);
  }
}

function job(argv, io, d, config) {
  const id = jobArg(argv, 'job');
  const raw = mustRead(config, id, io);
  if (!raw) return 1;
  const j = shown(config, raw, d);
  if (argv.includes('--json')) {
    io.stdout.write(JSON.stringify(j, null, 2) + '\n');
    return 0;
  }
  const books = readBooks(config, id, raw);
  io.stdout.write(formatJobDetail(j, books.manifest, books.ledger) + '\n');
  return 0;
}

function jobs(argv, io, d, config) {
  const list = listOwnJobs(config.jobsDir, 10).map((j) => shown(config, j, d));
  if (argv.includes('--json')) io.stdout.write(JSON.stringify({ jobs: list }, null, 2) + '\n');
  else io.stdout.write(list.length ? list.map(lineOf).join('\n') + '\n' : 'no jobs\n');
  return 0;
}

// Both files of the job are read (contract 1.1 §5): a job.json or a manifest.json that is not this job's
// throws, `main` prints the job and the reason and exits 1, and no runner is started.
function resume(argv, io, d, config) {
  const id = jobArg(argv, 'resume');
  const raw = readOwnJob(config.jobsDir, id);
  if (!raw) {
    io.stderr.write(`job ${id}: not found\n`);
    return 1;
  }
  const r = startOrResume(config, raw, { spawnRunner: d.spawnRunner, isRunnerAlive: d.isRunnerAlive });
  io.stdout.write(r.resumed ? `resumed: ${id} in "${r.job.state}", a runner was started\n`
    : `not resumed: ${id} is "${r.job.state}"${r.job.state === 'done' ? '' : ' and its runner is alive'}\n`);
  return 0;
}

function ledger(argv, io, d, config) {
  const id = jobArg(argv, 'ledger');
  const raw = mustRead(config, id, io);
  if (!raw) return 1;
  const doc = readBooks(config, id, raw).ledger;
  io.stdout.write((argv.includes('--json') ? JSON.stringify(doc, null, 2) : formatLedger(doc)) + '\n');
  return 0;
}

async function serve(argv, io, d, config) {
  const root = optValue(argv, '--root');
  if (!root) throw new Error('serve needs --root <dir>');
  const port = Number(optValue(argv, '--port') || config.serve.port);
  const host = optValue(argv, '--host') || config.serve.host;
  const server = await d.startServe({ root, host, port });
  io.stderr.write(`serving ${root} at http://${host}:${port}/ (pid ${process.pid})\n`);
  await new Promise((resolve) => server.once('close', resolve));
  return 0;
}

async function mcp(argv, io, d, config) {
  return d.runMcp({ config });
}

const COMMANDS = { doctor, env, 'setup-env': setupEnv, 'bring-assets': bringAssets, job, jobs, resume, ledger, serve, mcp };

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

if (isMain(process.argv[1], import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
