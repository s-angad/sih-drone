"use client";

import React from "react";
import { Flame, Thermometer, Wind, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { SingleSensorReading } from "@/lib/api";

interface SensorCardProps {
  reading: SingleSensorReading;
  thresholds?: {
    normal_max?: number;
    suspected_min?: number;
    critical_min?: number;
  };
}

export default function SensorCard({ reading, thresholds }: SensorCardProps) {
  const { sensor_type, raw_value, calibrated_value, unit, sensor_health } = reading;

  // Determine sensor display label and icon
  let label = sensor_type;
  let Icon = Wind;
  let maxScale = 1000;

  if (sensor_type === "mq4_gas") {
    label = "MQ-4 Methane / Natural Gas";
    Icon = Flame;
    maxScale = 1200;
  } else if (sensor_type === "mq7_co") {
    label = "MQ-7 Carbon Monoxide (CO)";
    Icon = Wind;
    maxScale = 1000;
  } else if (sensor_type === "thermal_ir") {
    label = "Non-contact Thermal IR";
    Icon = Thermometer;
    maxScale = 120; // degC
  } else if (sensor_type === "uv_flame") {
    label = "UV Spectral Flame / Arc";
    Icon = Zap;
    maxScale = 60; // uW/cm2
  }

  // Calculate status level based on thresholds
  const critMin = thresholds?.critical_min ?? (sensor_type === "thermal_ir" ? 75 : 750);
  const suspMin = thresholds?.suspected_min ?? (sensor_type === "thermal_ir" ? 50 : 420);

  const isCritical = raw_value >= critMin;
  const isSuspected = !isCritical && raw_value >= suspMin;

  const pct = Math.min(100, Math.max(0, (raw_value / maxScale) * 100));

  let borderColor = "border-industrial-800";
  let statusBadge = (
    <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-tech-green/10 text-tech-green border border-tech-green/20">
      <CheckCircle2 className="w-2.5 h-2.5" /> NOMINAL
    </span>
  );

  if (isCritical) {
    borderColor = "border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.25)]";
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
        <AlertCircle className="w-2.5 h-2.5" /> CRITICAL
      </span>
    );
  } else if (isSuspected) {
    borderColor = "border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]";
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
        <AlertCircle className="w-2.5 h-2.5" /> ELEVATED
      </span>
    );
  }

  return (
    <div className={`p-4 rounded-xl bg-industrial-900 border ${borderColor} transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isCritical ? "bg-red-500/20 text-red-400" : isSuspected ? "bg-amber-500/20 text-amber-400" : "bg-tech-cyan/10 text-tech-cyan"
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200 tracking-wide">{label}</h4>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              {sensor_health === "nominal" ? (
                <span className="text-slate-400">HEALTH: OK</span>
              ) : (
                <span className="text-amber-400 font-bold">HEALTH: {sensor_health}</span>
              )}
            </span>
          </div>
        </div>
        <div>{statusBadge}</div>
      </div>

      {/* Numerical Values */}
      <div className="flex items-baseline justify-between mt-3 mb-2 font-mono">
        <div>
          <span className="text-2xl font-bold text-slate-100 tracking-tight">
            {typeof raw_value === "number" ? raw_value.toFixed(1) : raw_value}
          </span>
          <span className="text-xs text-slate-400 ml-1.5">{unit}</span>
        </div>

        {calibrated_value !== undefined && calibrated_value !== null && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Estimated / Equiv</span>
            <span className="text-xs font-semibold text-tech-cyan">
              {calibrated_value.toFixed(1)} {sensor_type === "thermal_ir" ? "°C" : "est. ppm"}
            </span>
          </div>
        )}
      </div>

      {/* Gauge Bar */}
      <div className="w-full h-2 rounded-full bg-industrial-950 overflow-hidden relative">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isCritical
              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              : isSuspected
              ? "bg-amber-400"
              : "bg-tech-cyan"
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Suspected threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-300 opacity-60"
          style={{ left: `${(suspMin / maxScale) * 100}%` }}
          title={`Suspected threshold: ${suspMin}`}
        />
        {/* Critical threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-80"
          style={{ left: `${(critMin / maxScale) * 100}%` }}
          title={`Critical threshold: ${critMin}`}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5">
        <span>0</span>
        <span>Warn: {suspMin}</span>
        <span>Crit: {critMin}</span>
        <span>{maxScale}</span>
      </div>
    </div>
  );
}
