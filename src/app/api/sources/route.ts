import { NextRequest, NextResponse } from "next/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type KnowledgeSource = {
  id: string;
  name: string;
  type: "document" | "syllabus" | "policy" | "technical" | "dataset";
  category: string;
  description: string;
  chunkCount: number;
  fileSize: string;
  status: "Indexed" | "Syncing" | "Live in Lakehouse";
  contentSample?: string;
  uploadedBy?: string;
  updatedAt?: string;
};

const LAKEHOUSE_TABLES_INFO = [
  {
    name: "campus_events",
    schema: "workspace.campus_explorer",
    rowCount: 14,
    type: "Managed Delta Table",
    description: "All campus hackathons, workshops, social mixers, career chats, and sports events with real-time RSVP counts.",
  },
  {
    name: "campus_surveys",
    schema: "workspace.campus_explorer",
    rowCount: 2,
    type: "Managed Delta Table",
    description: "Student feedback, hackathon track votes, and pre-event preferences.",
  },
  {
    name: "knowledge_sources",
    schema: "workspace.campus_explorer",
    rowCount: 5,
    type: "Governed RAG Table",
    description: "Indexed student handbooks, policies, and syllabi for LLM grounded context.",
  },
  {
    name: "clubs_and_labs",
    schema: "workspace.campus_explorer",
    rowCount: 4,
    type: "Managed Delta Table",
    description: "Active research labs (AI, Systems) and student technical clubs with open recruitment positions.",
  },
  {
    name: "city_tech_events",
    schema: "workspace.campus_explorer",
    rowCount: 3,
    type: "External Delta Feed",
    description: "Bengaluru tech community meetups, hackathons, and commute duration from campus.",
  },
  {
    name: "alumni_career_pathways",
    schema: "workspace.campus_explorer",
    rowCount: 2,
    type: "Analytical View",
    description: "Past student club trajectories mapped to ML / SDE roles at Databricks, Stripe, and Microsoft.",
  },
  {
    name: "procurement_inventory",
    schema: "workspace.campus_explorer",
    rowCount: 3,
    type: "Supply Chain Table",
    description: "Campus cafe dairy, waffle cones, and chocolate chips inventory for automated restock approval orders.",
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.toLowerCase();

  const result = await executeLakehouseSql(
    "SELECT * FROM workspace.campus_explorer.knowledge_sources ORDER BY updated_at DESC",
    undefined,
    20
  );

  if (result.state === "SUCCEEDED" && result.records) {
    let sources: KnowledgeSource[] = result.records.map((r) => ({
      id: r.source_id || `DOC-${Date.now()}`,
      name: r.name || "Untitled Source",
      type: r.type || "document",
      category: r.category || "General",
      description: r.description || "",
      chunkCount: Number(r.chunk_count) || 12,
      fileSize: r.file_size || "1.0 MB",
      status: (r.status as KnowledgeSource["status"]) || "Indexed",
      contentSample: r.content_sample,
      uploadedBy: r.uploaded_by || "Campus Admin",
      updatedAt: r.updated_at,
    }));

    if (query) {
      sources = sources.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.category.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          (s.contentSample && s.contentSample.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({
      sources,
      tables: LAKEHOUSE_TABLES_INFO,
      totalChunks: sources.reduce((acc, s) => acc + s.chunkCount, 0),
      source: "lakehouse",
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
    const docId = body.id || `DOC-${Date.now().toString().slice(-4)}`;
    const name = (body.name || "Uploaded Document.pdf").replace(/'/g, "''");
    const type = (body.type || "document").toLowerCase();
    const category = (body.category || "General").replace(/'/g, "''");
    const description = (body.description || "Student uploaded reference document.").replace(/'/g, "''");
    const chunkCount = parseInt(body.chunkCount) || Math.floor(Math.random() * 20) + 12;
    const fileSize = body.fileSize || "1.4 MB";
    const content = (body.content || body.contentSample || description).replace(/'/g, "''");
    const uploadedBy = (body.uploadedBy || "Student User").replace(/'/g, "''");

    const insertSql = `
      INSERT INTO workspace.campus_explorer.knowledge_sources VALUES (
        '${docId}', '${name}', '${type}', '${category}', '${description}',
        ${chunkCount}, '${fileSize}', 'Indexed', '${content}', '${uploadedBy}',
        current_timestamp()
      )
    `;

    const result = await executeLakehouseSql(insertSql);

    if (result.state === "SUCCEEDED") {
      return NextResponse.json({
        success: true,
        docId,
        state: result.state,
        message: "Document indexed in Databricks Unity Catalog Knowledge Base.",
      });
    }

    return NextResponse.json(
      { error: result.error || "Failed to index document into Databricks Lakehouse" },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("[Create Source Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
