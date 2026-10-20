import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "SkillDrone — Intelligent Diagnostic Training Platform",
  description: "Vocational drone-assisted diagnostic inspection and competency assessment system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-industrial-950 text-slate-100 flex flex-col font-sans">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-industrial-800 bg-industrial-950/80 py-4 text-center text-xs text-slate-400 font-mono">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>SkillDrone Autonomous Vocational Training Platform</span>
            <span className="text-slate-400 text-[11px]">
              Educational Diagnostic Simulation • Not Certified for Industrial Safety Compliance
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
