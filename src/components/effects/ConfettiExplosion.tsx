'use client';
import {
  createSurface, runLoop, toRgb, rgba, shade, easeOut,
  glowSprite, drawSprite, unit, type Ctx, type Rgb,
} from './fxCore';
import { useEffect, useRef } from 'react';

interface ConfettiExplosionProps {
  active: boolean;
  originX?: number;
  originY?: number;
}

const CONFETTI_COLORS = ['#00E5FF', '#00CFFF', '#00FFA3', '#FFD166', '#FF4081', '#1F8CFF', '#FFFFFF', '#A855F7'];
/** Papéis metalizados: refletem muito mais e ganham brilho próprio. */
const FOIL_COLORS = ['#FFD700', '#C0C0C0', '#FF5FA2', '#4DE1FF'];

/** O efeito se resolve sozinho antes do componente ser desmontado (3,5–4s). */
const EMIT_UNTIL = 2.0;
const DURATION = 3.8;
const FADE_FROM = 2.9;

const GRAVITY = 1500;

type Shape = 'rect' | 'ribbon' | 'dot' | 'streamer';

interface Piece {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  front: Rgb; back: Rgb;
  /** giro no eixo vertical: é o que faz o papel virar de perfil e sumir por um instante */
  flip: number; flipSpeed: number;
  roll: number; rollSpeed: number;
  swayPhase: number; swayFreq: number; swayAmp: number;
  drag: number;
  shape: Shape;
  alpha: number;
  /** 0,7 (fundo) … 1,6 (primeiro plano) — controla ordem de pintura e tamanho */
  depth: number;
  foil: boolean;
  glowColor: string;
}

function makePiece(x: number, y: number, vx: number, vy: number, depth: number): Piece {
  const foil = Math.random() < 0.3;
  const color = foil
    ? FOIL_COLORS[Math.floor(Math.random() * FOIL_COLORS.length)]
    : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const front = toRgb(color);
  const r = Math.random();
  const shape: Shape = r < 0.5 ? 'rect' : r < 0.74 ? 'ribbon' : r < 0.88 ? 'streamer' : 'dot';
  const base = shape === 'ribbon' || shape === 'streamer' ? 3.4 : 8;

  return {
    x, y, vx, vy,
    w: (base + Math.random() * 8) * depth,
    h: (base * 0.55 + Math.random() * 4.5) * depth,
    front,
    // o verso do papel é a mesma cor na sombra — é isso que dá volume ao girar
    back: shade(front, foil ? 0.62 : 0.42),
    flip: Math.random() * Math.PI * 2,
    flipSpeed: (Math.random() * 7 + 4) * (Math.random() < 0.5 ? -1 : 1),
    roll: Math.random() * Math.PI * 2,
    rollSpeed: (Math.random() - 0.5) * 6,
    swayPhase: Math.random() * Math.PI * 2,
    swayFreq: 1.8 + Math.random() * 2.4,
    swayAmp: (30 + Math.random() * 70) * depth,
    drag: 0.7 + Math.random() * 0.5,
    shape,
    alpha: 0.78 + Math.min(depth, 1.6) * 0.14,
    depth,
    foil,
    glowColor: color,
  };
}

/** Canhão lateral: jato em leque, como os usados em palco. */
function cannon(pieces: Piece[], x: number, y: number, aim: number, count: number, power: number) {
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 0.55;
    const angle = aim + spread;
    const speed = power * (0.55 + Math.random() * 0.65);
    const depth = 0.7 + Math.random() * 0.9;
    pieces.push(makePiece(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 30,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      depth,
    ));
  }
}

/**
 * Serpentina: fita comprida que ondula em vez de cair reta. Desenhada como uma
 * faixa com quatro nós, porque um retângulo giratório longo lê como palito.
 */
function drawStreamer(ctx: Ctx, p: Piece, squash: number) {
  const len = p.w * 4.5;
  const amp = p.h * 2.2;
  const steps = 6;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const px = (k - 0.5) * len * squash;
    const py = Math.sin(p.swayPhase * 2 + k * Math.PI * 2.2) * amp;
    if (i === 0) ctx.moveTo(px, py - p.h * 0.5);
    else ctx.lineTo(px, py - p.h * 0.5);
  }
  for (let i = steps; i >= 0; i--) {
    const k = i / steps;
    const px = (k - 0.5) * len * squash;
    const py = Math.sin(p.swayPhase * 2 + k * Math.PI * 2.2) * amp;
    ctx.lineTo(px, py + p.h * 0.5);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPiece(ctx: Ctx, p: Piece, globalAlpha: number, u: number) {
  const facing = Math.cos(p.flip);
  const squash = Math.abs(facing);
  // de perfil o papel some quase por completo: sem isso o confete parece adesivo
  if (squash < 0.04) return;

  const alpha = p.alpha * globalAlpha;
  if (alpha <= 0.01) return;

  const spec = Math.pow(squash, p.foil ? 4 : 7);

  // o metalizado joga luz em volta quando pega a "lâmpada" de frente
  if (p.foil && spec > 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(ctx, glowSprite(p.glowColor), p.x, p.y, p.w * 2.2 * u, (spec - 0.35) * 0.6 * alpha);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.roll);
  ctx.fillStyle = rgba(facing >= 0 ? p.front : p.back, 1);

  if (p.shape === 'dot') {
    ctx.beginPath();
    ctx.ellipse(0, 0, (p.w / 2) * squash, p.w / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'streamer') {
    drawStreamer(ctx, p, squash);
    if (spec > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${spec * 0.3})`;
      drawStreamer(ctx, p, squash * 0.55);
    }
  } else {
    const w = p.w * squash;
    ctx.fillRect(-w / 2, -p.h / 2, w, p.h);
    // brilho especular quando a face fica de frente para a câmera
    if (spec > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${spec * (p.foil ? 0.7 : 0.45)})`;
      ctx.fillRect(-w / 2, -p.h / 2, w, p.h * 0.42);
    }
  }

  ctx.restore();
}

export default function ConfettiExplosion({ active, originX = 50, originY = 50 }: ConfettiExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'viewport');
    if (!surface) return;

    const { ctx, size } = surface;
    const pieces: Piece[] = [];
    let nextDrop = 0;
    let volley = 0;

    const fire = (power: number, count: number) => {
      const y = size.h * 0.94;
      cannon(pieces, -20, y, -Math.PI * 0.30, count, power);
      cannon(pieces, size.w + 20, y, -Math.PI * 0.70, count, power);
    };

    // sopro central, mais discreto: marca o momento sem cobrir quem está no meio
    const ox = (originX / 100) * size.w;
    const oy = (originY / 100) * size.h;
    for (let i = 0; i < 56; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const speed = 320 + Math.random() * 520;
      pieces.push(makePiece(ox, oy, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.7 + Math.random() * 0.7));
    }
    fire(1750, 110);

    const stop = runLoop((t, dt) => {
      if (t > DURATION) return false;
      const u = unit(size.w, size.h);

      // salvas escalonadas, para o efeito não morrer todo de uma vez
      if (volley === 0 && t > 0.45) { fire(1550, 85); volley = 1; }
      if (volley === 1 && t > 1.15) { fire(1350, 60); volley = 2; }

      // chuva vinda de cima, rareada no corredor central onde fica o mascote
      if (t < EMIT_UNTIL && t >= nextDrop) {
        nextDrop = t + 0.04;
        for (let i = 0; i < 3; i++) {
          let x = Math.random() * size.w;
          if (Math.abs(x - size.w / 2) < size.w * 0.14 && Math.random() < 0.6) {
            x = Math.random() * size.w;
          }
          pieces.push(makePiece(x, -30, (Math.random() - 0.5) * 120, 120 + Math.random() * 180, 0.7 + Math.random() * 0.9));
        }
      }

      const globalAlpha = t < FADE_FROM ? 1 : easeOut(1 - (t - FADE_FROM) / (DURATION - FADE_FROM));

      ctx.clearRect(0, 0, size.w, size.h);

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];

        // arrasto exponencial: o papel perde a velocidade do disparo rápido e
        // depois só flutua, que é o que diferencia confete de estilhaço
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy = (p.vy + GRAVITY * dt) * damp;

        p.swayPhase += p.swayFreq * dt;
        p.x += (p.vx + Math.cos(p.swayPhase) * p.swayAmp) * dt;
        p.y += p.vy * dt;
        p.flip += p.flipSpeed * dt;
        p.roll += p.rollSpeed * dt;

        if (p.y > size.h + 90 || p.x < -160 || p.x > size.w + 160) {
          pieces.splice(i, 1);
        }
      }

      // pintar do fundo para a frente é o que dá camadas ao papel no ar
      pieces.sort((a, b) => a.depth - b.depth);
      for (let i = 0; i < pieces.length; i++) drawPiece(ctx, pieces[i], globalAlpha, u);

      return true;
    });

    return () => {
      stop();
      surface.dispose();
    };
  }, [active, originX, originY]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
