"use client";

import React, { useState, useEffect } from "react";
import { Plus, Mail, Trash2 } from "lucide-react";
import { getTrainees, createTrainee, deleteTrainee, Trainee } from "@/lib/api";

export default function TraineesPage() {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState("gas_fitting");
  const [notes, setNotes] = useState("");

  const loadTrainees = async () => {
    try {
      const data = await getTrainees();
      setTrainees(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTrainees();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTrainee({
        trainee_code: code || `TR-2026-${Math.floor(Math.random() * 900 + 100)}`,
        name,
        email,
        trade_specialization: trade,
        notes,
      });
      setIsModalOpen(false);
      setName("");
      setEmail("");
      setNotes("");
      loadTrainees();
    } catch (e: any) {
      alert(`Error creating trainee: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this trainee profile?")) return;
    try {
      await deleteTrainee(id);
      loadTrainees();
    } catch (e: any) {
      alert(`Could not delete trainee: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-industrial-900 border border-industrial-800">
        <div>
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-blue/20 text-tech-blue border border-tech-blue/30">
            APPRENTICE REGISTRY
          </span>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Trainee Profiles & Competency History</h1>
          <p className="text-xs text-slate-400">
            Manage vocational apprentice records, certification milestones, and performance tracking.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-tech-cyan hover:bg-cyan-400 text-industrial-950 font-bold text-xs font-mono uppercase flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Trainee
        </button>
      </div>

      {/* Trainees List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {trainees.map((t) => (
          <div
            key={t.id}
            className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 flex flex-col justify-between hover:border-industrial-700 transition font-mono"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-tech-cyan">{t.trainee_code}</span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-industrial-800 text-slate-300">
                  {t.trade_specialization.replace("_", " ")}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-100 font-sans tracking-tight">{t.name}</h3>
              {t.email && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 truncate">
                  <Mail className="w-3.5 h-3.5" /> {t.email}
                </p>
              )}

              {t.notes && (
                <p className="text-xs text-slate-400 mt-3 font-sans line-clamp-2 leading-relaxed bg-industrial-950/50 p-2.5 rounded-lg border border-industrial-850">
                  {t.notes}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-industrial-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Completed</span>
                  <span className="text-base font-bold text-slate-200">
                    {t.completed_sessions_count || 0} Missions
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Avg Score</span>
                  <span className="text-base font-bold text-tech-cyan">
                    {t.average_score ? `${t.average_score} / 100` : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-industrial-800 flex justify-end">
              <button
                onClick={() => handleDelete(t.id)}
                className="text-red-400 hover:text-red-300 p-1 text-xs flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-industrial-950 border border-industrial-700 rounded-2xl shadow-2xl p-6 font-mono text-xs">
            <h3 className="text-base font-bold text-slate-100 font-mono uppercase mb-4">
              Register Trainee Apprentice
            </h3>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 mb-1">Trainee Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. TR-2026-004"
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cameron Diaz"
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cameron.diaz@trade.edu"
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Trade Specialization</label>
                <select
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-100"
                >
                  <option value="gas_fitting">Gas-Fitting</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="industrial_maintenance">Industrial Maintenance</option>
                  <option value="welding">Welding</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Notes / Background</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Apprenticeship level, prior safety certifications..."
                  className="w-full bg-industrial-900 border border-industrial-800 rounded-lg p-2 text-slate-100"
                />
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
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
