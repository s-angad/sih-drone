"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertOctagon, Target, Map, Award, ShieldAlert, FileText } from "lucide-react";
import { AssessmentResponse } from "@/lib/api";

interface Props {
  assessment: AssessmentResponse;
}

export default function AssessmentBreakdownView({ assessment }: Props) {
  const {
    total_score,
    passed,
    safety_critical_failed,
    hazard_identification_score,
    location_accuracy_score,
    inspection_coverage_score,
    evidence_interpretation_score,
    safety_decision_score,
    mean_location_error_meters,
    inspection_coverage_pct,
    scoring_breakdown,
    instructor_feedback,
  } = assessment;

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Safety Critical Alert Banner */}
      {safety_critical_failed && (
        <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500 flex items-start gap-3 text-red-300">
          <AlertOctagon className="w-6 h-6 text-red-500 flex-shrink-0 animate-bounce" />
          <div>
            <h4 className="font-bold text-red-400 text-sm tracking-wider uppercase">
              SAFETY-CRITICAL ASSESSMENT BREACH
            </h4>
            <p className="text-xs text-red-200 mt-0.5">
              A safety-critical rule was violated (e.g. failing to isolate an active severe combustible gas leak).
              By occupational vocational standards, passing certification is denied regardless of aggregate score.
            </p>
            {scoring_breakdown?.critical_safety_notes?.map((n, i) => (
              <span key={i} className="block mt-1 font-semibold text-red-300">
                • {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Score Header */}
      <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">
            Standard Competency Score
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100">{total_score}</span>
            <span className="text-slate-500 text-sm">/ 100.0 PTS</span>
          </div>
        </div>

        <div>
          {passed ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tech-green/20 border border-tech-green/40 text-tech-green font-bold uppercase text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>COMPETENCY CERTIFIED</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold uppercase text-xs">
              <XCircle className="w-4 h-4" />
              <span>ASSESSMENT NOT PASSED</span>
            </div>
          )}
        </div>
      </div>

      {/* 5-Dimension Rubric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Hazard Identification */}
        <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-tech-cyan" /> 1. Hazard Identification
            </span>
            <span className="text-tech-cyan font-bold">{hazard_identification_score} / 30.0</span>
          </div>
          <ul className="text-[11px] text-slate-400 space-y-0.5">
            {scoring_breakdown?.hazard_identification?.notes?.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>

        {/* 2. Spatial Localization */}
        <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-tech-amber" /> 2. Location Accuracy
            </span>
            <span className="text-tech-amber font-bold">{location_accuracy_score} / 25.0</span>
          </div>
          <p className="text-[11px] text-slate-300 mb-0.5">
            Deviation Error: <span className="font-bold text-slate-100">{mean_location_error_meters}m</span>
          </p>
          <ul className="text-[11px] text-slate-400 space-y-0.5">
            {scoring_breakdown?.location_accuracy?.notes?.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>

        {/* 3. Inspection Coverage */}
        <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5 text-tech-blue" /> 3. Inspection Coverage
            </span>
            <span className="text-tech-blue font-bold">{inspection_coverage_score} / 15.0</span>
          </div>
          <p className="text-[11px] text-slate-300 mb-0.5">
            Envelope Surveyed: <span className="font-bold text-slate-100">{inspection_coverage_pct}%</span>
          </p>
          <ul className="text-[11px] text-slate-400 space-y-0.5">
            {scoring_breakdown?.inspection_coverage?.notes?.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>

        {/* 4. Evidence Interpretation */}
        <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-tech-cyan" /> 4. Evidence Interpretation
            </span>
            <span className="text-tech-cyan font-bold">{evidence_interpretation_score} / 15.0</span>
          </div>
          <ul className="text-[11px] text-slate-400 space-y-0.5">
            {scoring_breakdown?.evidence_interpretation?.notes?.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>

        {/* 5. Safety Decision */}
        <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800 md:col-span-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-tech-green" /> 5. Safety Decision & Mitigation
            </span>
            <span className="text-tech-green font-bold">{safety_decision_score} / 15.0</span>
          </div>
          <ul className="text-[11px] text-slate-400 space-y-0.5">
            {scoring_breakdown?.safety_decision?.notes?.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Instructor Feedback */}
      {instructor_feedback && (
        <div className="p-3 rounded-lg bg-industrial-900/60 border border-industrial-800">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Instructor / Automated Feedback
          </span>
          <p className="text-xs text-slate-300 italic">{instructor_feedback}</p>
        </div>
      )}
    </div>
  );
}
