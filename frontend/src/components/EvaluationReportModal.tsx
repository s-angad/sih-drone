"use client";

import React, { useState } from "react";
import { 
  X, 
  Award, 
  FileText, 
  ExternalLink, 
  History, 
  RotateCcw, 
  Camera, 
  Volume2, 
  Eye
} from "lucide-react";
import { AssessmentResponse, getPrintableReportUrl } from "@/lib/api";

interface EvaluationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: any;
  assessment: AssessmentResponse | null;
  evidenceFrames: any[];
  announcements: any[];
  onReplayClick: () => void;
  onResetDemo: () => void;
}

export default function EvaluationReportModal({
  isOpen,
  onClose,
  sessionData,
  assessment,
  evidenceFrames,
  announcements,
  onReplayClick,
  onResetDemo
}: EvaluationReportModalProps) {
  const [selectedEnlargedImage, setSelectedEnlargedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalScore = assessment?.total_score || 95;
  const passed = assessment?.passed !== undefined ? assessment.passed : true;
  const breakdown: any = (assessment?.scoring_breakdown as any) || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-4xl w-full bg-industrial-900 border border-industrial-700 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-industrial-800 bg-industrial-950">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              passed ? "bg-tech-green/20 text-tech-green border border-tech-green/40" : "bg-red-500/20 text-red-400 border border-red-500/40"
            }`}>
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Final Diagnostic Inspection Report</h2>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                  passed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {passed ? "CERTIFIED PASSED" : "FAILED"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Session Code: {sessionData?.session_code || "SES-DEMO"} • Candidate: Alex Morgan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Top Score Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-industrial-950 via-industrial-900 to-industrial-950 border border-industrial-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Overall Competency Evaluation
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold ${passed ? "text-tech-green" : "text-red-400"}`}>
                  {totalScore}
                </span>
                <span className="text-slate-400 text-sm font-mono">/ 100 Points</span>
              </div>
              <p className="text-xs text-slate-300">
                {passed
                  ? "Trainee successfully identified the critical gas leak at Pipe Joint J-02 with sub-meter spatial precision and ordered immediate valve isolation."
                  : "Critical safety failure: Trainee failed to correctly isolate the explosive hazard or missed safety protocol."}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {sessionData?.id && (
                <a
                  href={getPrintableReportUrl(sessionData.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-tech-cyan text-industrial-950 font-bold text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:bg-cyan-400 transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Printable Report (HTML)</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}
            </div>
          </div>

          {/* Section 1: 5-Dimensional Competency Rubric */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center justify-between">
              <span>Vocational Competency Rubric Breakdown</span>
              <span className="text-[10px] text-slate-500 font-normal">ISO 17024 STANDARDS</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Dim 1 */}
              <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Hazard ID</span>
                <span className="text-base font-bold text-slate-100">
                  {breakdown.hazard_identification?.score ?? 30} / 30
                </span>
                <span className="text-[9px] text-tech-green block mt-1 font-mono">Combustible Methane</span>
              </div>

              {/* Dim 2 */}
              <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Location Precision</span>
                <span className="text-base font-bold text-slate-100">
                  {breakdown.location_accuracy?.score ?? 25} / 25
                </span>
                <span className="text-[9px] text-tech-green block mt-1 font-mono">Error: &lt; 0.3m</span>
              </div>

              {/* Dim 3 */}
              <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Flight Coverage</span>
                <span className="text-base font-bold text-slate-100">
                  {breakdown.inspection_coverage?.score ?? 15} / 15
                </span>
                <span className="text-[9px] text-tech-green block mt-1 font-mono">100% Corridor Survey</span>
              </div>

              {/* Dim 4 */}
              <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Evidence & Notes</span>
                <span className="text-base font-bold text-slate-100">
                  {breakdown.evidence_interpretation?.score ?? 15} / 15
                </span>
                <span className="text-[9px] text-tech-green block mt-1 font-mono">Hover Verified</span>
              </div>

              {/* Dim 5 */}
              <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Safety Mitigation</span>
                <span className="text-base font-bold text-slate-100">
                  {breakdown.safety_decision?.score ?? 15} / 15
                </span>
                <span className="text-[9px] text-tech-green block mt-1 font-mono">Line Isolated</span>
              </div>
            </div>
          </div>

          {/* Section 2: Mission Findings & Visual Evidence Snapshot */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Inspection Findings & Photographic Evidence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Finding Narrative */}
              <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-850 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Pipe Gas Leak (Natural Gas / Methane)</span>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[10px] uppercase font-bold">
                    CRITICAL SEVERITY
                  </span>
                </div>
                <div className="text-slate-400 text-xs space-y-1">
                  <p>• <strong>Location:</strong> Pipe Joint J-02 (Coordinates: X: 10.5m, Y: 3.2m, Z: 1.8m)</p>
                  <p>• <strong>Peak Intensity:</strong> 780.0 ADC counts on MQ-4 Gas Sensor</p>
                  <p>• <strong>Investigative Action:</strong> Executed stationary hover scan to confirm plume origin</p>
                  <p>• <strong>Safety Decision:</strong> Emergency isolation of Valve V-01 (Main Header)</p>
                </div>
              </div>

              {/* Visual Evidence Snapshot Gallery */}
              <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-850 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-tech-cyan" /> Visual Evidence Frame
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">ARCHIVED SNAPSHOT</span>
                </div>

                {evidenceFrames.length > 0 ? (
                  <div
                    className="relative rounded-lg overflow-hidden border border-industrial-800 cursor-pointer group"
                    onClick={() => setSelectedEnlargedImage(evidenceFrames[evidenceFrames.length - 1].image_data_url)}
                  >
                    <img
                      src={evidenceFrames[evidenceFrames.length - 1].image_data_url}
                      alt="Captured Evidence Frame"
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-2.5 py-1 rounded bg-tech-cyan text-industrial-950 text-[10px] font-bold flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Click to Enlarge
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 font-mono text-[11px] rounded bg-industrial-900 border border-industrial-850">
                    Evidence frame logged to session audit ledger.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Voice Announcements & Spoken Alert History */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-tech-cyan" /> Spoken Announcement Audit Ledger
            </h3>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {announcements.length > 0 ? (
                announcements.map((ann, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-industrial-950 border border-industrial-850 text-[11px] font-mono flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        ann.priority === "CRITICAL" || ann.priority === "critical"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {ann.priority || "WARNING"}
                      </span>
                      <span className="text-slate-300">{ann.message || ann.text}</span>
                    </div>
                    {ann.associated_asset_id && (
                      <span className="text-tech-cyan text-[10px] whitespace-nowrap">
                        {ann.associated_asset_id}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-slate-500 text-[11px]">
                  Voice announcements archived with session report.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-industrial-800 bg-industrial-950 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-slate-300 text-xs font-mono transition"
          >
            Close Report
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onClose();
                onReplayClick();
              }}
              className="px-4 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-tech-cyan font-mono text-xs font-bold flex items-center gap-1.5 transition"
            >
              <History className="w-3.5 h-3.5" /> Replay Flight
            </button>

            <button
              onClick={() => {
                onClose();
                onResetDemo();
              }}
              className="px-4 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-slate-200 font-mono text-xs font-bold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Demo
            </button>
          </div>
        </div>

        {/* Enlarged Image Pop-up */}
        {selectedEnlargedImage && (
          <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
            <div className="relative max-w-3xl w-full">
              <button
                onClick={() => setSelectedEnlargedImage(null)}
                className="absolute top-2 right-2 p-2 rounded-full bg-industrial-900 text-white z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={selectedEnlargedImage}
                alt="Enlarged Visual Evidence"
                className="w-full max-h-[80vh] object-contain rounded-xl border border-industrial-700"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
