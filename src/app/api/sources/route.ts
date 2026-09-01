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

const SEED_KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: "DOC-01",
    name: "Campus Hackathon Handbook 2026.pdf",
    type: "document",
    category: "Guidelines & Rules",
    description: "Official rules, hardware lending policies, judging rubrics, and sponsor API credits for campus hackathons.",
    chunkCount: 48,
    fileSize: "2.4 MB",
    status: "Indexed",
    contentSample: "Hack the Lake 2026 rules: Teams of 1-4 students. All code must be written during the event. Databricks AI Serving and Genie APIs are provided with $200 free cloud credits per team. Submissions are judged on Technical Depth (30%), Practical Impact (30%), User Experience (20%), and Presentation (20%). Food and quiet sleeping zones available in Colt Arena 2nd floor.",
    uploadedBy: "Campus Admin",
    updatedAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "DOC-02",
    name: "CS301 Distributed Systems Syllabus.pdf",
    type: "syllabus",
    category: "Curriculum",
    description: "Course schedule, reading lists on Paxos/Raft, office hours, and project milestones.",
    chunkCount: 36,
    fileSize: "1.1 MB",
    status: "Indexed",
    contentSample: "CS301 covers distributed consensus, ACID guarantees, Delta Lake change data feed, linearizability, and fault tolerance. Midterm date: May 4. Final project requires implementing a high-throughput key-value store with raft consensus in Go/Rust.",
    uploadedBy: "Prof. Vance",
    updatedAt: "2026-04-02T14:30:00Z",
  },
  {
    id: "DOC-03",
    name: "Student Clubs & Funding Policy.md",
    type: "policy",
    category: "Governance",
    description: "Student Senate guide on reserving campus halls, ordering pizza budgets, and security permits.",
    chunkCount: 24,
    fileSize: "480 KB",
    status: "Indexed",
    contentSample: "Registered campus clubs receive up to $1,500/semester for events with free student admission. Event requests must be submitted at least 5 business days in advance. Food distribution requires university catering safety compliance form.",
    uploadedBy: "Dean of Students",
    updatedAt: "2026-04-03T09:15:00Z",
  },
  {
    id: "DOC-04",
    name: "Lakehouse Delta Lake Architecture Whitepaper.pdf",
    type: "technical",
    category: "Lakehouse Reference",
    description: "Technical guide on ACID transactions, Time Travel, Liquid Clustering, and Unity Catalog lineage.",
    chunkCount: 64,
    fileSize: "4.8 MB",
    status: "Indexed",
    contentSample: "Delta Lake is an open-format storage layer that brings reliability to data lakes. Key capabilities include ACID transactions, scalable metadata handling, and unifying streaming and batch data processing. Unity Catalog delivers unified governance across data and AI assets.",
    uploadedBy: "Databricks Research",
    updatedAt: "2026-04-04T16:45:00Z",
  },
  {
    id: "DOC-05",
    name: "Campus Dining & Cafe Hours 2026.json",
    type: "dataset",
    category: "Campus Life",
    description: "Operating hours, dietary menus, allergens, and inventory schedules for campus dining.",
    chunkCount: 12,
    fileSize: "180 KB",
    status: "Live in Lakehouse",
    contentSample: "Central Dining Hall: 7:00 AM - 10:00 PM daily. Campus Cafe (Kemper Hall): 8:00 AM - 8:00 PM. Serving A2 organic milk, handcrafted espresso, and fresh pastries.",
    uploadedBy: "Dining Services",
    updatedAt: "2026-04-05T08:00:00Z",
  },
  {
    id: "DOC-06",
    name: "Autonomous Intelligent Systems Lab Charter.pdf",
    type: "document",
    category: "Research",
    description: "Research scope, GPU cluster compute access rules, weekly reading group schedules, and recruitment requirements.",
    chunkCount: 32,
    fileSize: "1.8 MB",
    status: "Indexed",
    contentSample: "AIS Lab research focuses on autonomous multi-agent systems, VLM navigation, and robotic quadrupeds. Undergraduate researchers get access to 8x H100 cluster nodes and must commit 8-10 hours weekly. Prerequisites: Python proficiency and linear algebra.",
    uploadedBy: "Dr. Jenkins",
    updatedAt: "2026-04-06T11:20:00Z",
  },
  {
    id: "DOC-07",
    name: "ACM Chapter Systems Mentorship Program.md",
    type: "document",
    category: "Guidelines & Rules",
    description: "Structure for junior-senior pair programming, Linux kernel study groups, and mock technical interviews.",
    chunkCount: 20,
    fileSize: "320 KB",
    status: "Indexed",
    contentSample: "The ACM Systems Mentorship matches 1st/2nd year students with experienced upperclassmen and alumni working in infrastructure roles. Weekly 1-on-1 pairing sessions focus on C/C++, concurrent debugging, and open-source contributions.",
    uploadedBy: "ACM Executive Board",
    updatedAt: "2026-04-07T13:00:00Z",
  },
  {
    id: "DOC-08",
    name: "Bengaluru Tech Community Hub Directory.json",
    type: "dataset",
    category: "Campus Life",
    description: "Curated registry of Bangalore developer meetups, hackathons, incubator demo days, and transit directions.",
    chunkCount: 16,
    fileSize: "210 KB",
    status: "Live in Lakehouse",
    contentSample: "Listing top developer communities across Indiranagar, Koramangala, and HSR Layout including GenAI BLR, Rustaceans South India, and Bangalore Open Source Group with commute estimates from campus gates.",
    uploadedBy: "Community Lead",
    updatedAt: "2026-04-08T15:30:00Z",
  },
];

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
    rowCount: 8,
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
    50
  );

  let sources: KnowledgeSource[] = SEED_KNOWLEDGE_SOURCES;

  if (result.state === "SUCCEEDED" && result.records && result.records.length > 0) {
    sources = result.records.map((r: any) => ({
      id: r.source_id || `DOC-${Date.now()}`,
      name: r.name || "Untitled Source",
      type: (r.type as KnowledgeSource["type"]) || "document",
      category: r.category || "General",
      description: r.description || "",
      chunkCount: Number(r.chunk_count) || 12,
      fileSize: r.file_size || "1.0 MB",
      status: (r.status as KnowledgeSource["status"]) || "Indexed",
      contentSample: r.content_sample,
      uploadedBy: r.uploaded_by || "Campus Admin",
      updatedAt: r.updated_at,
    }));
  }

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
    totalChunks: sources.reduce((acc, s) => acc + (s.chunkCount || 0), 0),
    source: result.state === "SUCCEEDED" && result.records ? "lakehouse" : "seed",
  });
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

    return NextResponse.json({
      success: true,
      docId,
      state: result.state,
      message: "Document indexed into Databricks Unity Catalog Knowledge Base.",
      document: {
        id: docId,
        name,
        type,
        category,
        description,
        chunkCount,
        fileSize,
        status: "Indexed",
        contentSample: content.slice(0, 300),
        uploadedBy,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[Create Source Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const deleteSql = `DELETE FROM workspace.campus_explorer.knowledge_sources WHERE source_id = '${id.replace(/'/g, "''")}'`;
    const result = await executeLakehouseSql(deleteSql);

    return NextResponse.json({
      success: true,
      deletedId: id,
      state: result.state,
      message: "Document deleted from Databricks Lakehouse.",
    });
  } catch (err: any) {
    console.error("[Delete Source Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
