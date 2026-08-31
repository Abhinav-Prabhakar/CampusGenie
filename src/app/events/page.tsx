"use client";

import { useState, useEffect } from "react";
import SidebarNav, { type SidebarRecent } from "@/components/primitives/SidebarNav";
import EventsView from "@/components/events/EventsView";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CAMPUS_RECENTS: SidebarRecent[] = [
  { id: "waste-week", label: "Don't let me waste my week" },
  { id: "find-tribe", label: "Find my AI research tribe" },
  { id: "city-meetups", label: "Bengaluru weekend tech meetups" },
  { id: "alumni-paths", label: "Alumni pathways: ML vs Systems" },
  { id: "hackathon-plan", label: "HackBangalore preparation roadmap" },
];

export default function EventsPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("bui-theme");
    const darkActive = saved !== "light";
    setIsDark(darkActive);
    document.documentElement.classList.toggle("dark", darkActive);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("bui-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const handleAskGenie = (prompt: string) => {
    sessionStorage.setItem("cg_initial_prompt", prompt);
    router.push("/");
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        recents={CAMPUS_RECENTS}
        activeTitle="Campus Events"
        activeNav="events"
        footerLabel="Campus Genie v1.0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-1 overflow-x-auto">
              <Link
                href="/"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors"
              >
                <span>💬 Genie Chat</span>
              </Link>
              <Link
                href="/events"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium bg-hover-2 text-ink shadow-hairline transition-colors"
              >
                <span>📅 Events</span>
              </Link>
              <Link
                href="/sources"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors"
              >
                <span>📚 Sources</span>
              </Link>
              <Link
                href="/gallery"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink transition-colors"
              >
                <span>✨ Primitives Gallery</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-accent-tint/60 px-2.5 py-0.5 text-[11.5px] font-medium text-accent-ink border border-accent/20">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                Unity Catalog: campus_events.delta
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle Theme"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-canvas text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
              >
                {isDark ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 bg-canvas">
            <div className="max-w-[1152px] mx-auto">
              <EventsView onAskGenie={handleAskGenie} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
