"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Radar, 
  Activity, 
  AlertTriangle, 
  Users, 
  Settings as SettingsIcon, 
  Cpu, 
  LayoutDashboard, 
  Camera, 
  ChevronDown, 
  Layers, 
  FileText
} from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const advancedTools = [
    { name: "Live Mission Control", href: "/live", icon: Radar },
    { name: "Drone Vision Suite", href: "/vision", icon: Camera },
    { name: "Hazard Telemetry", href: "/hazards", icon: AlertTriangle },
    { name: "Trainees", href: "/trainees", icon: Users },
    { name: "ESP32 Hardware Bridge", href: "/hardware", icon: Cpu },
    { name: "Trainer Settings", href: "/settings", icon: SettingsIcon },
  ];

  return (
    <header className="border-b border-industrial-800 bg-industrial-950/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Simulation Mode Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-tech-cyan/15 border border-tech-cyan/40 flex items-center justify-center text-tech-cyan shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                <Radar className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-wider text-slate-100 uppercase">
                    Skill<span className="text-tech-cyan">Drone</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    SIMULATION MODE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">
                  SIH Vocational Diagnostic Assessment Platform
                </p>
              </div>
            </Link>
          </div>

          {/* Minimal Evaluator Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 font-mono text-xs">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/"
                  ? "bg-tech-cyan text-industrial-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                  : "text-slate-300 hover:text-white hover:bg-industrial-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Guided Demo</span>
            </Link>

            <Link
              href="/missions"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/missions"
                  ? "bg-industrial-800 text-tech-cyan border border-tech-cyan/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-industrial-900"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Missions</span>
            </Link>

            <Link
              href="/replay"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                pathname === "/replay"
                  ? "bg-industrial-800 text-tech-cyan border border-tech-cyan/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-industrial-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reports</span>
            </Link>

            {/* Advanced Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-industrial-900 transition-colors"
                title="Advanced Tools & Hardware Settings"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tools</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isToolsOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-industrial-900 border border-industrial-800 shadow-2xl p-1.5 z-50 text-xs font-mono space-y-0.5"
                  onMouseLeave={() => setIsToolsOpen(false)}
                >
                  {advancedTools.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = pathname === tool.href;
                    return (
                      <Link
                        key={tool.name}
                        href={tool.href}
                        onClick={() => setIsToolsOpen(false)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-tech-cyan/20 text-tech-cyan font-bold"
                            : "text-slate-300 hover:bg-industrial-800 hover:text-white"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tool.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right Status Indicators */}
          <div className="flex items-center gap-2.5 font-mono text-xs">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-industrial-900 border border-industrial-800 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-tech-green animate-ping" />
              <span className="text-slate-300 hidden sm:inline">TELEMETRY: <strong className="text-tech-green">ONLINE</strong></span>
              <span className="text-tech-green sm:hidden font-bold">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-industrial-850 px-2 py-2 text-[11px] font-mono">
        <Link
          href="/"
          className={`px-2.5 py-1 rounded ${pathname === "/" ? "bg-tech-cyan text-industrial-950 font-bold" : "text-slate-400"}`}
        >
          Guided Demo
        </Link>
        <Link
          href="/missions"
          className={`px-2.5 py-1 rounded ${pathname === "/missions" ? "bg-tech-cyan text-industrial-950 font-bold" : "text-slate-400"}`}
        >
          Missions
        </Link>
        <Link
          href="/replay"
          className={`px-2.5 py-1 rounded ${pathname === "/replay" ? "bg-tech-cyan text-industrial-950 font-bold" : "text-slate-400"}`}
        >
          Reports
        </Link>
        <Link
          href="/live"
          className={`px-2.5 py-1 rounded ${pathname === "/live" ? "bg-tech-cyan text-industrial-950 font-bold" : "text-slate-400"}`}
        >
          Live FPV
        </Link>
      </div>
    </header>
  );
}
