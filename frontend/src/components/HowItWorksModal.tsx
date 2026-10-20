"use client";

import React from "react";
import { X, Radar } from "lucide-react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-3xl w-full bg-industrial-900 border border-industrial-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-industrial-800 bg-industrial-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-tech-cyan/20 border border-tech-cyan/40 flex items-center justify-center text-tech-cyan">
              <Radar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">How SkillDrone Works</h2>
              <p className="text-xs text-slate-400">An SIH Evaluator&apos;s Guide to the Diagnostic Workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Overview Banner */}
          <div className="p-4 rounded-xl bg-industrial-850 border border-industrial-800 text-xs leading-relaxed text-slate-300">
            <strong className="text-tech-cyan block text-sm font-semibold mb-1">
              What is SkillDrone?
            </strong>
            SkillDrone is a safe, software-simulated training platform that prepares vocational trainees 
            (plumbers, gas fitters, maintenance technicians) to inspect dangerous industrial facilities using drones. 
            Instead of exposing novices to real toxic gas or high-voltage arcing, trainees learn to interpret live sensor 
            telemetry, analyze visual camera feeds, make emergency isolation decisions, and receive instant 100-point competency scores.
          </div>

          {/* 4-Step Illustrated Process */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              The 4-Step Assessment Workflow
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 space-y-1.5">
                <div className="flex items-center gap-2 text-tech-cyan">
                  <span className="w-5 h-5 rounded-full bg-tech-cyan/20 text-tech-cyan text-xs font-bold flex items-center justify-center">1</span>
                  <span className="font-bold text-xs uppercase font-mono">Survey Facility</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The drone patrols pre-mapped industrial corridors, streaming first-person 3D camera feeds and simulated gas, thermal, and UV readings.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 space-y-1.5">
                <div className="flex items-center gap-2 text-tech-amber">
                  <span className="w-5 h-5 rounded-full bg-tech-amber/20 text-tech-amber text-xs font-bold flex items-center justify-center">2</span>
                  <span className="font-bold text-xs uppercase font-mono">Sensor & Vision Fusion</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Methane is invisible to standard cameras. SkillDrone measures gas concentration with sensors and correlates spikes with physical pipe joints recognized by computer vision.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 space-y-1.5">
                <div className="flex items-center gap-2 text-tech-blue">
                  <span className="w-5 h-5 rounded-full bg-tech-blue/20 text-tech-blue text-xs font-bold flex items-center justify-center">3</span>
                  <span className="font-bold text-xs uppercase font-mono">Voice Alerts & Reinspection</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When anomalies occur, the system speaks audible warnings and commands the drone to hover and gather persistent evidence before finalizing conclusions.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 space-y-1.5">
                <div className="flex items-center gap-2 text-tech-green">
                  <span className="w-5 h-5 rounded-full bg-tech-green/20 text-tech-green text-xs font-bold flex items-center justify-center">4</span>
                  <span className="font-bold text-xs uppercase font-mono">Competency Scoring</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The assessment engine compares trainee findings against hidden ground-truth faults across 5 rubric dimensions, with instant fail overrides on critical safety errors.
                </p>
              </div>
            </div>
          </div>

          {/* Quick FAQ / Key Concept Clarifications */}
          <div className="space-y-2.5 pt-2 border-t border-industrial-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Key Concepts Explained Simply
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-850">
                <span className="font-bold text-slate-200 block mb-0.5">Why Simulation Mode?</span>
                <span className="text-slate-400 text-[11px] leading-relaxed">
                  This demo is a realistic software simulation designed to run offline on any laptop without needing physical drone hardware, gas canisters, or ignition risks.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-850">
                <span className="font-bold text-slate-200 block mb-0.5">Ground-Truth Isolation</span>
                <span className="text-slate-400 text-[11px] leading-relaxed">
                  The instructor&apos;s reference answer (fault location and leak size) is hidden on the server so trainees cannot cheat before inspecting.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-industrial-800 bg-industrial-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-tech-cyan text-industrial-950 font-bold text-xs uppercase font-mono tracking-wider hover:bg-cyan-400 transition"
          >
            Got it, Let&apos;s Inspect
          </button>
        </div>
      </div>
    </div>
  );
}
