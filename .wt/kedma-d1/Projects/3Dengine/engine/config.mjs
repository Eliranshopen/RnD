// The engine's one settings file, resolved: engine.config.json, then engine.config.local.json
// over it, then the ENGINE_* env overrides. Every path comes back absolute with forward slashes.
// Keys are NAMED here and never read.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveFrom, toPosix } from './lib/paths.mjs';

export const ENGINE_HOME = resolveFrom('/', toPosix(fileURLToPath(new URL('..', import.meta.url))));

const PATH_FIELDS = ['pipelineRoot', 'python', 'requirements', 'appDepsDir', 'envRoot', 'blender',
  'blenderLock', 'chrome', 'legalDir', 'jobsDir', 'runtimeDir'];
const ASSET_FIELDS = ['source', 'catalogManifest', 'catalogModels', 'styleFile', 'hdriBase', 'packSource', 'packCache'];
const ENV_OVERRIDES = { ENGINE_PYTHON: 'python', ENGINE_BLENDER: 'blender', ENGINE_CHROME: 'chrome' };

function required(obj, field, label = field) {
  const v = obj[field];
  if (v === undefined || v === null || v === '') throw new Error(`engine config: missing required field "${label}"`);
  return v;
}

function merge(base, over) {
  const out = { ...base, ...over };
  if (base.assets || over.assets) out.assets = { ...(base.assets || {}), ...(over.assets || {}) };
  return out;
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

export function loadConfig({
  home = ENGINE_HOME,
  env = process.env,
  readFile = (p) => fs.readFileSync(p, 'utf8'),
  exists = fs.existsSync,
} = {}) {
  home = resolveFrom('/', home);
  const parse = (p) => JSON.parse(String(readFile(p)).replace(/^\uFEFF/, ''));
  let raw = parse(`${home}/engine.config.json`);
  const local = `${home}/engine.config.local.json`;
  if (exists(local)) raw = merge(raw, parse(local));
  raw = { ...raw };
  for (const [name, field] of Object.entries(ENV_OVERRIDES)) {
    if (typeof env[name] === 'string' && env[name] !== '') raw[field] = env[name];
  }

  const cfg = { home };
  for (const f of PATH_FIELDS) cfg[f] = resolveFrom(home, required(raw, f));
  cfg.basePython = required(raw, 'basePython');
  cfg.blenderVersion = String(required(raw, 'blenderVersion'));
  const assets = required(raw, 'assets');
  cfg.assets = {};
  for (const f of ASSET_FIELDS) cfg.assets[f] = resolveFrom(home, required(assets, f, `assets.${f}`));
  for (const f of ['keys', 'nodeLibs']) {
    const v = required(raw, f);
    if (!Array.isArray(v)) throw new Error(`engine config: field "${f}" must be an array`);
    cfg[f] = [...v];
  }
  const libs = required(raw, 'pythonLibs');
  if (typeof libs !== 'object' || Array.isArray(libs)) throw new Error('engine config: field "pythonLibs" must be an object');
  cfg.pythonLibs = { ...libs };
  return deepFreeze(cfg);
}

// The pointers the brought-in pipeline reads instead of its old C:/RnD/Projects/Habait defaults.
export function pipelineEnv(config) {
  return {
    HABAIT_PY: config.python,
    HABAIT_APP_DIR: config.appDepsDir,
    HABAIT_ENV_ROOT: config.envRoot,
    HABAIT_BLENDER_LOCK: config.blenderLock,
    HABAIT_ASSETS_ROOT: config.pipelineRoot,
    HABAIT_LEGAL_SRC: config.legalDir,
    HABAIT_LEGAL_DIR: config.legalDir,
    HABAIT_LEGAL_MD: `${config.legalDir}/disclaimer-he-en.md`,
    BLENDER: config.blender,
    CHROME: config.chrome,
    CHROME_PATH: config.chrome,
  };
}
