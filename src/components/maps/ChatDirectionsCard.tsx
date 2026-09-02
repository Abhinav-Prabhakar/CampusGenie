"use client";

import DirectionsMap from "./DirectionsMap";
import {
  formatDistance,
  formatDuration,
  type DirectionsPayload,
  type TurnKind,
} from "@/lib/campusDirections";
import "@/app/maps.css";

function TurnIcon({ turn }: { turn: TurnKind }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (turn) {
    case "depart":
      return (
        <svg {...common}>
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case "left":
      return (
        <svg {...common}>
          <polyline points="9 14 4 9 9 4" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      );
    case "right":
      return (
        <svg {...common}>
          <polyline points="15 14 20 9 15 4" />
          <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
        </svg>
      );
    case "arrive":
      return (
        <svg {...common}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
}

export default function ChatDirectionsCard({
  route,
  isDark,
}: {
  route: DirectionsPayload;
  isDark: boolean;
}) {
  return (
    <div className="w-full overflow-hidden rounded-[12px] border border-line bg-surface shadow-card">
      {/* Header: route title + distance/ETA pills */}
      <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-canvas px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-ink">
              {route.from.name} <span className="text-ink-3">→</span> {route.to.name}
            </div>
            <div className="truncate text-[11.5px] font-medium text-ink-3">
              {route.college} · Walking
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-[6px] border border-line bg-inset px-2 py-0.5 text-[11.5px] font-medium text-ink-2 tabular-nums">
            {formatDistance(route.distanceMeters)}
          </span>
          <span className="rounded-[6px] bg-green-tint px-2 py-0.5 text-[11.5px] font-medium text-green tabular-nums">
            {formatDuration(route.durationMinutes)}
          </span>
        </div>
      </div>

      {/* Map: dark basemap that auto-adapts to the app theme, 3D buildings */}
      <div className="relative h-[280px] w-full sm:h-[320px]">
        <DirectionsMap route={route} isDark={isDark} />
        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-[6px] border border-line bg-surface/85 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3 backdrop-blur-sm">
          3D buildings
        </div>
      </div>

      {/* Turn-by-turn steps */}
      <div className="border-t border-line-soft">
        <div className="px-3.5 pb-1 pt-2.5 text-[11.5px] font-medium text-ink-3">
          Turn-by-turn directions
        </div>
        <ol className="max-h-[220px] overflow-y-auto px-1.5 pb-1.5">
          {route.steps.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-[8px] px-2 py-1.5 transition-colors duration-100 hover:bg-hover/50"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] border border-line-soft bg-inset text-ink-2">
                <TurnIcon turn={step.turn} />
              </span>
              <span className="flex-1 text-[13px] leading-snug text-ink">{step.instruction}</span>
              {step.distanceMeters > 0 && (
                <span className="mt-0.5 text-[11.5px] font-medium text-ink-3 tabular-nums">
                  {formatDistance(step.distanceMeters)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
