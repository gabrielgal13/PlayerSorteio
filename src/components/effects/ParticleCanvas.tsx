'use client';
import { useEffect, useRef } from 'react';
import { createSurface, runLoop, glowSprite, drawSprite } from './fxCore';

interface ParticleCanvasProps {
  count?: number;
  intensity?: 'low' | 'medium' | 'high' | 'explosion';
  colors?: string[];
  className?: string;
}

const NEON_COLORS = ['#00E5FF', '#1F8CFF', '#00CFFF', '#00FFA3', '#FFD166'];

const SPEED = { low: 18, medium: 38, high: 74, explosion: 180 } as const;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  decay: number;
  twinkle: number;
  twinkleSpeed: number;
}

/** Poeira luminosa de fundo. Fica atrás de tudo, então é de propósito discreta. */
export default function ParticleCanvas({
  count = 80,
  intensity = 'medium',
  colors = NEON_COLORS,
  className = '',
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // a lista de cores costuma ser um literal recriado a cada render; sem a chave
  // estável o efeito reiniciava as partículas em todo render do pai
  const colorKey = colors.join(',');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'element');
    if (!surface) return;

    const { ctx, size } = surface;
    const palette = colorKey.split(',');

    const spawn = (fromBottom: boolean): Particle => ({
      x: Math.random() * size.w,
      y: fromBottom ? size.h + 12 : Math.random() * size.h,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.25 + Math.random() * 0.75),
      size: Math.random() * 2.4 + 0.8,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.25 + Math.random() * 0.5,
      life: 1,
      decay: 0.03 + Math.random() * 0.07,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.8 + Math.random() * 1.8,
    });

    const particles = Array.from({ length: count }, () => spawn(false));

    const stop = runLoop((_t, dt) => {
      if (size.w <= 0 || size.h <= 0) return true;
      const speed = SPEED[intensityRef.current];

      ctx.clearRect(0, 0, size.w, size.h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * speed * dt;
        p.y += p.vy * speed * dt;
        p.life -= p.decay * dt;
        p.twinkle += p.twinkleSpeed * dt;

        if (p.life <= 0 || p.y < -12 || p.x < -12 || p.x > size.w + 12) {
          particles[i] = spawn(true);
          continue;
        }

        const flicker = 0.7 + 0.3 * Math.sin(p.twinkle);
        drawSprite(ctx, glowSprite(p.color), p.x, p.y, p.size * 3.2, p.alpha * p.life * flicker);
      }

      ctx.restore();
      return true;
    });

    return () => {
      stop();
      surface.dispose();
    };
  }, [count, colorKey]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
