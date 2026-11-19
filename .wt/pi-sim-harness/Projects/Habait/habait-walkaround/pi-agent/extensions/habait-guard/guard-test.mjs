// guard-test.mjs — the habait-guard extension's rules, tested WITHOUT a model (2026-11-15): the extension is loaded through Pi's own jiti
// with a fake ExtensionAPI, and its tool_call handler is fed tool calls; each must be blocked / asked / allowed as the rule says.
//   node pi-agent/extensions/habait-guard/guard-test.mjs      (exit 0 = every case as expected)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const PI = path.join(process.env.APPDATA, 'npm/node_modules/@earendil-works/pi-coding-agent');
const req = createRequire(path.join(PI, 'package.json'));
const { createJiti } = req('jiti');
const jiti = createJiti(import.meta.url, { alias: { '@earendil-works/pi-coding-agent': path.join(PI, 'dist/index.js'), typebox: path.join(PI, 'node_modules', 'typebox', 'build', 'index.mjs') } });
const mod = await jiti.import(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.ts'));
const handlers = {}; const tools = [];
mod.default({ on: (n, f) => { handlers[n] = f; }, registerTool: (t) => tools.push(t.name), registerCommand() {} });
const noUI = { hasUI: false, ui: {} };
const yesUI = (choice, typed) => ({ hasUI: true, ui: { select: async () => choice, input: async () => typed, confirm: async () => true } });
const bash = (command) => ({ toolName: 'bash', input: { command } });
const read = (p) => ({ toolName: 'read', input: { path: p } });
const CASES = [
  ['read .env', read('C:/RnD/Projects/Habait/habait-walkaround/.env'), noUI, 'block'],
  ['read auth.json', read('C:/Users/x/.pi/agent/auth.json'), noUI, 'block'],
  ['read a normal file', read('Habait/tour360/fidelity.json'), noUI, 'allow'],
  ['bash cat .env', bash('cat .env'), noUI, 'block'],
  ['bash grep FAL .env.local', bash('grep FAL .env.local'), noUI, 'block'],
  ['node --env-file run', bash('timeout 300 node --env-file=C:/RnD/Projects/Habait/habait-walkaround/.env Habait/tour360/tools/scan-pieces.mjs apt846 --scenes living --force'), yesUI('Allow once'), 'allow'],
  ['node --env-file piped', bash('node --env-file=.env x.mjs | tee out'), noUI, 'block'],
  ['git push', bash('git push origin main'), yesUI('Allow'), 'block'],
  ['paid gen-pano, no UI', bash('node Habait/tour360/tools/gen-pano.mjs apt846 x gpt25-medium --cap 5'), noUI, 'block'],
  ['paid gen-pano --dry', bash('node Habait/tour360/tools/gen-pano.mjs apt846 x gpt25-medium --dry'), noUI, 'allow'],
  ['paid gen-pano, Eliran allows', bash('node Habait/tour360/tools/gen-pano.mjs apt846 x gpt25-medium'), yesUI('Allow once'), 'allow'],
  ['paid gen-pano, Eliran blocks', bash('node Habait/tour360/tools/gen-pano.mjs apt846 x gpt25-medium'), yesUI('Block'), 'block'],
  ['a --go run, no UI', bash('python furn3d.py w sofa c.png "sofa" --go --ledger l.json'), noUI, 'block'],
  ['test deploy, no UI', bash('bash Habait/tour360/tools/ship/deploy-test.sh /tmp/s /tmp/s.log'), noUI, 'block'],
  ['test deploy, allowed', bash('bash Habait/tour360/tools/ship/deploy-test.sh /tmp/s /tmp/s.log'), yesUI('Allow'), 'allow'],
  ['prod deploy, wrong phrase', bash('npx vercel deploy --prod --yes'), yesUI('Allow', 'yes'), 'block'],
  ['prod deploy, typed phrase', bash('npx vercel deploy --prod --yes'), yesUI('Allow', 'מאשר העלאה לקישור הראשי'), 'allow'],
  ['habait-flow named, no UI', bash('vercel promote habait-flow-abc'), noUI, 'block'],
  ['rm -rf in the repo, no UI', bash('rm -rf Habait/tour360/apartments/apt846/panos'), noUI, 'block'],
  ['rm -rf in Temp', bash('rm -rf C:/Users/x/AppData/Local/Temp/stage-1'), noUI, 'allow'],
  ['plain build', bash('node Habait/tour360/tools/build-tour.mjs apt846 --catalog=ai'), noUI, 'allow'],
];
let bad = 0;
for (const [name, ev, ctx, want] of CASES) {
  const r = await handlers.tool_call(ev, ctx); const got = r && r.block ? 'block' : 'allow';
  if (got !== want) bad++;
  console.log(got === want ? 'ok  ' : 'FAIL', name.padEnd(32), got, r && r.reason ? '— ' + r.reason.slice(0, 90) : '');
}
console.log('tools registered:', tools.join(', '));
console.log(bad ? `GUARD TEST: ${bad} FAIL` : `GUARD TEST: PASS (${CASES.length} cases)`); process.exit(bad ? 1 : 0);
