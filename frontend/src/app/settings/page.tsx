"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Save, Cpu, Gauge } from "lucide-react";
import { getSettings, updateSettings, updateThresholds } from "@/lib/api";

export default function SettingsPage() {
  const [isSaved, setIsSaved] = useState(false);

  // Form states
  const [mq4Sus, setMq4Sus] = useState(420);
  const [mq4Crit, setMq4Crit] = useState(750);
  const [thermalSus, setThermalSus] = useState(52);
  const [thermalCrit, setThermalCrit] = useState(78);
  const [dataSource, setDataSource] = useState("simulation");
  const [simSpeed, setSimSpeed] = useState("1.0");

  const loadData = async () => {
    try {
      const data = await getSettings();

      if (data.sensor_thresholds?.mq4_gas) {
        setMq4Sus(data.sensor_thresholds.mq4_gas.suspected_min);
        setMq4Crit(data.sensor_thresholds.mq4_gas.critical_min);
      }
      if (data.sensor_thresholds?.thermal_ir) {
        setThermalSus(data.sensor_thresholds.thermal_ir.suspected_min);
        setThermalCrit(data.sensor_thresholds.thermal_ir.critical_min);
      }
      if (data.configurations?.DATA_SOURCE_MODE) {
        setDataSource(data.configurations.DATA_SOURCE_MODE);
      }
      if (data.configurations?.SIMULATION_SPEED_MULTIPLIER) {
        setSimSpeed(data.configurations.SIMULATION_SPEED_MULTIPLIER);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        DATA_SOURCE_MODE: dataSource,
        SIMULATION_SPEED_MULTIPLIER: simSpeed,
      });

      await updateThresholds({
        mq4_gas: { suspected_min: Number(mq4Sus), critical_min: Number(mq4Crit) },
        thermal_ir: { suspected_min: Number(thermalSus), critical_min: Number(thermalCrit) },
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e: any) {
      alert(`Error saving settings: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-industrial-900 border border-industrial-800">
        <div>
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/30">
            SYSTEM CALIBRATION
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Trainer Settings & Sensitivity Thresholds</h1>
          <p className="text-xs text-slate-400">
            Configure diagnostic thresholds, physics simulation speed, and payload ingestion modes.
          </p>
        </div>
      </div>

      {/* Prominent Educational Notice */}
      <div className="p-4 rounded-xl bg-tech-amber/10 border border-tech-amber/30 text-xs font-mono text-tech-amber flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold uppercase tracking-wider">Occupational Health & Educational Disclaimer</h4>
          <p className="mt-1 leading-relaxed text-slate-300">
            Threshold adjustments configured here modify the pedagogical sensitivity of the automated
            hazard event detector. These values are designed for simulated training scenarios and must NOT be used
            as certified industrial safety limits or occupational exposure compliance values (OSHA/NIOSH/SafeWork).
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Sensor Thresholds Grid */}
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-100 font-mono uppercase flex items-center gap-2">
            <Gauge className="w-4 h-4 text-tech-cyan" /> Sensor Diagnostic Thresholds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* MQ-4 Combustible Gas */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 space-y-3">
              <span className="font-bold text-slate-200 uppercase block">
                MQ-4 Combustible Gas (ADC counts)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-amber-400">Suspected Min Threshold</span>
                  <input
                    type="number"
                    value={mq4Sus}
                    onChange={(e) => setMq4Sus(parseInt(e.target.value))}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded p-2 text-slate-100 mt-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-red-400">Critical Min Threshold</span>
                  <input
                    type="number"
                    value={mq4Crit}
                    onChange={(e) => setMq4Crit(parseInt(e.target.value))}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded p-2 text-slate-100 mt-1"
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block">Baseline clean air: ~200 ADC counts</span>
            </div>

            {/* Thermal IR */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 space-y-3">
              <span className="font-bold text-slate-200 uppercase block">
                Non-contact Thermal IR Temperature (°C)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-amber-400">Suspected Hotspot Min (°C)</span>
                  <input
                    type="number"
                    value={thermalSus}
                    onChange={(e) => setThermalSus(parseInt(e.target.value))}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded p-2 text-slate-100 mt-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-red-400">Critical Runaway Min (°C)</span>
                  <input
                    type="number"
                    value={thermalCrit}
                    onChange={(e) => setThermalCrit(parseInt(e.target.value))}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded p-2 text-slate-100 mt-1"
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block">Ambient workshop nominal: ~24.5 °C</span>
            </div>
          </div>
        </div>

        {/* Operational Modes */}
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4 font-mono text-xs">
          <h2 className="text-sm font-bold text-slate-100 uppercase flex items-center gap-2">
            <Cpu className="w-4 h-4 text-tech-cyan" /> Data Source & Simulation Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5 font-semibold">Active Telemetry Ingestion Mode</label>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2.5 text-slate-200"
              >
                <option value="simulation">Deterministic Simulated Drone Physics (Virtual Mode)</option>
                <option value="hardware_esp32">ESP32 Hardware Payload Bridge (Physical Drone Mode)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-semibold">Simulation Speed Multiplier</label>
              <select
                value={simSpeed}
                onChange={(e) => setSimSpeed(e.target.value)}
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg p-2.5 text-slate-200"
              >
                <option value="0.5">0.5x (Slow Training Flight)</option>
                <option value="1.0">1.0x (Standard Real-time 1.2 m/s)</option>
                <option value="2.0">2.0x (Fast Demonstration Speed)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between">
          {isSaved ? (
            <span className="text-xs font-mono text-tech-green flex items-center gap-1.5">
              ✓ Calibration settings successfully saved to database.
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold font-mono text-xs uppercase flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
