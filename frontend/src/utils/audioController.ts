/**
 * SkillDrone Audio & Spoken Announcement Controller (Web Speech API + Web Audio API)
 * Features:
 * - Natural browser-native speech synthesis with voice selection and rate control
 * - Synthesized multi-frequency audio alert chimes (Info, Warning, Critical)
 * - Anti-flooding duplicate suppression and priority preemption
 * - User-gesture autoplay unlock
 * - Transcript history tracking
 */

export interface AnnouncementItem {
  id: string;
  timestamp: string;
  text: string;
  priority: "info" | "warning" | "critical";
  category?: string;
  associatedObjectId?: string | null;
}

class AudioController {
  private audioCtx: AudioContext | null = null;
  private isAudioEnabled: boolean = false;
  private isMuted: boolean = false;
  private speechVolume: number = 1.0;
  private speechRate: number = 1.05;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private lastSpokenText: string = "";
  private lastSpokenTime: number = 0;
  private transcriptHistory: AnnouncementItem[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoice();
      };
      this.initVoice();
    }
  }

  private initVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer English natural voices
    const preferred = voices.find(
      (v) => (v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Daniel")))
    ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];
    if (preferred) {
      this.selectedVoice = preferred;
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getTranscript(): AnnouncementItem[] {
    return [...this.transcriptHistory];
  }

  public getAudioEnabled(): boolean {
    return this.isAudioEnabled;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.notify();
  }

  public setVolume(vol: number) {
    this.speechVolume = Math.max(0.0, Math.min(1.0, vol));
    this.notify();
  }

  public setRate(rate: number) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
    this.notify();
  }

  public async enableAudio(): Promise<boolean> {
    try {
      if (typeof window === "undefined") return false;
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === "suspended") {
          await this.audioCtx.resume();
        }
      }
      this.isAudioEnabled = true;
      this.playChime("info");
      this.announce({
        text: "Audio and spoken announcements online.",
        priority: "info",
        category: "system"
      });
      this.notify();
      return true;
    } catch (e) {
      console.warn("Failed to initialize Web Audio:", e);
      return false;
    }
  }

  /**
   * Synthesizes alert chimes using dual Web Audio oscillators
   */
  public playChime(type: "info" | "warning" | "critical") {
    if (!this.isAudioEnabled || this.isMuted) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }
      const ctx = this.audioCtx;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "info") {
        // Soft ascending two-tone blip
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.12);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18 * this.speechVolume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "warning") {
        // Double caution beep (440Hz / 880Hz)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.28 * this.speechVolume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else {
        // High urgency critical alarm warble
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.12);
        osc.frequency.linearRampToValueAtTime(800, now + 0.24);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35 * this.speechVolume, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn("Chime playback error:", e);
    }
  }

  /**
   * Natural Spoken Announcement with anti-flooding and critical preemption
   */
  public announce(item: {
    text: string;
    priority?: "info" | "warning" | "critical";
    category?: string;
    associatedObjectId?: string | null;
  }) {
    const priority = item.priority || "info";
    const text = item.text.trim();
    if (!text) return;

    // Log to transcript history
    const transcriptEntry: AnnouncementItem = {
      id: "ann-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      text,
      priority,
      category: item.category,
      associatedObjectId: item.associatedObjectId,
    };
    this.transcriptHistory.unshift(transcriptEntry);
    if (this.transcriptHistory.length > 50) {
      this.transcriptHistory.pop();
    }
    this.notify();

    // Check audio mute or uninitialized
    if (!this.isAudioEnabled || this.isMuted) return;

    // Duplicate suppression within 8 seconds for identical text
    const now = Date.now();
    if (text === this.lastSpokenText && now - this.lastSpokenTime < 8000 && priority !== "critical") {
      return;
    }
    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    // Play audible chime before speech
    this.playChime(priority);

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    // Critical alerts cancel any ongoing speech immediately
    if (priority === "critical") {
      synth.cancel();
    } else if (synth.speaking && priority === "info") {
      // Don't flood queue if already speaking info
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.volume = this.speechVolume;
    utterance.rate = this.speechRate;
    utterance.pitch = priority === "critical" ? 1.15 : 1.0;

    synth.speak(utterance);
  }

  public testSpeaker() {
    this.playChime("warning");
    this.announce({
      text: "Speaker test in progress. Audio and voice systems are operating nominally.",
      priority: "info",
      category: "test"
    });
  }
}

export const audioController = new AudioController();
