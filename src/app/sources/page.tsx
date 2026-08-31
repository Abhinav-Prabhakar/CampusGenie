"use client";

import { useState } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import { useTheme } from "@/lib/theme";
import Link from "next/link";

export default function SourcesPage() {
  const { isDark, toggleTheme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle="Knowledge Sources"
        activeNav="sources"
        footerLabel="Campus Genie v1.0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-canvas">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-ink">Knowledge Sources</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard Shortcuts (⌘K)"
                className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink transition-colors duration-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2.5" y="6" width="19" height="12" rx="2" />
                  <path d="M6.2 10h.01M10 10h.01M13.8 10h.01M17.6 10h.01M6.2 14h.01M17.6 14h.01M9.2 14h5.6" />
                </svg>
              </button>

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

          <div className="min-h-0 flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center bg-canvas">
            <div className="max-w-[460px] p-8 rounded-[14px] border border-line bg-surface shadow-card flex flex-col items-center">
              <div className="size-12 rounded-[10px] bg-inset border border-line flex items-center justify-center text-xl text-ink-2 mb-3">
                📚
              </div>
              <h2 className="text-[16px] font-semibold text-ink mb-1">Knowledge & Catalog Sources</h2>
              <p className="text-[13px] text-ink-2 mb-4 leading-relaxed">
                Connect and govern your campus datasets, Delta tables, club handbooks, and syllabi.
              </p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-inset border border-line text-[11.5px] text-ink-3">
                <span className="size-1.5 rounded-full bg-orange animate-pulse" />
                Under Configuration in Unity Catalog
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Global SVG Icons Sprite */}
      <EventIcons />

      {/* Keyboard Shortcuts Dialog Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </main>
  );
}
