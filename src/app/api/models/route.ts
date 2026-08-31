import { NextResponse } from "next/server";
import { AVAILABLE_MODELS, type LLMModelConfig } from "@/lib/llm";

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

  let models: LLMModelConfig[] = [...AVAILABLE_MODELS];

  if (envModel) {
    const existing = models.find((m) => m.id === envModel);
    if (!existing) {
      models.unshift({
        id: envModel,
        name: `Custom (${envModel})`,
        provider: "custom",
        isReasoning: envModel.toLowerCase().includes("r1") || envModel.toLowerCase().includes("thinking") || envModel.toLowerCase().includes("o3") || envModel.toLowerCase().includes("o1"),
      });
    }
  }

  return NextResponse.json({
    models,
    defaultModel: envModel || AVAILABLE_MODELS[0].id,
    hasApiKey,
    envBaseUrl: envBaseUrl || null,
  });
}
