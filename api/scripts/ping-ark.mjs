/**
 * Fast Ark connectivity probe — minimal chat call to confirm the API works
 * (endpoint reachable, key valid, model name valid) and report latency.
 * Separates "slow generation" from "broken API".
 * Usage: node api/scripts/ping-ark.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const ARK_BASE = (
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3"
).replace(/\/$/, "");
const MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-pro-260215";
const KEY = process.env.ARK_API_KEY;

if (!KEY) {
  console.error("ARK_API_KEY missing — set it in .env");
  process.exit(1);
}

console.log(`Probing ${ARK_BASE}/chat/completions  model=${MODEL}\n`);

async function probe(label, extra) {
  const body = {
    model: MODEL,
    max_tokens: 200,
    messages: [
      { role: "system", content: "Reply with a single JSON object only." },
      { role: "user", content: 'Return {"ok":true}' },
    ],
    ...extra,
  };
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${ARK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[${label}] NETWORK FAIL after ${Date.now() - t0}ms:`, err.message);
    return;
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log(`[${label}] status=${res.status} latency=${ms}ms (non-JSON)`);
    console.log(text.slice(0, 300));
    return;
  }
  const msg = json.choices?.[0]?.message ?? {};
  const reasoning = (msg.reasoning_content || "").length;
  console.log(
    `[${label}] status=${res.status} latency=${ms}ms ` +
      `reasoning_chars=${reasoning} usage=${JSON.stringify(json.usage || json.error || {})}`,
  );
}

await probe("default", {});
await probe("thinking:disabled", { thinking: { type: "disabled" } });
