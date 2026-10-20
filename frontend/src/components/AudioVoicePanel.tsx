"use client";

import React, { useState, useEffect } from "react";
import { 
  Volume2, 
  VolumeX, 
  Radio, 
  MessageSquare, 
  RotateCcw
} from "lucide-react";
import { audioController, AnnouncementItem } from "@/utils/audioController";

interface AudioVoicePanelProps {
  className?: string;
  compact?: boolean;
}

export default function AudioVoicePanel({ className = "", compact = false }: AudioVoicePanelProps) {
  const [transcript, setTranscript] = useState<AnnouncementItem[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  useEffect(() => {
    // Initial state
    setIsEnabled(audioController.getAudioEnabled());
    setIsMuted(audioController.getMuted());
    setTranscript(audioController.getTranscript());

    // Subscribe to updates
    const unsubscribe = audioController.subscribe(() => {
      setIsEnabled(audioController.getAudioEnabled());
      setIsMuted(audioController.getMuted());
      setTranscript(audioController.getTranscript());
    });

    return () => unsubscribe();
  }, []);

  const handleEnableAudio = async () => {
    await audioController.enableAudio();
  };

  const handleToggleMute = () => {
    audioController.setMuted(!isMuted);
  };

  const handleRepeatLast = () => {
    if (transcript.length > 0) {
      audioController.announce({
        text: transcript[0].text,
        priority: transcript[0].priority,
        category: "repeat",
      });
    }
  };

  return (
    <div className={`rounded-xl border border-industrial-800 bg-industrial-950/90 shadow-xl overflow-hidden flex flex-col font-mono text-xs ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-industrial-900 border-b border-industrial-800">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-tech-cyan animate-pulse" />
          <span className="font-bold text-slate-100 uppercase tracking-wide">
            Voice Announcements & Controller Audio
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEnabled ? (
            <button
              onClick={handleEnableAudio}
              className="px-2.5 py-1 rounded bg-tech-cyan/20 hover:bg-tech-cyan/30 text-tech-cyan border border-tech-cyan/40 font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] animate-pulse"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>ENABLE AUDIO</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleMute}
                className={`p-1.5 rounded transition-colors ${isMuted ? "bg-red-950/80 text-red-400 border border-red-500/40" : "bg-industrial-800 text-slate-200 hover:text-white"}`}
                title={isMuted ? "Unmute Announcements" : "Mute Announcements"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => audioController.testSpeaker()}
                className="px-2 py-1 rounded bg-industrial-800 hover:bg-industrial-700 text-slate-300 text-[10px] transition-colors"
              >
                TEST
              </button>

              <button
                onClick={handleRepeatLast}
                disabled={transcript.length === 0}
                className="px-2 py-1 rounded bg-industrial-800 hover:bg-industrial-700 text-slate-300 text-[10px] disabled:opacity-40 transition-colors flex items-center gap-1"
                title="Repeat Last Message"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>REPEAT</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transcript Log Container */}
      <div className={`p-3 overflow-y-auto space-y-2 ${compact ? "max-h-48" : "max-h-64"}`}>
        {transcript.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-[11px] flex flex-col items-center gap-1.5">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <span>Standing by. Spoken alerts will appear here as telemetry events occur.</span>
            {!isEnabled && (
              <span className="text-tech-cyan font-bold mt-1">
                Click &quot;Enable Audio&quot; above to initialize browser voice synthesis.
              </span>
            )}
          </div>
        ) : (
          transcript.map((item) => {
            const isCrit = item.priority === "critical";
            const isWarn = item.priority === "warning";
            const borderCol = isCrit ? "border-red-500/50 bg-red-950/30" : isWarn ? "border-amber-500/40 bg-amber-950/20" : "border-industrial-800 bg-industrial-900/50";
            const tagCol = isCrit ? "text-red-400 bg-red-950 border-red-500/40" : isWarn ? "text-amber-400 bg-amber-950 border-amber-500/40" : "text-tech-cyan bg-industrial-900 border-tech-cyan/30";

            return (
              <div key={item.id} className={`p-2.5 rounded-lg border ${borderCol} transition-all`}>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className={`px-1.5 py-0.5 rounded border uppercase font-bold text-[9px] ${tagCol}`}>
                    {item.priority}
                  </span>
                  <span>{item.timestamp}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isCrit ? "text-red-200 font-semibold" : isWarn ? "text-amber-200" : "text-slate-200"}`}>
                  &ldquo;{item.text}&rdquo;
                </p>
                {item.associatedObjectId && (
                  <div className="mt-1 text-[10px] text-tech-cyan font-bold">
                    &bull; Correlated Asset: {item.associatedObjectId}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Strip */}
      <div className="px-3.5 py-2 bg-industrial-900/70 border-t border-industrial-800 text-[10px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isEnabled && !isMuted ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span>SPEAKER: {isEnabled ? (isMuted ? "MUTED" : "SYNTHESIS ONLINE") : "UNINITIALIZED"}</span>
        </div>
        <span className="text-slate-500">ANTI-FLOOD COOLDOWN ACTIVE</span>
      </div>
    </div>
  );
}
