"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Battery, 
  Wifi, 
  Gauge, 
  AlertTriangle, 
  Compass, 
  CheckCircle, 
  Sparkles,
  Clock,
  Map as MapIcon,
  Video,
  Columns
} from "lucide-react";
import WorkshopMap from "@/components/WorkshopMap";
import SensorCard from "@/components/SensorCard";
import DiagnosticModal from "@/components/DiagnosticModal";
import DroneCameraView from "@/components/DroneCameraView";
import AudioVoicePanel from "@/components/AudioVoicePanel";
import { audioController } from "@/utils/audioController";
import { 
  getMissions, 
  getTrainees, 
  createSession, 
  startSession, 
  pauseSession, 
  resumeSession, 
  setSessionWaypoint,
  recordDecision,
  connectTelemetryWebSocket,
  captureEvidenceFrame,
  Mission, 
  Trainee, 
  TrainingSession, 
  TelemetryFrame, 
  HazardEvent, 
  ReinspectionRecommendation,
  AssessmentResponse
} from "@/lib/api";

export default function LiveMissionControlPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);

  // View Mode: 2d_map | 3d_fpv | split
  const [viewMode, setViewMode] = useState<"2d_map" | "3d_fpv" | "split">("2d_map");

  // Live Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [flightTrajectory, setFlightTrajectory] = useState<Array<{ x: number; y: number; z: number }>>([]);
  const [hazards, setHazards] = useState<HazardEvent[]>([]);
  const [recommendations, setRecommendations] = useState<ReinspectionRecommendation[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<{ x: number; y: number } | null>(null);
  const [visibleObjects, setVisibleObjects] = useState<any[]>([]);
  const [fusionResult, setFusionResult] = useState<any | null>(null);

  // Mission State
  const [isFlightActive, setIsFlightActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDiagModalOpen, setIsDiagModalOpen] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResponse | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const [ms, ts] = await Promise.all([getMissions(), getTrainees()]);
        setMissions(ms);
        setTrainees(ts);
        if (ms.length > 0) setSelectedMissionId(ms[0].id);
        if (ts.length > 0) setSelectedTraineeId(ts[0].id);
      } catch (e) {
        console.error("Failed to load missions or trainees", e);
      }
    }
    loadData();
  }, []);

  // Timer tick for active mission
  useEffect(() => {
    if (isFlightActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isFlightActive, isPaused]);

  // Selected mission object
  const activeMission = missions.find((m) => m.id === selectedMissionId);

  // Start a new flight training session
  const handleStartMission = async () => {
    if (!selectedMissionId || !selectedTraineeId) return;

    try {
      // 1. Create session in DB
      const session = await createSession({
        mission_id: selectedMissionId,
        trainee_id: selectedTraineeId,
        data_source: "simulation",
      });
      setCurrentSession(session);

      // 2. Start simulation
      await startSession(session.id);
      setIsFlightActive(true);
      setIsPaused(false);
      setElapsedSeconds(0);
      setFlightTrajectory([]);
      setHazards([]);
      setRecommendations([]);
      setVisibleObjects([]);
      setFusionResult(null);
      setAssessmentResult(null);

      // Announcement: Mission Initiated
      audioController.announce({
        text: `Mission started for trainee. Drone pre-flight checks complete.`,
        priority: "info",
        category: "flight",
      });

      // 3. Connect real-time WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }

      wsRef.current = connectTelemetryWebSocket(
        session.id,
        (data) => {
          if (data.type === "TELEMETRY" && data.frame) {
            const frame: TelemetryFrame = data.frame;
            setTelemetry(frame);

            // Append trajectory
            if (frame.position) {
              setFlightTrajectory((prev) => [
                ...prev,
                { x: frame.position.x, y: frame.position.y, z: frame.position.z },
              ]);
            }

            // Append new hazards
            if (data.hazards && data.hazards.length > 0) {
              setHazards((prev) => {
                const existingIds = new Set(prev.map((h) => `${h.position_x}_${h.position_y}_${h.sensor_type}`));
                const fresh = data.hazards.filter(
                  (h: any) => !existingIds.has(`${h.position_x || h.position?.x}_${h.position_y || h.position?.y}_${h.sensor_type}`)
                );
                return [...prev, ...fresh];
              });
            }

            // Append recommendations
            if (data.recommendations && data.recommendations.length > 0) {
              setRecommendations(data.recommendations);
            }

            // Vision observations & fusion
            if (data.vision) {
              if (data.vision.observations) {
                setVisibleObjects(data.vision.observations);
              }
              if (data.vision.fused_correlations && data.vision.fused_correlations.length > 0) {
                setFusionResult(data.vision.fused_correlations[0]);
              }
            }

            // Process Spoken Announcements from Backend Fusion Engine
            if (data.announcements && data.announcements.length > 0) {
              data.announcements.forEach((ann: any) => {
                const prio = (ann.priority || "info").toLowerCase() as "info" | "warning" | "critical";
                audioController.announce({
                  text: ann.message,
                  priority: prio,
                  category: ann.category,
                  associatedObjectId: ann.associated_asset_id,
                });
              });
            }
          } else if (data.type === "SESSION_STATUS" && data.status === "completed") {
            setIsFlightActive(false);
          }
        },
        (err) => console.error("WS error:", err),
        () => console.log("WS closed")
      );
    } catch (e: any) {
      console.error("Start mission error:", e);
      alert(`Could not start mission: ${e.message}`);
    }
  };

  const handlePauseMission = async () => {
    if (!currentSession) return;
    try {
      await pauseSession(currentSession.id);
      setIsPaused(true);
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ action: "pause" }));
      }
      audioController.announce({
        text: "Mission paused by operator. Drone hovering in station.",
        priority: "info",
        category: "flight",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResumeMission = async () => {
    if (!currentSession) return;
    try {
      await resumeSession(currentSession.id);
      setIsPaused(false);
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ action: "resume" }));
      }
      audioController.announce({
        text: "Mission resumed. Telemetry active.",
        priority: "info",
        category: "flight",
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Trainee clicks map to target waypoint or pinpoint coords
  const handleMapClick = async (coords: { x: number; y: number }) => {
    setSelectedCoords(coords);
    if (currentSession && isFlightActive && !isPaused) {
      try {
        await setSessionWaypoint(currentSession.id, { x: coords.x, y: coords.y, z: 1.8 });
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({ action: "steer", x: coords.x, y: coords.y, z: 1.8 }));
        }
      } catch (e) {
        console.error("Waypoint error:", e);
      }
    }
  };

  // Trainee executes adaptive reinspection action
  const handleExecuteRecommendation = async (rec: ReinspectionRecommendation) => {
    if (!currentSession) return;
    try {
      // 1. Log decision
      await recordDecision(currentSession.id, {
        action_type: rec.action_type,
        target_x: rec.target_x,
        target_y: rec.target_y,
        evidence_notes: `Executed adaptive recommendation: ${rec.title}`,
      });

      // 2. If stationary hover or waypoint, steer drone there
      if (rec.target_x !== undefined && rec.target_y !== undefined) {
        await setSessionWaypoint(currentSession.id, {
          x: rec.target_x,
          y: rec.target_y,
          z: rec.target_z || 1.8,
        });
      }

      // Voice acknowledgement
      audioController.announce({
        text: `Executing adaptive reinspection maneuver. Vectoring drone to target location.`,
        priority: "warning",
        category: "flight",
      });

      // Remove from active list
      setRecommendations((prev) => prev.filter((r) => r.title !== rec.title));
    } catch (e) {
      console.error(e);
    }
  };

  // Capture visual evidence snapshot from 3D camera
  const handleCameraSnapshot = async (dataUrl: string, metadata: any) => {
    if (!currentSession) {
      alert("Please start a session before capturing evidence frames.");
      return;
    }
    try {
      await captureEvidenceFrame(currentSession.id, {
        frame_base64: dataUrl,
        drone_x: telemetry?.position?.x || 2.0,
        drone_y: telemetry?.position?.y || 2.0,
        drone_z: telemetry?.position?.z || 1.8,
        drone_heading: telemetry?.heading_deg || 0,
        camera_pitch: -15,
        annotation_label: hazards.length > 0 ? `Hazard: ${hazards[0].rule_name}` : "Visual Inspection Frame",
        associated_asset_id: metadata?.associatedObjectId || null,
        fused_telemetry: telemetry || {},
      });
      audioController.announce({
        text: "Evidence frame captured and logged to session audit ledger.",
        priority: "info",
        category: "evidence",
      });
    } catch (e) {
      console.error("Evidence capture failed", e);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Mission Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-industrial-900 border border-industrial-800 shadow-lg">
        {/* Left: Mission / Trainee Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase">Select Mission</label>
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              disabled={isFlightActive}
              className="bg-industrial-950 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-tech-cyan disabled:opacity-60"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.trade})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase">Trainee</label>
            <select
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              disabled={isFlightActive}
              className="bg-industrial-950 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-tech-cyan disabled:opacity-60"
            >
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.trainee_code})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block pl-2 border-l border-industrial-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Flight Time</span>
            <span className="text-sm font-bold font-mono text-tech-cyan flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {formatTime(elapsedSeconds)}
            </span>
          </div>
        </div>

        {/* Center: View Switcher (2D Map vs 3D FPV Camera vs Split) */}
        <div className="flex items-center bg-industrial-950 p-1 rounded-xl border border-industrial-800 font-mono text-xs">
          <button
            onClick={() => setViewMode("2d_map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "2d_map"
                ? "bg-tech-cyan text-industrial-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="2D Top-Down Workshop Layout Map"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">2D Map</span>
          </button>

          <button
            onClick={() => setViewMode("3d_fpv")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "3d_fpv"
                ? "bg-tech-cyan text-industrial-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="3D Live Drone FPV Camera with Computer Vision"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden md:inline">3D Drone FPV</span>
          </button>

          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "split"
                ? "bg-tech-cyan text-industrial-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Dual Split: Synchronized 3D FPV & 2D Map"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Split Tactical</span>
          </button>
        </div>

        {/* Right: Simulation Controls & Diagnostic Action */}
        <div className="flex items-center gap-2.5">
          {!isFlightActive ? (
            <button
              onClick={handleStartMission}
              className="px-4 py-2 rounded-xl bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition"
            >
              <Play className="w-4 h-4 fill-current" /> Start Inspection Flight
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={handleResumeMission}
                  className="px-3.5 py-2 rounded-xl bg-tech-green/20 border border-tech-green/40 hover:bg-tech-green/30 text-tech-green font-mono text-xs uppercase flex items-center gap-1.5 transition"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              ) : (
                <button
                  onClick={handlePauseMission}
                  className="px-3.5 py-2 rounded-xl bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-slate-300 font-mono text-xs uppercase flex items-center gap-1.5 transition"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}

              <button
                onClick={() => setIsDiagModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse transition"
              >
                <AlertTriangle className="w-4 h-4" /> Submit Diagnosis
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Operational Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Columns: Visual & Spatial Display (2D Map, 3D FPV, or Split) */}
        <div className="lg:col-span-7 space-y-4">
          {viewMode === "2d_map" && (
            <WorkshopMap
              layout={activeMission?.environment_layout}
              dronePosition={telemetry?.position}
              headingDeg={telemetry?.heading_deg}
              trajectory={flightTrajectory}
              hazards={hazards}
              onMapClick={handleMapClick}
              selectedCoords={selectedCoords}
              interactive={true}
            />
          )}

          {viewMode === "3d_fpv" && (
            <div className="relative rounded-2xl overflow-hidden border border-industrial-800 bg-industrial-950">
              <DroneCameraView
                dronePosition={telemetry?.position || { x: 2.0, y: 2.0, z: 1.8 }}
                headingDeg={telemetry?.heading_deg || 0}
                pitchDeg={telemetry?.camera_pitch_deg || -15}
                batteryPct={telemetry?.battery_pct || 100}
                speedMps={telemetry?.speed_mps || 0}
                isSimulated={true}
                linkQuality={telemetry?.link_quality_pct || 100}
                activeHazards={hazards}
                visibleObjects={visibleObjects}
                fusionResult={fusionResult}
                onSnapshot={handleCameraSnapshot}
                className="w-full h-[520px]"
              />
            </div>
          )}

          {viewMode === "split" && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-industrial-800 bg-industrial-950">
                <DroneCameraView
                  dronePosition={telemetry?.position || { x: 2.0, y: 2.0, z: 1.8 }}
                  headingDeg={telemetry?.heading_deg || 0}
                  pitchDeg={telemetry?.camera_pitch_deg || -15}
                  batteryPct={telemetry?.battery_pct || 100}
                  speedMps={telemetry?.speed_mps || 0}
                  isSimulated={true}
                  linkQuality={telemetry?.link_quality_pct || 100}
                  activeHazards={hazards}
                  visibleObjects={visibleObjects}
                  fusionResult={fusionResult}
                  onSnapshot={handleCameraSnapshot}
                  className="w-full h-[360px]"
                />
              </div>

              <WorkshopMap
                layout={activeMission?.environment_layout}
                dronePosition={telemetry?.position}
                headingDeg={telemetry?.heading_deg}
                trajectory={flightTrajectory}
                hazards={hazards}
                onMapClick={handleMapClick}
                selectedCoords={selectedCoords}
                interactive={true}
              />
            </div>
          )}

          {/* Drone Telemetry Gauges Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Battery */}
            <div className="p-3 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase mb-1">
                <span>LiPo Battery</span>
                <Battery className="w-3.5 h-3.5 text-tech-green" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {telemetry ? `${telemetry.battery_pct.toFixed(1)}%` : "100.0%"}
              </div>
              <div className="w-full h-1.5 bg-industrial-950 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-tech-green rounded-full"
                  style={{ width: `${telemetry ? telemetry.battery_pct : 100}%` }}
                />
              </div>
            </div>

            {/* Altitude */}
            <div className="p-3 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase mb-1">
                <span>Hover Altitude</span>
                <Compass className="w-3.5 h-3.5 text-tech-cyan" />
              </div>
              <div className="text-xl font-bold text-tech-cyan">
                {telemetry ? `${telemetry.position.z.toFixed(2)}m` : "1.80m"}
              </div>
              <span className="text-[10px] text-slate-400">Target: 1.8m AGL</span>
            </div>

            {/* Flight Speed */}
            <div className="p-3 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase mb-1">
                <span>Ground Speed</span>
                <Gauge className="w-3.5 h-3.5 text-tech-blue" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {telemetry ? `${telemetry.speed_mps.toFixed(2)} m/s` : "0.0 m/s"}
              </div>
              <span className="text-[10px] text-slate-400">Max: 1.2 m/s</span>
            </div>

            {/* Comm Link Quality */}
            <div className="p-3 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase mb-1">
                <span>Telemetry Link</span>
                <Wifi className="w-3.5 h-3.5 text-tech-green" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {telemetry ? `${telemetry.link_quality_pct.toFixed(0)}%` : "100%"}
              </div>
              <span className="text-[10px] text-tech-green">2.4 GHz RF Link</span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Sensor Telemetry, Adaptive Reinspection, Voice & Hazard Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real-Time Sensor Telemetry Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center justify-between">
              <span>Live Sensor Payload Array</span>
              <span className="text-[10px] text-tech-cyan font-normal">SIMULATED SENSORS</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {telemetry?.sensors && telemetry.sensors.length > 0 ? (
                telemetry.sensors.map((s, idx) => (
                  <SensorCard key={idx} reading={s} />
                ))
              ) : (
                <>
                  <SensorCard reading={{ sensor_type: "mq4_gas", raw_value: 215.0, calibrated_value: 25.0, unit: "ADC_counts", sensor_health: "nominal" }} />
                  <SensorCard reading={{ sensor_type: "mq7_co", raw_value: 195.0, calibrated_value: 14.0, unit: "ADC_counts", sensor_health: "nominal" }} />
                  <SensorCard reading={{ sensor_type: "thermal_ir", raw_value: 24.8, calibrated_value: 24.8, unit: "degC", sensor_health: "nominal" }} />
                  <SensorCard reading={{ sensor_type: "uv_flame", raw_value: 2.1, calibrated_value: 2.1, unit: "uW/cm2", sensor_health: "nominal" }} />
                </>
              )}
            </div>
          </div>

          {/* Voice Announcements & Audio Controller Panel */}
          <AudioVoicePanel className="max-h-64" />

          {/* Adaptive Reinspection Recommendation Panel */}
          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-tech-cyan" /> Adaptive Reinspection Engine
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tech-cyan/20 text-tech-cyan">
                RULE-BASED AI
              </span>
            </div>

            <div className="space-y-2.5">
              {recommendations.length > 0 ? (
                recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-tech-cyan/40 transition text-xs font-mono"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-100">{rec.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                        rec.priority === "urgent"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                      {rec.reason}
                    </p>
                    <button
                      onClick={() => handleExecuteRecommendation(rec)}
                      className="w-full py-1.5 rounded bg-industrial-800 hover:bg-industrial-700 text-tech-cyan font-bold text-[11px] uppercase transition"
                    >
                      Command Drone Reinspection
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs font-mono rounded-lg bg-industrial-950/60 border border-industrial-850">
                  <CheckCircle className="w-5 h-5 mx-auto text-tech-green/80 mb-1" />
                  <span>No sensor anomalies or ambiguous readings requiring adaptive reinspection at this time.</span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamped Live Anomaly Feed with Fused Asset Badging */}
          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-tech-amber" /> Live Hazard Log ({hazards.length})
              </span>
              {fusionResult && fusionResult.associated_object_id && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                  CORRELATED: {fusionResult.associated_object_id}
                </span>
              )}
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs font-mono">
              {hazards.length > 0 ? (
                hazards.slice(-6).reverse().map((h, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-industrial-950 border border-industrial-800 flex items-start justify-between gap-2 text-[11px]"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold uppercase ${
                          h.severity === "critical" ? "text-red-400" : "text-amber-400"
                        }`}>
                          [{h.severity}] {h.rule_name}
                        </span>
                        {h.associated_object_id && (
                          <span className="px-1.5 py-0.2 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan text-[9px] font-bold">
                            ASSET: {h.associated_object_id}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[10px] mt-0.5">{h.details}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {h.timestamp ? new Date(h.timestamp).toLocaleTimeString() : "LIVE"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-[11px]">
                  No active hazard exceedances logged.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {assessmentResult && (
        <div className="p-4 rounded-xl bg-industrial-900 border border-tech-green/40 flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-tech-green" />
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase">Mission Completed & Graded</h4>
              <p className="text-xs text-slate-400">Score: {assessmentResult.total_score}/100 • Status: {assessmentResult.passed ? "PASSED" : "FAILED"}</p>
            </div>
          </div>
          <a href={`/replay?sessionId=${currentSession?.id}`} className="text-xs text-tech-cyan hover:underline">
            Open Full Session Replay & Audit →
          </a>
        </div>
      )}

      {/* Trainee Diagnostic Submission Modal */}
      {currentSession && (
        <DiagnosticModal
          sessionId={currentSession.id}
          isOpen={isDiagModalOpen}
          initialCoords={selectedCoords}
          onClose={() => setIsDiagModalOpen(false)}
          onDiagnosisCompleted={(result) => {
            setAssessmentResult(result);
            setIsFlightActive(false);
          }}
        />
      )}
    </div>
  );
}
