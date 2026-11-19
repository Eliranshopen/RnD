import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseLock, normalizeName } from '../../engine/lib/lock.mjs';
import { sha256File } from '../../engine/lib/hash.mjs';
import { run } from '../../engine/lib/run.mjs';
import { readJson, writeJson, appendManifestRow } from '../../engine/lib/json.mjs';
import { listFiles, totalBytes } from '../../engine/lib/files.mjs';
import { toPosix, resolveFrom, isAbsolutePath } from '../../engine/lib/paths.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

test('normalizeName: lower-case, _ to -', () => {
  assert.equal(normalizeName('Lazy_Loader'), 'lazy-loader');
  assert.equal(normalizeName(' opencv-python '), 'opencv-python');
});

test('parseLock reads name==version, skips comments and blanks', () => {
  const pins = parseLock('# head\n\nnumpy==2.5.4\r\nlazy_loader==0.6  # why\nPyMuPDF==2.0\n');
  assert.deepEqual(pins, [
    { name: 'numpy', dist: 'numpy', version: '2.5.4' },
    { name: 'lazy-loader', dist: 'lazy_loader', version: '0.6' },
    { name: 'pymupdf', dist: 'PyMuPDF', version: '2.0' },
  ]);
});

test('parseLock rejects an unpinned line', () => {
  assert.throws(() => parseLock('numpy>=2\n'), /not a name==version line/);
});

test('the real requirements lock parses as written (20 pins)', () => {
  const pins = parseLock(fs.readFileSync(new URL('../../requirements.lock.txt', import.meta.url), 'utf8'));
  assert.equal(pins.length, 20);
  assert.ok(pins.some((p) => p.name === 'lazy-loader'));
});

test('sha256File streams the hash of a file', async () => {
  const d = tempDir();
  writeFile(`${d}/f.bin`, 'hello');
  assert.equal(await sha256File(`${d}/f.bin`), createHash('sha256').update('hello').digest('hex'));
  await assert.rejects(sha256File(`${d}/nope`), /ENOENT/);
});

test('run returns status, stdout and stderr', () => {
  const r = run(process.execPath, ['-e', 'process.stdout.write("out");process.stderr.write("err");process.exit(3)']);
  assert.deepEqual(r, { status: 3, stdout: 'out', stderr: 'err' });
});

test('run through a shell sends one command string and raises no deprecation warning', () => {
  const r = run('node', ['--version'], { shell: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^v\d+\./);
  assert.doesNotMatch(r.stderr, /DEP0190/);
});

test('run reports a spawn error as status -1 with the reason', () => {
  const r = run('definitely-not-a-command-xyz', []);
  assert.equal(r.status, -1);
  assert.match(r.stderr, /ENOENT/);
});

test('run honours the timeout', () => {
  const r = run(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeoutMs: 200 });
  assert.equal(r.status, -1);
  assert.match(r.stderr, /ETIMEDOUT/);
});

test('JSON read/write and manifest rows', () => {
  const d = tempDir();
  writeJson(`${d}/a/b.json`, { x: 1 });
  assert.equal(fs.readFileSync(`${d}/a/b.json`, 'utf8'), '{\n  "x": 1\n}\n');
  assert.deepEqual(readJson(`${d}/a/b.json`), { x: 1 });
  writeFile(`${d}/bom.json`, '\uFEFF{"y":2}');
  assert.deepEqual(readJson(`${d}/bom.json`), { y: 2 });
  assert.equal(appendManifestRow(`${d}/m/rows.json`, { n: 1 }), 1);
  assert.equal(appendManifestRow(`${d}/m/rows.json`, { n: 2 }), 2);
  assert.deepEqual(readJson(`${d}/m/rows.json`), [{ n: 1 }, { n: 2 }]);
  assert.throws(() => appendManifestRow(`${d}/a/b.json`, {}), /not a JSON array/);
});

test('listFiles is recursive, sorted, forward slashes; missing folder is empty', () => {
  const d = tempDir();
  writeFile(`${d}/z.txt`, '12');
  writeFile(`${d}/a/b/c.txt`, '345');
  assert.deepEqual(listFiles(d), [`${d}/a/b/c.txt`, `${d}/z.txt`]);
  assert.deepEqual(listFiles(`${d}/missing`), []);
  assert.deepEqual(listFiles(`${d}/z.txt`), []);
  assert.equal(totalBytes(listFiles(d)), 5);
});

test('path helpers', () => {
  assert.equal(toPosix('C:\\a\\b'), 'C:/a/b');
  assert.ok(isAbsolutePath('C:/x') && isAbsolutePath('D:\\x') && !isAbsolutePath('rel/x'));
  assert.equal(resolveFrom('C:/home', 'pipeline/'), 'C:/home/pipeline');
  assert.equal(resolveFrom('C:/home', '.'), 'C:/home');
  assert.equal(resolveFrom('C:/home', 'D:/abs/x'), 'D:/abs/x');
});
