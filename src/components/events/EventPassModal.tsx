"use client";

import { useState, useEffect } from "react";
import type { CampusEvent } from "./EventsView";
import { useTheme } from "@/lib/theme";
import "@/app/pass.css";

type EventPassModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: CampusEvent | null;
  studentName?: string;
  studentId?: string;
  studentInitials?: string;
};

export default function EventPassModal({
  isOpen,
  onClose,
  event,
  studentName = "Ava Kimura",
  studentId = "STU-84213 · 3RD YR CS",
  studentInitials = "AK",
}: EventPassModalProps) {
  const { isDark, toggleTheme } = useTheme();
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);
  const [calAdded, setCalAdded] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsFlipped(false);
    setCopiedPass(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  // Dynamic pass attributes based on event
  const passNumber = `№ 0${(Math.abs(event.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 100)) % 900) + 100}`;
  const passNumberRaw = passNumber.replace("№ ", "");
  const eventCode = (event.title.split(/\s+/)[0] || "GENIE").slice(0, 3).toUpperCase();
  const barcodeText = `${eventCode}·${event.duration?.replace(/\D/g, "") || "01"}·${passNumberRaw}`;

  // Time & Location Details
  const dateStr = event.dateRange || event.date || `${event.month} ${event.day}`;
  const gatesStr = event.time?.split("–")[0]?.trim() || "8:30 AM";
  const durationStr = event.duration?.toUpperCase() || (event.cat === "hackathon" ? "48 HRS" : "90 MIN");
  const venueStr = event.loc?.toUpperCase() || "COLT ARENA";
  const entryStr = event.isVirtual ? "VIRTUAL" : event.flags?.food ? "GATE C" : "DOOR 2";
  const floorStr = event.isVirtual ? "TEAMS CALL" : event.room ? `L2 · ${event.room.toUpperCase()}` : "L2 · ZONE B";

  // Category Color
  const catHue = event.cat === "hackathon"
    ? "var(--hue-hack)"
    : event.cat === "career"
    ? "var(--hue-career)"
    : event.cat === "workshop"
    ? "var(--hue-workshop)"
    : event.cat === "social"
    ? "var(--hue-social)"
    : event.cat === "sports"
    ? "var(--hue-sports)"
    : "var(--hue-meeting)";

  // Dynamic Timeline
  const agendaTimeline = event.agenda && event.agenda.length > 0
    ? event.agenda.slice(0, 4).map((item) => ({
        time: item.time,
        title: item.title,
        icon: item.title.toLowerCase().includes("kickoff") || item.title.toLowerCase().includes("keynote") ? "#i-zap" : item.title.toLowerCase().includes("food") || item.title.toLowerCase().includes("lunch") || item.title.toLowerCase().includes("pizza") ? "#i-food" : item.title.toLowerCase().includes("demo") || item.title.toLowerCase().includes("mixer") || item.title.toLowerCase().includes("q&a") ? "#i-users" : "#i-login",
      }))
    : [
        { time: gatesStr, title: "Doors + check-in", icon: "#i-login" },
        { time: "09:00", title: "Kickoff & welcome", icon: "#i-zap" },
        { time: "13:00", title: event.flags?.food ? "Lunch provided" : "Midway check-in", icon: "#i-food" },
        { time: "17:00", title: "Demos & networking", icon: "#i-users" },
      ];

  const handleSavePass = () => {
    navigator.clipboard?.writeText(`Event Pass: ${event.title}\nHolder: ${studentName} (${studentId})\nPass: ${barcodeText}\nVenue: ${venueStr}\nDate: ${dateStr}`);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleGoogleCalendar = () => {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`Event Pass: ${passNumber}\nHolder: ${studentName}\nVenue: ${event.loc}\nCampus Genie verified.`);
    const location = encodeURIComponent(event.loc);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`, "_blank");
    setCalAdded(true);
    setTimeout(() => setCalAdded(false), 2500);
  };

  return (
    <div className="pass-overlay pass-scope" role="dialog" aria-modal="true">
      {/* Complete Feather-Style SVG Sprite */}
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} aria-hidden="true">
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></symbol>
        <symbol id="i-calplus" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18M12 13.5v6M9 16.5h6"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
        <symbol id="i-hour" viewBox="0 0 24 24"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z"/><circle cx="12" cy="10.2" r="2.6"/></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 21v-1.8a4 4 0 0 0-3-3.87M15.5 4.2a3.5 3.5 0 0 1 0 6.7"/></symbol>
        <symbol id="i-food" viewBox="0 0 24 24"><path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2M5.5 11v11"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/></symbol>
        <symbol id="i-login" viewBox="0 0 24 24"><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/><path d="m10 17 5-5-5-5M3 12h12"/></symbol>
        <symbol id="i-zone" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19M6 15h4"/><circle cx="16.5" cy="14.5" r="1.6"/></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></symbol>
        <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></symbol>
        <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20.5h16"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
        <symbol id="i-arr" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
        <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z"/><path d="M19 15.5v3M17.5 17h3"/></symbol>
        <symbol id="i-wifioff" viewBox="0 0 24 24"><path d="M2 2l20 20"/><path d="M5 9.5a10 10 0 0 1 5-2.6M16.5 8.1a10 10 0 0 1 2.5 1.4"/><path d="M8.5 13a5 5 0 0 1 2-1.2M14.8 12.6a5 5 0 0 1 .7.4"/><circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none"/></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6L12 2.5Z"/><path d="m8.8 11.6 2.3 2.3 4.1-4.1"/></symbol>
        <symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"/></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
      </svg>

      {/* Backdrop Scrim */}
      <div className="pass-scrim" onClick={onClose} aria-label="Close dialog" />

      {/* Main Pass Window */}
      <div className="pass-window" style={{ ["--event-hue" as any]: catHue }}>
        {/* ── Panel Head ─────────────────────────────────── */}
        <header className="panel-head">
          <span className="logo"><svg className="i i14" aria-hidden="true"><use href="#i-spark"/></svg></span>
          <nav className="crumb" aria-label="Breadcrumb">
            <b>Campus Genie</b><span className="sep">/</span><span>Events</span><span className="sep">/</span><span>{event.title}</span>
          </nav>
          <span className="wk">PASS {passNumber}</span>
          <div className="head-right">
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-btn"
              title="Toggle theme"
            >
              {isDark ? (
                <svg className="i i14" aria-hidden="true"><use href="#i-sun"/></svg>
              ) : (
                <svg className="i i14" aria-hidden="true"><use href="#i-moon"/></svg>
              )}
            </button>
            <span className="avatar" title={studentName}>{studentInitials}</span>
            <button
              type="button"
              onClick={onClose}
              className="close-btn"
              title="Close pass"
            >
              <svg className="i i14" aria-hidden="true"><use href="#i-x"/></svg>
            </button>
          </div>
        </header>

        {/* ── Confirmation Banner ────────────────────────── */}
        <div className="confirm">
          <span className="pill-ok">
            <span className="ok-disc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 3 3 5.5-6"/>
              </svg>
            </span>
            Registration confirmed
          </span>
          <h1>You&apos;re in, {studentName.split(" ")[0]}.</h1>
          <p className="sub">
            <svg className="i i13" aria-hidden="true"><use href="#i-pin"/></svg>{venueStr} · {entryStr}
            <svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg>{dateStr} — {gatesStr}
            — show the QR to enter.
          </p>
        </div>

        {/* ── The 3D Flippable Ticket ─────────────────────── */}
        <div className="stage">
          <div
            className="flipper"
            onClick={() => setIsFlipped((prev) => !prev)}
            title="Click to flip pass"
          >
            <div className={`ticket ${isFlipped ? "is-flipped" : ""}`}>
              {/* ══════════ FRONT FACE ══════════ */}
              <div className="face front">
                <span className="wm" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
                    <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z"/><path d="M19 15.5v3M17.5 17h3"/>
                  </svg>
                </span>
                <span className="sheen" aria-hidden="true" />

                <div className="t-main">
                  <div className="t-strip">
                    <svg className="i i11" aria-hidden="true"><use href="#i-spark"/></svg>
                    CAMPUS GENIE · EVENT PASS
                    <span className="rt">{passNumber}</span>
                  </div>

                  <div className="t-body">
                    <h3 className="t-title">{event.title}</h3>
                    <p className="t-sub">{event.subhead || `${event.catLabel} · ${event.host}`}</p>

                    <div className="t-fields">
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-cal"/></svg>DATE</span><span className="f-v">{dateStr}</span></div>
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-clock"/></svg>GATES</span><span className="f-v">{gatesStr}</span></div>
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-hour"/></svg>RUNTIME</span><span className="f-v">{durationStr}</span></div>
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-pin"/></svg>VENUE</span><span className="f-v">{venueStr}</span></div>
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-login"/></svg>ENTRY</span><span className="f-v">{entryStr}</span></div>
                      <div className="f"><span className="f-l"><svg className="i i11" aria-hidden="true"><use href="#i-zone"/></svg>FLOOR</span><span className="f-v">{floorStr}</span></div>
                    </div>
                  </div>

                  <div className="t-holder">
                    <span className="mark">{studentInitials}</span>
                    <span className="who"><b>{studentName.toUpperCase()}</b><span>{studentId}</span></span>
                    <span className="rt">
                      <svg className="i i12" aria-hidden="true"><use href="#i-lock"/></svg>NON-TRANSFERABLE
                      <svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>GUESTS 0
                    </span>
                  </div>

                  <div className="t-bar">
                    <span className="barcode" aria-hidden="true" />
                    <span className="bcode">{barcodeText}</span>
                  </div>

                  <span className="stamp" aria-hidden="true">
                    <b>REGISTERED</b>
                    <em>{dateStr} · {gatesStr}</em>
                  </span>
                </div>

                <div className="t-stub">
                  <span className="notch n-t" aria-hidden="true" />
                  <span className="notch n-b" aria-hidden="true" />
                  <div className="stub-cap">ADMIT ONE</div>

                  <div className="qr-frame">
                    <span className="qbr q1" aria-hidden="true" />
                    <span className="qbr q2" aria-hidden="true" />
                    <span className="qbr q3" aria-hidden="true" />
                    <span className="qbr q4" aria-hidden="true" />
                    <span className="qr-scan" aria-hidden="true" />
                    <svg className="qr" viewBox="0 0 21 21" shapeRendering="crispEdges" role="img" aria-label="Entry QR code">
                      {/* Finder patterns */}
                      <rect className="qr-d" x="0" y="0" width="7" height="7"/><rect className="qr-l" x="1" y="1" width="5" height="5"/><rect className="qr-d" x="2" y="2" width="3" height="3"/>
                      <rect className="qr-d" x="14" y="0" width="7" height="7"/><rect className="qr-l" x="15" y="1" width="5" height="5"/><rect className="qr-d" x="16" y="2" width="3" height="3"/>
                      <rect className="qr-d" x="0" y="14" width="7" height="7"/><rect className="qr-l" x="1" y="15" width="5" height="5"/><rect className="qr-d" x="2" y="16" width="3" height="3"/>
                      {/* Timing patterns */}
                      <rect className="qr-d" x="8" y="6" width="1" height="1"/><rect className="qr-d" x="10" y="6" width="1" height="1"/><rect className="qr-d" x="12" y="6" width="1" height="1"/>
                      <rect className="qr-d" x="6" y="8" width="1" height="1"/><rect className="qr-d" x="6" y="10" width="1" height="1"/><rect className="qr-d" x="6" y="12" width="1" height="1"/>
                      {/* Data modules */}
                      <rect className="qr-d" x="8" y="0" width="2" height="1"/><rect className="qr-d" x="12" y="0" width="2" height="1"/>
                      <rect className="qr-d" x="7" y="1" width="1" height="1"/><rect className="qr-d" x="11" y="1" width="2" height="1"/>
                      <rect className="qr-d" x="9" y="2" width="2" height="1"/><rect className="qr-d" x="13" y="2" width="1" height="1"/>
                      <rect className="qr-d" x="8" y="3" width="1" height="1"/><rect className="qr-d" x="12" y="3" width="1" height="1"/>
                      <rect className="qr-d" x="7" y="4" width="1" height="1"/><rect className="qr-d" x="9" y="4" width="1" height="1"/><rect className="qr-d" x="11" y="4" width="3" height="1"/>
                      <rect className="qr-d" x="8" y="5" width="1" height="1"/><rect className="qr-d" x="10" y="5" width="2" height="1"/><rect className="qr-d" x="13" y="5" width="1" height="1"/>
                      <rect className="qr-d" x="1" y="7" width="3" height="1"/><rect className="qr-d" x="5" y="7" width="2" height="1"/><rect className="qr-d" x="14" y="7" width="1" height="1"/><rect className="qr-d" x="16" y="7" width="2" height="1"/><rect className="qr-d" x="19" y="7" width="1" height="1"/>
                      <rect className="qr-d" x="1" y="8" width="1" height="1"/><rect className="qr-d" x="3" y="8" width="1" height="1"/><rect className="qr-d" x="5" y="8" width="3" height="1"/><rect className="qr-d" x="8" y="8" width="2" height="1"/><rect className="qr-d" x="12" y="8" width="1" height="1"/><rect className="qr-d" x="15" y="8" width="1" height="1"/><rect className="qr-d" x="17" y="8" width="1" height="1"/><rect className="qr-d" x="20" y="8" width="1" height="1"/>
                      <rect className="qr-d" x="0" y="9" width="1" height="1"/><rect className="qr-d" x="2" y="9" width="1" height="1"/><rect className="qr-d" x="4" y="9" width="1" height="1"/><rect className="qr-d" x="7" y="9" width="1" height="1"/><rect className="qr-d" x="9" y="9" width="1" height="1"/><rect className="qr-d" x="11" y="9" width="1" height="1"/><rect className="qr-d" x="13" y="9" width="2" height="1"/><rect className="qr-d" x="16" y="9" width="1" height="1"/><rect className="qr-d" x="19" y="9" width="2" height="1"/>
                      <rect className="qr-d" x="1" y="10" width="1" height="1"/><rect className="qr-d" x="4" y="10" width="1" height="1"/><rect className="qr-d" x="8" y="10" width="1" height="1"/><rect className="qr-d" x="10" y="10" width="2" height="1"/><rect className="qr-d" x="15" y="10" width="1" height="1"/><rect className="qr-d" x="18" y="10" width="1" height="1"/><rect className="qr-d" x="20" y="10" width="1" height="1"/>
                      <rect className="qr-d" x="0" y="11" width="1" height="1"/><rect className="qr-d" x="2" y="11" width="2" height="1"/><rect className="qr-d" x="5" y="11" width="1" height="1"/><rect className="qr-d" x="9" y="11" width="1" height="1"/><rect className="qr-d" x="12" y="11" width="1" height="1"/><rect className="qr-d" x="14" y="11" width="1" height="1"/><rect className="qr-d" x="17" y="11" width="1" height="1"/><rect className="qr-d" x="19" y="11" width="1" height="1"/>
                      <rect className="qr-d" x="1" y="12" width="1" height="1"/><rect className="qr-d" x="3" y="12" width="1" height="1"/><rect className="qr-d" x="8" y="12" width="1" height="1"/><rect className="qr-d" x="11" y="12" width="1" height="1"/><rect className="qr-d" x="13" y="12" width="1" height="1"/><rect className="qr-d" x="16" y="12" width="1" height="1"/><rect className="qr-d" x="18" y="12" width="2" height="1"/>
                      <rect className="qr-d" x="0" y="13" width="1" height="1"/><rect className="qr-d" x="2" y="13" width="1" height="1"/><rect className="qr-d" x="4" y="13" width="2" height="1"/><rect className="qr-d" x="9" y="13" width="2" height="1"/><rect className="qr-d" x="12" y="13" width="1" height="1"/><rect className="qr-d" x="15" y="13" width="1" height="1"/><rect className="qr-d" x="17" y="13" width="1" height="1"/><rect className="qr-d" x="20" y="13" width="1" height="1"/>
                      <rect className="qr-d" x="8" y="14" width="1" height="1"/><rect className="qr-d" x="10" y="14" width="1" height="1"/><rect className="qr-d" x="13" y="14" width="1" height="1"/><rect className="qr-d" x="15" y="14" width="2" height="1"/><rect className="qr-d" x="19" y="14" width="1" height="1"/>
                      <rect className="qr-d" x="7" y="15" width="1" height="1"/><rect className="qr-d" x="9" y="15" width="1" height="1"/><rect className="qr-d" x="12" y="15" width="1" height="1"/><rect className="qr-d" x="14" y="15" width="1" height="1"/><rect className="qr-d" x="17" y="15" width="2" height="1"/><rect className="qr-d" x="20" y="15" width="1" height="1"/>
                      <rect className="qr-d" x="8" y="16" width="1" height="1"/><rect className="qr-d" x="11" y="16" width="1" height="1"/><rect className="qr-d" x="13" y="16" width="1" height="1"/><rect className="qr-d" x="16" y="16" width="1" height="1"/><rect className="qr-d" x="19" y="16" width="1" height="1"/>
                      <rect className="qr-d" x="7" y="17" width="1" height="1"/><rect className="qr-d" x="9" y="17" width="2" height="1"/><rect className="qr-d" x="12" y="17" width="1" height="1"/><rect className="qr-d" x="15" y="17" width="1" height="1"/><rect className="qr-d" x="17" y="17" width="2" height="1"/><rect className="qr-d" x="20" y="17" width="1" height="1"/>
                      <rect className="qr-d" x="8" y="18" width="1" height="1"/><rect className="qr-d" x="11" y="18" width="1" height="1"/><rect className="qr-d" x="14" y="18" width="1" height="1"/><rect className="qr-d" x="16" y="18" width="1" height="1"/><rect className="qr-d" x="19" y="18" width="1" height="1"/>
                      <rect className="qr-d" x="7" y="19" width="1" height="1"/><rect className="qr-d" x="9" y="19" width="1" height="1"/><rect className="qr-d" x="12" y="19" width="1" height="1"/><rect className="qr-d" x="15" y="19" width="1" height="1"/><rect className="qr-d" x="17" y="19" width="1" height="1"/><rect className="qr-d" x="20" y="19" width="1" height="1"/>
                      <rect className="qr-d" x="8" y="20" width="1" height="1"/><rect className="qr-d" x="10" y="20" width="1" height="1"/><rect className="qr-d" x="13" y="20" width="1" height="1"/><rect className="qr-d" x="16" y="20" width="1" height="1"/><rect className="qr-d" x="18" y="20" width="1" height="1"/>
                    </svg>
                  </div>

                  <div className="stub-meta">SCAN AT ENTRY</div>
                  <div className="stub-foot">
                    <svg className="i i12" aria-hidden="true"><use href="#i-wifioff"/></svg>
                    OFFLINE · ID REQ&apos;D
                    <svg className="i i12" aria-hidden="true"><use href="#i-id"/></svg>
                  </div>
                </div>
              </div>

              {/* ══════════ BACK FACE ══════════ */}
              <div className="face back">
                <span className="sheen" aria-hidden="true" />

                <div className="t-main">
                  <div className="t-strip">
                    <svg className="i i11" aria-hidden="true"><use href="#i-shield"/></svg>
                    DAY-OF DETAILS
                    <span className="rt">{passNumber}</span>
                  </div>

                  <div className="b-grid">
                    <div className="b-col">
                      <div className="b-h"><svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg>GOOD TO KNOW</div>
                      <div className="k"><svg className="i i13" aria-hidden="true"><use href="#i-id"/></svg><div><b>BRING STUDENT ID</b><span>shown together with the QR</span></div></div>
                      <div className="k"><svg className="i i13" aria-hidden="true"><use href="#i-food"/></svg><div><b>{event.flags?.food ? "MEALS COVERED" : "REFRESHMENTS"}</b><span>{event.flags?.food ? "food & snacks provided" : "water & snacks on-site"}</span></div></div>
                      <div className="k"><svg className="i i13" aria-hidden="true"><use href="#i-rotate"/></svg><div><b>RE-ENTRY ALLOWED</b><span>pass works throughout the event</span></div></div>
                      <div className="k"><svg className="i i13" aria-hidden="true"><use href="#i-lock"/></svg><div><b>NON-TRANSFERABLE</b><span>tied to {studentId.split(" ")[0]}</span></div></div>
                    </div>

                    <div className="b-col">
                      <div className="b-h"><svg className="i i11" aria-hidden="true"><use href="#i-cal"/></svg>{dateStr}</div>
                      <div className="tl">
                        {agendaTimeline.map((item, idx) => (
                          <div key={idx} className="tl-r">
                            <span className="tl-ico"><svg className="i i12" aria-hidden="true"><use href={item.icon}/></svg></span>
                            <span className="tl-t">{item.time}</span>
                            <span className="tl-x">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="b-foot">
                    <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-wifioff"/></svg>QR WORKS OFFLINE</span>
                    <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg>HELP DESK · {entryStr}</span>
                    <span className="m" style={{ marginLeft: "auto" }}><svg className="i i12" aria-hidden="true"><use href="#i-spark"/></svg>GENIE CAN RESCHEDULE THIS FOR YOU</span>
                  </div>
                </div>

                <div className="t-stub back">
                  <span className="notch n-t" aria-hidden="true" />
                  <span className="notch n-b" aria-hidden="true" />
                  <div className="stub-cap">ADMIT ONE</div>
                  <div className="stub-wrap">
                    <span className="vbar" aria-hidden="true" />
                    <span className="vtext">KEEP THIS HALF · {barcodeText}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions Row ─────────────────────────────────── */}
        <div className="actions">
          <button type="button" onClick={handleGoogleCalendar} className="btn-acc">
            <svg className="i i13" aria-hidden="true"><use href="#i-calplus"/></svg>
            {calAdded ? "Added to Calendar" : "Add to calendar"}
          </button>
          <button type="button" onClick={handleSavePass} className="btn-sec">
            <svg className="i i13" aria-hidden="true"><use href="#i-download"/></svg>
            {copiedPass ? "Pass Copied!" : "Save pass"}
          </button>
          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            className={`btn-pill ${isFlipped ? "active" : ""}`}
          >
            <svg className="i i13" aria-hidden="true"><use href="#i-rotate"/></svg>
            {isFlipped ? "Show front" : "Flip pass"}
          </button>
          <span className="hint">
            <svg className="i i13" aria-hidden="true"><use href="#i-shield"/></svg>
            Valid thru {dateStr} · {gatesStr}
          </span>
        </div>

        {/* ── Panel Footer ───────────────────────────────── */}
        <footer className="panel-foot">
          <svg className="i i13" aria-hidden="true"><use href="#i-shield"/></svg>
          <code>campus_events.delta</code>
          <span>· pass {barcodeText} issued just now</span>
          <span className="foot-right">
            <b>{passNumber}</b> of {event.capacity || 250}
            <button type="button" onClick={onClose} className="cal-link">
              Back to events <svg className="i i11" aria-hidden="true"><use href="#i-arr"/></svg>
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
