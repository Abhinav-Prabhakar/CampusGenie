"use client";

import { useEffect, useMemo, useState } from "react";
import RecordsTable, { type RecordRow } from "@/components/primitives/RecordsTable";
import { Button } from "@/components/atoms/Button";
import { Shimmer } from "@/components/atoms/Shimmer";
import { StatusPill } from "@/components/atoms/StatusPill";

/* ─────────────────────────────────────────────────────────
 * COMPLAINTS ADMIN VIEW — every grievance deposited in
 * workspace.campus_explorer.complaints, rendered with the
 * gallery RecordsTable component.
 * ───────────────────────────────────────────────────────── */

type ComplaintRecord = {
  complaintId: string;
  title: string;
  category: string;
  location: string;
  urgency: "low" | "medium" | "high" | "urgent";
  description: string;
  isAnonymous: boolean;
  status: string;
  createdAt: string | null;
  reporter: string | null;
};

const CATEGORY_SHORT: Record<string, string> = {
  "Academic & Coursework": "Academics",
  "Campus Facilities & Maintenance": "Facilities",
  "Hostel & Residential Life": "Hostel",
  "Dining & Cafeteria Services": "Dining",
  "Administration & Registrar": "Administration",
  "IT, Lab & Library Resources": "IT & Library",
  "Safety, Security & Accessibility": "Safety",
  "Other / General Grievance": "General",
};

const URGENCY_STRENGTH: Record<ComplaintRecord["urgency"], RecordRow["strength"]> = {
  low: "strong",
  medium: "none",
  high: "weak",
  urgent: "veryweak",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

function toRows(complaints: ComplaintRecord[]): RecordRow[] {
  return complaints.map((c) => ({
    id: c.complaintId,
    name: c.title,
    tags: [
      CATEGORY_SHORT[c.category] ?? c.category,
      c.urgency.charAt(0).toUpperCase() + c.urgency.slice(1),
      c.status === "in_review" ? "In review" : c.status.charAt(0).toUpperCase() + c.status.slice(1),
    ].filter(Boolean),
    last: relativeTime(c.createdAt),
    strength: URGENCY_STRENGTH[c.urgency],
    website: c.isAnonymous ? "Anonymous" : c.reporter || "Unknown reporter",
  }));
}

export default function ComplaintsAdminView() {
  const [complaints, setComplaints] = useState<ComplaintRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetch("/api/complaints", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        return data.complaints as ComplaintRecord[];
      })
      .then((rows) => setComplaints(rows))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => toRows(complaints ?? []), [complaints]);
  const urgentCount = (complaints ?? []).filter((c) => c.urgency === "urgent" || c.urgency === "high").length;
  const openCount = (complaints ?? []).filter((c) => c.status !== "resolved").length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Complaint Box Responses</h2>
          <p className="text-[13px] text-ink-2">
            Student grievances live from the Lakehouse (
            <code className="font-mono text-xs text-accent-ink">workspace.campus_explorer.complaints</code>)
          </p>
        </div>
        <Button variant="secondary" className="text-xs" onClick={load}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-canvas p-4 shadow-card">
          <StatusPill tone="red">
            {error.includes("admin")
              ? "Admin access required"
              : error.includes("Sign in")
                ? "Sign in required"
                : "Lakehouse unavailable"}
          </StatusPill>
          <span className="text-[12.5px] text-ink-2">{error}</span>
        </div>
      )}

      {!complaints && !error && (
        <div className="space-y-4">
          <Shimmer className="text-[14px]">Loading grievance records from Delta…</Shimmer>
          <div className="h-[220px] rounded-[12px] border border-line bg-inset shadow-card" />
        </div>
      )}

      {complaints && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11.5px] font-medium text-ink-3 tabular-nums">
              {complaints.length} total · {openCount} awaiting resolution · {urgentCount} high/urgent
            </span>
          </div>

          <div className="rounded-[12px] border border-line bg-canvas p-1 shadow-card overflow-hidden">
            {rows.length > 0 ? (
              <RecordsTable rows={rows} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-14 text-center">
                <span className="flex size-9 items-center justify-center rounded-[9px] bg-inset text-ink-3 shadow-hairline">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
                    <polyline points="8.5 12.5 11 15 15.5 9.5" />
                  </svg>
                </span>
                <p className="text-[12.5px] font-medium text-ink-2">No grievances submitted yet</p>
                <p className="text-[11.5px] text-ink-3">
                  Student submissions from the Complaint Box page will appear here.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
