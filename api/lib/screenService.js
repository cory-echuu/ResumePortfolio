import { cvDataToText } from "./cvText.js";
import { chatJson } from "./llm.js";
import { prompts } from "./prompts/index.js";

function fallbackScreen() {
  return {
    hookLine: "[Offline] Configure ARK_API_KEY or Ollama for HR screening.",
    hookLineAlt: "",
    atsScore: null,
    atsVerdict: "unknown",
    atsGaps: [],
    machineScreenNotes: "",
    collaborationAngle: "",
    personaReviews: {},
    topFixes: ["Connect LLM API"],
    overallRecommendation: "tailor_more",
    placeholder: true,
  };
}

export async function runScreen({ cvData, jobDescription, locale = "en" }) {
  const jd = String(jobDescription ?? "").trim().slice(0, 12000);
  const lang =
    locale === "zh"
      ? "Write hookLine and reviews primarily in Chinese; keep proper nouns in English when needed."
      : "Write in English.";

  const system = `${prompts.screenSystem()}

${prompts.screenSchema()}

${lang}`;

  const user = jd
    ? `JOB DESCRIPTION:\n${jd}\n\n---\nCV:\n${cvDataToText(cvData)}`
    : `No JD provided — evaluate as a strong creative technologist / product designer general application.\n\n---\nCV:\n${cvDataToText(cvData)}`;

  const maxTokens = process.env.VERCEL ? 2500 : 4096;
  const llm = await chatJson({ system, user, maxTokens });
  if (llm.placeholder) {
    return fallbackScreen();
  }

  return { ...llm.data, placeholder: false, provider: llm.provider };
}
