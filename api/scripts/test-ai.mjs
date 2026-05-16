/**
 * Smoke-test all LLM-backed API services.
 * Usage: node scripts/test-ai.mjs [--prod]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const PROD = process.argv.includes("--prod");
const BASE = PROD
  ? "https://coryresumego.vercel.app"
  : `http://127.0.0.1:${process.env.PORT || 3001}`;

const JD =
  "Senior AI Product Designer. React, Three.js, real-time 3D, LLM products. 5+ years.";

const cvData = {
  meta: {
    name: "Yihua Li",
    contact: { email: "test@example.com", web: "https://example.com" },
  },
  sections: [
    {
      id: "profile",
      title: "PROFILE",
      visible: true,
      items: [
        {
          id: "p1",
          visible: true,
          content: {
            type: "text",
            text: "Creative technologist building AI and real-time 3D products.",
          },
        },
      ],
    },
    {
      id: "work",
      title: "EXPERIENCE",
      visible: true,
      items: [
        {
          id: "w1",
          visible: true,
          content: {
            type: "work",
            company: "Example Co",
            role: "AI Product Lead",
            date: "2024 – Present",
            loc: "NYC",
            bullets: ["Shipped LLM features", "Led 3D pipeline"],
          },
        },
      ],
    },
  ],
};

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "OK" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function callApi(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function testLocalServices() {
  const { runTailor } = await import("../lib/tailorService.js");
  const { runCompose } = await import("../lib/composeService.js");
  const { runRewrite } = await import("../lib/rewriteService.js");
  const { chatJson } = await import("../lib/llm.js");
  const { prompts } = await import("../lib/prompts/index.js");
  const { llmProviderLabel } = await import("../lib/llm.js");

  console.log(`\nProvider: ${llmProviderLabel() || "none"}`);
  console.log(`ARK_API_KEY: ${process.env.ARK_API_KEY ? "set" : "missing"}\n`);

  try {
    const t = await runTailor({ cvData, jobDescription: JD, personaId: "hr" });
    record(
      "tailor (local)",
      !t.placeholder && t.plan?.sectionOrder?.length > 0,
      t.placeholder ? "placeholder" : `persona=${t.persona}`,
    );
  } catch (e) {
    record("tailor (local)", false, e.message);
  }

  try {
    const c = await runCompose({
      cvData,
      jobDescription: JD,
      company: "Test Co",
    });
    record(
      "compose (local)",
      !c.placeholder && c.subject && c.body,
      c.placeholder ? "placeholder" : `subject len=${c.subject?.length}`,
    );
  } catch (e) {
    record("compose (local)", false, e.message);
  }

  try {
    const r = await runRewrite({
      content: { type: "text", text: "Built AI tools for creative teams." },
      instruction: "Make punchier for a product role",
      locale: "en",
    });
    record(
      "rewrite (local)",
      r.content?.type === "text" && r.content?.text?.length > 10,
      `provider=${r.provider}`,
    );
  } catch (e) {
    record("rewrite (local)", false, e.message);
  }

  try {
    const llm = await chatJson({
      system: `${prompts.parseSystem()}\n${prompts.parseSchema()}`,
      user: `SOURCE DOCUMENT:\nYihua Li\nAI Product Designer\nReact, Three.js\n\n---\nMap into CV sections. Existing ids: profile, work`,
      maxTokens: 2048,
    });
    record(
      "parse LLM path (local)",
      !llm.placeholder && llm.data?.sections,
      llm.placeholder ? "placeholder" : `provider=${llm.provider}`,
    );
  } catch (e) {
    record("parse LLM path (local)", false, e.message);
  }
}

async function testHttpEndpoints() {
  console.log(`\n--- HTTP ${PROD ? "PROD" : "LOCAL"}: ${BASE} ---\n`);

  const endpoints = [
    {
      name: "POST /api/tailor",
      path: "/api/tailor",
      body: { cvData, jobDescription: JD, persona: "hr" },
      ok: (j) => j.data?.sections && !j.placeholder,
    },
    {
      name: "POST /api/compose",
      path: "/api/compose",
      body: { cvData, jobDescription: JD, company: "Test" },
      ok: (j) => j.subject && j.body && !j.placeholder,
    },
    {
      name: "POST /api/rewrite",
      path: "/api/rewrite",
      body: {
        content: { type: "text", text: "Led AI product development." },
        instruction: "shorter",
        locale: "en",
      },
      ok: (j) => j.content?.type === "text",
    },
    {
      name: "GET /api/views",
      path: "/api/views",
      method: "GET",
      ok: (j) => typeof j.count === "number",
    },
  ];

  for (const ep of endpoints) {
    try {
      const res =
        ep.method === "GET"
          ? await fetch(`${BASE}${ep.path}`)
          : await fetch(`${BASE}${ep.path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ep.body),
            });
      const json = await res.json();
      const pass = res.status === 200 && ep.ok(json);
      record(
        ep.name,
        pass,
        pass
          ? ""
          : `status=${res.status} ${json.error || JSON.stringify(json).slice(0, 120)}`,
      );
    } catch (e) {
      record(ep.name, false, e.message);
    }
  }

}

async function main() {
  console.log(`Mode: ${PROD ? "production" : "local services + optional HTTP"}`);

  if (!PROD) {
    await testLocalServices();
    try {
      const health = await fetch(`${BASE}/health`);
      const info = health.ok ? await health.json() : null;
      if (info?.service === "resume-portfolio-api") {
        await testHttpEndpoints();
      } else {
        console.log("\n(Local API not running — skip HTTP. Run: cd api && npm run dev)\n");
      }
    } catch {
      console.log("\n(Local API not running — skip HTTP. Run: cd api && npm run dev)\n");
    }
  } else {
    await testHttpEndpoints();
  }

  const core = results.filter((r) => r.name.includes("(local)") || PROD);
  const failed = core.filter((r) => !r.ok);
  console.log(`\n=== ${core.length - failed.length}/${core.length} AI checks passed ===`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main();
