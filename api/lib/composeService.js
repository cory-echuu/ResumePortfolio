import { cvDataToText } from "./cvText.js";
import { chatJson } from "./llm.js";
import { prompts } from "./prompts/index.js";

function fallbackLetter({ recipientName, jobDescription, cvData }) {
  const name = cvData?.meta?.name ?? "Yihua Li";
  const subject = `Application — ${jobDescription.slice(0, 60).replace(/\s+/g, " ")}`;
  const body = `Hi${recipientName ? ` ${recipientName}` : ""},

I'm ${name}. I'm reaching out about the role you posted — the focus on ${jobDescription.slice(0, 80).replace(/\n/g, " ")} lines up with work I've been doing in AI products and real-time creative systems (SIGGRAPH, shipping at scale, and my project Echuu).

I'd love to share how I can help your team. My CV is linked below; happy to jump on a short call if useful.

Best,
${name}
${cvData?.meta?.contact?.web ?? ""}`;
  return { subject, body, hookLine: "", placeholder: true };
}

export async function runCompose({ cvData, jobDescription, recipientName, company }) {
  const jd = String(jobDescription ?? "").trim().slice(0, 8000);
  if (!jd) {
    const err = new Error("jobDescription is required");
    err.status = 400;
    throw err;
  }

  const user = `Company: ${company ?? "(not specified)"}
Recipient: ${recipientName ?? "(hiring manager)"}
JD:\n${jd}\n\nCV:\n${cvDataToText(cvData)}`;

  const llm = await chatJson({ system: prompts.compose(), user, maxTokens: 2048 });
  if (llm.placeholder) {
    return fallbackLetter({ recipientName, jobDescription: jd, cvData });
  }

  const { subject, body, hookLine } = llm.data ?? {};
  if (!subject || !body) {
    return fallbackLetter({ recipientName, jobDescription: jd, cvData });
  }
  return { subject, body, hookLine: hookLine || "", placeholder: false };
}
