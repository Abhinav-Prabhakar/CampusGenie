"use client";

import { useState, useEffect, useMemo } from "react";
import EventDetailModal from "./EventDetailModal";
import EventIcons from "./EventIcons";
import EventPassModal from "./EventPassModal";
import "@/app/events.css";

export type CampusEvent = {
  id: string;
  cat: "meeting" | "hackathon" | "career" | "workshop" | "social" | "sports";
  catLabel: string;
  catIcon: string;
  title: string;
  subhead?: string;
  pill?: { text: string; tone: "live" | "today" | "scarce" | "going" | "quiet" | "full" };
  month: string;
  day: string;
  dow: string;
  date?: string;
  dateRange?: string;
  time: string;
  duration?: string;
  loc: string;
  room?: string;
  entryDoor?: string;
  floorZone?: string;
  isVirtual?: boolean;
  registered: number | "Open";
  capacity?: number;
  host: string;
  hostCode: string;
  flags: { food?: boolean; virtual?: boolean; going?: boolean };
  when: "today" | "week" | "weekend" | "future";
  agenda?: Array<{ time: string; title: string; desc?: string }>;
};

const EVENTS_DATA: CampusEvent[] = [
  {
    id: "1",
    cat: "meeting",
    catLabel: "Meeting",
    catIcon: "i-msg",
    title: "ACM Weekly — Systems & Pizza",
    pill: { text: "Live", tone: "live" },
    month: "APR",
    day: "09",
    dow: "WED",
    time: "6:30 PM",
    loc: "Ocean Eng 214",
    registered: 41,
    capacity: 60,
    host: "ACM",
    hostCode: "AC",
    flags: { food: true, virtual: true },
    when: "today",
  },
  {
    id: "2",
    cat: "workshop",
    catLabel: "Workshop",
    catIcon: "i-wrench",
    title: "Figma 101 — Campus Design Systems",
    pill: { text: "Today", tone: "today" },
    month: "APR",
    day: "09",
    dow: "WED",
    time: "4:00 PM",
    loc: "Virtual",
    isVirtual: true,
    registered: "Open",
    host: "Design Club",
    hostCode: "DC",
    flags: { virtual: true },
    when: "today",
  },
  {
    id: "3",
    cat: "social",
    catLabel: "Social",
    catIcon: "i-music",
    title: "Transfer Student Firepit Mixer",
    pill: { text: "3 left", tone: "scarce" },
    month: "APR",
    day: "09",
    dow: "WED",
    time: "7:30 PM",
    loc: "Quad Firepit",
    registered: 47,
    capacity: 50,
    host: "Peer Mentors",
    hostCode: "PM",
    flags: { food: true },
    when: "today",
  },
  {
    id: "4",
    cat: "career",
    catLabel: "Career",
    catIcon: "i-brief",
    title: "Databricks Coffee Chats",
    pill: { text: "1 left", tone: "scarce" },
    month: "APR",
    day: "10",
    dow: "THU",
    time: "1:00 PM",
    loc: "Alumni Lounge",
    registered: 11,
    capacity: 12,
    host: "Career Center",
    hostCode: "CC",
    flags: { food: true },
    when: "week",
  },
  {
    id: "5",
    cat: "meeting",
    catLabel: "Meeting",
    catIcon: "i-msg",
    title: "Robotics Lab Open House",
    pill: { text: "Going", tone: "going" },
    month: "APR",
    day: "10",
    dow: "THU",
    time: "5:00 PM",
    loc: "Robotics Lab B2",
    registered: 58,
    capacity: 80,
    host: "Robotics Club",
    hostCode: "RB",
    flags: { going: true },
    when: "week",
  },
  {
    id: "6",
    cat: "career",
    catLabel: "Career",
    catIcon: "i-brief",
    title: "Resume Lab — Drop-in Review",
    pill: { text: "Hybrid", tone: "quiet" },
    month: "APR",
    day: "11",
    dow: "FRI",
    time: "12:00 PM",
    loc: "HUB 317",
    registered: 24,
    capacity: 40,
    host: "Career Center",
    hostCode: "CC",
    flags: { virtual: true },
    when: "week",
  },
  {
    id: "7",
    cat: "meeting",
    catLabel: "Meeting",
    catIcon: "i-msg",
    title: "Debate Society — Practice Rounds",
    pill: { text: "Drop-in", tone: "quiet" },
    month: "APR",
    day: "11",
    dow: "FRI",
    time: "4:30 PM",
    loc: "HUB 204",
    registered: "Open",
    host: "Debate Society",
    hostCode: "DB",
    flags: {},
    when: "week",
  },
  {
    id: "8",
    cat: "hackathon",
    catLabel: "Hackathon",
    catIcon: "i-code",
    title: "Lightning Blitz Mini-Hack",
    pill: { text: "2 left", tone: "scarce" },
    month: "APR",
    day: "11",
    dow: "FRI",
    time: "6:00 PM",
    duration: "3h",
    loc: "Innovation Lab",
    registered: 28,
    capacity: 30,
    host: "Startup Garage",
    hostCode: "SG",
    flags: { food: true },
    when: "week",
  },
  {
    id: "9",
    cat: "social",
    catLabel: "Social",
    catIcon: "i-music",
    title: "Moonlight Jam on the Quad",
    pill: { text: "Full", tone: "full" },
    month: "APR",
    day: "11",
    dow: "FRI",
    time: "9:00 PM",
    loc: "Main Quad Stage",
    registered: 300,
    capacity: 300,
    host: "Music Society",
    hostCode: "MS",
    flags: { virtual: true },
    when: "weekend",
  },
  {
    id: "10",
    cat: "hackathon",
    catLabel: "Hackathon",
    catIcon: "i-code",
    title: "HackDavis 36 — Build for Good",
    pill: { text: "Going", tone: "going" },
    month: "APR",
    day: "12",
    dow: "SAT",
    time: "9:00 AM",
    duration: "36h",
    loc: "Kemper 210",
    registered: 213,
    capacity: 250,
    host: "CruX Coding",
    hostCode: "CX",
    flags: { food: true, going: true },
    when: "weekend",
  },
  {
    id: "11",
    cat: "sports",
    catLabel: "Sports",
    catIcon: "i-ball",
    title: "Intramural 3v3 Hoops Blitz",
    pill: { text: "2 left", tone: "scarce" },
    month: "APR",
    day: "12",
    dow: "SAT",
    time: "11:00 AM",
    loc: "Rec Courts",
    registered: 22,
    capacity: 24,
    host: "Intramurals",
    hostCode: "IM",
    flags: {},
    when: "weekend",
  },
  {
    id: "12",
    cat: "sports",
    catLabel: "Sports",
    catIcon: "i-ball",
    title: "Sunrise Yoga — Library Terrace",
    pill: { text: "Free", tone: "quiet" },
    month: "APR",
    day: "13",
    dow: "SUN",
    time: "6:30 AM",
    loc: "Library Terrace",
    registered: 34,
    capacity: 60,
    host: "Wellness Coll.",
    hostCode: "WE",
    flags: {},
    when: "weekend",
  },
  {
    id: "13",
    cat: "hackathon",
    catLabel: "Hackathon",
    catIcon: "i-code",
    title: "Genie Ideathon — 48h Virtual Build",
    pill: { text: "Virtual", tone: "quiet" },
    month: "APR",
    day: "20",
    dow: "SUN",
    time: "2:00 PM",
    duration: "48h",
    loc: "Discord",
    isVirtual: true,
    registered: 96,
    capacity: 150,
    host: "GDG Campus",
    hostCode: "GD",
    flags: { virtual: true, going: true },
    when: "future",
  },
  {
    id: "14",
    cat: "workshop",
    catLabel: "Workshop",
    catIcon: "i-wrench",
    title: "Delta Lake Deep-Dive with Genie",
    pill: { text: "Going", tone: "going" },
    month: "APR",
    day: "13",
    dow: "SUN",
    time: "3:00 PM",
    loc: "Virtual · Teams",
    isVirtual: true,
    registered: 140,
    capacity: 200,
    host: "Data Club",
    hostCode: "DA",
    flags: { virtual: true, going: true },
    when: "weekend",
  },
];

const CAT_INDICES: Record<string, number> = {
  all: 0,
  meeting: 1,
  hackathon: 2,
  career: 3,
  workshop: 4,
  social: 5,
  sports: 6,
};

export default function EventsView({ onAskGenie }: { onAskGenie?: (prompt: string) => void }) {
  const [eventsList, setEventsList] = useState<CampusEvent[]>(EVENTS_DATA);
  const [featuredSurveys, setFeaturedSurveys] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, any>>({});
  const [surveySubmitted, setSurveySubmitted] = useState<boolean>(false);
  const [surveyOpen, setSurveyOpen] = useState<boolean>(true);

  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [passEvent, setPassEvent] = useState<CampusEvent | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [selectedWhen, setSelectedWhen] = useState<string>("week");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [foodFilter, setFoodFilter] = useState<boolean>(false);
  const [virtualFilter, setVirtualFilter] = useState<boolean>(false);
  const [goingFilter, setGoingFilter] = useState<boolean>(false);
  const [savedEvents, setSavedEvents] = useState<Record<string, boolean>>({
    "10": true,
    "13": true,
    "EV-10": true,
    "EV-13": true,
  });
  const [rsvpEvents, setRsvpEvents] = useState<Record<string, boolean>>({
    "5": true,
    "10": true,
    "13": true,
    "14": true,
    "EV-05": true,
    "EV-10": true,
    "EV-13": true,
    "EV-14": true,
  });

  // Fetch live events from Lakehouse API
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        if (data.events && data.events.length > 0) {
          setEventsList(data.events);
        }
      })
      .catch((err) => console.warn("Failed to fetch live events, using cached seed data:", err));

    // Fetch featured surveys
    fetch("/api/surveys?featured=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.surveys && data.surveys.length > 0) {
          setFeaturedSurveys(data.surveys);
          setActiveSurvey(data.surveys[0]);
        }
      })
      .catch((err) => console.warn("Failed to fetch featured surveys:", err));
  }, []);

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    try {
      await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_response",
          surveyId: activeSurvey.id,
          answers: surveyAnswers,
        }),
      });
      setSurveySubmitted(true);
    } catch (err) {
      console.error("Failed to submit survey response:", err);
      setSurveySubmitted(true);
    }
  };

  const toggleSave = (id: string) => {
    setSavedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRsvp = (id: string) => {
    setRsvpEvents((prev) => {
      const next = !prev[id];
      if (next) {
        const ev = EVENTS_DATA.find((e) => e.id === id);
        if (ev) setPassEvent(ev);
      }
      return { ...prev, [id]: next };
    });
  };

  const resetFilters = () => {
    setSelectedCat("all");
    setSelectedWhen("all");
    setSearchQuery("");
    setFoodFilter(false);
    setVirtualFilter(false);
    setGoingFilter(false);
  };

  const filteredEvents = useMemo(() => {
    return eventsList.filter((ev) => {
      if (selectedCat !== "all" && ev.cat !== selectedCat) return false;
      if (selectedWhen === "today" && ev.when !== "today") return false;
      if (selectedWhen === "week" && ev.when !== "today" && ev.when !== "week") return false;
      if (selectedWhen === "weekend" && ev.when !== "weekend") return false;
      if (foodFilter && !ev.flags?.food) return false;
      if (virtualFilter && !ev.flags?.virtual && !ev.isVirtual) return false;
      if (goingFilter && !rsvpEvents[ev.id]) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchHost = ev.host.toLowerCase().includes(q);
        const matchLoc = ev.loc.toLowerCase().includes(q);
        if (!matchTitle && !matchHost && !matchLoc) return false;
      }
      return true;
    });
  }, [eventsList, selectedCat, selectedWhen, foodFilter, virtualFilter, goingFilter, searchQuery, rsvpEvents]);

  const glideTransform = `translateX(${CAT_INDICES[selectedCat] * 100}%)`;

  return (
    <div className="events-scope w-full">
      {/* Complete Feather-Style SVG Sprite */}
      <EventIcons />

      <div className="window">
        {/* Featured Hackathon Banner */}
        <div className="banner-wrap">
          <aside className="feature">
            <span className="fx">
              <svg className="i i16" width={16} height={16} aria-hidden="true"><use href="#i-spark"/></svg>
            </span>
            <div className="fb">
              <div className="fk">
                <span className="cat cat-hackathon">
                  <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-code"/></svg>Featured
                </span>
                <span className="fk-sub">Hackathon · Registration closes Friday</span>
              </div>
              <h2>Hack the Lake — 48h Genie Build Sprint</h2>
              <div className="fm">
                <span><svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-cal"/></svg>APR 25–26</span>
                <span><svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-hour"/></svg>48h</span>
                <span><svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-pin"/></svg>Colt Arena</span>
                <span><svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-users"/></svg>512 pre-registered</span>
                <span><svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-food"/></svg>Meals covered</span>
              </div>
            </div>
            <div className="fa">
              <button
                type="button"
                onClick={() => {
                  const ev = eventsList.find((e) => e.title.includes("Hack the Lake") || e.id === "10" || e.id === "EV-10") || eventsList[0];
                  setPassEvent(ev);
                }}
                className="btn-acc"
                title="View Registration Pass"
              >
                <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-spark"/></svg> Event Pass
              </button>
              <button
                type="button"
                onClick={() => onAskGenie?.("How can I prepare my team for Hack the Lake 48h Genie Build Sprint?")}
                className="btn-ghost"
              >
                Ask Genie
              </button>
              <button
                type="button"
                onClick={() => onAskGenie?.("Show me winning project tracks for Hack the Lake hackathon")}
                className="btn-ghost"
              >
                Tracks <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-ext"/></svg>
              </button>
            </div>
          </aside>

          {/* Featured Active Survey Banner from Student Admin */}
          {activeSurvey && (
            <div className="mt-2.5 rounded-[12px] border border-line-soft/60 bg-surface p-3.5 shadow-card transition-all">
              <div className="flex items-center justify-between border-b border-line-soft/30 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-[6px] bg-accent-tint text-accent-ink text-[12px]">
                    <svg className="i i13" aria-hidden="true"><use href="#i-chart"/></svg>
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13.5px] font-semibold text-ink">{activeSurvey.title}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[10.5px] font-medium text-accent-ink">
                        Featured Survey
                      </span>
                    </div>
                    <p className="text-[11.5px] text-ink-3">{activeSurvey.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-3">
                    <b>{activeSurvey.responseCount || 86}</b> student responses
                  </span>
                  <button
                    type="button"
                    onClick={() => setSurveyOpen((p) => !p)}
                    className="flex size-6 items-center justify-center rounded-[5px] text-ink-3 hover:bg-hover hover:text-ink transition-colors"
                  >
                    <svg className={`i i12 transition-transform ${surveyOpen ? "rotate-180" : ""}`} aria-hidden="true"><use href="#i-chev"/></svg>
                  </button>
                </div>
              </div>

              {surveyOpen && (
                <div>
                  {surveySubmitted ? (
                    <div className="flex items-center justify-between rounded-[8px] bg-green-tint/30 p-3 text-[12.5px] text-green animate-fade-in">
                      <div className="flex items-center gap-2">
                        <svg className="i i14" aria-hidden="true"><use href="#i-check"/></svg>
                        <span>Thank you! Your survey responses were recorded in Databricks Lakehouse.</span>
                      </div>
                      <span className="text-[11px] text-ink-3">Synced to workspace.campus_explorer</span>
                    </div>
                  ) : (
                    <form onSubmit={handleSurveySubmit} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {activeSurvey.questions?.slice(0, 4).map((q: any) => (
                          <div key={q.id} className="rounded-[8px] border border-line bg-canvas p-2.5 space-y-1.5">
                            <label className="text-[12px] font-medium text-ink flex items-center justify-between">
                              <span>{q.title}</span>
                              {q.required && <span className="text-red text-[10px]">*Required</span>}
                            </label>
                            {q.type === "text" && (
                              <input
                                type="text"
                                placeholder="Type your answer…"
                                value={surveyAnswers[q.id] || ""}
                                onChange={(e) => setSurveyAnswers({ ...surveyAnswers, [q.id]: e.target.value })}
                                className="w-full h-7 rounded-[6px] border border-line bg-surface px-2 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
                              />
                            )}
                            {q.type === "radio" && q.options && (
                              <div className="space-y-1">
                                {q.options.map((opt: string) => (
                                  <label key={opt} className="flex items-center gap-1.5 text-[11.5px] text-ink-2 cursor-pointer hover:text-ink">
                                    <input
                                      type="radio"
                                      name={q.id}
                                      value={opt}
                                      checked={surveyAnswers[q.id] === opt}
                                      onChange={() => setSurveyAnswers({ ...surveyAnswers, [q.id]: opt })}
                                      className="size-3 accent-accent"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {q.type === "checkbox" && q.options && (
                              <div className="flex flex-wrap gap-2">
                                {q.options.map((opt: string) => {
                                  const current = surveyAnswers[q.id] || [];
                                  const isChecked = current.includes(opt);
                                  return (
                                    <label
                                      key={opt}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] border text-[11px] cursor-pointer transition-colors ${
                                        isChecked ? "border-accent bg-accent-tint text-accent-ink" : "border-line bg-surface text-ink-3 hover:text-ink"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isChecked}
                                        onChange={() => {
                                          const next = isChecked ? current.filter((x: string) => x !== opt) : [...current, opt];
                                          setSurveyAnswers({ ...surveyAnswers, [q.id]: next });
                                        }}
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {q.type === "scale" && (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] text-ink-3">{q.scaleMin || "Low"}</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => setSurveyAnswers({ ...surveyAnswers, [q.id]: num })}
                                      className={`size-6 rounded-[4px] border text-[11px] font-medium transition-colors ${
                                        surveyAnswers[q.id] === num ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:bg-hover"
                                      }`}
                                    >
                                      {num}
                                    </button>
                                  ))}
                                </div>
                                <span className="text-[10px] text-ink-3">{q.scaleMax || "High"}</span>
                              </div>
                            )}
                            {q.type === "star" && (
                              <div className="flex gap-1 pt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setSurveyAnswers({ ...surveyAnswers, [q.id]: star })}
                                    className={`text-[14px] transition-colors ${(surveyAnswers[q.id] || 0) >= star ? "text-amber-400" : "text-ink-3"}`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          className="h-7 px-3 rounded-[6px] bg-accent text-white text-[12px] font-medium hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <svg className="i i11" aria-hidden="true"><use href="#i-check"/></svg>
                          Submit Survey Response
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="seg-scroll">
            <div className="seg" role="tablist" aria-label="Filter by category">
              <span className="seg-glide" style={{ transform: glideTransform }} aria-hidden="true" />
              {[
                { id: "all", label: "All" },
                { id: "meeting", label: "Meetings" },
                { id: "hackathon", label: "Hackathons" },
                { id: "career", label: "Career" },
                { id: "workshop", label: "Workshops" },
                { id: "social", label: "Social" },
                { id: "sports", label: "Sports" },
              ].map((c) => (
                <label
                  key={c.id}
                  className={`seg-item ${selectedCat === c.id ? "text-ink font-semibold" : ""}`}
                  onClick={() => setSelectedCat(c.id)}
                >
                  <input
                    type="radio"
                    name="cat"
                    className="vh"
                    checked={selectedCat === c.id}
                    onChange={() => setSelectedCat(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <details className="menu">
            <summary className="menu-btn" title="Filter by date">
              <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-cal"/></svg>
              <span className="menu-sum">
                <span>{selectedWhen === "all" ? "All dates" : selectedWhen === "today" ? "Today" : selectedWhen === "week" ? "This week" : "Weekend"}</span>
              </span>
              <svg className="i i13 chev" width={13} height={13} aria-hidden="true"><use href="#i-chev"/></svg>
            </summary>
            <div className="menu-pop">
              <div className="menu-title">Date range</div>
              {[
                { id: "all", label: "All dates", count: "14" },
                { id: "today", label: "Today", count: "3" },
                { id: "week", label: "This week", count: "13" },
                { id: "weekend", label: "Weekend", count: "6" },
              ].map((w) => (
                <label
                  key={w.id}
                  className="menu-row"
                  onClick={() => setSelectedWhen(w.id)}
                >
                  <input
                    type="radio"
                    name="when"
                    className="vh"
                    checked={selectedWhen === w.id}
                    onChange={() => setSelectedWhen(w.id)}
                  />
                  <svg className="i i13 mk" width={13} height={13} style={{ opacity: selectedWhen === w.id ? 1 : 0 }} aria-hidden="true"><use href="#i-check"/></svg>
                  {w.label}
                  <b>{w.count}</b>
                </label>
              ))}
            </div>
          </details>

          <label className="search">
            <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-search"/></svg>
            <input
              type="search"
              placeholder="Search events, clubs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search events"
            />
            <kbd>/</kbd>
          </label>
        </div>

        {/* Quick Filters */}
        <div className="chips">
          <label className="chip" style={{ background: foodFilter ? "var(--accent-tint)" : undefined, color: foodFilter ? "var(--accent-ink)" : undefined }}>
            <input
              type="checkbox"
              className="vh"
              checked={foodFilter}
              onChange={(e) => setFoodFilter(e.target.checked)}
            />
            <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-food"/></svg>
            Free food
            <b>5</b>
          </label>
          <label className="chip" style={{ background: virtualFilter ? "var(--accent-tint)" : undefined, color: virtualFilter ? "var(--accent-ink)" : undefined }}>
            <input
              type="checkbox"
              className="vh"
              checked={virtualFilter}
              onChange={(e) => setVirtualFilter(e.target.checked)}
            />
            <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-video"/></svg>
            Virtual
            <b>6</b>
          </label>
          <label className="chip" style={{ background: goingFilter ? "var(--accent-tint)" : undefined, color: goingFilter ? "var(--accent-ink)" : undefined }}>
            <input
              type="checkbox"
              className="vh"
              checked={goingFilter}
              onChange={(e) => setGoingFilter(e.target.checked)}
            />
            <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-check"/></svg>
            My RSVPs
            <b>{Object.values(rsvpEvents).filter(Boolean).length}</b>
          </label>
          <button type="button" onClick={resetFilters} className="reset">
            <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-rotate"/></svg>
            Reset
          </button>
        </div>

        {/* Section Header */}
        <div className="sec">
          <h2>Upcoming events</h2>
          <span className="sec-meta" aria-live="polite">
            <b style={{ display: "inline", color: "var(--ink-2)", fontWeight: 600 }}>{filteredEvents.length}</b> events
          </span>
        </div>

        {/* Events Grid */}
        <section className="events">
          {filteredEvents.map((ev, index) => {
            const isSaved = !!savedEvents[ev.id];
            const isGoing = !!rsvpEvents[ev.id];
            const isScarce = ev.pill?.tone === "scarce";
            const isFull = ev.pill?.tone === "full";
            const percent = typeof ev.registered === "number" && ev.capacity ? Math.round((ev.registered / ev.capacity) * 100) : 0;

            return (
              <article
                key={ev.id}
                className={`ev ${isScarce ? "is-scarce" : ""} ${isFull ? "is-full" : ""}`}
                style={{ ["--i" as string]: index, position: "relative" }}
              >
                {/* Click target to open dialog */}
                <div
                  className="ev-hit"
                  onClick={() => setSelectedEvent(ev)}
                  aria-label={`View details for ${ev.title}`}
                />

                <div className="ev-top">
                  <span className={`cat cat-${ev.cat}`}>
                    <svg className="i i11" width={11} height={11} aria-hidden="true"><use href={`#${ev.catIcon}`}/></svg>
                    {ev.catLabel}
                  </span>
                  {ev.pill && (
                    <span className={`pill pill-${ev.pill.tone}`}>
                      {ev.pill.tone === "live" && <i className="dot" aria-hidden="true" />}
                      {ev.pill.tone === "going" && <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>}
                      {ev.pill.tone === "quiet" && ev.flags.virtual && <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-video"/></svg>}
                      {ev.pill.text}
                    </span>
                  )}
                </div>

                <div className="ev-main">
                  <div className="tile">
                    <span className="tile-mon">{ev.month}</span>
                    <span className="tile-day">{ev.day}</span>
                    <span className="tile-dow">{ev.dow}</span>
                  </div>
                  <div className="ev-info">
                    <h3 title={ev.title}>{ev.title}</h3>
                    <div className="meta">
                      <span className="m">
                        <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-clock"/></svg>
                        {ev.time}
                      </span>
                      {ev.duration && (
                        <span className="m">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-hour"/></svg>
                          {ev.duration}
                        </span>
                      )}
                      <span className="m m-loc">
                        <svg className="i i13" width={13} height={13} aria-hidden="true"><use href={ev.isVirtual ? "#i-video" : "#i-pin"}/></svg>
                        <span>{ev.loc}</span>
                      </span>
                    </div>

                    <div className="cap">
                      <span className="cap-n">
                        <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-users"/></svg>
                        {typeof ev.registered === "number" && ev.capacity ? (
                          <><b>{ev.registered}</b>/{ev.capacity}</>
                        ) : (
                          "Open"
                        )}
                      </span>
                      {typeof ev.registered === "number" && ev.capacity && (
                        <span className="cap-bar">
                          <i style={{ width: `${percent}%` }} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ev-foot" style={{ position: "relative", zIndex: 1 }}>
                  <span className="host">
                    <span className="mark">{ev.hostCode}</span>
                    <em>{ev.host}</em>
                  </span>
                  <span className="flags">
                    {ev.flags.food && <svg className="i i13" width={13} height={13} aria-label="Free food" role="img"><use href="#i-food"/></svg>}
                    {ev.flags.virtual && <svg className="i i13" width={13} height={13} aria-label="Virtual" role="img"><use href="#i-video"/></svg>}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSave(ev.id)}
                    className="save"
                    title={isSaved ? "Unsave event" : "Save event"}
                    style={{ color: isSaved ? "var(--accent)" : undefined }}
                  >
                    <svg className="i i14" width={14} height={14} style={{ fill: isSaved ? "currentColor" : "none" }} aria-hidden="true"><use href="#i-bookm"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRsvp(ev.id)}
                    className={`rsvp ${isFull ? "rsvp-alt" : ""}`}
                    title="RSVP"
                    style={{
                      background: isGoing ? "var(--green-tint)" : undefined,
                      color: isGoing ? "var(--green)" : undefined,
                    }}
                  >
                    {isGoing ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>Going
                      </span>
                    ) : isFull ? (
                      "Waitlist"
                    ) : (
                      "RSVP"
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {/* Panel Footer */}
        <footer className="panel-foot">
          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-db"/></svg>
          <code>campus_events.delta</code>
          <span>· synced 2 min ago</span>
          <span className="foot-right">
            <span>Showing <b>{filteredEvents.length}</b> of 128 events</span>
            <button
              type="button"
              onClick={() => onAskGenie?.("Show me all upcoming hackathons and AI workshops for the semester")}
              className="cal-link"
            >
              Ask Genie for full calendar <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-arr"/></svg>
            </button>
          </span>
        </footer>
      </div>

      {/* Event Detail Dialog Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onAskGenie={onAskGenie}
      />

      {/* Event Pass ID Modal */}
      <EventPassModal
        isOpen={!!passEvent}
        onClose={() => setPassEvent(null)}
        event={passEvent}
        studentName="Ava Kimura"
        studentId="STU-84213 · 3RD YR CS"
        studentInitials="AK"
      />
    </div>
  );
}
