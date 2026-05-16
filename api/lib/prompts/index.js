import { loadPrompt } from "./loadPrompt.js";

export const prompts = {
  personas: {
    hr: () => loadPrompt("personas-hr"),
    curator: () => loadPrompt("personas-curator"),
    immigration: () => loadPrompt("personas-immigration"),
  },
  tailorSchema: () => loadPrompt("tailor-schema"),
  tailorRules: () => loadPrompt("tailor-rules"),
  compose: () => loadPrompt("compose"),
  parseSchema: () => loadPrompt("parse-schema"),
  parseSystem: () => loadPrompt("parse-system"),
  rewrite: () => loadPrompt("rewrite"),
};
