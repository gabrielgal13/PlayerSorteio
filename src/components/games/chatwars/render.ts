/* ============================================================================
 * CHAT WARS — canvas renderer
 * Galaxy background + glossy faced "blob" balls (agar.io meets emoji), crowned
 * + flaming leader, K-abbreviated mass, threat arrows. Dynamic easing camera
 * that frames the swarm and zooms into "live moments".
 * ========================================================================== */
import type { World, Ball } from './engine';

export interface Camera {
  x: number;        // world-space centre
  y: number;
  zoom: number;
  shake: number;    // decays each frame
}

export function createCamera(w: World): Camera {
  return { x: w.width / 2, y: w.height / 2, zoom: 0.5, shake: 0 };
}

/* ── Star field (cached per world size) ──────────────────────────────────── */
interface Star { x: number; y: number; r: number; tw: number; c: string }
let starCache: { key: string; stars: Star[] } | null = null;

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getStars(w: World): Star[] {
  const key = `${w.width}x${w.height}`;
  if (starCache && starCache.key === key) return starCache.stars;
  const rnd = mulberry32(1337);
  const margin = 400;
  const area = (w.width + margin * 2) * (w.height + margin * 2);
  const count = Math.min(900, Math.floor(area / 5200));
  const palette = ['#ffffff', '#cfe6ff', '#ffe6c0', '#e6c8ff', '#bfffe6'];
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: -margin + rnd() * (w.width + margin * 2),
      y: -margin + rnd() * (w.height + margin * 2),
      r: rnd() < 0.85 ? 0.6 + rnd() * 1.1 : 1.6 + rnd() * 1.8,
      tw: rnd() * Math.PI * 2,
      c: palette[Math.floor(rnd() * palette.length)],
    });
  }
  starCache = { key, stars };
  return stars;
}

/* ── Mass formatting ─────────────────────────────────────────────────────── */
function fmtMass(m: number): string {
  if (m >= 1_000_000) return (m / 1_000_000).toFixed(2) + 'M';
  if (m >= 10_000) return (m / 1000).toFixed(1) + 'K';
  if (m >= 1000) return (m / 1000).toFixed(2) + 'K';
  return String(Math.round(m));
}

/** Ease the camera toward a target framing the swarm (or a focus ball). */
export function updateCamera(cam: Camera, w: World, viewW: number, viewH: number, dt: number) {
  let tx = w.width / 2, ty = w.height / 2, tzoom = 0.5;

  const focus = w.moment?.focusId ? w.balls.get(w.moment.focusId) : null;
  if (focus && !focus.ghost) {
    tx = focus.x; ty = focus.y;
    tzoom = Math.min(viewW, viewH) / (focus.radius * 9 + 320);
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    for (const b of w.balls.values()) {
      if (b.ghost) continue;
      any = true;
      minX = Math.min(minX, b.x - b.radius); minY = Math.min(minY, b.y - b.radius);
      maxX = Math.max(maxX, b.x + b.radius); maxY = Math.max(maxY, b.y + b.radius);
    }
    if (any) {
      const pad = 160;
      const bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
      tx = (minX + maxX) / 2; ty = (minY + maxY) / 2;
      tzoom = Math.min(viewW / bw, viewH / bh);
    }
  }
  tzoom = Math.max(0.28, Math.min(1.4, tzoom));

  const ease = focus ? 4 : 1.8;
  const k = Math.min(ease * dt, 1);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.zoom += (tzoom - cam.zoom) * Math.min(2.2 * dt, 1);

  if (w.moment && w.moment.shake > cam.shake) cam.shake = w.moment.shake;
  cam.shake = Math.max(0, cam.shake - dt * 1.6);
}

export function render(ctx: CanvasRenderingContext2D, w: World, cam: Camera, viewW: number, viewH: number, sprite: HTMLImageElement | null = null) {
  ctx.save();

  drawSpaceBackdrop(ctx, viewW, viewH);

  // camera transform
  const shakeX = (Math.random() - 0.5) * 18 * cam.shake;
  const shakeY = (Math.random() - 0.5) * 18 * cam.shake;
  ctx.translate(viewW / 2 + shakeX, viewH / 2 + shakeY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawNebula(ctx, w);
  drawStars(ctx, w);

  // golden zone
  if (w.golden) {
    const pulse = 0.5 + 0.5 * Math.sin(w.time / 200);
    const g = ctx.createRadialGradient(w.golden.x, w.golden.y, 0, w.golden.x, w.golden.y, w.golden.r);
    g.addColorStop(0, `rgba(255,210,74,${0.28 + pulse * 0.12})`);
    g.addColorStop(0.7, 'rgba(255,180,40,0.10)');
    g.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w.golden.x, w.golden.y, w.golden.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,220,90,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -w.time / 30;
    ctx.beginPath(); ctx.arc(w.golden.x, w.golden.y, w.golden.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // particles (behind balls)
  for (const p of w.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // meteors
  for (const m of w.meteors) {
    if (m.done) continue;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 1.6);
    g.addColorStop(0, '#FFF1C4'); g.addColorStop(0.5, '#FF8A3C'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFE0A0';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // balls — small→large so big ones sit on top
  const spriteReady = !!sprite && sprite.complete && sprite.naturalWidth > 0;
  const balls = [...w.balls.values()].sort((a, b) => a.mass - b.mass);
  for (const b of balls) drawBall(ctx, w, b, spriteReady ? sprite : null);

  // floating texts
  ctx.textAlign = 'center';
  for (const f of w.floats) {
    const a = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = a;
    ctx.font = `700 ${f.size}px Rajdhani, sans-serif`;
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color; ctx.shadowBlur = 8;
    ctx.fillText(f.text, f.x, f.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

/* ── Background ──────────────────────────────────────────────────────────── */
function drawSpaceBackdrop(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
  const g = ctx.createRadialGradient(viewW / 2, viewH * 0.42, 0, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
  g.addColorStop(0, '#1a1140');
  g.addColorStop(0.45, '#0d0a26');
  g.addColorStop(1, '#04030f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawNebula(ctx: CanvasRenderingContext2D, w: World) {
  const blobs: [number, number, number, string][] = [
    [w.width * 0.22, w.height * 0.28, 0.42, '120,60,220'],
    [w.width * 0.78, w.height * 0.30, 0.36, '40,90,230'],
    [w.width * 0.30, w.height * 0.78, 0.40, '210,40,170'],
    [w.width * 0.72, w.height * 0.74, 0.34, '40,140,200'],
    [w.width * 0.52, w.height * 0.50, 0.50, '90,40,160'],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, sr, rgb] of blobs) {
    const r = Math.max(w.width, w.height) * sr;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},0.20)`);
    g.addColorStop(0.5, `rgba(${rgb},0.07)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, w: World) {
  const stars = getStars(w);
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(w.time / 600 + s.tw);
    ctx.globalAlpha = tw;
    ctx.fillStyle = s.c;
    if (s.r > 1.6) { ctx.shadowColor = s.c; ctx.shadowBlur = 6; }
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* ── Balls ───────────────────────────────────────────────────────────────── */
type Mood = 'angry' | 'happy' | 'smug' | 'surprised' | 'neutral';
const MOODS: Mood[] = ['happy', 'smug', 'surprised', 'neutral', 'angry'];

function moodFor(b: Ball, isLeader: boolean): Mood {
  if (isLeader || b.isStreamer || b.isBoss) return 'angry';
  let h = 0;
  for (let i = 0; i < b.id.length; i++) h = (h * 31 + b.id.charCodeAt(i)) | 0;
  return MOODS[Math.abs(h) % MOODS.length];
}

function drawBall(ctx: CanvasRenderingContext2D, w: World, b: Ball, sprite: HTMLImageElement | null) {
  const r = b.radius;
  const isLeader = w.huntedId === b.id;
  // gelatin wobble
  const wob = b.ghost ? 0 : Math.sin(b.wobble) * Math.min(r * 0.05, 4);
  const rx = r + wob, ry = r - wob;

  ctx.save();
  ctx.translate(b.x, b.y);

  if (b.ghost) {
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = `hsl(${b.hue},70%,70%)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    drawNameTag(ctx, b, r, true);
    ctx.restore();
    return;
  }

  // flame trail on the leader / boss (behind body)
  if (isLeader || b.isBoss) drawFlames(ctx, r, w.time, b.hue);
  // boss horns (behind body)
  if (b.isBoss) drawHorns(ctx, r);

  // outer glow
  ctx.shadowColor = b.isBoss ? '#ff2030' : b.isStreamer ? '#00E5FF' : `hsl(${b.hue},95%,55%)`;
  ctx.shadowBlur = b.isBoss ? 55 : b.isStreamer || isLeader ? 38 : 20;

  if (sprite) {
    // glow halo (filled hue ellipse under the sprite)
    ctx.fillStyle = `hsl(${b.hue},90%,52%)`;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // sprite base, clipped to the ball, tinted with the player colour
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(sprite, -rx, -ry, rx * 2, ry * 2);
    ctx.globalCompositeOperation = 'color';            // tint keeps the sprite's shading/texture
    ctx.fillStyle = `hsl(${b.hue},85%,52%)`;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  } else {
    // body gradient — glossy sphere
    const g = ctx.createRadialGradient(-rx * 0.32, -ry * 0.36, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, `hsl(${b.hue},100%,78%)`);
    g.addColorStop(0.55, `hsl(${b.hue},90%,55%)`);
    g.addColorStop(1, `hsl(${b.hue},85%,34%)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // inner rim shading
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = `hsla(${b.hue},90%,22%,0.55)`;
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.97, ry * 0.97, 0, 0, Math.PI * 2); ctx.stroke();
  // bright outline
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.strokeStyle = b.isStreamer ? '#9be9ff' : `hsl(${b.hue},100%,82%)`;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

  // glossy top highlight
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-rx * 0.3, -ry * 0.42, rx * 0.34, ry * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // face
  const showText = r > 26;
  drawFace(ctx, moodFor(b, isLeader), r, b, showText);

  // hit flash
  if (b.hitFlash > 0) {
    ctx.globalAlpha = b.hitFlash * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // crown for leader
  if (isLeader) drawCrown(ctx, r, w.time);
  // streamer star ring
  if (b.isStreamer) {
    ctx.strokeStyle = `rgba(0,229,255,${0.4 + 0.3 * Math.sin(w.time / 160)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke();
  }

  // name + mass
  if (showText) drawNameTag(ctx, b, r, false);   // inside the ball
  else drawNameAbove(ctx, b, r);                  // floating above small balls

  ctx.restore();
}

/* ── Cartoon face ────────────────────────────────────────────────────────── */
function drawFace(ctx: CanvasRenderingContext2D, mood: Mood, r: number, b: Ball, textBelow: boolean) {
  if (r < 9) return;
  const eyeY = textBelow ? -r * 0.34 : -r * 0.18;
  const eyeDX = r * 0.34;
  const eyeR = Math.max(2.4, r * 0.17);
  // pupils track velocity slightly
  const sp = Math.hypot(b.vx, b.vy) || 1;
  const px = (b.vx / sp) * eyeR * 0.45;
  const py = (b.vy / sp) * eyeR * 0.45;

  const white = '#ffffff';
  const dark = 'rgba(20,10,30,0.92)';

  const drawEye = (cx: number) => {
    ctx.fillStyle = white;
    if (mood === 'surprised') {
      ctx.beginPath(); ctx.arc(cx, eyeY, eyeR * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx + px, eyeY + py, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'smug' || mood === 'angry') {
      // half / narrowed eye
      ctx.beginPath(); ctx.ellipse(cx, eyeY, eyeR, eyeR * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx + px * 0.6, eyeY + Math.abs(py) * 0.3 + eyeR * 0.12, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(cx + px, eyeY + py, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  };
  drawEye(-eyeDX);
  drawEye(eyeDX);

  // eyebrows for angry
  if (mood === 'angry') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-eyeDX - eyeR, eyeY - eyeR * 1.2);
    ctx.lineTo(-eyeDX + eyeR * 0.7, eyeY - eyeR * 0.3);
    ctx.moveTo(eyeDX + eyeR, eyeY - eyeR * 1.2);
    ctx.lineTo(eyeDX - eyeR * 0.7, eyeY - eyeR * 0.3);
    ctx.stroke();
  }

  // mouth only when there's no name text taking the lower area
  if (!textBelow) {
    const my = r * 0.34;
    ctx.strokeStyle = dark;
    ctx.fillStyle = dark;
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(0, my * 0.5, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (mood === 'angry') {
      ctx.arc(0, my * 1.1, r * 0.3, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (mood === 'surprised') {
      ctx.arc(0, my * 0.6, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === 'smug') {
      ctx.moveTo(-r * 0.22, my * 0.5);
      ctx.quadraticCurveTo(0, my * 0.95, r * 0.26, my * 0.35);
      ctx.stroke();
    } else {
      ctx.moveTo(-r * 0.2, my * 0.6); ctx.lineTo(r * 0.2, my * 0.6);
      ctx.stroke();
    }
  }
}

function drawNameAbove(ctx: CanvasRenderingContext2D, b: Ball, r: number) {
  ctx.textAlign = 'center';
  const fs = Math.max(13, Math.min(r * 0.6, 22));
  ctx.font = `800 ${fs}px Rajdhani, sans-serif`;
  const y = -r - fs * 0.55;
  ctx.lineWidth = Math.max(2.5, fs * 0.22);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.fillStyle = b.isStreamer ? '#9be9ff' : '#ffffff';
  ctx.strokeText(b.name, 0, y);
  ctx.fillText(b.name, 0, y);
}

function drawNameTag(ctx: CanvasRenderingContext2D, b: Ball, r: number, ghost: boolean) {
  ctx.textAlign = 'center';
  let fs = Math.max(11, Math.min(r * 0.36, 30));
  ctx.font = `800 ${fs}px Rajdhani, sans-serif`;
  // shrink to fit width
  const wdt = ctx.measureText(b.name).width;
  const maxW = r * 1.7;
  if (wdt > maxW) { fs *= maxW / wdt; ctx.font = `800 ${fs}px Rajdhani, sans-serif`; }
  const nameY = ghost ? -2 : r * 0.14;

  ctx.lineWidth = Math.max(2, fs * 0.18);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.fillStyle = ghost ? 'rgba(255,255,255,0.5)' : '#ffffff';
  ctx.lineJoin = 'round';
  ctx.strokeText(b.name, 0, nameY);
  ctx.fillText(b.name, 0, nameY);

  if (!ghost) {
    const ms = fs * 1.15;
    ctx.font = `800 ${ms}px Orbitron, sans-serif`;
    ctx.lineWidth = Math.max(2, ms * 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.fillStyle = b.isStreamer ? '#9be9ff' : '#ffffff';
    const my = nameY + fs * 1.15;
    ctx.strokeText(fmtMass(b.mass), 0, my);
    ctx.fillText(fmtMass(b.mass), 0, my);
  }
}

function drawHorns(ctx: CanvasRenderingContext2D, r: number) {
  ctx.save();
  ctx.fillStyle = '#1a0608';
  ctx.strokeStyle = '#3a0a10';
  ctx.lineWidth = 2;
  const hw = r * 0.32, hh = r * 0.55, dx = r * 0.62;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * dx, -r * 0.7);
    ctx.quadraticCurveTo(s * (dx + hw), -r * 0.7 - hh, s * (dx + hw * 0.4), -r * 0.7 - hh * 1.3);
    ctx.quadraticCurveTo(s * (dx + hw * 1.3), -r * 0.7 - hh * 0.4, s * (dx + hw * 0.2), -r * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawFlames(ctx: CanvasRenderingContext2D, r: number, time: number, hue: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tongues = 7;
  for (let i = 0; i < tongues; i++) {
    const a = (-Math.PI / 2) + (i - tongues / 2) * 0.42;
    const flick = 0.7 + 0.3 * Math.sin(time / 90 + i * 1.7);
    const len = r * (0.7 + 0.5 * flick);
    const bx = Math.cos(a) * r * 0.9, by = Math.sin(a) * r * 0.9;
    const tx = Math.cos(a) * (r + len), ty = Math.sin(a) * (r + len);
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, 'rgba(255,220,120,0.9)');
    g.addColorStop(0.5, 'rgba(255,120,40,0.7)');
    g.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a + 1.57) * r * 0.22, by + Math.sin(a + 1.57) * r * 0.22);
    ctx.quadraticCurveTo(tx, ty, bx + Math.cos(a - 1.57) * r * 0.22, by + Math.sin(a - 1.57) * r * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  void hue;
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, r: number, time: number) {
  const blink = 0.5 + 0.5 * Math.sin(time / 120);
  const cw = Math.max(22, r * 0.8);
  const ch = cw * 0.7;
  const y = -r - ch * 0.5;
  ctx.save();
  ctx.translate(0, y);
  // gold gradient
  const g = ctx.createLinearGradient(0, -ch, 0, ch);
  g.addColorStop(0, '#FFF1A6'); g.addColorStop(0.5, '#FFD24A'); g.addColorStop(1, '#E0A11E');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#7a5410'; ctx.lineWidth = Math.max(1.5, cw * 0.05);
  ctx.shadowColor = '#FFD24A'; ctx.shadowBlur = 10 * blink + 6;
  ctx.beginPath();
  ctx.moveTo(-cw / 2, ch);
  ctx.lineTo(-cw / 2, 0);
  ctx.lineTo(-cw / 4, ch * 0.5);
  ctx.lineTo(0, -ch * 0.15);
  ctx.lineTo(cw / 4, ch * 0.5);
  ctx.lineTo(cw / 2, 0);
  ctx.lineTo(cw / 2, ch);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // jewels
  ctx.fillStyle = '#FF4d6d';
  ctx.beginPath(); ctx.arc(0, ch * 0.55, cw * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
