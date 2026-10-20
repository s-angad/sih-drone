"use client";

import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";

export type GuidedStage = "takeoff" | "inspect" | "detect" | "investigate" | "assess";

interface GuidedMissionProgressProps {
  currentStage: GuidedStage;
  onStepClick?: (stage: GuidedStage) => void;
  className?: string;
}

const STAGES: Array<{ key: GuidedStage; number: number; label: string; shortDesc: string }> = [
  { key: "takeoff", number: 1, label: "Takeoff", shortDesc: "Drone system boots & takes flight" },
  { key: "inspect", number: 2, label: "Inspect", shortDesc: "Surveying pipeline corridors" },
  { key: "detect", number: 3, label: "Detect", shortDesc: "Gas sensor crosses warning limit" },
  { key: "investigate", number: 4, label: "Investigate", shortDesc: "Adaptive hover & evidence capture" },
  { key: "assess", number: 5, label: "Assess", shortDesc: "100-pt rubric grading & report" },
];

export default function GuidedMissionProgress({
  currentStage,
  onStepClick,
  className = ""
}: GuidedMissionProgressProps) {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className={`p-3.5 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-lg ${className}`}>
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 sm:pb-0">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;

          return (
            <React.Fragment key={stage.key}>
              <button
                onClick={() => onStepClick && onStepClick(stage.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all text-left flex-shrink-0 ${
                  isActive
                    ? "bg-tech-cyan text-industrial-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105"
                    : isCompleted
                    ? "bg-industrial-850 text-tech-green border border-tech-green/30 hover:bg-industrial-800"
                    : "bg-industrial-950 text-slate-500 border border-industrial-850 hover:text-slate-400"
                }`}
                title={stage.shortDesc}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive
                    ? "bg-industrial-950 text-tech-cyan"
                    : isCompleted
                    ? "bg-tech-green/20 text-tech-green"
                    : "bg-industrial-850 text-slate-400"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : stage.number}
                </span>

                <div className="flex flex-col">
                  <span className="leading-tight">{stage.label}</span>
                  <span className={`text-[9px] font-normal leading-tight hidden lg:block ${
                    isActive ? "text-industrial-900" : isCompleted ? "text-slate-400" : "text-slate-600"
                  }`}>
                    {stage.shortDesc}
                  </span>
                </div>
              </button>

              {idx < STAGES.length - 1 && (
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                  idx < currentIdx ? "text-tech-green/60" : "text-industrial-700"
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
