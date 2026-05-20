'use client';
import { useEffect, useRef } from 'react';

interface ConfettiExplosionProps {
  active: boolean;
  originX?: number;
  originY?: number;
}

const CONFETTI_COLORS = ['#00E5FF', '#00CFFF', '#00FFA3', '#FFD166', '#FF4081', '#1F8CFF'];

export default function ConfettiExplosion({ active, originX = 50, originY = 50 }: ConfettiExplosionProps) {
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

    const ox = (originX / 100) * canvas.width;
    const oy = (originY / 100) * canvas.height;

    interface Piece {
      x: number; y: number;
      vx: number; vy: number;
      rotation: number;
      rotSpeed: number;
      width: number; height: number;
      color: string;
      alpha: number;
    }

    const pieces: Piece[] = Array.from({ length: 200 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 18 + 5;
      return {
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        width: Math.random() * 12 + 6,
        height: Math.random() * 6 + 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        alpha: 1,
      };
    });

    const gravity = 0.4;
    let start: number | null = null;
    const duration = 3000;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      if (elapsed > duration) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.rotation += p.rotSpeed;
        p.alpha = Math.max(0, 1 - elapsed / duration);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, originX, originY]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}
