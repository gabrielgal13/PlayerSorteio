'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import type { EventMusicTrack } from '@/types';

interface ActiveLoop {
  ctx: AudioContext;
  master: GainNode;
  intervalId: number;
  oscillators: OscillatorNode[];
}

const PATTERNS: Record<Exclude<EventMusicTrack, 'off'>, {
  bpm: number;
  bassNotes: number[];
  leadNotes: number[];
  waveBass: OscillatorType;
  waveLead: OscillatorType;
  volume: number;
}> = {
  cyberpunk: {
    bpm: 100,
    bassNotes: [55, 55, 73, 65],
    leadNotes: [220, 261, 329, 220, 293, 261, 246, 220],
    waveBass: 'sawtooth',
    waveLead: 'square',
    volume: 0.07,
  },
  epic: {
    bpm: 80,
    bassNotes: [65, 65, 87, 73],
    leadNotes: [261, 329, 392, 523, 392, 329, 261, 329],
    waveBass: 'triangle',
    waveLead: 'sine',
    volume: 0.08,
  },
  lofi: {
    bpm: 70,
    bassNotes: [49, 49, 65, 55],
    leadNotes: [196, 261, 246, 220, 196, 261, 246, 220],
    waveBass: 'sine',
    waveLead: 'triangle',
    volume: 0.06,
  },
};

export function useEventMusic() {
  const audioEnabled = useStore(s => s.audioEnabled);
  const eventMusic = useStore(s => s.eventMusic);
  const loopRef = useRef<ActiveLoop | null>(null);

  const stop = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    clearInterval(loop.intervalId);
    loop.oscillators.forEach(o => {
      try { o.stop(); } catch {}
    });
    try {
      loop.master.gain.cancelScheduledValues(loop.ctx.currentTime);
      loop.master.gain.setTargetAtTime(0, loop.ctx.currentTime, 0.2);
      setTimeout(() => loop.ctx.close().catch(() => {}), 600);
    } catch {}
    loopRef.current = null;
  }, []);

  const start = useCallback((override?: EventMusicTrack) => {
    const track = override ?? eventMusic;
    if (!audioEnabled || track === 'off') return;
    if (loopRef.current) return;

    const pattern = PATTERNS[track];
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(pattern.volume, ctx.currentTime + 0.8);
    master.connect(ctx.destination);

    const beatMs = (60 / pattern.bpm) * 1000 / 2;
    let beatIdx = 0;
    const oscillators: OscillatorNode[] = [];

    const tick = () => {
      const t = ctx.currentTime;
      const bassFreq = pattern.bassNotes[Math.floor(beatIdx / 2) % pattern.bassNotes.length];
      const leadFreq = pattern.leadNotes[beatIdx % pattern.leadNotes.length];

      // Bass
      if (beatIdx % 2 === 0) {
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = pattern.waveBass;
        bass.frequency.setValueAtTime(bassFreq, t);
        bassGain.gain.setValueAtTime(0.6, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        bass.connect(bassGain).connect(master);
        bass.start(t);
        bass.stop(t + 0.5);
        oscillators.push(bass);
      }

      // Lead
      const lead = ctx.createOscillator();
      const leadGain = ctx.createGain();
      lead.type = pattern.waveLead;
      lead.frequency.setValueAtTime(leadFreq, t);
      leadGain.gain.setValueAtTime(0.25, t);
      leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      lead.connect(leadGain).connect(master);
      lead.start(t);
      lead.stop(t + 0.3);
      oscillators.push(lead);

      beatIdx++;

      // Clean up old refs
      if (oscillators.length > 32) oscillators.splice(0, oscillators.length - 32);
    };

    tick();
    const intervalId = window.setInterval(tick, beatMs);
    loopRef.current = { ctx, master, intervalId, oscillators };
  }, [audioEnabled, eventMusic]);

  useEffect(() => () => stop(), [stop]);

  return { start, stop };
}
