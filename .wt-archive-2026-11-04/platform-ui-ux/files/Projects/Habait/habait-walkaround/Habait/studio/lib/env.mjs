/* Habait Studio — lib/env.mjs: where things are, and the secrets by name.
   The repo root .env (gitignored) holds FAL_KEY / ANTHROPIC_API_KEY; nothing here ever logs a value. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeCliPath } from './llm.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO = path.resolve(HERE, '..');
export const REPO = path.resolve(STUDIO, '..', '..');
export const PIPELINE = path.join(REPO, '360walkaround', 'pipeline');
export const TOOLS = path.join(STUDIO, 'tools');

const BLENDER_CANDIDATES = [
  'C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe',
  'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe',
];
const PYTHON_CANDIDATES = [
  'C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe',
];

function firstExisting(list, fallback) {
  for (const p of list) if (fs.existsSync(p)) return p;
  return fallback;
}

/** Parse a dotenv file without overriding what the process already has. */
export function readDotenv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

export function loadEnv(overrides = {}) {
  const dot = readDotenv(path.join(REPO, '.env'));
  const get = (k, d) => overrides[k] ?? process.env[k] ?? dot[k] ?? d;
  const env = {
    FAL_KEY: get('FAL_KEY', ''),
    ANTHROPIC_API_KEY: get('ANTHROPIC_API_KEY', ''),
    LLM_MODEL: get('HABAIT_LLM_MODEL', 'claude-opus-5-5'),
    CLI_MODEL: get('HABAIT_CLI_MODEL', 'opus'),
    BLENDER: get('BLENDER', firstExisting(BLENDER_CANDIDATES, 'blender')),
    PYTHON: get('HABAIT_PY', firstExisting(PYTHON_CANDIDATES, 'python')),
    FFMPEG: get('FFMPEG', 'ffmpeg'),
    ALLOW_SPEND: /^(1|true|yes)$/i.test(String(get('HABAIT_ALLOW_SPEND', '0'))),
    CAP_USD: Number(get('HABAIT_CAP_USD', '10')),
    MOCK_LLM: /^(1|true|yes)$/i.test(String(get('HABAIT_MOCK_LLM', '0'))),
    PORT: Number(get('HABAIT_PORT', '8820')),
    PROJECTS_DIR: get('HABAIT_PROJECTS_DIR', path.join(STUDIO, '_local', 'projects')),
  };
  // the same convention as the pipeline: fal keys and the Anthropic key travel by NAME only
  env.hasFal = Boolean(env.FAL_KEY);
  // the LLM backend: the API key, else Eliran's Claude subscription through the Claude Code CLI (lib/llm.mjs)
  env.llmBackend = env.MOCK_LLM ? 'mock' : env.ANTHROPIC_API_KEY ? 'api' : claudeCliPath() ? 'cli' : 'none';
  env.hasLLM = env.llmBackend === 'api' || env.llmBackend === 'cli';
  return env;
}

/** A redacted view for the dashboard: which capabilities exist, never the values. */
export function describeEnv(env) {
  return {
    llm: env.hasLLM ? 'ready' : env.MOCK_LLM ? 'mock' : 'missing: no ANTHROPIC_API_KEY and no claude CLI',
    llm_backend: env.llmBackend,
    llm_model: env.llmBackend === 'cli' ? `claude CLI · ${env.CLI_MODEL}` : env.LLM_MODEL,
    fal: env.hasFal ? 'ready' : 'missing FAL_KEY',
    blender: fs.existsSync(env.BLENDER) ? env.BLENDER : `not found (${env.BLENDER})`,
    python: fs.existsSync(env.PYTHON) || env.PYTHON === 'python' ? env.PYTHON : `not found (${env.PYTHON})`,
    allow_spend: env.ALLOW_SPEND,
    cap_usd: env.CAP_USD,
    projects_dir: env.PROJECTS_DIR,
  };
}
