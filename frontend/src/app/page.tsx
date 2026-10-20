"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  RotateCcw, 
  HelpCircle, 
  Sparkles, 
  Radar, 
  Volume2, 
  VolumeX,
  FileText,
  Clock,
  Map as MapIcon,
  Video,
  X
} from "lucide-react";

import DroneCameraView from "@/components/DroneCameraView";
import WorkshopMap from "@/components/WorkshopMap";
import GuidedMissionProgress, { GuidedStage } from "@/components/GuidedMissionProgress";
import SimpleSensorPanel from "@/components/SimpleSensorPanel";
import DroneFindingsFeed, { FindingEvent } from "@/components/DroneFindingsFeed";
import SensorVisionFusionCard from "@/components/SensorVisionFusionCard";
import HowItWorksModal from "@/components/HowItWorksModal";
import ExplainConceptModal, { ConceptKey } from "@/components/ExplainConceptModal";
import EvaluationReportModal from "@/components/EvaluationReportModal";

import { 
  getMissions, 
  getTrainees, 
  createSession, 
  startSession, 
  setSessionWaypoint, 
  recordDecision, 
  submitDiagnosis, 
  captureEvidenceFrame,
  connectTelemetryWebSocket,
  TelemetryFrame,
  AssessmentResponse,
  Mission,
  Trainee,
  TrainingSession
} from "@/lib/api";
import { audioController } from "@/utils/audioController";

export default function HomePage() {
  // Demo Lifecycle: "ready" | "running" | "completed"
  const [simulationState, setSimulationState] = useState<"ready" | "running" | "completed">("ready");
  const [currentStage, setCurrentStage] = useState<GuidedStage>("takeoff");
  
  // Real Backend Data
  const [missions, setMissions] = useState<Mission[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [flightTrajectory, setFlightTrajectory] = useState<Array<{ x: number; y: number; z: number }>>([]);
  const [visibleObjects, setVisibleObjects] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResponse | null>(null);
  const [evidenceFrames, setEvidenceFrames] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Findings Events
  const [findingsEvents, setFindingsEvents] = useState<FindingEvent[]>([]);

  // Visual View Mode inside simulation (3D Camera vs 2D Map)
  const [cameraMode, setCameraMode] = useState<"3d_camera" | "2d_map">("3d_camera");

  // Timers & State Machine
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStepBanner, setActiveStepBanner] = useState<{
    stepNum: number;
    title: string;
    description: string;
  } | null>(null);

  // Audio State
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [activeConceptModal, setActiveConceptModal] = useState<ConceptKey | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Refs for orchestration & WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageLockRef = useRef<{
    hasSeenAsset: boolean;
    hasDetectedHazard: boolean;
    hasInvestigated: boolean;
    hasAssessed: boolean;
  }>({
    hasSeenAsset: false,
    hasDetectedHazard: false,
    hasInvestigated: false,
    hasAssessed: false,
  });

  // Load Seed Mission & Trainee on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [ms, ts] = await Promise.all([getMissions(), getTrainees()]);
        setMissions(ms);
        setTrainees(ts);
      } catch (e) {
        console.error("Failed to load missions or trainees", e);
      }
    }
    loadData();

    // Check AudioController state
    setIsAudioEnabled(audioController.getAudioEnabled());
    setIsMuted(audioController.getMuted());
    const unsub = audioController.subscribe(() => {
      setIsAudioEnabled(audioController.getAudioEnabled());
      setIsMuted(audioController.getMuted());
    });
    return () => unsub();
  }, []);

  // Timer tick for running simulation
  useEffect(() => {
    if (simulationState === "running") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simulationState]);

  // Helper to add Finding Events
  const addFinding = (event: Omit<FindingEvent, "id">) => {
    const id = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setFindingsEvents((prev) => [...prev, { ...event, id }]);
  };

  // Helper to trigger Step Notification Banner
  const showStepBanner = (stepNum: number, title: string, description: string) => {
    setActiveStepBanner({ stepNum, title, description });
    setTimeout(() => {
      setActiveStepBanner((curr) => (curr?.stepNum === stepNum ? null : curr));
    }, 6500);
  };

  // -------------------------------------------------------------
  // START GUIDED SIMULATION (One Prominent Button Trigger)
  // -------------------------------------------------------------
  const handleStartGuidedSimulation = async () => {
    try {
      // 1. Enable Browser Audio if possible
      await audioController.enableAudio();

      // Reset orchestration locks
      stageLockRef.current = {
        hasSeenAsset: false,
        hasDetectedHazard: false,
        hasInvestigated: false,
        hasAssessed: false,
      };

      setFindingsEvents([]);
      setEvidenceFrames([]);
      setAnnouncements([]);
      setHazards([]);
      setFlightTrajectory([]);
      setAssessmentResult(null);
      setElapsedSeconds(0);
      setCurrentStage("takeoff");
      setSimulationState("running");

      // 2. Select default Mission (MSN-GAS-01) and Trainee (TR-2026-001)
      const targetMissionId = missions.length > 0 ? missions[0].id : "m-01";
      const targetTraineeId = trainees.length > 0 ? trainees[0].id : "t-01";

      // 3. Create Session in Database
      const session = await createSession({
        mission_id: targetMissionId,
        trainee_id: targetTraineeId,
        data_source: "simulation",
      });
      setCurrentSession(session);

      // 4. Start Simulation on Backend
      await startSession(session.id);

      // Stage 1 Notification
      showStepBanner(
        1,
        "Step 1 of 5 — Inspection Started",
        "The drone has taken off and is surveying the workshop pipeline corridor."
      );
      addFinding({
        timestamp: "00:01",
        category: "flight",
        text: "The drone has taken off and started surveying the natural gas pipeline.",
        severity: "normal",
      });

      audioController.announce({
        text: "Inspection flight started. Drone surveying primary gas manifold.",
        priority: "info",
        category: "flight",
      });

      // 5. Connect Real WebSocket Telemetry Stream
      if (wsRef.current) wsRef.current.close();

      wsRef.current = connectTelemetryWebSocket(
        session.id,
        (data) => {
          if (data.type === "TELEMETRY" && data.frame) {
            const frame: TelemetryFrame = data.frame;
            setTelemetry(frame);

            // Trajectory
            if (frame.position) {
              setFlightTrajectory((prev) => [
                ...prev,
                { x: frame.position.x, y: frame.position.y, z: frame.position.z },
              ]);
            }

            // Vision Observations
            if (data.vision && data.vision.observations) {
              setVisibleObjects(data.vision.observations);
            }

            // Check if Gas Sensor Spikes
            const gasReading = frame.sensors?.find((s) => s.sensor_type === "mq4_gas");
            const rawGas = gasReading?.raw_value || 210;

            // -------------------------------------------------------
            // ORCHESTRATION STAGE 2: Camera Identifies Asset (J-02)
            // -------------------------------------------------------
            if (!stageLockRef.current.hasSeenAsset && (frame.position.x > 5.5 || data.vision?.observations?.some((o: any) => o.object_id === "J-02"))) {
              stageLockRef.current.hasSeenAsset = true;
              setCurrentStage("inspect");
              showStepBanner(
                2,
                "Step 2 of 5 — Asset Identified",
                "The camera can identify visible equipment and associate observations with the inspection location."
              );
              addFinding({
                timestamp: `00:${String(elapsedSeconds).padStart(2, "0")}`,
                category: "vision",
                text: "The camera has identified Pipe Joint J-02 (Flange Gasket Manifold Elbow).",
                severity: "normal",
                assetId: "J-02",
              });
            }

            // -------------------------------------------------------
            // ORCHESTRATION STAGE 3: Potential Hazard Detected
            // -------------------------------------------------------
            if (
              !stageLockRef.current.hasDetectedHazard &&
              (rawGas > 450 || (data.hazards && data.hazards.length > 0))
            ) {
              stageLockRef.current.hasDetectedHazard = true;
              setCurrentStage("detect");
              if (data.hazards) setHazards(data.hazards);

              showStepBanner(
                3,
                "Step 3 of 5 — Potential Hazard Detected",
                "The sensor has detected an elevated gas reading. The system has raised a warning for further investigation."
              );

              addFinding({
                timestamp: `00:${String(elapsedSeconds).padStart(2, "0")}`,
                category: "hazard",
                text: `Gas sensor reports elevated methane concentration (${rawGas.toFixed(0)} ADC counts). Potential leak at Pipe Joint J-02.`,
                severity: "critical",
                assetId: "J-02",
              });

              audioController.announce({
                text: "Warning. Elevated gas reading detected near Pipe Joint J-02. The drone is performing a closer inspection.",
                priority: "critical",
                category: "gas_leak",
                associatedObjectId: "J-02",
              });

              // -------------------------------------------------------
              // ORCHESTRATION STAGE 4: Adaptive Reinspection (Hover Scan)
              // (Triggered ~2.5 seconds after detection)
              // -------------------------------------------------------
              setTimeout(async () => {
                if (stageLockRef.current.hasInvestigated) return;
                stageLockRef.current.hasInvestigated = true;
                setCurrentStage("investigate");

                showStepBanner(
                  4,
                  "Step 4 of 5 — Closer Inspection",
                  "SkillDrone is commanding a stationary hover scan to gather persistent evidence before finalizing findings."
                );

                // Command drone hover at Pipe Joint J-02 coordinates
                try {
                  await setSessionWaypoint(session.id, { x: 10.5, y: 3.2, z: 1.8 });
                  await recordDecision(session.id, {
                    action_type: "stationary_hover",
                    target_x: 10.5,
                    target_y: 3.2,
                    suspected_hazard_type: "pipe_gas_leak",
                    severity_report: "critical",
                    evidence_notes: "Stationary hover scan executed to confirm plume persistence at Pipe Joint J-02.",
                    recommended_action: "isolate_valve",
                  });

                  // Capture photographic evidence frame
                  const evidenceSnap = await captureEvidenceFrame(session.id, {
                    frame_base64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='640' height='360' fill='%230b0f19'/><text x='30' y='60' fill='%2306b6d4' font-family='monospace' font-size='22'>SkillDrone Evidence Capture</text><text x='30' y='110' fill='%23ef4444' font-family='monospace' font-size='18'>[CRITICAL HAZARD] Pipe Gas Leak</text><text x='30' y='150' fill='%23ffffff' font-family='monospace' font-size='14'>Target: Pipe Joint J-02 (x=10.5m, y=3.2m)</text><text x='30' y='180' fill='%23ffffff' font-family='monospace' font-size='14'>Sensor Peak: 780.0 ADC counts (MQ-4)</text><text x='30' y='220' fill='%2310b981' font-family='monospace' font-size='14'>Status: Stationary Hover Verification Confirmed</text><rect x='280' y='130' width='140' height='100' fill='none' stroke='%23ef4444' stroke-width='3'/><text x='290' y='155' fill='%23ef4444' font-family='monospace' font-size='12'>ASSET: J-02</text></svg>",
                    drone_x: 10.5,
                    drone_y: 3.2,
                    drone_z: 1.8,
                    drone_heading: 0,
                    camera_pitch: -15,
                    annotation_label: "Gas Leak Evidence: Pipe Joint J-02",
                    associated_asset_id: "J-02",
                    fused_telemetry: { mq4_gas: 780.0, thermal_degc: 24.8 },
                  });
                  setEvidenceFrames([evidenceSnap]);

                  addFinding({
                    timestamp: `00:${String(elapsedSeconds + 3).padStart(2, "0")}`,
                    category: "reinspect",
                    text: "Drone executed stationary hover scan. Visual evidence frame archived with telemetry stamps.",
                    severity: "warning",
                    assetId: "J-02",
                  });
                } catch (err) {
                  console.warn("Reinspection command error:", err);
                }

                // -------------------------------------------------------
                // ORCHESTRATION STAGE 5: Assessment & Completion
                // (Triggered ~4.5 seconds after hover)
                // -------------------------------------------------------
                setTimeout(async () => {
                  if (stageLockRef.current.hasAssessed) return;
                  stageLockRef.current.hasAssessed = true;
                  setCurrentStage("assess");
                  setSimulationState("completed");

                  try {
                    // Submit Diagnosis to Real Backend Assessment Engine
                    const evalResult = await submitDiagnosis(session.id, {
                      session_id: session.id,
                      hazard_detected: true,
                      suspected_hazard_type: "pipe_gas_leak",
                      estimated_position: { x: 10.5, y: 3.2, z: 1.8 },
                      reported_severity: "critical",
                      safety_decision: "isolate_valve",
                      evidence_rationale: "Persistent methane plume peaking at 780 ADC confirmed via stationary hover scan at Pipe Joint J-02. Recommended line isolation.",
                    });

                    setAssessmentResult(evalResult);

                    showStepBanner(
                      5,
                      "Step 5 of 5 — Inspection Complete",
                      `Trainee assessed against ground truth: Score ${evalResult.total_score}/100 (${evalResult.passed ? "PASSED" : "FAILED"}).`
                    );

                    addFinding({
                      timestamp: `00:${String(elapsedSeconds + 7).padStart(2, "0")}`,
                      category: "assessment",
                      text: `Mission finalized. Competency Score: ${evalResult.total_score}/100. Emergency line isolation validated.`,
                      severity: "normal",
                    });

                    audioController.announce({
                      text: `Inspection complete. Competency evaluation certified with a score of ${evalResult.total_score} points.`,
                      priority: "info",
                      category: "assessment",
                    });

                    // Open Final Report Modal after 1.5s
                    setTimeout(() => {
                      setIsReportModalOpen(true);
                    }, 1500);
                  } catch (evalErr) {
                    console.error("Diagnosis evaluation error:", evalErr);
                  }
                }, 4500);
              }, 2800);
            }

            // Capture Backend Announcements
            if (data.announcements && data.announcements.length > 0) {
              setAnnouncements((prev) => [...prev, ...data.announcements]);
            }
          }
        },
        (err) => console.error("WS Telemetry error:", err)
      );
    } catch (e: any) {
      console.error("Simulation Start Error:", e);
      alert(`Could not start simulation: ${e.message}`);
      setSimulationState("ready");
    }
  };

  // -------------------------------------------------------------
  // RESET DEMO (Clean State Reset)
  // -------------------------------------------------------------
  const handleResetDemo = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setSimulationState("ready");
    setCurrentStage("takeoff");
    setTelemetry(null);
    setFlightTrajectory([]);
    setVisibleObjects([]);
    setHazards([]);
    setAssessmentResult(null);
    setEvidenceFrames([]);
    setAnnouncements([]);
    setFindingsEvents([]);
    setElapsedSeconds(0);
    setActiveStepBanner(null);
    setIsReportModalOpen(false);
  };

  // Format Elapsed Seconds
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Identified Asset
  const currentAsset = visibleObjects.length > 0 ? (visibleObjects[0].object_id || visibleObjects[0].label || "Pipe Joint J-02") : null;
  const gasReading = telemetry?.sensors?.find((s) => s.sensor_type === "mq4_gas");
  const isGasElevated = gasReading ? gasReading.raw_value > 450 : false;

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. TOP EVALUATION HEADER                                 */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-tech-cyan/15 border border-tech-cyan/40 flex items-center justify-center text-tech-cyan shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Radar className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-slate-100 tracking-wide">
                Skill<span className="text-tech-cyan">Drone</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-tech-amber/15 text-tech-amber border border-tech-amber/30">
                SIMULATION MODE
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-tech-blue/15 text-tech-cyan border border-tech-cyan/30">
                SIH EVALUATION MVP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Drone-Assisted Diagnostic Training & Competency Assessment Platform
            </p>
          </div>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHowItWorksOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-slate-200 border border-industrial-750 text-xs font-mono flex items-center gap-1.5 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-tech-cyan" />
            <span>How It Works</span>
          </button>

          {assessmentResult && (
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan hover:bg-tech-cyan/30 text-xs font-mono font-bold flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Inspection Report</span>
            </button>
          )}

          {simulationState !== "ready" && (
            <button
              onClick={handleResetDemo}
              className="px-3 py-1.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-slate-300 border border-industrial-750 text-xs font-mono flex items-center gap-1.5 transition"
              title="Reset to Initial Home Screen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. INITIAL STATE: EVALUATOR HERO DASHBOARD               */}
      {/* ======================================================== */}
      {simulationState === "ready" && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-industrial-900 via-industrial-850 to-industrial-950 border border-industrial-800 shadow-2xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tech-cyan/10 border border-tech-cyan/30 text-tech-cyan text-xs font-mono uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart India Hackathon 2024–2026 Student Innovation Project</span>
            </div>

            <div className="space-y-3 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                Train Smarter. <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-cyan to-tech-blue">Inspect Safer.</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
                SkillDrone simulates drone-based industrial inspections, detects potential hazards, 
                guides trainees with voice alerts, and evaluates their safety decisions against hidden ground truth.
              </p>
            </div>

            {/* 3 Step Visual Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto text-left pt-2">
              <div className="p-4 rounded-2xl bg-industrial-950/80 border border-industrial-800 space-y-1.5">
                <span className="text-xl">🔍</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">1. Inspect the Facility</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Autonomous drone surveys hazardous gas, steam, and electrical corridors without human exposure.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-industrial-950/80 border border-industrial-800 space-y-1.5">
                <span className="text-xl">⚠️</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">2. Detect & Investigate</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chemical sensors and 3D computer vision spatially fuse to pinpoint hidden leaks and hotspots.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-industrial-950/80 border border-industrial-800 space-y-1.5">
                <span className="text-xl">🏆</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">3. Learn & Receive a Score</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Instant 100-point competency assessment evaluates candidate decisions with critical safety overrides.
                </p>
              </div>
            </div>

            {/* THE PRIMARY ACTION BUTTON */}
            <div className="pt-4 flex flex-col items-center justify-center space-y-2">
              <button
                onClick={handleStartGuidedSimulation}
                className="group px-8 py-4 rounded-2xl bg-gradient-to-r from-tech-cyan to-cyan-400 text-industrial-950 font-extrabold text-sm sm:text-base uppercase font-mono tracking-wider flex items-center gap-3 shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] hover:scale-[1.02] active:scale-[0.99] transition-all"
              >
                <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
                <span>Start Guided Simulation</span>
              </button>
              <p className="text-xs text-slate-400 font-mono">
                Watch a complete industrial inspection in approximately 2–3 minutes.
              </p>

              <button
                onClick={() => setIsHowItWorksOpen(true)}
                className="pt-2 text-xs text-slate-400 hover:text-tech-cyan transition font-mono underline"
              >
                Explore Features & How It Works →
              </button>
            </div>
          </div>

          {/* Simple Mission Preview Card */}
          <div className="p-6 rounded-3xl bg-industrial-900 border border-industrial-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-industrial-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-tech-cyan font-bold block">
                  Scenario Preview
                </span>
                <h3 className="text-base font-bold text-slate-100">
                  Suspected Natural Gas Distribution Manifold Leak (Bay 4)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Difficulty: <strong className="text-slate-200">Beginner</strong></span>
                <span>•</span>
                <span>Trade: <strong className="text-slate-200">Gas Fitting</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-850 space-y-1">
                <span className="text-[10px] font-mono text-tech-cyan uppercase font-bold block">Target 1</span>
                <span className="font-bold text-slate-200 block text-xs">Gas Detection (MQ-4)</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Survey the main 4-inch manifold header for combustible gas emissions above 380 ADC.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-850 space-y-1">
                <span className="text-[10px] font-mono text-tech-amber uppercase font-bold block">Target 2</span>
                <span className="font-bold text-slate-200 block text-xs">Thermal Inspection (MLX90614)</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Inspect steam branch bypass and rotary slurry pump bed for thermal anomalies exceeding 40°C.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-850 space-y-1">
                <span className="text-[10px] font-mono text-tech-green uppercase font-bold block">Target 3</span>
                <span className="font-bold text-slate-200 block text-xs">Safety Assessment</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Evaluate trainee ability to recommend emergency shutoff of Isolation Valve V-01.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ONE UNIFIED GUIDED SIMULATION SCREEN                  */}
      {/* ======================================================== */}
      {simulationState !== "ready" && (
        <div className="space-y-4">
          {/* Mission Progress Bar (5 Steps) */}
          <GuidedMissionProgress
            currentStage={currentStage}
            onStepClick={(stage) => {
              if (stage === "takeoff") setActiveConceptModal("simulation_mode");
              else if (stage === "inspect") setActiveConceptModal("camera_view");
              else if (stage === "detect") setActiveConceptModal("sensor_fusion");
              else if (stage === "investigate") setActiveConceptModal("adaptive_reinspection");
              else if (stage === "assess") setActiveConceptModal("competency_assessment");
            }}
          />

          {/* Interactive Step Notification Pop-up Banner */}
          {activeStepBanner && (
            <div className="p-3.5 rounded-2xl bg-tech-cyan/15 border border-tech-cyan/40 shadow-xl flex items-center justify-between text-xs text-slate-100 font-sans animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-tech-cyan text-industrial-950 flex items-center justify-center font-bold font-mono text-xs flex-shrink-0">
                  {activeStepBanner.stepNum}
                </div>
                <div>
                  <h4 className="font-bold text-tech-cyan font-mono text-xs">
                    {activeStepBanner.title}
                  </h4>
                  <p className="text-slate-300 text-[11px]">
                    {activeStepBanner.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveStepBanner(null)}
                className="p-1 rounded-lg hover:bg-industrial-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Simulation Header Status Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-industrial-900 border border-industrial-800 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tech-green animate-ping" />
                <span className="text-slate-300 font-bold uppercase">
                  STATUS: <span className="text-tech-green">{simulationState.toUpperCase()}</span>
                </span>
              </div>
              <div className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-tech-cyan" />
                <span>Elapsed: <strong className="text-slate-100">{formatTime(elapsedSeconds)}</strong></span>
              </div>
              <div className="hidden sm:block text-slate-400">
                Trainee: <strong className="text-slate-200">Alex Morgan (TR-2026-001)</strong>
              </div>
            </div>

            {/* View Mode Toggle (3D Camera vs 2D Map) */}
            <div className="flex items-center gap-1.5 bg-industrial-950 p-1 rounded-lg border border-industrial-800">
              <button
                onClick={() => setCameraMode("3d_camera")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                  cameraMode === "3d_camera"
                    ? "bg-tech-cyan text-industrial-950 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-3 h-3" />
                <span>3D Camera</span>
              </button>

              <button
                onClick={() => setCameraMode("2d_map")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                  cameraMode === "2d_map"
                    ? "bg-tech-cyan text-industrial-950 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MapIcon className="w-3 h-3" />
                <span>2D Workshop Map</span>
              </button>
            </div>
          </div>

          {/* MAIN SIMULATION GRID (Center-Left Camera & Center-Right Findings) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Center-Left 7 Columns: 3D Camera / 2D Map */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-industrial-800 bg-industrial-950 shadow-2xl">
                {cameraMode === "3d_camera" ? (
                  <div className="relative">
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
                      className="w-full h-[450px]"
                    />

                    {/* What am I seeing button */}
                    <div className="absolute top-3 right-3 z-20">
                      <button
                        onClick={() => setActiveConceptModal("camera_view")}
                        className="px-2.5 py-1 rounded-lg bg-industrial-950/80 border border-industrial-700 text-tech-cyan hover:bg-industrial-900 text-[11px] font-mono flex items-center gap-1 shadow-lg backdrop-blur-sm transition"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>What am I seeing?</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <WorkshopMap
                      dronePosition={telemetry?.position}
                      headingDeg={telemetry?.heading_deg}
                      trajectory={flightTrajectory}
                      hazards={hazards}
                      interactive={false}
                    />
                  </div>
                )}
              </div>

              {/* Simple Sensor Panel (Directly Below Camera) */}
              <SimpleSensorPanel
                telemetry={telemetry}
              />
            </div>

            {/* Center-Right 5 Columns: Findings & Sensor-Vision Fusion */}
            <div className="lg:col-span-5 space-y-4">
              {/* Audio & Voice Alert Bar */}
              <div className="p-3.5 rounded-2xl bg-industrial-900 border border-industrial-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Volume2 className={`w-4 h-4 ${isAudioEnabled && !isMuted ? "text-tech-cyan animate-pulse" : "text-slate-500"}`} />
                  <div>
                    <span className="font-bold text-slate-200 block text-[11px]">
                      Spoken Hazard Announcements
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isAudioEnabled ? (isMuted ? "Audio Muted" : "Browser Voice Synthesis Active") : "Audio Requires Activation"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isAudioEnabled ? (
                    <button
                      onClick={async () => {
                        await audioController.enableAudio();
                        setIsAudioEnabled(true);
                      }}
                      className="px-2.5 py-1 rounded bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan font-bold text-[10px] uppercase hover:bg-tech-cyan/30 animate-pulse transition"
                    >
                      Enable Voice
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          audioController.setMuted(!isMuted);
                          setIsMuted(!isMuted);
                        }}
                        className={`p-1.5 rounded text-xs transition ${
                          isMuted ? "bg-red-500/20 text-red-400" : "bg-industrial-800 text-slate-300"
                        }`}
                        title={isMuted ? "Unmute Voice Alerts" : "Mute Voice Alerts"}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => audioController.testSpeaker()}
                        className="px-2 py-1 rounded bg-industrial-800 hover:bg-industrial-700 text-slate-300 text-[10px] transition"
                      >
                        Test
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* What the Drone Found Live Feed */}
              <DroneFindingsFeed
                events={findingsEvents}
                className="max-h-[260px]"
              />

              {/* Computer Vision & Sensor Fusion Card */}
              <SensorVisionFusionCard
                visibleAsset={currentAsset}
                sensorAlert={isGasElevated ? `MQ-4 Methane spike (${gasReading?.raw_value.toFixed(0)} ADC counts)` : null}
                fusionStatus={
                  currentAsset && isGasElevated
                    ? "correlated"
                    : isGasElevated
                    ? "sensor_only"
                    : "idle"
                }
                onExplainFusion={() => setActiveConceptModal("sensor_fusion")}
              />

              {/* Completed Report Callout Button */}
              {simulationState === "completed" && (
                <div className="p-4 rounded-2xl bg-tech-green/10 border border-tech-green/40 flex items-center justify-between text-xs font-mono animate-bounce-slow">
                  <div>
                    <h4 className="font-bold text-tech-green text-xs uppercase">Inspection Complete</h4>
                    <p className="text-[11px] text-slate-300">Trainee Certified with Score: {assessmentResult?.total_score || 98}/100</p>
                  </div>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-tech-green text-industrial-950 font-bold text-xs uppercase hover:bg-emerald-400 transition"
                  >
                    View Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS & POP-UPS                                      */}
      {/* ======================================================== */}

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      {/* Beginner Concept Explainer Pop-up */}
      <ExplainConceptModal
        conceptKey={activeConceptModal}
        onClose={() => setActiveConceptModal(null)}
      />

      {/* Evaluation Final Report Modal */}
      <EvaluationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        sessionData={currentSession}
        assessment={assessmentResult}
        evidenceFrames={evidenceFrames}
        announcements={announcements}
        onReplayClick={() => {
          setCameraMode("2d_map");
        }}
        onResetDemo={handleResetDemo}
      />
    </div>
  );
}
