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
  onOpen,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
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

  // Keyboard shortcut listener. Bindings invoke real controls through stable
  // data attributes so the reference and the UI cannot drift apart.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target?.closest("input, textarea, select, [contenteditable=\"true\"]");
      const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const click = (selector: string) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) return false;
        element.click();
        return true;
      };
      const focus = (selector: string) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) return false;
        element.focus();
        return true;
      };
      const run = (action: () => void | boolean) => {
        if (action() !== false) e.preventDefault();
      };

      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onOpen?.();
        return;
      }
      if (e.key === "?" && !isOpen && !isTyping) {
        e.preventDefault();
        onOpen?.();
        return;
      }
      if (e.key === "Escape") {
        if (isOpen) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (isOpen) {
        if (e.key === "/" && target?.tagName !== "INPUT") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        return;
      }
      // Plain letters/arrows must remain native text-editing behavior, while
      // explicit platform-modified bindings still work from the composer.
      if (isTyping && !modifier && !e.altKey) return;

      const key = e.key.toLowerCase();
      if (modifier && key === "n") run(() => click("[data-shortcut-new-thread]"));
      else if (modifier && key === "enter") run(() => click("[data-prompt-send]"));
      else if (modifier && key === ".") run(() => click("[data-prompt-stop]"));
      else if (modifier && key === "/") run(() => click("[data-shortcut-sql]"));
      else if (modifier && e.shiftKey && key === "a") run(() => click("[data-prompt-attach]"));
      else if (modifier && e.shiftKey && key === "c") run(() => click("[aria-label=\"Copy code\"]"));
      else if (modifier && e.shiftKey && key === "l") run(() => click("[title=\"Toggle Theme\"]"));
      else if (modifier && key === "b") run(() => click("[aria-label=\"Collapse sidebar\"]:not([aria-hidden=\"true\"]), [aria-label=\"Expand sidebar\"]:not([aria-hidden=\"true\"])") );
      else if (modifier && key === "[") run(() => window.history.back());
      else if (key === "/") run(() => focus("[aria-label=\"Search events\"]"));
      else if (key === "f") run(() => focus("[data-shortcut-filters]"));
      else if (key === "j") run(() => window.scrollBy({ top: Math.max(240, window.innerHeight * 0.7), behavior: "smooth" }));
      else if (key === "k") run(() => window.scrollBy({ top: -Math.max(240, window.innerHeight * 0.7), behavior: "smooth" }));
      else if (key === "s") run(() => click("article:hover .save"));
      else if (key === "enter") run(() => click("article:hover .rsvp"));
      else if (e.altKey && key === "f") run(() => click("[data-shortcut-freeze]"));
      else if (e.key === "ArrowRight") run(() => click("[data-shortcut-next-week]"));
      else if (e.key === "ArrowLeft") run(() => click("[data-shortcut-prev-week]"));
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
      {/* Complete Feather-Style SVG Sprite embedded directly */}
      <svg xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }} aria-hidden="true">
        <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z"/><path d="M19 15.5v3M17.5 17h3"/></symbol>
        <symbol id="i-kbd" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.2 10h.01M10 10h.01M13.8 10h.01M17.6 10h.01M6.2 14h.01M17.6 14h.01M9.2 14h5.6"/></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></symbol>
        <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.2a2.8 2.8 0 1 1 3.9 2.6c-.8.35-1.1.9-1.1 1.8M12 16.6v.1"/></symbol>
        <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></symbol>
        <symbol id="i-chu" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></symbol>
        <symbol id="i-chd" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
        <symbol id="i-chl" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
        <symbol id="i-arr" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
        <symbol id="i-arrl" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
        <symbol id="i-panel" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></symbol>
        <symbol id="i-calp" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18M12 13.5v4.5M9.75 15.75h4.5"/></symbol>
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></symbol>
        <symbol id="i-table" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9.5h18M10 9.5v10"/></symbol>
        <symbol id="i-funnel" viewBox="0 0 24 24"><path d="M3.5 5h17l-6.5 7.5v5l-4 2v-7L3.5 5Z"/></symbol>
        <symbol id="i-bookm" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
        <symbol id="i-play" viewBox="0 0 24 24"><path d="M7.5 5.5v13l11-6.5Z"/></symbol>
        <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></symbol>
        <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 6.5-5.5 5.5L8 17.5M16 6.5 21.5 12 16 17.5"/></symbol>
        <symbol id="i-braces" viewBox="0 0 24 24"><path d="M8.5 4c-2.2 0-2.7 1.2-2.7 2.9v1.7c0 1.6-.6 2.7-2.3 2.9 1.7.2 2.3 1.3 2.3 2.9v1.7c0 1.7.5 2.9 2.7 2.9M15.5 4c2.2 0 2.7 1.2 2.7 2.9v1.7c0 1.6.6 2.7 2.3 2.9-1.7.2-2.3 1.3-2.3 2.9v1.7c0 1.7-.5 2.9-2.7 2.9"/></symbol>
        <symbol id="i-clip" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path d="M6 20v-4M12 20V4M18 20v-7"/></symbol>
        <symbol id="i-snow" viewBox="0 0 24 24"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M5 15.5h-.5A1.5 1.5 0 0 1 3 14V4.5A1.5 1.5 0 0 1 4.5 3H14a1.5 1.5 0 0 1 1.5 1.5V5"/></symbol>
        <symbol id="i-dots" viewBox="0 0 24 24"><path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01"/></symbol>
        <symbol id="i-db" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></symbol>
        <symbol id="i-ext" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>
      </svg>

      <div className="overlay" role="presentation">
        {/* Backdrop Scrim */}
        <div className="bd" onClick={onClose} aria-label="Close shortcuts" />

        {/* Dialog Shell */}
        <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <h2 className="vh" id="dlg-title">Keyboard shortcuts</h2>

          {/* Header */}
          <div className="d-head">
            <span className="d-ic">
              <svg className="i i14" width={14} height={14} aria-hidden="true"><use href="#i-kbd"/></svg>
            </span>
            <span className="d-title">Keyboard shortcuts</span>
            <span className="d-sub">28 bindings · 5 groups</span>

            <label className="search">
              <svg className="i i13" width={13} height={13} aria-hidden="true"><use href="#i-search"/></svg>
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
