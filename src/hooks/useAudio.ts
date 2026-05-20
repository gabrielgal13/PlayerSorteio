'use client';
import { useCallback, useRef } from 'react';
import { useStore } from '@/store/useStore';

type SoundType = 'suspense' | 'spin' | 'reveal' | 'victory' | 'countdown' | 'error' | 'click';

function createOscillator(
  ctx: AudioContext,
  frequency: number,
  type: OscillatorType,
  duration: number,
  gainStart = 0.3,
  gainEnd = 0,
  delay = 0
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  gainNode.gain.setValueAtTime(gainStart, ctx.currentTime + delay);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(gainEnd, 0.001),
    ctx.currentTime + delay + duration
  );
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export function useAudio() {
  const audioEnabled = useStore(s => s.audioEnabled);
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((sound: SoundType) => {
    if (!audioEnabled) return;
    const ctx = getCtx();

    switch (sound) {
      case 'click':
        createOscillator(ctx, 800, 'sine', 0.08, 0.15, 0);
        break;

      case 'suspense': {
        // Rising tension
        [200, 280, 360, 440, 520].forEach((freq, i) => {
          createOscillator(ctx, freq, 'sawtooth', 0.3, 0.12, 0.001, i * 0.15);
        });
        break;
      }

      case 'spin': {
        // Fast blips
        for (let i = 0; i < 20; i++) {
          const freq = 200 + Math.random() * 600;
          createOscillator(ctx, freq, 'square', 0.04, 0.08, 0, i * 0.07);
        }
        break;
      }

      case 'reveal': {
        // Dramatic chord
        [261, 329, 392, 523].forEach((freq, i) => {
          createOscillator(ctx, freq, 'triangle', 1.2, 0.25, 0, i * 0.05);
        });
        break;
      }

      case 'victory': {
        // Victory fanfare
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          createOscillator(ctx, freq, 'triangle', 0.4, 0.3, 0, i * 0.12);
        });
        setTimeout(() => {
          [1047, 1319, 1568].forEach((freq, i) => {
            createOscillator(ctx, freq, 'triangle', 0.6, 0.4, 0, i * 0.1);
          });
        }, 600);
        break;
      }

      case 'countdown': {
        createOscillator(ctx, 440, 'sine', 0.15, 0.2, 0);
        break;
      }

      case 'error': {
        createOscillator(ctx, 200, 'sawtooth', 0.3, 0.3, 0);
        createOscillator(ctx, 150, 'sawtooth', 0.3, 0.3, 0, 0.15);
        break;
      }
    }
  }, [audioEnabled, getCtx]);

  return { play };
}
