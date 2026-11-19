import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkPdfPath, isInside, allowedRoot, sha256Buffer, EngineError, MAX_PDF_BYTES } from '../../engine/inbox.mjs';
import { stubConfig, writeFile, PDF_BYTES, tempDir } from '../helpers/fakes.mjs';

const code = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof EngineError, e.message);
    return e.code;
  }
  return 'no error';
};

test('a PDF inside the inbox passes: real path, given name, bytes', () => {
  const c = stubConfig();
  writeFile(`${c.home}/inbox/plan.pdf`, PDF_BYTES);
  const r = checkPdfPath(`${c.home}/inbox/plan.pdf`, c);
  assert.equal(r.name, 'plan.pdf');
  assert.equal(r.bytes, PDF_BYTES.length);
  assert.ok(r.path.toLowerCase().endsWith('/inbox/plan.pdf'));
  // relative to the engine home
  assert.equal(checkPdfPath('inbox/plan.pdf', c).bytes, PDF_BYTES.length);
});

test('outside, .. escapes, empty, NUL → PATH_NOT_ALLOWED', () => {
  const c = stubConfig();
  writeFile(`${c.home}/outside.pdf`, PDF_BYTES);
  assert.equal(code(() => checkPdfPath(`${c.home}/outside.pdf`, c)), 'PATH_NOT_ALLOWED');
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/../outside.pdf`, c)), 'PATH_NOT_ALLOWED');
  assert.equal(code(() => checkPdfPath('', c)), 'PATH_NOT_ALLOWED');
  assert.equal(code(() => checkPdfPath(42, c)), 'PATH_NOT_ALLOWED');
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/a\0.pdf`, c)), 'PATH_NOT_ALLOWED');
  assert.equal(code(() => checkPdfPath(`${c.home}/nowhere/x.pdf`, c)), 'PATH_NOT_ALLOWED');
});

test('an inbox folder that does not exist allows nothing', () => {
  const c = stubConfig({ inbox: ['C:/no/such/inbox-folder'] });
  assert.equal(code(() => checkPdfPath('C:/no/such/inbox-folder/a.pdf', c)), 'PATH_NOT_ALLOWED');
});

test('a link inside the inbox that leads outside is refused (a directory junction: no privilege needed)', () => {
  const c = stubConfig();
  const outside = tempDir('outside-');
  writeFile(`${outside}/real.pdf`, PDF_BYTES);
  fs.symlinkSync(outside, `${c.home}/inbox/linked`, 'junction');
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/linked/real.pdf`, c)), 'PATH_NOT_ALLOWED');
});

test('missing file, a folder, wrong magic → NOT_A_PDF; over 20 MB → FILE_TOO_LARGE', () => {
  const c = stubConfig();
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/none.pdf`, c)), 'NOT_A_PDF');
  fs.mkdirSync(`${c.home}/inbox/dir.pdf`);
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/dir.pdf`, c)), 'NOT_A_PDF');
  writeFile(`${c.home}/inbox/a.txt`, 'hello');
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/a.txt`, c)), 'NOT_A_PDF');
  writeFile(`${c.home}/inbox/empty.pdf`, '');
  assert.equal(code(() => checkPdfPath(`${c.home}/inbox/empty.pdf`, c)), 'NOT_A_PDF');
  const big = `${c.home}/inbox/big.pdf`;
  writeFile(big, '%PDF-');
  fs.truncateSync(big, MAX_PDF_BYTES + 1);
  assert.equal(code(() => checkPdfPath(big, c)), 'FILE_TOO_LARGE');
  fs.truncateSync(big, MAX_PDF_BYTES);
  assert.equal(checkPdfPath(big, c).bytes, MAX_PDF_BYTES);
});

test('isInside / allowedRoot / sha256Buffer', () => {
  assert.equal(isInside('C:/a/b/c.pdf', 'C:/a/b'), true);
  assert.equal(isInside('C:/a/b', 'C:/a/b/'), true);
  assert.equal(isInside('C:/a/bc/x', 'C:/a/b'), false);
  assert.equal(isInside('/', '/'), true);
  assert.equal(allowedRoot('C:/x/y.pdf', ['C:/definitely/not/here']), null);
  assert.equal(sha256Buffer(Buffer.from('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
