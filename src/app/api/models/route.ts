import { NextResponse } from "next/server";
import { DEFAULT_AVAILABLE_MODELS, type LLMModelConfig } from "@/lib/llm";

export async function GET() {
  const envModel = process.env.LLM_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL;
  const envBaseUrl = process.env.LLM_BASE_URL;
  const hasApiKey = Boolean(
    process.env.LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.DATABRICKS_TOKEN
  );

  const isReasoning = Boolean(
    envModel &&
      (envModel.toLowerCase().includes("r1") ||
        envModel.toLowerCase().includes("thinking") ||
        envModel.toLowerCase().includes("o3") ||
        envModel.toLowerCase().includes("o1") ||
        envModel.toLowerCase().includes("reason"))
  );

  const envEntry: LLMModelConfig = {
    id: "env-default",
    name: "Campus Genie Agent",
    provider: "databricks",
    isReasoning: true,
  };

  const models: LLMModelConfig[] = [
    envEntry,
    ...DEFAULT_AVAILABLE_MODELS.filter((m) => m.id !== "env-default"),
  ];

  return NextResponse.json({
    models,
    defaultModel: "env-default",
    envModel: envModel || null,
    hasApiKey,
    envBaseUrl: envBaseUrl || null,
  });
}
