'use client';
import { useEffect, useRef } from 'react';
import {
  createSurface, runLoop, heroZone, carveHero, heroSpot,
  haloSprite, starSprite, streakSprite, glowSprite, drawSprite, drawFlat,
  easeOut, shade, toRgb, rgba, unit, type Ctx, type HeroZone,
} from './fxCore';

interface SparklesExplosionProps {
  active: boolean;
  color?: string;
}

const SPAWN_UNTIL = 3.0;
const DURATION = 4.0;
const FADE_FROM = 3.0;

interface Sparkle {
  x: number; y: number;
  vy: number;
  swayPhase: number; swayFreq: number; swayAmp: number;
  size: number;
  /** 0 = fundo (pequena, lenta, apagada) … 1 = primeiro plano */
  depth: number;
  spin: number; angle: number;
  twinkle: number; twinkleSpeed: number;
  color: string;
  age: number; life: number;
  bokeh: boolean;
}

function rgbHex(c: [number, number, number]) {
  return `#${c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Cortina de luz caindo do teto — os "god rays" que separam o fundo do primeiro
 * plano. É a camada que transforma a chuva de estrelinhas em fotografia.
 */
function godRays(ctx: Ctx, w: number, h: number, t: number, color: string, alpha: number) {
  const rgb = toRgb(color);
  for (let i = 0; i < 5; i++) {
    const base = w * (0.12 + i * 0.19);
    const drift = Math.sin(t * 0.35 + i * 1.7) * w * 0.05;
    const half = w * (0.05 + 0.02 * Math.sin(t * 0.5 + i));
    const a = alpha * (0.55 + 0.45 * Math.sin(t * 0.6 + i * 2.1));
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.95);
    g.addColorStop(0, rgba(shade(rgb, 1.4), a));
    g.addColorStop(0.5, rgba(rgb, a * 0.35));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(base + drift - half * 0.25, -10);
    ctx.lineTo(base + drift + half * 0.25, -10);
    ctx.lineTo(base + drift + half * 1.8, h * 0.95);
    ctx.lineTo(base + drift - half * 1.8, h * 0.95);
    ctx.closePath();
    ctx.fill();
  }
}

export default function SparklesExplosion({ active, color = '#FFD700' }: SparklesExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'viewport');
    if (!surface) return;

    const { ctx, size } = surface;

    // paleta em torno da cor do tema: puro, clareado e um branco quente
    const base = toRgb(color);
    const palette = [color, rgbHex(shade(base, 1.45)), '#FFF6D8'];

    const sparkles: Sparkle[] = [];
    let nextSpawn = 0;
    let zone: HeroZone = heroZone(size.w, size.h, 0.45);

    const spawn = (seededY?: number) => {
      const depth = Math.random();
      const bokeh = Math.random() < 0.38;
      sparkles.push({
        x: Math.random() * size.w,
        y: seededY ?? size.h + 40,
        // câmera lenta: as da frente sobem mais rápido, criando paralaxe
        vy: -(18 + depth * 46),
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 0.5 + Math.random() * 0.9,
        swayAmp: 8 + Math.random() * 26,
        size: (bokeh ? 14 : 15) * (0.4 + depth * 1.15),
        depth,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.5,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.6 + Math.random() * 3.4,
        color: palette[Math.floor(Math.random() * palette.length)],
        age: 0,
        life: 4.2 + Math.random() * 2.4,
        bokeh,
      });
    };

    // já começa com a tela povoada, senão o efeito demora a "existir"
    for (let i = 0; i < 64; i++) spawn(Math.random() * size.h * 1.05);

    const stop = runLoop((t, dt) => {
      if (t > DURATION) return false;
      const u = unit(size.w, size.h);
      zone = heroZone(size.w, size.h, 0.45);

      if (t < SPAWN_UNTIL && t >= nextSpawn) {
        nextSpawn = t + 0.05;
        spawn();
        if (Math.random() < 0.6) spawn();
      }

      const globalAlpha = t < FADE_FROM ? Math.min(1, t / 0.35) : easeOut(1 - (t - FADE_FROM) / (DURATION - FADE_FROM));

      ctx.clearRect(0, 0, size.w, size.h);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      godRays(ctx, size.w, size.h, t, color, 0.075 * globalAlpha);

      // o laço anda de trás para frente (para poder remover em segurança), então
      // ordenar por profundidade decrescente é o que faz o fundo ser pintado
      // antes do primeiro plano — sem isso não há profundidade, só um mosaico
      sparkles.sort((a, b) => b.depth - a.depth);

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.age += dt;
        if (s.age >= s.life || s.y < -80) { sparkles.splice(i, 1); continue; }

        s.swayPhase += s.swayFreq * dt;
        s.x += Math.cos(s.swayPhase) * s.swayAmp * dt;
        s.y += s.vy * dt;
        s.angle += s.spin * dt;
        s.twinkle += s.twinkleSpeed * dt;

        const p = s.age / s.life;
        const fadeIn = Math.min(1, s.age / 0.5);
        const fadeOut = 1 - easeOut(Math.max(0, (p - 0.75) / 0.25));
        const pulse = 0.55 + 0.45 * Math.sin(s.twinkle);
        const alpha = fadeIn * fadeOut * pulse * (0.3 + s.depth * 0.7) * globalAlpha;
        const r = s.size * u;

        if (s.bokeh) {
          // círculo de confusão: a luz fora de foco do fundo
          drawSprite(ctx, haloSprite(s.color), s.x, s.y, r * 1.7, alpha * 0.5);
          continue;
        }

        // halo suave por baixo + estrela nítida por cima: é o que dá o brilho de lente
        drawSprite(ctx, haloSprite(s.color), s.x, s.y, r * 2.0, alpha * 0.5);

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        drawSprite(ctx, starSprite(s.color), 0, 0, r * (1.9 + pulse * 0.6), alpha);
        ctx.restore();

        // as maiores do primeiro plano estouram num risco horizontal de lente
        if (s.depth > 0.72 && pulse > 0.8) {
          drawSprite(ctx, streakSprite(s.color), s.x, s.y, r * 7, (pulse - 0.8) * 2.2 * alpha);
        }
      }

      // brasa de luz no chão, para a cena não flutuar no vazio
      drawFlat(ctx, glowSprite(color), size.w / 2, size.h * 0.99, size.w * 0.42, 0.1, 0.28 * globalAlpha);

      heroSpot(ctx, size.w, size.h, zone, rgbHex(shade(base, 1.5)), 0.7 * globalAlpha);

      ctx.restore();

      carveHero(ctx, zone);
      return true;
    });

    return () => {
      stop();
      surface.dispose();
    };
  }, [active, color]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
