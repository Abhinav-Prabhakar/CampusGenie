"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import type { CurrentUser } from "@/lib/useCurrentUser";
import { initialsFor, setCurrentUserCached } from "@/lib/useCurrentUser";
import "@/app/profile.css";

function buildVCard(user: CurrentUser): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${user.lastName ?? ""};${user.firstName ?? ""};;;`,
    `FN:${user.fullName}`,
  ];
  if (user.phoneNumber) lines.push(`TEL;TYPE=CELL:${user.phoneNumber}`);
  if (user.email) lines.push(`EMAIL;TYPE=INTERNET:${user.email}`);
  if (user.college) lines.push(`ORG:${user.college}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

type QrMatrix = { size: number; modules: Uint8Array };

function buildMatrix(text: string): QrMatrix | null {
  if (!text) return null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    return { size: qr.modules.size, modules: qr.modules.data };
  } catch (err) {
    console.warn("[ContactQrCard] QR generation failed:", err);
    return null;
  }
}

function QrSvg({ matrix }: { matrix: QrMatrix }) {
  const quiet = 2;
  const total = matrix.size + quiet * 2;
  // path-per-row keeps the markup tiny even for dense versions
  const rows: string[] = [];
  for (let y = 0; y < matrix.size; y++) {
    let run = -1;
    for (let x = 0; x <= matrix.size; x++) {
      const dark = x < matrix.size && matrix.modules[y * matrix.size + x];
      if (dark && run === -1) run = x;
      if (!dark && run !== -1) {
        rows.push(`M${run + quiet} ${y + quiet}h${x - run}v1h-${x - run}z`);
        run = -1;
      }
    }
  }
  return (
    <svg
      className="vqr-svg"
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Contact QR code — scan to save details"
    >
      <rect width={total} height={total} fill="oklch(0.985 0.001 286.376)" />
      <path d={rows.join("")} fill="oklch(0.209 0.004 264.477)" />
    </svg>
  );
}

export default function ContactQrCard({ user }: { user: CurrentUser | null }) {
  const vcard = useMemo(() => (user ? buildVCard(user) : ""), [user]);
  const matrix = useMemo(() => buildMatrix(vcard), [vcard]);
  // Local edit buffer, valid only for the loaded account (same pattern as the
  // role override in ProfileView — avoids state-sync effects).
  const [phoneEdit, setPhoneEdit] = useState<{ userId: string; value: string } | null>(null);
  const phoneDraft = phoneEdit && phoneEdit.userId === user?.userId ? phoneEdit.value : (user?.phoneNumber ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const savePhone = async () => {
    if (!user || saveState === "saving") return;
    const phone = phoneDraft.trim();
    setSaveState("saving");
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.length > 0 ? phone : null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed");
      const data = await res.json();
      setCurrentUserCached(data.user ?? { ...user, phoneNumber: phone || null });
      setSaveState("saved");
    } catch {
      setSaveState("error");
      return;
    }
    setTimeout(() => setSaveState("idle"), 2400);
  };

  const sharedRows: Array<{ icon: string; label: string; value: string }> = [
    { icon: "i-id", label: "Name", value: user?.fullName ?? "—" },
    { icon: "i-msg", label: "Phone", value: user?.phoneNumber || "not set" },
    { icon: "i-mail", label: "Email", value: user?.email ?? "—" },
    { icon: "i-building", label: "College", value: user?.college ?? "Databricks University" },
  ];

  return (
    <section className="card" style={{ "--i": 1 } as React.CSSProperties}>
      <div className="ch">
        <span className="cic" style={{ "--t": "var(--green)" } as React.CSSProperties}>
          <svg className="i i13" aria-hidden="true"><use href="#i-qr"/></svg>
        </span>
        <h3>Share contact</h3>
        <span className="act"><span className="pill pill-quiet"><svg className="i i11" aria-hidden="true"><use href="#i-arr"/></svg>Scan-to-save</span></span>
      </div>
      <div className="cb">
        <div className="vqr-wrap">
          <div className="vqr-frame">
            <span className="vbr b1" aria-hidden="true" />
            <span className="vbr b2" aria-hidden="true" />
            <span className="vbr b3" aria-hidden="true" />
            <span className="vbr b4" aria-hidden="true" />
            <span className="vqr-scan" aria-hidden="true" />
            {matrix ? (
              <QrSvg matrix={matrix} />
            ) : (
              <span className="vqr-svg" style={{ display: "block" }} aria-hidden="true" />
            )}
            <span className="vqr-badge" title={user?.fullName ?? "You"}>
              {initialsFor(user)}
              <svg className="i" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2.5 L14 9 l6.5 2 L14 13 l-2 6.5 L10 13 l-6.5 -2 L10 9 l2 -6.5 Z" />
              </svg>
            </span>
          </div>

          <div className="vqr-side">
            <div className="rows">
              {sharedRows.map((row) => (
                <div className="row" key={row.label}>
                  <span className="ic"><svg className="i i12" aria-hidden="true"><use href={`#${row.icon}`}/></svg></span>
                  <div>
                    <div className="k">{row.label}</div>
                    <div className="v" style={!user?.phoneNumber && row.label === "Phone" ? { color: "var(--ink-3)" } : undefined}>
                      {row.label === "Phone" && !user?.phoneNumber ? "Add your number →" : row.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="vqr-edit">
              <span className="ic"><svg className="i i12" aria-hidden="true"><use href="#i-msg"/></svg></span>
              <input
                className="fld vqr-input"
                type="tel"
                inputMode="tel"
                placeholder="+91 98…  your phone"
                value={phoneDraft}
                aria-label="Phone number shared via QR"
                onChange={(e) => user && setPhoneEdit({ userId: user.userId, value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && savePhone()}
              />
              <button
                type="button"
                className="conn"
                onClick={savePhone}
                disabled={saveState === "saving" || !user}
                style={saveState === "saved" ? { background: "var(--green-tint)", color: "var(--green)", borderColor: "transparent" } : undefined}
              >
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "Save"}
              </button>
            </div>
            {saveState === "error" && <div className="vqr-err">Save failed — try again.</div>}
          </div>
        </div>

        <div className="gn">
          <svg className="i i13" aria-hidden="true"><use href="#i-qr"/></svg>
          <span>Classmates scan this with their camera to save you straight to contacts — name, phone, and email. No typing, no airdrops. Stored in <b>app_users.delta</b>.</span>
        </div>
      </div>
    </section>
  );
}
