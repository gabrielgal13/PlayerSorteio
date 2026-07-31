'use client';
import { useEffect, useRef } from 'react';
import {
  createSurface, runLoop, heroZone, carveHero, heroSpot, Trail,
  glowSprite, smokeSprite, streakSprite, drawSprite, glowRing, easeOut,
  unit, sceneScale, rgba, toRgb, shade, type Ctx, type HeroZone,
} from './fxCore';

interface FireworksExplosionProps {
  active: boolean;
  color?: string;
}

const SHELL_COLORS = ['#FFD166', '#FF4081', '#00E5FF', '#00FFA3', '#A855F7', '#FF6B35'];
const WILLOW_GOLD = '#FFC46B';

const LAUNCH_UNTIL = 2.4;
const DURATION = 4.2;
const FADE_FROM = 3.2;

type ShellKind = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'crackle';

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  age: number; life: number;
  color: string;
  size: number;
  drag: number;
  gravity: number;
  twinkle: number;
  twinkleSpeed: number;
  trail: Trail | null;
}

interface Rocket {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  kind: ShellKind;
  targetY: number;
  trail: Trail;
  shed: number;
}

interface Wave {
  x: number; y: number;
  age: number; life: number;
  color: string;
  radius: number;
  squash: number;
  width: number;
}

interface Puff { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }

/** Clarão que lava o céu inteiro no instante do estouro. */
interface Flash { x: number; y: number; v: number; color: string }

function pickColor(theme: string | undefined) {
  if (theme && Math.random() < 0.4) return theme;
  return SHELL_COLORS[Math.floor(Math.random() * SHELL_COLORS.length)];
}

export default function FireworksExplosion({ active, color }: FireworksExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createSurface(canvas, 'viewport');
    if (!surface) return;

    const { ctx, size } = surface;
    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const waves: Wave[] = [];
    const puffs: Puff[] = [];
    let flash: Flash | null = null;
    let nextLaunch = 0;
    let zone: HeroZone = heroZone(size.w, size.h, 0.5);

    const push = (
      x: number, y: number, vx: number, vy: number, c: string,
      life: number, sz: number, drag: number, gravity: number,
      twinkleSpeed: number, trailLen: number,
    ) => {
      sparks.push({
        x, y, vx, vy, age: 0, life, color: c, size: sz, drag, gravity,
        twinkle: Math.random() * Math.PI * 2, twinkleSpeed,
        trail: trailLen > 0 ? new Trail(trailLen) : null,
      });
    };

    /**
     * A casca inteira: clarão, onda de choque, fumaça, miolo branco e só então
     * as estrelas. Faltando as quatro primeiras, o estouro vira um punhado de
     * pontinhos que aparecem do nada — que é o que fazia não ler como fogos.
     */
    const explode = (r: Rocket, S: number, u: number) => {
      const { x, y, color: c, kind } = r;

      flash = { x, y, v: 1, color: c };
      waves.push({ x, y, age: 0, life: 0.45, color: c, radius: S * 0.5, squash: 1, width: 1.3 * u });

      for (let i = 0; i < 4; i++) {
        puffs.push({
          x: x + (Math.random() - 0.5) * S * 0.1,
          y: y + (Math.random() - 0.5) * S * 0.1,
          vx: (Math.random() - 0.5) * 18,
          vy: -(6 + Math.random() * 14),
          age: 0, life: 2.6 + Math.random() * 1.6,
          size: S * (0.1 + Math.random() * 0.08),
        });
      }

      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = S * (0.05 + Math.random() * 0.1);
        push(x, y, Math.cos(a) * sp, Math.sin(a) * sp, '#FFF6D8', 0.85 + Math.random() * 0.4, 3 * u, 2.2, S * 0.18, 18, 0);
      }

      if (kind === 'ring') {
        const n = 96;
        const tilt = (Math.random() - 0.5) * 0.9;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const sp = S * (0.4 + Math.random() * 0.12);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const j = 0.93 + Math.random() * 0.14;
          // achatado e depois inclinado: o anel lê como um plano no espaço
          const ux = Math.cos(a) * sp * j;
          const uy = Math.sin(a) * sp * j * 0.34;
          push(x, y, ux * cosT - uy * sinT, ux * sinT + uy * cosT, c, 1.6 + Math.random() * 0.5, 3.2 * u, 1.0, S * 0.2, 12 + Math.random() * 10, 5);
        }
        waves.push({ x, y, age: 0, life: 0.8, color: c, radius: S * 0.42, squash: 0.34, width: 1 * u });
        return;
      }

      if (kind === 'willow') {
        const n = 82;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          // a raiz quadrada distribui as faíscas pelo volume da esfera, não só na borda
          const sp = S * (0.13 + Math.random() * 0.22) * Math.sqrt(Math.random());
          push(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
            Math.random() < 0.2 ? '#FFF0C0' : WILLOW_GOLD,
            2.5 + Math.random() * 1.0, 3.2 * u, 0.5, S * 0.42, 4 + Math.random() * 5, 18);
        }
        return;
      }

      if (kind === 'chrysanthemum') {
        const n = 104;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = S * (0.19 + Math.random() * 0.32) * Math.sqrt(Math.random());
          push(x, y, Math.cos(a) * sp, Math.sin(a) * sp, c,
            2.0 + Math.random() * 0.8, 3.4 * u, 0.85, S * 0.24, 6 + Math.random() * 6, i % 2 === 0 ? 15 : 0);
        }
        return;
      }

      const crackle = kind === 'crackle';
      const n = crackle ? 140 : 112;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = S * (0.2 + Math.random() * 0.36) * Math.sqrt(Math.random());
        push(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          crackle && Math.random() < 0.45 ? '#FFFFFF' : c,
          crackle ? 0.95 + Math.random() * 0.5 : 1.5 + Math.random() * 0.7,
          (crackle ? 2.4 : 3.6) * u,
          crackle ? 2.0 : 1.25,
          S * 0.26,
          crackle ? 30 + Math.random() * 18 : 8 + Math.random() * 8,
          crackle ? 0 : (i % 3 === 0 ? 9 : 0));
      }
    };

    const launch = (S: number) => {
      // as subidas evitam o corredor central, onde o mascote aparece
      const side = Math.random() < 0.5 ? 0 : 1;
      const x = side === 0
        ? size.w * (0.06 + Math.random() * 0.3)
        : size.w * (0.64 + Math.random() * 0.3);
      const roll = Math.random();
      const kind: ShellKind = roll < 0.28 ? 'peony'
        : roll < 0.5 ? 'chrysanthemum'
        : roll < 0.7 ? 'willow'
        : roll < 0.88 ? 'ring' : 'crackle';
      const targetY = size.h * (0.1 + Math.random() * 0.26);
      rockets.push({
        x, y: size.h + 10,
        vx: (Math.random() - 0.5) * S * 0.12,
        vy: -(size.h - targetY) * 1.5,
        color: kind === 'willow' ? WILLOW_GOLD : pickColor(color),
        kind, targetY,
        trail: new Trail(11),
        shed: 0,
      });
    };

    const smoke = smokeSprite();

    const drawWave = (c: Ctx, wv: Wave, ga: number) => {
      const p = wv.age / wv.life;
      glowRing(c, wv.x, wv.y, wv.radius * easeOut(p), wv.squash, wv.color, (1 - p) * (1 - p) * 0.55 * ga, wv.width);
    };

    const stop = runLoop((t, dt) => {
      if (t > DURATION) return false;
      const u = unit(size.w, size.h);
      const S = sceneScale(size.w, size.h);
      zone = heroZone(size.w, size.h, 0.5);

      if (t < LAUNCH_UNTIL && t >= nextLaunch) {
        launch(S);
        if (Math.random() < 0.4) launch(S);
        nextLaunch = t + 0.28 + Math.random() * 0.3;
      }

      const globalAlpha = t < FADE_FROM ? Math.min(1, t / 0.2) : easeOut(1 - (t - FADE_FROM) / (DURATION - FADE_FROM));

      ctx.clearRect(0, 0, size.w, size.h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      if (flash) {
        flash.v -= dt * 3.4;
        if (flash.v <= 0) {
          flash = null;
        } else {
          const v = flash.v * flash.v * globalAlpha;
          const rgb = toRgb(flash.color);
          const g = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, S * 1.7);
          g.addColorStop(0, rgba(shade(rgb, 1.4), 0.26 * v));
          g.addColorStop(0.4, rgba(rgb, 0.1 * v));
          g.addColorStop(1, rgba(rgb, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, size.w, size.h);
        }
      }

      // fumaça atrás de tudo — é o resíduo que dá peso ao estouro
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        if (p.age >= p.life) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= Math.exp(-0.4 * dt);
        const k = p.age / p.life;
        drawSprite(ctx, smoke, p.x, p.y, p.size * (0.55 + k * 1.6), (1 - k) * (1 - k) * 0.8 * globalAlpha);
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += S * 0.6 * dt;
        r.trail.push(r.x, r.y, dt);

        // faísca solta na subida: sem ela o foguete é um ponto que sobe calado
        r.shed += dt;
        if (r.shed > 0.028) {
          r.shed = 0;
          push(r.x, r.y, (Math.random() - 0.5) * S * 0.07, S * 0.05 + Math.random() * S * 0.05,
            '#FFC46B', 0.34 + Math.random() * 0.2, 1.9 * u, 2.6, S * 0.1, 24, 0);
        }

        if (r.y <= r.targetY || r.vy >= -S * 0.06) {
          explode(r, S, u);
          rockets.splice(i, 1);
          continue;
        }

        r.trail.stroke(ctx, '#FFC46B', 2.6 * u, globalAlpha);
        drawSprite(ctx, glowSprite('#FFE9A8'), r.x, r.y, 12 * u, 0.95 * globalAlpha);
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const wv = waves[i];
        wv.age += dt;
        if (wv.age >= wv.life) { waves.splice(i, 1); continue; }
        drawWave(ctx, wv, globalAlpha);
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) { sparks.splice(i, 1); continue; }

        const damp = Math.exp(-s.drag * dt);
        s.vx *= damp;
        s.vy = (s.vy + s.gravity * dt) * damp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.trail?.push(s.x, s.y, dt);

        const p = s.age / s.life;
        s.twinkle += s.twinkleSpeed * dt;
        const alpha = (1 - p) * (1 - p) * (0.62 + 0.38 * Math.sin(s.twinkle)) * globalAlpha;

        s.trail?.stroke(ctx, s.color, s.size * 0.66, alpha);
        drawSprite(ctx, glowSprite(s.color), s.x, s.y, s.size * (1.7 - p * 0.8), alpha);
        // as estrelas maiores ganham risco de lente, como uma câmera de verdade
        if (s.size > 3 * u && alpha > 0.5) {
          drawSprite(ctx, streakSprite(s.color), s.x, s.y, s.size * 6, (alpha - 0.5) * 0.5);
        }
      }

      heroSpot(ctx, size.w, size.h, zone, '#FFE3B8', 0.55 * globalAlpha);

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
