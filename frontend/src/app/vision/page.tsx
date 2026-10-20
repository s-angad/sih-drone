"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Camera, 
  Play, 
  Pause, 
  Layers, 
  Sparkles, 
  Compass, 
  Navigation as NavIcon,
  CheckCircle2
} from "lucide-react";
import DroneCameraView from "@/components/DroneCameraView";
import AudioVoicePanel from "@/components/AudioVoicePanel";
import WorkshopMap from "@/components/WorkshopMap";
import { audioController } from "@/utils/audioController";
import { API_BASE_URL, WS_BASE_URL } from "@/lib/api";

export default function VisionPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [activeMission, setActiveMission] = useState<any | null>(null);

  // Telemetry stream state
  const [dronePos, setDronePos] = useState({ x: 2.0, y: 2.0, z: 1.8 });
  const [droneHeading, setDroneHeading] = useState(0);
  const [droneSpeed, setDroneSpeed] = useState(0);
  const [batteryPct, setBatteryPct] = useState(100);
  const [linkQuality, setLinkQuality] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [activeHazards, setActiveHazards] = useState<any[]>([]);
  const [visibleObjects, setVisibleObjects] = useState<any[]>([]);
  const [fusionResult, setFusionResult] = useState<any | null>(null);
  const [visionProvider, setVisionProvider] = useState<string>("simulation_vision_provider");
  const [evidenceSnaps, setEvidenceSnaps] = useState<any[]>([]);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch active sessions on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sessions`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSessions(data);
          const inProg = data.find((s) => s.status === "in_progress") || data[0];
          setActiveSessionId(inProg.id);
        }
      })
      .catch((e) => console.warn("Failed to fetch sessions:", e));
  }, []);

  // Fetch session details & scenario
  useEffect(() => {
    if (!activeSessionId) return;

    fetch(`${API_BASE_URL}/api/sessions/${activeSessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setSessionData(data);
        if (data.mission_id) {
          fetch(`${API_BASE_URL}/api/missions/${data.mission_id}`)
            .then((r) => r.json())
            .then((m) => setActiveMission(m))
            .catch((e) => console.warn(e));
        }
      })
      .catch((e) => console.warn(e));
  }, [activeSessionId]);

  // Connect WebSocket stream for the active session
  useEffect(() => {
    if (!activeSessionId) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE_URL}/api/telemetry/ws/${activeSessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WebSocket] Connected to vision telemetry stream:", activeSessionId);
    };

    ws.onmessage = (event) => {
      try {
        const msg = jsonParse(event.data);
        if (msg.type === "TELEMETRY" && msg.frame) {
          const f = msg.frame;
          setDronePos({ x: f.position.x, y: f.position.y, z: f.position.z });
          setDroneHeading(f.heading_deg || 0);
          setDroneSpeed(f.speed_mps || 0);
          setBatteryPct(f.battery_pct || 100);
          setLinkQuality(f.link_quality_pct || 100);

          if (f.visible_objects) {
            setVisibleObjects(f.visible_objects);
          }
          if (f.fusion) {
            setFusionResult(f.fusion);
          }
          if (msg.hazards) {
            setActiveHazards(msg.hazards);
          }

          // Trigger client audio announcements if provided
          if (msg.announcements && Array.isArray(msg.announcements)) {
            msg.announcements.forEach((ann: any) => {
              audioController.announce({
                text: ann.message_text,
                priority: ann.priority,
                category: ann.category,
                associatedObjectId: ann.associated_object_id,
              });
            });
          }
        }
      } catch (e) {
        console.warn("WS Parse error:", e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [activeSessionId]);

  const jsonParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  const handlePauseResume = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const action = isPaused ? "resume" : "pause";
    wsRef.current.send(JSON.stringify({ action }));
    setIsPaused(!isPaused);
  };

  const handleProviderChange = (provider: string) => {
    setVisionProvider(provider);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "set_vision_provider", provider }));
    }
    fetch(`${API_BASE_URL}/api/vision/provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    }).catch((e) => console.warn(e));
  };

  const handleSnapshotCaptured = (dataUrl: string, metadata: any) => {
    if (!activeSessionId) return;

    fetch(`${API_BASE_URL}/api/vision/sessions/${activeSessionId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: activeSessionId,
        trigger_event_type: "manual_snapshot",
        drone_pos_x: metadata.dronePosition.x,
        drone_pos_y: metadata.dronePosition.y,
        drone_pos_z: metadata.dronePosition.z,
        drone_heading_deg: metadata.headingDeg,
        drone_pitch_deg: metadata.pitchDeg,
        associated_object_id: fusionResult?.associated_object_id || null,
        fused_sensor_summary: { active_hazards: activeHazards.length, speed: droneSpeed },
        annotations: metadata.visibleObjects,
        image_data_url: dataUrl,
      }),
    })
      .then((r) => r.json())
      .then((saved) => {
        setSavedSuccessMsg("Annotated Camera Evidence Saved to Session Report!");
        setTimeout(() => setSavedSuccessMsg(null), 3000);
        setEvidenceSnaps((prev) => [saved, ...prev]);
        audioController.announce({
          text: "Evidence snapshot captured and archived for mission report.",
          priority: "info",
          category: "evidence",
        });
      })
      .catch((e) => console.warn("Failed to save snapshot:", e));
  };

  return (
    <div className="min-h-screen bg-industrial-950 text-slate-100 p-4 md:p-6 font-mono space-y-6">
      {/* Top Banner / Session Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-industrial-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-tech-cyan/20 border border-tech-cyan/50 flex items-center justify-center text-tech-cyan">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase">
                Live Drone Camera &bull; Computer Vision
              </h1>
              <p className="text-xs text-slate-400">
                First-Person Industrial Inspection View &bull; Scene-Grounded Object Localization
              </p>
            </div>
          </div>
        </div>

        {/* Session Selector & Flight Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeSessionId || ""}
            onChange={(e) => setActiveSessionId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-industrial-900 border border-industrial-800 text-xs text-tech-cyan focus:outline-none focus:border-tech-cyan"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_code} &bull; {s.status.toUpperCase()} ({s.data_source})
              </option>
            ))}
          </select>

          <button
            onClick={handlePauseResume}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isPaused
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                : "bg-industrial-800 hover:bg-industrial-700 text-slate-200"
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? "RESUME FLIGHT" : "PAUSE HOVER"}</span>
          </button>

          <Link
            href="/live"
            className="px-3 py-1.5 rounded-lg bg-tech-blue/20 hover:bg-tech-blue/30 text-tech-cyan border border-tech-cyan/40 text-xs font-bold flex items-center gap-1.5"
          >
            <NavIcon className="w-3.5 h-3.5" />
            <span>FULL MISSION CONTROL</span>
          </Link>
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Left = Drone Camera View, Right = Telemetry & Audio Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): 3D Drone Camera Feed */}
        <div className="lg:col-span-8 space-y-4">
          <DroneCameraView
            dronePosition={dronePos}
            headingDeg={droneHeading}
            pitchDeg={-15}
            batteryPct={batteryPct}
            speedMps={droneSpeed}
            isSimulated={sessionData?.data_source !== "hardware_esp32"}
            linkQuality={linkQuality}
            activeHazards={activeHazards}
            visibleObjects={visibleObjects}
            fusionResult={fusionResult}
            onSnapshot={handleSnapshotCaptured}
            className="border-industrial-800"
          />

          {/* Vision Provider Settings Bar */}
          <div className="p-3.5 rounded-xl border border-industrial-800 bg-industrial-900/70 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-tech-cyan" />
              <span className="font-bold text-slate-200">ACTIVE VISION PROVIDER:</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleProviderChange("simulation_vision_provider")}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  visionProvider === "simulation_vision_provider"
                    ? "bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                    : "bg-industrial-800 text-slate-400 hover:text-white"
                }`}
              >
                SIMULATION VISION (3D FRUSTUM)
              </button>

              <button
                onClick={() => handleProviderChange("opencv_vision_provider")}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  visionProvider === "opencv_vision_provider"
                    ? "bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                    : "bg-industrial-800 text-slate-400 hover:text-white"
                }`}
              >
                OPENCV EDGE & CONTOUR
              </button>

              <button
                disabled
                className="px-3 py-1 rounded-md text-[11px] bg-industrial-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                title="Weights not mounted"
              >
                YOLO MODEL (OFFLINE)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Audio Announcer, Fusion Status & Workshop Mini-Map */}
        <div className="lg:col-span-4 space-y-5">
          {/* Audio Voice Announcements Panel */}
          <AudioVoicePanel compact={false} />

          {/* Sensor & Vision Fusion Summary Card */}
          <div className="rounded-xl border border-industrial-800 bg-industrial-950 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2">
              <span className="font-bold text-slate-100 flex items-center gap-1.5 uppercase">
                <Sparkles className="w-4 h-4 text-tech-cyan" />
                Sensor &bull; Vision Correlation
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                fusionResult?.fusion_status === "correlated" 
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40" 
                  : "bg-industrial-900 text-slate-400 border border-industrial-800"
              }`}>
                {fusionResult?.fusion_status === "correlated" ? "CORRELATED" : "UNRESOLVED"}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Associated Asset:</span>
                <span className="font-bold text-tech-cyan">{fusionResult?.associated_object_id || "None in FOV"}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Asset Class:</span>
                <span>{fusionResult?.associated_object_class || "N/A"}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Fusion Confidence:</span>
                <span>{Math.round((fusionResult?.confidence || 0.8) * 100)}%</span>
              </div>
              {fusionResult?.notes && (
                <p className="mt-2 text-[10px] text-slate-400 bg-industrial-900/60 p-2 rounded border border-industrial-800">
                  {fusionResult.notes}
                </p>
              )}
            </div>
          </div>

          {/* Mini 2D Synchronized Floorplan Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 uppercase font-bold text-slate-300">
                <Compass className="w-3.5 h-3.5 text-tech-cyan" />
                Workshop Synchronized Map
              </span>
              <span>20m x 15m Bay</span>
            </div>
            <WorkshopMap
              layout={activeMission?.environment_layout || {}}
              dronePosition={dronePos}
              headingDeg={droneHeading}
              hazards={activeHazards}
              interactive={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
