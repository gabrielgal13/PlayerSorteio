'use client';
import { useEffect, useRef } from 'react';
import type { RaffleAnimationStyle } from '@/types';

interface Rocket { x: number; y: number; vx: number; vy: number; trail: Array<{ x: number; y: number }>; exploded: boolean; color: string; }
interface Spark  { x: number; y: number; vx: number; vy: number; life: number; color: string; }
interface FireworksState { rockets: Rocket[]; sparks: Spark[]; nextLaunch: number; }
interface Ring  { r: number; opacity: number; maxR: number; }
interface ScifiState { rings: Ring[]; nextRing: number; rayAngle: number; }

const BALADA_BEAMS = [
  { color: '#FF00FF', speed: 0.70, phase: 0,              maxAngle: 0.70 },
  { color: '#00FFFF', speed: 0.50, phase: Math.PI * 0.60, maxAngle: 0.60 },
  { color: '#9B59B6', speed: 0.90, phase: Math.PI * 1.20, maxAngle: 0.80 },
  { color: '#FFD700', speed: 0.60, phase: Math.PI * 0.30, maxAngle: 0.65 },
  { color: '#FF6EC7', speed: 1.10, phase: Math.PI * 1.70, maxAngle: 0.55 },
] as const;

function drawBalada(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const beam of BALADA_BEAMS) {
    const angle      = Math.sin(t * beam.speed + beam.phase) * beam.maxAngle;
    const halfSpread = 0.065;
    const len        = Math.hypot(w, h) * 1.35;
    const grad = ctx.createLinearGradient(cx, 0, cx + Math.sin(angle) * h, h);
    grad.addColorStop(0,   beam.color + 'EE');
    grad.addColorStop(0.4, beam.color + '99');
    grad.addColorStop(1,   beam.color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx + Math.sin(angle - halfSpread) * len, h + 80);
    ctx.lineTo(cx + Math.sin(angle + halfSpread) * len, h + 80);
    ctx.closePath();
    ctx.fill();
  }
  const sg = ctx.createRadialGradient(cx, 0, 0, cx, 0, 32);
  sg.addColorStop(0,   'rgba(255,255,255,0.95)');
  sg.addColorStop(0.4, 'rgba(255,140,255,0.55)');
  sg.addColorStop(1,   'rgba(200,0,255,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(cx, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const CONCERTO_BEAMS = [
  { color: '#0066FF', speed: 0.30, phase: 0,              maxSweep: 0.55, curveFactor: 0.40 },
  { color: '#FFFFFF', speed: 0.25, phase: Math.PI * 0.80, maxSweep: 0.45, curveFactor: 0.30 },
  { color: '#00E5FF', speed: 0.40, phase: Math.PI * 1.60, maxSweep: 0.60, curveFactor: 0.50 },
  { color: '#4499FF', speed: 0.20, phase: Math.PI * 0.40, maxSweep: 0.40, curveFactor: 0.35 },
  { color: '#88CCFF', speed: 0.35, phase: Math.PI * 1.20, maxSweep: 0.50, curveFactor: 0.45 },
] as const;

function drawConcerto(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  const cx = w / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const beam of CONCERTO_BEAMS) {
    const sweep = Math.sin(t * beam.speed + beam.phase) * beam.maxSweep;
    const endX  = cx + sweep * w;
    const cpX   = cx + Math.sin(t * beam.speed * beam.curveFactor + beam.phase) * w * 0.3;
    const cpY   = h * 0.45;
    const passes = [
      { lw: 10, alpha: 0.12, blur: 18 },
      { lw: 5,  alpha: 0.32, blur: 8  },
      { lw: 2,  alpha: 0.72, blur: 3  },
    ] as const;
    for (const p of passes) {
      const hex = Math.round(p.alpha * 255).toString(16).padStart(2, '0');
      ctx.strokeStyle = beam.color + hex;
      ctx.lineWidth   = p.lw;
      ctx.shadowBlur  = p.blur;
      ctx.shadowColor = beam.color;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.quadraticCurveTo(cpX, cpY, endX, h);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  const sg = ctx.createRadialGradient(cx, 0, 0, cx, 0, 36);
  sg.addColorStop(0,   'rgba(255,255,255,1)');
  sg.addColorStop(0.3, 'rgba(120,200,255,0.65)');
  sg.addColorStop(1,   'rgba(0,80,255,0)');
  ctx.fillStyle   = sg;
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#0088FF';
  ctx.beginPath();
  ctx.arc(cx, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

const GRAVITY = 80;

function drawFogos(
  ctx: CanvasRenderingContext2D,
  t: number, w: number, h: number,
  dt: number,
  state: FireworksState,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (t >= state.nextLaunch) {
    state.rockets.push({
      x:  w * (0.15 + Math.random() * 0.70),
      y:  h,
      vx: (Math.random() - 0.5) * 40,
      vy: -(h * (0.55 + Math.random() * 0.35)),
      trail: [],
      exploded: false,
      color: `hsl(${Math.random() * 360},100%,60%)`,
    });
    state.nextLaunch = t + 0.35 + Math.random() * 0.55;
  }
  state.rockets = state.rockets.filter(r => {
    r.trail.push({ x: r.x, y: r.y });
    if (r.trail.length > 12) r.trail.shift();
    r.x  += r.vx * dt;
    r.y  += r.vy * dt;
    r.vy += GRAVITY * dt;
    if (r.vy >= 0) {
      const count = 45 + Math.floor(Math.random() * 35);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const spd   = 55 + Math.random() * 90;
        state.sparks.push({ x: r.x, y: r.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 1, color: r.color });
      }
      return false;
    }
    for (let i = 0; i < r.trail.length; i++) {
      ctx.globalAlpha = (i / r.trail.length) * 0.65;
      ctx.fillStyle = 'rgba(255,220,90,1)';
      ctx.beginPath();
      ctx.arc(r.trail[i].x, r.trail[i].y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ffff88';
    ctx.fillStyle   = 'rgba(255,255,180,0.95)';
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    return true;
  });
  state.sparks = state.sparks.filter(s => {
    s.x  += s.vx * dt;
    s.y  += s.vy * dt;
    s.vy += GRAVITY * 0.45 * dt;
    s.vx *= 0.992;
    s.vy *= 0.992;
    s.life -= dt * 0.65;
    if (s.life <= 0) return false;
    ctx.globalAlpha = s.life * s.life;
    ctx.shadowBlur  = 5;
    ctx.shadowColor = s.color;
    ctx.fillStyle   = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    return true;
  });
  ctx.restore();
}

const RAY_COUNT = 8;

function drawScifi(
  ctx: CanvasRenderingContext2D,
  t: number, w: number, h: number,
  dt: number,
  state: ScifiState,
) {
  const cx = w / 2;
  const cy = h * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (t >= state.nextRing) {
    state.rings.push({ r: 4, opacity: 0.85, maxR: 40 + Math.random() * 50 });
    state.nextRing = t + 0.25 + Math.random() * 0.30;
  }
  state.rings = state.rings.filter(ring => {
    ring.r += 50 * dt;
    ring.opacity = 0.85 * (1 - ring.r / ring.maxR);
    if (ring.opacity <= 0.01) return false;
    ctx.strokeStyle = `rgba(0,255,160,${ring.opacity.toFixed(3)})`;
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#00FF88';
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    return true;
  });
  state.rayAngle += 0.85 * dt;
  for (let i = 0; i < RAY_COUNT; i++) {
    const angle  = state.rayAngle + (i / RAY_COUNT) * Math.PI * 2;
    const rayLen = 38 + Math.sin(t * 2.2 + i * 1.1) * 14;
    const ex = cx + Math.cos(angle) * rayLen;
    const ey = cy + Math.sin(angle) * rayLen;
    const rg = ctx.createLinearGradient(cx, cy, ex, ey);
    rg.addColorStop(0, 'rgba(0,255,180,0.85)');
    rg.addColorStop(1, 'rgba(0,255,120,0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = '#00FFAA';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  for (let i = 0; i < 4; i++) {
    const angle  = -state.rayAngle * 0.4 + (i / 4) * Math.PI * 2;
    const rayLen = 55 + Math.sin(t * 1.3 + i) * 20;
    const ex = cx + Math.cos(angle) * rayLen;
    const ey = cy + Math.sin(angle) * rayLen;
    const rg = ctx.createLinearGradient(cx, cy, ex, ey);
    rg.addColorStop(0, 'rgba(0,255,255,0.50)');
    rg.addColorStop(1, 'rgba(0,200,255,0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 4;
    ctx.shadowColor = '#00FFFF';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
  cg.addColorStop(0,   'rgba(0,255,200,0.95)');
  cg.addColorStop(0.4, 'rgba(0,200,150,0.45)');
  cg.addColorStop(1,   'rgba(0,255,100,0)');
  ctx.fillStyle   = cg;
  ctx.shadowBlur  = 14;
  ctx.shadowColor = '#00FF88';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export default function AnimationPreviewMini({ style }: { style: RaffleAnimationStyle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const stateRef  = useRef<FireworksState | ScifiState | null>(null);
  const prevTsRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = 180;
    canvas.height = 130;

    if (style === 'fogos') {
      stateRef.current = { rockets: [], sparks: [], nextLaunch: 0 };
    } else if (style === 'scifi') {
      stateRef.current = { rings: [], nextRing: 0, rayAngle: 0 };
    } else {
      stateRef.current = null;
    }

    let startTs: number | null = null;

    function loop(ts: number) {
      if (!startTs) { startTs = ts; prevTsRef.current = ts; }
      const t  = (ts - startTs) / 1000;
      const dt = Math.min((ts - prevTsRef.current) / 1000, 0.05);
      prevTsRef.current = ts;

      switch (style) {
        case 'balada':   drawBalada(ctx!, t, 180, 130); break;
        case 'concerto': drawConcerto(ctx!, t, 180, 130); break;
        case 'fogos':    drawFogos(ctx!, t, 180, 130, dt, stateRef.current as FireworksState); break;
        case 'scifi':    drawScifi(ctx!, t, 180, 130, dt, stateRef.current as ScifiState); break;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [style]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={130}
      style={{ display: 'block', mixBlendMode: 'screen' }}
    />
  );
}
