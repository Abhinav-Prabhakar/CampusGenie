import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";
import { requireAdminUser } from "@/lib/appUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SurveyQuestion = {
  id: string;
  type: "text" | "radio" | "checkbox" | "scale" | "star";
  title: string;
  required: boolean;
  options?: string[];
  scaleMin?: string;
  scaleMax?: string;
};

export type CampusSurvey = {
  id: string;
  title: string;
  description: string;
  targetEventId?: string;
  isPublished: boolean;
  isFeatured: boolean;
  audience: string;
  responseCount: number;
  questions: SurveyQuestion[];
  createdAt?: string;
};

function mapRowToSurvey(r: Record<string, any>): CampusSurvey {
  let questions: SurveyQuestion[] = [];
  if (typeof r.questions_json === "string") {
    try {
      questions = JSON.parse(r.questions_json);
    } catch {
      questions = [];
    }
  } else if (Array.isArray(r.questions_json)) {
    questions = r.questions_json;
  }

  return {
    id: r.survey_id || `SRV-${Date.now()}`,
    title: r.title || "Campus Survey",
    description: r.description || "",
    targetEventId: r.target_event_id,
    isPublished: Boolean(r.is_published),
    isFeatured: Boolean(r.is_featured),
    audience: r.audience || "public",
    responseCount: Number(r.response_count) || 0,
    questions,
    createdAt: r.created_at,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const featuredOnly = searchParams.get("featured") === "true";

  const whereClause = featuredOnly ? "WHERE is_published = true AND is_featured = true" : "WHERE is_published = true";
  const result = await executeLakehouseSql(
    `SELECT * FROM workspace.campus_explorer.campus_surveys ${whereClause} ORDER BY created_at DESC`,
    undefined,
    20
  );

  if (result.state === "SUCCEEDED" && result.records) {
    const surveys = result.records.map(mapRowToSurvey);
    return NextResponse.json({
      surveys,
      source: "lakehouse",
      count: surveys.length,
    });
  }

  return NextResponse.json(
    {
      error: result.error || `Lakehouse query failed with state: ${result.state}`,
      state: result.state,
    },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "create";

    if (action === "submit_response") {
      const surveyId = body.surveyId;
      if (!surveyId) {
        return NextResponse.json({ error: "Missing surveyId" }, { status: 400 });
      }
      const updateRes = await executeLakehouseSql(
        "UPDATE workspace.campus_explorer.campus_surveys SET response_count = response_count + 1 WHERE survey_id = :survey_id",
        undefined,
        30,
        [{ name: "survey_id", value: String(surveyId) }]
      );
      if (updateRes.state === "SUCCEEDED") {
        return NextResponse.json({ success: true, message: "Response recorded" });
      }
      return NextResponse.json({ error: updateRes.error || "Failed to update response count" }, { status: 500 });
    }

    // Create / Publish new survey — admin only
    const guard = await requireAdminUser();
    if (guard.error) {
      return NextResponse.json({ error: guard.error.message }, { status: guard.error.status });
    }

    const surveyId = body.id || `SRV-${Date.now().toString().slice(-4)}`;
    const title = String(body.title || "Untitled Survey");
    const desc = String(body.description || body.desc || "");
    const targetEventId = body.targetEventId ? String(body.targetEventId) : null;
    const isPublished = body.isPublished !== false;
    const isFeatured = Boolean(body.isFeatured);
    const audience = body.audience || "public";
    const questionsJson = JSON.stringify(body.questions || []);
    const createdBy = guard.user.userId;

    const insertSql = `
      INSERT INTO workspace.campus_explorer.campus_surveys (survey_id, title, description, target_event_id,
        is_published, is_featured, audience, response_count, questions_json, created_at, created_by)
      VALUES (
        :survey_id, :title, :description, :target_event_id,
        :is_published, :is_featured, :audience, 0,
        :questions_json, current_timestamp(), :created_by
      )
    `;

    const result = await executeLakehouseSql(insertSql, undefined, 30, [
      { name: "survey_id", value: String(surveyId) },
      { name: "title", value: title },
      { name: "description", value: desc },
      { name: "target_event_id", value: targetEventId },
      { name: "is_published", value: isPublished, type: "BOOLEAN" },
      { name: "is_featured", value: isFeatured, type: "BOOLEAN" },
      { name: "audience", value: String(audience) },
      { name: "questions_json", value: questionsJson },
      { name: "created_by", value: createdBy },
    ]);

    if (result.state === "SUCCEEDED") {
      return NextResponse.json({
        success: true,
        surveyId,
        state: result.state,
        message: "Survey saved to Lakehouse and published.",
      });
    }

    return NextResponse.json(
      { error: result.error || "Failed to insert survey into Databricks Lakehouse" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[Create Survey Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
