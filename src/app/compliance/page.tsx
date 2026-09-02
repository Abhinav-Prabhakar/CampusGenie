"use client";

import { useState, type FormEvent } from "react";
import SidebarNav from "@/components/primitives/SidebarNav";
import KeyboardShortcutsModal from "@/components/shortcuts/KeyboardShortcutsModal";
import EventIcons from "@/components/events/EventIcons";
import { Button } from "@/components/atoms/Button";
import { StatusPill } from "@/components/atoms/StatusPill";
import { Switch } from "@/components/atoms/Switch";
import { useTheme } from "@/lib/theme";

/* ─────────────────────────────────────────────────────────
 * TYPES & CATEGORIES
 * ───────────────────────────────────────────────────────── */

type UrgencyLevel = "low" | "medium" | "high" | "urgent";

interface SubmittedComplaint {
  id: string;
  title: string;
  category: string;
  location: string;
  urgency: UrgencyLevel;
  description: string;
  isAnonymous: boolean;
  submittedAt: string;
}

const COMPLAINT_CATEGORIES = [
  "Academic & Coursework",
  "Campus Facilities & Maintenance",
  "Hostel & Residential Life",
  "Dining & Cafeteria Services",
  "Administration & Registrar",
  "IT, Lab & Library Resources",
  "Safety, Security & Accessibility",
  "Other / General Grievance",
] as const;

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { label: string; tone: "green" | "neutral" | "orange" | "red"; description: string; dotClass: string; activeBorder: string }
> = {
  low: {
    label: "Low",
    tone: "green",
    description: "General suggestion or minor non-blocking issue",
    dotClass: "bg-green shadow-[0_0_8px_rgba(34,197,94,0.4)]",
    activeBorder: "border-green/50 bg-green-tint/15 shadow-[0_0_12px_rgba(34,197,94,0.15)]",
  },
  medium: {
    label: "Medium",
    tone: "neutral",
    description: "Noticeable issue impacting regular campus activities",
    dotClass: "bg-[#4d8eff] shadow-[0_0_8px_rgba(77,142,255,0.4)]",
    activeBorder: "border-[#4d8eff]/50 bg-accent-tint/15 shadow-[0_0_12px_rgba(77,142,255,0.15)]",
  },
  high: {
    label: "High",
    tone: "orange",
    description: "Significant barrier requiring timely attention",
    dotClass: "bg-orange shadow-[0_0_8px_rgba(249,115,22,0.4)]",
    activeBorder: "border-orange/50 bg-orange-tint/15 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
  },
  urgent: {
    label: "Urgent",
    tone: "red",
    description: "Critical blocker or time-sensitive concern",
    dotClass: "bg-red shadow-[0_0_8px_rgba(239,68,68,0.4)]",
    activeBorder: "border-red/50 bg-red-tint/15 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
  },
};

/* ─────────────────────────────────────────────────────────
 * COMPLIANT BOX (STUDENT GRIEVANCE SUBMISSION)
 * ───────────────────────────────────────────────────────── */

export default function CompliancePage() {
  const { isDark, toggleTheme } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Form State
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("medium");
  const [description, setDescription] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);

  // Validation State
  const [errors, setErrors] = useState<{
    title?: string;
    category?: string;
    description?: string;
  }>({});
  const [touched, setTouched] = useState<{
    title?: boolean;
    category?: boolean;
    description?: boolean;
  }>({});

  // Submission / Success State (Frontend-Only)
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedComplaint | null>(null);
  const [submissions, setSubmissions] = useState<SubmittedComplaint[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const validate = () => {
    const nextErrors: { title?: string; category?: string; description?: string } = {};

    if (!title.trim()) {
      nextErrors.title = "Grievance title is required.";
    } else if (title.trim().length < 5) {
      nextErrors.title = "Title must be at least 5 characters.";
    }

    if (!category) {
      nextErrors.category = "Please select a complaint category.";
    }

    if (!description.trim()) {
      nextErrors.description = "Detailed description is required.";
    } else if (description.trim().length < 15) {
      nextErrors.description = "Please provide more details (at least 15 characters).";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, category: true, description: true });

    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const newSubmission: SubmittedComplaint = {
        id: `local-${Date.now()}`,
        title: title.trim(),
        category,
        location: location.trim() || "General campus location",
        urgency,
        description: description.trim(),
        isAnonymous,
        submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setSubmissions((prev) => [newSubmission, ...prev]);
      setLastSubmitted(newSubmission);
      setIsSubmitting(false);

      // Reset form fields
      setTitle("");
      setCategory("");
      setLocation("");
      setUrgency("medium");
      setDescription("");
      setIsAnonymous(false);
      setErrors({});
      setTouched({});
    }, 220);
  };

  const handleReset = () => {
    setTitle("");
    setCategory("");
    setLocation("");
    setUrgency("medium");
    setDescription("");
    setIsAnonymous(false);
    setErrors({});
    setTouched({});
  };

  return (
    <main className="flex h-[100dvh] w-full gap-0 bg-canvas p-2.5 text-ink lg:pl-0 select-none">
      <SidebarNav
        fill
        className="hidden lg:flex"
        activeTitle="Compliant Box"
        activeNav="compliance"
        footerLabel="Profile"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-canvas shadow-card">
          {/* Header */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3 sm:px-4 bg-surface/80 backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13.5px] font-semibold text-ink">Campus Genie</span>
              <span className="text-[12px] text-ink-3">/</span>
              <span className="text-[12.5px] font-medium text-ink-2 truncate">Compliant Box</span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-line bg-inset px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-ink-3">
                <span className="size-1.5 rounded-full bg-[#4d8eff] animate-pulse" />
                STUDENT GRIEVANCE DESK
              </span>
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

          {/* Main Body */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas p-4 md:p-6">
            <div className="mx-auto max-w-[1100px] space-y-6">
              {/* Page Introduction */}
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
                    Student Grievance &amp; Complaint Box
                  </h1>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    Submit campus concerns, facilities reports, or academic suggestions during your active session.
                  </p>
                </div>
                <StatusPill tone="neutral">Session Active</StatusPill>
              </div>

              {/* Grid: Form Column + Information / Local History Column */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* ── Form Container (7 Columns) ───────────────────── */}
                <div className="lg:col-span-7">
                  {lastSubmitted ? (
                    /* Success Confirmation State */
                    <div className="relative overflow-hidden rounded-[14px] border border-line bg-surface/85 p-6 shadow-raised backdrop-blur-md space-y-4">
                      {/* Top Glacier Glow Accent */}
                      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#4d8eff]/50 to-transparent" />

                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-green-tint text-green shadow-[0_0_12px_rgba(34,197,94,0.25)]">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[15px] font-semibold text-ink tracking-[-0.015em]">
                            Grievance Recorded Locally
                          </h2>
                          <p className="mt-0.5 text-[12.5px] text-ink-2 leading-relaxed">
                            Your complaint has been validated and recorded in your local browser session.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[10px] border border-line bg-canvas/90 p-4 space-y-3 text-[12.5px]">
                        <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                          <span className="text-ink-3">Title</span>
                          <span className="font-semibold text-ink truncate max-w-[260px]">{lastSubmitted.title}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                          <span className="text-ink-3">Category</span>
                          <span className="text-ink font-medium">{lastSubmitted.category}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                          <span className="text-ink-3">Location / Dept</span>
                          <span className="text-ink font-medium">{lastSubmitted.location}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                          <span className="text-ink-3">Urgency Level</span>
                          <StatusPill tone={URGENCY_CONFIG[lastSubmitted.urgency].tone}>
                            {URGENCY_CONFIG[lastSubmitted.urgency].label}
                          </StatusPill>
                        </div>
                        <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                          <span className="text-ink-3">Identity Mode</span>
                          <span className="text-ink-2">
                            {lastSubmitted.isAnonymous ? "Anonymous Submission" : "Profile Identity Included"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-ink-3">Logged Time</span>
                          <span className="font-mono text-ink-3 tabular-nums">{lastSubmitted.submittedAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLastSubmitted(null)}
                          className="w-full sm:w-auto"
                        >
                          Submit Another Grievance
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Submission Form */
                    <form
                      onSubmit={handleSubmit}
                      noValidate
                      className="relative overflow-hidden rounded-[14px] border border-line bg-surface/85 p-5 sm:p-6 shadow-raised backdrop-blur-md space-y-5"
                    >
                      {/* Top Glacier Glow Accent */}
                      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#4d8eff]/40 to-transparent" />

                      <div className="border-b border-line pb-3.5">
                        <h2 className="text-[15px] font-semibold text-ink tracking-[-0.01em]">
                          New Complaint Submission
                        </h2>
                        <p className="mt-0.5 text-[12px] text-ink-3">
                          Fill out the details below. All fields marked with an asterisk are required.
                        </p>
                      </div>

                      {/* Complaint Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="complaint-title" className="text-[12.5px] font-medium text-ink-2">
                            Grievance Title <span className="text-red">*</span>
                          </label>
                          <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                            {title.length}/100
                          </span>
                        </div>
                        <input
                          id="complaint-title"
                          type="text"
                          maxLength={100}
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            if (touched.title) validate();
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, title: true }));
                            validate();
                          }}
                          placeholder="e.g., Broken HVAC in Chemistry Lab 302"
                          className={`h-[52px] w-full rounded-[8px] border bg-field/75 px-3.5 text-[13.5px] text-ink placeholder:text-ink-3 outline-none transition-all duration-150 ${
                            touched.title && errors.title
                              ? "border-red focus:border-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                              : "border-line focus:border-[#4d8eff] focus:shadow-[0_0_0_3px_rgba(77,142,255,0.25)]"
                          }`}
                        />
                        {touched.title && errors.title && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-red">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.title}
                          </p>
                        )}
                      </div>

                      {/* Category & Location Row */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Category */}
                        <div>
                          <label htmlFor="complaint-category" className="block mb-1.5 text-[12.5px] font-medium text-ink-2">
                            Category <span className="text-red">*</span>
                          </label>
                          <select
                            id="complaint-category"
                            value={category}
                            onChange={(e) => {
                              setCategory(e.target.value);
                              if (touched.category) validate();
                            }}
                            onBlur={() => {
                              setTouched((prev) => ({ ...prev, category: true }));
                              validate();
                            }}
                            className={`h-[52px] w-full rounded-[8px] border bg-field/75 px-3 text-[13px] text-ink outline-none transition-all duration-150 ${
                              touched.category && errors.category
                                ? "border-red focus:border-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                                : "border-line focus:border-[#4d8eff] focus:shadow-[0_0_0_3px_rgba(77,142,255,0.25)]"
                            }`}
                          >
                            <option value="" disabled>
                              Select category...
                            </option>
                            {COMPLAINT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          {touched.category && errors.category && (
                            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-red">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              {errors.category}
                            </p>
                          )}
                        </div>

                        {/* Location / Department */}
                        <div>
                          <label htmlFor="complaint-location" className="block mb-1.5 text-[12.5px] font-medium text-ink-2">
                            Location / Department
                          </label>
                          <input
                            id="complaint-location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Kemper Hall · Lab 210"
                            className="h-[52px] w-full rounded-[8px] border border-line bg-field/75 px-3.5 text-[13.5px] text-ink placeholder:text-ink-3 outline-none focus:border-[#4d8eff] focus:shadow-[0_0_0_3px_rgba(77,142,255,0.25)] transition-all duration-150"
                          />
                        </div>
                      </div>

                      {/* Urgency Selection */}
                      <div>
                        <label className="block mb-2 text-[12.5px] font-medium text-ink-2">
                          Urgency Level
                        </label>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          {(["low", "medium", "high", "urgent"] as UrgencyLevel[]).map((lvl) => {
                            const config = URGENCY_CONFIG[lvl];
                            const isSelected = urgency === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setUrgency(lvl)}
                                className={`flex flex-col items-center justify-center rounded-[8px] border p-2.5 text-center transition-all duration-150 cursor-pointer ${
                                  isSelected
                                    ? config.activeBorder
                                    : "border-line bg-field/50 text-ink-3 hover:border-line-strong hover:text-ink-2 hover:bg-field/80"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                                  <span className={`size-2 rounded-full ${config.dotClass}`} />
                                  {config.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[11.5px] text-ink-3">
                          {URGENCY_CONFIG[urgency].description}
                        </p>
                      </div>

                      {/* Description */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="complaint-desc" className="text-[12.5px] font-medium text-ink-2">
                            Description &amp; Specific Details <span className="text-red">*</span>
                          </label>
                          <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                            {description.length}/500
                          </span>
                        </div>
                        <textarea
                          id="complaint-desc"
                          rows={4}
                          maxLength={500}
                          value={description}
                          onChange={(e) => {
                            setDescription(e.target.value);
                            if (touched.description) validate();
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, description: true }));
                            validate();
                          }}
                          placeholder="Provide factual details, dates, equipment IDs, or steps already taken to resolve the issue…"
                          className={`w-full rounded-[8px] border bg-field/75 p-3.5 text-[13px] text-ink placeholder:text-ink-3 outline-none resize-none leading-relaxed transition-all duration-150 ${
                            touched.description && errors.description
                              ? "border-red focus:border-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                              : "border-line focus:border-[#4d8eff] focus:shadow-[0_0_0_3px_rgba(77,142,255,0.25)]"
                          }`}
                        />
                        {touched.description && errors.description && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-red">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {errors.description}
                          </p>
                        )}
                      </div>

                      {/* Anonymous Submission Switch */}
                      <div className="flex items-center justify-between rounded-[10px] border border-line bg-canvas/70 p-3.5 backdrop-blur-sm">
                        <div className="pr-3">
                          <span className="block text-[13px] font-medium text-ink">
                            Anonymous Submission
                          </span>
                          <span className="block text-[11.5px] text-ink-3">
                            Do not attach my name or student email to this report.
                          </span>
                        </div>
                        <Switch
                          checked={isAnonymous}
                          onChange={setIsAnonymous}
                          label="Toggle anonymous submission"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleReset}
                          disabled={isSubmitting}
                        >
                          Clear Form
                        </Button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          style={{
                            background: "linear-gradient(135deg, #4d8eff, #0267b8)",
                            boxShadow: "0 2px 10px rgba(77, 142, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                          }}
                          className="relative inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-5 text-[13.5px] font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(77,142,255,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Processing…</span>
                            </>
                          ) : (
                            <span>Submit Grievance</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* ── Side Information & Session History (5 Columns) ── */}
                <div className="space-y-4 lg:col-span-5">
                  {/* Grievance Guidelines Card */}
                  <div className="rounded-[12px] border border-line bg-surface/80 p-4 shadow-card backdrop-blur-md space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-[6px] bg-accent-tint text-[#4d8eff]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                      <h3 className="text-[13px] font-semibold text-ink">Submission Guidelines</h3>
                    </div>

                    <ul className="space-y-2.5 text-[12px] text-ink-2 leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-[#4d8eff] mt-1.5 shrink-0" />
                        <span>
                          <strong className="text-ink font-medium">Factual Details:</strong> Providing exact building names, room numbers, or equipment details helps clarify reports.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-[#4d8eff] mt-1.5 shrink-0" />
                        <span>
                          <strong className="text-ink font-medium">Clear Summaries:</strong> Concise titles and step-by-step descriptions make reports easier to review.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-[#4d8eff] mt-1.5 shrink-0" />
                        <span>
                          <strong className="text-ink font-medium">Session Scope:</strong> Submissions made on this page are stored locally in your active browser session.
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Local Session Grievances Card */}
                  <div className="rounded-[12px] border border-line bg-surface/80 p-4 shadow-card backdrop-blur-md space-y-3">
                    <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-[5px] bg-inset text-ink-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
                            <polyline points="8.5 12.5 11 15 15.5 9.5" />
                          </svg>
                        </span>
                        <h3 className="text-[13px] font-semibold text-ink">Session Submissions</h3>
                      </div>
                      <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                        {submissions.length} {submissions.length === 1 ? "entry" : "entries"}
                      </span>
                    </div>

                    {submissions.length === 0 ? (
                      /* Empty State */
                      <div className="py-7 text-center">
                        <span className="mx-auto flex size-9 items-center justify-center rounded-[9px] bg-inset text-ink-3 mb-2.5 shadow-hairline">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
                            <polyline points="8.5 12.5 11 15 15.5 9.5" />
                          </svg>
                        </span>
                        <p className="text-[12.5px] font-medium text-ink-2">No grievances submitted yet</p>
                        <p className="mt-1 text-[11.5px] text-ink-3 max-w-[240px] mx-auto leading-normal">
                          Grievances submitted during this browser session will appear here.
                        </p>
                      </div>
                    ) : (
                      /* List of Submitted Items in Session */
                      <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                        {submissions.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-[8px] border border-line bg-canvas/80 p-3 space-y-1.5 transition-colors hover:border-line-strong"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12.5px] font-semibold text-ink truncate">
                                {item.title}
                              </span>
                              <StatusPill tone={URGENCY_CONFIG[item.urgency].tone}>
                                {URGENCY_CONFIG[item.urgency].label}
                              </StatusPill>
                            </div>

                            <p className="text-[12px] text-ink-2 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>

                            <div className="flex items-center justify-between pt-1.5 border-t border-line-soft text-[11px] text-ink-3">
                              <span className="truncate max-w-[160px]">{item.category}</span>
                              <span className="font-mono tabular-nums">{item.submittedAt}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
        onOpen={() => setShortcutsOpen(true)}
      />
    </main>
  );
}
