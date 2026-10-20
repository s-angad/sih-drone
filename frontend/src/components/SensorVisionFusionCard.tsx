"use client";

import React from "react";
import { Eye, Flame, Sparkles, HelpCircle, ShieldCheck } from "lucide-react";

interface SensorVisionFusionCardProps {
  visibleAsset: string | null;
  sensorAlert: string | null;
  fusionStatus: "idle" | "correlated" | "sensor_only";
  onExplainFusion: () => void;
  className?: string;
}

export default function SensorVisionFusionCard({
  visibleAsset,
  sensorAlert,
  fusionStatus,
  onExplainFusion,
  className = ""
}: SensorVisionFusionCardProps) {
  return (
    <div className={`p-4 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-xl space-y-3 font-sans ${className}`}>
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-tech-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
            Computer Vision & Sensor Fusion
          </h3>
        </div>

        <button
          onClick={onExplainFusion}
          className="text-[11px] text-tech-cyan hover:underline flex items-center gap-1 font-mono transition"
          title="Explain how vision and sensors work together"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>How was this detected?</span>
        </button>
      </div>

      {/* 3 Tier Fusion Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
        {/* Tier 1: Visual Observation */}
        <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850 space-y-1">
          <div className="flex items-center gap-1.5 text-tech-blue font-mono font-bold text-[10px] uppercase">
            <Eye className="w-3.5 h-3.5" />
            <span>1. Camera Observation</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {visibleAsset ? (
              <span>Visible asset: <strong className="text-tech-cyan font-mono">{visibleAsset}</strong> in field of view.</span>
            ) : (
              <span className="text-slate-400">Scanning workshop corridor. No target fitting in active frame.</span>
            )}
          </p>
        </div>

        {/* Tier 2: Sensor Telemetry */}
        <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-850 space-y-1">
          <div className="flex items-center gap-1.5 text-tech-amber font-mono font-bold text-[10px] uppercase">
            <Flame className="w-3.5 h-3.5" />
            <span>2. Sensor Reading</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {sensorAlert ? (
              <span className="text-amber-300 font-semibold">{sensorAlert}</span>
            ) : (
              <span className="text-slate-400">Gas, thermal, and UV sensors within nominal baseline.</span>
            )}
          </p>
        </div>

        {/* Tier 3: Combined Fusion Interpretation */}
        <div className={`p-3 rounded-xl border space-y-1 transition-all ${
          fusionStatus === "correlated"
            ? "bg-tech-cyan/10 border-tech-cyan/40 text-slate-100"
            : fusionStatus === "sensor_only"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
            : "bg-industrial-950 border-industrial-850 text-slate-400"
        }`}>
          <div className="flex items-center gap-1.5 font-mono font-bold text-[10px] uppercase text-tech-cyan">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Fusion Interpretation</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {fusionStatus === "correlated" ? (
              <span>
                Elevated reading is spatially mapped to <strong className="text-tech-cyan font-mono">{visibleAsset}</strong>. Suspected flange leak verified.
              </span>
            ) : fusionStatus === "sensor_only" ? (
              <span>
                Sensor plume detected without visible asset in frame. Sensor-only alert logged.
              </span>
            ) : (
              <span>Awaiting detection alignment. System standing by.</span>
            )}
          </p>
        </div>
      </div>

      {/* Scientific Attribution Disclaimer */}
      <div className="text-[10px] text-slate-400 font-mono bg-industrial-950/70 p-2 rounded-lg border border-industrial-850/60 flex items-center justify-between">
        <span>Scientific Grounding: RGB cameras cannot see invisible methane. Hazards are inferred from chemical sensors fused with recognized pipe coordinates.</span>
      </div>
    </div>
  );
}
