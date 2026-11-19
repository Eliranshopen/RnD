import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, USAGE, isMain } from '../../engine/cli.mjs';
import { fakeConfig, sink, SECRET } from '../helpers/fakes.mjs';

function io(env = { FAL_KEY: SECRET }) {
  return { stdout: sink(), stderr: sink(), env };
}

const doctorResult = (ready, readyExceptKeys) => ({
  at: 'T', ready, ready_except_keys: readyExceptKeys,
  checks: [{ id: 'node', kind: 'runtime', label: 'Node', ok: readyExceptKeys, detail: 'v24' },
    { id: 'keys', kind: 'keys', label: 'Keys', ok: ready, detail: 'FAL_KEY: present', missing: ready ? [] : ['FAL_KEY'] }],
});

const deps = (over = {}) => ({ loadConfig: () => fakeConfig(), ...over });

test('help and no command', async () => {
  let o = io();
  assert.equal(await main(['help'], o, deps()), 0);
  assert.equal(o.stdout.text, USAGE + '\n');
  o = io();
  assert.equal(await main([], o, deps()), 2);
  assert.match(o.stderr.text, /^usage:/);
});

test('unknown command → usage on stderr, exit 2', async () => {
  const o = io();
  assert.equal(await main(['frobnicate'], o, deps()), 2);
  assert.match(o.stderr.text, /unknown command: frobnicate\nusage:/);
});

test('doctor: exit 0 when ready or ready except keys, 1 otherwise; --json', async () => {
  for (const [ready, rek, code, last] of [[true, true, 0, 'READY'], [false, true, 0, 'READY EXCEPT KEYS (FAL_KEY)'], [false, false, 1, 'NOT READY']]) {
    const o = io();
    assert.equal(await main(['doctor'], o, deps({ runDoctor: async () => doctorResult(ready, rek) })), code);
    assert.ok(o.stdout.text.trim().endsWith(last));
  }
  const o = io();
  assert.equal(await main(['doctor', '--json'], o, deps({ runDoctor: async () => doctorResult(true, true) })), 0);
  assert.equal(JSON.parse(o.stdout.text).ready, true);
});

test('env prints the pointers, never a key', async () => {
  const o = io();
  assert.equal(await main(['env'], o, deps()), 0);
  const lines = o.stdout.text.trim().split('\n');
  assert.equal(lines.length, 11);
  assert.ok(lines.includes('HABAIT_ENV_ROOT=C:/eng'));
  assert.ok(!o.stdout.text.includes(SECRET) && !o.stdout.text.includes('FAL_KEY'));
});

test('setup-env: nothing to do / dry run / --go ok / --go failure', async () => {
  const step = (needed) => ({ id: 'pip', needed, cmd: 'py', args: ['-m', 'pip'], cwd: 'C:/eng' });
  let o = io();
  assert.equal(await main(['setup-env'], o, deps({ planEnv: () => ({ steps: [step(false)] }) })), 0);
  assert.match(o.stdout.text, /nothing to do/);
  o = io();
  let applied = false;
  assert.equal(await main(['setup-env'], o, deps({ planEnv: () => ({ steps: [step(true)] }), applyEnv: () => { applied = true; } })), 0);
  assert.match(o.stdout.text, /^needed pip/m);
  assert.match(o.stdout.text, /dry run/);
  assert.equal(applied, false);
  o = io();
  assert.equal(await main(['setup-env', '--go'], o, deps({ planEnv: () => ({ steps: [step(true)] }),
    applyEnv: () => ({ ok: true, ran: ['pip'] }) })), 0);
  assert.match(o.stdout.text, /done: pip/);
  o = io();
  assert.equal(await main(['setup-env', '--go'], o, deps({ planEnv: () => ({ steps: [step(true)] }),
    applyEnv: () => ({ ok: false, reason: 'pip exited 1: boom' }) })), 1);
  assert.match(o.stderr.text, /setup-env failed: pip exited 1: boom/);
});

test('bring-assets: dry run, missing in source, --from, --go ok and failure', async () => {
  const entry = (id, state) => ({ id, state, bytes: 2 * 1024 * 1024 });
  let seenFrom;
  const plan = (entries) => async (cfg, { from }) => { seenFrom = from; return { from, entries }; };
  let o = io();
  assert.equal(await main(['bring-assets'], o, deps({ planAssets: plan([entry('a', 'present'), entry('b', 'copy')]) })), 0);
  assert.equal(seenFrom, 'C:/backup/360walkaround');
  assert.match(o.stdout.text, /present 1 · copy 1 \(2\.0 MB\) · missing-in-source 0/);
  assert.match(o.stdout.text, /dry run/);
  o = io();
  assert.equal(await main(['bring-assets', '--from', 'D:/bk'], o, deps({ planAssets: plan([entry('a', 'present')]) })), 0);
  assert.equal(seenFrom, 'D:/bk');
  assert.match(o.stdout.text, /nothing to do/);
  o = io();
  assert.equal(await main(['bring-assets'], o, deps({ planAssets: plan([entry('c', 'missing-in-source')]) })), 1);
  assert.match(o.stdout.text, /missing-in-source c/);
  assert.match(o.stderr.text, /1 entries are missing/);
  o = io();
  assert.equal(await main(['bring-assets', '--go'], o, deps({ planAssets: plan([{ ...entry('b', 'copy'), bytes: 3 * 2 ** 30 }]),
    applyAssets: async () => ({ copied: 1, present: 0, failed: [] }) })), 0);
  assert.match(o.stdout.text, /3\.00 GB/);
  assert.match(o.stdout.text, /copied 1 · present 0 · failed 0/);
  o = io();
  assert.equal(await main(['bring-assets', '--go'], o, deps({ planAssets: plan([entry('b', 'copy')]),
    applyAssets: async () => ({ copied: 0, present: 0, failed: [{ id: 'b', reason: 'sha256 mismatch after copy' }] }) })), 1);
  assert.match(o.stderr.text, /b \(sha256 mismatch after copy\)/);
  o = io();
  assert.equal(await main(['bring-assets', '--from'], o, deps()), 1);
  assert.match(o.stderr.text, /--from needs a value/);
});

test('a config error is reported on stderr with exit 1', async () => {
  const o = io();
  assert.equal(await main(['env'], o, { loadConfig: () => { throw new Error('engine config: missing required field "python"'); } }), 1);
  assert.match(o.stderr.text, /env: engine config: missing required field "python"/);
});

test('main with the real config: env command', async () => {
  const o = io({});
  assert.equal(await main(['env'], o), 0);
  assert.match(o.stdout.text, /^HABAIT_PY=.*\/\.venv\/Scripts\/python\.exe$/m);
});

test('isMain compares the script path with the module url', () => {
  assert.equal(isMain(undefined, import.meta.url), false);
  assert.equal(isMain(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), import.meta.url), true);
  assert.equal(isMain('C:/other.mjs', import.meta.url), false);
});
