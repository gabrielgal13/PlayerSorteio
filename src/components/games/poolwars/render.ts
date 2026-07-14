/* ============================================================================
 * POOL WARS — canvas renderer (top-down)
 * Animated water + a glossy floating platform that shrinks, little fighters
 * with team-coloured rings, shadows that sell the hop height, shark fin,
 * banana traps, splashes and floating combat text. Camera frames the arena.
 * ========================================================================== */
import type { World, Fighter } from './engine';
import { TEAM_COLOR } from './engine';
import { getTintedSprite, type ProcessedSprite } from '../chatwars/spriteProcessor';

export interface Camera { x: number; y: number; zoom: number; shake: number; }

export function createCamera(w: World): Camera {
  return { x: w.width / 2, y: w.height / 2, zoom: 0.6, shake: 0 };
}

export function updateCamera(cam: Camera, w: World, viewW: number, viewH: number, dt: number) {
  const pad = 140;
  const span = (w.platform.r + pad) * 2;
  const tzoom = Math.max(0.32, Math.min(1.4, Math.min(viewW / span, viewH / span)));
  cam.x += (w.platform.cx - cam.x) * Math.min(2 * dt, 1);
  cam.y += (w.platform.cy - cam.y) * Math.min(2 * dt, 1);
  cam.zoom += (tzoom - cam.zoom) * Math.min(2 * dt, 1);
  if (w.moment && w.moment.shake > cam.shake) cam.shake = w.moment.shake;
  if (w.time < w.events.quake) cam.shake = Math.max(cam.shake, 0.8);
  cam.shake = Math.max(0, cam.shake - dt * 1.6);
}

export function render(ctx: CanvasRenderingContext2D, w: World, cam: Camera, viewW: number, viewH: number, sprite: ProcessedSprite | null = null) {
  ctx.save();
  drawWater(ctx, w, viewW, viewH);

  const shakeX = (Math.random() - 0.5) * 20 * cam.shake;
  const shakeY = (Math.random() - 0.5) * 20 * cam.shake;
  ctx.translate(viewW / 2 + shakeX, viewH / 2 + shakeY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawPlatform(ctx, w);

  // bananas (on the deck)
  for (const b of w.bananas) drawBanana(ctx, b.x, b.y, w.time);

  // particles behind fighters
  for (const p of w.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // shadows first, so nobody's shadow lands on a body
  for (const f of w.fighters.values()) if (f.alive) drawShadow(ctx, f);

  // fighters back-to-front by y, hopping ones drawn last
  const fighters = [...w.fighters.values()].sort((a, b) => (a.y - a.z) - (b.y - b.z));
  for (const f of fighters) drawFighter(ctx, w, f, sprite);

  if (w.shark) drawShark(ctx, w.shark, w.time);

  // floating texts
  ctx.textAlign = 'center';
  for (const fl of w.floats) {
    const a = Math.max(0, fl.life / fl.maxLife);
    ctx.globalAlpha = a;
    ctx.font = `800 ${fl.size}px Rajdhani, sans-serif`;
    ctx.fillStyle = fl.color; ctx.shadowColor = fl.color; ctx.shadowBlur = 8;
    ctx.fillText(fl.text, fl.x, fl.y); ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ── Water ───────────────────────────────────────────────────────────────── */
function drawWater(ctx: CanvasRenderingContext2D, w: World, viewW: number, viewH: number) {
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#0a2a4a');
  g.addColorStop(0.5, '#0d3b66');
  g.addColorStop(1, '#06223f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
  // moving caustic streaks
  ctx.save();
  ctx.globalAlpha = 0.06; ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 2;
  const t = w.time / 1000;
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * viewH + Math.sin(t + i) * 10;
    ctx.beginPath();
    for (let x = 0; x <= viewW; x += 26) ctx.lineTo(x, y + Math.sin(t * 1.3 + x / 90 + i) * 8);
    ctx.stroke();
  }
  ctx.restore();
}

/* ── Platform ────────────────────────────────────────────────────────────── */
function drawPlatform(ctx: CanvasRenderingContext2D, w: World) {
  const { cx, cy, r } = w.platform;
  const now = w.time;
  // ripple ring around the deck
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 4;
  const rip = r + 12 + Math.sin(now / 300) * 6;
  ctx.beginPath(); ctx.arc(cx, cy, rip, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // deck body
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, '#3aa0d8');
  g.addColorStop(0.7, '#2b7fb8');
  g.addColorStop(1, '#1d5e8e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // soap/ice sheen overlay
  if (now < w.events.soap || now < w.events.ice) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = now < w.events.soap ? '#ffffff' : '#cdeaff';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // plank rings
  ctx.save();
  ctx.clip(new Path2D(`M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy}`));
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#0c3a5c'; ctx.lineWidth = 3;
  for (let rr = r; rr > 0; rr -= 34) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
  // centre line dividing the two team halves
  ctx.globalAlpha = 0.22; ctx.setLineDash([14, 12]); ctx.lineWidth = 4;
  ctx.strokeStyle = '#eaf6ff';
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // rim highlight
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(190,233,255,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, Math.PI * 2); ctx.stroke();
  // danger edge when shrinking
  if (now < w.events.shrink || w.platform.targetR < w.platform.baseR * 0.95) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,80,80,${0.4 + 0.3 * Math.sin(now / 160)})`;
    ctx.lineWidth = 6; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -now / 24;
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/* ── Fighters ────────────────────────────────────────────────────────────── */
function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
  const r = f.radius;
  ctx.save();
  ctx.globalAlpha = Math.max(0.12, 0.34 - f.z / 600);
  ctx.fillStyle = '#001020';
  const sr = r * (1 - Math.min(f.z / 400, 0.4));
  ctx.beginPath(); ctx.ellipse(f.x, f.y + r * 0.55, sr, sr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFighter(ctx: CanvasRenderingContext2D, w: World, f: Fighter, sprite: ProcessedSprite | null) {
  const r = f.radius;
  const teamCol = TEAM_COLOR[f.team];
  const now = w.time;
  const isKing = w.kingId === f.id;

  ctx.save();
  ctx.translate(f.x, f.y - f.z);   // hop raises the body, shadow stays put

  if (!f.alive) {
    // swimmer — faint, bobbing in the water
    const bob = Math.sin(f.wobble) * 4;
    ctx.globalAlpha = 0.55;
    ctx.translate(0, bob);
    drawBody(ctx, f, r * 0.9, teamCol, sprite, now, true);
    ctx.restore();
    return;
  }

  // wobble squash
  const wob = Math.sin(f.wobble) * Math.min(r * 0.06, 4);
  drawBody(ctx, f, r, teamCol, sprite, now, false, wob);

  // brace shield
  if (now < f.braceUntil) {
    ctx.strokeStyle = `rgba(150,210,255,${0.5 + 0.4 * Math.sin(now / 120)})`;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.stroke();
  }
  // frozen
  if (now < f.frozenUntil) {
    ctx.fillStyle = 'rgba(180,235,255,0.4)';
    ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${r}px serif`; ctx.textAlign = 'center'; ctx.fillText('🧊', 0, r * 0.35);
  }
  // streamer ring
  if (f.isStreamer) {
    ctx.strokeStyle = `rgba(0,229,255,${0.5 + 0.3 * Math.sin(now / 160)})`;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.stroke();
  }
  // king crown
  if (isKing) drawCrown(ctx, r, now);

  drawNameBar(ctx, f, r, teamCol);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, f: Fighter, r: number, teamCol: string, sprite: ProcessedSprite | null, now: number, faint: boolean, wob = 0) {
  // team glow
  ctx.shadowColor = teamCol; ctx.shadowBlur = faint ? 8 : 22;

  if (sprite) {
    const aspect = sprite.width / sprite.height;
    let sw = r * 2, sh = r * 2;
    if (aspect >= 1) sh = sw / aspect; else sw = sh * aspect;
    const tinted = getTintedSprite(sprite, f.hue);
    ctx.drawImage(tinted, -sw / 2, -sh / 2, sw, sh);
    ctx.shadowBlur = 0;
    if (f.hitFlash > 0) {
      ctx.save(); ctx.globalAlpha = f.hitFlash * 0.7; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(tinted, -sw / 2, -sh / 2, sw, sh); ctx.restore();
    }
  } else {
    const rx = r + wob, ry = r - wob;
    const g = ctx.createRadialGradient(-rx * 0.32, -ry * 0.36, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, `hsl(${f.hue},100%,80%)`);
    g.addColorStop(0.55, `hsl(${f.hue},85%,56%)`);
    g.addColorStop(1, `hsl(${f.hue},80%,34%)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (f.hitFlash > 0) {
      ctx.globalAlpha = f.hitFlash * 0.7; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  ctx.shadowBlur = 0;
  // team-colour ring marks the side
  ctx.strokeStyle = teamCol; ctx.lineWidth = Math.max(2.5, r * 0.1);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2); ctx.stroke();

  if (!faint) drawFace(ctx, f, r);
}

function drawFace(ctx: CanvasRenderingContext2D, f: Fighter, r: number) {
  if (r < 12) return;
  const dark = 'rgba(20,12,30,0.92)';
  const eyeY = r * 0.02, eyeDX = r * 0.26, eyeR = Math.max(2.5, r * 0.13);
  const sp = Math.hypot(f.vx, f.vy) || 1;
  const px = (f.vx / sp) * eyeR * 0.4, py = (f.vy / sp) * eyeR * 0.4;
  const angry = f.energy > 60;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (angry) ctx.ellipse(s * eyeDX, eyeY, eyeR, eyeR * 0.7, 0, 0, Math.PI * 2);
    else ctx.arc(s * eyeDX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(s * eyeDX + px, eyeY + py, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  if (angry) {
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-eyeDX - eyeR, eyeY - eyeR); ctx.lineTo(-eyeDX + eyeR * 0.7, eyeY - eyeR * 0.2);
    ctx.moveTo(eyeDX + eyeR, eyeY - eyeR); ctx.lineTo(eyeDX - eyeR * 0.7, eyeY - eyeR * 0.2);
    ctx.stroke();
  }
  // mouth
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath();
  const my = r * 0.38;
  if (angry) ctx.arc(0, my + r * 0.12, r * 0.18, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(0, my - r * 0.1, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawNameBar(ctx: CanvasRenderingContext2D, f: Fighter, r: number, teamCol: string) {
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  let fs = Math.max(11, Math.min(r * 0.4, 22));
  ctx.font = `800 ${fs}px Rajdhani, sans-serif`;
  const maxW = r * 2.6, wdt = ctx.measureText(f.name).width;
  if (wdt > maxW) { fs *= maxW / wdt; ctx.font = `800 ${fs}px Rajdhani, sans-serif`; }
  const nameY = r + fs * 0.9;
  ctx.lineWidth = Math.max(2.5, fs * 0.24); ctx.strokeStyle = 'rgba(0,8,18,0.85)';
  ctx.fillStyle = f.isStreamer ? '#9be9ff' : '#fff';
  ctx.strokeText(f.name, 0, nameY); ctx.fillText(f.name, 0, nameY);

  // energy bar under the name
  const bw = r * 1.7, bh = Math.max(4, r * 0.13), by = nameY + fs * 0.35;
  ctx.fillStyle = 'rgba(0,10,20,0.6)';
  ctx.fillRect(-bw / 2, by, bw, bh);
  const e = Math.max(0, Math.min(1, f.energy / 100));
  ctx.fillStyle = e > 0.6 ? '#7CFFB2' : e > 0.3 ? '#FFD24A' : '#FF7A7A';
  ctx.fillRect(-bw / 2, by, bw * e, bh);
  ctx.strokeStyle = teamCol; ctx.lineWidth = 1.5; ctx.strokeRect(-bw / 2, by, bw, bh);
}

function drawCrown(ctx: CanvasRenderingContext2D, r: number, time: number) {
  const blink = 0.5 + 0.5 * Math.sin(time / 120);
  const cw = Math.max(22, r * 0.8), ch = cw * 0.7, y = -r - ch * 0.6;
  ctx.save(); ctx.translate(0, y);
  const g = ctx.createLinearGradient(0, -ch, 0, ch);
  g.addColorStop(0, '#FFF1A6'); g.addColorStop(0.5, '#FFD24A'); g.addColorStop(1, '#E0A11E');
  ctx.fillStyle = g; ctx.strokeStyle = '#7a5410'; ctx.lineWidth = Math.max(1.5, cw * 0.05);
  ctx.shadowColor = '#FFD24A'; ctx.shadowBlur = 10 * blink + 6;
  ctx.beginPath();
  ctx.moveTo(-cw / 2, ch); ctx.lineTo(-cw / 2, 0); ctx.lineTo(-cw / 4, ch * 0.5);
  ctx.lineTo(0, -ch * 0.15); ctx.lineTo(cw / 4, ch * 0.5); ctx.lineTo(cw / 2, 0); ctx.lineTo(cw / 2, ch);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* ── Props ───────────────────────────────────────────────────────────────── */
function drawBanana(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time / 500 + x) * 0.3);
  ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.fillText('🍌', 0, 10);
  ctx.restore();
}

function drawShark(ctx: CanvasRenderingContext2D, s: { x: number; y: number; angle: number }, time: number) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle + Math.PI / 2);
  // wake
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#bfe9ff';
  ctx.beginPath(); ctx.ellipse(0, 26, 16 + Math.sin(time / 100) * 3, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // fin
  ctx.fillStyle = '#2b3a4a'; ctx.strokeStyle = '#16222e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(16, 18, 0, 14); ctx.quadraticCurveTo(-16, 18, 0, -26);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
