"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Play } from "lucide-react";
import { getMissions, createMission, Mission } from "@/lib/api";

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Mission Form State
  const [title, setTitle] = useState("");
  const [trade, setTrade] = useState("gas_fitting");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [description, setDescription] = useState("");
  const [sensorMq4, setSensorMq4] = useState(true);
  const [sensorThermal, setSensorThermal] = useState(true);
  const [sensorMq7, setSensorMq7] = useState(false);
  const [sensorUv, setSensorUv] = useState(false);
  const [faultType, setFaultType] = useState("pipe_gas_leak");
  const [faultX, setFaultX] = useState(10.5);
  const [faultY, setFaultY] = useState(3.2);

  const loadData = async () => {
    try {
      const ms = await getMissions();
      setMissions(ms);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const requiredSensors = [];
      if (sensorMq4) requiredSensors.push("mq4_gas");
      if (sensorThermal) requiredSensors.push("thermal_ir");
      if (sensorMq7) requiredSensors.push("mq7_co");
      if (sensorUv) requiredSensors.push("uv_flame");

      const missionCode = `MSN-${trade.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      await createMission({
        mission_code: missionCode,
        title,
        trade,
        difficulty,
        description,
        inspection_bounds: { x_min: 0, x_max: 20, y_min: 0, y_max: 15, z_min: 0.5, z_max: 4.0 },
        required_sensors: requiredSensors,
        assessment_weights: { hazard_id: 30.0, location_accuracy: 25.0, coverage: 15.0, evidence: 15.0, safety: 15.0 },
        safety_critical_rules: { fail_on_unreported_critical_gas: true, fail_on_critical_hotspot_disregard: true },
        hidden_faults: [
          {
            fault_id: `FLT-${Date.now().toString().slice(-4)}`,
            fault_type: faultType,
            x: Number(faultX),
            y: Number(faultY),
            z: 1.8,
            radius_meters: 2.2,
            peak_intensity: 750.0,
            severity: "critical",
            description: "Custom trainer scenario simulated fault.",
          },
        ],
        environment_layout: {
          workshop_name: "Bay 4 Industrial Facility",
          dimensions: { width: 20.0, length: 15.0, height: 4.5 },
          pipes: [],
          valves: [],
          joints: [],
          workstations: [],
          obstacles: [],
        },
        simulation_seed: Math.floor(Math.random() * 1000),
      });

      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      alert(`Error creating mission: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-industrial-900 border border-industrial-800">
        <div>
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/30">
            TRAINING SCENARIO MANAGER
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Diagnostic Training Missions</h1>
          <p className="text-xs text-slate-400">
            Configure vocational scenarios with controlled hidden fault states, sensor requirements, and rubric weights.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold text-xs font-mono uppercase flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Custom Mission
        </button>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {missions.map((m) => (
          <div
            key={m.id}
            className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 flex flex-col justify-between hover:border-industrial-700 transition"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-industrial-800 text-tech-cyan border border-industrial-700 uppercase">
                  {m.trade}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                  m.difficulty === "beginner"
                    ? "text-tech-green bg-tech-green/10"
                    : m.difficulty === "intermediate"
                    ? "text-tech-amber bg-tech-amber/10"
                    : "text-red-400 bg-red-500/10"
                }`}>
                  {m.difficulty}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-100 font-mono tracking-tight">{m.title}</h3>
              <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">{m.description}</p>

              {/* Required Sensors List */}
              <div className="mt-4 pt-3 border-t border-industrial-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1.5">
                  Payload Sensors Required:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {m.required_sensors?.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-industrial-950 border border-industrial-800 text-slate-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Assessment Weights */}
              <div className="mt-3 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>Hazard ID: 30%</span>
                <span>Location: 25%</span>
                <span>Coverage: 15%</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-industrial-800 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">ID: {m.mission_code}</span>
              <Link
                href={`/live?missionId=${m.id}`}
                className="px-3.5 py-1.5 rounded-lg bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold text-xs font-mono uppercase flex items-center gap-1 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start Flight
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Create Mission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-industrial-950 border border-industrial-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 font-mono uppercase mb-4">
              Configure New Diagnostic Training Scenario
            </h3>

            <form onSubmit={handleCreateMission} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Scenario Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Gas Manifold Valve Seat Inspection"
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Vocational Trade</label>
                  <select
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="gas_fitting">Gas-Fitting</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="industrial_maintenance">Industrial Maintenance</option>
                    <option value="welding">Welding & Fabrication</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="beginner">Beginner (1 Fault, Low Noise)</option>
                    <option value="intermediate">Intermediate (Standard Dispersion)</option>
                    <option value="advanced">Advanced (Multi-hazard, Turbulence)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe inspection goals and safety containment requirements..."
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>

              {/* Sensor Selection */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Required Payload Sensors</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={sensorMq4}
                      onChange={(e) => setSensorMq4(e.target.checked)}
                      className="rounded bg-industrial-900"
                    />
                    MQ-4 Combustible Gas
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={sensorThermal}
                      onChange={(e) => setSensorThermal(e.target.checked)}
                      className="rounded bg-industrial-900"
                    />
                    Non-contact Thermal IR
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={sensorMq7}
                      onChange={(e) => setSensorMq7(e.target.checked)}
                      className="rounded bg-industrial-900"
                    />
                    MQ-7 Carbon Monoxide
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={sensorUv}
                      onChange={(e) => setSensorUv(e.target.checked)}
                      className="rounded bg-industrial-900"
                    />
                    UV Spectral Flame / Arc
                  </label>
                </div>
              </div>

              {/* Hidden Fault Config */}
              <div className="p-3 rounded-lg bg-industrial-900/60 border border-industrial-800">
                <span className="text-[10px] text-tech-cyan uppercase font-bold block mb-1">
                  Hidden Ground-Truth Fault Configuration (Trainer Only)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400">Fault Type</span>
                    <select
                      value={faultType}
                      onChange={(e) => setFaultType(e.target.value)}
                      className="w-full bg-industrial-950 border border-industrial-800 rounded p-1.5 text-slate-200"
                    >
                      <option value="pipe_gas_leak">Gas Leak</option>
                      <option value="hot_spot_overheating">Thermal Hotspot</option>
                      <option value="electrical_arcing">Arc Flash</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">X (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={faultX}
                      onChange={(e) => setFaultX(parseFloat(e.target.value))}
                      className="w-full bg-industrial-950 border border-industrial-800 rounded p-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Y (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={faultY}
                      onChange={(e) => setFaultY(parseFloat(e.target.value))}
                      className="w-full bg-industrial-950 border border-industrial-800 rounded p-1.5 text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-industrial-900 hover:bg-industrial-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-tech-cyan text-industrial-950 font-bold uppercase"
                >
                  Save Mission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
