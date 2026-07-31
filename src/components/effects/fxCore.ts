'use client';

/**
 * Base compartilhada dos efeitos em canvas.
 *
 * Três coisas que todo efeito daqui precisa acertar:
 *  1. resolução real (devicePixelRatio) — sem isso tudo sai borrado em tela grande;
 *  2. física por tempo (dt) — sem isso a animação roda 2x mais rápido em monitor 144Hz;
 *  3. rastro sem véu — apagar com destination-out em vez de pintar um retângulo escuro
 *     por cima, que é o que estava encobrindo o mascote.
 */

export type Ctx = CanvasRenderingContext2D;

export interface Surface {
  ctx: Ctx;
  /** Dimensões em px lógicos (CSS). O contexto já está escalado pelo DPR. */
  size: { w: number; h: number };
  dispose: () => void;
}

/** Acima de 2x o custo de render não compensa o ganho visual. */
const MAX_DPR = 2;

export function createSurface(canvas: HTMLCanvasElement, mode: 'viewport' | 'element'): Surface | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const size = { w: 0, h: 0 };
  let dpr = 0;

  const measure = () => {
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(mode === 'viewport' ? window.innerWidth : canvas.clientWidth || canvas.offsetWidth);
    const h = Math.round(mode === 'viewport' ? window.innerHeight : canvas.clientHeight || canvas.offsetHeight);
    if (w <= 0 || h <= 0) return;
    if (w === size.w && h === size.h && nextDpr === dpr) return;
    size.w = w;
    size.h = h;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  measure();

  let ro: ResizeObserver | null = null;
  if (mode === 'element') {
    ro = new ResizeObserver(measure);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', measure);
  }

  return {
    ctx,
    size,
    dispose: () => {
      ro?.disconnect();
      if (mode === 'viewport') window.removeEventListener('resize', measure);
    },
  };
}

/**
 * Histórico de posições amostrado em intervalo fixo, para desenhar rastro como
 * geometria.
 *
 * A tentação é fazer rastro deixando o frame anterior e apagando um pouco dele
 * por frame (`destination-out`). Não faça: o canvas guarda a cor pré-multiplicada
 * em 8 bits e o arredondamento zera os canais de cor antes do alfa — sobra um
 * fantasma escuro justamente onde passou o que era mais brilhante.
 *
 * O intervalo fixo (em vez de um ponto por frame) mantém o comprimento do rastro
 * igual em 60Hz e em 144Hz.
 */
export class Trail {
  private pts: number[] = [];
  private acc = 0;

  constructor(private readonly maxPoints: number, private readonly interval = 0.022) {}

  push(x: number, y: number, dt: number) {
    this.acc += dt;
    if (this.pts.length > 0 && this.acc < this.interval) return;
    this.acc = 0;
    this.pts.push(x, y);
    if (this.pts.length > this.maxPoints * 2) this.pts.splice(0, 2);
  }

  /** Dois passes: um largo e difuso, outro fino e aceso. Desenhe com 'lighter'. */
  stroke(ctx: Ctx, color: string, width: number, alpha: number) {
    if (this.pts.length < 4 || alpha <= 0.01) return;
    ctx.beginPath();
    ctx.moveTo(this.pts[0], this.pts[1]);
    for (let i = 2; i < this.pts.length; i += 2) ctx.lineTo(this.pts[i], this.pts[i + 1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * 0.2;
    ctx.lineWidth = width * 2.8;
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.55;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── Escala ───────────────────────────────────────────────────────────────────

/**
 * Unidade de medida das luzes, em px lógicos.
 *
 * O piso é alto de propósito. A mesma cena roda no palco cheio e na simulação do
 * painel, que tem menos de 260px de altura; com escala puramente proporcional
 * todo feixe virava um fio de cabelo justamente na tela em que o usuário escolhe
 * o efeito. O teto evita que em 4K a luz vire um borrão sem forma.
 */
export function unit(w: number, h: number) {
  return Math.max(0.85, Math.min(2.2, Math.min(w, h) / 520));
}

/**
 * Escala das explosões: quanto de tela um estouro deve ocupar. Usa a altura,
 * mas limitada pela largura, senão numa faixa larga e baixa os fogos abrem para
 * fora do quadro.
 */
export function sceneScale(w: number, h: number) {
  return Math.min(h, w * 0.55);
}

// ── Zona do personagem ───────────────────────────────────────────────────────

/** Elipse onde o mascote fica; os efeitos são atenuados aqui para ele nunca sumir. */
export interface HeroZone {
  x: number; y: number;
  rx: number; ry: number;
  /** 0 = efeito intacto, 1 = efeito totalmente removido no centro da elipse. */
  strength: number;
}

export function heroZone(w: number, h: number, strength = 0.55): HeroZone {
  return {
    x: w / 2,
    y: h * 0.58,
    rx: Math.min(w * 0.2, 320),
    ry: Math.min(h * 0.46, 460),
    strength,
  };
}

/**
 * Abre um "buraco" suave na camada de efeito sobre o personagem. O efeito
 * continua ao redor dele, mas para de lavar o rosto/corpo.
 */
export function carveHero(ctx: Ctx, zone: HeroZone) {
  if (zone.strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.translate(zone.x, zone.y);
  ctx.scale(zone.rx, zone.ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(0,0,0,${zone.strength})`);
  g.addColorStop(0.5, `rgba(0,0,0,${zone.strength * 0.7})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/** Multiplicador de opacidade de uma partícula conforme entra na zona do herói. */
export function heroDim(x: number, y: number, zone: HeroZone) {
  const dx = (x - zone.x) / zone.rx;
  const dy = (y - zone.y) / zone.ry;
  const d = Math.hypot(dx, dy);
  if (d >= 1) return 1;
  const smooth = d * d * (3 - 2 * d);
  return 1 - zone.strength * (1 - smooth);
}

// ── Cor ──────────────────────────────────────────────────────────────────────

export type Rgb = [number, number, number];

export function toRgb(color: string): Rgb {
  const hex = color.trim().replace('#', '');
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (hex.length >= 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return [255, 255, 255];
}

export function rgba([r, g, b]: Rgb, a: number) {
  return `rgba(${r},${g},${b},${a})`;
}

/** Escurece/clareia mantendo a matiz — usado no verso do papel do confete. */
export function shade([r, g, b]: Rgb, factor: number): Rgb {
  if (factor <= 1) {
    return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
  }
  const t = factor - 1;
  return [
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t),
  ];
}

// ── Sprites ──────────────────────────────────────────────────────────────────
//
// Desenhar brilho com `shadowBlur` custa caro: o navegador refaz um blur gaussiano
// por partícula, por frame. Pré-renderizar o brilho uma vez e só posicionar a
// imagem deixa o efeito muito mais leve — e mais bonito, porque dá para montar
// um degradê com várias paradas em vez de uma sombra chapada.

const SPRITE_R = 64;
const glowCache = new Map<string, HTMLCanvasElement>();
const starCache = new Map<string, HTMLCanvasElement>();

function blankSprite() {
  const c = document.createElement('canvas');
  c.width = SPRITE_R * 2;
  c.height = SPRITE_R * 2;
  return c;
}

/** Bola de luz com núcleo quente branco e halo colorido. Desenhe com 'lighter'. */
export function glowSprite(color: string): HTMLCanvasElement {
  const cached = glowCache.get(color);
  if (cached) return cached;

  const c = blankSprite();
  const g = c.getContext('2d')!;
  const rgb = toRgb(color);
  const grad = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, rgba(shade(rgb, 1.6), 0.95));
  grad.addColorStop(0.3, rgba(rgb, 0.55));
  grad.addColorStop(0.6, rgba(rgb, 0.16));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_R * 2, SPRITE_R * 2);

  glowCache.set(color, c);
  return c;
}

/** Halo sem núcleo branco: mantém a cor do tema em vez de estourar para branco. */
export function haloSprite(color: string): HTMLCanvasElement {
  const key = `halo:${color}`;
  const cached = glowCache.get(key);
  if (cached) return cached;

  const c = blankSprite();
  const g = c.getContext('2d')!;
  const rgb = toRgb(color);
  const grad = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R);
  grad.addColorStop(0, rgba(shade(rgb, 1.2), 0.85));
  grad.addColorStop(0.25, rgba(rgb, 0.4));
  grad.addColorStop(0.6, rgba(rgb, 0.12));
  grad.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_R * 2, SPRITE_R * 2);

  glowCache.set(key, c);
  return c;
}

/** Estrela de 4 pontas com flares — o brilho "de lente" clássico. */
export function starSprite(color: string): HTMLCanvasElement {
  const cached = starCache.get(color);
  if (cached) return cached;

  const c = blankSprite();
  const g = c.getContext('2d')!;
  const rgb = toRgb(color);
  g.globalCompositeOperation = 'lighter';

  const flare = (angle: number, length: number, thickness: number, alpha: number) => {
    g.save();
    g.translate(SPRITE_R, SPRITE_R);
    g.rotate(angle);
    g.scale(length, thickness);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, rgba(shade(rgb, 1.25), alpha));
    grad.addColorStop(0.25, rgba(rgb, alpha * 0.6));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  };

  // par principal (horizontal + vertical) e par diagonal mais curto
  flare(0, SPRITE_R, SPRITE_R * 0.055, 0.95);
  flare(Math.PI / 2, SPRITE_R, SPRITE_R * 0.055, 0.95);
  flare(Math.PI / 4, SPRITE_R * 0.45, SPRITE_R * 0.03, 0.5);
  flare(-Math.PI / 4, SPRITE_R * 0.45, SPRITE_R * 0.03, 0.5);

  const core = g.createRadialGradient(SPRITE_R, SPRITE_R, 0, SPRITE_R, SPRITE_R, SPRITE_R * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.35, rgba(shade(rgb, 1.3), 0.6));
  core.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = core;
  g.fillRect(0, 0, SPRITE_R * 2, SPRITE_R * 2);

  starCache.set(color, c);
  return c;
}

/**
 * Risco horizontal de lente — o "flare anamórfico" que o cinema tem e o canvas
 * cru não tem. Colado num ponto de luz forte, é o que faz o ponto virar holofote.
 * O conteúdo é fino, mas o sprite é quadrado para caber no mesmo `drawSprite`.
 */
export function streakSprite(color: string): HTMLCanvasElement {
  const key = `streak:${color}`;
  const cached = glowCache.get(key);
  if (cached) return cached;

  const c = blankSprite();
  const g = c.getContext('2d')!;
  const rgb = toRgb(color);
  g.globalCompositeOperation = 'lighter';

  const bar = (thickness: number, alpha: number) => {
    g.save();
    g.translate(SPRITE_R, SPRITE_R);
    g.scale(SPRITE_R, SPRITE_R * thickness);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.18, rgba(shade(rgb, 1.4), alpha * 0.8));
    grad.addColorStop(0.55, rgba(rgb, alpha * 0.28));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  };

  bar(0.16, 0.35);
  bar(0.06, 0.6);
  bar(0.018, 0.95);

  glowCache.set(key, c);
  return c;
}

/**
 * Fumaça de pólvora: o que sobra no ar depois do estouro. Sem ela os fogos
 * acontecem no vácuo — é este resíduo que dá peso ao estouro.
 */
export function smokeSprite(): HTMLCanvasElement {
  const key = 'smoke';
  const cached = glowCache.get(key);
  if (cached) return cached;

  const c = blankSprite();
  const g = c.getContext('2d')!;
  g.globalCompositeOperation = 'lighter';

  // vários bolos sobrepostos: um degradê só sai redondo demais para ler como fumaça
  const puffs = [
    { x: 0.0, y: 0.0, r: 1.0, a: 0.16 },
    { x: -0.3, y: -0.18, r: 0.62, a: 0.13 },
    { x: 0.28, y: -0.12, r: 0.55, a: 0.12 },
    { x: 0.1, y: 0.3, r: 0.6, a: 0.1 },
    { x: -0.18, y: 0.26, r: 0.45, a: 0.09 },
  ];
  for (const p of puffs) {
    const cxp = SPRITE_R + p.x * SPRITE_R;
    const cyp = SPRITE_R + p.y * SPRITE_R;
    const r = p.r * SPRITE_R * 0.72;
    const grad = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, r);
    grad.addColorStop(0, `rgba(226,214,198,${p.a})`);
    grad.addColorStop(0.5, `rgba(190,178,166,${p.a * 0.45})`);
    grad.addColorStop(1, 'rgba(160,150,140,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE_R * 2, SPRITE_R * 2);
  }

  glowCache.set(key, c);
  return c;
}

/**
 * Posiciona um sprite pelo centro, com raio em px lógicos.
 *
 * Devolve `globalAlpha` a 1 no fim. Sem isso, o alfa do último sprite continua
 * valendo para o próximo `fill` da cena — era o que fazia a névoa e o feixe
 * seguinte herdarem a opacidade de uma partícula qualquer, com a cena inteira
 * piscando de brilho conforme a ordem do desenho.
 */
export function drawSprite(ctx: Ctx, sprite: HTMLCanvasElement, x: number, y: number, radius: number, alpha: number) {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/** Sprite achatado — pocinha de luz no chão, anel em perspectiva, faixa de scan. */
export function drawFlat(
  ctx: Ctx, sprite: HTMLCanvasElement,
  x: number, y: number, radius: number, squash: number, alpha: number,
) {
  if (alpha <= 0.004) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  drawSprite(ctx, sprite, 0, 0, radius, alpha);
  ctx.restore();
}

// ── Feixes volumétricos ──────────────────────────────────────────────────────

/**
 * Perfil de um cone de luz: várias passadas do largo/fraco ao fino/aceso.
 *
 * Duas ou três passadas deixam degrau visível na borda — o feixe fica com cara
 * de triângulo pintado. Sete passadas com alfa crescente é o que dá a queda
 * contínua de brilho do centro para a borda, que é como um feixe real se vê no
 * ar com fumaça.
 */
export const BEAM_PROFILE = [
  { half: 1.00, alpha: 0.028 },
  { half: 0.72, alpha: 0.040 },
  { half: 0.50, alpha: 0.055 },
  { half: 0.33, alpha: 0.080 },
  { half: 0.20, alpha: 0.125 },
  { half: 0.105, alpha: 0.215 },
  { half: 0.042, alpha: 0.40 },
] as const;

/**
 * Um cone de luz saindo de (ox, oy) na direção `angle` (0 = para baixo).
 * `endHalf` é a meia-largura na ponta; a base sai estreita, como a lente.
 */
export function volumeBeam(
  ctx: Ctx, ox: number, oy: number, angle: number, len: number,
  endHalf: number, color: string, intensity: number, reach = 1,
) {
  if (intensity <= 0.004) return;
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  const ex = ox + dx * len;
  const ey = oy + dy * len;
  const px = dy;
  const py = -dx;
  const rgb = toRgb(color);
  const hot = shade(rgb, 1.5);

  for (const pass of BEAM_PROFILE) {
    const end = endHalf * pass.half;
    const top = Math.max(1.2, end * 0.16);
    const grad = ctx.createLinearGradient(ox, oy, ex, ey);
    const a = pass.alpha * intensity;
    grad.addColorStop(0, rgba(hot, a));
    grad.addColorStop(0.12, rgba(rgb, a * 0.92));
    grad.addColorStop(0.45, rgba(rgb, a * 0.5));
    grad.addColorStop(Math.min(0.99, reach), rgba(rgb, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ox + px * top, oy + py * top);
    ctx.lineTo(ex + px * end, ey + py * end);
    ctx.lineTo(ex - px * end, ey - py * end);
    ctx.lineTo(ox - px * top, oy - py * top);
    ctx.closePath();
    ctx.fill();
  }
}

/** Anel aceso com halo: várias espessuras em vez de um traço de 1px. */
export function glowRing(
  ctx: Ctx, x: number, y: number, radius: number, squash: number,
  color: string, alpha: number, width: number,
) {
  if (alpha <= 0.004 || radius <= 0) return;
  const rgb = toRgb(color);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  for (const pass of [{ w: 6, a: 0.10 }, { w: 3, a: 0.2 }, { w: 1.6, a: 0.4 }, { w: 0.7, a: 0.95 }]) {
    ctx.strokeStyle = pass.w > 1 ? rgba(rgb, alpha * pass.a) : rgba(shade(rgb, 1.6), alpha * pass.a);
    ctx.lineWidth = width * pass.w;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Luz de recorte do mascote ────────────────────────────────────────────────

/**
 * A regra do palco: o mascote é o assunto, a luz é cenário. Aqui ele ganha luz
 * própria — contraluz atrás, cone de cima e poça no chão — para nunca ficar como
 * uma silhueta chapada no meio da festa.
 *
 * Desenhe dentro do bloco em 'lighter', antes do `carveHero`: o recorte come o
 * centro e o que sobra vira a borda acesa em volta do corpo.
 */
export function heroSpot(
  ctx: Ctx, w: number, h: number, hero: HeroZone,
  color: string, intensity: number,
) {
  if (intensity <= 0.01) return;
  const rgb = toRgb(color);
  const feet = Math.min(h - 1, hero.y + hero.ry * 0.82);
  const halfTop = hero.rx * 0.18;
  const halfBottom = hero.rx * 1.25;

  // cone descendo do teto até os pés
  const grad = ctx.createLinearGradient(hero.x, -h * 0.08, hero.x, feet);
  grad.addColorStop(0, rgba(shade(rgb, 1.5), 0.16 * intensity));
  grad.addColorStop(0.35, rgba(rgb, 0.10 * intensity));
  grad.addColorStop(1, rgba(rgb, 0.02 * intensity));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(hero.x - halfTop, -h * 0.08);
  ctx.lineTo(hero.x + halfTop, -h * 0.08);
  ctx.lineTo(hero.x + halfBottom, feet);
  ctx.lineTo(hero.x - halfBottom, feet);
  ctx.closePath();
  ctx.fill();

  // contraluz: fica atrás do corpo e vira o contorno depois do recorte
  drawSprite(ctx, haloSprite(color), hero.x, hero.y - hero.ry * 0.1, hero.rx * 1.9, 0.34 * intensity);
  // poça no chão
  drawFlat(ctx, glowSprite(color), hero.x, feet, hero.rx * 1.5, 0.2, 0.4 * intensity);
}

// ── Loop ─────────────────────────────────────────────────────────────────────

/**
 * requestAnimationFrame com dt limitado. O clamp evita que uma aba em segundo
 * plano volte e teleporte todas as partículas de uma vez.
 */
export function runLoop(step: (t: number, dt: number) => boolean) {
  let raf = 0;
  let startTs = 0;
  let prevTs = 0;

  const frame = (ts: number) => {
    if (!startTs) {
      startTs = ts;
      prevTs = ts;
    }
    const t = (ts - startTs) / 1000;
    const dt = Math.min((ts - prevTs) / 1000, 1 / 30);
    prevTs = ts;
    if (step(t, dt)) raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Curva de easing usada nos fades de entrada/saída dos efeitos. */
export function easeOut(x: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
}
