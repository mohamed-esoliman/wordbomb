import { useSyncExternalStore } from 'react';

export interface SoundSettings {
  volume: number;
  muted: boolean;
}

export type SoundName =
  'tick' | 'accept' | 'reject' | 'explode' | 'lifeGained' | 'eliminated' | 'win' | 'turn';

export const SOUND_KEY = 'wordbomb:sound';
const DEFAULT_SETTINGS: SoundSettings = { volume: 0.6, muted: false };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSoundSettings(storage: StorageLike): SoundSettings {
  try {
    const parsed = JSON.parse(storage.getItem(SOUND_KEY) ?? '{}') as Partial<SoundSettings>;
    const volume =
      typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
        ? parsed.volume
        : DEFAULT_SETTINGS.volume;
    const muted = typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted;
    return { volume, muted };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function tickIntervalMs(intensity: number, safe: boolean): number {
  if (safe) return 1000;
  return Math.round(900 - Math.min(1, Math.max(0, intensity)) * 780);
}

interface Note {
  freq: number;
  at: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: SoundSettings;
  private readonly storage: StorageLike | null;
  private readonly listeners = new Set<() => void>();

  constructor(storage: StorageLike | null) {
    this.storage = storage;
    this.settings = storage ? loadSoundSettings(storage) : { ...DEFAULT_SETTINGS };
  }

  getSettings = (): SoundSettings => this.settings;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(patch: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      this.storage?.setItem(SOUND_KEY, JSON.stringify(this.settings));
    } catch {
      // storage unavailable; keep the in-memory value
    }
    if (this.master) this.master.gain.value = this.effectiveVolume();
    for (const listener of this.listeners) listener();
  }

  unlock(): void {
    const ctx = this.context();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  play(name: SoundName, intensity = 0): void {
    if (this.settings.muted || this.settings.volume === 0) return;
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'tick':
        this.notes([
          { freq: 700 + intensity * 700, at: t, duration: 0.04, type: 'square', gain: 0.12 },
        ]);
        break;
      case 'turn':
        this.notes([{ freq: 880, at: t, duration: 0.08, type: 'sine', gain: 0.2 }]);
        break;
      case 'accept':
        this.notes([
          { freq: 523, at: t, duration: 0.09, type: 'sine', gain: 0.25 },
          { freq: 784, at: t + 0.09, duration: 0.14, type: 'sine', gain: 0.25 },
        ]);
        break;
      case 'reject':
        this.notes([
          { freq: 180, at: t, duration: 0.2, type: 'sawtooth', gain: 0.18, slideTo: 120 },
        ]);
        break;
      case 'lifeGained':
        this.notes(
          [523, 659, 784, 1047].map((freq, i) => ({
            freq,
            at: t + i * 0.09,
            duration: 0.18,
            gain: 0.2,
          })),
        );
        break;
      case 'eliminated':
        this.notes(
          [392, 330, 262].map((freq, i) => ({
            freq,
            at: t + i * 0.16,
            duration: 0.22,
            type: 'triangle',
            gain: 0.22,
          })),
        );
        break;
      case 'win':
        this.notes(
          [523, 659, 784, 1047, 1319].map((freq, i) => ({
            freq,
            at: t + i * 0.12,
            duration: i === 4 ? 0.6 : 0.16,
            type: 'triangle',
            gain: 0.22,
          })),
        );
        break;
      case 'explode':
        this.explosion(ctx, t);
        break;
    }
  }

  private effectiveVolume(): number {
    return this.settings.muted ? 0 : this.settings.volume;
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.effectiveVolume();
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private notes(notes: Note[]): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? 'sine';
      osc.frequency.setValueAtTime(note.freq, note.at);
      if (note.slideTo)
        osc.frequency.exponentialRampToValueAtTime(note.slideTo, note.at + note.duration);
      gain.gain.setValueAtTime(0.0001, note.at);
      gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.2, note.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, note.at + note.duration);
      osc.connect(gain).connect(master);
      osc.start(note.at);
      osc.stop(note.at + note.duration + 0.02);
    }
  }

  private explosion(ctx: AudioContext, t: number): void {
    const master = this.master;
    if (!master) return;
    const length = Math.floor(ctx.sampleRate * 0.7);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    noise.connect(filter).connect(gain).connect(master);
    noise.start(t);
    noise.stop(t + 0.75);
    this.notes([{ freq: 70, at: t, duration: 0.5, type: 'sine', gain: 0.6, slideTo: 35 }]);
  }
}

export function useSoundSettings(engine: SoundEngine): SoundSettings {
  return useSyncExternalStore(engine.subscribe, engine.getSettings, engine.getSettings);
}
