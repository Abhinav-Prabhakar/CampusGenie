import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeLakehouseSql } from "@/lib/lakehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ThreadPayload = {
  id: string;
  title: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
};

function mapRowToThread(r: Record<string, any>): ThreadPayload {
  let messages: unknown[] = [];
  if (typeof r.messages_json === "string") {
    try {
      const parsed = JSON.parse(r.messages_json);
      if (Array.isArray(parsed)) messages = parsed;
    } catch {
      messages = [];
    }
  }
  return {
    id: r.thread_id,
    title: r.title || "Untitled chat",
    messages,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const result = await executeLakehouseSql(
    `SELECT thread_id, title, messages_json, created_at, updated_at
     FROM workspace.campus_explorer.chat_threads
     WHERE user_id = :user_id
     ORDER BY updated_at DESC`,
    undefined,
    50,
    [{ name: "user_id", value: userId }]
  );

  if (result.state === "SUCCEEDED" && result.records) {
    return NextResponse.json(
      { threads: result.records.map(mapRowToThread) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    { error: result.error || `Lakehouse query failed with state: ${result.state}` },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const threadId = String(body.id || "");
    if (!threadId) {
      return NextResponse.json({ error: "Missing thread id" }, { status: 400 });
    }

    const title = String(body.title || "Untitled chat").slice(0, 200);
    const messagesJson = JSON.stringify(Array.isArray(body.messages) ? body.messages : []);
    const createdAt = Number(body.createdAt) || Date.now();
    const updatedAt = Number(body.updatedAt) || Date.now();

    const mergeSql = `
      MERGE INTO workspace.campus_explorer.chat_threads AS target
      USING (
        SELECT
          :thread_id AS thread_id,
          :user_id AS user_id,
          :title AS title,
          :messages_json AS messages_json,
          timestamp_millis(:created_at) AS created_ts,
          timestamp_millis(:updated_at) AS updated_ts
      ) AS src
      ON target.thread_id = src.thread_id AND target.user_id = src.user_id
      WHEN MATCHED THEN UPDATE SET
        target.title = src.title,
        target.messages_json = src.messages_json,
        target.updated_at = src.updated_ts
      WHEN NOT MATCHED THEN INSERT (thread_id, user_id, title, messages_json, created_at, updated_at)
        VALUES (src.thread_id, src.user_id, src.title, src.messages_json, src.created_ts, src.updated_ts)
    `;

    const result = await executeLakehouseSql(mergeSql, undefined, 30, [
      { name: "thread_id", value: threadId },
      { name: "user_id", value: userId },
      { name: "title", value: title },
      { name: "messages_json", value: messagesJson },
      { name: "created_at", value: createdAt, type: "BIGINT" },
      { name: "updated_at", value: updatedAt, type: "BIGINT" },
    ]);
    if (result.state !== "SUCCEEDED") {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to save thread to Lakehouse" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, threadId });
  } catch (err: any) {
    console.error("[Save Thread Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "Missing thread id" }, { status: 400 });
    }

    const result = await executeLakehouseSql(
      "DELETE FROM workspace.campus_explorer.chat_threads WHERE thread_id = :thread_id AND user_id = :user_id",
      undefined,
      30,
      [{ name: "thread_id", value: id }, { name: "user_id", value: userId }]
    );

    return NextResponse.json({
      success: true,
      deletedId: id,
      state: result.state,
      message: "Chat thread deleted from Databricks Lakehouse.",
    });
  } catch (err: any) {
    console.error("[Delete Thread Error]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
