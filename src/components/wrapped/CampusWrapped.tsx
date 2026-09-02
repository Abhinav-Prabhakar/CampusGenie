"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/wrapped.css";

type Personality = { key: "creator" | "builder" | "researcher" | "connector"; label: string; share: number };

type WrappedPayload = {
  term: string;
  stats: {
    eventsDiscovered: number;
    eventsAttended: number;
    newConnections: number;
    projects: number;
    clubsExplored: number;
    alumniConversations: number;
  };
  personality: Personality[];
  dominant: Personality["key"];
  crossDepartmentPct: number;
  weeklyActivity: number[];
  topCategories: Array<{ label: string; pct: number }>;
  derivedFrom: string[];
  marqueeEvents: string[];
  claims: {
    percentile: number;
    nightOwlPct: number;
    busiestWeekday: string;
    freePizzaSlices: number;
    rankTitle: string;
    stepsAroundCampus: number;
  };
};

const SLIDE_MS = 8000;

/* ── tiny primitives ─────────────────────────────────────── */

function Icon({ children, size = 16, sw = 1.9 }: { children: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function useCountUp(target: number, delay: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const begin = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - begin) / duration));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return value;
}

function Count({ target, delay = 150 }: { target: number; delay?: number }) {
  return <>{useCountUp(target, delay)}</>;
}

function Letters({ text, base = 0 }: { text: string; base?: number }) {
  return (
    <span className="letters" aria-label={text} role="text">
      {text.split("").map((ch, i) => (
        <span key={i} aria-hidden style={{ animationDelay: `${base + i * 55}ms` }}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/* deterministic pseudo-random per index (stable across renders) */
const unit = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return ((x - Math.floor(x)) + 1) % 1;
};

function Blobs({ salt = 1 }: { salt?: number }) {
  const blobs = [
    { s: 190, c: "rgba(255,255,255,0.35)", x: "6%", y: "12%", cls: "float-a" },
    { s: 120, c: "rgba(255,233,92,0.5)", x: "84%", y: "16%", cls: "float-b" },
    { s: 240, c: "rgba(122,231,255,0.4)", x: "72%", y: "68%", cls: "float-c" },
    { s: 90, c: "rgba(255,110,180,0.5)", x: "14%", y: "72%", cls: "float-b" },
    { s: 150, c: "rgba(255,255,255,0.25)", x: "45%", y: "82%", cls: "float-a" },
    { s: 64, c: "rgba(200,245,66,0.55)", x: "58%", y: "8%", cls: "float-c" },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <span
          key={i}
          className={`blob ${b.cls}`}
          style={{ width: b.s, height: b.s, left: b.x, top: b.y, background: b.c, animationDelay: `${unit(i, salt) * 2}s` }}
        />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={`t${i}`}
          className="twinkle"
          style={{
            position: "absolute",
            left: `${4 + unit(i, salt + 3) * 92}%`,
            top: `${6 + unit(i, salt + 7) * 86}%`,
            width: 4 + Math.round(unit(i, salt + 11) * 4),
            height: 4 + Math.round(unit(i, salt + 11) * 4),
            borderRadius: "9999px",
            background: "#fff",
            animationDelay: `${unit(i, salt + 13) * 2.4}s`,
          }}
        />
      ))}
    </>
  );
}

function ConfettiRain({ count = 40 }: { count?: number }) {
  const colors = ["#fff", "#ffe95c", "#7ae7ff", "#ff8ad4", "#c8f542", "#ffba08"];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const u1 = unit(i, 5), u2 = unit(i, 9), u3 = unit(i, 13);
        const round = i % 2 === 0;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${u1 * 100}%`,
              width: round ? 7 : 5 + Math.round(u2 * 7),
              height: round ? 7 : 9 + Math.round(u2 * 9),
              borderRadius: round ? "9999px" : 2,
              background: colors[i % colors.length],
              animationDuration: `${2600 + u3 * 2600}ms`,
              animationDelay: `${u2 * 2400}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

function Burst({ color = "#fff", count = 10 }: { color?: string; count?: number }) {
  return (
    <span className="burst" style={{ color }} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 70 + unit(i, 21) * 60;
        return (
          <i key={i} style={{ "--bx": `${Math.cos(angle) * dist}px`, "--by": `${Math.sin(angle) * dist}px`, animationDelay: `${i * 30}ms` } as React.CSSProperties} />
        );
      })}
    </span>
  );
}

function Marquee({ items, reverse = false, edge = "bottom" }: { items: string[]; reverse?: boolean; edge?: "top" | "bottom" }) {
  const line = items.length > 0 ? items : ["Hack the Lake", "ACM Weekly", "Firepit Mixer", "Sunrise Yoga", "Ideathon"];
  return (
    <div className={`marquee ${reverse ? "marquee-rev" : ""} ${edge === "top" ? "marquee-top" : "marquee-bottom"}`} aria-hidden>
      <div className="marquee-track">
        {[...line, ...line].map((t, i) => (
          <span key={i} style={{ opacity: i % 2 ? 0.6 : 1 }}>✦ {t}</span>
        ))}
      </div>
    </div>
  );
}

const PERSONA_META: Record<string, { icon: React.ReactNode; blurb: string }> = {
  creator: { icon: <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.6-1.7-1.9-1.7-3.2 0-1 .8-1.7 2-1.7h1.9A4.8 4.8 0 0 0 21 9.5C21 5.9 17 3 12 3Z" /><circle cx="7.7" cy="10.2" r="1.1" fill="currentColor" stroke="none" /><circle cx="10.8" cy="7.1" r="1.1" fill="currentColor" stroke="none" /></>, blurb: "fliers, zines, opening slides — you make the thing exist" },
  builder: { icon: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" />, blurb: "repos, demos, 3 AM deploys — you ship it" },
  researcher: { icon: <><path d="M10 2.5v6.2L4.6 18a2 2 0 0 0 1.8 3h11.2a2 2 0 0 0 1.8-3L14 8.7V2.5" /><path d="M8.5 2.5h7M7.5 14.5h9" /></>, blurb: "papers, benchmarks, why-it-works — you dig for it" },
  connector: { icon: <><circle cx="8.5" cy="8" r="3.2" /><path d="M2.5 20v-.8a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2V20" /><path d="M17 5.5a3.2 3.2 0 0 1 0 5.6" /></>, blurb: "group chats, intros, teamwork — you gather people" },
};

/* ── slides ──────────────────────────────────────────────── */

function SlideIntro({ d }: { d: WrappedPayload }) {
  return (
    <>
      <Blobs salt={1} />
      <div className="rays" style={{ opacity: 0.25 }} />
      <div className="relative z-10 flex max-w-[900px] flex-col items-center gap-6 text-center">
        <span className="kicker rise" style={{ animationDelay: "80ms" }}>Campus Genie presents</span>
        <h1 className="mega mega-lg grad-text">
          <Letters text="YOUR CAMPUS" base={200} />
          <br />
          <Letters text="WRAPPED" base={600} />
        </h1>
        <p className="lede rise" style={{ animationDelay: "900ms" }}>
          {d.term} — one semester, every signal, zero chill. Swipe or use ← → to relive it.
        </p>
        <div className="chip-line" style={{ paddingTop: 6 }}>
          <span className="wchip" style={{ animationDelay: "1100ms" }}>🏆 {d.claims.rankTitle}</span>
          <span className="wchip" style={{ animationDelay: "1250ms" }}>🎓 {d.derivedFrom.length} delta tables scanned</span>
        </div>
        <span className="begin-hint kicker rise" style={{ animationDelay: "1400ms", paddingTop: 10 }}>tap anywhere to begin ▸</span>
      </div>
      <Marquee items={d.marqueeEvents} />
    </>
  );
}

function SlideEvents({ d }: { d: WrappedPayload }) {
  const icons = [
    <rect key="a" x="3" y="4.5" width="18" height="17" rx="2.5" />, 
    <path key="b" d="m8 6-5.5 5.5L8 17.5M16 6l5.5 5.5L16 17.5" />,
    <rect key="c" x="2.5" y="7" width="19" height="13.5" rx="2" />,
    <path key="d" d="M9 18V5.5L21 3v12.5" />,
  ];
  return (
    <>
      <Blobs salt={2} />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <span className="kicker rise">you discovered</span>
        <div className="relative flex items-center justify-center">
          <span className="absolute size-[clamp(280px,42vw,460px)] rounded-full border border-white/30 spin-slow" style={{ borderStyle: "dashed" }} />
          <span className="absolute size-[clamp(200px,30vw,330px)] rounded-full border-2 border-white/25 spin-rev" />
          {icons.map((glyph, i) => {
            const angle = (i / icons.length) * Math.PI * 2;
            const r = 42;
            return (
              <span
                key={i}
                className="pop absolute flex size-11 items-center justify-center rounded-full bg-white/20 backdrop-blur"
                style={{
                  left: `${50 + Math.cos(angle) * r}%`,
                  top: `${50 + Math.sin(angle) * r}%`,
                  transform: "translate(-50%,-50%)",
                  animationDelay: `${500 + i * 140}ms`,
                }}
              >
                <Icon size={20}>{glyph}</Icon>
              </span>
            );
          })}
          <span className="mega mega-xl grad-text tabular-nums"><Count target={d.stats.eventsDiscovered} /></span>
        </div>
        <h2 className="mega mega-md rise" style={{ animationDelay: "400ms" }}>events this semester</h2>
        <p className="lede rise text-center" style={{ animationDelay: "600ms" }}>
          That&apos;s more FOMO dodged than <b>{100 - d.claims.percentile}%</b> of campus. Your radar missed nothing.
        </p>
        <div className="chip-line" style={{ paddingTop: 4 }}>
          <span className="wchip" style={{ animationDelay: "800ms" }}>#{d.topCategories[0]?.label ?? "Hackathons"} — your #1 feed</span>
          <span className="wchip" style={{ animationDelay: "950ms" }}>top {d.claims.percentile}% for discovery</span>
        </div>
      </div>
      <Marquee items={d.marqueeEvents} reverse edge="top" />
      <Marquee items={d.marqueeEvents} />
    </>
  );
}

function SlideAttend({ d }: { d: WrappedPayload }) {
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => (unit(i, 31) > 0.45 ? (unit(i, 37) > 0.55 ? 2 : 1) : 0)), []);
  return (
    <>
      <Blobs salt={3} />
      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <span className="kicker rise">you actually showed up to</span>
        <span className="mega mega-xl grad-text tabular-nums"><Count target={d.stats.eventsAttended} /></span>
        <h2 className="mega mega-md rise" style={{ animationDelay: "350ms" }}>events. In person. Legendarily.</h2>
        <div className="heat-grid rise" style={{ animationDelay: "500ms" }}>
          {cells.map((lvl, i) => (
            <span key={i} className={`heat-cell ${lvl === 1 ? "lit-1" : lvl === 2 ? "lit-2" : ""}`} style={{ animationDelay: `${600 + i * 26}ms` }} />
          ))}
        </div>
        <p className="lede rise text-center" style={{ animationDelay: "900ms" }}>
          ≈<b>{d.claims.freePizzaSlices}</b> free pizza slices. ≈<b>{(d.claims.stepsAroundCampus / 1000).toFixed(0)}k</b> steps around campus. Worth it.
        </p>
        <div className="chip-line">
          <span className="wchip" style={{ animationDelay: "1100ms" }}>top {d.claims.percentile}% of attendees</span>
          <span className="wchip" style={{ animationDelay: "1250ms" }}>busiest: {d.claims.busiestWeekday}</span>
        </div>
      </div>
    </>
  );
}

function SlideConnect({ d }: { d: WrappedPayload }) {
  const nodes = useMemo(() => Array.from({ length: d.stats.newConnections }, (_, i) => ({
    x: 50 + Math.cos((i / d.stats.newConnections) * Math.PI * 2) * (30 + unit(i, 41) * 8),
    y: 50 + Math.sin((i / d.stats.newConnections) * Math.PI * 2) * (26 + unit(i, 43) * 10),
  })), [d.stats.newConnections]);
  return (
    <>
      <Blobs salt={4} />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <span className="kicker rise">you walked out with</span>
        <div className="relative" style={{ width: "min(560px, 84vw)", aspectRatio: "1.5" }}>
          <svg viewBox="0 0 100 66" className="absolute inset-0 size-full" aria-hidden>
            {nodes.map((n, i) => (
              <line key={`l${i}`} className="const-line" x1="50" y1="33" x2={n.x} y2={n.y * 0.66} stroke="rgba(255,255,255,0.55)" strokeWidth="0.45" style={{ animationDelay: `${300 + i * 130}ms` }} />
            ))}
            {nodes.map((n, i) => (
              <circle key={`n${i}`} cx={n.x} cy={n.y * 0.66} r="1.5" fill="#fff" style={{ animation: `pop-in 400ms ${400 + i * 130}ms both` }} />
            ))}
            <circle cx="50" cy="33" r="3.4" fill="#ffe95c" style={{ animation: "breathe 2.4s ease-in-out infinite" }} />
          </svg>
          <span className="mega mega-lg grad-text tabular-nums absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Count target={d.stats.newConnections} delay={400} />
          </span>
        </div>
        <h2 className="mega mega-md rise" style={{ animationDelay: "400ms" }}>new humans in your orbit</h2>
        <p className="lede rise text-center" style={{ animationDelay: "600ms" }}>
          {d.stats.newConnections} numbers saved, 5 group chats joined, and one late-night project idea that might actually happen.
        </p>
        <div className="chip-line">
          <span className="wchip" style={{ animationDelay: "800ms" }}>cross-department: {d.crossDepartmentPct}%</span>
          <span className="wchip" style={{ animationDelay: "950ms" }}>team-match rate: elite</span>
        </div>
      </div>
    </>
  );
}

function SlideProjects({ d }: { d: WrappedPayload }) {
  return (
    <>
      <Blobs salt={5} />
      <div className="absolute inset-0 opacity-20" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="twinkle absolute" style={{ left: `${unit(i, 51) * 100}%`, top: `${unit(i, 53) * 100}%`, width: 3, height: 3, borderRadius: 9999, background: "#7dffb0", animationDelay: `${unit(i, 55)}s` }} />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <span className="kicker rise" style={{ color: "#7dffb0" }}>deploy № semester</span>
        <div className="relative flex items-end justify-center gap-10" style={{ height: "clamp(140px, 24vh, 210px)" }}>
          {[0, 1, 2, 3].slice(0, Math.max(d.stats.projects, 1)).map((i) => (
            <span key={i} className="rocket flex flex-col items-center" style={{ animationDelay: `${i * 620}ms` }}>
              <Icon size={38} sw={1.6}><path d="M12 2c3 2.5 4.5 6 4.5 9.5L14 15h-4l-2.5-3.5C7.5 8 9 4.5 12 2Z" /><circle cx="12" cy="9" r="1.6" /><path d="M10 15l-2 4 3-1.5M14 15l2 4-3-1.5" /></Icon>
              <span className="flame" style={{ color: "#ffb38a" }}><Icon size={18}><path d="M12 3c2 2.6 2 5-0 7-2-2-2-4.4 0-7Z" /></Icon></span>
            </span>
          ))}
        </div>
        <span className="mega mega-xl grad-text tabular-nums"><Count target={d.stats.projects} delay={300} /></span>
        <h2 className="mega mega-md rise" style={{ animationDelay: "300ms" }}>projects pushed past the demo</h2>
        <p className="lede rise text-center" style={{ animationDelay: "500ms", fontFamily: "var(--font-mono), monospace", fontSize: "clamp(12px, 1.7vw, 15px)" }}>
          <span className="caret">$ git push --force-semester — {d.claims.nightOwlPct}% of commits after midnight</span>
        </p>
        <div className="chip-line">
          <span className="wchip" style={{ animationDelay: "700ms" }}>1 prize shortlist</span>
          <span className="wchip" style={{ animationDelay: "850ms" }}>∞ scope creep</span>
        </div>
      </div>
    </>
  );
}

const CLUB_FAN = [
  { mono: "AI", name: "AIS Lab", fr: "-14deg" },
  { mono: "CX", name: "CruX Coding", fr: "0deg" },
  { mono: "DA", name: "Data Club", fr: "14deg" },
];

function SlideClubs({ d }: { d: WrappedPayload }) {
  return (
    <>
      <Blobs salt={6} />
      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <span className="kicker rise">you went</span>
        <div className="flex items-end justify-center gap-3 pt-6">
          {CLUB_FAN.slice(0, Math.max(d.stats.clubsExplored, 1)).map((club, i) => (
            <div
              key={club.mono}
              className="fan-card flex flex-col items-center gap-2 rounded-2xl border-2 border-white/60 bg-white/15 px-6 py-5 backdrop-blur"
              style={{ "--fr": club.fr, animationDelay: `${300 + i * 160}ms`, transform: `rotate(${club.fr})`, marginBottom: i === 1 ? 26 : 0 } as React.CSSProperties}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-white text-[16px] font-bold text-black/80">{club.mono}</span>
              <span className="text-[13px] font-bold tracking-wide">{club.name}</span>
            </div>
          ))}
        </div>
        <span className="mega mega-xl grad-text tabular-nums"><Count target={d.stats.clubsExplored} delay={300} /></span>
        <h2 className="mega mega-md rise" style={{ animationDelay: "350ms" }}>clubs deep this term</h2>
        <p className="lede rise text-center" style={{ animationDelay: "550ms" }}>
          You collected communities like badges — lab notebook in one hand, pizza slice in the other.
        </p>
      </div>
    </>
  );
}

function SlideAlumni({ d }: { d: WrappedPayload }) {
  const convo = [
    { me: false, text: "Your Genie demo reminded me of my first Databricks rollout. Sharp work." },
    { me: true, text: "Thank you!! Sending you the repo — the Lakehouse schema is wild." },
    { me: false, text: "Let me intro you to my team. Coffee Thursday? ☕" },
  ];
  return (
    <>
      <Blobs salt={7} />
      <div className="relative z-10 flex max-w-[640px] flex-col items-center gap-4 text-center">
        <span className="kicker rise">you swapped notes with</span>
        <span className="mega mega-xl grad-text tabular-nums"><Count target={d.stats.alumniConversations} /></span>
        <h2 className="mega mega-md rise" style={{ animationDelay: "300ms" }}>alumni who remember your name</h2>
        <div className="flex w-full flex-col gap-3 pt-2">
          {convo.map((m, i) => (
            <div key={i} className={`bubble ${m.me ? "bubble-me from-right" : "bubble-them from-left"}`} style={{ animationDelay: `${500 + i * 420}ms` }}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chip-line" style={{ paddingTop: 6 }}>
          <span className="wchip" style={{ animationDelay: "1900ms" }}>3 warm referrals</span>
          <span className="wchip" style={{ animationDelay: "2050ms" }}>1 mock interview booked</span>
        </div>
      </div>
    </>
  );
}

function SlidePersona({ d }: { d: WrappedPayload }) {
  const dom = d.personality[0];
  return (
    <>
      <div className="rays" style={{ opacity: 0.3 }} />
      <Blobs salt={8} />
      <div className="relative z-10 flex max-w-[860px] flex-col items-center gap-6 text-center">
        <span className="kicker rise">your campus personality</span>
        <div className="flex flex-wrap items-end justify-center gap-4">
          {d.personality.map((p, i) => {
            const meta = PERSONA_META[p.key];
            const isDom = p.key === d.dominant;
            return (
              <div
                key={p.key}
                className={`pop relative flex flex-col items-center gap-2 rounded-2xl px-5 py-4 ${isDom ? "" : "opacity-80"}`}
                style={{
                  animationDelay: `${300 + i * 180}ms`,
                  background: isDom ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)",
                  border: isDom ? "2px solid #fff" : "1px solid rgba(255,255,255,0.4)",
                  transform: isDom ? "scale(1.12)" : undefined,
                  backdropFilter: "blur(6px)",
                }}
              >
                {isDom && <Burst color="#ffe95c" />}
                <span className="flex size-14 items-center justify-center rounded-full bg-white text-black">
                  <Icon size={26} sw={1.7}>{meta.icon}</Icon>
                </span>
                <span className="text-[15px] font-bold tracking-wide">{p.label}</span>
                <span className="text-[12px] font-semibold opacity-80 tabular-nums">{p.share}%</span>
                {isDom && (
                  <span className="stamp" style={{ position: "absolute", top: -18, right: -24, fontSize: 11, animationDelay: "1100ms" }}>
                    dominant
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <h2 className="mega mega-lg grad-text rise" style={{ animationDelay: "1200ms" }}>{dom.label.toUpperCase()}</h2>
        <p className="lede rise text-center" style={{ animationDelay: "1350ms" }}>
          {PERSONA_META[dom.key].blurb} — that&apos;s the energy campus felt from you all term.
        </p>
        <div className="chip-line">
          {d.personality.slice(1).map((p, i) => (
            <span key={p.key} className="wchip" style={{ animationDelay: `${1500 + i * 150}ms` }}>{p.label} {p.share}%</span>
          ))}
        </div>
      </div>
    </>
  );
}

function SlideCross({ d }: { d: WrappedPayload }) {
  const pct = d.crossDepartmentPct;
  const dash = (pct / 100) * 435;
  return (
    <>
      <Blobs salt={9} />
      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <span className="kicker rise">the bubble report</span>
        <div className="relative size-[clamp(180px,26vw,240px)]">
          <svg viewBox="0 0 160 160" className="size-full -rotate-90">
            <circle cx="80" cy="80" r="69" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="13" />
            <circle
              cx="80" cy="80" r="69" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round"
              className="donut-fg" strokeDasharray={`${dash} 435`}
            />
          </svg>
          <span className="mega mega-lg grad-text tabular-nums absolute inset-0 flex items-center justify-center">
            <Count target={pct} delay={300} />%
          </span>
        </div>
        <h2 className="mega mega-md rise" style={{ animationDelay: "400ms" }}>of your event time was spent<br />outside your department</h2>
        <div className="split-bar rise" style={{ animationDelay: "600ms" }}>
          <span className="split-a" style={{ width: `${pct}%`, animationDelay: "700ms" }} />
          <span className="split-b" />
        </div>
        <div className="chip-line">
          <span className="wchip" style={{ animationDelay: "900ms" }}>{pct}% cross-disciplinary</span>
          <span className="wchip" style={{ animationDelay: "1050ms" }}>{100 - pct}% home department</span>
        </div>
        <p className="lede rise text-center" style={{ animationDelay: "1200ms" }}>
          Certified hallway diplomat — that&apos;s where the surprise projects live.
        </p>
      </div>
    </>
  );
}

function SlidePulse({ d }: { d: WrappedPayload }) {
  return (
    <>
      <Blobs salt={10} />
      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <span className="kicker rise">your weekly pulse</span>
        <div className="eq" style={{ paddingTop: 8 }}>
          {d.weeklyActivity.map((v, i) => (
            <i key={i} style={{ height: `${Math.max(22, v)}%`, animationDelay: `${i * 110}ms`, animationDuration: `${900 + unit(i, 61) * 600}ms` }} />
          ))}
        </div>
        <h2 className="mega mega-md rise" style={{ animationDelay: "300ms" }}>12 weeks, zero dull stretches</h2>
        <div className="flex flex-wrap items-center justify-center gap-3 rise" style={{ animationDelay: "500ms" }}>
          {d.topCategories.map((c, i) => (
            <span key={c.label} className="wchip" style={{ animationDelay: `${600 + i * 150}ms` }}>
              {c.label} · {c.pct}%
            </span>
          ))}
        </div>
        <p className="lede rise text-center" style={{ animationDelay: "1200ms" }}>
          Peak you: <b>{d.claims.busiestWeekday}</b>. Night-owl check-ins: <b>{d.claims.nightOwlPct}%</b>. The quad basically knows your schedule.
        </p>
      </div>
    </>
  );
}

function SlideFinale({ d, onReplay, onExit }: { d: WrappedPayload; onReplay: () => void; onExit: () => void }) {
  const [copied, setCopied] = useState(false);
  const summary = [
    `${d.stats.eventsDiscovered} events discovered · ${d.stats.eventsAttended} attended`,
    `${d.stats.newConnections} new connections · ${d.stats.projects} projects · ${d.stats.clubsExplored} clubs · ${d.stats.alumniConversations} alumni chats`,
    `Campus personality: ${d.personality[0].label} (${d.personality.map((p) => `${p.label} ${p.share}%`).join(" · ")})`,
    `${d.crossDepartmentPct}% of event time outside the department — ${d.claims.rankTitle}`,
    "— my Campus Wrapped, via Campus Genie",
  ].join("\n");
  const stats = [
    { label: "discovered", value: d.stats.eventsDiscovered, delay: 200 },
    { label: "attended", value: d.stats.eventsAttended, delay: 320 },
    { label: "connections", value: d.stats.newConnections, delay: 440 },
    { label: "projects", value: d.stats.projects, delay: 560 },
    { label: "clubs", value: d.stats.clubsExplored, delay: 680 },
    { label: "alumni chats", value: d.stats.alumniConversations, delay: 800 },
  ];
  return (
    <>
      <ConfettiRain />
      <Blobs salt={11} />
      <div className="rays" style={{ opacity: 0.18 }} />
      <div className="relative z-10 flex max-w-[820px] flex-col items-center gap-6 text-center">
        <span className="kicker rise">that&apos;s a wrap on</span>
        <h1 className="mega mega-lg grad-text"><Letters text="SPRING ’26" base={150} /></h1>
        <div className="grid grid-cols-3 gap-4 rise" style={{ animationDelay: "500ms" }}>
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center rounded-2xl border border-white/40 bg-black/25 px-5 py-4 backdrop-blur">
              <span className="mega text-[clamp(26px,4.6vw,44px)] tabular-nums"><Count target={s.value} delay={s.delay} /></span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">{s.label}</span>
            </div>
          ))}
        </div>
        <span className="stamp rise" style={{ animationDelay: "1100ms", fontSize: "clamp(13px,2vw,18px)" }}>{d.claims.rankTitle}</span>
        <div className="flex flex-wrap items-center justify-center gap-3 rise" style={{ animationDelay: "1300ms" }}>
          <button
            type="button"
            className="pill-btn pill-btn-solid"
            onClick={() => {
              navigator.clipboard?.writeText(`My Campus Wrapped — ${d.term}\n${summary}`).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "✓ Copied!" : "Share my wrapped"}
          </button>
          <button type="button" className="pill-btn pill-btn-ghost" onClick={onReplay}>↻ Replay</button>
          <button type="button" className="pill-btn pill-btn-ghost" onClick={onExit}>Back to Campus Genie</button>
        </div>
        <p className="rise text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70" style={{ animationDelay: "1500ms" }}>
          compiled from {d.derivedFrom.join(" · ")}
        </p>
      </div>
    </>
  );
}

/* ── story engine ────────────────────────────────────────── */

export default function CampusWrapped() {
  const router = useRouter();
  const [payload, setPayload] = useState<WrappedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wrapped", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
        return res.json() as Promise<WrappedPayload>;
      })
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const total = 11; // intro + 9 story slides + finale
  const isLast = slide === total - 1;

  const go = useCallback((next: number) => {
    setSlide(Math.max(0, Math.min(total - 1, next)));
  }, [total]);

  useEffect(() => {
    if (!started || paused || isLast || !payload) return;
    const t = setTimeout(() => go(slide + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, started, paused, isLast, payload, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { setStarted(true); go(slide + 1); }
      if (e.key === "ArrowLeft") go(slide - 1);
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, go, router]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  if (error) {
    return (
      <div className="wrapped-scope sc-intro" style={{ display: "grid", placeItems: "center" }}>
        <div className="text-center">
          <h2 className="mega mega-md">Wrapped unavailable</h2>
          <p className="lede mx-auto text-center">{error}</p>
          <button type="button" className="pill-btn pill-btn-solid mt-6" onClick={() => router.push("/")}>Back to Campus Genie</button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="wrapped-scope sc-intro" style={{ display: "grid", placeItems: "center" }}>
        <div className="text-center">
          <h2 className="mega mega-md grad-text breathe">loading your semester…</h2>
        </div>
      </div>
    );
  }

  const begin = () => {
    if (!started) {
      setStarted(true);
      go(1);
      return;
    }
    go(slide + 1);
  };

  const slides: Array<React.ReactNode> = [
    <SlideIntro key="s0" d={payload} />,
    <SlideEvents key="s1" d={payload} />,
    <SlideAttend key="s2" d={payload} />,
    <SlideConnect key="s3" d={payload} />,
    <SlideProjects key="s4" d={payload} />,
    <SlideClubs key="s5" d={payload} />,
    <SlideAlumni key="s6" d={payload} />,
    <SlidePersona key="s7" d={payload} />,
    <SlideCross key="s8" d={payload} />,
    <SlidePulse key="s9" d={payload} />,
    <SlideFinale key="s10" d={payload} onReplay={() => { setSlide(0); setStarted(false); }} onExit={() => router.push("/")} />,
  ];

  const sceneClass = [
    "sc-intro", "sc-events", "sc-attend", "sc-connect", "sc-projects",
    "sc-clubs", "sc-alumni", "sc-persona", "sc-cross", "sc-pulse", "sc-finale",
  ][slide];

  const tags = [
    "the opening", "discovery", "showing up", "your people", "the builds", "the clubs",
    "alumni wisdom", "who you were", "the bubble report", "the pulse", "the finale",
  ];

  return (
    <div
      className="wrapped-scope"
      style={{ "--seg-play": paused ? "paused" : "running" } as React.CSSProperties}
      onPointerDown={() => {
        // long-press (hold) pauses; a quick tap falls through to the click zones
        holdTimer.current = setTimeout(() => setPaused(true), 260);
      }}
      onPointerUp={() => {
        if (holdTimer.current) clearTimeout(holdTimer.current);
        setPaused(false);
      }}
      onPointerCancel={() => {
        if (holdTimer.current) clearTimeout(holdTimer.current);
        setPaused(false);
      }}
      onClick={() => {
        // "tap anywhere to begin" on the intro; after that, zones handle nav
        if (!started) begin();
      }}
    >
      {/* scene */}
      <div className={`scene is-active ${sceneClass}`} key={slide}>
        <div className="grain" />
        <div className="vignette" />
        {slides[slide]}
      </div>

      {/* progress bars — keying the row on the slide restarts the active fill */}
      <div className="progress-row" key={`progress-${slide}`}>
        {slides.map((_, i) => {
          const cls = i < slide || (i === slide && isLast)
            ? "done"
            : i === slide && started
              ? "active"
              : "";
          return (
            <span key={i} className={`progress-seg ${cls}`}>
              {(cls === "active" || cls === "done") && (
                <i style={cls === "active" ? { animationDuration: `${SLIDE_MS}ms` } : undefined} />
              )}
            </span>
          );
        })}
      </div>

      {/* exit */}
      <button
        type="button"
        className="exit-btn"
        onClick={(e) => {
          e.stopPropagation();
          router.push("/");
        }}
      >
        ✕ exit wrapped <span style={{ opacity: 0.6 }}>esc</span>
      </button>

      {/* nav zones */}
      <div className="click-zone prev" onClick={() => go(slide - 1)} aria-label="Previous slide" role="button" tabIndex={-1} />
      <div className="click-zone next" onClick={begin} aria-label="Next slide" role="button" tabIndex={-1} />

      {/* slide tag */}
      <div className="slide-tag">
        {slide + 1} / {slides.length} · {tags[slide]} {paused ? "· paused ▮▮" : ""}
      </div>
    </div>
  );
}
