import { NextRequest, NextResponse } from "next/server";
import { askGenie } from "@/lib/navigator-genie";
import { toPublicDatabricksError } from "@/lib/databricks";
import { isOpportunityQuestion, type NavigatorResponse } from "@/lib/opportunities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequest = {
  prompt?: string;
  conversationId?: string;
  messages?: Array<{ role?: string; content?: string }>;
};

export async function POST(request: NextRequest) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const prompt = body.prompt?.trim() || [...(body.messages || [])]
    .reverse()
    .find((message) => message.role === "user")?.content?.trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Enter a campus opportunity question." } }, { status: 400 });
  }
  if (prompt.length > 1_200) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Keep the question under 1,200 characters." } }, { status: 400 });
  }

  if (!isOpportunityQuestion(prompt)) {
    const response: NavigatorResponse = {
      ok: true,
      status: "out_of_scope",
      answer: "Campus Opportunity Navigator only compares verified campus and Bengaluru events, clubs, labs, and recruitment windows. Ask about time, budget, eligibility, interests, or travel limits.",
      opportunities: [],
    };
    return NextResponse.json(response);
  }

  try {
    return NextResponse.json(await askGenie(prompt, {
      conversationId: body.conversationId,
      signal: request.signal,
    }));
  } catch (error) {
    const safe = toPublicDatabricksError(error);
    const response: NavigatorResponse = {
      ok: false,
      status: "unavailable",
      answer: "Campus Genie cannot reach Databricks right now. No recommendation was generated and no demo data was substituted.",
      opportunities: [],
      error: safe.body.error,
    };
    return NextResponse.json(response, { status: safe.status });
  }
}
