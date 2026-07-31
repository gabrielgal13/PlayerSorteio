/* ============================================================================
 * POKÉARENA LIVE — cenário
 *
 * Fundo 100% procedural em canvas (nenhum asset): céu com iluminação por
 * clima/horário, montanhas em parallax, lago com reflexo e ondulação, mata
 * balançando, poeira, chuva/neve/areia, relâmpagos, névoa e vinheta.
 *
 * Os sprites dos Pokémon NÃO são desenhados aqui — ficam em <img> por cima do
 * canvas, para que os GIFs animados continuem animando.
 * ========================================================================== */
'use client';
import { WEATHER, type WeatherKey } from './data';

/* --------------------------------------------------------------- aleatório */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tree { x: number; y: number; scale: number; hue: number; phase: number; }
interface Blade { x: number; y: number; h: number; phase: number; }
interface Mote { x: number; y: number; r: number; sp: number; phase: number; }
interface Drop { x: number; y: number; v: number; len: number; sway: number; }
interface Flake { x: number; y: number; r: number; v: number; phase: number; }
interface Ball { x: number; y: number; v: number; rot: number; spin: number; }

export interface Scene {
  trees: Tree[];
  blades: Blade[];
  motes: Mote[];
  drops: Drop[];
  flakes: Flake[];
  balls: Ball[];
  t: number;            // tempo acumulado (s)
  flash: number;        // intensidade do relâmpago 0..1
  nextFlash: number;
  w: number; h: number;
}

export function createScene(): Scene {
  const rand = mulberry(20260731);
  const trees: Tree[] = [];
  for (let i = 0; i < 22; i++) {
    trees.push({
      x: rand(), y: 0.52 + rand() * 0.42,
      scale: 0.55 + rand() * 0.75,
      hue: 96 + rand() * 40,
      phase: rand() * Math.PI * 2,
    });
  }
  trees.sort((a, b) => a.y - b.y);

  const blades: Blade[] = [];
  for (let i = 0; i < 260; i++) {
    blades.push({ x: rand(), y: 0.55 + rand() * 0.45, h: 6 + rand() * 16, phase: rand() * 6.28 });
  }
  const motes: Mote[] = [];
  for (let i = 0; i < 46; i++) {
    motes.push({ x: rand(), y: rand(), r: 0.6 + rand() * 1.9, sp: 0.1 + rand() * 0.5, phase: rand() * 6.28 });
  }
  return { trees, blades, motes, drops: [], flakes: [], balls: [], t: 0, flash: 0, nextFlash: 4, w: 0, h: 0 };
}

/* -------------------------------------------------------------- paletas --- */
interface Palette {
  skyTop: string; skyBot: string;
  hillFar: string; hillNear: string;
  ground: string; groundDeep: string;
  water: string; waterHi: string;
  light: string;    // cor da luz ambiente aplicada por cima
  lightA: number;   // opacidade
  ambient: number;  // escurecimento geral 0..1
}

const PALETTES: Record<WeatherKey, Palette> = {
  clear: {
    skyTop: '#3EA8E5', skyBot: '#BFE9FF', hillFar: '#5E9B6E', hillNear: '#3F7A55',
    ground: '#5FB265', groundDeep: '#3C7A48', water: '#2F7FC4', waterHi: '#9BE0FF',
    light: '#FFE9A8', lightA: 0.10, ambient: 0,
  },
  rain: {
    skyTop: '#3B4A5C', skyBot: '#7C90A3', hillFar: '#3F6B54', hillNear: '#2C5340',
    ground: '#417A4C', groundDeep: '#2A5435', water: '#2A5F91', waterHi: '#8FC6EE',
    light: '#8FB6D8', lightA: 0.14, ambient: 0.18,
  },
  night: {
    skyTop: '#0A1030', skyBot: '#243060', hillFar: '#1B3A44', hillNear: '#132A33',
    ground: '#1E3D33', groundDeep: '#132A25', water: '#123055', waterHi: '#6E9FE0',
    light: '#5C74C8', lightA: 0.20, ambient: 0.42,
  },
  storm: {
    skyTop: '#1B2233', skyBot: '#48566B', hillFar: '#2E4C46', hillNear: '#20362F',
    ground: '#2E5540', groundDeep: '#1D3A2B', water: '#1D4670', waterHi: '#7FB4E8',
    light: '#93A8FF', lightA: 0.16, ambient: 0.34,
  },
  fullmoon: {
    skyTop: '#150A33', skyBot: '#3D2566', hillFar: '#2A3A5E', hillNear: '#1E2A46',
    ground: '#28405A', groundDeep: '#1A2C40', water: '#22336E', waterHi: '#C9A6FF',
    light: '#E5C6FF', lightA: 0.22, ambient: 0.36,
  },
  blizzard: {
    skyTop: '#8FA6BC', skyBot: '#D8E7F2', hillFar: '#8FA9A6', hillNear: '#71908E',
    ground: '#B9D3DA', groundDeep: '#8FB2BC', water: '#6E9FC4', waterHi: '#E8F7FF',
    light: '#EAF6FF', lightA: 0.24, ambient: 0.08,
  },
  sandstorm: {
    skyTop: '#B0803C', skyBot: '#E5C27A', hillFar: '#9C7A46', hillNear: '#7E6135',
    ground: '#C6A25C', groundDeep: '#9A7A42', water: '#7E8E67', waterHi: '#E7D9A6',
    light: '#FFD98F', lightA: 0.26, ambient: 0.14,
  },
};

/* ---------------------------------------------------------------- render --- */

export interface RenderOpts {
  weather: WeatherKey;
  /** mostra a chuva de pokébolas */
  ballRain: boolean;
  /** destaque no centro (spawn/boss em cena) */
  spotlight: boolean;
  /** brilho extra pra shiny/lendário */
  aura: string | null;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  W: number, H: number,
  dtMs: number,
  opts: RenderOpts,
) {
  const dt = Math.min(dtMs, 60) / 1000;
  scene.t += dt;
  scene.w = W; scene.h = H;
  const pal = PALETTES[opts.weather] ?? PALETTES.clear;
  const wd = WEATHER[opts.weather];
  const horizon = H * 0.52;

  ctx.clearRect(0, 0, W, H);

  /* céu */
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 40);

  /* astro */
  drawCelestial(ctx, scene, W, horizon, opts.weather);

  /* nuvens */
  drawClouds(ctx, scene, W, horizon, opts.weather);

  /* montanhas em parallax */
  drawHills(ctx, W, horizon, pal.hillFar, 0.14, scene.t * 2, 46);
  drawHills(ctx, W, horizon + 14, pal.hillNear, 0.22, scene.t * 3.4 + 120, 68);

  /* chão */
  const gr = ctx.createLinearGradient(0, horizon, 0, H);
  gr.addColorStop(0, pal.ground);
  gr.addColorStop(1, pal.groundDeep);
  ctx.fillStyle = gr;
  ctx.fillRect(0, horizon, W, H - horizon);

  /* caminho de terra */
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#C8A96B';
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - 40, H);
  ctx.quadraticCurveTo(W * 0.5, H * 0.78, W * 0.5 + 6, horizon + 10);
  ctx.lineTo(W * 0.5 + 46, horizon + 10);
  ctx.quadraticCurveTo(W * 0.5 + 90, H * 0.8, W * 0.5 + 150, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* lago */
  drawPond(ctx, scene, W, H, horizon, pal);

  /* grama */
  drawGrass(ctx, scene, W, H, horizon, pal);

  /* árvores */
  for (const tr of scene.trees) drawTree(ctx, scene, tr, W, H, horizon, pal);

  /* poeira / vaga-lumes */
  drawMotes(ctx, scene, W, H, opts.weather);

  /* holofote central */
  if (opts.spotlight) {
    const cx = W * 0.5, cy = H * 0.62;
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.min(W, H) * 0.42);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sombra elíptica sob o Pokémon
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.665, 56, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (opts.aura) drawAura(ctx, scene, W, H, opts.aura);

  /* clima por cima de tudo */
  applyWeather(ctx, scene, W, H, dt, opts.weather);

  /* chuva de pokébolas */
  if (opts.ballRain) drawBallRain(ctx, scene, W, H, dt);
  else if (scene.balls.length) scene.balls.length = 0;

  /* luz ambiente + vinheta */
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = pal.lightA;
  ctx.fillStyle = pal.light;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (pal.ambient > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(30,36,80,${pal.ambient})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (wd.dark && scene.flash > 0.01) {
    ctx.fillStyle = `rgba(210,225,255,${scene.flash * 0.55})`;
    ctx.fillRect(0, 0, W, H);
  }

  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------- elementos --- */

function drawCelestial(ctx: CanvasRenderingContext2D, s: Scene, W: number, horizon: number, weather: WeatherKey) {
  const night = weather === 'night' || weather === 'fullmoon' || weather === 'storm';
  const x = W * 0.78, y = horizon * 0.34;
  if (night) {
    // estrelas
    const rand = mulberry(7);
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const sx = rand() * W, sy = rand() * horizon * 0.9;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(s.t * (0.6 + rand()) + i));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.restore();
    const r = weather === 'fullmoon' ? 40 : 26;
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
    g.addColorStop(0, weather === 'fullmoon' ? 'rgba(255,230,255,0.55)' : 'rgba(210,225,255,0.35)');
    g.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, 6.29); ctx.fill();
    ctx.fillStyle = weather === 'fullmoon' ? '#FFF3FF' : '#E8EEFF';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(180,190,220,0.35)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.16, 0, 6.29); ctx.fill();
  } else {
    const r = 30;
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,240,180,0.65)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#FFF6D0';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, s: Scene, W: number, horizon: number, weather: WeatherKey) {
  const dark = weather === 'storm' || weather === 'rain';
  const n = dark ? 7 : 4;
  const rand = mulberry(99);
  ctx.save();
  ctx.globalAlpha = dark ? 0.55 : 0.32;
  for (let i = 0; i < n; i++) {
    const base = rand();
    const y = horizon * (0.15 + rand() * 0.5);
    const speed = 6 + rand() * 10;
    const x = ((base * W + s.t * speed) % (W + 320)) - 160;
    const sc = 0.6 + rand() * 0.9;
    ctx.fillStyle = dark ? '#31405A' : '#FFFFFF';
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * 34 * sc;
      const oy = Math.sin(k * 1.7 + i) * 8 * sc;
      const r = (26 - Math.abs(k - 2) * 6) * sc;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, Math.max(6, r), 0, 6.29); ctx.fill();
    }
  }
  ctx.restore();
}

function drawHills(ctx: CanvasRenderingContext2D, W: number, baseY: number, color: string, alpha: number, offset: number, amp: number) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, baseY + 30);
  for (let x = -20; x <= W + 20; x += 12) {
    const y = baseY - amp * (0.5 + 0.5 * Math.sin((x + offset) * 0.006)) - amp * 0.35 * Math.sin((x + offset) * 0.017);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 20, baseY + 30);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

function drawPond(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, horizon: number, pal: Palette) {
  const cx = W * 0.19, cy = horizon + (H - horizon) * 0.42;
  const rx = W * 0.17, ry = (H - horizon) * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.29);
  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, pal.waterHi);
  g.addColorStop(0.45, pal.water);
  g.addColorStop(1, pal.water);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  // ondulações
  for (let i = 0; i < 7; i++) {
    const t = (s.t * 0.4 + i / 7) % 1;
    ctx.globalAlpha = (1 - t) * 0.4;
    ctx.strokeStyle = pal.waterHi;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * t, ry * t, 0, 0, 6.29);
    ctx.stroke();
  }
  // brilho refletido
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const yy = cy - ry * 0.6 + i * (ry * 0.32);
    const off = Math.sin(s.t * 1.3 + i) * 12;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.5 + off, yy);
    ctx.lineTo(cx - rx * 0.1 + off, yy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.29); ctx.stroke();
  ctx.restore();
}

function drawGrass(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, horizon: number, pal: Palette) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const b of s.blades) {
    const x = b.x * W;
    const y = horizon + (H - horizon) * ((b.y - 0.55) / 0.45);
    const depth = (y - horizon) / Math.max(1, H - horizon);
    const h = b.h * (0.5 + depth);
    const sway = Math.sin(s.t * 1.7 + b.phase) * (2 + depth * 4);
    ctx.strokeStyle = depth > 0.5 ? pal.ground : pal.groundDeep;
    ctx.globalAlpha = 0.5 + depth * 0.4;
    ctx.lineWidth = 1 + depth * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.5, y - h * 0.6, x + sway, y - h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, s: Scene, tr: Tree, W: number, H: number, horizon: number, pal: Palette) {
  const x = tr.x * W;
  const y = horizon + (H - horizon) * ((tr.y - 0.52) / 0.42);
  const depth = 0.35 + ((y - horizon) / Math.max(1, H - horizon)) * 0.9;
  const sc = tr.scale * depth;
  const sway = Math.sin(s.t * 0.9 + tr.phase) * 3 * sc;

  // sombra
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + 6 * sc, y + 2, 26 * sc, 7 * sc, 0, 0, 6.29);
  ctx.fill();
  ctx.restore();

  // tronco
  ctx.fillStyle = '#6B4A2F';
  ctx.beginPath();
  ctx.moveTo(x - 5 * sc, y);
  ctx.lineTo(x - 3 * sc + sway * 0.3, y - 40 * sc);
  ctx.lineTo(x + 3 * sc + sway * 0.3, y - 40 * sc);
  ctx.lineTo(x + 5 * sc, y);
  ctx.closePath();
  ctx.fill();

  // copa em camadas
  const cx = x + sway, cy = y - 52 * sc;
  for (let i = 0; i < 3; i++) {
    const r = (30 - i * 6) * sc;
    ctx.fillStyle = `hsl(${tr.hue - i * 6} ${45 - i * 5}% ${28 + i * 9}%)`;
    ctx.beginPath();
    ctx.arc(cx - 12 * sc + i * 10 * sc, cy - i * 9 * sc, r, 0, 6.29);
    ctx.fill();
  }
  // brilho no topo
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pal.waterHi;
  ctx.beginPath();
  ctx.arc(cx + 6 * sc, cy - 22 * sc, 12 * sc, 0, 6.29);
  ctx.fill();
  ctx.restore();
}

function drawMotes(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, weather: WeatherKey) {
  const night = weather === 'night' || weather === 'fullmoon';
  ctx.save();
  for (const m of s.motes) {
    const x = ((m.x + s.t * m.sp * 0.02) % 1) * W;
    const y = ((m.y + Math.sin(s.t * 0.4 + m.phase) * 0.02 + 1) % 1) * H;
    const a = 0.25 + 0.35 * Math.abs(Math.sin(s.t * 1.4 + m.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = night ? '#B6FF9E' : '#FFF6D0';
    if (night) {
      ctx.shadowBlur = 8; ctx.shadowColor = '#B6FF9E';
    }
    ctx.beginPath(); ctx.arc(x, y, m.r, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawAura(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, color: string) {
  const cx = W * 0.5, cy = H * 0.58;
  const pulse = 0.6 + 0.4 * Math.sin(s.t * 3.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190 * (0.85 + pulse * 0.2));
  g.addColorStop(0, color + 'aa');
  g.addColorStop(0.4, color + '33');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // raios girando
  ctx.translate(cx, cy);
  ctx.rotate(s.t * 0.6);
  ctx.globalAlpha = 0.25 * pulse;
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(9, -175);
    ctx.lineTo(-9, -175);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- clima --- */

function applyWeather(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, dt: number, weather: WeatherKey) {
  switch (weather) {
    case 'rain':
    case 'storm': {
      const target = weather === 'storm' ? 320 : 190;
      while (s.drops.length < target) {
        s.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 700 + Math.random() * 620, len: 10 + Math.random() * 20, sway: weather === 'storm' ? 3.2 : 1.4 });
      }
      if (s.drops.length > target) s.drops.length = target;
      ctx.save();
      ctx.strokeStyle = weather === 'storm' ? 'rgba(190,220,255,0.55)' : 'rgba(180,210,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of s.drops) {
        d.y += d.v * dt;
        d.x += d.sway * 26 * dt;
        if (d.y > H) { d.y = -20; d.x = Math.random() * W; }
        if (d.x > W) d.x = 0;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.sway * 3, d.y + d.len);
      }
      ctx.stroke();
      ctx.restore();

      if (weather === 'storm') {
        s.nextFlash -= dt;
        if (s.nextFlash <= 0) { s.flash = 1; s.nextFlash = 3 + Math.random() * 7; }
        s.flash = Math.max(0, s.flash - dt * 3.2);
      }
      break;
    }
    case 'blizzard': {
      const target = 260;
      while (s.flakes.length < target) {
        s.flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.8, v: 40 + Math.random() * 90, phase: Math.random() * 6.28 });
      }
      if (s.flakes.length > target) s.flakes.length = target;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of s.flakes) {
        f.y += f.v * dt;
        f.x += Math.sin(s.t * 1.4 + f.phase) * 34 * dt + 40 * dt;
        if (f.y > H) { f.y = -8; f.x = Math.random() * W; }
        if (f.x > W) f.x = -6;
        ctx.globalAlpha = 0.5 + f.r / 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.29); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(220,238,250,0.14)';
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'sandstorm': {
      const target = 200;
      while (s.drops.length < target) {
        s.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 60 + Math.random() * 120, len: 14 + Math.random() * 26, sway: 1 });
      }
      if (s.drops.length > target) s.drops.length = target;
      ctx.save();
      ctx.strokeStyle = 'rgba(240,214,150,0.4)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const d of s.drops) {
        d.x += (420 + d.v) * dt;
        d.y += Math.sin(s.t * 2 + d.x * 0.01) * 18 * dt;
        if (d.x > W + 30) { d.x = -30; d.y = Math.random() * H; }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len, d.y + 1.5);
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(214,164,80,0.16)';
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'night':
    case 'fullmoon': {
      // névoa baixa
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = weather === 'fullmoon' ? '#C9A6FF' : '#9FB4E0';
      for (let i = 0; i < 4; i++) {
        const y = H * (0.6 + i * 0.09);
        const off = Math.sin(s.t * 0.3 + i) * 60;
        ctx.beginPath();
        ctx.ellipse(W * 0.5 + off, y, W * 0.7, 24, 0, 0, 6.29);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    default: {
      if (s.drops.length) s.drops.length = 0;
      if (s.flakes.length) s.flakes.length = 0;
    }
  }
}

function drawBallRain(ctx: CanvasRenderingContext2D, s: Scene, W: number, H: number, dt: number) {
  while (s.balls.length < 42) {
    s.balls.push({ x: Math.random() * W, y: -Math.random() * H, v: 210 + Math.random() * 260, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 6 });
  }
  for (const b of s.balls) {
    b.y += b.v * dt;
    b.rot += b.spin * dt;
    if (b.y > H + 20) { b.y = -20; b.x = Math.random() * W; }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    const r = 11;
    ctx.fillStyle = '#EE3B3B';
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 6.29); ctx.fillStyle = '#F5F5F5'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
