"use client";

import React, { useState, useEffect } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { getSessions, getSessionHazards, updateHazardReview, TrainingSession, HazardEvent } from "@/lib/api";

export default function HazardsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [hazards, setHazards] = useState<HazardEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      try {
        const ses = await getSessions();
        setSessions(ses);
        if (ses.length > 0) {
          setSelectedSessionId(ses[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadSessions();
  }, []);

  const loadHazards = async (sId: string) => {
    if (!sId) return;
    try {
      setIsLoading(true);
      const data = await getSessionHazards(sId);
      setHazards(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadHazards(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleUpdateStatus = async (hazardId: string, newStatus: string) => {
    try {
      await updateHazardReview(hazardId, newStatus);
      setHazards((prev) =>
        prev.map((h) => (h.id === hazardId ? { ...h, review_status: newStatus as any } : h))
      );
    } catch (e: any) {
      alert(`Could not update review status: ${e.message}`);
    }
  };

  const filteredHazards = hazards.filter((h) => {
    if (filterSeverity === "all") return true;
    return h.severity === filterSeverity;
  });

  const criticalCount = hazards.filter((h) => h.severity === "critical").length;
  const suspectedCount = hazards.filter((h) => h.severity === "suspected").length;
  const confirmedCount = hazards.filter((h) => h.review_status === "confirmed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-industrial-900 border border-industrial-800">
        <div>
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-amber/20 text-tech-amber border border-tech-amber/30">
            AUDIT TELEMETRY LOGS
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Hazard Detection & Localization Engine</h1>
          <p className="text-xs text-slate-400">
            Recorded sensor threshold exceedances, persistence filters, confidence scoring, and review logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-tech-cyan"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_code} ({s.status})
              </option>
            ))}
          </select>

          <button
            onClick={() => loadHazards(selectedSessionId)}
            className="p-2 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
          <span className="text-[10px] text-slate-400 uppercase">Total Logged Events</span>
          <div className="text-2xl font-bold text-slate-100">{hazards.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
          <span className="text-[10px] text-red-400 uppercase">Critical Exceedances</span>
          <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
          <span className="text-[10px] text-amber-400 uppercase">Suspected Anomalies</span>
          <div className="text-2xl font-bold text-amber-400">{suspectedCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 font-mono">
          <span className="text-[10px] text-tech-green uppercase">Trainee / Instructor Confirmed</span>
          <div className="text-2xl font-bold text-tech-green">{confirmedCount}</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Filter className="w-4 h-4 text-tech-cyan" />
            <span className="text-slate-300">Severity Filter:</span>
            {["all", "critical", "suspected", "inconclusive"].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded text-[11px] uppercase transition ${
                  filterSeverity === sev
                    ? "bg-tech-cyan text-industrial-950 font-bold"
                    : "bg-industrial-950 text-slate-400 hover:text-slate-200"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing {filteredHazards.length} of {hazards.length} events
          </span>
        </div>

        {/* Hazard Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-slate-400 uppercase border-b border-industrial-800 bg-industrial-950/60">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Sensor</th>
                <th className="py-2.5 px-3">Raw / Value</th>
                <th className="py-2.5 px-3">Coordinates (m)</th>
                <th className="py-2.5 px-3">Rule & Confidence</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Audit Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              {filteredHazards.length > 0 ? (
                filteredHazards.map((h) => (
                  <tr key={h.id} className="hover:bg-industrial-850/40 transition">
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(h.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200 uppercase">{h.sensor_type}</td>
                    <td className="py-3 px-3 text-slate-100">
                      <span className="font-bold">{h.raw_value.toFixed(1)}</span> {h.measurement_unit}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      X: {h.position_x.toFixed(1)}, Y: {h.position_y.toFixed(1)}, Z: {h.position_z.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <span className="text-slate-200 block truncate">{h.rule_name}</span>
                      <span className="text-[10px] text-slate-400">Conf: {(h.confidence * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        h.severity === "critical"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      }`}>
                        {h.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateStatus(h.id, "confirmed")}
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition ${
                            h.review_status === "confirmed"
                              ? "bg-tech-green text-industrial-950"
                              : "bg-industrial-950 hover:bg-tech-green/20 text-tech-green border border-tech-green/30"
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(h.id, "false_positive")}
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition ${
                            h.review_status === "false_positive"
                              ? "bg-red-500 text-white"
                              : "bg-industrial-950 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          False Alarm
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No hazard events recorded for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
