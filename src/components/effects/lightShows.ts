'use client';
import {
  carveHero, glowSprite, haloSprite, streakSprite, smokeSprite, drawSprite, drawFlat,
  volumeBeam, glowRing, heroSpot, unit, sceneScale,
  rgba, toRgb, shade, Trail,
  type Ctx, type HeroZone,
} from './fxCore';

/**
 * Os quatro shows de luz do sorteio. Ficam aqui, e não dentro do componente,
 * porque a mesma cena é desenhada em dois lugares — o palco ao vivo e a
 * simulação do painel de efeitos — e as duas versões precisam ser idênticas.
 *
 * Três regras valem para os quatro:
 *  1. o mascote é o assunto. Toda cena tem luz própria nele (`heroSpot`) e
 *     termina com `carveHero`, que abre o recorte para a festa não lavar o rosto;
 *  2. luz é volume, não linha. Nada de traço de 1px — feixe é cone com queda
 *     contínua de brilho (`volumeBeam`), anel é anel aceso (`glowRing`);
 *  3. o ar existe. Névoa, poeira e fumaça são o que faz um feixe ser visível
 *     no meio do caminho em vez de só acender onde bate.
 */
export type LightStyle = 'balada' | 'concerto' | 'fogos' | 'scifi';

type Shell = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'crackle';

interface Rocket {
  x: number; y: number; vx: number; vy: number;
  color: string; kind: Shell; targetY: number;
  trail: Trail; shed: number;
}
interface Spark {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; color: string; size: number;
  drag: number; gravity: number;
  twinkle: number; twinkleSpeed: number;
  trail: Trail | null;
}
interface Ring {
  x: number; y: number; r: number; age: number; life: number;
  color: string; squash: number; speed: number; width: number;
}
interface Puff { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; spin: number }
interface Mote { x: number; y: number; vx: number; vy: number; size: number; phase: number; speed: number; color: string }

interface Flash { x: number; y: number; v: number; color: string }

export interface LightShowState {
  rockets: Rocket[];
  sparks: Spark[];
  rings: Ring[];
  puffs: Puff[];
  motes: Mote[];
  flash: Flash | null;
  nextLaunch: number;
  nextRing: number;
  rayAngle: number;
  seeded: boolean;
}

export function createLightShowState(): LightShowState {
  return {
    rockets: [], sparks: [], rings: [], puffs: [], motes: [],
    flash: null, nextLaunch: 0, nextRing: 0, rayAngle: 0, seeded: false,
  };
}

/** Ponto de referência do mascote quando a cena não recebeu uma zona. */
function anchor(w: number, h: number, hero: HeroZone | null) {
  return {
    x: hero ? hero.x : w / 2,
    y: hero ? hero.y : h * 0.58,
    rx: hero ? hero.rx : Math.min(w * 0.2, 320),
  };
}

/**
 * Névoa de palco. É a camada mais barata do arquivo e a que mais muda a
 * fotografia: sem ela o fundo é preto puro e a luz parece recortada em papel.
 */
function haze(ctx: Ctx, w: number, h: number, color: string, alpha: number, from = 0) {
  const rgb = toRgb(color);
  const g = ctx.createLinearGradient(0, from * h, 0, h);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(0.55, rgba(rgb, alpha * 0.42));
  g.addColorStop(1, rgba(rgb, alpha * 0.1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Vinheta acesa embaixo: o reflexo do palco no chão. */
function floorBounce(ctx: Ctx, w: number, h: number, color: string, alpha: number) {
  const rgb = toRgb(color);
  const g = ctx.createLinearGradient(0, h * 0.72, 0, h);
  g.addColorStop(0, rgba(rgb, 0));
  g.addColorStop(1, rgba(rgb, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
}

// ── Balada ───────────────────────────────────────────────────────────────────
// Ribalta de palco com batida. Cada refletor tem posição própria na treliça,
// varre no seu ritmo e acende no seu compasso — todos pulsando juntos é o que
// deixava a versão anterior com cara de protetor de tela.

const BPM = 126;

const FIXTURES = [
  { at: 0.09, color: '#FF2FD0', speed: 0.62, phase: 0.0, sweep: 0.50, div: 1 },
  { at: 0.26, color: '#00E5FF', speed: 0.47, phase: 1.9, sweep: 0.42, div: 2 },
  { at: 0.42, color: '#9B59B6', speed: 0.83, phase: 3.6, sweep: 0.56, div: 1 },
  { at: 0.58, color: '#FFD166', speed: 0.55, phase: 0.9, sweep: 0.46, div: 2 },
  { at: 0.74, color: '#FF6EC7', speed: 0.95, phase: 5.2, sweep: 0.40, div: 1 },
  { at: 0.91, color: '#2FFFC3', speed: 0.71, phase: 2.6, sweep: 0.52, div: 2 },
] as const;

/** Fileira de lâmpadas quentes na treliça, piscando na batida. */
function blinders(ctx: Ctx, w: number, h: number, u: number, beat: number) {
  for (let i = 0; i < 11; i++) {
    const x = w * (0.05 + (i / 10) * 0.9);
    const phase = (beat * 0.5 + i * 0.09) % 1;
    const on = Math.pow(Math.max(0, 1 - phase * 3), 2);
    if (on <= 0.02) continue;
    drawSprite(ctx, glowSprite('#FFE0A8'), x, h * 0.015, 22 * u, 0.5 * on);
    drawSprite(ctx, streakSprite('#FFD08A'), x, h * 0.015, 60 * u, 0.3 * on);
  }
}

function drawBalada(ctx: Ctx, w: number, h: number, t: number, hero: HeroZone | null) {
  const u = unit(w, h);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const beat = (t * BPM) / 60;
  const kick = Math.pow(1 - (beat % 1), 2.4);

  haze(ctx, w, h, '#4A1F7A', 0.085 + kick * 0.045);

  const trussY = -h * 0.06;
  const floorY = h * 0.965;

  for (const f of FIXTURES) {
    const ox = w * f.at;
    // duas senoides somadas: a varredura ganha um leve tranco em vez de ir e
    // voltar como um metrônomo
    const angle = Math.sin(t * f.speed + f.phase) * f.sweep
      + Math.sin(t * f.speed * 2.7 + f.phase * 1.7) * 0.07;
    const own = 0.5 + 0.5 * Math.pow(1 - ((beat / f.div + f.phase * 0.13) % 1), 1.7);
    const flick = 0.9 + 0.1 * Math.sin(t * 13 + f.phase * 2);
    const power = own * flick;

    volumeBeam(ctx, ox, trussY, angle, h * 1.55, 96 * u, f.color, power);

    const hit = ox + Math.tan(angle) * (floorY - trussY);
    drawFlat(ctx, glowSprite(f.color), hit, floorY, 130 * u, 0.18, 0.55 * power);

    drawSprite(ctx, glowSprite(f.color), ox, trussY, 36 * u, 0.9 * power);
    drawSprite(ctx, streakSprite(f.color), ox, trussY, 92 * u, 0.55 * power);
  }

  blinders(ctx, w, h, u, beat);
  floorBounce(ctx, w, h, '#7A3FD0', 0.1 + kick * 0.06);

  if (hero) heroSpot(ctx, w, h, hero, '#FFE6F5', 0.75 + kick * 0.35);

  ctx.restore();
}

// ── Concerto ─────────────────────────────────────────────────────────────────
// Feixes curvos varrendo devagar a partir de um ponto único no teto, com poeira
// no ar cruzando a luz. Azul e branco, ritmo de respiração — o oposto da balada.

const CONCERTO_BEAMS = [
  { color: '#0B6BFF', speed: 0.30, phase: 0.0, sweep: 0.58, curve: 0.40, len: 1.0 },
  { color: '#FFFFFF', speed: 0.25, phase: 2.5, sweep: 0.46, curve: 0.30, len: 0.94 },
  { color: '#00E5FF', speed: 0.40, phase: 5.0, sweep: 0.62, curve: 0.50, len: 1.0 },
  { color: '#3E86FF', speed: 0.20, phase: 1.2, sweep: 0.40, curve: 0.35, len: 0.9 },
  { color: '#9FD0FF', speed: 0.35, phase: 3.8, sweep: 0.52, curve: 0.45, len: 1.0 },
  { color: '#00B4FF', speed: 0.28, phase: 4.4, sweep: 0.66, curve: 0.55, len: 0.96 },
] as const;

const CONCERTO_PASSES = [
  { lw: 72, a: 0.030 },
  { lw: 46, a: 0.045 },
  { lw: 28, a: 0.065 },
  { lw: 15, a: 0.105 },
  { lw: 7.5, a: 0.19 },
  { lw: 3, a: 0.42 },
  { lw: 1.2, a: 0.7 },
] as const;

function seedMotes(s: LightShowState, w: number, h: number) {
  if (s.seeded) return;
  s.seeded = true;
  for (let i = 0; i < 54; i++) {
    s.motes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 9,
      vy: -(3 + Math.random() * 11),
      size: 0.9 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.6,
      color: Math.random() < 0.25 ? '#BBE4FF' : '#FFFFFF',
    });
  }
}

function drawMotes(ctx: Ctx, s: LightShowState, w: number, h: number, dt: number, u: number, alpha: number) {
  for (const m of s.motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.phase += m.speed * dt;
    if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
    if (m.x < -10) m.x = w + 10;
    if (m.x > w + 10) m.x = -10;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(m.phase * 3));
    drawSprite(ctx, glowSprite(m.color), m.x, m.y, m.size * 2.6 * u, tw * alpha);
  }
}

function drawConcerto(ctx: Ctx, w: number, h: number, t: number, dt: number, s: LightShowState, hero: HeroZone | null) {
  const u = unit(w, h);
  const cx = w / 2;
  const srcY = -h * 0.04;
  ctx.clearRect(0, 0, w, h);
  seedMotes(s, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const breath = 0.75 + 0.25 * Math.sin(t * 0.9);

  haze(ctx, w, h, '#0E3E8C', 0.10 * breath + 0.03);

  for (const b of CONCERTO_BEAMS) {
    const endX = cx + Math.sin(t * b.speed + b.phase) * b.sweep * w;
    const endY = h * b.len;
    const cpX = cx + Math.sin(t * b.speed * b.curve + b.phase) * w * 0.32;
    const rgb = toRgb(b.color);
    const hot = shade(rgb, 1.35);
    const power = 0.6 + 0.4 * Math.sin(t * 0.7 + b.phase * 0.8);

    // o degradê ao longo do feixe é o que faz a luz "morrer" no fundo do palco
    const grad = ctx.createLinearGradient(cx, srcY, endX, endY);
    grad.addColorStop(0, rgba(hot, 0.95));
    grad.addColorStop(0.18, rgba(rgb, 0.7));
    grad.addColorStop(0.5, rgba(rgb, 0.32));
    grad.addColorStop(1, rgba(rgb, 0));
    ctx.strokeStyle = grad;

    for (const pass of CONCERTO_PASSES) {
      ctx.globalAlpha = pass.a * power;
      ctx.lineWidth = pass.lw * u;
      ctx.beginPath();
      ctx.moveTo(cx, srcY);
      ctx.quadraticCurveTo(cpX, h * 0.45, endX, endY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // onde o feixe encosta no chão
    if (b.len > 0.95) drawFlat(ctx, glowSprite(b.color), endX, h * 0.97, 110 * u, 0.16, 0.4 * power);
  }

  drawMotes(ctx, s, w, h, dt, u, 0.5);

  // a fonte: bola quente com risco de lente, o "ponto de origem" da cena
  drawSprite(ctx, glowSprite('#DCEEFF'), cx, srcY, 88 * u * breath, 0.95);
  drawSprite(ctx, streakSprite('#AFD8FF'), cx, srcY, 240 * u, 0.5 * breath);

  floorBounce(ctx, w, h, '#1B5FC4', 0.11 * breath);

  if (hero) heroSpot(ctx, w, h, hero, '#DCEEFF', 0.8 * breath + 0.25);

  ctx.restore();
}

// ── Fogos ────────────────────────────────────────────────────────────────────
// Foguete sobe soltando faísca, estoura em casca com tipo próprio, o céu acende
// por um instante, sai onda de choque e fica fumaça no ar. É a sequência inteira
// que faz ler como fogo de artifício; faltando o estouro e o resíduo, o que
// sobra é um punhado de pontinhos coloridos.

const FOGOS_COLORS = ['#FFD166', '#FF4081', '#00E5FF', '#00FFA3', '#A855F7', '#FF6B35', '#FFFFFF'];
const WILLOW_GOLD = '#FFC46B';

/**
 * Teto de faíscas vivas. O show de luzes roda enquanto o sorteio durar — sem
 * teto, uma sequência de cascas grandes acumula partícula até o quadro cair.
 * O efeito de recompensa não precisa disso: ele acaba em quatro segundos.
 */
const MAX_SPARKS = 900;

function pushSpark(
  s: LightShowState, x: number, y: number, vx: number, vy: number,
  color: string, life: number, size: number, drag: number, gravity: number,
  twinkleSpeed: number, trailLen: number,
) {
  if (s.sparks.length >= MAX_SPARKS) return;
  s.sparks.push({
    x, y, vx, vy, age: 0, life, color, size, drag, gravity,
    twinkle: Math.random() * Math.PI * 2, twinkleSpeed,
    trail: trailLen > 0 ? new Trail(trailLen) : null,
  });
}

function burst(s: LightShowState, r: Rocket, S: number, u: number) {
  const { x, y, color, kind } = r;

  s.flash = { x, y, v: 1, color };
  s.rings.push({ x, y, r: S * 0.015, age: 0, life: 0.5, color, squash: 1, speed: S * 1.9, width: 1.1 * u });

  for (let i = 0; i < 3; i++) {
    s.puffs.push({
      x: x + (Math.random() - 0.5) * S * 0.1,
      y: y + (Math.random() - 0.5) * S * 0.1,
      vx: (Math.random() - 0.5) * 14,
      vy: -(4 + Math.random() * 10),
      age: 0, life: 2.4 + Math.random() * 1.4,
      size: S * (0.11 + Math.random() * 0.09),
      spin: (Math.random() - 0.5) * 0.6,
    });
  }

  // pistilo: miolo branco que toda casca de verdade tem
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = S * (0.05 + Math.random() * 0.09);
    pushSpark(s, x, y, Math.cos(a) * sp, Math.sin(a) * sp, '#FFF6D8', 0.8 + Math.random() * 0.4, 2.6 * u, 2.2, S * 0.18, 18, 0);
  }

  if (kind === 'ring') {
    const n = 76;
    const tilt = (Math.random() - 0.5) * 0.9;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const sp = S * (0.42 + Math.random() * 0.12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const j = 0.93 + Math.random() * 0.14;
      // círculo achatado e depois inclinado: lê como um plano no espaço,
      // não como um "O" desenhado na tela
      const ux = Math.cos(a) * sp * j;
      const uy = Math.sin(a) * sp * j * 0.34;
      pushSpark(
        s, x, y, ux * cosT - uy * sinT, ux * sinT + uy * cosT,
        color, 1.5 + Math.random() * 0.5, 2.8 * u, 1.0, S * 0.2, 12 + Math.random() * 10, 5,
      );
    }
    s.rings.push({ x, y, r: S * 0.02, age: 0, life: 0.8, color, squash: 0.34, speed: S * 0.95, width: 0.9 * u });
    return;
  }

  if (kind === 'willow') {
    const n = 62;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = S * (0.14 + Math.random() * 0.24) * Math.sqrt(Math.random());
      pushSpark(
        s, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        Math.random() < 0.2 ? '#FFF0C0' : WILLOW_GOLD,
        2.4 + Math.random() * 0.9, 2.9 * u, 0.5, S * 0.42, 4 + Math.random() * 5,
        i % 3 === 0 ? 0 : 12,
      );
    }
    return;
  }

  if (kind === 'chrysanthemum') {
    const n = 80;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = S * (0.2 + Math.random() * 0.34) * Math.sqrt(Math.random());
      pushSpark(
        s, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        color, 1.9 + Math.random() * 0.7, 3.0 * u, 0.85, S * 0.24,
        6 + Math.random() * 6, i % 2 === 0 ? 11 : 0,
      );
    }
    return;
  }

  const crackle = kind === 'crackle';
  const n = crackle ? 104 : 86;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = S * (0.22 + Math.random() * 0.38) * Math.sqrt(Math.random());
    pushSpark(
      s, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      crackle && Math.random() < 0.45 ? '#FFFFFF' : color,
      crackle ? 0.9 + Math.random() * 0.5 : 1.4 + Math.random() * 0.6,
      (crackle ? 2.2 : 3.2) * u,
      crackle ? 2.0 : 1.25,
      S * 0.26,
      crackle ? 30 + Math.random() * 18 : 8 + Math.random() * 8,
      crackle ? 0 : (i % 3 === 0 ? 8 : 0),
    );
  }
}

function drawFogos(ctx: Ctx, w: number, h: number, t: number, dt: number, s: LightShowState, hero: HeroZone | null) {
  const u = unit(w, h);
  const S = sceneScale(w, h);
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  haze(ctx, w, h, '#101C3A', 0.1);

  // o clarão do estouro lavando o céu inteiro por um instante
  if (s.flash) {
    s.flash.v -= dt * 3.4;
    if (s.flash.v <= 0) {
      s.flash = null;
    } else {
      const v = s.flash.v * s.flash.v;
      const rgb = toRgb(s.flash.color);
      const g = ctx.createRadialGradient(s.flash.x, s.flash.y, 0, s.flash.x, s.flash.y, S * 1.6);
      g.addColorStop(0, rgba(shade(rgb, 1.4), 0.3 * v));
      g.addColorStop(0.4, rgba(rgb, 0.12 * v));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // fumaça primeiro: fica atrás das faíscas, como no céu de verdade
  const smoke = smokeSprite();
  for (let i = s.puffs.length - 1; i >= 0; i--) {
    const p = s.puffs[i];
    p.age += dt;
    if (p.age >= p.life) { s.puffs.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy *= Math.exp(-0.4 * dt);
    const k = p.age / p.life;
    drawSprite(ctx, smoke, p.x, p.y, p.size * (0.55 + k * 1.5), (1 - k) * (1 - k) * 0.75);
  }

  if (t >= s.nextLaunch) {
    const shots = Math.random() < 0.3 ? 2 : 1;
    for (let k = 0; k < shots; k++) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const targetY = h * (0.1 + Math.random() * 0.28);
      const roll = Math.random();
      const kind: Shell = roll < 0.3 ? 'peony'
        : roll < 0.52 ? 'chrysanthemum'
        : roll < 0.7 ? 'willow'
        : roll < 0.87 ? 'ring' : 'crackle';
      s.rockets.push({
        // as subidas evitam o corredor central, onde o mascote aparece
        x: side === 0 ? w * (0.06 + Math.random() * 0.3) : w * (0.64 + Math.random() * 0.3),
        y: h + 8,
        vx: (Math.random() - 0.5) * S * 0.12,
        vy: -(h - targetY) * 1.55,
        color: kind === 'willow' ? WILLOW_GOLD : FOGOS_COLORS[Math.floor(Math.random() * FOGOS_COLORS.length)],
        kind, targetY,
        trail: new Trail(11),
        shed: 0,
      });
    }
    s.nextLaunch = t + 0.4 + Math.random() * 0.45;
  }

  for (let i = s.rockets.length - 1; i >= 0; i--) {
    const r = s.rockets[i];
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.vy += S * 0.62 * dt;
    r.trail.push(r.x, r.y, dt);

    // faísca solta pelo caminho: é o que faz a subida existir em vez de ser um
    // ponto que sobe em silêncio
    r.shed += dt;
    if (r.shed > 0.03) {
      r.shed = 0;
      pushSpark(
        s, r.x, r.y, (Math.random() - 0.5) * S * 0.07, S * 0.05 + Math.random() * S * 0.05,
        '#FFC46B', 0.32 + Math.random() * 0.2, 1.7 * u, 2.6, S * 0.1, 24, 0,
      );
    }

    if (r.y <= r.targetY || r.vy >= -S * 0.06) {
      burst(s, r, S, u);
      s.rockets.splice(i, 1);
      continue;
    }

    r.trail.stroke(ctx, '#FFC46B', 2.4 * u, 0.9);
    drawSprite(ctx, glowSprite('#FFE9A8'), r.x, r.y, 11 * u, 0.95);
  }

  for (let i = s.rings.length - 1; i >= 0; i--) {
    const ring = s.rings[i];
    ring.age += dt;
    if (ring.age >= ring.life) { s.rings.splice(i, 1); continue; }
    const k = ring.age / ring.life;
    ring.r += ring.speed * dt * (1 - k * 0.7);
    glowRing(ctx, ring.x, ring.y, ring.r, ring.squash, ring.color, (1 - k) * (1 - k) * 0.5, ring.width);
  }

  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.age += dt;
    if (p.age >= p.life) { s.sparks.splice(i, 1); continue; }
    const damp = Math.exp(-p.drag * dt);
    p.vx *= damp;
    p.vy = (p.vy + p.gravity * dt) * damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.trail?.push(p.x, p.y, dt);

    const k = 1 - p.age / p.life;
    p.twinkle += p.twinkleSpeed * dt;
    const alpha = k * k * (0.6 + 0.4 * Math.sin(p.twinkle));
    p.trail?.stroke(ctx, p.color, p.size * 0.7, alpha);
    drawSprite(ctx, glowSprite(p.color), p.x, p.y, p.size * (0.7 + k * 1.1), alpha);
  }

  floorBounce(ctx, w, h, '#2B3F7A', 0.09);

  if (hero) heroSpot(ctx, w, h, hero, '#FFE3B8', 0.7);

  ctx.restore();
}

// ── Sci-fi ───────────────────────────────────────────────────────────────────
// Portal atrás do mascote: anéis em perspectiva nascendo acima da linha do corpo,
// raios volumétricos girando e brasa subindo. A cena envolve o personagem em vez
// de passar por cima dele.

const SCIFI_A = '#00FFA3';
const SCIFI_B = '#00E5FF';

/** Raio do portal: cunha com degradê, não risco de 1px. */
function wedge(ctx: Ctx, cx: number, cy: number, angle: number, len: number, halfEnd: number, color: string, alpha: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ex = cx + dx * len;
  const ey = cy + dy * len;
  const px = -dy * halfEnd;
  const py = dx * halfEnd;
  const rgb = toRgb(color);
  const g = ctx.createLinearGradient(cx, cy, ex, ey);
  g.addColorStop(0, rgba(shade(rgb, 1.5), alpha));
  g.addColorStop(0.45, rgba(rgb, alpha * 0.45));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex + px, ey + py);
  ctx.lineTo(ex - px, ey - py);
  ctx.closePath();
  ctx.fill();
}

function drawScifi(ctx: Ctx, w: number, h: number, t: number, dt: number, s: LightShowState, hero: HeroZone | null) {
  const u = unit(w, h);
  const a = anchor(w, h, hero);
  const cx = a.x;
  const cy = h * 0.32;
  const feet = Math.min(h - 2, a.y + (hero ? hero.ry * 0.82 : h * 0.3));
  ctx.clearRect(0, 0, w, h);
  seedMotes(s, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const charge = 0.7 + 0.3 * Math.sin(t * 1.9);

  haze(ctx, w, h, '#02392F', 0.11);

  // coluna de energia subindo por trás do corpo
  const col = ctx.createLinearGradient(cx, feet, cx, cy - h * 0.1);
  col.addColorStop(0, rgba(toRgb(SCIFI_A), 0));
  col.addColorStop(0.45, rgba(toRgb(SCIFI_A), 0.1 * charge));
  col.addColorStop(1, rgba(toRgb(SCIFI_B), 0.02));
  ctx.fillStyle = col;
  ctx.fillRect(cx - a.rx * 1.1, cy - h * 0.1, a.rx * 2.2, feet - cy + h * 0.1);

  if (t >= s.nextRing) {
    s.rings.push({
      x: cx, y: cy, r: 8 * u, age: 0, life: 1.7 + Math.random() * 0.5,
      color: Math.random() < 0.32 ? SCIFI_B : SCIFI_A,
      squash: 0.36, speed: 195 * u, width: 1.5 * u,
    });
    s.nextRing = t + 0.3 + Math.random() * 0.2;
  }

  for (let i = s.rings.length - 1; i >= 0; i--) {
    const ring = s.rings[i];
    ring.age += dt;
    if (ring.age >= ring.life) { s.rings.splice(i, 1); continue; }
    const k = ring.age / ring.life;
    ring.r += ring.speed * dt;
    glowRing(ctx, ring.x, ring.y, ring.r, ring.squash, ring.color, (1 - k) * 0.6, ring.width);
  }

  // raios girando, dois conjuntos em sentidos opostos
  s.rayAngle += 0.55 * dt;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.5);
  for (let i = 0; i < 12; i++) {
    const ang = s.rayAngle + (i / 12) * Math.PI * 2;
    const len = (95 + Math.sin(t * 2.1 + i * 1.1) * 42) * u;
    wedge(ctx, 0, 0, ang, len, 13 * u, i % 3 === 0 ? SCIFI_B : SCIFI_A, 0.5 * charge);
  }
  for (let i = 0; i < 6; i++) {
    const ang = -s.rayAngle * 1.6 + (i / 6) * Math.PI * 2;
    const len = (150 + Math.sin(t * 1.4 + i) * 50) * u;
    wedge(ctx, 0, 0, ang, len, 6 * u, '#CFFFF0', 0.3 * charge);
  }
  ctx.restore();

  drawMotes(ctx, s, w, h, dt, u, 0.35);

  // núcleo do portal
  drawSprite(ctx, haloSprite(SCIFI_A), cx, cy, 120 * u * charge, 0.45);
  drawSprite(ctx, glowSprite('#CFFFF0'), cx, cy, 44 * u * charge, 0.8);
  drawSprite(ctx, streakSprite(SCIFI_B), cx, cy, 190 * u, 0.4 * charge);

  // pulso no chão, na altura dos pés
  const pulse = (Math.sin(t * 1.9) + 1) / 2;
  drawFlat(ctx, glowSprite(SCIFI_A), cx, feet, (130 + pulse * 70) * u, 0.16, 0.35 + pulse * 0.25);

  // varredura horizontal: faixa larga com núcleo aceso, nunca uma régua dura
  const scanY = cy + Math.sin(t * 1.6) * h * 0.36;
  const across = ctx.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, rgba(toRgb(SCIFI_A), 0));
  across.addColorStop(0.5, rgba(toRgb(SCIFI_A), 0.3));
  across.addColorStop(1, rgba(toRgb(SCIFI_A), 0));
  ctx.save();
  ctx.translate(0, scanY);
  ctx.fillStyle = across;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, -14 * u, w, 28 * u);
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, -1.4 * u, w, 2.8 * u);
  ctx.globalAlpha = 1;
  ctx.restore();

  floorBounce(ctx, w, h, '#00A377', 0.12);

  if (hero) heroSpot(ctx, w, h, hero, '#B9FFEA', 0.75 + pulse * 0.25);

  ctx.restore();
}

// ── Entrada única ────────────────────────────────────────────────────────────

export function drawLightShow(
  style: LightStyle,
  ctx: Ctx, w: number, h: number,
  t: number, dt: number,
  state: LightShowState,
  hero: HeroZone | null,
) {
  switch (style) {
    case 'balada': drawBalada(ctx, w, h, t, hero); break;
    case 'concerto': drawConcerto(ctx, w, h, t, dt, state, hero); break;
    case 'fogos': drawFogos(ctx, w, h, t, dt, state, hero); break;
    case 'scifi': drawScifi(ctx, w, h, t, dt, state, hero); break;
  }
  if (hero) carveHero(ctx, hero);
}
