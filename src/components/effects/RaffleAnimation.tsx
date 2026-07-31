'use client';
import { useEffect, useRef } from 'react';
import { createSurface, runLoop, heroZone } from './fxCore';
import { createLightShowState, drawLightShow, type LightStyle } from './lightShows';

export type RaffleAnimationStyle = LightStyle;

export interface RaffleAnimationProps {
  active: boolean;
  animStyle: RaffleAnimationStyle;
}

export default function RaffleAnimation({ active, animStyle }: RaffleAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'element');
    if (!surface) return;

    const { ctx, size } = surface;
    const state = createLightShowState();

    const stop = runLoop((t, dt) => {
      if (size.w > 0 && size.h > 0) {
        // o mascote fica no centro-baixo desta área: a luz passa ao redor dele
        drawLightShow(animStyle, ctx, size.w, size.h, t, dt, state, heroZone(size.w, size.h, 0.5));
      }
      return true;
    });

    return () => {
      stop();
      surface.dispose();
    };
  }, [active, animStyle]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15,
        mixBlendMode: 'screen',
      }}
    />
  );
}
