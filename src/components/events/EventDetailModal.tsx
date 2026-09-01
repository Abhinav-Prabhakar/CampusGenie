"use client";

import { useState, useEffect } from "react";
import type { CampusEvent } from "./EventsView";
import EventIcons from "./EventIcons";
import EventPassModal from "./EventPassModal";
import "@/app/events.css";

type EventDetailModalProps = {
  event: CampusEvent | null;
  onClose: () => void;
  onAskGenie?: (prompt: string) => void;
};

export default function EventDetailModal({ event, onClose, onAskGenie }: EventDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "agenda" | "extra">("overview");
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isRsvpd, setIsRsvpd] = useState<boolean>(false);
  const [passModalOpen, setPassModalOpen] = useState<boolean>(false);
  const [isCalAdded, setIsCalAdded] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!event) return;
    setActiveTab("overview");
    setSelectedSlot(null);
    setShareOpen(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [event, onClose]);

  if (!event) return null;

  const isCareer = event.cat === "career";
  const isHackathon = event.cat === "hackathon";
  const extraTabLabel = isHackathon ? "Prizes" : isCareer ? "Time slots" : "Guests";
  const extraTabIcon = isHackathon ? "i-trophy" : isCareer ? "i-clock" : "i-users";

  const percent = typeof event.registered === "number" && event.capacity
    ? Math.round((event.registered / event.capacity) * 100)
    : 75;
  const strokeDash = Math.round((percent / 100) * 164);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGoogleCalendar = () => {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`Campus event hosted by ${event.host} on Databricks Lakehouse.`);
    const location = encodeURIComponent(event.loc);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`, "_blank");
  };

  return (
    <div className="overlay events-scope" role="presentation" style={{ display: "grid" }}>
      {/* SVG Sprite Definition */}
      <EventIcons />

      {/* Scrim backdrop */}
      <div className="scrim" onClick={onClose} aria-label="Close dialog" />

      {/* Main Dialog Shell */}
      <section
        className={`dialog cat-${event.cat}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`h-${event.id}`}
        style={{ display: "flex" }}
      >
        {/* Hero Header */}
        <header className="dhero">
          <svg className="wm" width={132} height={132} aria-hidden="true">
            <use href={`#${event.catIcon}`} />
          </svg>
          <div className="row1">
            <span className={`cat cat-${event.cat}`}>
              <svg className="i i11" width={11} height={11} aria-hidden="true">
                <use href={`#${event.catIcon}`} />
              </svg>
              {event.catLabel}
            </span>
            {event.pill && (
              <span className={`pill pill-${event.pill.tone}`}>
                {event.pill.tone === "live" && <i className="dot" aria-hidden="true" />}
                {event.pill.tone === "going" && <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>}
                {event.pill.tone === "quiet" && event.flags.virtual && <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-video"/></svg>}
                {event.pill.text}
              </span>
            )}
          </div>
          <h2 id={`h-${event.id}`}>{event.title}</h2>
          <div className="dmeta">
            <span className="m host">
              <span className="mark">{event.hostCode}</span>
              <em>{event.host}</em>
            </span>
            <span className="m">
              <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-clock"/></svg>
              {event.time}
            </span>
            <span className="m">
              <svg className="i i13" width={13} height={13} aria-hidden="true">
                <use href={event.isVirtual ? "#i-video" : "#i-pin"} />
              </svg>
              {event.loc}
            </span>
            <span className="m">
              <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-users"/></svg>
              {typeof event.registered === "number" ? `${event.registered} going` : "Open entry"}
            </span>
            {event.flags.virtual && (
              <span className="m">
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-video"/></svg>
                Hybrid
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="xbtn" title="Close" aria-label="Close">
            <svg className="i i14" width={14} height={14} aria-hidden="true"><use href="#i-x"/></svg>
          </button>
        </header>

        {/* Scrollable Region & Two Columns */}
        <div className="dscroll">
          <div className="dcols">
            {/* Left Column */}
            <div className="dmain">
              {/* Tab Bar */}
              <div className="tabs">
                <label
                  onClick={() => setActiveTab("overview")}
                  className={activeTab === "overview" ? "text-ink font-semibold" : ""}
                >
                  <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-info"/></svg>
                  Overview
                </label>
                <label
                  onClick={() => setActiveTab("agenda")}
                  className={activeTab === "agenda" ? "text-ink font-semibold" : ""}
                >
                  <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-clock"/></svg>
                  {isHackathon ? "Schedule" : "Agenda"}
                </label>
                <label
                  onClick={() => setActiveTab("extra")}
                  className={activeTab === "extra" ? "text-ink font-semibold" : ""}
                >
                  <svg className="i i13" width={13} height={13} aria-hidden="true"><use href={`#${extraTabIcon}`}/></svg>
                  {extraTabLabel}
                </label>
                <span
                  className="tglide"
                  style={{
                    transform: `translateX(${activeTab === "overview" ? "0%" : activeTab === "agenda" ? "100%" : "200%"})`,
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* OVERVIEW PANE */}
              {activeTab === "overview" && (
                <div className="pane" style={{ display: "block" }}>
                  {isHackathon && (
                    <div className="block">
                      <div className="tiles">
                        <div className="tile">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-gift"/></svg>
                          <b>$5,000</b>
                          <span>prize pool</span>
                        </div>
                        <div className="tile">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-hour"/></svg>
                          <b>36h</b>
                          <span>build time</span>
                        </div>
                        <div className="tile">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-users"/></svg>
                          <b>250</b>
                          <span>hackers</span>
                        </div>
                        <div className="tile">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-mic"/></svg>
                          <b>12</b>
                          <span>mentors</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="block">
                    <p>
                      {isHackathon
                        ? "A 36-hour build-for-good sprint. Ship with Genie agents, Delta Lake, or anything open source that helps a campus cause. Databricks field engineers mentor on the floor all night."
                        : isCareer
                        ? "Fifteen-minute 1:1s with Databricks alumni engineers. Bring a resume — they'll bring honest feedback and far too much coffee."
                        : "Weekly build night for systems nerds. This week: a kernel-bypass networking demo, two lightning talks, and open hack time on the club cluster. Beginners welcome — mentors float all evening."}
                    </p>
                  </div>

                  <div className="block">
                    <h3 className="ph">{isHackathon ? "Tracks" : "Topics"}</h3>
                    <div className="tchips">
                      <span className="tchip"><svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-code"/></svg>Systems</span>
                      <span className="tchip"><svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-nav"/></svg>Networking</span>
                      <span className="tchip"><svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-mic"/></svg>Lightning talks</span>
                      <span className="tchip"><svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>Beginners OK</span>
                    </div>
                  </div>

                  {/* Mini Map Location Card */}
                  <div className="block">
                    <h3 className="ph">Location</h3>
                    <div className="locard">
                      <div className="map" aria-hidden="true">
                        <i className="road h" />
                        <i className="road v" />
                        <i className="blk" style={{ left: "8%", top: "10%", width: "26%", height: "22%" }} />
                        <i className="blk" style={{ right: "9%", top: "14%", width: "22%", height: "16%" }} />
                        <i className="blk" style={{ left: "40%", bottom: "8%", width: "18%", height: "24%" }} />
                        <i className="pin" />
                        <span className="mtag">{event.loc.toUpperCase()}</span>
                      </div>
                      <div className="linfo">
                        <h4>{event.loc}</h4>
                        <p className="lsub">Campus Center · 4 min walk from Kemper Hall</p>
                        <div className="lacts">
                          <button
                            type="button"
                            onClick={() => onAskGenie?.(`Give me directions to ${event.loc} from the main library`)}
                            className="dirlink"
                          >
                            <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-nav"/></svg>
                            Directions
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="cbtn"
                            title="Copy address"
                          >
                            <svg className="i i12" width={12} height={12} aria-hidden="true">
                              <use href={copiedLink ? "#i-check" : "#i-copy"} />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Good to Know */}
                  <div className="block">
                    <h3 className="ph">{isHackathon || isCareer ? "Bring" : "Good to know"}</h3>
                    <ul className={isHackathon || isCareer ? "bring" : "know"}>
                      <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-bell"/></svg>Doors 15 min early — badge scan at the kiosk</li>
                      <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-food"/></svg>Pizza + refreshments provided, veg and halal options</li>
                      <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-video"/></svg>Streamed on Teams for remote members</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* AGENDA / SCHEDULE PANE */}
              {activeTab === "agenda" && (
                <div className="pane" style={{ display: "block" }}>
                  <div className="tl">
                    {isHackathon ? (
                      <>
                        <span className="tl-head">SAT · APR 12</span>
                        <div className="tl-row">
                          <span className="tl-time">09:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Check-in &amp; team matching</b><span>Lobby · find teammates on the board</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-users"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">10:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Kickoff + API demos</b><span>Sponsor APIs · Genie agent starter kits</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-mic"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">13:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Lunch</b><span>Tacos · veg + halal</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-food"/></svg>
                        </div>
                        <span className="tl-head">SUN · APR 13</span>
                        <div className="tl-row">
                          <span className="tl-time">12:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Submissions freeze</b><span>DevPost locks · no exceptions</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-flag"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">16:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Awards ceremony</b><span>Main stage · swag pickup</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-trophy"/></svg>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="tl-row past">
                          <span className="tl-time">18:15</span><i className="tl-dot" />
                          <div className="tl-body"><b>Doors open</b><span>Badge scan · grab a seat</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-bell"/></svg>
                        </div>
                        <div className="tl-row now">
                          <span className="tl-time">18:30</span><i className="tl-dot" />
                          <div className="tl-body"><b>Live demo &amp; overview</b><span>In-room presentation</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-mic"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">19:10</span><i className="tl-dot" />
                          <div className="tl-body"><b>Lightning talks ×2</b><span>10 min each, Q&amp;A after</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-mic"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">20:00</span><i className="tl-dot" />
                          <div className="tl-body"><b>Refreshment break</b><span>Veg + halal options</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-food"/></svg>
                        </div>
                        <div className="tl-row">
                          <span className="tl-time">20:45</span><i className="tl-dot" />
                          <div className="tl-body"><b>Open hack &amp; networking</b><span>Cluster access &amp; mentor help</span></div>
                          <svg className="i i13 tail" width={13} height={13} aria-hidden="true"><use href="#i-laptop"/></svg>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* EXTRA PANE (GUESTS / PRIZES / TIME SLOTS) */}
              {activeTab === "extra" && (
                <div className="pane" style={{ display: "block" }}>
                  {isHackathon ? (
                    <div>
                      <div className="block">
                        <h3 className="ph">Prize breakdown</h3>
                        <div className="pr-row">
                          <span className="pr-ic"><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-trophy"/></svg></span>
                          <div><b>1st place</b><span>Best overall impact</span></div>
                          <span className="amt">$2,500</span>
                        </div>
                        <div className="pr-row">
                          <span className="pr-ic silver"><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-trophy"/></svg></span>
                          <div><b>2nd place</b><span>Judges' pick</span></div>
                          <span className="amt">$1,200</span>
                        </div>
                        <div className="pr-row">
                          <span className="pr-ic silver"><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-code"/></svg></span>
                          <div><b>Track wins ×3</b><span>Agents · Data · Accessibility</span></div>
                          <span className="amt">$400</span>
                        </div>
                      </div>
                      <div className="block">
                        <h3 className="ph">Judges</h3>
                        <div className="g-grid">
                          <div className="g-tile"><span className="mark">DB</span><div><b>Dana Wu</b><span>Field Eng · Databricks</span></div></div>
                          <div className="g-tile"><span className="mark">ML</span><div><b>Marcus Lee</b><span>Alumni · Class of '19</span></div></div>
                        </div>
                      </div>
                    </div>
                  ) : isCareer ? (
                    <div className="block">
                      <h3 className="ph">Choose a 15-min Slot</h3>
                      <div className="slots" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: "6px" }}>
                        {["1:00", "1:15", "1:30", "1:45", "2:00", "2:15", "2:30", "2:45", "3:00", "3:15", "3:30", "3:45"].map((time, idx) => {
                          const isTaken = idx === 1 || idx === 4 || idx === 7;
                          const isSelected = selectedSlot === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={isTaken}
                              onClick={() => setSelectedSlot(time)}
                              className={`slot ${isTaken ? "tk" : ""}`}
                              style={{
                                background: isSelected ? "var(--accent-tint)" : undefined,
                                color: isSelected ? "var(--accent-ink)" : undefined,
                                borderColor: isSelected ? "color-mix(in srgb, var(--accent) 40%, transparent)" : undefined,
                              }}
                            >
                              {isTaken && <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-lock"/></svg>}
                              {time}
                              {isSelected && " ✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="friends">
                        <span className="avs">
                          <span className="mark">MR</span><span className="mark">JL</span><span className="mark">PS</span>
                        </span>
                        <p>Maya, Jon +1 friend are going</p>
                      </div>
                      <div className="block" style={{ marginTop: "14px" }}>
                        <h3 className="ph">Also going</h3>
                        <div className="g-grid">
                          <div className="g-tile"><span className="mark">KT</span><div><b>Kai Tanaka</b><span>CS · Junior</span></div></div>
                          <div className="g-tile"><span className="mark">RN</span><div><b>Ritika Nair</b><span>EE · Sophomore</span></div></div>
                          <div className="g-tile"><span className="mark">DO</span><div><b>Dan Okafor</b><span>CE · Senior</span></div></div>
                          <div className="g-tile"><span className="mark">+37</span><div><b>more members</b><span>from 12 majors</span></div></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Rail */}
            <aside className="drail">
              {/* Host Info */}
              <div className="rblock">
                <div className="org">
                  <span className="mark">{event.hostCode}</span>
                  <div>
                    <b>{event.host}</b>
                    <span>Student organization</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFollowing((prev) => !prev)}
                    className="follow"
                    style={{
                      background: isFollowing ? "var(--green-tint)" : undefined,
                      color: isFollowing ? "var(--green)" : undefined,
                      borderColor: isFollowing ? "transparent" : undefined,
                    }}
                  >
                    {isFollowing ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>Following
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-plus"/></svg>Follow
                      </span>
                    )}
                  </button>
                </div>
                <div className="ostats">
                  <span className="m">
                    <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-users"/></svg>
                    <b>240</b> members
                  </span>
                  <span className="m">
                    <svg className="i i12" width={12} height={12} aria-hidden="true"><use href="#i-cal"/></svg>
                    <b>32</b> events/year
                  </span>
                </div>
              </div>

              {/* Capacity Ring */}
              <div className="rblock">
                <h3 className="ph">Capacity</h3>
                <div className="ringwrap">
                  <svg className="ring" width={60} height={60} viewBox="0 0 64 64" aria-hidden="true">
                    <circle className="bg" cx="32" cy="32" r="26" fill="none" strokeWidth="5" />
                    <circle
                      className="fg"
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      strokeWidth="5"
                      style={{ strokeDasharray: `${strokeDash} 164` }}
                    />
                    <text x="32" y="36.5" textAnchor="middle">{percent}%</text>
                  </svg>
                  <div className="ringcap">
                    <b>{typeof event.registered === "number" && event.capacity ? `${event.registered} / ${event.capacity}` : "Open"}</b>
                    <span>spots filled</span>
                    <span className="avs">
                      <span className="mark">MR</span><span className="mark">JL</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign-ups Sparkbars */}
              <div className="rblock">
                <div className="rlabel">
                  <span>Sign-ups</span>
                  <b>7 days</b>
                </div>
                <div className="bars" aria-hidden="true">
                  <i style={{ height: "22%", ["--b" as string]: 0 }} />
                  <i style={{ height: "38%", ["--b" as string]: 1 }} />
                  <i style={{ height: "30%", ["--b" as string]: 2 }} />
                  <i style={{ height: "55%", ["--b" as string]: 3 }} />
                  <i style={{ height: "47%", ["--b" as string]: 4 }} />
                  <i style={{ height: "68%", ["--b" as string]: 5 }} />
                  <i style={{ height: "82%", ["--b" as string]: 6 }} />
                </div>
              </div>

              {/* Quick Facts */}
              <div className="rblock">
                <h3 className="ph">Quick facts</h3>
                <ul className="facts">
                  <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-hour"/></svg><span>Duration</span><b>{event.duration || "1h 30m"}</b></li>
                  <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-video"/></svg><span>Format</span><b>{event.isVirtual ? "Virtual" : "Hybrid"}</b></li>
                  <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-food"/></svg><span>Food</span><b>{event.flags.food ? "Included" : "None"}</b></li>
                  <li><svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-users"/></svg><span>Capacity</span><b>{event.capacity || "Open"}</b></li>
                </ul>
              </div>

              {/* Highlight / Status Note */}
              <div className="rblock">
                <div className={`note ${event.pill?.tone === "scarce" ? "note-orange" : event.pill?.tone === "live" ? "note-red" : "note-green"}`}>
                  <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-bell"/></svg>
                  {event.pill?.tone === "scarce"
                    ? "Limited spots remaining — reserve now."
                    : event.pill?.tone === "live"
                    ? "Live now — badge in at the kiosk."
                    : "Registration open — instant confirmation."}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Footer */}
        <footer className="dfoot">
          <div className="dfoot-l">
            <button
              type="button"
              onClick={() => setIsSaved((prev) => !prev)}
              className="save"
              title="Save event"
              style={{ color: isSaved ? "var(--accent)" : undefined }}
            >
              <svg className="i i14" width={14} height={14} style={{ fill: isSaved ? "currentColor" : "none" }} aria-hidden="true">
                <use href="#i-bookm" />
              </svg>
            </button>
            <div className="share relative">
              <button
                type="button"
                onClick={() => setShareOpen((prev) => !prev)}
                title="Share"
                className="flex size-[30px] items-center justify-center rounded-[8px] text-ink-3 hover:bg-hover hover:text-ink transition-colors"
              >
                <svg className="i i14" width={14} height={14} aria-hidden="true"><use href="#i-share"/></svg>
              </button>
              {shareOpen && (
                <div className="share-pop">
                  <button type="button" onClick={handleCopyLink}>
                    <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-link"/></svg>
                    {copiedLink ? "Copied!" : "Copy link"}
                  </button>
                  <button type="button" onClick={handleGoogleCalendar}>
                    <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-calplus"/></svg>
                    Add to Google Cal
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="dfoot-r">
            <button
              type="button"
              onClick={() => setIsCalAdded((prev) => !prev)}
              className="cal"
              style={{
                background: isCalAdded ? "var(--green-tint)" : undefined,
                color: isCalAdded ? "var(--green)" : undefined,
                borderColor: isCalAdded ? "transparent" : undefined,
              }}
            >
              {isCalAdded ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>Added to Calendar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-calplus"/></svg>Add to Calendar
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isRsvpd) {
                  setIsRsvpd(true);
                  setPassModalOpen(true);
                } else {
                  setPassModalOpen(true);
                }
              }}
              className={`rsvp ${isCareer && !selectedSlot ? "book" : ""}`}
              style={{
                background: isRsvpd ? "var(--green-tint)" : undefined,
                color: isRsvpd ? "var(--green)" : undefined,
              }}
            >
              {isRsvpd ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-check"/></svg>View Pass
                </span>
              ) : isCareer ? (
                selectedSlot ? `Confirm (${selectedSlot})` : "Choose a slot"
              ) : (
                "RSVP"
              )}
            </button>
          </div>
        </footer>
      </section>

      {/* Event Pass ID Modal */}
      <EventPassModal
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        event={event}
        studentName="Ava Kimura"
        studentId="STU-84213 · 3RD YR CS"
        studentInitials="AK"
      />
    </div>
  );
}
