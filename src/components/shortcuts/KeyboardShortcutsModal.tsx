"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import "@/app/shortcuts.css";

type ShortcutItem = {
  id: string;
  groupId: "g-general" | "g-nav" | "g-events" | "g-genie" | "g-data";
  groupName: string;
  title: string;
  desc: string;
  badge?: { text: string; type: "new" | "mod" | "conf" };
  icon: string;
  keys: string[]; // key ids to highlight on virtual keyboard
  macDisplay: (string | React.ReactNode)[];
  winDisplay: (string | React.ReactNode)[];
};

const SHORTCUTS: ShortcutItem[] = [
  // General
  {
    id: "r-open",
    groupId: "g-general",
    groupName: "General",
    title: "Open shortcut palette",
    desc: "Summon this dialog from anywhere on the site",
    icon: "i-spark",
    keys: ["cmd", "k"],
    macDisplay: ["⌘", "K"],
    winDisplay: ["Ctrl", "K"],
  },
  {
    id: "r-close",
    groupId: "g-general",
    groupName: "General",
    title: "Close dialog",
    desc: "Dismiss palette, popover, or drawer",
    icon: "i-x",
    keys: ["esc"],
    macDisplay: ["esc"],
    winDisplay: ["esc"],
  },
  {
    id: "r-search",
    groupId: "g-general",
    groupName: "General",
    title: "Search events",
    desc: "Jump straight into the events search field",
    icon: "i-search",
    keys: ["slash"],
    macDisplay: ["/"],
    winDisplay: ["/"],
  },
  {
    id: "r-theme",
    groupId: "g-general",
    groupName: "General",
    title: "Toggle theme",
    desc: "Swap light ↔ dark tokens in place",
    icon: "i-sun",
    keys: ["cmd", "shift", "l"],
    macDisplay: ["⌘", "⇧", "L"],
    winDisplay: ["Ctrl", "Shift", "L"],
  },
  {
    id: "r-help",
    groupId: "g-general",
    groupName: "General",
    title: "Keyboard shortcuts",
    desc: "You are here — open this reference",
    icon: "i-help",
    keys: ["shift", "slash"],
    macDisplay: ["⇧", "/"],
    winDisplay: ["Shift", "/"],
  },
  {
    id: "r-refresh",
    groupId: "g-general",
    groupName: "General",
    title: "Refresh Lakehouse cache",
    desc: "Re-sync campus_events.delta — clashes with browser reload",
    badge: { text: "conflict", type: "conf" },
    icon: "i-rotate",
    keys: ["cmd", "r"],
    macDisplay: ["⌘", "R"],
    winDisplay: ["Ctrl", "R"],
  },

  // Navigation
  {
    id: "r-next",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Next section",
    desc: "Move down one panel of the page",
    icon: "i-chd",
    keys: ["j"],
    macDisplay: ["J"],
    winDisplay: ["J"],
  },
  {
    id: "r-prev",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Previous section",
    desc: "Move up one panel of the page",
    icon: "i-chu",
    keys: ["k"],
    macDisplay: ["K"],
    winDisplay: ["K"],
  },
  {
    id: "r-sidebar",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Toggle sidebar",
    desc: "Collapse the nav rail 224 ↔ 52px",
    icon: "i-panel",
    keys: ["cmd", "b"],
    macDisplay: ["⌘", "B"],
    winDisplay: ["Ctrl", "B"],
  },
  {
    id: "r-ge",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Go to Events",
    desc: "G-chord — press G, then E",
    icon: "i-cal",
    keys: ["g", "e"],
    macDisplay: ["G", "→", "E"],
    winDisplay: ["G", "→", "E"],
  },
  {
    id: "r-gd",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Go to Dashboard",
    desc: "G-chord — press G, then D",
    icon: "i-grid",
    keys: ["g", "d"],
    macDisplay: ["G", "→", "D"],
    winDisplay: ["G", "→", "D"],
  },
  {
    id: "r-back",
    groupId: "g-nav",
    groupName: "Navigation",
    title: "Back",
    desc: "Retrace one step of browsing history",
    icon: "i-arrl",
    keys: ["cmd", "brl"],
    macDisplay: ["⌘", "["],
    winDisplay: ["Ctrl", "["],
  },

  // Events
  {
    id: "r-filter",
    groupId: "g-events",
    groupName: "Events",
    title: "Focus filters",
    desc: "Move focus to the category segmented control",
    icon: "i-funnel",
    keys: ["f"],
    macDisplay: ["F"],
    winDisplay: ["F"],
  },
  {
    id: "r-wnext",
    groupId: "g-events",
    groupName: "Events",
    title: "Next week",
    desc: "Advance the events grid one week",
    icon: "i-arr",
    keys: ["ar"],
    macDisplay: ["→"],
    winDisplay: ["→"],
  },
  {
    id: "r-wprev",
    groupId: "g-events",
    groupName: "Events",
    title: "Previous week",
    desc: "Rewind the events grid one week",
    icon: "i-arrl",
    keys: ["al"],
    macDisplay: ["←"],
    winDisplay: ["←"],
  },
  {
    id: "r-save",
    groupId: "g-events",
    groupName: "Events",
    title: "Save event",
    desc: "Bookmark the hovered event card",
    icon: "i-bookm",
    keys: ["s"],
    macDisplay: ["S"],
    winDisplay: ["S"],
  },
  {
    id: "r-rsvp",
    groupId: "g-events",
    groupName: "Events",
    title: "RSVP event",
    desc: "Confirm attendance for the hovered card",
    icon: "i-check",
    keys: ["enter"],
    macDisplay: ["⏎"],
    winDisplay: ["Enter"],
  },
  {
    id: "r-cal",
    groupId: "g-events",
    groupName: "Events",
    title: "Export to calendar",
    desc: "Write an .ics for the hovered event",
    icon: "i-calp",
    keys: ["cmd", "e"],
    macDisplay: ["⌘", "E"],
    winDisplay: ["Ctrl", "E"],
  },

  // Ask Genie
  {
    id: "r-thread",
    groupId: "g-genie",
    groupName: "Ask Genie",
    title: "New thread",
    desc: "Start a fresh Genie conversation",
    icon: "i-plus",
    keys: ["cmd", "n"],
    macDisplay: ["⌘", "N"],
    winDisplay: ["Ctrl", "N"],
  },
  {
    id: "r-run",
    groupId: "g-genie",
    groupName: "Ask Genie",
    title: "Run query",
    desc: "Execute the composed prompt or SQL",
    icon: "i-play",
    keys: ["cmd", "enter"],
    macDisplay: ["⌘", "⏎"],
    winDisplay: ["Ctrl", "Enter"],
  },
  {
    id: "r-stop",
    groupId: "g-genie",
    groupName: "Ask Genie",
    title: "Stop generation",
    desc: "Halt the streaming response mid-token",
    icon: "i-stop",
    keys: ["cmd", "dot"],
    macDisplay: ["⌘", "."],
    winDisplay: ["Ctrl", "."],
  },
  {
    id: "r-sql",
    groupId: "g-genie",
    groupName: "Ask Genie",
    title: "Toggle SQL view",
    desc: "Peek at the generated Databricks SQL",
    badge: { text: "new", type: "new" },
    icon: "i-code",
    keys: ["cmd", "slash"],
    macDisplay: ["⌘", "/"],
    winDisplay: ["Ctrl", "/"],
  },
  {
    id: "r-attach",
    groupId: "g-genie",
    groupName: "Ask Genie",
    title: "Attach context",
    desc: "Add a flyer PDF or syllabus to the thread",
    icon: "i-clip",
    keys: ["cmd", "shift", "a"],
    macDisplay: ["⌘", "⇧", "A"],
    winDisplay: ["Ctrl", "Shift", "A"],
  },

  // Data (Lakehouse)
  {
    id: "r-view1",
    groupId: "g-data",
    groupName: "Data",
    title: "Table view",
    desc: "Switch the records grid to table layout",
    icon: "i-table",
    keys: ["cmd", "n1"],
    macDisplay: ["⌘", "1"],
    winDisplay: ["Ctrl", "1"],
  },
  {
    id: "r-view2",
    groupId: "g-data",
    groupName: "Data",
    title: "Code view",
    desc: "Open the unified SQL code block",
    icon: "i-braces",
    keys: ["cmd", "n2"],
    macDisplay: ["⌘", "2"],
    winDisplay: ["Ctrl", "2"],
  },
  {
    id: "r-view3",
    groupId: "g-data",
    groupName: "Data",
    title: "Chart view",
    desc: "Render insight cards with livelines",
    icon: "i-chart",
    keys: ["cmd", "n3"],
    macDisplay: ["⌘", "3"],
    winDisplay: ["Ctrl", "3"],
  },
  {
    id: "r-freeze",
    groupId: "g-data",
    groupName: "Data",
    title: "Freeze column",
    desc: "Pin the hovered column while scrolling",
    badge: { text: "remapped", type: "mod" },
    icon: "i-snow",
    keys: ["alt", "f"],
    macDisplay: ["⌥", "F"],
    winDisplay: ["Alt", "F"],
  },
  {
    id: "r-copy",
    groupId: "g-data",
    groupName: "Data",
    title: "Copy SQL",
    desc: "Copy the latest query to the clipboard",
    icon: "i-copy",
    keys: ["cmd", "shift", "c"],
    macDisplay: ["⌘", "⇧", "C"],
    winDisplay: ["Ctrl", "Shift", "C"],
  },
  {
    id: "r-pixel",
    groupId: "g-data",
    groupName: "Data",
    title: "Pixel grid",
    desc: "Run the loading-state matrix, just for fun",
    icon: "i-dots",
    keys: ["cmd", "shift", "p"],
    macDisplay: ["⌘", "⇧", "P"],
    winDisplay: ["Ctrl", "Shift", "P"],
  },
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<"mac" | "win" | "linux">("mac");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  // Detect platform on mount
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const p = navigator.platform.toLowerCase();
      if (p.includes("win")) setPlatform("win");
      else if (p.includes("linux")) setPlatform("linux");
      else setPlatform("mac");
    }
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette on ⌘K or Ctrl+K or ? (Shift+/)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === "?" && !isOpen && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        e.preventDefault();
      } else if (isOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    return SHORTCUTS.filter((sc) => {
      if (sc.groupId === "g-data" && !showAdvanced) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          sc.title.toLowerCase().includes(q) ||
          sc.desc.toLowerCase().includes(q) ||
          sc.groupName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, showAdvanced]);

  // Hovered item & active keys to light up
  const activeItem = useMemo(() => {
    return SHORTCUTS.find((x) => x.id === hoveredId) || null;
  }, [hoveredId]);

  const activeKeys = useMemo(() => {
    return new Set(activeItem?.keys || []);
  }, [activeItem]);

  const scrollToGroup = (groupId: string) => {
    const el = document.getElementById(groupId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`kb-scope pf-${platform} ${showAdvanced ? "has-adv" : ""}`}>
      <div className="overlay" role="presentation">
        {/* Backdrop Scrim */}
        <div className="bd" onClick={onClose} aria-label="Close shortcuts" />

        {/* Dialog Shell */}
        <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <h2 className="vh" id="dlg-title">Keyboard shortcuts</h2>

          {/* Header */}
          <div className="d-head">
            <span className="d-ic">
              <svg className="i i14" aria-hidden="true"><use href="#i-kbd"/></svg>
            </span>
            <span className="d-title">Keyboard shortcuts</span>
            <span className="d-sub">28 bindings · 5 groups</span>

            <label className="search">
              <svg className="i i13" aria-hidden="true"><use href="#i-search"/></svg>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bindings…"
                aria-label="Search bindings"
              />
              <kbd>/</kbd>
            </label>

            <button type="button" onClick={onClose} className="icon-btn" title="Close" aria-label="Close">
              <svg className="i i14" width={14} height={14} aria-hidden="true"><use href="#i-x"/></svg>
            </button>
          </div>

          {/* Body: Rail + Bindings List */}
          <div className="d-body">
            {/* Category Navigation Rail */}
            <nav className="rail" aria-label="Shortcut groups">
              <span className="rail-t">Groups</span>
              <button type="button" onClick={() => scrollToGroup("g-general")} className="rr">
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-kbd"/></svg>
                <span>General</span>
                <b>6</b>
              </button>
              <button type="button" onClick={() => scrollToGroup("g-nav")} className="rr">
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-arr"/></svg>
                <span>Navigation</span>
                <b>6</b>
              </button>
              <button type="button" onClick={() => scrollToGroup("g-events")} className="rr">
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-cal"/></svg>
                <span>Events</span>
                <b>6</b>
              </button>
              <button type="button" onClick={() => scrollToGroup("g-genie")} className="rr">
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-spark"/></svg>
                <span>Ask Genie</span>
                <span className="dot-new" title="1 new binding" />
                <b>5</b>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!showAdvanced) setShowAdvanced(true);
                  setTimeout(() => scrollToGroup("g-data"), 50);
                }}
                className="rr rr-adv"
              >
                <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-db"/></svg>
                <span>Data</span>
                <b>5</b>
              </button>
            </nav>

            {/* Scrollable Bindings Pane */}
            <div className="pane" ref={paneRef}>
              {(["g-general", "g-nav", "g-events", "g-genie", "g-data"] as const).map((groupId) => {
                const groupItems = filteredShortcuts.filter((x) => x.groupId === groupId);
                if (groupItems.length === 0) return null;
                const groupTitle =
                  groupId === "g-general"
                    ? "General"
                    : groupId === "g-nav"
                    ? "Navigation"
                    : groupId === "g-events"
                    ? "Events"
                    : groupId === "g-genie"
                    ? "Ask Genie"
                    : "Data · Lakehouse";

                return (
                  <section key={groupId} className={`grp ${groupId === "g-data" ? "grp-adv" : ""}`} id={groupId}>
                    <h3 className="gh">
                      {groupId === "g-data" && <span className="dot-new" aria-hidden="true" style={{ marginRight: 6 }} />}
                      {groupTitle}
                      <b>{groupItems.length}</b>
                    </h3>
                    {groupItems.map((item) => (
                      <div
                        key={item.id}
                        className={`sr ${hoveredId === item.id ? "is-hovered" : ""}`}
                        id={item.id}
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <span className="sic">
                          <svg className="i i13" width={13} height={13} aria-hidden="true"><use href={`#${item.icon}`}/></svg>
                        </span>
                        <div className="stx">
                          <b>
                            {item.title}
                            {item.badge && (
                              <span className={`bdg b-${item.badge.type}`}>
                                {item.badge.text}
                              </span>
                            )}
                          </b>
                          <p>{item.desc}</p>
                        </div>
                        <div className="skeys">
                          {(platform === "mac" ? item.macDisplay : item.winDisplay).map((key, kIdx) => (
                            <span key={kIdx} className="inline-flex items-center">
                              {kIdx > 0 && <span className="seq-a text-ink-3"> </span>}
                              <kbd className="kc">{key}</kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>

          {/* Interactive Keyboard Strip */}
          <div className="d-kb">
            <div className="strip-head">
              <span className="st-title">Keyboard preview</span>
              <span className="st-hint">— hover a binding to light it up on the board</span>
              <div className="strip-right">
                {/* Platform Segmented Control */}
                <div className="seg" role="tablist" aria-label="Platform">
                  <span
                    className="seg-glide"
                    style={{
                      transform: `translateX(${platform === "mac" ? "0%" : platform === "win" ? "100%" : "200%"})`,
                    }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => setPlatform("mac")}
                    className={`seg-item ${platform === "mac" ? "active" : ""}`}
                  >
                    Mac
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform("win")}
                    className={`seg-item ${platform === "win" ? "active" : ""}`}
                  >
                    Win
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform("linux")}
                    className={`seg-item ${platform === "linux" ? "active" : ""}`}
                  >
                    Linux
                  </button>
                </div>

                {/* Advanced Switch */}
                <label className="adv" onClick={() => setShowAdvanced((prev) => !prev)}>
                  <span className="sw" aria-hidden="true" />
                  <span>Advanced</span>
                </label>
              </div>
            </div>

            <div className="kb-row">
              {/* Virtual Keyboard Matrix */}
              <div className="kb-wrap">
                <div className="kb" aria-hidden="true">
                  {/* Row 1 */}
                  <div className="kbr">
                    <span className={`kk q-esc k4 ${activeKeys.has("esc") ? "highlight" : ""}`}>esc</span>
                    <span className={`kk q-n1 ${activeKeys.has("n1") ? "highlight" : ""}`}>1</span>
                    <span className={`kk q-n2 ${activeKeys.has("n2") ? "highlight" : ""}`}>2</span>
                    <span className={`kk q-n3 ${activeKeys.has("n3") ? "highlight" : ""}`}>3</span>
                    <span className="kk">4</span><span className="kk">5</span><span className="kk">6</span>
                    <span className="kk">7</span><span className="kk">8</span><span className="kk">9</span><span className="kk">0</span>
                    <span className="kk">-</span><span className="kk">=</span>
                    <span className="kk k4">⌫</span>
                  </div>
                  {/* Row 2 */}
                  <div className="kbr">
                    <span className="kk k4">tab</span>
                    <span className="kk">q</span><span className="kk">w</span>
                    <span className={`kk q-e ${activeKeys.has("e") ? "highlight" : ""}`}>e</span>
                    <span className={`kk q-r ${activeKeys.has("r") ? "highlight" : ""}`}>r</span>
                    <span className="kk">t</span><span className="kk">y</span><span className="kk">u</span><span className="kk">i</span><span className="kk">o</span>
                    <span className={`kk q-p ${activeKeys.has("p") ? "highlight" : ""}`}>p</span>
                    <span className={`kk q-brl ${activeKeys.has("brl") ? "highlight" : ""}`}>[</span>
                    <span className="kk">]</span>
                    <span className="kk k3">\</span>
                  </div>
                  {/* Row 3 */}
                  <div className="kbr">
                    <span className={`kk q-ctrl k5 ${activeKeys.has("ctrl") ? "highlight" : ""}`}>
                      <span className="g-mac">⌃</span><span className="g-win">ctrl</span>
                    </span>
                    <span className={`kk q-a ${activeKeys.has("a") ? "highlight" : ""}`}>a</span>
                    <span className={`kk q-s ${activeKeys.has("s") ? "highlight" : ""}`}>s</span>
                    <span className={`kk q-d ${activeKeys.has("d") ? "highlight" : ""}`}>d</span>
                    <span className={`kk q-f ${activeKeys.has("f") ? "highlight" : ""}`}>f</span>
                    <span className={`kk q-g ${activeKeys.has("g") ? "highlight" : ""}`}>g</span>
                    <span className="kk">h</span>
                    <span className={`kk q-j ${activeKeys.has("j") ? "highlight" : ""}`}>j</span>
                    <span className={`kk q-k ${activeKeys.has("k") ? "highlight" : ""}`}>k</span>
                    <span className={`kk q-l ${activeKeys.has("l") ? "highlight" : ""}`}>l</span>
                    <span className="kk">;</span><span className="kk">&apos;</span>
                    <span className={`kk q-enter k4 ${activeKeys.has("enter") ? "highlight" : ""}`}>⏎</span>
                  </div>
                  {/* Row 4 */}
                  <div className="kbr">
                    <span className={`kk q-shift k6 ${activeKeys.has("shift") ? "highlight" : ""}`}>
                      <span className="g-mac">⇧</span><span className="g-win">shift</span>
                    </span>
                    <span className="kk">z</span><span className="kk">x</span>
                    <span className={`kk q-c ${activeKeys.has("c") ? "highlight" : ""}`}>c</span>
                    <span className="kk">v</span>
                    <span className={`kk q-b ${activeKeys.has("b") ? "highlight" : ""}`}>b</span>
                    <span className={`kk q-n ${activeKeys.has("n") ? "highlight" : ""}`}>n</span>
                    <span className="kk">m</span><span className="kk">,</span>
                    <span className={`kk q-dot ${activeKeys.has("dot") ? "highlight" : ""}`}>.</span>
                    <span className={`kk q-slash ${activeKeys.has("slash") ? "highlight" : ""}`}>/</span>
                    <span className={`kk q-shift k5 ${activeKeys.has("shift") ? "highlight" : ""}`}>
                      <span className="g-mac">⇧</span><span className="g-win">shift</span>
                    </span>
                  </div>
                  {/* Row 5 */}
                  <div className="kbr">
                    <span className="kk k1">fn</span>
                    <span className={`kk q-ctrl k2 ${activeKeys.has("ctrl") ? "highlight" : ""}`}>
                      <span className="g-mac">⌃</span><span className="g-win">ctrl</span>
                    </span>
                    <span className={`kk q-alt k2 ${activeKeys.has("alt") ? "highlight" : ""}`}>
                      <span className="g-mac">⌥</span><span className="g-win">alt</span>
                    </span>
                    <span className={`kk q-cmd k3 ${activeKeys.has("cmd") ? "highlight" : ""}`}>
                      <span className="g-mac">⌘</span><span className="g-win">ctrl</span>
                    </span>
                    <span className="kk q-sp ksp" />
                    <span className={`kk q-cmd k3 ${activeKeys.has("cmd") ? "highlight" : ""}`}>
                      <span className="g-mac">⌘</span><span className="g-win">ctrl</span>
                    </span>
                    <span className={`kk q-alt k2 ${activeKeys.has("alt") ? "highlight" : ""}`}>
                      <span className="g-mac">⌥</span><span className="g-win">alt</span>
                    </span>
                    <span className={`kk q-al ka k-ar-first ${activeKeys.has("al") ? "highlight" : ""}`}>←</span>
                    <span className="kk q-au ka">↑</span>
                    <span className="kk q-ad ka">↓</span>
                    <span className={`kk q-ar ka ${activeKeys.has("ar") ? "highlight" : ""}`}>→</span>
                  </div>
                </div>
              </div>

              {/* Preview Echo Panel */}
              <div className="pv">
                {activeItem ? (
                  <div className="pv-it">
                    <span className="pv-ic">
                      <svg className="i i14" width={14} height={14} aria-hidden="true"><use href={`#${activeItem.icon}`}/></svg>
                    </span>
                    <div className="pv-tx">
                      <b>{activeItem.title}</b>
                      <span className="pv-g">{activeItem.groupName}</span>
                    </div>
                  </div>
                ) : (
                  <div className="pv-hint">
                    <svg className="i i16" width={16} height={16} aria-hidden="true"><use href="#i-kbd"/></svg>
                    <span>Hover a binding to preview it on the board</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <footer className="d-foot">
            <div className="lg" aria-label="Modifier legend">
              <span className="lg-item">
                <kbd><span className="g-mac">⌘</span><span className="g-win">Ctrl</span></kbd>
                <span className="g-mac">Command</span><span className="g-win">Control</span>
              </span>
              <span className="lg-item">
                <kbd><span className="g-mac">⌥</span><span className="g-win">Alt</span></kbd>
                <span className="g-mac">Option</span><span className="g-win">Alt</span>
              </span>
              <span className="lg-item"><kbd>⇧</kbd>Shift</span>
              <span className="lg-item lg-ctrl"><kbd>⌃</kbd>Control</span>
            </div>
            <div className="foot-right">
              <span className="fpill"><kbd>esc</kbd>Close</span>
              <span className="fpill"><kbd>⏎</kbd>Jump to result</span>
              <button
                type="button"
                onClick={() => {
                  const data = JSON.stringify(SHORTCUTS, null, 2);
                  navigator.clipboard?.writeText(data);
                }}
                className="cal-link"
              >
                Export bindings <svg className="i i11" width={11} height={11} aria-hidden="true"><use href="#i-ext"/></svg>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
