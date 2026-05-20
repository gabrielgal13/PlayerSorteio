'use client';
import { useEffect, useRef } from 'react';

interface SparklesExplosionProps {
  active: boolean;
  color?: string;
}

export default function SparklesExplosion({ active, color = '#FFD700' }: SparklesExplosionProps) {
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

    interface Sparkle {
      x: number; y: number;
      size: number;
      angle: number;
      spin: number;
      life: number;
      maxLife: number;
      driftX: number;
      driftY: number;
      twinklePhase: number;
    }

    const sparkles: Sparkle[] = [];
    let lastSpawn = 0;
    let start: number | null = null;
    const duration = 4500;

    const spawn = () => {
      sparkles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 30,
        size: Math.random() * 8 + 4,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.08,
        life: 0,
        maxLife: 200 + Math.random() * 120,
        driftX: (Math.random() - 0.5) * 1.5,
        driftY: -(Math.random() * 2 + 1.5),
        twinklePhase: Math.random() * Math.PI * 2,
      });
    };

    const drawStar = (cx: number, cy: number, r: number, ang: number, alpha: number, hue: string) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 12;
      ctx.shadowColor = hue;
      ctx.fillStyle = hue;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        const longX = Math.cos(a) * r;
        const longY = Math.sin(a) * r;
        const shortX = Math.cos(a + Math.PI / 4) * r * 0.28;
        const shortY = Math.sin(a + Math.PI / 4) * r * 0.28;
        if (i === 0) ctx.moveTo(longX, longY); else ctx.lineTo(longX, longY);
        ctx.lineTo(shortX, shortY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      if (elapsed > duration && sparkles.length === 0) return;

      if (elapsed < duration && ts - lastSpawn > 35) {
        for (let i = 0; i < 3; i++) spawn();
        lastSpawn = ts;
      }

      ctx.fillStyle = 'rgba(5,8,22,0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.driftX;
        s.y += s.driftY;
        s.angle += s.spin;
        s.life++;
        s.twinklePhase += 0.18;

        const lifePct = s.life / s.maxLife;
        const fadeIn = Math.min(1, s.life / 30);
        const fadeOut = Math.max(0, 1 - (lifePct - 0.7) / 0.3);
        const baseAlpha = fadeIn * fadeOut;
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const alpha = baseAlpha * twinkle;

        drawStar(s.x, s.y, s.size, s.angle, alpha, color);

        if (s.life >= s.maxLife || s.y < -40) sparkles.splice(i, 1);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, color]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
