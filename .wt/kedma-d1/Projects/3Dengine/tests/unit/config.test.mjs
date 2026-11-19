import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadConfig, pipelineEnv, ENGINE_HOME } from '../../engine/config.mjs';
import { tempDir, writeFile } from '../helpers/fakes.mjs';

const BASE = JSON.parse(fs.readFileSync(new URL('../../engine.config.json', import.meta.url), 'utf8'));

function homeWith(cfg, local) {
  const h = tempDir('cfg-');
  writeFile(`${h}/engine.config.json`, JSON.stringify(cfg));
  if (local) writeFile(`${h}/engine.config.local.json`, JSON.stringify(local));
  return h;
}

test('ENGINE_HOME is the folder above engine/, absolute, forward slashes', () => {
  assert.match(ENGINE_HOME, /3Dengine$/);
  assert.ok(!ENGINE_HOME.includes('\\'));
  assert.ok(fs.existsSync(`${ENGINE_HOME}/engine.config.json`));
});

test('defaults: relative paths resolve against home, absolute kept, basePython untouched', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.equal(c.home, h);
  assert.equal(c.pipelineRoot, `${h}/pipeline`);
  assert.equal(c.python, `${h}/.venv/Scripts/python.exe`);
  assert.equal(c.envRoot, h);
  assert.equal(c.basePython, 'python');
  assert.equal(c.blender, 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe');
  assert.equal(c.blenderVersion, '4.5.10');
  assert.equal(c.legalDir, `${h}/house/legal`);
  assert.equal(c.runtimeDir, `${h}/.runtime`);
  assert.equal(c.assets.hdriBase, `${h}/pipeline/360walkaround`);
  assert.equal(c.assets.source, 'C:/HABAIT-Archive/Habait-Backup/habait-walkaround/360walkaround');
  assert.equal(c.assets.packCache, `${h}/pipeline/360walkaround/catalog/.cache`);
  assert.equal(c.assets.packSource, BASE.assets.packSource);
  assert.deepEqual(c.keys, ['FAL_KEY', 'OPENROUTER_API_KEY']);
  assert.deepEqual(c.nodeLibs, ['sharp', 'playwright-core']);
  assert.equal(c.pythonLibs.cv2, 'opencv-python');
  for (const v of [c.pipelineRoot, c.python, c.assets.catalogModels]) assert.ok(!v.includes('\\'));
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.assets) && Object.isFrozen(c.keys));
});

test('the real engine.config.json loads with the default home', () => {
  const c = loadConfig({ env: {} });
  assert.equal(c.home, ENGINE_HOME);
});

test('local override merges shallow, assets one level deep', () => {
  const h = homeWith(BASE, { chrome: 'D:/chrome.exe', assets: { source: 'E:/bk' } });
  const c = loadConfig({ home: h, env: {} });
  assert.equal(c.chrome, 'D:/chrome.exe');
  assert.equal(c.assets.source, 'E:/bk');
  assert.equal(c.assets.catalogModels, `${h}/pipeline/360walkaround/catalog/models`);
});

test('env overrides ENGINE_PYTHON / ENGINE_BLENDER / ENGINE_CHROME win over files', () => {
  const h = homeWith(BASE, { python: 'x/py.exe' });
  const c = loadConfig({ home: h, env: { ENGINE_PYTHON: 'C:/py/python.exe', ENGINE_BLENDER: 'bl/blender.exe', ENGINE_CHROME: '' } });
  assert.equal(c.python, 'C:/py/python.exe');
  assert.equal(c.blender, `${h}/bl/blender.exe`);
  assert.equal(c.chrome, 'C:/Program Files/Google/Chrome/Application/chrome.exe');
});

test('injected readFile / exists are used', () => {
  const files = { 'C:/h/engine.config.json': JSON.stringify(BASE) };
  const c = loadConfig({ home: 'C:/h', env: {}, readFile: (p) => files[p], exists: () => false });
  assert.equal(c.jobsDir, 'C:/h/jobs');
});

test('a missing required field throws an Error naming it', () => {
  for (const field of ['pipelineRoot', 'basePython', 'blenderVersion', 'keys', 'pythonLibs']) {
    const cfg = { ...BASE };
    delete cfg[field];
    assert.throws(() => loadConfig({ home: homeWith(cfg), env: {} }), new RegExp(`"${field}"`));
  }
  const cfg = { ...BASE, assets: { ...BASE.assets } };
  delete cfg.assets.hdriBase;
  assert.throws(() => loadConfig({ home: homeWith(cfg), env: {} }), /"assets\.hdriBase"/);
});

test('wrong shapes are rejected', () => {
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, keys: 'FAL_KEY' }), env: {} }), /"keys" must be an array/);
  assert.throws(() => loadConfig({ home: homeWith({ ...BASE, pythonLibs: ['numpy'] }), env: {} }), /"pythonLibs" must be an object/);
});

test('pipelineEnv returns exactly the eleven pointers', () => {
  const h = homeWith(BASE);
  const c = loadConfig({ home: h, env: {} });
  assert.deepEqual(pipelineEnv(c), {
    HABAIT_PY: `${h}/.venv/Scripts/python.exe`,
    HABAIT_APP_DIR: `${h}/appdeps`,
    HABAIT_ENV_ROOT: h,
    HABAIT_BLENDER_LOCK: 'C:/RnD/.wt/_blender.lock',
    HABAIT_ASSETS_ROOT: `${h}/pipeline`,
    HABAIT_LEGAL_SRC: `${h}/house/legal`,
    HABAIT_LEGAL_DIR: `${h}/house/legal`,
    HABAIT_LEGAL_MD: `${h}/house/legal/disclaimer-he-en.md`,
    BLENDER: 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe',
    CHROME: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    CHROME_PATH: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
});
