import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Bot, CalendarCheck, CalendarDays, Check, ChevronRight, GraduationCap, Home, Library, MapPin, QrCode, RefreshCw, Search, Send, Sparkles, Ticket, Users, X } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

type Tab = "home" | "genie" | "events" | "attendance" | "sources";
type Envelope<T> = { data: T; meta?: { count?: number; refreshedAt?: string; source?: string } };
type EventItem = { id: string; title: string; category: string; host: string; location: string; date: string; time: string; description: string; capacity: number; registered: number; foodProvided: boolean; isVirtual: boolean };
type AttendanceItem = { courseCode: string; title: string; present: number; total: number; percentage: number; minimum: number };
type SourceItem = { id: string; name: string; category: string; description: string; status: string; chunks: number };
type ChatMessage = { role: "user" | "assistant"; content: string; events?: EventItem[] };

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "https://campus-genie-ivory.vercel.app"
).replace(/\/$/, "");
const nav: Array<[Tab, string, typeof Home]> = [["home", "Today", Home], ["genie", "Genie", Sparkles], ["events", "Events", CalendarDays], ["attendance", "Classes", GraduationCap], ["sources", "Sources", Library]];
const features = [
  ["Ask Genie", "Answers grounded in your campus Lakehouse", Sparkles, "genie"],
  ["Campus events", "Find workshops, clubs and meetups", CalendarDays, "events"],
  ["Attendance", "Track every course against its target", GraduationCap, "attendance"],
  ["Knowledge", "Search policies, syllabi and guides", Library, "sources"],
  ["Clubs & labs", "Discover recruiting teams and projects", Users, "genie"],
  ["Campus life", "Dining, inventory, careers and city tech", MapPin, "genie"],
] as const;

async function request<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  const [resource, query = ""] = path.replace(/^\//, "").split("?");
  const suffix = init?.method === "POST" ? "/api/mobile" : `/api/mobile?resource=${encodeURIComponent(resource)}${query ? `&${query}` : ""}`;
  const bases = API_BASE ? [API_BASE, ""] : [""];
  let lastError = "Campus Genie could not reach Databricks.";
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${suffix}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      lastError = payload.error || lastError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

function useData<T>(path: string, active = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(active);
  const load = async () => {
    if (!active) return;
    setLoading(true); setError("");
    try { setData((await request<T>(path)).data); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load"); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [path, active]);
  return { data, error, loading, reload: load };
}

function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="loading"><i/><i/><i/><span>Reading Databricks…</span></div>;
  if (error) return <div className="error-card"><Bot/><div><strong>Genie is unavailable</strong><p>{error}</p></div><button onClick={retry} aria-label="Retry"><RefreshCw/></button></div>;
  return null;
}

function eventPassCode(event: EventItem) {
  const checksum = [...event.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 900 + 100;
  return `${event.id.replace(/[^A-Z0-9]/gi, "").slice(-4).toUpperCase()}-${checksum}`;
}

function EventPass({ event, checkedIn, onClose, onCheckIn }: { event: EventItem; checkedIn: boolean; onClose: () => void; onCheckIn: () => void }) {
  const passCode = eventPassCode(event);
  return <div className="pass-overlay" role="dialog" aria-modal="true" aria-label={`${event.title} event pass`}>
    <button className="pass-scrim" onClick={onClose} aria-label="Close event pass"/>
    <section className="mobile-pass">
      <button className="pass-close" onClick={onClose} aria-label="Close"><X/></button>
      <span className="pass-label"><Ticket/> CAMPUS GENIE EVENT PASS</span>
      <h2>{event.title}</h2>
      <p>{event.date} · {event.time}<br/>{event.location}</p>
      <div className="qr-box"><QrCode/><strong>{passCode}</strong><small>Show this QR at entry</small></div>
      <div className="pass-meta"><span>HOST<b>{event.host}</b></span><span>STATUS<b>{checkedIn ? "Checked in" : "RSVP confirmed"}</b></span></div>
      <button className={`check-in ${checkedIn ? "done" : ""}`} onClick={onCheckIn}>{checkedIn ? <><Check/> Checked in</> : <><CalendarCheck/> Check in at event</>}</button>
    </section>
  </div>;
}

function MatchedEvents({ events }: { events: EventItem[] }) {
  const [rsvps, setRsvps] = useState<Record<string, boolean>>({});
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({});
  const [passEvent, setPassEvent] = useState<EventItem | null>(null);
  if (!events.length) return null;
  const rsvp = (event: EventItem) => {
    setRsvps(current => ({ ...current, [event.id]: true }));
    setPassEvent(event);
  };
  return <section className="matched-events"><strong><CalendarDays/> Lakehouse events ({events.length})</strong>{events.map(event => {
    const isGoing = rsvps[event.id];
    return <article className="chat-event-card" key={event.id}><span>{event.category}</span><h3>{event.title}</h3><p>{event.date} · {event.time}</p><p><MapPin/> {event.location}</p><button onClick={() => isGoing ? setPassEvent(event) : rsvp(event)}>{isGoing ? <><Ticket/> View pass</> : "RSVP"}</button></article>;
  })}{passEvent && <EventPass event={passEvent} checkedIn={Boolean(checkedIn[passEvent.id])} onClose={() => setPassEvent(null)} onCheckIn={() => setCheckedIn(current => ({ ...current, [passEvent.id]: true }))}/>}</section>;
}

function Welcome({ enter }: { enter: () => void }) {
  return <main className="welcome">
    <img className="aura-full" src="/campus-aura.png" alt="" />
    <header><span className="wordmark">Campus Genie</span><span className="mini-badge"><Sparkles/> Databricks powered</span></header>
    <section className="welcome-stack" aria-label="Campus Genie features">
      {features.slice(0, 5).map(([title, , Icon], index) => <div className={`welcome-chip chip-${index}`} key={title}><span><Icon/></span>{title}</div>)}
    </section>
    <div className="welcome-copy"><p>Welcome to your brand new day at your campus.</p><h1>What matters,<br/>always within reach.</h1></div>
    <button className="hero-button" onClick={enter}><span>Meet Campus Genie</span><i><ChevronRight/></i></button>
  </main>;
}

function Header({ title = "Hey, Student" }: { title?: string }) {
  return <header className="topbar"><div className="avatar"><Sparkles/></div><div><h2>{title}</h2><p>Welcome to your brand new day at your campus</p></div><button aria-label="Notifications"><Bell/></button></header>;
}

function HomeScreen({ open }: { open: (tab: Tab, prompt?: string) => void }) {
  const events = useData<EventItem[]>("/events?limit=2");
  return <section className="screen home-screen"><Header/>
    <div className="hero-art"><img src="/campus-aura.png" alt="Abstract Campus Genie flower"/><div className="hero-glass"><span>YOUR CAMPUS, ORGANIZED</span><h1>Everything you need,<br/>before you ask.</h1><button onClick={() => open("genie")}><Sparkles/> Ask Genie</button></div></div>
    <div className="section-title"><div><span>EXPLORE</span><h3>All your campus tools</h3></div></div>
    <div className="feature-grid">{features.map(([title, body, Icon, tab], index) => <button key={title} onClick={() => open(tab, index > 3 ? `Help me with ${title.toLowerCase()} today.` : undefined)}><i className={`tone-${index}`}><Icon/></i><span><strong>{title}</strong><small>{body}</small></span><ChevronRight/></button>)}</div>
    <div className="section-title"><div><span>LIVE FROM DATABRICKS</span><h3>Coming up on campus</h3></div><button onClick={() => open("events")}>See all</button></div>
    <Status loading={events.loading} error={events.error} retry={events.reload}/>
    {events.data?.map(event => <article className="activity-card" key={event.id}><div className="date-block"><strong>{new Date(event.date).getDate() || "•"}</strong><small>{new Date(event.date).toLocaleString("en", { month: "short" })}</small></div><div><span>{event.category}</span><h4>{event.title}</h4><p>{event.time} · {event.location}</p></div></article>)}
  </section>;
}

function GenieScreen({ initialPrompt }: { initialPrompt: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { setText(initialPrompt); }, [initialPrompt]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  const send = async (value = text) => {
    const prompt = value.trim(); if (!prompt || busy) return;
    setText(""); setError(""); setMessages(current => [...current, { role: "user", content: prompt }]); setBusy(true);
    try {
      const response = await request<{ content: string; events?: EventItem[] }>("/chat", { method: "POST", body: JSON.stringify({ prompt }) });
      setMessages(current => [...current, { role: "assistant", content: response.data.content, events: response.data.events || [] }]);
    }
    catch (e) { setError(e instanceof Error ? e.message : "Genie could not answer."); }
    finally { setBusy(false); }
  };
  const prompts = ["What should I do on campus today?", "Which clubs and labs are recruiting?", "Show events that fit my interests"];
  return <section className="screen genie-screen"><Header title="Campus Genie"/><div className="genie-hero"><img src="/campus-aura.png" alt=""/><div className="wave"><i/><i/><i/><i/><i/></div><h1>Ask it now.<br/><strong>Genie handles the rest.</strong></h1><p>Events, attendance, clubs, labs, policies, careers, dining and more—grounded in Databricks.</p></div>
    <div className="conversation">{messages.length === 0 && <div className="prompt-list">{prompts.map(p => <button key={p} onClick={() => void send(p)}>{p}<ChevronRight/></button>)}</div>}{messages.map((m, i) => <div key={i}><div className={`message ${m.role}`}>{m.content}</div>{m.role === "assistant" && <MatchedEvents events={m.events || []}/>}</div>)}{busy && <div className="message assistant typing">Genie is reading your campus data<span>•••</span></div>}{error && <div className="inline-error">{error}</div>}<div ref={end}/></div>
    <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}><Sparkles/><input value={text} onChange={e => setText(e.target.value)} placeholder="Just tell Campus Genie…"/><button disabled={!text.trim() || busy} aria-label="Send"><Send/></button></form>
  </section>;
}

function EventsScreen() {
  const state = useData<EventItem[]>("/events?limit=30"); const [query, setQuery] = useState("");
  const list = useMemo(() => (state.data || []).filter(x => `${x.title} ${x.category} ${x.host} ${x.location}`.toLowerCase().includes(query.toLowerCase())), [state.data, query]);
  return <section className="screen list-screen"><Header title="Campus events"/><div className="search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search live campus events"/></div><Status loading={state.loading} error={state.error} retry={state.reload}/><div className="cards">{list.map(event => <article className="event-card" key={event.id}><span>{event.category}</span><h3>{event.title}</h3><p>{event.description}</p><div><CalendarDays/> {event.date} · {event.time}</div><div><MapPin/> {event.location} · {event.host}</div></article>)}</div></section>;
}

function AttendanceScreen() {
  const state = useData<AttendanceItem[]>("/attendance");
  return <section className="screen list-screen"><Header title="My classes"/><div className="page-intro"><span>ATTENDANCE</span><h1>Stay ahead,<br/>one class at a time.</h1><p>Live course attendance calculated from your Databricks records.</p></div><Status loading={state.loading} error={state.error} retry={state.reload}/><div className="cards">{state.data?.map(item => <article className="attendance-card" key={item.courseCode}><div><span>{item.courseCode}</span><h3>{item.title}</h3></div><strong>{Math.round(item.percentage)}%</strong><div className="progress"><i style={{ width: `${Math.min(item.percentage, 100)}%` }}/></div><p>{item.present} of {item.total} sessions · target {item.minimum}%</p></article>)}</div></section>;
}

function SourcesScreen() {
  const state = useData<SourceItem[]>("/sources");
  return <section className="screen list-screen"><Header title="Knowledge"/><div className="page-intro"><span>UNITY CATALOG</span><h1>Trusted answers<br/>start here.</h1><p>Governed campus policies, syllabi and datasets indexed for Genie.</p></div><Status loading={state.loading} error={state.error} retry={state.reload}/><div className="cards">{state.data?.map(item => <article className="source-card" key={item.id}><i><Library/></i><div><span>{item.category}</span><h3>{item.name}</h3><p>{item.description}</p><small>{item.chunks} chunks · {item.status}</small></div></article>)}</div></section>;
}

export default function App() {
  const shortcutTab = new URLSearchParams(window.location.search).get("tab");
  const initialTab: Tab = nav.some(([id]) => id === shortcutTab) ? shortcutTab as Tab : "home";
  const [welcomed, setWelcomed] = useState(() => initialTab !== "home" || localStorage.getItem("campus-genie-welcomed") === "yes");
  const [tab, setTab] = useState<Tab>(initialTab); const [prompt, setPrompt] = useState("");
  const open = (next: Tab, nextPrompt = "") => { setPrompt(nextPrompt); setTab(next); void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); };
  if (!welcomed) return <Welcome enter={() => { localStorage.setItem("campus-genie-welcomed", "yes"); setWelcomed(true); }}/ >;
  return <div className="app-shell"><main className="viewport">{tab === "home" && <HomeScreen open={open}/>} {tab === "genie" && <GenieScreen initialPrompt={prompt}/>} {tab === "events" && <EventsScreen/>} {tab === "attendance" && <AttendanceScreen/>} {tab === "sources" && <SourcesScreen/>}</main><nav className="bottom-nav">{nav.map(([id, label, Icon]) => <button className={tab === id ? "active" : ""} key={id} onClick={() => open(id)}><Icon/><span>{label}</span></button>)}</nav></div>;
}
