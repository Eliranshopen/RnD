// one tiny probe: how does openrouter/router/vision answer with reasoning:true? The key is read by loadEnv from the .env path
// (never printed). Prints only the output text's shape and the cost.
import { loadEnv } from '../files/Projects/Habait/habait-walkaround/Habait/studio/lib/env.mjs';
import { falLLM } from '../files/Projects/Habait/habait-walkaround/Habait/studio/lib/fal-llm.mjs';
const env = loadEnv({ HABAIT_DOTENV: 'C:\\RnD\\Projects\\Habait\\habait-walkaround\\.env' });
const r = await falLLM({ key: env.FAL_KEY, model: env.FAL_LLM_MODEL, system: 'Answer with JSON only.', prompt: 'Return {"ok": true, "n": 3} and nothing else.', maxTokens: 300, temperature: 0, reasoning: true });
console.log(JSON.stringify({ ok: r.ok, usd: r.usd, note: r.note, model: r.model, text_len: r.text?.length, text_head: r.text?.slice(0, 300), usage: r.usage }, null, 1));
