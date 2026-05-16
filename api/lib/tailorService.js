import { getPersona } from "./personas.js";
import { cvDataToText } from "./cvText.js";
import { chatJson } from "./llm.js";
import { applyTailorPlan } from "./applyTailorPlan.js";
import { prompts } from "./prompts/index.js";

/** Rule-based fallback when no API key */
function fallbackPlan(data, persona, jobDescription) {
  const presetOrder = {
    hr: ["profile", "work", "projects", "skills", "education", "awards", "publications", "exhibitions", "talks", "press", "references"],
    curator: ["profile", "exhibitions", "projects", "publications", "awards", "press", "education", "talks", "work", "references"],
    immigration: ["profile", "projects", "awards", "publications", "exhibitions", "press", "education", "talks", "work", "references"],
  };
  const order = presetOrder[persona.id] ?? presetOrder.hr;
  const jd = (jobDescription || "").toLowerCase();
  const hiddenSections = [];
  if (!/research|paper|academic|phd|university/i.test(jd)) {
    if (persona.id === "hr") hiddenSections.push("publications");
  }
  return {
    sectionOrder: order.filter((id) => data.sections.some((s) => s.id === id)),
    hiddenSections,
    hiddenItems: [],
    profileRewrites: [],
    summary: `[Offline] Applied ${persona.label} section order. Set ARK_API_KEY or Ollama.`,
    highlights: ["Connect LLM for JD-aware tailoring"],
    hookLine: "",
  };
}

export async function runTailor({ cvData, jobDescription, personaId }) {
  const persona = getPersona(personaId);
  const jd = String(jobDescription ?? "").trim().slice(0, 12000);
  if (!jd) {
    const err = new Error("jobDescription is required");
    err.status = 400;
    throw err;
  }

  const system = `${persona.system}

You will receive a full CV as JSON lines and a job description.
${prompts.tailorSchema()}

${prompts.tailorRules()}`;

  const user = `JOB DESCRIPTION:\n${jd}\n\n---\nCV:\n${cvDataToText(cvData)}`;

  let plan;
  let placeholder = false;

  const llm = await chatJson({ system, user, maxTokens: 3072 });
  if (llm.placeholder) {
    placeholder = true;
    plan = fallbackPlan(cvData, persona, jd);
  } else {
    plan = llm.data;
  }

  const tailoredData = applyTailorPlan(cvData, plan);

  return {
    persona: persona.id,
    personaLabel: persona.label,
    preset: persona.preset,
    plan,
    hookLine: plan.hookLine || "",
    data: tailoredData,
    placeholder,
  };
}
