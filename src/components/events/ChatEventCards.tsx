"use client";

import { useState } from "react";
import type { EventRecord } from "@/app/api/events/route";
import EventDetailModal from "./EventDetailModal";
import EventPassModal from "./EventPassModal";
import EventIcons from "./EventIcons";

interface ChatEventCardsProps {
  events: EventRecord[];
  onAskGenie?: (prompt: string) => void;
}

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
      <div className="text-[12px] font-semibold text-ink-2 mb-2 flex items-center gap-1.5">
        <span>Lakehouse Events ({events.length} matched)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {events.map((ev, idx) => {
          const isSaved = !!savedEvents[ev.id];
          const isGoing = !!rsvpEvents[ev.id];
          const isScarce = ev.pill?.tone === "scarce";
          const isFull = ev.pill?.tone === "full";
          const percent = typeof ev.registered === "number" && ev.capacity ? Math.round((ev.registered / ev.capacity) * 100) : 0;

          return (
            <article
              key={ev.id || idx}
              className={`ev ${isScarce ? "is-scarce" : ""} ${isFull ? "is-full" : ""} cursor-pointer transition-transform duration-150 hover:scale-[1.01]`}
              style={{ ["--i" as string]: idx, position: "relative" }}
              onClick={() => setSelectedEvent(ev)}
            >
              <div className="ev-top">
                <span className={`cat cat-${ev.cat}`}>
                  <svg className="i i11" width={11} height={11} aria-hidden="true">
                    <use href={`#${ev.catIcon}`} />
                  </svg>
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
                  <h3 title={ev.title} className="line-clamp-1">{ev.title}</h3>
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
                      <svg className="i i13" width={13} height={13} aria-hidden="true">
                        <use href={ev.isVirtual ? "#i-video" : "#i-pin"} />
                      </svg>
                      <span className="truncate max-w-[120px]">{ev.loc}</span>
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

              <div className="ev-foot" style={{ position: "relative", zIndex: 2 }}>
                <span className="host">
                  <span className="mark">{ev.hostCode}</span>
                  <em className="truncate max-w-[100px]">{ev.host}</em>
                </span>
                <span className="flags">
                  {ev.flags.food && <svg className="i i13" width={13} height={13} aria-label="Free food" role="img"><use href="#i-food"/></svg>}
                  {ev.flags.virtual && <svg className="i i13" width={13} height={13} aria-label="Virtual" role="img"><use href="#i-video"/></svg>}
                </span>
                <button
                  type="button"
                  onClick={(e) => toggleSave(ev.id, e)}
                  className="save"
                  title={isSaved ? "Unsave event" : "Save event"}
                  style={{ color: isSaved ? "var(--accent)" : undefined }}
                >
                  <svg className="i i14" width={14} height={14} style={{ fill: isSaved ? "currentColor" : "none" }} aria-hidden="true">
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
