import type { ReactNode } from "react";

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-surface text-ink shadow-hairline">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" />
      </svg>
    </span>
  );
}

export default function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-5 p-4 select-none">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <BrandMark />
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Campus Genie</h1>
        <p className="max-w-[320px] text-[13px] leading-relaxed text-ink-2">
          Databricks Lakehouse &amp; Genie Agent intelligence for campus life, clubs, labs, and Bengaluru tech.
        </p>
      </div>

      <div
        className="w-full max-w-[420px] rounded-[16px] border border-line bg-canvas p-6 sm:p-7 shadow-overlay flex flex-col items-center justify-center"
        style={{ animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        <div className="w-full flex items-center justify-center">
          {children}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3 tabular-nums">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
        </svg>
        workspace.campus_explorer · Clerk Auth
      </div>
    </div>
  );
}
