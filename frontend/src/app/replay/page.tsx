"use client";

import React, { useState, useEffect } from "react";
import { 
  Download, 
  History, 
  Printer, 
  ExternalLink, 
  Volume2, 
  Camera, 
  ShieldAlert, 
  Sparkles, 
  Eye, 
  FileText, 
  X
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import WorkshopMap from "@/components/WorkshopMap";
import AssessmentBreakdownView from "@/components/AssessmentBreakdownView";
import { 
  getSessions, 
  getSessionReplay, 
  getExportCsvUrl, 
  getPrintableReportUrl,
  TrainingSession 
} from "@/lib/api";
import { audioController } from "@/utils/audioController";

export default function ReplayPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [replayData, setReplayData] = useState<any | null>(null);
  const [scrubberIndex, setScrubberIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "voice" | "sensors">("overview");
  const [selectedImageModal, setSelectedImageModal] = useState<any | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const ses = await getSessions();
        setSessions(ses);
        if (ses.length > 0) {
          setSelectedSessionId(ses[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSessions();
  }, []);

  const loadReplay = async (sId: string) => {
    if (!sId) return;
    try {
      const data = await getSessionReplay(sId);
      setReplayData(data);
      setScrubberIndex(data.trajectory ? data.trajectory.length - 1 : 0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadReplay(selectedSessionId);
    }
  }, [selectedSessionId]);

  const currentTrajectory = replayData?.trajectory
    ? replayData.trajectory.slice(0, scrubberIndex + 1)
    : [];

  const currentDronePos = currentTrajectory.length > 0
    ? currentTrajectory[currentTrajectory.length - 1]
    : { x: 2.0, y: 2.0, z: 1.5 };

  // Sensor chart points
  const chartData = (replayData?.sensor_timeline || []).slice(0, 150).map((pt: any) => ({
    seq: pt.seq,
    raw: pt.raw,
    calibrated: pt.calibrated,
    type: pt.type,
  }));

  const handlePrint = () => {
    window.print();
  };

  const handleReplayVoice = (ann: any) => {
    audioController.announce({
      text: ann.message,
      priority: (ann.priority || "info").toLowerCase() as "info" | "warning" | "critical",
      category: ann.category || "replay",
      associatedObjectId: ann.associated_asset_id,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/30">
              POST-FLIGHT AUDIT & MULTI-MODAL REPLAY
            </span>
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              VISION & VOICE ENABLED
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Flight Replay & Ground-Truth Verification</h1>
          <p className="text-xs text-slate-400">
            Scrub synchronized drone movement, visual evidence frames, synthesized voice announcements, and sensor signatures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-tech-cyan"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_code} — {s.status.toUpperCase()} ({s.trainee_name || "Trainee"})
              </option>
            ))}
          </select>

          {selectedSessionId && (
            <>
              {/* Printable HTML Audit Report */}
              <a
                href={getPrintableReportUrl(selectedSessionId)}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg bg-tech-cyan/20 border border-tech-cyan/40 hover:bg-tech-cyan/30 text-tech-cyan font-mono text-xs uppercase flex items-center gap-1.5 transition font-bold"
                title="Open Printable Executive Audit Report"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Executive Report (HTML)</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>

              {/* CSV Download */}
              <a
                href={getExportCsvUrl(selectedSessionId)}
                download
                className="px-3.5 py-2 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-200 font-mono text-xs uppercase flex items-center gap-1.5 transition"
                title="Download CSV Audit Telemetry"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </a>

              {/* Print Document */}
              <button
                onClick={handlePrint}
                className="p-2 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300 transition"
                title="Print Browser View"
              >
                <Printer className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {replayData ? (
        <div className="space-y-6">
          {/* Main Inspection Grid: 2D Workshop Map & Assessment Rubric */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Columns: Spatial Workshop Map + Timeline Scrubber */}
            <div className="lg:col-span-7 space-y-4">
              <WorkshopMap
                dronePosition={currentDronePos}
                headingDeg={currentDronePos.heading || 0}
                trajectory={currentTrajectory}
                hazards={replayData.hazard_events}
                groundTruthFaults={replayData.ground_truth_faults}
                interactive={false}
              />

              {/* Scrubber Timeline Bar */}
              {replayData.trajectory && replayData.trajectory.length > 0 && (
                <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <History className="w-3.5 h-3.5 text-tech-cyan" /> Synchronized Timeline Scrubber
                    </span>
                    <span className="text-tech-cyan font-bold">
                      Step {scrubberIndex + 1} of {replayData.trajectory.length} ({((scrubberIndex + 1) / replayData.trajectory.length * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={replayData.trajectory.length - 1}
                    value={scrubberIndex}
                    onChange={(e) => setScrubberIndex(parseInt(e.target.value))}
                    className="w-full accent-tech-cyan cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Pos: ({currentDronePos.x.toFixed(2)}m, {currentDronePos.y.toFixed(2)}m, {currentDronePos.z.toFixed(2)}m)</span>
                    <span>Heading: {Math.round(currentDronePos.heading || 0)}°</span>
                    <span>Speed: {currentDronePos.speed ? `${currentDronePos.speed.toFixed(2)} m/s` : "0.0 m/s"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 Columns: Assessment Rubric & Certification */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
                <h3 className="text-sm font-bold text-slate-100 font-mono uppercase mb-4 flex items-center justify-between">
                  <span>Competency Certification Rubric</span>
                  {replayData.assessment?.passed ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                      PASSED ({replayData.assessment.total_score}/100)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">
                      FAILED ({replayData.assessment?.total_score || 0}/100)
                    </span>
                  )}
                </h3>

                {replayData.assessment && replayData.assessment.scoring_breakdown ? (
                  <AssessmentBreakdownView
                    assessment={{
                      id: "rep-01",
                      session_id: replayData.session.id,
                      trainee_id: "t-01",
                      hazard_identification_score: replayData.assessment.scoring_breakdown.hazard_identification?.score || 0,
                      location_accuracy_score: replayData.assessment.scoring_breakdown.location_accuracy?.score || 0,
                      inspection_coverage_score: replayData.assessment.scoring_breakdown.inspection_coverage?.score || 0,
                      evidence_interpretation_score: replayData.assessment.scoring_breakdown.evidence_interpretation?.score || 0,
                      safety_decision_score: replayData.assessment.scoring_breakdown.safety_decision?.score || 0,
                      total_score: replayData.assessment.total_score || 0,
                      passed: replayData.assessment.passed || false,
                      safety_critical_failed: replayData.assessment.safety_critical_failed || false,
                      missed_hazards_count: 0,
                      false_positives_count: 0,
                      mean_location_error_meters: replayData.assessment.scoring_breakdown.location_accuracy?.error_meters || 0,
                      inspection_coverage_pct: replayData.assessment.scoring_breakdown.inspection_coverage?.coverage_pct || 0,
                      scoring_breakdown: replayData.assessment.scoring_breakdown,
                      instructor_feedback: replayData.assessment.instructor_feedback,
                      created_at: new Date().toISOString(),
                    }}
                  />
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs font-mono rounded-lg bg-industrial-950/60 border border-industrial-850">
                    <ShieldAlert className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
                    <span>Session in progress or completed without formal trainee submission.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Multi-Modal Tab Navigation */}
          <div className="flex border-b border-industrial-800 gap-2 font-mono text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "border-tech-cyan text-tech-cyan bg-industrial-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Multi-Modal Summary
            </button>

            <button
              onClick={() => setActiveTab("evidence")}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "evidence"
                  ? "border-tech-cyan text-tech-cyan bg-industrial-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Visual Evidence Frames ({replayData.evidence_frames?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("voice")}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "voice"
                  ? "border-tech-cyan text-tech-cyan bg-industrial-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Voice Announcements ({replayData.voice_announcements?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("sensors")}
              className={`px-4 py-2.5 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "sensors"
                  ? "border-tech-cyan text-tech-cyan bg-industrial-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Sensor Waveforms
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Evidence Snapshot Preview */}
              <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-100 font-mono uppercase flex items-center gap-2">
                    <Camera className="w-4 h-4 text-tech-cyan" /> Latest Captured Visual Evidence
                  </h4>
                  <button
                    onClick={() => setActiveTab("evidence")}
                    className="text-[11px] text-tech-cyan font-mono hover:underline"
                  >
                    View All ({replayData.evidence_frames?.length || 0}) →
                  </button>
                </div>

                {replayData.evidence_frames && replayData.evidence_frames.length > 0 ? (
                  <div className="relative rounded-lg overflow-hidden border border-industrial-800 bg-industrial-950 group">
                    <img
                      src={replayData.evidence_frames[replayData.evidence_frames.length - 1].image_data_url}
                      alt="Visual Evidence Frame"
                      className="w-full h-56 object-cover cursor-pointer hover:scale-[1.02] transition"
                      onClick={() => setSelectedImageModal(replayData.evidence_frames[replayData.evidence_frames.length - 1])}
                    />
                    <div className="absolute bottom-0 inset-x-0 p-2.5 bg-industrial-950/90 backdrop-blur-sm border-t border-industrial-800 text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-200 font-bold">
                        {replayData.evidence_frames[replayData.evidence_frames.length - 1].trigger_event || "Inspection Snapshot"}
                      </span>
                      {replayData.evidence_frames[replayData.evidence_frames.length - 1].associated_object_id && (
                        <span className="px-2 py-0.5 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-[10px] font-bold">
                          ASSET: {replayData.evidence_frames[replayData.evidence_frames.length - 1].associated_object_id}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs rounded-lg bg-industrial-950 border border-industrial-850">
                    <Camera className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    <span>No visual evidence snapshots captured during this mission.</span>
                  </div>
                )}
              </div>

              {/* Voice Announcements Preview */}
              <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-100 font-mono uppercase flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-tech-cyan" /> Recent Spoken Announcements
                  </h4>
                  <button
                    onClick={() => setActiveTab("voice")}
                    className="text-[11px] text-tech-cyan font-mono hover:underline"
                  >
                    View All ({replayData.voice_announcements?.length || 0}) →
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {replayData.voice_announcements && replayData.voice_announcements.length > 0 ? (
                    replayData.voice_announcements.slice(-4).reverse().map((ann: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-industrial-950 border border-industrial-800 text-xs font-mono flex items-start justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              ann.priority === "CRITICAL"
                                ? "bg-red-500/20 text-red-400"
                                : ann.priority === "WARNING"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-cyan-500/20 text-cyan-400"
                            }`}>
                              {ann.priority}
                            </span>
                            {ann.associated_asset_id && (
                              <span className="px-1.5 py-0.2 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-[10px]">
                                {ann.associated_asset_id}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 text-[11px] leading-relaxed">{ann.message}</p>
                        </div>

                        <button
                          onClick={() => handleReplayVoice(ann)}
                          className="p-1.5 rounded bg-industrial-800 hover:bg-industrial-700 text-slate-300 hover:text-white transition"
                          title="Replay Spoken Announcement"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-tech-cyan" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 font-mono text-xs rounded-lg bg-industrial-950 border border-industrial-850">
                      <Volume2 className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <span>No spoken announcements logged for this session.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL EVIDENCE GALLERY */}
          {activeTab === "evidence" && (
            <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">
                    Captured Drone Camera Evidence Frames ({replayData.evidence_frames?.length || 0})
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Visual frames stamped with drone 3D coordinates, camera orientation, and fused sensor metrics.
                  </p>
                </div>
              </div>

              {replayData.evidence_frames && replayData.evidence_frames.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {replayData.evidence_frames.map((ef: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden border border-industrial-800 bg-industrial-950 font-mono text-xs flex flex-col hover:border-tech-cyan/40 transition shadow-lg"
                    >
                      <div className="relative group cursor-pointer" onClick={() => setSelectedImageModal(ef)}>
                        <img
                          src={ef.image_data_url}
                          alt={`Evidence Frame ${idx + 1}`}
                          className="w-full h-44 object-cover"
                        />
                        <div className="absolute inset-0 bg-industrial-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-3 py-1 rounded-full bg-tech-cyan text-industrial-950 font-bold text-[11px] flex items-center gap-1 shadow-lg">
                            <Eye className="w-3.5 h-3.5" /> Enlarge Frame
                          </span>
                        </div>
                      </div>

                      <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-200">
                              {ef.trigger_event || `Evidence Frame #${idx + 1}`}
                            </span>
                            {ef.associated_object_id && (
                              <span className="px-2 py-0.5 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-[10px] font-bold">
                                {ef.associated_object_id}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 space-y-0.5">
                            <p>Drone: ({ef.drone_position?.x?.toFixed(2)}m, {ef.drone_position?.y?.toFixed(2)}m, {ef.drone_position?.z?.toFixed(2)}m)</p>
                            <p>Heading: {Math.round(ef.drone_heading || 0)}°</p>
                            {ef.timestamp && <p>Time: {new Date(ef.timestamp).toLocaleTimeString()}</p>}
                          </div>
                        </div>

                        {ef.fused_sensors && (
                          <div className="pt-2 border-t border-industrial-850 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                            {ef.fused_sensors.mq4_gas !== undefined && (
                              <span>MQ4: <strong className="text-slate-200">{Number(ef.fused_sensors.mq4_gas).toFixed(0)} ADC</strong></span>
                            )}
                            {ef.fused_sensors.thermal_degc !== undefined && (
                              <span>Temp: <strong className="text-slate-200">{Number(ef.fused_sensors.thermal_degc).toFixed(1)}°C</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 font-mono text-xs rounded-xl bg-industrial-950 border border-industrial-850">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <span>No visual evidence frames recorded. Capture frames during flight via the 3D Camera view.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VOICE ANNOUNCEMENTS LOG */}
          {activeTab === "voice" && (
            <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase">
                    Chronological Voice Announcement Ledger ({replayData.voice_announcements?.length || 0})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spoken hazard announcements, controller audible alarms, and trainee vectoring calls.
                  </p>
                </div>
              </div>

              {replayData.voice_announcements && replayData.voice_announcements.length > 0 ? (
                <div className="space-y-2.5">
                  {replayData.voice_announcements.map((va: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            va.priority === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : va.priority === "WARNING"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          }`}>
                            {va.priority}
                          </span>

                          <span className="text-[10px] text-slate-400 uppercase">
                            CAT: {va.category || "GENERAL"}
                          </span>

                          {va.associated_asset_id && (
                            <span className="px-1.5 py-0.2 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-[10px] font-bold">
                              ASSET: {va.associated_asset_id}
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400">
                            {va.timestamp ? new Date(va.timestamp).toLocaleTimeString() : `Seq #${idx + 1}`}
                          </span>
                        </div>

                        <p className="text-slate-200 text-xs leading-relaxed font-sans sm:font-mono">
                          {va.message}
                        </p>
                      </div>

                      <button
                        onClick={() => handleReplayVoice(va)}
                        className="px-3 py-1.5 rounded-lg bg-tech-cyan/10 hover:bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/30 flex items-center gap-1.5 transition text-xs font-bold whitespace-nowrap"
                        title="Synthesize Voice Announcement"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs rounded-xl bg-industrial-950 border border-industrial-850">
                  <Volume2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <span>No voice announcements recorded during this flight.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SENSOR WAVEFORMS */}
          {activeTab === "sensors" && (
            <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 font-mono uppercase">
                Chronological Sensor Waveforms (Time-Series Telemetry)
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="seq" stroke="#475569" fontSize={11} fontStyle="mono" />
                    <YAxis stroke="#475569" fontSize={11} fontStyle="mono" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0b0f19", borderColor: "#1e293b", fontSize: "12px", fontFamily: "monospace" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="raw" stroke="#06b6d4" strokeWidth={2} dot={false} name="Raw Reading (ADC/mV)" />
                    <Line type="monotone" dataKey="calibrated" stroke="#10b981" strokeWidth={2} dot={false} name="Calibrated Reading" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 font-mono text-xs">
          Loading replay telemetry...
        </div>
      )}

      {/* Enlarged Evidence Image Modal */}
      {selectedImageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-industrial-950 border border-industrial-800 rounded-2xl overflow-hidden shadow-2xl font-mono">
            <div className="flex items-center justify-between p-4 bg-industrial-900 border-b border-industrial-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-tech-cyan" />
                <span className="font-bold text-slate-100 text-sm">
                  {selectedImageModal.trigger_event || "Visual Evidence Frame"}
                </span>
                {selectedImageModal.associated_object_id && (
                  <span className="px-2 py-0.5 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-xs font-bold">
                    ASSET: {selectedImageModal.associated_object_id}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedImageModal(null)}
                className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <img
                src={selectedImageModal.image_data_url}
                alt="Enlarged Evidence Frame"
                className="w-full max-h-[65vh] object-contain rounded-lg border border-industrial-850 bg-black"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-industrial-900 p-3 rounded-xl border border-industrial-800">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Drone Coordinates</span>
                  <span className="text-slate-200 font-bold">
                    X: {selectedImageModal.drone_position?.x?.toFixed(2)}m, Y: {selectedImageModal.drone_position?.y?.toFixed(2)}m
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Altitude / Heading</span>
                  <span className="text-slate-200 font-bold">
                    Z: {selectedImageModal.drone_position?.z?.toFixed(2)}m • {Math.round(selectedImageModal.drone_heading || 0)}°
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Associated Asset</span>
                  <span className="text-tech-cyan font-bold">
                    {selectedImageModal.associated_object_id || "None (Visual Field)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Capture Timestamp</span>
                  <span className="text-slate-200 font-bold">
                    {selectedImageModal.timestamp ? new Date(selectedImageModal.timestamp).toLocaleTimeString() : "Recorded"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
