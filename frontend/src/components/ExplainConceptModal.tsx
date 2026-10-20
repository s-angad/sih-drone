"use client";

import React from "react";
import { X, HelpCircle, Eye, Cpu, ShieldAlert, Sparkles, Award } from "lucide-react";

export type ConceptKey = 
  | "camera_view" 
  | "sensor_fusion" 
  | "adaptive_reinspection" 
  | "ground_truth" 
  | "competency_assessment" 
  | "simulation_mode";

interface ExplainConceptModalProps {
  conceptKey: ConceptKey | null;
  onClose: () => void;
}

const CONCEPT_DATA: Record<ConceptKey, {
  title: string;
  icon: any;
  summary: string;
  bullets: string[];
  scientificNotice?: string;
}> = {
  camera_view: {
    title: "What Am I Seeing?",
    icon: Eye,
    summary: "You are looking through the drone's forward inspection camera in an industrial workshop.",
    bullets: [
      "Yellow overhead piping carries natural gas (methane) throughout the facility.",
      "Green piping represents secondary cooling water loops.",
      "Identified fittings (such as Pipe Joint J-02) are labeled with bounding boxes when in the camera's field of view.",
      "The top compass tape and artificial horizon show the drone's real-time flight orientation."
    ],
    scientificNotice: "Notice: An ordinary optical camera cannot see invisible combustible gas. Methane is detected by the chemical sensor and spatially correlated with the visible pipe joint."
  },
  sensor_fusion: {
    title: "How Was This Hazard Detected?",
    icon: Sparkles,
    summary: "SkillDrone combines camera observations with sensor measurements to pinpoint hazard locations.",
    bullets: [
      "Step 1: The MQ-4 sensor detects elevated chemical concentration (780 ADC counts).",
      "Step 2: The 3D camera simultaneously identifies 'Pipe Joint J-02' directly ahead in the drone's path.",
      "Step 3: The Fusion Engine maps the sensor spike to the physical joint coordinates (10.5m, 3.2m).",
      "Step 4: The system reports a suspected gas leak at J-02 requiring line isolation."
    ],
    scientificNotice: "This prevents false AI claims: SkillDrone never claims the camera 'sees gas'. It clearly reports sensor-telemetry correlated with visual asset recognition."
  },
  adaptive_reinspection: {
    title: "What Is Adaptive Reinspection?",
    icon: Cpu,
    summary: "When a sensor reading looks suspicious, the drone automatically pauses and gathers persistent evidence instead of flying away.",
    bullets: [
      "Transient air currents or electrical noise can cause brief, harmless sensor blips.",
      "Instead of sounding a false alarm, SkillDrone commands a stationary hover scan.",
      "If the reading remains elevated over multiple seconds, the leak is confirmed with high confidence.",
      "A high-resolution visual evidence snapshot is archived with telemetry timestamps."
    ]
  },
  ground_truth: {
    title: "What Is Ground Truth?",
    icon: ShieldAlert,
    summary: "Ground truth is the instructor's reference answer key hidden on the server.",
    bullets: [
      "In this scenario, a leak was deliberately configured at Pipe Joint J-02 (x=10.5, y=3.2).",
      "During an active exam, ground-truth coordinates are strictly isolated from the trainee.",
      "After the trainee submits their diagnosis, the system compares their estimate against the ground truth to calculate accuracy."
    ]
  },
  competency_assessment: {
    title: "How Is Trainee Competency Scored?",
    icon: Award,
    summary: "SkillDrone replaces subjective grading with an automated 100-point rubric aligned with vocational certification standards.",
    bullets: [
      "Hazard Identification (30 pts): Correctly detecting the anomaly and chemical type.",
      "Location Accuracy (25 pts): Spatial distance error between estimate and true leak coordinates.",
      "Inspection Coverage (15 pts): Completing required safety patrol corridors.",
      "Evidence & Rationale (15 pts): Gathering persistent sensor data and photographic frames.",
      "Safety Decision (15 pts): Recommending correct line isolation vs hot-work shutdown.",
      "Safety-Critical Override: Any missed critical explosive leak automatically fails the candidate (0/100)."
    ]
  },
  simulation_mode: {
    title: "What Does Simulation Mode Mean?",
    icon: HelpCircle,
    summary: "This platform is running in software simulation mode for demonstration and evaluation.",
    bullets: [
      "The 3D workshop, drone flight physics, and sensor plume models run entirely inside this application.",
      "No physical drone hardware, gas canisters, or laboratory setup is required.",
      "For live hardware deployment, the same backend connects to an ESP32 microcontroller payload via Wi-Fi/Serial."
    ]
  }
};

export default function ExplainConceptModal({ conceptKey, onClose }: ExplainConceptModalProps) {
  if (!conceptKey) return null;
  const data = CONCEPT_DATA[conceptKey];
  const Icon = data.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-lg w-full bg-industrial-900 border border-industrial-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-industrial-800 bg-industrial-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-tech-cyan/20 border border-tech-cyan/40 flex items-center justify-center text-tech-cyan">
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">{data.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed font-medium">
            {data.summary}
          </p>

          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
              How it works:
            </span>
            <ul className="space-y-2 text-slate-400">
              {data.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-tech-cyan font-bold">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {data.scientificNotice && (
            <div className="p-3 rounded-lg bg-tech-amber/10 border border-tech-amber/30 text-[11px] text-amber-300 leading-relaxed">
              {data.scientificNotice}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-industrial-800 bg-industrial-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-200 font-bold text-xs uppercase font-mono transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
