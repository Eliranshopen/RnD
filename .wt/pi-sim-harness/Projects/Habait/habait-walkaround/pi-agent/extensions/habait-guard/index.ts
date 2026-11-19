// habait-guard — the safety rails of the Habait simulation agent (2026-11-15, Eliran: «לעטוף את PI AGENT בכל המעטפת»).
//
// Every tool call passes here before it runs:
//   SECRETS  any read/write/edit/grep/find whose path, or any bash command, that touches .env*, auth.json or a key file is BLOCKED.
//            The one exception: `node --env-file=<…>.env <tool>` (Node loads the keys into the child process by name; nothing prints).
//   PUSH     `git push` is BLOCKED (Eliran's rule: local git only; he merges and mirrors).
//   MONEY    a paid step (fal / OpenRouter tools without --dry, any `--go`) asks Eliran first; "this session" remembers the answer
//            for that tool. Print/RPC mode (no UI) blocks it.
//   DEPLOY   any Vercel deploy / promote / alias asks first; a PRODUCTION deploy (`--prod` on a link that is not rainbow-v2-test,
//            or naming habait-flow) needs Eliran to TYPE the confirmation phrase. No UI = blocked.
//   DELETE   rm -r / Remove-Item -Recurse / git reset --hard / git clean outside the temp and scratch folders asks first.
// Tools it adds: habait_spend (the ledgers' totals), habait_fal_status (is fal usable now? one free call; the key by name, never shown).
import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = "C:/RnD/Projects/Habait/habait-walkaround";
const SECRET = /(^|[\s"'=\/\\:])(\.env(\.[\w.-]+)?|auth\.json|[\w.-]*\.(pem|key)|id_(rsa|ed25519))(?=$|[\s"'\/\\;|&)<>])/i;
const ENV_FILE_RUN = /^\s*(timeout\s+\d+\s+)?node\s+--env-file=\S+\s+[^|<>;&]+$/;   // node loads the keys itself; no pipe, no redirect
const PAID: Array<[RegExp, string, (c: string) => boolean]> = [
  [/\bgen-pano\.mjs\b/, "gen-pano (image generation/edit)", (c) => !/--dry\b/.test(c)],
  [/\bskin-project\.mjs\b/, "skin-project (the photoreal look)", (c) => !/--dry\b/.test(c)],
  [/\bauto-trace\.mjs\b/, "auto-trace (vision reading)", (c) => !/--dry\b|--seeds\b|--vlm-file\b/.test(c)],
  [/\bclose-seam\.mjs\b/, "close-seam (band repaint)", (c) => !/--dry\b/.test(c)],
  [/\bfinish-pano\.mjs\b/, "finish-pano (floor finish)", (c) => !/--dry\b/.test(c)],
  [/\bscan-pieces\.mjs\b/, "scan-pieces (≈ $0.04 a scene)", (c) => !/--dry\b/.test(c)],
  [/\bfidelity-gate\.mjs\b/, "fidelity-gate ($0.01 a new picture)", (c) => !/--dry\b|--cg-only\b/.test(c)],
  [/\bconsistency-check\.mjs\b.*--judge\b/, "consistency judge (≈ $0.01)", () => true],
  [/\brun-project\.mjs\b.*(--skin\b|markers)/, "run-project paid steps", () => true],
  [/(^|\s)--go(\s|$)/, "a --go run", () => true],
];
const SAFE_DELETE = /(\\|\/)(Temp|tmp|scratchpad)(\\|\/)/i;

export default function (pi: ExtensionAPI) {
  const allowed = new Set<string>();   // paid tools Eliran allowed for this session

  const ask = async (ctx: any, title: string, body: string, key?: string) => {
    if (!ctx.hasUI) return { block: true, reason: `${title}: needs Eliran's confirmation in an interactive session` };
    if (key && allowed.has(key)) return undefined;
    const choice = await ctx.ui.select(`${title}\n${body}`, key ? ["Allow once", "Allow for this session", "Block"] : ["Allow", "Block"]);
    if (choice === "Allow for this session" && key) { allowed.add(key); return undefined; }
    if (choice === "Allow once" || choice === "Allow") return undefined;
    return { block: true, reason: `${title}: Eliran blocked it` };
  };

  pi.on("tool_call", async (event, ctx) => {
    // SECRETS: file tools by path, bash by command text
    const p = (event.input as any)?.path ?? (event.input as any)?.file_path ?? (event.input as any)?.pattern ?? "";
    if (event.toolName !== "bash" && typeof p === "string" && SECRET.test(" " + p)) {
      return { block: true, reason: "Secrets are never read or written (.env, auth.json, key files). Tools read FAL_KEY by name." };
    }
    if (!isToolCallEventType("bash", event)) return undefined;
    const c = event.input.command;
    if (SECRET.test(" " + c) && !ENV_FILE_RUN.test(c)) {
      return { block: true, reason: "This command touches a secrets file. Never print, copy or grep .env/auth.json. To give a tool the keys: `node --env-file=<repo>/.env <tool> …` with no pipe or redirect." };
    }
    if (/\bgit\s+push\b/.test(c)) return { block: true, reason: "git push is not allowed: local git only; Eliran merges and mirrors." };

    // DEPLOY
    if (/\bvercel\b/.test(c) && /\b(deploy|promote|alias|--prod)\b/.test(c) || /deploy-test\.sh|deploy-tour\.sh/.test(c)) {
      const prod = /--prod\b/.test(c) && !/deploy-test\.sh/.test(c);
      const flow = /habait-flow/.test(c);
      if (prod || flow) {
        if (!ctx.hasUI) return { block: true, reason: "A production deploy needs Eliran's own typed go in an interactive session." };
        const typed = await ctx.ui.input("PRODUCTION deploy — Eliran only. Type exactly: מאשר העלאה לקישור הראשי", "");
        if ((typed || "").trim() !== "מאשר העלאה לקישור הראשי") return { block: true, reason: "Production deploy not confirmed by Eliran." };
        return undefined;
      }
      return ask(ctx, "Deploy to the TEST link (rainbow-v2-test)?", c.slice(0, 300));
    }

    // MONEY
    for (const [re, name, paid] of PAID) {
      if (re.test(c) && paid(c)) return ask(ctx, `Paid step: ${name}`, `${c.slice(0, 300)}\nRun it dry first and quote the estimate. Check the cap.`, name);
    }

    // DELETE
    if (/\brm\s+-[a-z]*r|\bRemove-Item\b.*-Recurse|\bgit\s+reset\s+--hard|\bgit\s+clean\s+-[a-z]*f/i.test(c) && !SAFE_DELETE.test(c)) {
      return ask(ctx, "Delete / reset outside the scratch folders?", c.slice(0, 300));
    }
    return undefined;
  });

  pi.registerTool({
    name: "habait_spend",
    label: "Habait spend",
    description: "Totals of the paid-call ledgers: every apartment's _local/ledger.json and the task ledgers under qa-evidence. Free. Use before and after any paid step.",
    parameters: Type.Object({ apartment: Type.Optional(Type.String({ description: "an apartment id, e.g. apt846; default all" })) }),
    async execute(_id, params) {
      const lines: string[] = [];
      const apts = path.join(REPO, "Habait/tour360/apartments");
      for (const a of fs.existsSync(apts) ? fs.readdirSync(apts) : []) {
        if (params.apartment && a !== params.apartment) continue;
        const f = path.join(apts, a, "_local", "ledger.json");
        if (!fs.existsSync(f)) continue;
        try {
          const j = JSON.parse(fs.readFileSync(f, "utf8")); const rows = Array.isArray(j) ? j : j.rows || [];
          const sum = rows.reduce((s: number, r: any) => s + Number(r.settled_usd ?? r.reserved_usd ?? r.usd ?? 0), 0);
          const last = rows.slice(-3).map((r: any) => `${r.ts || r.at || ""} ${r.op || r.step || ""} ${r.model || r.endpoint || ""} $${r.settled_usd ?? r.reserved_usd ?? r.usd ?? ""}`);
          lines.push(`${a}: $${sum.toFixed(2)} in ${rows.length} rows (cap ${j.cap_usd ?? "?"}) · last: ${last.join(" | ")}`);
        } catch (e) { lines.push(`${a}: ledger unreadable (${(e as Error).message})`); }
      }
      const walk = (d: string, out: string[]) => { for (const n of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const q = path.join(d, n.name); if (n.isDirectory()) walk(q, out); else if (n.name === "ledger.json") out.push(q); } };
      const task: string[] = []; walk(path.join(REPO, "qa-evidence"), task);
      for (const f of task) {
        try { const rows = JSON.parse(fs.readFileSync(f, "utf8")); if (Array.isArray(rows)) lines.push(`${path.relative(REPO, f)}: $${rows.reduce((s: number, r: any) => s + Number(r.usd || 0), 0).toFixed(2)} in ${rows.length} rows`); } catch { /* not a task ledger */ }
      }
      return { content: [{ type: "text", text: lines.join("\n") || "no ledgers found" }], details: {} };
    },
  });

  pi.registerTool({
    name: "habait_fal_status",
    label: "fal status",
    description: "Is fal.ai usable right now? One free call (a storage-token request): 'usable', or 'locked: <reason>' (e.g. Exhausted balance → Eliran tops up). The key is read by name from the repo .env and never shown.",
    parameters: Type.Object({}),
    async execute() {
      let key = process.env.FAL_KEY || "";
      if (!key) {
        try { for (const l of fs.readFileSync(path.join(REPO, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*FAL_KEY\s*=\s*(.*)\s*$/); if (m) key = m[1].replace(/^["']|["']$/g, ""); } } catch { /* no file */ }
      }
      if (!key) return { content: [{ type: "text", text: "FAL_KEY is not set (by name: process env or the repo .env)" }], details: {} };
      const r = await fetch("https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3", { method: "POST", headers: { Authorization: "Key " + key, "Content-Type": "application/json" }, body: "{}" });
      const t = (await r.text()).split(key).join("***");
      const ok = r.status === 200;
      return { content: [{ type: "text", text: ok ? "fal: usable (the balance is above zero)" : `fal: locked or failing — HTTP ${r.status} ${t.replace(/"token":"[^"]+"/, '"token":"…"').slice(0, 200)}` }], details: {} };
    },
  });
}
