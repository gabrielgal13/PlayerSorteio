'use client';
import { useEffect, useRef } from 'react';

interface FireworksExplosionProps {
  active: boolean;
  color?: string;
}

const ROCKET_COLORS = ['#FFD166', '#FF4081', '#00E5FF', '#00FFA3', '#A050FF'];

export default function FireworksExplosion({ active, color }: FireworksExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      life: number;
      maxLife: number;
      color: string;
      size: number;
      trail: { x: number; y: number; alpha: number }[];
    }

    const particles: Particle[] = [];
    let lastBurst = 0;

    const burst = (cx: number, cy: number, hue: string) => {
      const count = 60;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.1;
        const speed = Math.random() * 6 + 3;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 60 + Math.random() * 30,
          color: hue,
          size: Math.random() * 2.5 + 1,
          trail: [],
        });
      }
    };

    let start: number | null = null;
    const duration = 4500;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      if (elapsed > duration && particles.length === 0) return;

      // Trigger bursts at intervals
      if (elapsed < duration - 1000 && ts - lastBurst > 400) {
        const cx = canvas.width * (0.2 + Math.random() * 0.6);
        const cy = canvas.height * (0.2 + Math.random() * 0.35);
        const hue = color || ROCKET_COLORS[Math.floor(Math.random() * ROCKET_COLORS.length)];
        burst(cx, cy, hue);
        lastBurst = ts;
      }

      ctx.fillStyle = 'rgba(5,8,22,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.trail.unshift({ x: p.x, y: p.y, alpha: 1 });
        if (p.trail.length > 6) p.trail.pop();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.life++;

        const lifePct = p.life / p.maxLife;
        const alpha = Math.max(0, 1 - lifePct);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // trail
        p.trail.forEach((t, idx) => {
          const trailAlpha = alpha * (1 - idx / p.trail.length) * 0.6;
          ctx.globalAlpha = trailAlpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.size * (1 - idx / p.trail.length), 0, Math.PI * 2);
          ctx.fill();
        });

        // head
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
