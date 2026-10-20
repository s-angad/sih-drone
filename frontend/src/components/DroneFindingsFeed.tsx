"use client";

import React from "react";
import { 
  Radar, 
  Eye, 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  Sparkles, 
  Info
} from "lucide-react";

export interface FindingEvent {
  id: string;
  timestamp: string;
  category: "flight" | "vision" | "sensor" | "reinspect" | "hazard" | "assessment";
  text: string;
  severity?: "normal" | "warning" | "critical";
  assetId?: string;
}

interface DroneFindingsFeedProps {
  events: FindingEvent[];
  className?: string;
}

export default function DroneFindingsFeed({ events, className = "" }: DroneFindingsFeedProps) {
  const getIcon = (category: string, severity?: string) => {
    if (severity === "critical") return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    if (severity === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    switch (category) {
      case "flight":
        return <Radar className="w-3.5 h-3.5 text-tech-cyan" />;
      case "vision":
        return <Eye className="w-3.5 h-3.5 text-tech-blue" />;
      case "sensor":
        return <Sparkles className="w-3.5 h-3.5 text-tech-amber" />;
      case "reinspect":
        return <Search className="w-3.5 h-3.5 text-tech-cyan" />;
      case "assessment":
        return <CheckCircle2 className="w-3.5 h-3.5 text-tech-green" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className={`p-4 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-xl flex flex-col font-sans ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-industrial-800 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tech-cyan animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
            What the Drone Found ({events.length})
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">LIVE TIMELINE</span>
      </div>

      {/* Events List */}
      <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1 text-xs">
        {events.length > 0 ? (
          events.slice().reverse().map((ev) => (
            <div
              key={ev.id}
              className={`p-2.5 rounded-xl border flex items-start justify-between gap-2.5 transition-all ${
                ev.severity === "critical"
                  ? "bg-red-500/10 border-red-500/40 text-red-200"
                  : ev.severity === "warning"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                  : "bg-industrial-950 border-industrial-850 text-slate-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {getIcon(ev.category, ev.severity)}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs leading-relaxed font-medium">
                    {ev.text}
                  </p>
                  {ev.assetId && (
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-tech-cyan/20 border border-tech-cyan/40 text-tech-cyan font-bold">
                      ASSET: {ev.assetId}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 whitespace-nowrap mt-0.5">
                {ev.timestamp}
              </span>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-slate-400 font-mono text-xs">
            <Radar className="w-6 h-6 mx-auto mb-2 text-slate-400 animate-spin-slow" />
            <span>Waiting for simulation flight to begin...</span>
          </div>
        )}
      </div>
    </div>
  );
}
