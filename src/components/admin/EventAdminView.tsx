"use client";

import { useState, useEffect } from "react";
import "@/app/admin.css";

type AdminEvent = {
  id: string;
  title: string;
  category: "meeting" | "hackathon" | "career" | "workshop" | "social" | "sports";
  catLabel: string;
  catIcon: string;
  date: string;
  time: string;
  location: string;
  attendees: string;
  capNumber: number;
  rsvpsCount: number;
  checkedInCount: number;
  surveyCount?: number;
  status: "live" | "draft" | "ended";
  visibility: "public" | "private";
  isFeatured?: boolean;
  isCanceled?: boolean;
  hasFood?: boolean;
  isHybrid?: boolean;
  duration: string;
  host?: string;
  hostCode?: string;
  description?: string;
  inviteLink?: string;
  feedbackSurvey?: { title: string; count: number; status: string };
};

const INITIAL_EVENTS: AdminEvent[] = [
  {
    id: "e1",
    title: "ACM Weekly — Systems & Pizza",
    category: "meeting",
    catLabel: "Meeting",
    catIcon: "i-msg",
    date: "APR 09",
    time: "6:30 PM",
    location: "Ocean Eng 214",
    attendees: "41/60",
    capNumber: 60,
    rsvpsCount: 41,
    checkedInCount: 27,
    surveyCount: 12,
    status: "live",
    visibility: "public",
    hasFood: true,
    isHybrid: true,
    duration: "1h",
    feedbackSurvey: { title: "Feedback survey", count: 12, status: "live" },
  },
  {
    id: "e2",
    title: "Figma 101 — Campus Design Systems",
    category: "workshop",
    catLabel: "Workshop",
    catIcon: "i-wrench",
    date: "APR 09",
    time: "4:00 PM",
    location: "Virtual · Teams",
    attendees: "Open",
    capNumber: 100,
    rsvpsCount: 18,
    checkedInCount: 0,
    status: "draft",
    visibility: "public",
    isHybrid: true,
    duration: "90m",
  },
  {
    id: "e3",
    title: "Transfer Student Firepit Mixer",
    category: "social",
    catLabel: "Social",
    catIcon: "i-music",
    date: "APR 09",
    time: "7:30 PM",
    location: "Quad Firepit",
    attendees: "47/50",
    capNumber: 50,
    rsvpsCount: 47,
    checkedInCount: 12,
    status: "live",
    visibility: "private",
    hasFood: true,
    duration: "2h",
    inviteLink: "cg.events/e/firepit-mix-9x2",
  },
  {
    id: "e4",
    title: "Hack the Lake — 48h Genie Build Sprint",
    category: "hackathon",
    catLabel: "Hackathon",
    catIcon: "i-code",
    date: "APR 25",
    time: "6:00 PM",
    location: "Colt Arena",
    attendees: "487/512",
    capNumber: 512,
    rsvpsCount: 487,
    checkedInCount: 41,
    surveyCount: 74,
    status: "live",
    visibility: "public",
    isFeatured: true,
    hasFood: true,
    duration: "48h",
    feedbackSurvey: { title: "Pre-hack survey", count: 74, status: "live" },
  },
  {
    id: "e5",
    title: "Databricks Coffee Chats",
    category: "career",
    catLabel: "Career",
    catIcon: "i-brief",
    date: "APR 02",
    time: "1:00 PM",
    location: "Alumni Lounge",
    attendees: "11/12",
    capNumber: 12,
    rsvpsCount: 11,
    checkedInCount: 11,
    status: "ended",
    visibility: "public",
    hasFood: true,
    duration: "30m",
  },
  {
    id: "e6",
    title: "Moonlight Jam on the Quad",
    category: "social",
    catLabel: "Social",
    catIcon: "i-music",
    date: "APR 04",
    time: "9:00 PM",
    location: "Main Quad Stage",
    attendees: "300/300",
    capNumber: 300,
    rsvpsCount: 300,
    checkedInCount: 0,
    status: "ended",
    visibility: "public",
    isCanceled: true,
    duration: "3h",
  },
];

type SurveyQuestion = {
  id: string;
  type: "text" | "radio" | "checkbox" | "scale" | "star";
  title: string;
  required: boolean;
  options?: string[];
  scaleMin?: string;
  scaleMax?: string;
};

const INITIAL_QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    type: "text",
    title: "What should we call your team?",
    required: true,
  },
  {
    id: "q2",
    type: "radio",
    title: "Which track do you want to build in?",
    required: true,
    options: ["Campus Genie agents", "Lakehouse analytics", "Open theme"],
  },
  {
    id: "q3",
    type: "checkbox",
    title: "Any dietary needs? (meals are covered)",
    required: false,
    options: ["Vegetarian", "Vegan", "Gluten-free"],
  },
  {
    id: "q4",
    type: "scale",
    title: "How prepared do you feel for a 48h sprint?",
    required: false,
    scaleMin: "Not at all",
    scaleMax: "Fully",
  },
  {
    id: "q5",
    type: "star",
    title: "Rate last year's Hack the Lake",
    required: false,
  },
];

export default function EventAdminView() {
  const [adminTab, setAdminTab] = useState<"events" | "surveys">("events");
  const [surveySubTab, setSurveySubTab] = useState<"build" | "prev" | "resp">("build");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft" | "ended">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"any" | "public" | "private">("any");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [visMenuOpen, setVisMenuOpen] = useState(false);

  // Composer States
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [compTitle, setCompTitle] = useState("ACM Weekly — Systems & Pizza");
  const [compClub, setCompClub] = useState("ACM");
  const [compDate, setCompDate] = useState("2025-04-09");
  const [compTime, setCompTime] = useState("18:30");
  const [compDuration, setCompDuration] = useState("1h");
  const [compLocation, setCompLocation] = useState("Ocean Engineering 214");
  const [compCapacity, setCompCapacity] = useState("60");
  const [compDesc, setCompDesc] = useState("Weekly systems talk — this week: kernel bypass networking. Pizza from 6:15, hybrid stream on Teams.");
  const [compIsPublic, setCompIsPublic] = useState(true);
  const [compHasFood, setCompHasFood] = useState(true);
  const [compIsHybrid, setCompIsHybrid] = useState(false);
  const [compIsFeatured, setCompIsFeatured] = useState(false);
  const [compCategory, setCompCategory] = useState<"meeting" | "hackathon" | "career" | "workshop" | "social" | "sports">("meeting");
  const [compTint, setCompTint] = useState<string>("var(--hue-hack)");
  const [createdSuccess, setCreatedSuccess] = useState(false);

  // Managed Events States
  const [events, setEvents] = useState<AdminEvent[]>(INITIAL_EVENTS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["e1"]));
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  // Survey States
  const [surveyTitle, setSurveyTitle] = useState("Hack the Lake — Pre-Event Survey");
  const [surveyDesc, setSurveyDesc] = useState("Tell us your track, dietary needs, and team status. 2 minutes.");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(INITIAL_QUESTIONS);
  const [surveyPublished, setSurveyPublished] = useState(false);
  const [surveyAudience, setSurveyAudience] = useState<"link" | "reg">("link");
  const [copiedLink, setCopiedLink] = useState(false);
  const [submittedPreview, setSubmittedPreview] = useState(false);

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (visibilityFilter !== "any" && ev.visibility !== visibilityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return ev.title.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkMakePublic = () => {
    setEvents((prev) =>
      prev.map((ev) => (selectedIds.has(ev.id) ? { ...ev, visibility: "public" } : ev))
    );
    setSelectedIds(new Set());
  };

  const handleBulkMakePrivate = () => {
    setEvents((prev) =>
      prev.map((ev) => (selectedIds.has(ev.id) ? { ...ev, visibility: "private" } : ev))
    );
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    setEvents((prev) => prev.filter((ev) => !selectedIds.has(ev.id)));
    setSelectedIds(new Set());
  };

  // Fetch live events and surveys from API on mount
  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.events && data.events.length > 0) {
          const mapped: AdminEvent[] = data.events.map((e: any) => ({
            id: e.id,
            title: e.title,
            category: e.cat || "meeting",
            catLabel: e.catLabel || "Meeting",
            catIcon: e.catIcon || "i-msg",
            date: e.date || `${e.month || "APR"} ${e.day || "12"}`,
            time: e.time || "6:00 PM",
            location: e.loc || e.location || "Campus Hub",
            attendees: typeof e.registered === "number" && e.capacity ? `${e.registered}/${e.capacity}` : "Open",
            capNumber: typeof e.capacity === "number" ? e.capacity : 60,
            rsvpsCount: typeof e.registered === "number" ? e.registered : 0,
            checkedInCount: Math.floor((typeof e.registered === "number" ? e.registered : 10) * 0.6),
            surveyCount: e.id === "EV-10" ? 74 : e.id === "EV-01" ? 12 : undefined,
            status: (e.status as AdminEvent["status"]) || "live",
            visibility: (e.visibility as AdminEvent["visibility"]) || "public",
            isFeatured: e.isFeatured,
            hasFood: e.flags?.food,
            isHybrid: e.flags?.virtual || e.isVirtual,
            duration: e.duration || "1h",
            host: e.host,
            hostCode: e.hostCode,
            description: e.description,
          }));
          setEvents(mapped);
        }
      })
      .catch((err) => console.warn("Failed to fetch admin events:", err));

    fetch("/api/surveys")
      .then((r) => r.json())
      .then((data) => {
        if (data.surveys && data.surveys.length > 0) {
          const s = data.surveys[0];
          setSurveyTitle(s.title);
          setSurveyDesc(s.description);
          if (s.questions && s.questions.length > 0) {
            setQuestions(s.questions);
          }
          setSurveyPublished(s.isPublished);
        }
      })
      .catch((err) => console.warn("Failed to fetch admin surveys:", err));
  }, []);

  const handleCreateEvent = async () => {
    const newId = `EV-${Date.now().toString().slice(-4)}`;
    const newEv: AdminEvent = {
      id: newId,
      title: compTitle,
      category: compCategory,
      catLabel: compCategory.charAt(0).toUpperCase() + compCategory.slice(1),
      catIcon: compCategory === "hackathon" ? "i-code" : compCategory === "workshop" ? "i-wrench" : compCategory === "social" ? "i-music" : compCategory === "career" ? "i-brief" : "i-msg",
      date: compDate ? compDate.slice(5).replace("-", " ") : "APR 12",
      time: compTime || "6:00 PM",
      location: compLocation || "Campus Hub",
      attendees: `0/${compCapacity}`,
      capNumber: parseInt(compCapacity) || 50,
      rsvpsCount: 0,
      checkedInCount: 0,
      status: "live",
      visibility: compIsPublic ? "public" : "private",
      hasFood: compHasFood,
      isHybrid: compIsHybrid,
      isFeatured: compIsFeatured,
      duration: compDuration,
    };
    setEvents([newEv, ...events]);
    setCreatedSuccess(true);

    // Save to Databricks Lakehouse Delta Table via API
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newId,
          title: compTitle,
          category: compCategory,
          host: compClub,
          location: compLocation,
          date: compDate || "2026-04-12",
          time: compTime,
          duration: compDuration,
          capacity: compCapacity,
          description: compDesc,
          hasFood: compHasFood,
          isVirtual: compIsHybrid,
          isFeatured: compIsFeatured,
          visibility: compIsPublic ? "public" : "private",
          status: "live",
        }),
      });
    } catch (err) {
      console.error("Failed to persist event to Lakehouse:", err);
    }

    setTimeout(() => {
      setCreatedSuccess(false);
      setIsComposerOpen(false);
    }, 800);
  };

  const handlePublishSurvey = async () => {
    const srvId = `SRV-${Date.now().toString().slice(-4)}`;
    try {
      await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: srvId,
          title: surveyTitle,
          description: surveyDesc,
          isPublished: true,
          isFeatured: true,
          audience: surveyAudience,
          questions,
        }),
      });
      setSurveyPublished(true);
    } catch (err) {
      console.error("Failed to publish survey:", err);
      setSurveyPublished(true);
    }
  };

  const fetchLiveEvents = async () => {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          setEvents(
            data.events.map((e: any) => ({
              id: e.id,
              title: e.title,
              category: e.cat || "meeting",
              catLabel: e.catLabel || "Meeting",
              catIcon: e.catIcon || "i-msg",
              date: e.date || `${e.month || "APR"} ${e.day || "15"}`,
              time: e.time || "6:00 PM",
              location: e.loc || "Campus Hub",
              attendees: `${typeof e.registered === "number" ? e.registered : 0}/${e.capacity || 60}`,
              capNumber: e.capacity || 60,
              rsvpsCount: typeof e.registered === "number" ? e.registered : 0,
              checkedInCount: Math.round((typeof e.registered === "number" ? e.registered : 0) * 0.6),
              status: e.status || "live",
              visibility: e.visibility || "public",
              isFeatured: e.isFeatured,
              hasFood: e.flags?.food,
              isHybrid: e.isVirtual,
              duration: e.duration || "1h",
              host: e.host,
              hostCode: e.hostCode,
              description: e.description,
            }))
          );
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live admin events:", err);
    }
  };

  useEffect(() => {
    fetchLiveEvents();
  }, []);

  const handleSaveRow = async (id: string) => {
    setSavedRowId(id);
    const target = events.find((e) => e.id === id);
    if (target) {
      try {
        const response = await fetch("/api/events", {
          method: "PUT",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: target.id,
            title: target.title,
            category: target.category,
            host: target.host,
            hostCode: target.hostCode,
            location: target.location,
            date: /^\d{4}-\d{2}-\d{2}$/.test(target.date) ? target.date : undefined,
            time: target.time,
            duration: target.duration,
            capacity: target.capNumber,
            food: target.hasFood,
            isHybrid: target.isHybrid,
            featured: target.isFeatured,
            status: target.status,
            visibility: target.visibility,
            description: target.description,
          }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || `HTTP ${response.status}`);
        }
        window.dispatchEvent(new Event("cg-events-updated"));
        localStorage.setItem("cg-events-updated", String(Date.now()));
      } catch (err) {
        console.error("Failed to update event in Lakehouse:", err);
        setSavedRowId(null);
        return;
      }
    }
    setTimeout(() => setSavedRowId(null), 1200);
  };

  const handleDuplicateRow = async (id: string) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;
    const newId = `EV-${Date.now().toString().slice(-4)}`;
    const dup: AdminEvent = {
      ...target,
      id: newId,
      title: `${target.title} (Copy)`,
      status: "draft",
    };
    setEvents([dup, ...events]);
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newId,
          title: dup.title,
          category: dup.category,
          location: dup.location,
          time: dup.time,
          duration: dup.duration,
          capacity: dup.capNumber,
          food: dup.hasFood,
          isHybrid: dup.isHybrid,
          featured: dup.isFeatured,
          status: "draft",
          visibility: dup.visibility,
        }),
      });
    } catch (err) {
      console.error("Failed to duplicate event in Lakehouse:", err);
    }
  };

  const handleDeleteRow = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete event in Lakehouse:", err);
    }
  };

  return (
    <div className="admin-scope">
      {/* Complete Feather-Style SVG Sprite embedded directly */}
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} aria-hidden="true">
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Z"/><circle cx="12" cy="10.2" r="2.6"/></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 21v-1.8a4 4 0 0 0-3-3.87M15.5 4.2a3.5 3.5 0 0 1 0 6.7"/></symbol>
        <symbol id="i-video" viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></symbol>
        <symbol id="i-food" viewBox="0 0 24 24"><path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2M5.5 11v11"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7"/></symbol>
        <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 6.5-5.5 5.5L8 17.5M16 6.5 21.5 12 16 17.5"/></symbol>
        <symbol id="i-brief" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="13.5" rx="2"/><path d="M16 20.5V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14.5"/></symbol>
        <symbol id="i-wrench" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></symbol>
        <symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V5.5L21 3v12.5"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15.5" r="3"/></symbol>
        <symbol id="i-ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M4.2 5.4l15.6 13.2M19.8 5.4 4.2 18.6"/></symbol>
        <symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.8-1L3 20.5 5.5 15a8.5 8.5 0 1 1 15.5-3.5Z"/></symbol>
        <symbol id="i-bookm" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
        <symbol id="i-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
        <symbol id="i-arr" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></symbol>
        <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z"/><path d="M19 15.5v3M17.5 17h3"/></symbol>
        <symbol id="i-hour" viewBox="0 0 24 24"><path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></symbol>
        <symbol id="i-ext" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>
        <symbol id="i-db" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></symbol>
        <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></symbol>
        <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></symbol>
        <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3.5" y="11" width="17" height="10.5" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
        <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14.7 14.7 0 0 1 3.8 9A14.7 14.7 0 0 1 12 21a14.7 14.7 0 0 1-3.8-9A14.7 14.7 0 0 1 12 3Z"/></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
        <symbol id="i-drag" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="9" cy="5.5" r="1.7"/><circle cx="15" cy="5.5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18.5" r="1.7"/><circle cx="15" cy="18.5" r="1.7"/></g></symbol>
        <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9L18.2 21 12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z"/></symbol>
        <symbol id="i-type" viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></symbol>
        <symbol id="i-radio" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></symbol>
        <symbol id="i-check-sq" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></symbol>
        <symbol id="i-activity" viewBox="0 0 24 24"><path d="M22 12h-4l-3 8-6-16-3 8H2"/></symbol>
        <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
        <symbol id="i-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></symbol>
        <symbol id="i-eye" viewBox="0 0 24 24"><path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></symbol>
        <symbol id="i-more" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></g></symbol>
        <symbol id="i-send" viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></symbol>
        <symbol id="i-undo" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path d="M6 20v-7M12 20V5M18 20v-10M3 20h18"/></symbol>
        <symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22V15"/></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></symbol>
        <symbol id="i-up" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>
      </svg>

      <div className="frame">
        <div className="win">
          {/* ── Subhead: Admin Tabs ── */}
          <div className="subhead">
            <div className="seg" role="tablist" aria-label="Admin sections">
              <span
                className="seg-glide"
                style={{
                  transform: adminTab === "events" ? "translateX(0%)" : "translateX(100%)",
                }}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setAdminTab("events")}
                className={`seg-item ${adminTab === "events" ? "active" : ""}`}
              >
                <svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg>Events
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("surveys")}
                className={`seg-item ${adminTab === "surveys" ? "active" : ""}`}
              >
                <svg className="i i13" aria-hidden="true"><use href="#i-chart"/></svg>Surveys
              </button>
            </div>
            <span className="admin-chip">
              <svg className="i i11" aria-hidden="true"><use href="#i-shield"/></svg>Admin mode
            </span>
            <span className="quiet">
              <svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>4 clubs
            </span>
          </div>

          {/* ══════════════════════════════════════════════════
               EVENTS VIEW
               ════════════════════════════════════════════════ */}
          {adminTab === "events" && (
            <section className="v-events">
              {/* Stat Strip */}
              <div className="stats">
                <div className="stat">
                  <div className="stat-h">
                    <svg className="i i13" aria-hidden="true"><use href="#i-cal"/></svg>Active events
                    <span className="dp up" style={{ marginLeft: "auto" }}>
                      <svg className="i i11" aria-hidden="true"><use href="#i-up"/></svg>+2
                    </span>
                  </div>
                  <div className="stat-v">14</div>
                  <svg className="spk" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
                    <path className="spk-a" d="M2 20 14 17 26 18 38 12 50 14 62 9 74 11 86 6 98 4V26H2Z"/>
                    <polyline className="spk-l" points="2,20 14,17 26,18 38,12 50,14 62,9 74,11 86,6 98,4"/>
                  </svg>
                </div>
                <div className="stat">
                  <div className="stat-h">
                    <svg className="i i13" aria-hidden="true"><use href="#i-check"/></svg>RSVPs this week
                    <span className="dp up" style={{ marginLeft: "auto" }}>
                      <svg className="i i11" aria-hidden="true"><use href="#i-up"/></svg>18%
                    </span>
                  </div>
                  <div className="stat-v">312</div>
                  <svg className="spk" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
                    <path className="spk-a" d="M2 22 14 20 26 16 38 17 50 12 62 14 74 8 86 9 98 3V26H2Z"/>
                    <polyline className="spk-l" points="2,22 14,20 26,16 38,17 50,12 62,14 74,8 86,9 98,3"/>
                  </svg>
                </div>
                <div className="stat">
                  <div className="stat-h">
                    <svg className="i i13" aria-hidden="true"><use href="#i-users"/></svg>Avg. capacity fill
                  </div>
                  <div className="stat-v">72<span style={{ fontSize: 13, color: "var(--ink-3)" }}>%</span></div>
                  <div className="mbars" aria-hidden="true">
                    <i style={{ height: "38%" }} /><i style={{ height: "52%" }} /><i style={{ height: "44%" }} />
                    <i style={{ height: "66%" }} /><i style={{ height: "58%" }} /><i style={{ height: "80%" }} />
                    <i style={{ height: "72%" }} />
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-h">
                    <svg className="i i13" aria-hidden="true"><use href="#i-chart"/></svg>Survey responses
                    <span className="dp dn" style={{ marginLeft: "auto" }}>
                      <svg className="i i11" aria-hidden="true" style={{ transform: "rotate(90deg)" }}><use href="#i-up"/></svg>4
                    </span>
                  </div>
                  <div className="stat-v">86</div>
                  <svg className="spk" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
                    <path className="spk-a" d="M2 8 14 6 26 10 38 7 50 12 62 10 74 15 86 13 98 17V26H2Z"/>
                    <polyline className="spk-l" points="2,8 14,6 26,10 38,7 50,12 62,10 74,15 86,13 98,17"/>
                  </svg>
                </div>
              </div>

              {/* Toolbar */}
              <div className="tbar">
                <label className="search">
                  <svg className="i i13" aria-hidden="true"><use href="#i-search"/></svg>
                  <input
                    type="search"
                    placeholder="Search events, hosts…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search events"
                  />
                  <kbd>/</kbd>
                </label>

                {/* Status Dropdown Filter */}
                <div className="menu">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((o) => !o)}
                    className="menu-btn"
                    title="Filter by status"
                  >
                    <svg className="i i13" aria-hidden="true"><use href="#i-sliders"/></svg>
                    <span>
                      {statusFilter === "all" ? "All statuses" : statusFilter === "live" ? "Live" : statusFilter === "draft" ? "Drafts" : "Ended"}
                    </span>
                    <svg className="i i13 chev" aria-hidden="true"><use href="#i-chev"/></svg>
                  </button>
                  {statusMenuOpen && (
                    <div className="menu-pop">
                      <div className="menu-title">Status</div>
                      <div className={`menu-row ${statusFilter === "all" ? "active" : ""}`} onClick={() => { setStatusFilter("all"); setStatusMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-activity"/></svg>
                        <span>All</span>
                        <b>{events.length}</b>
                      </div>
                      <div className={`menu-row ${statusFilter === "live" ? "active" : ""}`} onClick={() => { setStatusFilter("live"); setStatusMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-spark"/></svg>
                        <span>Live</span>
                        <b>{events.filter((x) => x.status === "live").length}</b>
                      </div>
                      <div className={`menu-row ${statusFilter === "draft" ? "active" : ""}`} onClick={() => { setStatusFilter("draft"); setStatusMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-pencil"/></svg>
                        <span>Draft</span>
                        <b>{events.filter((x) => x.status === "draft").length}</b>
                      </div>
                      <div className={`menu-row ${statusFilter === "ended" ? "active" : ""}`} onClick={() => { setStatusFilter("ended"); setStatusMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-check"/></svg>
                        <span>Ended</span>
                        <b>{events.filter((x) => x.status === "ended").length}</b>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visibility Dropdown Filter */}
                <div className="menu">
                  <button
                    type="button"
                    onClick={() => setVisMenuOpen((o) => !o)}
                    className="menu-btn"
                    title="Filter by visibility"
                  >
                    <svg className="i i13" aria-hidden="true"><use href="#i-eye"/></svg>
                    <span>
                      {visibilityFilter === "any" ? "Any visibility" : visibilityFilter === "public" ? "Public" : "Private"}
                    </span>
                    <svg className="i i13 chev" aria-hidden="true"><use href="#i-chev"/></svg>
                  </button>
                  {visMenuOpen && (
                    <div className="menu-pop">
                      <div className="menu-title">Visibility</div>
                      <div className={`menu-row ${visibilityFilter === "any" ? "active" : ""}`} onClick={() => { setVisibilityFilter("any"); setVisMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-globe"/></svg>
                        <span>Any</span>
                        <b>{events.length}</b>
                      </div>
                      <div className={`menu-row ${visibilityFilter === "public" ? "active" : ""}`} onClick={() => { setVisibilityFilter("public"); setVisMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-globe"/></svg>
                        <span>Public</span>
                        <b>{events.filter((x) => x.visibility === "public").length}</b>
                      </div>
                      <div className={`menu-row ${visibilityFilter === "private" ? "active" : ""}`} onClick={() => { setVisibilityFilter("private"); setVisMenuOpen(false); }}>
                        <svg className="i i13" aria-hidden="true"><use href="#i-lock"/></svg>
                        <span>Private</span>
                        <b>{events.filter((x) => x.visibility === "private").length}</b>
                      </div>
                    </div>
                  )}
                </div>

                {/* New Event Button Toggle */}
                <button
                  type="button"
                  onClick={() => setIsComposerOpen((o) => !o)}
                  className="btn-acc"
                  style={{ marginLeft: "auto" }}
                  title="Toggle the new-event editor"
                >
                  {isComposerOpen ? (
                    <>
                      <svg className="i i13" aria-hidden="true"><use href="#i-x"/></svg>Close editor
                    </>
                  ) : (
                    <>
                      <svg className="i i13" aria-hidden="true"><use href="#i-plus"/></svg>New event
                    </>
                  )}
                </button>
              </div>

              {/* ── New Event Composer (Collapsible) ─────────── */}
              {isComposerOpen && (
                <div className="composer">
                  <div className="cgrid">
                    {/* Left: Form Fields */}
                    <div className="fgrid">
                      <div className="fld span2">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-type"/></svg>Event title</span>
                        <input className="big" type="text" value={compTitle} onChange={(e) => setCompTitle(e.target.value)} aria-label="Event title" />
                      </div>
                      <div className="fld">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>Host club</span>
                        <input type="text" value={compClub} onChange={(e) => setCompClub(e.target.value)} aria-label="Host club" />
                      </div>
                      <div className="fld">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-cal"/></svg>Date</span>
                        <input type="date" value={compDate} onChange={(e) => setCompDate(e.target.value)} aria-label="Date" />
                      </div>
                      <div className="fld">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-clock"/></svg>Starts</span>
                        <input type="time" value={compTime} onChange={(e) => setCompTime(e.target.value)} aria-label="Start time" />
                      </div>
                      <div className="fld span2">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-hour"/></svg>Duration</span>
                        <div className="chiprow">
                          {["30m", "1h", "90m", "2h", "3h", "48h"].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setCompDuration(d)}
                              className={`pchip ${compDuration === d ? "active" : ""}`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="fld span2">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg>Location</span>
                        <input type="text" value={compLocation} onChange={(e) => setCompLocation(e.target.value)} aria-label="Location" />
                      </div>
                      <div className="fld span2">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>Capacity</span>
                        <div className="chiprow">
                          {["24", "40", "60", "100", "150", "Open"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCompCapacity(c)}
                              className={`pchip ${compCapacity === c ? "active" : ""}`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="fld span2">
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-msg"/></svg>Description</span>
                        <textarea value={compDesc} onChange={(e) => setCompDesc(e.target.value)} aria-label="Description" />
                      </div>
                      <div className="swrow span2">
                        <label className={`sw ${compIsPublic ? "is-on" : ""}`} onClick={() => setCompIsPublic((p) => !p)}>
                          <span className="sw-t" />
                          <span className="sw-lb">{compIsPublic ? "Public" : "Private"}</span>
                        </label>
                        <label className={`sw ${compHasFood ? "is-on" : ""}`} onClick={() => setCompHasFood((p) => !p)}>
                          <svg className="i i12" aria-hidden="true"><use href="#i-food"/></svg>
                          <span className="sw-t" />
                          <span className="sw-lb">Food</span>
                        </label>
                        <label className={`sw ${compIsHybrid ? "is-on" : ""}`} onClick={() => setCompIsHybrid((p) => !p)}>
                          <svg className="i i12" aria-hidden="true"><use href="#i-video"/></svg>
                          <span className="sw-t" />
                          <span className="sw-lb">Hybrid</span>
                        </label>
                        <label className={`sw ${compIsFeatured ? "is-on" : ""}`} onClick={() => setCompIsFeatured((p) => !p)}>
                          <svg className="i i12" aria-hidden="true"><use href="#i-flag"/></svg>
                          <span className="sw-t" />
                          <span className="sw-lb">Featured</span>
                        </label>
                      </div>
                    </div>

                    {/* Right: Live Preview Card + Category & Tint */}
                    <div>
                      <div className="pvlabel"><svg className="i i11" aria-hidden="true"><use href="#i-eye"/></svg>Live preview</div>
                      <div className="pvwrap">
                        <div className="pvcard" style={{ opacity: compIsPublic ? 1 : 0.6 }}>
                          <div className="pv-top">
                            <span className={`cat cat-${compCategory}`}>
                              <svg className="i i11" aria-hidden="true"><use href={compCategory === "hackathon" ? "#i-code" : compCategory === "workshop" ? "#i-wrench" : compCategory === "social" ? "#i-music" : compCategory === "career" ? "#i-brief" : "#i-msg"}/></svg>
                              {compCategory.toUpperCase()}
                            </span>
                            <span className="pill pill-live"><i className="dot" aria-hidden="true" />Live</span>
                          </div>
                          <div className="pv-body">
                            <div className="tile" aria-hidden="true">
                              <span className="tile-mon">APR</span>
                              <span className="tile-day">09</span>
                              <span className="tile-dow">WED</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="pv-title">{compTitle}</div>
                              <div className="pv-meta">
                                <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-clock"/></svg>{compTime}</span>
                                <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg>{compLocation}</span>
                              </div>
                              <div className="capbar"><i style={{ width: "68%" }} /></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Category Selection */}
                      <div className="fld" style={{ marginTop: 12 }}>
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-eye"/></svg>Category</span>
                        <div className="chiprow">
                          {(["meeting", "hackathon", "career", "workshop", "social", "sports"] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setCompCategory(cat)}
                              className={`pchip ${compCategory === cat ? "active" : ""}`}
                            >
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cover Tint Swatches */}
                      <div className="fld" style={{ marginTop: 10 }}>
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-spark"/></svg>Cover tint</span>
                        <div className="swatches">
                          {[
                            { name: "Meeting blue", val: "var(--hue-meeting)" },
                            { name: "Hackathon violet", val: "var(--hue-hack)" },
                            { name: "Career amber", val: "var(--hue-career)" },
                            { name: "Workshop green", val: "var(--hue-workshop)" },
                            { name: "Social rose", val: "var(--hue-social)" },
                            { name: "Sports cyan", val: "var(--hue-sports)" },
                          ].map((sw) => (
                            <span
                              key={sw.name}
                              title={sw.name}
                              onClick={() => setCompTint(sw.val)}
                              className={`swatch ${compTint === sw.val ? "active" : ""}`}
                            >
                              <i style={{ ["--tag" as any]: sw.val }} />
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Visibility Explainer */}
                      <div className="fld vcard" style={{ marginTop: 10 }}>
                        <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-lock"/></svg>Visibility</span>
                        <div className={`vrow ${compIsPublic ? "active" : ""}`} onClick={() => setCompIsPublic(true)}>
                          <svg className="i i13" aria-hidden="true"><use href="#i-globe"/></svg>
                          <div><b>Public</b><span>Listed on the campus events feed and search.</span></div>
                        </div>
                        <div className={`vrow ${!compIsPublic ? "active" : ""}`} onClick={() => setCompIsPublic(false)}>
                          <svg className="i i13" aria-hidden="true"><use href="#i-lock"/></svg>
                          <div><b>Private</b><span>Link-only invite. Hidden from feeds, search, and Genie.</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="cfoot">
                    <span className="chint">
                      <svg className="i i12" aria-hidden="true"><use href="#i-spark"/></svg>Genie will cross-post to the club channel on publish
                    </span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn" onClick={() => setIsComposerOpen(false)}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleCreateEvent} className="btn-acc" title="Create event">
                        {createdSuccess ? (
                          <>
                            <svg className="i i12" aria-hidden="true"><use href="#i-check"/></svg>Created
                          </>
                        ) : (
                          <>
                            <svg className="i i13" aria-hidden="true"><use href="#i-plus"/></svg>Create event
                          </>
                        )}
                      </button>
                    </span>
                  </div>
                </div>
              )}

              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="bbar">
                  <span className="bl">
                    <svg className="i i13" aria-hidden="true"><use href="#i-check-sq"/></svg>
                    {selectedIds.size} selected
                  </span>
                  <span className="sp" />
                  <button type="button" onClick={handleBulkMakePublic} className="btn">
                    <svg className="i i12" aria-hidden="true"><use href="#i-globe"/></svg>Make public
                  </button>
                  <button type="button" onClick={handleBulkMakePrivate} className="btn">
                    <svg className="i i12" aria-hidden="true"><use href="#i-lock"/></svg>Make private
                  </button>
                  <button type="button" onClick={handleBulkDelete} className="btn red">
                    <svg className="i i12" aria-hidden="true"><use href="#i-trash"/></svg>Delete
                  </button>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="btn">
                    Clear
                  </button>
                </div>
              )}

              {/* ── Managed Events List ──────────────────────── */}
              <div className="mlist">
                {filteredEvents.map((ev) => {
                  const isSelected = selectedIds.has(ev.id);
                  const isExpanded = expandedIds.has(ev.id);

                  return (
                    <article
                      key={ev.id}
                      className={`mrow ${isExpanded ? "is-expanded" : ""}`}
                      data-st={ev.status}
                      data-vis={ev.visibility}
                    >
                      <div className="row-main">
                        <label className={`sel ${isSelected ? "checked" : ""}`} onClick={() => toggleSelect(ev.id)} title="Select event">
                          <span className="cbx">
                            <svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg>
                          </span>
                        </label>
                        <span className={`cat cat-${ev.category}`}>
                          <svg className="i i11" aria-hidden="true"><use href={`#${ev.catIcon}`}/></svg>
                          {ev.catLabel}
                        </span>
                        <div className="rbody">
                          <div className="rtitle">
                            {ev.visibility === "private" && (
                              <span title="Private event" className="inline-flex items-center">
                                <svg className="i i12" aria-hidden="true"><use href="#i-lock"/></svg>
                              </span>
                            )}
                            {ev.title}
                          </div>
                          <div className="rmeta">
                            <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-cal"/></svg>{ev.date}</span>
                            <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-clock"/></svg>{ev.time}</span>
                            <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg>{ev.location}</span>
                            <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>{ev.attendees}</span>
                            {ev.surveyCount !== undefined && (
                              <span className="m"><svg className="i i12" aria-hidden="true"><use href="#i-chart"/></svg>{ev.surveyCount}</span>
                            )}
                          </div>
                        </div>

                        {ev.isCanceled ? (
                          <span className="pill pill-cxl"><svg className="i i11" aria-hidden="true"><use href="#i-x"/></svg>Canceled</span>
                        ) : ev.isFeatured ? (
                          <span className="pill pill-feat"><svg className="i i11" aria-hidden="true"><use href="#i-flag"/></svg>Featured</span>
                        ) : ev.status === "live" ? (
                          <span className="pill pill-live"><i className="dot" aria-hidden="true" />Live</span>
                        ) : ev.status === "draft" ? (
                          <span className="pill pill-draft"><i className="dot" aria-hidden="true" />Draft</span>
                        ) : (
                          <span className="pill pill-quiet"><svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg>Ended</span>
                        )}

                        <label
                          className={`sw ${ev.visibility === "public" ? "is-on" : ""}`}
                          onClick={() => {
                            setEvents((prev) =>
                              prev.map((x) =>
                                x.id === ev.id ? { ...x, visibility: x.visibility === "public" ? "private" : "public" } : x
                              )
                            );
                          }}
                          title="Toggle visibility"
                        >
                          <span className="sw-t" />
                          <span className="sw-lb">{ev.visibility === "public" ? "Public" : "Private"}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => toggleExpand(ev.id)}
                          className={`row-chev ${isExpanded ? "is-open" : ""}`}
                          title="Edit event"
                        >
                          <svg className="i i14" aria-hidden="true"><use href="#i-chev"/></svg>
                        </button>
                      </div>

                      {/* Expandable Inline Editor */}
                      {isExpanded && (
                        <div className="red">
                          <div className="red-l">
                            <div className="fgrid">
                              <div className="fld span2">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-pencil"/></svg>Title</span>
                                <input
                                  type="text"
                                  value={ev.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, title: val } : x)));
                                  }}
                                  aria-label="Title"
                                />
                              </div>
                              <div className="fld">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-cal"/></svg>Date</span>
                                <input type="text" value={ev.date} onChange={(e) => {
                                  const val = e.target.value;
                                  setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, date: val } : x)));
                                }} />
                              </div>
                              <div className="fld">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-clock"/></svg>Start</span>
                                <input type="text" value={ev.time} onChange={(e) => {
                                  const val = e.target.value;
                                  setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, time: val } : x)));
                                }} />
                              </div>
                            </div>
                            <div className="frow">
                              <div className="fld">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-hour"/></svg>Duration</span>
                                <div className="chiprow">
                                  {["30m", "1h", "90m", "2h", "48h"].map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, duration: d } : x)))}
                                      className={`pchip ${ev.duration === d ? "active" : ""}`}
                                    >
                                      {d}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="fld">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>Capacity</span>
                                <div className="chiprow">
                                  {["40", "60", "80", "512", "Open"].map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, capNumber: parseInt(c) || 100 } : x)))}
                                      className={`pchip ${ev.capNumber.toString() === c ? "active" : ""}`}
                                    >
                                      {c}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="fld">
                                <span className="lb"><svg className="i i12" aria-hidden="true"><use href="#i-pin"/></svg>Location</span>
                                <input
                                  type="text"
                                  value={ev.location}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, location: val } : x)));
                                  }}
                                />
                              </div>
                            </div>
                            <div className="swrow">
                              <label
                                className={`sw ${ev.visibility === "public" ? "is-on" : ""}`}
                                onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, visibility: x.visibility === "public" ? "private" : "public" } : x)))}
                              >
                                <span className="sw-t" />
                                <span className="sw-lb">{ev.visibility === "public" ? "Public" : "Private"}</span>
                              </label>
                              <label
                                className={`sw ${ev.hasFood ? "is-on" : ""}`}
                                onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, hasFood: !x.hasFood } : x)))}
                              >
                                <svg className="i i12" aria-hidden="true"><use href="#i-food"/></svg>
                                <span className="sw-t" />
                                <span className="sw-lb">Food</span>
                              </label>
                              <label
                                className={`sw ${ev.isHybrid ? "is-on" : ""}`}
                                onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, isHybrid: !x.isHybrid } : x)))}
                              >
                                <svg className="i i12" aria-hidden="true"><use href="#i-video"/></svg>
                                <span className="sw-t" />
                                <span className="sw-lb">Hybrid</span>
                              </label>
                              <label
                                className={`sw ${ev.isFeatured ? "is-on" : ""}`}
                                onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, isFeatured: !x.isFeatured } : x)))}
                              >
                                <svg className="i i12" aria-hidden="true"><use href="#i-flag"/></svg>
                                <span className="sw-t" />
                                <span className="sw-lb">Featured</span>
                              </label>
                            </div>
                          </div>

                          <div className="red-r">
                            <div className="panel-in">
                              <div className="pi-h"><svg className="i i12" aria-hidden="true"><use href="#i-activity"/></svg>Status</div>
                              <div className="stchips">
                                <button
                                  type="button"
                                  onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, status: "live" } : x)))}
                                  className={`stchip st-live ${ev.status === "live" ? "active" : ""}`}
                                >
                                  <i className="dot" />Live
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, status: "draft" } : x)))}
                                  className={`stchip st-draft ${ev.status === "draft" ? "active" : ""}`}
                                >
                                  <i className="dot" />Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, status: "ended" } : x)))}
                                  className={`stchip st-end ${ev.status === "ended" ? "active" : ""}`}
                                >
                                  <i className="dot" />Ended
                                </button>
                              </div>
                            </div>

                            <div className="panel-in">
                              <div className="pi-h"><svg className="i i12" aria-hidden="true"><use href="#i-users"/></svg>Attendance</div>
                              <div className="avs" aria-hidden="true">
                                <span className="av">MK</span><span className="av">JT</span><span className="av">RS</span><span className="av">AL</span>
                                <span className="av more">+{ev.rsvpsCount > 4 ? ev.rsvpsCount - 4 : 0}</span>
                              </div>
                              <div className="duo" aria-hidden="true">
                                <i style={{ width: `${Math.min(100, (ev.rsvpsCount / (ev.capNumber || 1)) * 100)}%` }} />
                                <b style={{ width: `${Math.min(100, (ev.checkedInCount / (ev.capNumber || 1)) * 100)}%` }} />
                              </div>
                              <div className="legend">
                                <span className="lg n"><i className="dot" />{ev.rsvpsCount} RSVP</span>
                                <span className="lg g"><i className="dot" />{ev.checkedInCount} in</span>
                                <span className="lg"><i className="dot" style={{ background: "color-mix(in srgb, var(--ink) 12%, transparent)" }} />{ev.capNumber} cap</span>
                              </div>
                            </div>

                            {ev.feedbackSurvey && (
                              <div className="panel-in surveychip">
                                <span className="sc-i"><svg className="i i13" aria-hidden="true"><use href="#i-chart"/></svg></span>
                                <div><b>{ev.feedbackSurvey.title}</b><span>{ev.feedbackSurvey.count} responses · {ev.feedbackSurvey.status}</span></div>
                                <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setAdminTab("surveys")}>
                                  <svg className="i i12" aria-hidden="true"><use href="#i-pencil"/></svg>Edit
                                </button>
                              </div>
                            )}

                            {ev.inviteLink && (
                              <div className="panel-in">
                                <div className="pi-h"><svg className="i i12" aria-hidden="true"><use href="#i-link"/></svg>Invite link</div>
                                <div className="share" style={{ display: "flex", position: "relative" }}>
                                  <svg className="i i12" aria-hidden="true"><use href="#i-link"/></svg>
                                  <input readOnly value={ev.inviteLink} aria-label="Invite link" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(ev.inviteLink || "");
                                    }}
                                    className="swap ghost"
                                    style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="edits-acts">
                              <button type="button" onClick={() => handleSaveRow(ev.id)} className="swap" title="Save changes">
                                {savedRowId === ev.id ? (
                                  <>
                                    <svg className="i i12" aria-hidden="true"><use href="#i-check"/></svg>Saved
                                  </>
                                ) : (
                                  "Save changes"
                                )}
                              </button>
                              <button type="button" onClick={() => handleDuplicateRow(ev.id)} className="btn" title="Duplicate">
                                <svg className="i i12" aria-hidden="true"><use href="#i-copy"/></svg>Duplicate
                              </button>
                              <button type="button" onClick={() => handleDeleteRow(ev.id)} className="btn red" title="Delete">
                                <svg className="i i12" aria-hidden="true"><use href="#i-trash"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════
               SURVEYS VIEW
               ════════════════════════════════════════════════ */}
          {adminTab === "surveys" && (
            <section className="v-surveys">
              <div className="tbar">
                <div className="seg seg3" role="tablist" aria-label="Survey views">
                  <span
                    className="seg-glide"
                    style={{
                      transform:
                        surveySubTab === "build"
                          ? "translateX(0%)"
                          : surveySubTab === "prev"
                          ? "translateX(100%)"
                          : "translateX(200%)",
                    }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => setSurveySubTab("build")}
                    className={`seg-item ${surveySubTab === "build" ? "active" : ""}`}
                  >
                    <svg className="i i13" aria-hidden="true"><use href="#i-pencil"/></svg>Build
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveySubTab("prev")}
                    className={`seg-item ${surveySubTab === "prev" ? "active" : ""}`}
                  >
                    <svg className="i i13" aria-hidden="true"><use href="#i-eye"/></svg>Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveySubTab("resp")}
                    className={`seg-item ${surveySubTab === "resp" ? "active" : ""}`}
                  >
                    <svg className="i i13" aria-hidden="true"><use href="#i-chart"/></svg>Responses
                  </button>
                </div>
                <span className="quiet" style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg className="i i12" aria-hidden="true"><use href="#i-undo"/></svg>Autosaved 2m ago
                </span>
                <button type="button" className="ib tbtn" title="Refresh responses">
                  <svg className="i i13" aria-hidden="true"><use href="#i-rotate"/></svg>
                </button>
              </div>

              {/* ── BUILD SUB-TAB ── */}
              {surveySubTab === "build" && (
                <div className="szone" style={{ padding: "0 0 12px" }}>
                  <div className="sq">
                    <div className="sq-strip" aria-hidden="true" />
                    <div className="sq-head">
                      <div className="sq-t">
                        <input
                          value={surveyTitle}
                          onChange={(e) => setSurveyTitle(e.target.value)}
                          aria-label="Survey title"
                        />
                        <input
                          className="desc"
                          value={surveyDesc}
                          onChange={(e) => setSurveyDesc(e.target.value)}
                          aria-label="Survey description"
                        />
                      </div>
                      <div className="sq-acts">
                        <button type="button" className="ib" title="Survey settings"><svg className="i i13" aria-hidden="true"><use href="#i-sliders"/></svg></button>
                        <button type="button" className="ib" title="Undo"><svg className="i i13" aria-hidden="true"><use href="#i-undo"/></svg></button>
                        <button type="button" className="ib" title="More"><svg className="i i13" aria-hidden="true"><use href="#i-more"/></svg></button>
                      </div>
                    </div>
                  </div>

                  {/* Survey Questions List */}
                  {questions.map((q, idx) => (
                    <div key={q.id} className="qcard">
                      <div className="q-h">
                        <span className="q-drag" title="Reorder"><svg className="i i13" aria-hidden="true"><use href="#i-drag"/></svg></span>
                        <input
                          className="q-title"
                          value={q.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, title: val } : x)));
                          }}
                          aria-label="Question"
                        />
                        {q.required && <span className="req" title="Required">*</span>}
                      </div>

                      <div className="q-body">
                        {q.type === "text" && (
                          <div className="opt">
                            <span className="m" style={{ padding: "4px 6px" }}>
                              <svg className="i i12" aria-hidden="true"><use href="#i-type"/></svg>Short-answer text
                            </span>
                          </div>
                        )}

                        {q.type === "radio" && (
                          <>
                            {q.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="opt">
                                <span className="pr"><i></i></span>
                                <input
                                  className="otxt"
                                  value={opt}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const opts = [...(q.options || [])];
                                    opts[oIdx] = val;
                                    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                                  }}
                                />
                                <button
                                  type="button"
                                  className="obx"
                                  title="Remove option"
                                  onClick={() => {
                                    const opts = (q.options || []).filter((_, i) => i !== oIdx);
                                    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                                  }}
                                >
                                  <svg className="i i11" aria-hidden="true"><use href="#i-x"/></svg>
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="addo"
                              onClick={() => {
                                const opts = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
                                setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                              }}
                            >
                              <span className="pr"><svg className="i i11" aria-hidden="true"><use href="#i-plus"/></svg></span>Add option
                            </button>
                          </>
                        )}

                        {q.type === "checkbox" && (
                          <>
                            {q.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="opt">
                                <span className="pr sq"><svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg></span>
                                <input
                                  className="otxt"
                                  value={opt}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const opts = [...(q.options || [])];
                                    opts[oIdx] = val;
                                    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                                  }}
                                />
                                <button
                                  type="button"
                                  className="obx"
                                  title="Remove option"
                                  onClick={() => {
                                    const opts = (q.options || []).filter((_, i) => i !== oIdx);
                                    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                                  }}
                                >
                                  <svg className="i i11" aria-hidden="true"><use href="#i-x"/></svg>
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="addo"
                              onClick={() => {
                                const opts = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
                                setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, options: opts } : x)));
                              }}
                            >
                              <span className="pr"><svg className="i i11" aria-hidden="true"><use href="#i-plus"/></svg></span>Add option
                            </button>
                          </>
                        )}

                        {q.type === "scale" && (
                          <div className="scale">
                            <span className="scl">{q.scaleMin || "Not at all"}</span>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className="scn">{n}</span>
                            ))}
                            <span className="scl">{q.scaleMax || "Fully"}</span>
                          </div>
                        )}

                        {q.type === "star" && (
                          <div className="stars">
                            {[5, 4, 3, 2, 1].map((s) => (
                              <label key={s}><svg className="i" aria-hidden="true"><use href="#i-star"/></svg></label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="q-f">
                        <span className="m" style={{ fontSize: 12, fontWeight: 500 }}>
                          {q.type === "text" ? "Short answer" : q.type === "radio" ? "Multiple choice" : q.type === "checkbox" ? "Checkboxes" : q.type === "scale" ? "Linear scale" : "Star rating"}
                        </span>
                        <span className="sp" style={{ flex: 1 }} />
                        <label
                          className={`sw sm ${q.required ? "is-on" : ""}`}
                          onClick={() => setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, required: !x.required } : x)))}
                          title="Required"
                        >
                          <span className="sw-lb">Required</span>
                          <span className="sw-t" />
                        </label>
                        <button
                          type="button"
                          className="ib"
                          title="Duplicate question"
                          onClick={() => {
                            const dup: SurveyQuestion = { ...q, id: `q-${Date.now()}` };
                            setQuestions([...questions.slice(0, idx + 1), dup, ...questions.slice(idx + 1)]);
                          }}
                        >
                          <svg className="i i13" aria-hidden="true"><use href="#i-copy"/></svg>
                        </button>
                        <button
                          type="button"
                          className="ib red"
                          title="Delete question"
                          onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))}
                        >
                          <svg className="i i13" aria-hidden="true"><use href="#i-trash"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Question Palette */}
                  <div className="palette">
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: SurveyQuestion = {
                          id: `q-${Date.now()}`,
                          type: "radio",
                          title: "New question",
                          required: false,
                          options: ["Option 1", "Option 2"],
                        };
                        setQuestions([...questions, newQ]);
                      }}
                      className="pal acc"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-plus"/></svg>Add question
                    </button>
                    <span className="pal-div" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setQuestions([...questions, { id: `q-${Date.now()}`, type: "text", title: "New short answer", required: false }])}
                      className="pal"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-type"/></svg>Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestions([...questions, { id: `q-${Date.now()}`, type: "radio", title: "New multiple choice", required: false, options: ["Choice 1", "Choice 2"] }])}
                      className="pal"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-radio"/></svg>Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestions([...questions, { id: `q-${Date.now()}`, type: "checkbox", title: "New checkboxes", required: false, options: ["Option A", "Option B"] }])}
                      className="pal"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-check-sq"/></svg>Checks
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestions([...questions, { id: `q-${Date.now()}`, type: "scale", title: "Rate on scale 1-5", required: false, scaleMin: "Low", scaleMax: "High" }])}
                      className="pal"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-activity"/></svg>Scale
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestions([...questions, { id: `q-${Date.now()}`, type: "star", title: "Star rating", required: false }])}
                      className="pal"
                    >
                      <svg className="i i13" aria-hidden="true"><use href="#i-star"/></svg>Stars
                    </button>
                  </div>

                  {/* Publish Bar */}
                  <div className="pubrow">
                    <span className="pub-st">
                      <label
                        className={`sw ${surveyPublished ? "is-on" : ""}`}
                        onClick={() => {
                          const next = !surveyPublished;
                          setSurveyPublished(next);
                          if (next) handlePublishSurvey();
                        }}
                        title="Publish survey to Events Feed"
                      >
                        <span className="sw-lb">Publish to Events Feed</span>
                        <span className="sw-t" />
                      </label>
                      {surveyPublished ? (
                        <span className="pill pill-live"><i className="dot" aria-hidden="true" />Live on Events Feed</span>
                      ) : (
                        <span className="pill pill-draft"><i className="dot" aria-hidden="true" />Draft</span>
                      )}
                    </span>

                    {surveyPublished && (
                      <span className="share" style={{ display: "flex" }}>
                        <svg className="i i12" aria-hidden="true"><use href="#i-link"/></svg>
                        <input readOnly value="cg.edu/s/hack-the-lake-2026" aria-label="Survey link" />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText("cg.edu/s/hack-the-lake-2026");
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 1200);
                          }}
                          className="swap ghost"
                          style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                        >
                          {copiedLink ? "Copied" : "Copy"}
                        </button>
                      </span>
                    )}

                    <span className="audrow">
                      <button
                        type="button"
                        onClick={() => setSurveyAudience("link")}
                        className={`pchip ${surveyAudience === "link" ? "active" : ""}`}
                      >
                        <svg className="i i11" aria-hidden="true"><use href="#i-globe"/></svg>All Students
                      </button>
                      <button
                        type="button"
                        onClick={() => setSurveyAudience("reg")}
                        className={`pchip ${surveyAudience === "reg" ? "active" : ""}`}
                      >
                        <svg className="i i11" aria-hidden="true"><use href="#i-lock"/></svg>Registrants only
                      </button>
                      <button type="button" onClick={handlePublishSurvey} className="btn-acc" title="Publish & broadcast survey">
                        <svg className="i i13" aria-hidden="true"><use href="#i-send"/></svg>Publish
                      </button>
                    </span>
                  </div>
                </div>
              )}

              {/* ── PREVIEW SUB-TAB ── */}
              {surveySubTab === "prev" && (
                <div className="szone" style={{ padding: "0 0 12px" }}>
                  <div className="pv-sec">
                    <div className="pv-card">
                      <div className="pv-hero">
                        <h3>{surveyTitle} <span className="pv-req">*</span></h3>
                        <p>{surveyDesc}</p>
                      </div>

                      <div className="pq">
                        <h4>What should we call your team? <span className="pv-req">*</span></h4>
                        <p className="pq-hint"><svg className="i i11" aria-hidden="true" style={{ verticalAlign: -1 }}><use href="#i-type"/></svg> Short-answer text</p>
                        <input type="text" placeholder="Your answer" aria-label="Team name" />
                      </div>

                      <div className="pq">
                        <h4>Which track do you want to build in? <span className="pv-req">*</span></h4>
                        <p className="pq-hint"><svg className="i i11" aria-hidden="true" style={{ verticalAlign: -1 }}><use href="#i-radio"/></svg> Pick one</p>
                        {["Campus Genie agents", "Lakehouse analytics", "Open theme"].map((opt, i) => (
                          <label key={i} className="popt">
                            <span className="pr"><i></i></span>
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>

                      <div className="pq">
                        <h4>Any dietary needs? (meals are covered)</h4>
                        <p className="pq-hint"><svg className="i i11" aria-hidden="true" style={{ verticalAlign: -1 }}><use href="#i-check-sq"/></svg> Pick all that apply</p>
                        {["Vegetarian", "Vegan", "Gluten-free"].map((opt, i) => (
                          <label key={i} className="popt">
                            <span className="pr sq"><svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg></span>
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>

                      <div className="pq">
                        <h4>How prepared do you feel for a 48h sprint?</h4>
                        <p className="pq-hint"><svg className="i i11" aria-hidden="true" style={{ verticalAlign: -1 }}><use href="#i-activity"/></svg> Not at all → Fully</p>
                        <div className="scale">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className="scn">{n}</span>
                          ))}
                        </div>
                      </div>

                      <div className="pq">
                        <h4>Rate last year&apos;s Hack the Lake</h4>
                        <p className="pq-hint"><svg className="i i11" aria-hidden="true" style={{ verticalAlign: -1 }}><use href="#i-star"/></svg> Tap a star</p>
                        <div className="stars">
                          {[5, 4, 3, 2, 1].map((s) => (
                            <label key={s}><svg className="i" aria-hidden="true"><use href="#i-star"/></svg></label>
                          ))}
                        </div>
                      </div>

                      <div className="pq-foot">
                        <span className="pq-prog"><span className="pb"><i style={{ width: "80%" }} /></span>4 of 5 answered</span>
                        <button
                          type="button"
                          onClick={() => setSubmittedPreview(true)}
                          className="btn-acc"
                          title="Submit"
                        >
                          {submittedPreview ? (
                            <>
                              <svg className="i i12" aria-hidden="true"><use href="#i-check"/></svg>Responses recorded
                            </>
                          ) : (
                            <>
                              <svg className="i i13" aria-hidden="true"><use href="#i-send"/></svg>Submit
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── RESPONSES SUB-TAB ── */}
              {surveySubTab === "resp" && (
                <div className="szone" style={{ padding: "0 0 12px" }}>
                  <div className="rgrid">
                    {/* Card 1: Metric */}
                    <div className="rc">
                      <div className="metric">
                        <div className="ring" title="Completion rate">
                          <svg viewBox="0 0 46 46" aria-hidden="true">
                            <circle className="rg-bg" cx="23" cy="23" r="19" />
                            <circle className="rg-fg" cx="23" cy="23" r="19" strokeDasharray="81.2 119.4" transform="rotate(-90 23 23)" />
                          </svg>
                          <b>68%</b>
                        </div>
                        <div className="mm"><b>86 responses</b><span>+12 today · completes</span></div>
                        <span className="sp" style={{ flex: 1 }} />
                        <div className="metric">
                          <svg className="i i13" aria-hidden="true" style={{ color: "var(--ink-3)" }}><use href="#i-hour"/></svg>
                          <div className="mm"><b style={{ fontSize: 12.5 }}>2:14</b><span>avg. time</span></div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                        <button type="button" className="btn"><svg className="i i12" aria-hidden="true"><use href="#i-rotate"/></svg>Refresh</button>
                        <button type="button" className="btn"><svg className="i i12" aria-hidden="true"><use href="#i-download"/></svg>Export CSV</button>
                      </div>
                    </div>

                    {/* Card 2: Donut Chart */}
                    <div className="rc">
                      <div className="rc-h"><span className="qt"><svg className="i i12" aria-hidden="true"><use href="#i-up"/></svg></span><h4>Where responses came from</h4></div>
                      <div className="donut-row">
                        <div className="donut" style={{ background: "conic-gradient(var(--accent) 0 38%, var(--hue-hack) 38% 62%, var(--hue-career) 62% 82%, var(--hue-meeting) 82% 100%)" }}>
                          <b>127<span>CLICKS</span></b>
                        </div>
                        <div className="dleg">
                          <span className="dleg-row" style={{ ["--tag" as any]: "var(--accent)" }}><i className="dot" />Genie chat<b>48 · 38%</b></span>
                          <span className="dleg-row" style={{ ["--tag" as any]: "var(--hue-hack)" }}><i className="dot" />QR posters<b>30 · 24%</b></span>
                          <span className="dleg-row" style={{ ["--tag" as any]: "var(--hue-career)" }}><i className="dot" />Newsletter<b>26 · 20%</b></span>
                          <span className="dleg-row" style={{ ["--tag" as any]: "var(--hue-meeting)" }}><i className="dot" />Club sync<b>23 · 18%</b></span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Track breakdown */}
                    <div className="rc">
                      <div className="rc-h"><span className="qt"><svg className="i i12" aria-hidden="true"><use href="#i-radio"/></svg></span><h4>Which track do you want to build in?</h4><span className="n">86</span></div>
                      <div className="rbar-row top">
                        <span className="rbar-l"><svg className="i i12 win-i" aria-hidden="true"><use href="#i-check"/></svg><span>Campus Genie agents</span></span>
                        <span className="rbar-v">41 · 48%</span>
                        <span className="rbar"><i style={{ width: "48%" }} /></span>
                      </div>
                      <div className="rbar-row">
                        <span className="rbar-l"><span>Lakehouse analytics</span></span>
                        <span className="rbar-v">27 · 31%</span>
                        <span className="rbar"><i style={{ width: "31%" }} /></span>
                      </div>
                      <div className="rbar-row">
                        <span className="rbar-l"><span>Open theme</span></span>
                        <span className="rbar-v">18 · 21%</span>
                        <span className="rbar"><i style={{ width: "21%" }} /></span>
                      </div>
                    </div>

                    {/* Card 4: Star Rating stats */}
                    <div className="rc">
                      <div className="rc-h"><span className="qt"><svg className="i i12" aria-hidden="true"><use href="#i-star"/></svg></span><h4>Rate last year&apos;s Hack the Lake</h4><span className="n">avg 4.5/5</span></div>
                      <div className="avg-row">
                        <span className="avg-v">4.5</span>
                        <span className="stars ro" aria-hidden="true">
                          <label className="on"><svg className="i"><use href="#i-star"/></svg></label>
                          <label className="on"><svg className="i"><use href="#i-star"/></svg></label>
                          <label className="on"><svg className="i"><use href="#i-star"/></svg></label>
                          <label className="on"><svg className="i"><use href="#i-star"/></svg></label>
                          <label><svg className="i"><use href="#i-star"/></svg></label>
                        </span>
                        <span className="avg-l">62 responses</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div className="rbar-row"><span className="rbar-l"><span>5 — loved it</span></span><span className="rbar-v">39</span><span className="rbar"><i style={{ width: "87%" }} /></span></div>
                        <div className="rbar-row"><span className="rbar-l"><span>4</span></span><span className="rbar-v">15</span><span className="rbar"><i style={{ width: "34%" }} /></span></div>
                        <div className="rbar-row"><span className="rbar-l"><span>3</span></span><span className="rbar-v">6</span><span className="rbar"><i style={{ width: "13%" }} /></span></div>
                      </div>
                    </div>

                    {/* Card 5: Keywords */}
                    <div className="rc">
                      <div className="rc-h"><span className="qt"><svg className="i i12" aria-hidden="true"><use href="#i-type"/></svg></span><h4>What should we call your team?</h4><span className="n">top terms</span></div>
                      <div className="kw">
                        <span>lakehouse<b>14</b></span>
                        <span>genie<b>11</b></span>
                        <span>delta-duck<b>7</b></span>
                        <span>oklch-owls<b>6</b></span>
                        <span>blue-bars<b>4</b></span>
                      </div>
                    </div>

                    {/* Card 6: Funnel */}
                    <div className="rc">
                      <div className="rc-h"><span className="qt"><svg className="i i12" aria-hidden="true"><use href="#i-activity"/></svg></span><h4>Survey funnel</h4><span className="n">this week</span></div>
                      <div className="fn">
                        <span className="fn-l"><svg className="i i12" aria-hidden="true"><use href="#i-send"/></svg>Invited</span>
                        <span className="fn-b"><i style={{ width: "100%" }} /></span>
                        <span className="fn-v"><b>480</b> · 100%</span>
                      </div>
                      <div className="fn">
                        <span className="fn-l"><svg className="i i12" aria-hidden="true"><use href="#i-eye"/></svg>Opened</span>
                        <span className="fn-b"><i style={{ width: "62%" }} /></span>
                        <span className="fn-v"><b>296</b> · 62%</span>
                      </div>
                      <div className="fn">
                        <span className="fn-l"><svg className="i i12" aria-hidden="true"><use href="#i-check"/></svg>Submitted</span>
                        <span className="fn-b"><i style={{ width: "18%" }} /></span>
                        <span className="fn-v"><b>86</b> · 18%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Panel Footer ── */}
          <footer className="panel-foot">
            <svg className="i i13 g" aria-hidden="true"><use href="#i-db"/></svg>
            <span>Governed via Databricks Unity Catalog · <code>campus_events.delta</code></span>
            <div className="foot-right">
              <span><b>14</b> active</span>
              <span><b>312</b> RSVPs</span>
              <a href="/events" className="plink">
                View student feed <svg className="i i11" aria-hidden="true"><use href="#i-ext"/></svg>
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
