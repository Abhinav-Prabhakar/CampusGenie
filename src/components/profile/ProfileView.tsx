"use client";

import React, { useEffect, useState } from "react";
import { useCurrentUser, initialsFor, setCurrentUserCached } from "@/lib/useCurrentUser";
import "@/app/profile.css";

type ChatUsage = {
  rpmUsed: number;
  rpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  rpmResetsAt: number | null;
  rpdResetsAt: number | null;
};

function formatResetIn(resetsAt: number | null, now: number): string | null {
  if (!resetsAt || resetsAt <= now) return null;
  const s = Math.round((resetsAt - now) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const usageTone = (used: number, limit: number): string =>
  limit > 0 && used >= limit ? "var(--red)" : limit > 0 && used / limit >= 0.8 ? "var(--orange)" : "var(--accent)";

function UsageMeter({
  icon,
  label,
  used,
  limit,
  resetsIn,
}: {
  icon: string;
  label: string;
  used: number;
  limit: number;
  resetsIn: string | null;
}) {
  const tone = usageTone(used, limit);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const blocked = limit > 0 && used >= limit;
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };
  return (
    <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          className="ic"
          style={{ "--t": tone, color: tone, background: `color-mix(in srgb, ${tone} 14%, var(--surface))`, borderColor: `color-mix(in srgb, ${tone} 26%, var(--surface))` } as React.CSSProperties}
        >
          <svg className="i i12" aria-hidden="true"><use href={icon} /></svg>
        </span>
        <span className="k" style={{ fontSize: 12, color: "var(--ink-2)" }}>{label}</span>
        <b style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", ...mono }}>
          {used} / {limit}
        </b>
      </div>
      <span className="meter" style={{ flex: "none" }}>
        <i style={{ width: `${pct}%`, background: tone }} />
      </span>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{blocked ? "Cooldown active" : "Rolling window"}</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-3)", ...mono }}>
          {resetsIn ? `frees up in ${resetsIn}` : "idle"}
        </span>
      </div>
    </div>
  );
}

export default function ProfileView() {
  const { user, loading } = useCurrentUser();
  // Optimistic local role override, valid only for the loaded account.
  const [override, setOverride] = useState<{ userId: string; role: "student" | "admin" } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [collegeValue, setCollegeValue] = useState<string | null>(null);
  const [collegeSaveState, setCollegeSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const role = override && user && override.userId === user.userId ? override.role : user?.role ?? "student";
  const isAdmin = role === "admin";
  const college = collegeValue ?? user?.college ?? "Databricks University";

  // Live chat quota (RPM/RPD) from the same in-memory limiter the chat API uses.
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/chat/usage", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (alive && data?.usage) setUsage(data.usage);
        })
        .catch(() => {});
    };
    load();
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const saveCollege = async (next: string) => {
    const trimmed = next.trim();
    if (!user || !trimmed || trimmed === (user.college ?? "Databricks University") || collegeSaveState === "saving") return;
    const prev = college;
    setCollegeValue(trimmed);
    setCollegeSaveState("saving");
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ college: trimmed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed");
      setCurrentUserCached({ ...user, college: trimmed });
      setCollegeSaveState("saved");
    } catch {
      setCollegeValue(prev);
      setCollegeSaveState("error");
      return;
    }
    setTimeout(() => setCollegeSaveState("idle"), 2400);
  };

  const toggleAdmin = async (next: boolean) => {
    if (!user || saveState === "saving") return;
    const nextRole = next ? "admin" : "student";
    const prevRole = role;
    setOverride({ userId: user.userId, role: nextRole });
    setSaveState("saving");
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed");
      setCurrentUserCached({ ...user, role: nextRole });
      setSaveState("saved");
    } catch {
      setOverride({ userId: user.userId, role: prevRole });
      setSaveState("error");
      return;
    }
    setTimeout(() => setSaveState("idle"), 2400);
  };

  return (
    <div className="profile-scope w-full">
      {/* icon sprite (feather-style, 24px grid, stroke = currentColor) */}
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} aria-hidden="true">
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z"/><circle cx="12" cy="10.2" r="2.6"/></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 21v-1.8a4 4 0 0 0-3-3.87M15.5 4.2a3.5 3.5 0 0 1 0 6.7"/></symbol>
        <symbol id="i-video" viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></symbol>
        <symbol id="i-food" viewBox="0 0 24 24"><path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2M5.5 11v11"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/></symbol>
        <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 6.5-5.5 5.5L8 17.5M16 6.5 21.5 12 16 17.5"/></symbol>
        <symbol id="i-brief" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="13.5" rx="2"/><path d="M16 20.5V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14.5"/></symbol>
        <symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V5.5L21 3v12.5"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15.5" r="3"/></symbol>
        <symbol id="i-ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M4.2 5.4l15.6 13.2M19.8 5.4 4.2 18.6"/></symbol>
        <symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.8-1L3 20.5 5.5 15a8.5 8.5 0 1 1 15.5-3.5Z"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
        <symbol id="i-arr" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
        <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></symbol>
        <symbol id="i-db" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></symbol>
        <symbol id="i-edit" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></symbol>
        <symbol id="i-cap" viewBox="0 0 24 24"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c3.2 2.8 8.8 2.8 12 0v-4.5"/></symbol>
        <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><circle cx="8.2" cy="11" r="2.2"/><path d="M14.5 9.5h4.5M14.5 13h4.5M5.5 17.5c.8-2 4.6-2 5.4 0"/></symbol>
        <symbol id="i-mail" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/></symbol>
        <symbol id="i-building" viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M9 20.5v-4h6v4M8.5 8.5h2M13.5 8.5h2M8.5 12h2M13.5 12h2"/></symbol>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15V15H9v6.5H4.5A1.5 1.5 0 0 1 3 20Z"/></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-3.6 8-10V5.2L12 2 4 5.2V12c0 6.4 8 10 8 10Z"/><path d="m8.8 11.5 2.2 2.2 4.2-4.2"/></symbol>
        <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></symbol>
        <symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2 3 14h8l-1 8 11-12h-8l1-8Z"/></symbol>
        <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.9 6.2.8-4.6 4.4 1.2 6.3L12 17l-5.6 3.2 1.2-6.3L3 9.5l6.2-.8L12 2.8Z"/></symbol>
        <symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="5.5"/><path d="M8.8 13.5 7.5 22l4.5-2.6L16.5 22l-1.3-8.5"/></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></symbol>
        <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M11 20.5A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10.5-10 10.5Z"/><path d="M2.5 21.5c0-3 1.9-5.4 5.1-6.4"/></symbol>
        <symbol id="i-sprout" viewBox="0 0 24 24"><path d="M12 22v-9"/><path d="M12 13C12 9.5 9.5 7 5.5 7c0 3.5 2.5 6 6.5 6Z"/><path d="M12 11c0-3 2-5 5.5-5 0 3.5-2 5.6-5.5 5Z"/></symbol>
        <symbol id="i-no" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></symbol>
        <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9c0 5.7-8.5 11.2-8.5 11.2Z"/></symbol>
        <symbol id="i-up" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>
        <symbol id="i-down" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></symbol>
        <symbol id="i-flask" viewBox="0 0 24 24"><path d="M10 2.5v6.2L4.6 18a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8.7V2.5"/><path d="M8.5 2.5h7M7.5 14.5h9"/></symbol>
      </svg>

      {/* theme toggle lives outside the form */}
      <input type="checkbox" id="theme" className="vh" aria-label="Toggle light theme" />

      <div className="frame">
        <form className="window" autoComplete="off" onSubmit={(e) => e.preventDefault()}>

          {/* ── panel head ─────────────────────────────────── */}
          <header className="panel-head">
            <span className="logo"><svg className="i i14" aria-hidden="true"><use href="#i-spark"/></svg></span>
            <nav className="crumb" aria-label="Breadcrumb">
              <b>Campus Genie</b><span className="sep">/</span><span>Profile</span>
            </nav>
            <span className="wk">SPRING · WEEK 7</span>
            <div className="head-right">
              <label className="theme-btn" htmlFor="theme" title="Toggle theme">
                <svg className="i i14 sun" aria-hidden="true"><use href="#i-sun"/></svg>
                <svg className="i i14 moon" aria-hidden="true"><use href="#i-moon"/></svg>
              </label>
              <span className="avatar" title={user?.fullName ?? "Student"}>{initialsFor(user)}</span>
              </div>
          </header>

          {/* ── identity hero ──────────────────────────────── */}
          <section className="hero">
            <span className="ava-xl">{initialsFor(user)}<span className="ava-dot" title="On campus"></span></span>

            <div className="who">
              <div className="who-top">
                <h1 className="v-static">{loading && !user ? "Loading…" : user?.fullName ?? "Student"}</h1>
                <input className="fld v-edit nw" defaultValue={user?.fullName ?? "Student"} aria-label="Name" key={user?.userId ?? "name"} />
                <span className="pill pill-quiet v-static">she/her</span>
                <input className="fld v-edit pw" defaultValue="she/her" aria-label="Pronouns" />
                {isAdmin ? (
                  <span className="pill pill-accent"><svg className="i i11" aria-hidden="true"><use href="#i-shield"/></svg>Student admin</span>
                ) : (
                  <span className="pill pill-going"><svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg>Verified student</span>
                )}
              </div>
              <div className="who-sub">
                <span><svg className="i i13" aria-hidden="true"><use href="#i-cap"/></svg>B.S. Computer Science — Statistics</span>
                <span><svg className="i i13" aria-hidden="true"><use href="#i-home"/></svg>Clark Kerr · On-campus</span>
                <span><svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg>Class of 2026</span>
              </div>
              <p className="bio v-static">CS + Stats senior building data tools for campus life. Looking for a hackathon team and people to climb with on Fridays.</p>
              <textarea className="fld v-edit" aria-label="Bio" defaultValue="CS + Stats senior building data tools for campus life. Looking for a hackathon team and people to climb with on Fridays." />

              <div className="hero-stats">
                <div className="stat">
                  <span
                    className="stat-ic"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      color: "var(--orange)",
                      background: "color-mix(in srgb, var(--orange) 16%, var(--surface))",
                      border: "1px solid color-mix(in srgb, var(--orange) 26%, var(--surface))",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                  <div><b>3.81</b><span>GPA</span></div>
                </div>
                <div className="stat">
                  <span
                    className="stat-ic"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      color: "var(--hue-meeting)",
                      background: "color-mix(in srgb, var(--hue-meeting) 16%, var(--surface))",
                      border: "1px solid color-mix(in srgb, var(--hue-meeting) 26%, var(--surface))",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  </span>
                  <div><b>112</b><span>Credits</span></div>
                </div>
                <div className="stat">
                  <span
                    className="stat-ic"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      color: "var(--hue-hack)",
                      background: "color-mix(in srgb, var(--hue-hack) 16%, var(--surface))",
                      border: "1px solid color-mix(in srgb, var(--hue-hack) 26%, var(--surface))",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <div><b>18</b><span>Events this term</span></div>
                </div>
                <div className="stat">
                  <span
                    className="stat-ic"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      color: "var(--green)",
                      background: "color-mix(in srgb, var(--green) 16%, var(--surface))",
                      border: "1px solid color-mix(in srgb, var(--green) 26%, var(--surface))",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div><b>86%</b><span>RSVP rate</span></div>
                </div>
              </div>
            </div>

            <div className="hero-foot">
              <div className="facts">
                <span className="fact mono"><svg className="i i12" aria-hidden="true"><use href="#i-id"/></svg>{user?.userId ?? "user_…"}</span>
                <span className="fact"><svg className="i i12" aria-hidden="true"><use href="#i-mail"/></svg>{user?.email ?? "—"}</span>
                <span className="fact"><svg className="i i12" aria-hidden="true"><use href="#i-building"/></svg>{loading && !user ? "…" : college}</span>
              </div>
              <div className="hero-act">
                <span className="dirty"><i aria-hidden="true"></i>Unsaved edits</span>
                <input type="checkbox" id="edit" className="vh" aria-label="Toggle profile editing" />
                <label className="btn-sec btn-edit" htmlFor="edit">
                  <span className="e-i"><svg className="i i13" aria-hidden="true"><use href="#i-edit"/></svg>Edit profile</span>
                  <span className="e-d"><svg className="i i13" aria-hidden="true"><use href="#i-check"/></svg>Done</span>
                </label>
              </div>
            </div>
          </section>

          <div className="cols">
            {/* ══ main column ════════════════════════════════ */}
            <div className="stack">

              {/* academic context */}
              <section className="card" style={{ "--i": 0 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic"><svg className="i i13" aria-hidden="true"><use href="#i-cap"/></svg></span>
                  <h3>Academic context</h3>
                  <span className="act"><span className="micro">Weight Genie's study-time suggestions</span></span>
                </div>
                <div className="cb">
                  <div className="rows">
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-building"/></svg></span>
                      <div><div className="k">College</div>
                        <div className="v">
                          <span className="v-static">{college}</span>
                          <input
                            className="fld v-edit"
                            defaultValue={college}
                            aria-label="College"
                            key={user?.userId ?? "college"}
                            onChange={(e) => setCollegeValue(e.target.value)}
                            onBlur={(e) => saveCollege(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-cap"/></svg></span>
                      <div><div className="k">Degree</div>
                        <div className="v"><span className="v-static">B.S. Computer Science</span><input className="fld v-edit" defaultValue="B.S. Computer Science" aria-label="Degree" /></div>
                      </div>
                    </div>
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-book"/></svg></span>
                      <div><div className="k">Minor</div>
                        <div className="v"><span className="v-static">Statistics</span><input className="fld v-edit" defaultValue="Statistics" aria-label="Minor" /></div>
                      </div>
                    </div>
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-cal"/></svg></span>
                      <div><div className="k">Expected grad</div>
                        <div className="v"><span className="v-static">Spring 2026</span><input className="fld v-edit" defaultValue="Spring 2026" aria-label="Expected graduation" /></div>
                      </div>
                    </div>
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg></span>
                      <div><div className="k">Advisor</div>
                        <div className="v"><span className="v-static">Prof. D. Rivera</span><input className="fld v-edit" defaultValue="Prof. D. Rivera" aria-label="Advisor" /></div>
                      </div>
                    </div>
                    <div className="row">
                      <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-target"/></svg></span>
                      <div><div className="k">Standing</div><div className="v">Senior · 112 / 180 credits</div></div>
                    </div>
                  </div>

                  <div className="courses">
                    <div className="load-h">
                      <span className="lbl">Enrolled this quarter</span>
                      <span className="meter"><i style={{ width: "83%" }}></i></span>
                      <span className="n">15 / 18 units</span>
                    </div>
                    <div className="course"><span className="ccode">CS 161</span><span className="nm">Artificial Intelligence</span><span className="u">4u · MWF 10–11</span></div>
                    <div className="course"><span className="ccode">STAT 131</span><span className="nm">Statistical Inference</span><span className="u">4u · TuTh 12–1:30</span></div>
                    <div className="course"><span className="ccode">DATAC 101</span><span className="nm">Lakehouse Fundamentals</span><span className="u">4u · TuTh 3–4:30</span></div>
                    <div className="course"><span className="ccode">MUS 10</span><span className="nm">Intro to Music Theory</span><span className="u">3u · MW 5–6:30</span></div>
                  </div>
                </div>
              </section>

              {/* interests & goals */}
              <section className="card" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--green)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-heart"/></svg></span>
                  <h3>Interests &amp; goals</h3>
                  <span className="act"><a className="btn-ghost" href="#"><svg className="i i12" aria-hidden="true"><use href="#i-zap"/></svg>Genie suggests</a></span>
                </div>
                <div className="cb">
                  <div className="grp">Goals this term</div>
                  <div className="chips">
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-code"/></svg>Find a hackathon team</label>
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-brief"/></svg>Land a summer internship</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-flask"/></svg>Join a research lab</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-target"/></svg>Hold a 3.8+ GPA</label>
                  </div>

                  <div className="grp">Tech &amp; build</div>
                  <div className="chips">
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-zap"/></svg>AI / ML</label>
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-code"/></svg>Web dev</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-db"/></svg>Data viz</label>
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg>Hackathons</label>
                  </div>

                  <div className="grp">Community &amp; arts</div>
                  <div className="chips">
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-msg"/></svg>Peer tutoring</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-heart"/></svg>Volunteering</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-music"/></svg>Live music</label>
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-music"/></svg>A cappella</label>
                  </div>

                  <div className="grp">Wellness &amp; sports</div>
                  <div className="chips">
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-ball"/></svg>Bouldering</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-ball"/></svg>Intramural hoops</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-ball"/></svg>Pickleball</label>
                  </div>
                </div>
              </section>

              {/* availability matrix */}
              <section className="card" style={{ "--i": 2 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--orange)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-clock"/></svg></span>
                  <h3>Weekly availability</h3>
                  <span className="act"><span className="pill pill-quiet"><svg className="i i11" aria-hidden="true"><use href="#i-clock"/></svg>33 open blocks</span></span>
                </div>
                <div className="cb">
                  <div className="sched-wrap">
                    <div className="sched" role="group" aria-label="Weekly availability — click a block to toggle free">
                      <span className="sch-h"></span><span className="sch-h">MON</span><span className="sch-h">TUE</span><span className="sch-h">WED</span><span className="sch-h">THU</span><span className="sch-h">FRI</span><span className="sch-h">SAT</span><span className="sch-h">SUN</span>

                      <span className="sch-t">08–10</span>
                      <label className="sc" title="Mon 08–10"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Tue 08–10"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 08–10"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Thu 08–10"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 08–10"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 08–10"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Sun 08–10"><input type="checkbox" className="vh" /><i></i></label>

                      <span className="sch-t">10–12</span>
                      <label className="sc" title="Mon 10–12"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Tue 10–12"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 10–12"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Thu 10–12"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 10–12"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Sat 10–12"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Sun 10–12"><input type="checkbox" className="vh" defaultChecked /><i></i></label>

                      <span className="sch-t">12–14</span>
                      <label className="sc" title="Mon 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Tue 12–14"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Wed 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Thu 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sun 12–14"><input type="checkbox" className="vh" defaultChecked /><i></i></label>

                      <span className="sch-t">14–16</span>
                      <label className="sc" title="Mon 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Tue 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 14–16"><input type="checkbox" className="vh" /><i></i></label>
                      <label className="sc" title="Thu 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sun 14–16"><input type="checkbox" className="vh" defaultChecked /><i></i></label>

                      <span className="sch-t">16–18</span>
                      <label className="sc" title="Mon 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Tue 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Thu 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sun 16–18"><input type="checkbox" className="vh" defaultChecked /><i></i></label>

                      <span className="sch-t">18–20</span>
                      <label className="sc" title="Mon 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Tue 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Thu 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sun 18–20"><input type="checkbox" className="vh" defaultChecked /><i></i></label>

                      <span className="sch-t">20–22</span>
                      <label className="sc" title="Mon 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Tue 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Wed 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Thu 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Fri 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sat 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                      <label className="sc" title="Sun 20–22"><input type="checkbox" className="vh" defaultChecked /><i></i></label>
                    </div>
                  </div>
                  <div className="lgd">
                    <span className="lg"><i aria-hidden="true"></i>Free</span>
                    <span className="lg busy"><i aria-hidden="true"></i>Busy</span>
                    <span className="chips" style={{ marginLeft: "auto" }}>
                      <span className="tag"><svg className="i i12" aria-hidden="true"><use href="#i-brief"/></svg>Library desk · Sat 10–16</span>
                      <span className="tag"><svg className="i i12" aria-hidden="true"><use href="#i-moon"/></svg>Night class · Tue</span>
                    </span>
                  </div>
                </div>
              </section>

              {/* event preferences */}
              <section className="card" style={{ "--i": 3 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--hue-hack)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg></span>
                  <h3>Event preferences</h3>
                  <span className="act"><span className="micro">Feeds Genie's ranking</span></span>
                </div>
                <div className="cb">

                  <div className="dial">
                    <div className="dial-h">
                      <span className="dic"><svg className="i i12" aria-hidden="true"><use href="#i-zap"/></svg></span>
                      <span className="dn">Social energy</span>
                      <span className="dval"><span data-v="1">1/5</span><span data-v="2">2/5</span><span data-v="3">3/5</span><span data-v="4">4/5</span><span data-v="5">5/5</span></span>
                    </div>
                    <div className="dtrack">
                      <label className="dseg"><input type="radio" name="d-energy" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-energy" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-energy" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-energy" className="vh" defaultChecked /></label>
                      <label className="dseg"><input type="radio" name="d-energy" className="vh" /></label>
                    </div>
                    <div className="dcap"><span>Recharge solo</span><span>Center stage</span></div>
                  </div>

                  <div className="dial">
                    <div className="dial-h">
                      <span className="dic" style={{ "--t": "var(--green)" } as React.CSSProperties}><svg className="i i12" aria-hidden="true"><use href="#i-spark"/></svg></span>
                      <span className="dn">Spontaneity</span>
                      <span className="dval"><span data-v="1">1/5</span><span data-v="2">2/5</span><span data-v="3">3/5</span><span data-v="4">4/5</span><span data-v="5">5/5</span></span>
                    </div>
                    <div className="dtrack">
                      <label className="dseg"><input type="radio" name="d-spont" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-spont" className="vh" defaultChecked /></label>
                      <label className="dseg"><input type="radio" name="d-spont" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-spont" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-spont" className="vh" /></label>
                    </div>
                    <div className="dcap"><span>Planner</span><span>Spontaneous</span></div>
                  </div>

                  <div className="dial">
                    <div className="dial-h">
                      <span className="dic" style={{ "--t": "var(--orange)" } as React.CSSProperties}><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg></span>
                      <span className="dn">Travel radius</span>
                      <span className="dval"><span data-v="1">1/5</span><span data-v="2">2/5</span><span data-v="3">3/5</span><span data-v="4">4/5</span><span data-v="5">5/5</span></span>
                    </div>
                    <div className="dtrack">
                      <label className="dseg"><input type="radio" name="d-radius" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-radius" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-radius" className="vh" defaultChecked /></label>
                      <label className="dseg"><input type="radio" name="d-radius" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-radius" className="vh" /></label>
                    </div>
                    <div className="dcap"><span>Campus only</span><span>5+ mi off campus</span></div>
                  </div>

                  <div className="dial">
                    <div className="dial-h">
                      <span className="dic" style={{ "--t": "var(--hue-meeting)" } as React.CSSProperties}><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg></span>
                      <span className="dn">Crowd comfort</span>
                      <span className="dval"><span data-v="1">1/5</span><span data-v="2">2/5</span><span data-v="3">3/5</span><span data-v="4">4/5</span><span data-v="5">5/5</span></span>
                    </div>
                    <div className="dtrack">
                      <label className="dseg"><input type="radio" name="d-crowd" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-crowd" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-crowd" className="vh" /></label>
                      <label className="dseg"><input type="radio" name="d-crowd" className="vh" defaultChecked /></label>
                      <label className="dseg"><input type="radio" name="d-crowd" className="vh" /></label>
                    </div>
                    <div className="dcap"><span>Small groups</span><span>Big crowds</span></div>
                  </div>

                  <div className="sws">
                    <label className="sw">
                      <svg className="i i13" aria-hidden="true"><use href="#i-moon"/></svg>
                      <span className="sl">Evening events</span>
                      <input type="checkbox" className="vh" defaultChecked /><span className="sw-t"></span>
                    </label>
                    <label className="sw">
                      <svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg>
                      <span className="sl">Weekend events</span>
                      <input type="checkbox" className="vh" defaultChecked /><span className="sw-t"></span>
                    </label>
                    <label className="sw">
                      <svg className="i i13" aria-hidden="true"><use href="#i-video"/></svg>
                      <span className="sl">Virtual-first</span>
                      <input type="checkbox" className="vh" /><span className="sw-t"></span>
                    </label>
                    <label className="sw">
                      <svg className="i i13" aria-hidden="true"><use href="#i-food"/></svg>
                      <span className="sl">Prioritize free food</span>
                      <input type="checkbox" className="vh" defaultChecked /><span className="sw-t"></span>
                    </label>
                  </div>

                  <div className="grp" style={{ marginTop: "16px" }}>Dining</div>
                  <div className="chips">
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-leaf"/></svg>Vegetarian</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-sprout"/></svg>Vegan</label>
                    <label className="chip"><input type="checkbox" className="vh" defaultChecked /><svg className="i i12" aria-hidden="true"><use href="#i-no"/></svg>Gluten-free</label>
                    <label className="chip"><input type="checkbox" className="vh" /><svg className="i i12" aria-hidden="true"><use href="#i-moon"/></svg>Halal</label>
                  </div>

                  <div className="qrow">
                    <svg className="i i13" aria-hidden="true"><use href="#i-moon"/></svg>
                    Quiet hours
                    <span className="tm">22:00 – 06:30</span>
                    <span className="pill pill-quiet" style={{ marginLeft: "auto" }}>Notifications muted</span>
                  </div>
                </div>
              </section>
            </div>

            {/* ══ sidebar column ═════════════════════════════ */}
            <div className="stack">

              {/* access & role */}
              <section className="card" style={{ "--i": 0 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--accent)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-shield"/></svg></span>
                  <h3>Access &amp; role</h3>
                  <span className="act">
                    {isAdmin ? (
                      <span className="pill pill-accent"><svg className="i i11" aria-hidden="true"><use href="#i-shield"/></svg>Admin</span>
                    ) : (
                      <span className="pill pill-quiet"><svg className="i i11" aria-hidden="true"><use href="#i-cap"/></svg>Student</span>
                    )}
                  </span>
                </div>
                <div className="cb">
                  <label className="sw" style={saveState === "saving" ? { opacity: 0.55, pointerEvents: "none" } : undefined}>
                    <svg className="i i13" aria-hidden="true"><use href="#i-shield"/></svg>
                    <span className="sl">Student admin access</span>
                    <input
                      type="checkbox"
                      className="vh"
                      checked={isAdmin}
                      disabled={!user || saveState === "saving"}
                      onChange={(e) => toggleAdmin(e.target.checked)}
                    />
                    <span className="sw-t"></span>
                  </label>

                  <div className="qrow">
                    <svg className="i i13" aria-hidden="true"><use href="#i-db"/></svg>
                    app_users.delta
                    {(saveState === "saving" || collegeSaveState === "saving") && <span className="pill pill-quiet" style={{ marginLeft: "auto" }}><svg className="i i11" aria-hidden="true"><use href="#i-rotate"/></svg>Saving…</span>}
                    {(saveState === "saved" || collegeSaveState === "saved") && <span className="pill pill-going" style={{ marginLeft: "auto" }}><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg>Saved to Lakehouse</span>}
                    {(saveState === "error" || collegeSaveState === "error") && <span className="pill pill-pend" style={{ marginLeft: "auto" }}>Save failed — try again</span>}
                    {saveState === "idle" && collegeSaveState === "idle" && <span className="tm" style={{ marginLeft: "auto" }}>{isAdmin ? "Events · surveys · sources" : "Browse · RSVP · chat"}</span>}
                  </div>

                  <div className="gn">
                    <svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg>
                    <span>Admins unlock <b>Student Admin</b> in the sidebar — create events, publish surveys, and manage campus content for everyone. The role is stored per user in the Lakehouse.</span>
                  </div>
                </div>
              </section>

              {/* chat usage & limits */}
              <section className="card" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--accent)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg></span>
                  <h3>Chat usage &amp; limits</h3>
                  <span className="act"><span className="micro">Live</span></span>
                </div>
                <div className="cb">
                  <div className="rows" style={{ gap: "14px 24px" }}>
                    <UsageMeter
                      icon="#i-zap"
                      label="Requests · minute"
                      used={usage?.rpmUsed ?? 0}
                      limit={usage?.rpmLimit ?? 0}
                      resetsIn={usage ? formatResetIn(usage.rpmResetsAt, nowTs) : null}
                    />
                    <UsageMeter
                      icon="#i-db"
                      label="Prompts · day"
                      used={usage?.rpdUsed ?? 0}
                      limit={usage?.rpdLimit ?? 0}
                      resetsIn={usage ? formatResetIn(usage.rpdResetsAt, nowTs) : null}
                    />
                  </div>

                  <div className="gn" style={{ marginTop: "12px" }}>
                    <svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg>
                    <span>
                      Genie pauses briefly when a window fills, then picks up where you left off. Limits are per client —{" "}
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px" }}>
                        LLM_RPM_LIMIT={usage?.rpmLimit ?? "—"} · LLM_RPD_LIMIT={usage?.rpdLimit ?? "—"}
                      </code>
                    </span>
                  </div>
                </div>
              </section>

              {/* profile strength */}
              <section className="card" style={{ "--i": 2 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic"><svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg></span>
                  <h3>Profile strength</h3>
                </div>
                <div className="cb">
                  <div className="ringbox">
                    <div className="ring">
                      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                        <circle cx="36" cy="36" r="30" fill="none" stroke="color-mix(in srgb, var(--ink) 10%, transparent)" strokeWidth="6"/>
                        <circle className="ring-p" cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"/>
                      </svg>
                      <span className="ring-t">76%</span>
                    </div>
                    <div className="rb-t">
                      <b>Strong</b>
                      <span>3 fields left — Genie refreshes matches when you update</span>
                    </div>
                  </div>
                  <div className="ckl">
                    <div className="ck done"><span className="cki"><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg></span><span className="ct">Bio added</span><span className="cm">12d ago</span></div>
                    <div className="ck done"><span className="cki"><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg></span><span className="ct">Student email verified</span><span className="cm">12d ago</span></div>
                    <div className="ck done"><span className="cki"><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg></span><span className="ct">Calendar linked</span><span className="cm">9d ago</span></div>
                    <div className="ck pend"><span className="cki"><svg className="i i10" aria-hidden="true"><use href="#i-clock"/></svg></span><span className="ct">Fill 2 evening blocks</span><span className="cm">pending</span></div>
                    <div className="ck done"><span className="cki"><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg></span><span className="ct">Interests picked</span><span className="cm">4d ago</span></div>
                  </div>
                  <div className="gn">
                    <svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg>
                    <span>Genie weighs these signals when ranking club meetings, hackathons, and campus events for you.</span>
                  </div>
                </div>
              </section>

              {/* this term insights */}
              <section className="card" style={{ "--i": 3 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--green)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-up"/></svg></span>
                  <h3>This term</h3>
                  <span className="act"><span className="micro">12 weeks</span></span>
                </div>
                <div className="cb">
                  <div className="ins">
                    <div className="insL">
                      <div className="k">Events attended</div>
                      <div className="vr"><b>18</b><span className="vp"><svg className="i i10" aria-hidden="true"><use href="#i-up"/></svg>+38%</span></div>
                    </div>
                    <svg className="spark" viewBox="0 0 120 32" aria-hidden="true">
                      <path d="M2,23 13,20 24,23 34,17 45,20 56,14 66,17 77,11 88,14 98,8 109,11 118,5 L118,32 2,32Z" fill="var(--accent-tint)" stroke="none"/>
                      <polyline points="2,23 13,20 24,23 34,17 45,20 56,14 66,17 77,11 88,14 98,8 109,11 118,5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="ins">
                    <div className="insL">
                      <div className="k">RSVP rate</div>
                      <div className="vr"><b>86%</b><span className="vp"><svg className="i i10" aria-hidden="true"><use href="#i-up"/></svg>+16%</span></div>
                    </div>
                    <svg className="spark" viewBox="0 0 120 32" aria-hidden="true">
                      <path d="M2,29.8 13,27.6 24,28.7 34,23.2 45,21 56,22.1 66,17.7 77,18.8 88,15.5 98,16.6 109,14.4 118,12.2 L118,32 2,32Z" fill="var(--accent-tint)" stroke="none"/>
                      <polyline points="2,29.8 13,27.6 24,28.7 34,23.2 45,21 56,22.1 66,17.7 77,18.8 88,15.5 98,16.6 109,14.4 118,12.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="ins">
                    <div className="insL">
                      <div className="k">Club hours / week</div>
                      <div className="vr"><b>6.5h</b><span className="vp mut">−0.4h</span></div>
                    </div>
                    <svg className="spark" viewBox="0 0 120 32" aria-hidden="true">
                      <path d="M2,17.6 13,15.2 24,17.6 34,12.8 45,15.2 56,10.4 66,12.8 77,15.2 88,10.4 98,8 109,10.4 118,8 L118,32 2,32Z" fill="var(--accent-tint)" stroke="none"/>
                      <polyline points="2,17.6 13,15.2 24,17.6 34,12.8 45,15.2 56,10.4 66,12.8 77,15.2 88,10.4 98,8 109,10.4 118,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </section>

              {/* memberships */}
              <section className="card" style={{ "--i": 4 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic"><svg className="i i13" aria-hidden="true"><use href="#i-users"/></svg></span>
                  <h3>Memberships</h3>
                  <span className="act"><span className="micro">4 active</span></span>
                </div>
                <div className="cb">
                  <div className="mem"><span className="mark">DC</span><span className="mn">Design Club</span><span className="pill pill-accent">Officer</span><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></div>
                  <div className="mem"><span className="mark">CX</span><span className="mn">CruX Coding</span><span className="pill pill-quiet">Member</span><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></div>
                  <div className="mem"><span className="mark">AC</span><span className="mn">ACM</span><span className="pill pill-quiet">Member</span><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></div>
                  <div className="mem"><span className="mark">PM</span><span className="mn">Peer Mentors</span><span className="pill pill-pend">Pending</span><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></div>
                  <div className="mem"><span className="mark">RB</span><span className="mn">Robotics Club</span><span className="pill pill-quiet">Member</span><svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></div>
                  <div className="browse"><a className="btn-ghost" href="#">Browse 214 clubs <svg className="i i12" aria-hidden="true"><use href="#i-arr"/></svg></a></div>
                </div>
              </section>

              {/* badges */}
              <section className="card" style={{ "--i": 5 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--orange)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-award"/></svg></span>
                  <h3>Badges</h3>
                  <span className="act"><span className="micro">5 / 12</span></span>
                </div>
                <div className="cb">
                  <div className="bdgs">
                    <div className="bdg" style={{ "--t": "var(--hue-hack)" } as React.CSSProperties} title="Hack the Lake — finalist">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-code"/></svg></span>
                      <span className="bl">Hack Finalist '25</span>
                    </div>
                    <div className="bdg" style={{ "--t": "var(--accent)" } as React.CSSProperties} title="Attended 6 evening events">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-moon"/></svg></span>
                      <span className="bl">Night Owl</span>
                    </div>
                    <div className="bdg" style={{ "--t": "var(--green)" } as React.CSSProperties} title="24 events attended">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg></span>
                      <span className="bl">24 Events</span>
                    </div>
                    <div className="bdg" style={{ "--t": "var(--orange)" } as React.CSSProperties} title="First hackathon completed">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-zap"/></svg></span>
                      <span className="bl">First Hack</span>
                    </div>
                    <div className="bdg" style={{ "--t": "var(--green)" } as React.CSSProperties} title="Officer in Design Club">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-award"/></svg></span>
                      <span className="bl">Club Officer</span>
                    </div>
                    <div className="bdg is-locked" title="Attend 100 events to unlock">
                      <span className="bic"><svg className="i i13" aria-hidden="true"><use href="#i-star"/></svg></span>
                      <span className="bl">Event Legend</span>
                      <span className="lk"><svg className="i i10" aria-hidden="true"><use href="#i-lock"/></svg></span>
                    </div>
                  </div>
                </div>
              </section>

              {/* connected services */}
              <section className="card" style={{ "--i": 6 } as React.CSSProperties}>
                <div className="ch">
                  <span className="cic" style={{ "--t": "var(--hue-hack)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-db"/></svg></span>
                  <h3>Connections</h3>
                </div>
                <div className="cb">
                  <div className="svc">
                    <span className="sic"><svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg></span>
                    <span className="sn"><b>Google Calendar</b><span>ava.kimura@university.edu</span></span>
                    <span className="pill pill-going">Synced</span>
                    <button type="button" className="iconbtn" title="Sync now"><svg className="i i12" aria-hidden="true"><use href="#i-rotate"/></svg></button>
                  </div>
                  <div className="svc">
                    <span className="sic" style={{ "--t": "var(--green)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-book"/></svg></span>
                    <span className="sn"><b>Canvas LMS</b><span>Spring 2026 · 4 courses</span></span>
                    <span className="pill pill-going">Synced</span>
                    <button type="button" className="iconbtn" title="Sync now"><svg className="i i12" aria-hidden="true"><use href="#i-rotate"/></svg></button>
                  </div>
                  <div className="svc">
                    <span className="sic" style={{ "--t": "var(--orange)" } as React.CSSProperties}><svg className="i i13" aria-hidden="true"><use href="#i-db"/></svg></span>
                    <span className="sn"><b>Databricks Student</b><span>genie-workspace · workspace id 4821</span></span>
                    <label className="conn"><input type="checkbox" className="vh" /><span className="c-idle">Connect</span><span className="c-done"><svg className="i i10" aria-hidden="true"><use href="#i-check"/></svg>Connected</span></label>
                  </div>
                  <div className="svc">
                    <span className="sic"><svg className="i i13" aria-hidden="true"><use href="#i-msg"/></svg></span>
                    <span className="sn"><b>Discord</b><span>ava#campus · 3 club servers</span></span>
                    <span className="pill pill-quiet">Read-only</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* ── panel footer ───────────────────────────────── */}
          <footer className="panel-foot">
            <svg className="i i13" aria-hidden="true"><use href="#i-db"/></svg>
            <code>app_users.delta</code>
            <span>· synced {isAdmin ? "as admin" : "as student"}</span>
            <span className="foot-right">
              <span><b>{user ? 1 : 0}</b> signed-in account · <b>Clerk</b> identity</span>
              <a className="cal-link" href="#">Export profile <svg className="i i11" aria-hidden="true"><use href="#i-down"/></svg></a>
              <a className="cal-link" href="#">Privacy <svg className="i i11" aria-hidden="true"><use href="#i-shield"/></svg></a>
            </span>
          </footer>

        </form>
      </div>
    </div>
  );
}
