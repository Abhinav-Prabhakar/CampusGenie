"use client";

import { useState } from "react";
import type { EventRecord } from "@/app/api/events/route";
import EventDetailModal from "./EventDetailModal";
import EventPassModal from "./EventPassModal";
import EventIcons from "./EventIcons";
import "@/app/events.css";

interface ChatEventCardsProps {
  events: EventRecord[];
  onAskGenie?: (prompt: string) => void;
}

const CAT_DEFAULTS: Record<string, { label: string; icon: string }> = {
  meeting: { label: "Meeting", icon: "i-msg" },
  workshop: { label: "Workshop", icon: "i-wrench" },
  social: { label: "Social", icon: "i-music" },
  career: { label: "Career", icon: "i-brief" },
  hackathon: { label: "Hackathon", icon: "i-code" },
  sports: { label: "Sports", icon: "i-ball" },
};

export default function ChatEventCards({ events, onAskGenie }: ChatEventCardsProps) {
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [passEvent, setPassEvent] = useState<EventRecord | null>(null);
  const [savedEvents, setSavedEvents] = useState<Record<string, boolean>>({});
  const [rsvpEvents, setRsvpEvents] = useState<Record<string, boolean>>({});

  if (!events || events.length === 0) return null;

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRsvp = (ev: EventRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setRsvpEvents((prev) => {
      const next = !prev[ev.id];
      if (next) setPassEvent(ev);
      return { ...prev, [ev.id]: next };
    });
  };

  return (
    <div className="events-scope w-full my-3">
      <EventIcons />
      <div className="text-[12px] font-semibold text-ink-2 mb-2.5 flex items-center gap-1.5">
        <svg className="i i12" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <use href="#i-cal" />
        </svg>
        <span>Lakehouse Events ({events.length} matched)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {events.map((ev, idx) => {
          const isSaved = !!savedEvents[ev.id];
          const isGoing = !!rsvpEvents[ev.id];
          const isScarce = ev.pill?.tone === "scarce";
          const isFull = ev.pill?.tone === "full";
          const percent = typeof ev.registered === "number" && ev.capacity ? Math.round((ev.registered / ev.capacity) * 100) : 0;
          const catKey = (ev.cat || "meeting").toLowerCase();
          const catInfo = CAT_DEFAULTS[catKey] || { label: ev.catLabel || "Event", icon: "i-spark" };
          const catIcon = ev.catIcon || catInfo.icon;
          const catLabel = ev.catLabel || catInfo.label;
          const hostCode = ev.hostCode || ev.host?.slice(0, 2).toUpperCase() || "CG";

          return (
            <article
              key={ev.id || idx}
              className={`ev ${isScarce ? "is-scarce" : ""} ${isFull ? "is-full" : ""} cursor-pointer transition-all duration-150 hover:scale-[1.01]`}
              style={{ ["--i" as string]: idx, position: "relative" }}
              onClick={() => setSelectedEvent(ev)}
            >
              <div className="ev-top">
                <span className={`cat cat-${catKey}`}>
                  <svg className="i i11" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <use href={`#${catIcon}`} />
                  </svg>
                  {catLabel}
                </span>
                {ev.pill && (
                  <span className={`pill pill-${ev.pill.tone}`}>
                    {ev.pill.tone === "live" && <i className="dot" aria-hidden="true" />}
                    {ev.pill.tone === "going" && (
                      <svg className="i i11" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href="#i-check"/>
                      </svg>
                    )}
                    {ev.pill.tone === "quiet" && ev.flags?.virtual && (
                      <svg className="i i11" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href="#i-video"/>
                      </svg>
                    )}
                    {ev.pill.text}
                  </span>
                )}
              </div>

              <div className="ev-main">
                <div className="tile">
                  <span className="tile-mon">{ev.month || "APR"}</span>
                  <span className="tile-day">{ev.day || "10"}</span>
                  <span className="tile-dow">{ev.dow || "THU"}</span>
                </div>
                <div className="ev-info">
                  <h3 title={ev.title} className="line-clamp-1">{ev.title}</h3>
                  <div className="meta">
                    <span className="m">
                      <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href="#i-clock"/>
                      </svg>
                      {ev.time || "6:00 PM"}
                    </span>
                    {ev.duration && (
                      <span className="m">
                        <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <use href="#i-hour"/>
                        </svg>
                        {ev.duration}
                      </span>
                    )}
                    <span className="m m-loc">
                      <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href={ev.isVirtual ? "#i-video" : "#i-pin"} />
                      </svg>
                      <span className="truncate max-w-[120px]">{ev.loc || "Campus Hall"}</span>
                    </span>
                  </div>

                  <div className="cap">
                    <span className="cap-n">
                      <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href="#i-users"/>
                      </svg>
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

              <div className="ev-foot" style={{ position: "relative", zIndex: 2 }}>
                <span className="host">
                  <span className="mark">{hostCode}</span>
                  <em className="truncate max-w-[100px]">{ev.host || "Campus"}</em>
                </span>
                <span className="flags">
                  {ev.flags?.food && (
                    <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Free food" role="img">
                      <use href="#i-food"/>
                    </svg>
                  )}
                  {ev.flags?.virtual && (
                    <svg className="i i13" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Virtual" role="img">
                      <use href="#i-video"/>
                    </svg>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => toggleSave(ev.id, e)}
                  className="save"
                  title={isSaved ? "Unsave event" : "Save event"}
                  style={{ color: isSaved ? "var(--accent)" : undefined }}
                >
                  <svg className="i i14" width={14} height={14} fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <use href="#i-bookm" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => toggleRsvp(ev, e)}
                  className={`rsvp ${isFull ? "rsvp-alt" : ""}`}
                  title="RSVP"
                  style={{
                    background: isGoing ? "var(--green-tint)" : undefined,
                    color: isGoing ? "var(--green)" : undefined,
                  }}
                >
                  {isGoing ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="i i11" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <use href="#i-check"/>
                      </svg>
                      Going
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
      </div>

      {/* Click-to-open Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent as any}
          onClose={() => setSelectedEvent(null)}
          onAskGenie={onAskGenie}
        />
      )}

      {/* Event Pass ID Modal */}
      {passEvent && (
        <EventPassModal
          isOpen={!!passEvent}
          onClose={() => setPassEvent(null)}
          event={passEvent as any}
          studentName="Ava Kimura"
          studentId="STU-84213 · 3RD YR CS"
          studentInitials="AK"
        />
      )}
    </div>
  );
}
