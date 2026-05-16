import { parseJsonFromModel } from "./parseModelJson.js";

const ARK_BASE =
  process.env.ARK_BASE_URL?.replace(/\/$/, "") ||
  "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-pro-260215";

// Total time budget for an Ark request, kept under Vercel's 60s function cap
// so a slow generation fails cleanly (500) instead of being killed (504).
const DEADLINE_MS = Number(process.env.ARK_DEADLINE_MS) || 55000;
// Cap on the Responses-API attempt so a slow failure cannot starve the
// chat/completions fallback of budget.
const RESPONSES_CAP_MS = Number(process.env.ARK_RESPONSES_TIMEOUT_MS) || 20000;

/** fetch() bounded by an AbortController; aborts surface as fallback-able errors */
async function fetchWithTimeout(url, options, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    const e = new Error("Ark request budget exhausted before send");
    e.fallbackChat = true;
    throw e;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error(`Ark request timed out after ${timeoutMs}ms`);
      e.fallbackChat = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function textFromContent(content) {
  if (typeof content === "string" && content.trim()) return content;
  if (!Array.isArray(content)) return null;

  const parts = [];
  for (const c of content) {
    if (!c || typeof c !== "object") continue;
    const type = String(c.type || "");
    if (type === "refusal" || type === "reasoning" || type === "reasoning_text") {
      continue;
    }
    if (typeof c.text === "string" && c.text.trim()) parts.push(c.text);
    else if (typeof c.output_text === "string" && c.output_text.trim()) {
      parts.push(c.output_text);
    } else if (typeof c.content === "string" && c.content.trim()) {
      parts.push(c.content);
    }
  }
  return parts.length ? parts.join("\n") : null;
}

function extractFromOutputItem(item) {
  if (!item || typeof item !== "object") return null;

  const type = String(item.type || "");

  if (type === "message" || type === "assistant" || item.role === "assistant") {
    const fromContent = textFromContent(item.content);
    if (fromContent) return fromContent;
  }

  if (
    (type === "output_text" || type === "text" || type === "text_delta") &&
    typeof item.text === "string" &&
    item.text.trim()
  ) {
    return item.text;
  }

  if (typeof item.text === "string" && item.text.trim()) return item.text;
  if (typeof item.output_text === "string" && item.output_text.trim()) {
    return item.output_text;
  }

  if (item.content) {
    const nested = textFromContent(item.content);
    if (nested) return nested;
  }

  return null;
}

function collectOutputItems(json) {
  const candidates = [
    json.output,
    json.response?.output,
    json.result?.output,
    json.data?.output,
  ];

  const items = [];
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) items.push(...c);
    else if (typeof c === "object") items.push(c);
  }
  return items;
}

/** Parse text from Ark Responses or Chat Completions payloads */
export function extractArkText(json) {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid Ark response");
  }

  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text;
  }

  if (typeof json.text === "string" && json.text.trim()) {
    return json.text;
  }

  for (const item of collectOutputItems(json)) {
    const text = extractFromOutputItem(item);
    if (text) return text;
  }

  const message = json.message ?? json.response?.message;
  if (message) {
    const fromMessage = textFromContent(message.content) ?? extractFromOutputItem(message);
    if (fromMessage) return fromMessage;
  }

  const chat = json.choices?.[0]?.message?.content;
  if (typeof chat === "string" && chat.trim()) return chat;
  if (Array.isArray(chat)) {
    const fromChat = textFromContent(chat);
    if (fromChat) return fromChat;
  }

  const status = json.status ?? json.response?.status;
  const snippet = JSON.stringify(json).slice(0, 600);
  console.error(
    "[ark] No text in response",
    status ? `status=${status}` : "",
    snippet,
  );
  const err = new Error(
    `No text in Ark response${status ? ` (status=${status})` : ""}`,
  );
  err.fallbackChat = true;
  err.arkSnippet = snippet;
  throw err;
}

function useResponsesApi() {
  if (process.env.ARK_PREFER_CHAT === "1") return false;
  if (process.env.ARK_USE_RESPONSES === "0") return false;
  // Responses + reasoning models often exceed Vercel's 60s function limit
  if (process.env.VERCEL === "1") return false;
  return true;
}

/** @see https://www.volcengine.com/docs/82379/1569618 */
async function arkResponsesJson({ system, user, maxTokens, apiKey, model, timeoutMs }) {
  const body = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: user }],
      },
    ],
    max_output_tokens: maxTokens,
  };

  if (process.env.ARK_JSON_MODE !== "0") {
    body.text = { format: { type: "json_object" } };
  }

  const res = await fetchWithTimeout(
    `${ARK_BASE}/responses`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const err = await res.text();
    const e = new Error(`Ark Responses ${res.status}: ${err.slice(0, 400)}`);
    e.fallbackChat = true;
    throw e;
  }

  const json = await res.json();
  const status = json.status ?? json.response?.status;
  if (status && status !== "completed" && status !== "succeeded") {
    try {
      return parseJsonFromModel(extractArkText(json));
    } catch {
      const e = new Error(`Ark Responses incomplete: status=${status}`);
      e.fallbackChat = true;
      throw e;
    }
  }

  return parseJsonFromModel(extractArkText(json));
}

/** OpenAI-compatible Chat API on Ark (no response_format — many Ark models reject json_object) */
async function arkChatCompletionsJson({ system, user, maxTokens, apiKey, model, timeoutMs }) {
  const jsonHint =
    process.env.ARK_JSON_MODE === "0"
      ? ""
      : "\n\nReply with a single valid JSON object only. No markdown fences.";

  const body = {
    model,
    temperature: 0.35,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system + jsonHint },
      { role: "user", content: user },
    ],
  };

  const res = await fetchWithTimeout(
    `${ARK_BASE}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ark Chat ${res.status}: ${err.slice(0, 400)}`);
  }

  const json = await res.json();
  let raw;
  try {
    raw = extractArkText(json);
  } catch {
    raw = json.choices?.[0]?.message?.content ?? "{}";
  }
  return parseJsonFromModel(typeof raw === "string" ? raw : JSON.stringify(raw));
}

export async function arkChatJson({ system, user, maxTokens = 2048 }) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return { placeholder: true, data: null, provider: "ark" };

  const model = process.env.ARK_MODEL || DEFAULT_MODEL;
  const deadline = Date.now() + DEADLINE_MS;

  if (useResponsesApi()) {
    try {
      const timeoutMs = Math.min(RESPONSES_CAP_MS, deadline - Date.now());
      const data = await arkResponsesJson({
        system,
        user,
        maxTokens,
        apiKey,
        model,
        timeoutMs,
      });
      return { placeholder: false, data, provider: "ark", model };
    } catch (err) {
      console.warn(
        "[ark] Responses API failed, falling back to chat/completions:",
        err.message?.slice(0, 200),
      );
    }
  }

  const data = await arkChatCompletionsJson({
    system,
    user,
    maxTokens,
    apiKey,
    model,
    timeoutMs: deadline - Date.now(),
  });
  return { placeholder: false, data, provider: "ark-chat", model };
}
