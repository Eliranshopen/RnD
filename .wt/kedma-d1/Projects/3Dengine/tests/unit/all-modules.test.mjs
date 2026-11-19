// Imports every engine module so that no engine file is missing from the coverage table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { listFiles } from '../../engine/lib/files.mjs';

const ENGINE = fileURLToPath(new URL('../../engine', import.meta.url));

test('every engine/**/*.mjs imports cleanly', async () => {
  const files = listFiles(ENGINE).filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length >= 10, `found ${files.length} modules`);
  for (const f of files) {
    const mod = await import(pathToFileURL(f).href);
    assert.ok(Object.keys(mod).length > 0, `${f} exports something`);
  }
});
