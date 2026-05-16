import { parseJsonFromModel } from "./parseModelJson.js";
import { extractArkText } from "./ark.js";

const ARK_BASE =
  process.env.ARK_BASE_URL?.replace(/\/$/, "") ||
  "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_MODEL = process.env.ARK_MODEL || "doubao-seed-2-0-pro-260215";

/** Multimodal parse via Ark Responses API */
export async function parseWithArkVision({ system, user, imageDataUri }) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return { placeholder: true, data: null };

  const model = process.env.ARK_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${ARK_BASE}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageDataUri },
            { type: "input_text", text: user },
          ],
        },
      ],
      max_output_tokens: 4096,
      text: { format: { type: "json_object" } },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ark vision ${res.status}: ${err.slice(0, 400)}`);
  }

  const json = await res.json();
  let raw;
  try {
    raw = extractArkText(json);
  } catch (err) {
    const status = json.status ?? json.response?.status;
    throw new Error(
      `Ark vision: no text${status ? ` (status=${status})` : ""}: ${err.message}`,
    );
  }

  return { placeholder: false, data: parseJsonFromModel(raw), provider: "ark-vision", model };
}
