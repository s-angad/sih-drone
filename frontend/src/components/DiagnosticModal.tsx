"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, X, Send } from "lucide-react";
import { submitDiagnosis, AssessmentResponse } from "@/lib/api";
import AssessmentBreakdownView from "./AssessmentBreakdownView";

interface DiagnosticModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: { x: number; y: number } | null;
  onDiagnosisCompleted?: (result: AssessmentResponse) => void;
}

export default function DiagnosticModal({
  sessionId,
  isOpen,
  onClose,
  initialCoords,
  onDiagnosisCompleted,
}: DiagnosticModalProps) {
  const [hazardDetected, setHazardDetected] = useState(true);
  const [hazardType, setHazardType] = useState("pipe_gas_leak");
  const [estX, setEstX] = useState(initialCoords?.x ?? 10.5);
  const [estY, setEstY] = useState(initialCoords?.y ?? 3.2);
  const [estZ, setEstZ] = useState(1.8);
  const [severity, setSeverity] = useState("critical");
  const [safetyAction, setSafetyAction] = useState("isolate_valve");
  const [rationale, setRationale] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResponse | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        session_id: sessionId,
        hazard_detected: hazardDetected,
        suspected_hazard_type: hazardDetected ? hazardType : "none",
        estimated_position: hazardDetected ? { x: Number(estX), y: Number(estY), z: Number(estZ) } : null,
        reported_severity: hazardDetected ? severity : "normal",
        safety_decision: safetyAction,
        evidence_rationale: rationale,
      };

      const result = await submitDiagnosis(sessionId, payload);
      setAssessmentResult(result);
      if (onDiagnosisCompleted) {
        onDiagnosisCompleted(result);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit diagnosis");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-industrial-950 border border-industrial-700 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-industrial-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-tech-cyan/20 border border-tech-cyan/40 flex items-center justify-center text-tech-cyan">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                {assessmentResult ? "Competency Assessment Certification" : "Submit Diagnostic Finding"}
              </h3>
              <p className="text-xs text-slate-400 font-mono">Session ID: {sessionId.slice(0, 16)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-industrial-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 py-4 pr-1">
          {assessmentResult ? (
            <AssessmentBreakdownView assessment={assessmentResult} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Hazard Presence Toggle */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2 uppercase">
                  1. Diagnostic Conclusion: Was a Hazard Identified?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHazardDetected(true)}
                    className={`p-3 rounded-xl border text-center transition flex items-center justify-center gap-2 ${
                      hazardDetected
                        ? "bg-red-500/15 border-red-500/60 text-red-400 font-bold"
                        : "bg-industrial-900 border-industrial-800 text-slate-400 hover:bg-industrial-850"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    HAZARD IDENTIFIED
                  </button>
                  <button
                    type="button"
                    onClick={() => setHazardDetected(false)}
                    className={`p-3 rounded-xl border text-center transition flex items-center justify-center gap-2 ${
                      !hazardDetected
                        ? "bg-tech-green/15 border-tech-green/60 text-tech-green font-bold"
                        : "bg-industrial-900 border-industrial-800 text-slate-400 hover:bg-industrial-850"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-tech-green" />
                    SYSTEM NOMINAL / CLEAR
                  </button>
                </div>
              </div>

              {hazardDetected && (
                <>
                  {/* Anomaly Category */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 uppercase">
                      2. Hazard Classification
                    </label>
                    <select
                      value={hazardType}
                      onChange={(e) => setHazardType(e.target.value)}
                      className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-tech-cyan"
                    >
                      <option value="pipe_gas_leak">Combustible Methane Gas Leak (MQ-4 Flange)</option>
                      <option value="hot_spot_overheating">Mechanical/Bearing Thermal Runaway (Thermal IR)</option>
                      <option value="electrical_arcing">High-Voltage Electrical Arcing (UV Flame / Ozone)</option>
                      <option value="pipe_gas_leak">Carbon Monoxide Exhaust Infiltration (MQ-7)</option>
                    </select>
                  </div>

                  {/* Estimated Coordinates */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 uppercase">
                      3. Estimated Anomaly Coordinates (Meters)
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400">X (Width 0-20m)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={estX}
                          onChange={(e) => setEstX(parseFloat(e.target.value))}
                          className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Y (Length 0-15m)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={estY}
                          onChange={(e) => setEstY(parseFloat(e.target.value))}
                          className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-100"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Z (Height 0.5-4m)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={estZ}
                          onChange={(e) => setEstZ(parseFloat(e.target.value))}
                          className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 uppercase">
                      4. Severity Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["low", "medium", "critical"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSeverity(lvl)}
                          className={`py-2 rounded-lg border text-center uppercase font-mono transition ${
                            severity === lvl
                              ? lvl === "critical"
                                ? "bg-red-500/20 border-red-500 text-red-400 font-bold"
                                : "bg-amber-500/20 border-amber-500 text-amber-400 font-bold"
                              : "bg-industrial-900 border-industrial-800 text-slate-400"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Safety Action */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase">
                  5. Recommended Immediate Safety Mitigation
                </label>
                <select
                  value={safetyAction}
                  onChange={(e) => setSafetyAction(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-tech-cyan"
                >
                  <option value="isolate_valve">Isolate Primary Supply Valve & Lock-out Tag-out (LOTO)</option>
                  <option value="evacuate_area">Immediately Sound Alarm & Evacuate Workshop Bay</option>
                  <option value="scheduled_maintenance">Flag for Non-urgent Scheduled Maintenance</option>
                  <option value="clear_to_operate">Clear to Continue Normal Operations</option>
                </select>
              </div>

              {/* Rationale Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase">
                  6. Diagnostic Evidence & Sensor Observations
                </label>
                <textarea
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Detail sensor peak readings, stationary hover confirmation, plume direction, and physical equipment observed..."
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-tech-cyan font-mono"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Evaluating Against Ground Truth...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit Diagnosis & Lock Mission
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        {assessmentResult && (
          <div className="pt-4 border-t border-industrial-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-slate-200 font-mono text-xs uppercase"
            >
              Close Assessment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
