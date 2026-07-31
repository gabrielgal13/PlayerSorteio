'use client';
import { useEffect, useRef } from 'react';
import type { RaffleAnimationStyle } from '@/types';
import { createSurface, runLoop, heroZone } from './fxCore';
import { createLightShowState, drawLightShow } from './lightShows';

interface AnimationPreviewMiniProps {
  style: RaffleAnimationStyle;
  /** Ocupa todo o elemento pai — usado na simulação grande do painel de efeitos. */
  fill?: boolean;
  width?: number;
  height?: number;
}

/**
 * Mesma cena do palco, desenhada em tamanho reduzido. Renderiza na resolução
 * real do elemento: ampliar por CSS um canvas pequeno era o que deixava a
 * simulação do painel borrada.
 */
export default function AnimationPreviewMini({ style, fill = false, width = 180, height = 130 }: AnimationPreviewMiniProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'element');
    if (!surface) return;

    const { ctx, size } = surface;
    const state = createLightShowState();

    const stop = runLoop((t, dt) => {
      if (size.w > 0 && size.h > 0) {
        // a simulação grande tem o mascote no palco; os cartõezinhos, não —
        // só ali a luz precisa abrir espaço para ele
        drawLightShow(style, ctx, size.w, size.h, t, dt, state, fill ? heroZone(size.w, size.h, 0.5) : null);
      }
      return true;
    });

    return () => {
      stop();
      surface.dispose();
    };
  }, [style, fill]);

  return (
    <canvas
      ref={canvasRef}
      style={
        fill
          ? { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', mixBlendMode: 'screen' }
          : { width, height, display: 'block', mixBlendMode: 'screen' }
      }
    />
  );
}
