"use client";

import React, { useState } from "react";
import { 
  Flame, 
  Thermometer, 
  Sun, 
  Battery, 
  ChevronDown, 
  ChevronUp
} from "lucide-react";
import { TelemetryFrame } from "@/lib/api";

interface SimpleSensorPanelProps {
  telemetry: TelemetryFrame | null;
  className?: string;
}

export default function SimpleSensorPanel({
  telemetry,
  className = ""
}: SimpleSensorPanelProps) {
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Extract readings
  const mq4Reading = telemetry?.sensors?.find((s) => s.sensor_type === "mq4_gas");
  const mq7Reading = telemetry?.sensors?.find((s) => s.sensor_type === "mq7_co");
  const tempReading = telemetry?.sensors?.find((s) => s.sensor_type === "thermal_ir");
  const uvReading = telemetry?.sensors?.find((s) => s.sensor_type === "uv_flame");

  const rawMq4 = mq4Reading?.raw_value || 215.0;
  const rawTemp = tempReading?.raw_value || 24.8;
  const rawUv = uvReading?.raw_value || 2.1;
  const batteryPct = telemetry?.battery_pct !== undefined ? telemetry.battery_pct : 100.0;

  // Gas status evaluation
  let gasStatus: "normal" | "elevated" | "critical" = "normal";
  let gasDesc = "Readings are nominal. Safe atmosphere.";
  if (rawMq4 > 650) {
    gasStatus = "critical";
    gasDesc = "CRITICAL: Combustible methane plume detected!";
  } else if (rawMq4 > 380) {
    gasStatus = "elevated";
    gasDesc = "ELEVATED: Gas readings are above safety threshold.";
  }

  // Temperature status
  let tempStatus: "normal" | "elevated" | "critical" = "normal";
  let tempDesc = "Normal room temperature.";
  if (rawTemp > 60) {
    tempStatus = "critical";
    tempDesc = "CRITICAL: Extreme thermal hotspot detected.";
  } else if (rawTemp > 38) {
    tempStatus = "elevated";
    tempDesc = "ELEVATED: Equipment surface is overheating.";
  }

  // UV status
  let uvStatus: "normal" | "elevated" | "critical" = "normal";
  let uvDesc = "No arcing or flame radiation detected.";
  if (rawUv > 15) {
    uvStatus = "critical";
    uvDesc = "CRITICAL: Optical flame or arc flash radiation.";
  } else if (rawUv > 6) {
    uvStatus = "elevated";
    uvDesc = "ELEVATED: Mild ultraviolet flux detected.";
  }

  return (
    <div className={`p-4 rounded-2xl bg-industrial-900 border border-industrial-800 shadow-xl space-y-3 font-sans ${className}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Sensor Payload Status
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-tech-cyan/15 text-tech-cyan border border-tech-cyan/30">
            SIMULATED SENSORS
          </span>
        </div>

        <button
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="text-xs text-tech-cyan hover:underline font-mono flex items-center gap-1 transition"
        >
          <span>{showTechDetails ? "Hide Technical Details" : "View Technical Details"}</span>
          {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 4 Simple Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Gas Status */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          gasStatus === "critical"
            ? "bg-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse"
            : gasStatus === "elevated"
            ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
            : "bg-industrial-950 border-industrial-850 text-slate-200"
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono text-[10px] uppercase text-slate-400">Gas Level</span>
            <Flame className={`w-3.5 h-3.5 ${
              gasStatus === "critical" ? "text-red-400" : gasStatus === "elevated" ? "text-amber-400" : "text-slate-400"
            }`} />
          </div>
          <div className="text-base font-bold capitalize">
            {gasStatus}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
            {gasDesc}
          </p>
        </div>

        {/* Card 2: Temperature Status */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          tempStatus === "critical"
            ? "bg-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
            : tempStatus === "elevated"
            ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
            : "bg-industrial-950 border-industrial-850 text-slate-200"
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono text-[10px] uppercase text-slate-400">Temperature</span>
            <Thermometer className="w-3.5 h-3.5 text-tech-cyan" />
          </div>
          <div className="text-base font-bold capitalize">
            {tempStatus} ({rawTemp.toFixed(1)}°C)
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
            {tempDesc}
          </p>
        </div>

        {/* Card 3: UV Radiation */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          uvStatus === "critical"
            ? "bg-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
            : uvStatus === "elevated"
            ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
            : "bg-industrial-950 border-industrial-850 text-slate-200"
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono text-[10px] uppercase text-slate-400">Flame & UV</span>
            <Sun className="w-3.5 h-3.5 text-tech-amber" />
          </div>
          <div className="text-base font-bold capitalize">
            {uvStatus}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
            {uvDesc}
          </p>
        </div>

        {/* Card 4: Battery */}
        <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-850 text-slate-200">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono text-[10px] uppercase text-slate-400">Drone Battery</span>
            <Battery className="w-3.5 h-3.5 text-tech-green" />
          </div>
          <div className="text-base font-bold text-slate-100">
            {batteryPct.toFixed(1)}%
          </div>
          <div className="w-full h-1.5 bg-industrial-900 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                batteryPct > 40 ? "bg-tech-green" : batteryPct > 20 ? "bg-tech-amber" : "bg-red-500"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, batteryPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expandable Technical Details Accordion */}
      {showTechDetails && (
        <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-850 text-xs font-mono space-y-2 mt-2">
          <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1.5 border-b border-industrial-850">
            <span className="font-bold text-slate-300">Raw Telemetry & Engineering Metrics</span>
            <span className="text-[10px] text-tech-cyan">POLLING RATE: 2 Hz</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">MQ-4 Methane ADC</span>
              <span className="text-slate-200 font-bold">{rawMq4.toFixed(1)} counts</span>
              <span className="text-[9px] text-slate-500 block">Baseline: 210</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">MQ-7 Carbon Monoxide</span>
              <span className="text-slate-200 font-bold">{((mq7Reading?.raw_value) || 195.0).toFixed(1)} counts</span>
              <span className="text-[9px] text-slate-500 block">Baseline: 190</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">Nadir MLX90614</span>
              <span className="text-slate-200 font-bold">{rawTemp.toFixed(2)} °C</span>
              <span className="text-[9px] text-slate-500 block">FOV: 35° Conical</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">Drone Coordinates</span>
              <span className="text-slate-200 font-bold">
                X: {telemetry?.position?.x?.toFixed(1) || 2.0}m, Y: {telemetry?.position?.y?.toFixed(1) || 2.0}m
              </span>
              <span className="text-[9px] text-slate-500 block">Alt: {telemetry?.position?.z?.toFixed(1) || 1.8}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
