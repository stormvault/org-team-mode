import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private soundEnabledSignal = signal<boolean>(true);
  public readonly soundEnabled = this.soundEnabledSignal.asReadonly();

  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('habitflow_sound_enabled');
      if (saved !== null) {
        this.soundEnabledSignal.set(saved === 'true');
      }
    }
  }

  public toggleSound(): boolean {
    const newVal = !this.soundEnabledSignal();
    this.soundEnabledSignal.set(newVal);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('habitflow_sound_enabled', String(newVal));
    }
    return newVal;
  }

  public playCheckin(): void {
    if (!this.soundEnabledSignal()) return;
    this.synthesizeChime([
      { freq: 523.25, duration: 0.08, delay: 0 },    // C5
      { freq: 783.99, duration: 0.12, delay: 0.07 }  // G5
    ]);
  }

  public playIntervalTrigger(): void {
    if (!this.soundEnabledSignal()) return;
    this.synthesizeChime([
      { freq: 659.25, duration: 0.12, delay: 0 },    // E5
      { freq: 783.99, duration: 0.12, delay: 0.12 }, // G5
      { freq: 1046.50, duration: 0.35, delay: 0.24 } // C6
    ]);
  }

  private synthesizeChime(notes: { freq: number; duration: number; delay: number }[]): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      notes.forEach(note => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, now + note.delay);

        gain.gain.setValueAtTime(0.001, now + note.delay);
        gain.gain.exponentialRampToValueAtTime(0.18, now + note.delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + note.delay);
        osc.stop(now + note.delay + note.duration + 0.05);
      });
    } catch {
      // Audio playback fails gracefully if unpermitted
    }
  }
}
