"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/atoms/Button";
import type { DynamicRecoveryPlan } from "@/app/api/attendance/recovery/route";

interface RecoveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseCode?: string;
  courseName?: string;
  instructor?: string;
  location?: string;
  scheduleTime?: string;
  currentSessions?: number;
  attendedSessions?: number;
  totalTermSessions?: number;
  cutoffPercentage?: number;
}

export default function RecoveryPlanModal({
  isOpen,
  onClose,
  courseCode = "MATH 201",
  courseName = "Linear Algebra",
  instructor = "Dr. Okafor",
  location = "Hart 112",
  scheduleTime = "Mon, Wed, Fri 09:00 AM",
  currentSessions = 20,
  attendedSessions = 14,
  totalTermSessions = 42,
  cutoffPercentage = 75,
}: RecoveryPlanModalProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<DynamicRecoveryPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Interactive Simulation Slider: sessions to attend out of remaining
  const remainingSessions = Math.max(1, totalTermSessions - currentSessions);
  const [simulatedRemainingAttended, setSimulatedRemainingAttended] = useState<number>(
    Math.min(remainingSessions, Math.max(1, Math.ceil(totalTermSessions * (cutoffPercentage / 100)) - attendedSessions))
  );

  // Action checklist toggles
  const [actionDoneState, setActionDoneState] = useState<Record<string, boolean>>({});
  const [excuseNoteBonus, setExcuseNoteBonus] = useState<boolean>(false);
  const [planApplied, setPlanApplied] = useState<boolean>(false);

  // Fetch dynamic AI recovery plan on open or course change
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);

    fetch("/api/attendance/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseCode,
        courseName,
        instructor,
        location,
        scheduleTime,
        currentSessions,
        attendedSessions,
        totalTermSessions,
        cutoffPercentage,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.plan) {
          setPlan(data.plan);
          setSimulatedRemainingAttended(data.plan.minRemainingToAttend || 18);
        }
      })
      .catch((err) => console.warn("Failed to generate dynamic recovery plan:", err))
      .finally(() => setIsLoading(false));
  }, [isOpen, courseCode, courseName, instructor, currentSessions, attendedSessions, totalTermSessions, cutoffPercentage, location, scheduleTime]);

  // Esc key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Real-time calculations
  const effectiveAttended = attendedSessions + (excuseNoteBonus ? 2 : 0);
  const projectedFinalAttended = effectiveAttended + simulatedRemainingAttended;
  const projectedPercentage = (projectedFinalAttended / totalTermSessions) * 100;
  const currentPercentage = (attendedSessions / currentSessions) * 100;
  const isEligible = projectedPercentage >= cutoffPercentage;
  const bufferSessions = projectedFinalAttended - Math.ceil(totalTermSessions * (cutoffPercentage / 100));

  const toggleAction = (id: string, category: string) => {
    setActionDoneState((prev) => {
      const next = !prev[id];
      if (category === "appeal") setExcuseNoteBonus(next);
      return { ...prev, [id]: next };
    });
  };

  const handleAskGenieStrategy = () => {
    const prompt = `Create an actionable attendance recovery and study schedule for ${courseCode} (${courseName}) with ${instructor}. Current attendance is ${currentPercentage.toFixed(1)}% (${attendedSessions}/${currentSessions} sessions), and I need to exceed the ${cutoffPercentage}% cutoff across the remaining ${remainingSessions} sessions.`;
    sessionStorage.setItem("cg_initial_prompt", prompt);
    router.push("/");
  };

  const handleApplyPlan = () => {
    setPlanApplied(true);
    setTimeout(() => {
      setPlanApplied(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 select-text animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-[14px] border border-line bg-surface p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        {/* Header Strip */}
        <div className="flex items-start justify-between border-b border-line pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-accent/40 bg-accent-tint text-accent font-mono text-[13px] font-bold">
              {courseCode.slice(0, 2)}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15.5px] font-semibold text-ink leading-tight">
                  {courseCode} · Recovery Plan
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium border ${
                    currentPercentage < cutoffPercentage
                      ? "bg-red-tint text-red border-red/20"
                      : "bg-green-tint text-green border-green/20"
                  }`}
                >
                  {currentPercentage < cutoffPercentage ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10.3 3.8 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>
                        <path d="M12 9v4M12 17h.01"/>
                      </svg>
                      At Risk ({currentPercentage.toFixed(0)}% vs {cutoffPercentage}% Cutoff)
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      On Track ({currentPercentage.toFixed(0)}%)
                    </>
                  )}
                </span>
                {plan?.generatedBy === "llm" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
                    <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                    AI-Tailored
                  </span>
                )}
              </div>
              <p className="text-[12px] text-ink-3 mt-0.5">
                {courseName} · {instructor} · {location} · {scheduleTime}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex size-7 items-center justify-center rounded-[7px] border border-line bg-canvas text-ink-3 hover:bg-hover hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <span className="size-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <span className="text-[13px] font-semibold text-ink">Generating Personalized Recovery Strategy…</span>
                <p className="text-[11.5px] text-ink-3">Analyzing course attendance logs and Databricks Lakehouse records</p>
              </div>
            </div>
          ) : (
            <>
              {/* Executive Summary */}
              {plan?.executiveSummary && (
                <div className="rounded-[10px] border border-accent/30 bg-accent-tint/20 p-3 text-[12.5px] text-ink leading-relaxed">
                  <span className="font-semibold text-accent block mb-0.5">Academic Advisor Diagnosis:</span>
                  {plan.executiveSummary}
                </div>
              )}

              {/* Status Gauge & Target Runway */}
              <div className="rounded-[12px] border border-line bg-field p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-accent" />
                    Attendance Runway &amp; Final Target
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {remainingSessions} sessions left in term
                  </span>
                </div>

                {/* Runway Progress Bar with 75% cutoff flag */}
                <div className="space-y-1.5">
                  <div className="relative h-3 w-full rounded-full bg-inset border border-line overflow-hidden">
                    {/* Current attendance fill */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-red transition-all duration-300"
                      style={{ width: `${(attendedSessions / totalTermSessions) * 100}%` }}
                    />
                    {/* Projected attendance fill */}
                    <div
                      className={`absolute top-0 bottom-0 transition-all duration-300 ${isEligible ? "bg-green" : "bg-orange"}`}
                      style={{
                        left: `${(attendedSessions / totalTermSessions) * 100}%`,
                        width: `${((projectedFinalAttended - attendedSessions) / totalTermSessions) * 100}%`,
                      }}
                    />
                    {/* Cutoff Marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                      style={{ left: `${cutoffPercentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-ink-3">Current: <b className="text-red">{currentPercentage.toFixed(0)}%</b> ({attendedSessions}/{currentSessions})</span>
                    <span className="text-ink-2 font-medium">Cutoff: <b>{cutoffPercentage}.0%</b> ({Math.ceil(totalTermSessions * (cutoffPercentage / 100))}/{totalTermSessions} sessions)</span>
                    <span className={isEligible ? "text-green font-semibold" : "text-orange font-semibold"}>
                      Projected: <b>{projectedPercentage.toFixed(1)}%</b> ({projectedFinalAttended}/{totalTermSessions})
                    </span>
                  </div>
                </div>

                {/* Eligibility summary alert */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-[8px] border text-[12px] ${
                    isEligible
                      ? "border-green/30 bg-green-tint/40 text-green"
                      : "border-red/30 bg-red-tint/40 text-red"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {isEligible ? "✓ Exam Eligibility Guaranteed" : "✕ Below Eligibility Cutoff"}
                    </span>
                    <span className="text-ink-2 font-normal text-[11.5px]">
                      {isEligible
                        ? `(Buffer: +${bufferSessions} session${bufferSessions !== 1 ? "s" : ""} over cutoff)`
                        : `(Needs ${Math.abs(bufferSessions)} more session${Math.abs(bufferSessions) !== 1 ? "s" : ""} attended)`}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-ink tabular-nums">
                    {projectedPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Interactive Simulation Slider */}
              <div className="rounded-[12px] border border-line bg-surface p-3.5 space-y-2.5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[12.5px] font-semibold text-ink block">
                      Simulate Remaining Sessions Attended
                    </label>
                    <span className="text-[11px] text-ink-3">
                      Adjust how many of the remaining {remainingSessions} lectures you plan to attend
                    </span>
                  </div>
                  <span className="font-mono text-[14px] font-bold text-accent px-2.5 py-0.5 rounded-[6px] bg-accent-tint border border-accent/30 tabular-nums">
                    {simulatedRemainingAttended} / {remainingSessions}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={remainingSessions}
                  step={1}
                  value={simulatedRemainingAttended}
                  onChange={(e) => setSimulatedRemainingAttended(parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg bg-inset border border-line appearance-none cursor-pointer accent-accent"
                />

                <div className="flex justify-between text-[10.5px] text-ink-3 font-mono">
                  <span>Min required: {plan?.minRemainingToAttend ?? 18}/{remainingSessions} ({cutoffPercentage}%)</span>
                  <span>Safe target: {Math.min(remainingSessions, (plan?.minRemainingToAttend ?? 18) + 2)}/{remainingSessions}</span>
                  <span>Perfect: {remainingSessions}/{remainingSessions} ({plan?.projectedMaxPct ?? 86}%)</span>
                </div>
              </div>

              {/* Action Steps Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">
                    4-Step Recovery Action Checklist
                  </span>
                  <span className="text-[11px] text-ink-3 font-mono">Interactive Tasks</span>
                </div>

                <div className="space-y-2">
                  {(plan?.actionItems || []).map((item) => {
                    const isDone = Boolean(actionDoneState[item.id]);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-[10px] border border-line bg-surface shadow-card transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold ${
                              isDone ? "bg-green text-white" : "bg-accent-tint text-accent"
                            }`}
                          >
                            {isDone ? "✓" : item.stepNumber}
                          </span>
                          <div>
                            <h4 className="text-[12.5px] font-semibold text-ink">{item.title}</h4>
                            <p className="text-[11.5px] text-ink-3">{item.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAction(item.id, item.category)}
                          className={`h-7 px-2.5 rounded-[7px] text-[11.5px] font-medium transition-colors shrink-0 cursor-pointer ${
                            isDone
                              ? "bg-green-tint text-green border border-green/30"
                              : "bg-field text-ink-2 hover:bg-hover hover:text-ink border border-line"
                          }`}
                        >
                          {isDone ? item.actionDoneLabel : item.actionButtonLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructor Strategy & Office Hours Box */}
              {plan?.instructorStrategy && (
                <div className="rounded-[10px] border border-line bg-inset p-3 space-y-1.5 text-[12px]">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Office Hours Protocol · {instructor} ({plan.instructorStrategy.officeHoursSlot})
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-ink-2 text-[11.5px]">
                    {plan.instructorStrategy.talkingPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-ink-3 pt-1 border-t border-line/60">
                    <b>Policy Note:</b> {plan.instructorStrategy.makeupPolicyNote}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-line shrink-0">
          <button
            type="button"
            onClick={handleAskGenieStrategy}
            className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline cursor-pointer"
          >
            <span>Ask Genie for Custom Study Strategy</span>
            <span>→</span>
          </button>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyPlan}
              className="flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {planApplied ? "✓ Plan Activated!" : "Apply Recovery Plan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
