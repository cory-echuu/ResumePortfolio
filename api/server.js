import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });
import cors from "cors";
import express from "express";
import { runTailor } from "./lib/tailorService.js";
import { runCompose } from "./lib/composeService.js";
import { runParse } from "./lib/parseService.js";
import { runRewrite } from "./lib/rewriteService.js";
import { getViewCount, incrementViewCount, viewsStorageMode } from "./lib/viewStore.js";
import { llmProviderLabel } from "./lib/llm.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : true;

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "resume-portfolio-api",
    time: new Date().toISOString(),
    viewsStorage: viewsStorageMode(),
    llm: process.env.LLM_PROVIDER || "auto",
    ollama: Boolean(process.env.OLLAMA_MODEL || process.env.OLLAMA_ENABLED || process.env.LLM_PROVIDER === "ollama"),
    ollamaModel: process.env.OLLAMA_MODEL || "qwen2.5-coder:1.5b",
    ark: Boolean(process.env.ARK_API_KEY),
    arkModel: process.env.ARK_MODEL || "doubao-seed-2-0-pro-260215",
    openai: Boolean(process.env.OPENAI_API_KEY),
    activeLlm: llmProviderLabel(),
  });
});

app.get("/api/views", async (_req, res) => {
  try {
    const count = await getViewCount();
    res.json({ count, storage: viewsStorageMode() });
  } catch (err) {
    console.error("[GET /api/views]", err);
    res.status(500).json({ error: "views failed" });
  }
});

app.post("/api/views", async (_req, res) => {
  try {
    const count = await incrementViewCount();
    res.json({ count, storage: viewsStorageMode() });
  } catch (err) {
    console.error("[POST /api/views]", err);
    res.status(500).json({ error: "views failed" });
  }
});

app.post("/api/tailor", async (req, res) => {
  try {
    const { cvData, jobDescription, persona = "hr" } = req.body ?? {};
    if (!cvData?.sections) {
      return res.status(400).json({ error: "cvData with sections is required" });
    }
    const result = await runTailor({ cvData, jobDescription, personaId: persona });
    return res.json(result);
  } catch (err) {
    console.error("[POST /api/tailor]", err);
    return res.status(err.status || 500).json({ error: err.message || "tailor failed" });
  }
});

app.post("/api/compose", async (req, res) => {
  try {
    const { cvData, jobDescription, recipientName, company } = req.body ?? {};
    if (!cvData?.sections) {
      return res.status(400).json({ error: "cvData with sections is required" });
    }
    const result = await runCompose({ cvData, jobDescription, recipientName, company });
    return res.json(result);
  } catch (err) {
    console.error("[POST /api/compose]", err);
    return res.status(err.status || 500).json({ error: err.message || "compose failed" });
  }
});

app.post("/api/parse", async (req, res) => {
  try {
    const { base64, fileName, mimeType, cvData, locale } = req.body ?? {};
    if (!cvData?.sections) {
      return res.status(400).json({ error: "cvData required" });
    }
    const result = await runParse({ base64, fileName, mimeType, cvData, locale });
    return res.json(result);
  } catch (err) {
    console.error("[POST /api/parse]", err);
    return res.status(err.status || 500).json({ error: err.message || "parse failed" });
  }
});

app.post("/api/rewrite", async (req, res) => {
  try {
    const { content, instruction, locale } = req.body ?? {};
    if (!content?.type) {
      return res.status(400).json({ error: "content with type required" });
    }
    const result = await runRewrite({ content, instruction, locale });
    return res.json(result);
  } catch (err) {
    console.error("[POST /api/rewrite]", err);
    return res.status(err.status || 500).json({ error: err.message || "rewrite failed" });
  }
});

/** @deprecated use /api/tailor or /api/compose */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body ?? {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required (string)" });
  }
  return res.json({
    reply:
      "Use POST /api/tailor (JD + persona) or POST /api/compose (cover letter).",
    placeholder: true,
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, () => {
  console.log(`Resume API listening on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  GET  /api/views`);
  console.log(`  POST /api/views`);
  console.log(`  POST /api/tailor`);
  console.log(`  POST /api/compose`);
  console.log(`  POST /api/parse`);
  console.log(`  POST /api/rewrite`);
});
