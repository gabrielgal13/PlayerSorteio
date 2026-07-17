/* ============================================================================
 * CHAT WARS — simulation engine (framework-agnostic)
 * ----------------------------------------------------------------------------
 * Pure-ish data + step functions operating on a mutable `World`. No React, no
 * canvas. The component owns the World, feeds chat into it, ticks `stepWorld`
 * each frame and hands the World to the renderer.
 * ========================================================================== */

export type ChatSource = 'twitch' | 'kick' | 'youtube';

export interface Ball {
  id: string;            // lowercased username — stable key
  name: string;          // display name
  source: ChatSource;
  color: string;         // base colour (chat colour or hashed)
  hue: number;           // 0-360, used for gradients/glow
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;          // gameplay mass (points)
  radius: number;        // eased visual radius derived from mass
  streak: number;        // consecutive-message combo counter
  lastMsgAt: number;     // ms (world time) of last counted message
  lastText: string;      // last message text (repeat detection)
  spawnAt: number;       // world time when first joined (for happy-hour bonus)
  hitFlash: number;      // 0-1, decays — white collision flash
  wobble: number;        // accumulator for gelatin wobble
  wanderAngle: number;   // current wander heading
  ghost: boolean;        // eliminated — drifts as faint ghost until they chat
  isStreamer: boolean;
  isBoss: boolean;       // the LIVE BOSS — chat must defeat it together
  threatId: string | null; // id of the bigger ball this one is currently fleeing (for arrows)
}

export type ParticleKind = 'pop' | 'steal' | 'xp' | 'meteor' | 'spawn';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
}

export interface FloatText {
  x: number; y: number; vy: number;
  life: number; maxLife: number;
  text: string;
  color: string;
  size: number;
}

export interface Meteor {
  x: number; y: number;
  vx: number; vy: number;
  groundY: number;       // y at which it detonates
  r: number;
  done: boolean;
}

export interface GoldenZone { x: number; y: number; r: number; until: number }

export interface LiveMoment {
  title: string;
  sub: string;
  until: number;
  focusId: string | null;
  shake: number;
}

export interface ActiveEvents {
  xpRain: number;       // world-time until which active (0 = off)
  smallRevolt: number;
  giantHunt: number;
  happyHour: number;
}

export interface World {
  width: number;
  height: number;
  time: number;                       // accumulated ms
  balls: Map<string, Ball>;
  particles: Particle[];
  floats: FloatText[];
  meteors: Meteor[];
  events: ActiveEvents;
  golden: GoldenZone | null;
  huntedId: string | null;            // crowned target (Caça ao Gigante)
  huntedStartMass: number | null;     // massa do alvo no instante em que foi marcado (cap de dreno)
  streamerId: string | null;
  bossId: string | null;              // active LIVE BOSS
  moment: LiveMoment | null;
  xpRainSpawnAcc: number;             // particle spawn accumulator for XP rain
  stats: MatchStats;
}

export interface MatchStats {
  messages: number;   // chat messages from players
  eaten: number;      // balls eliminated (drained to 0)
  maxMass: number;    // biggest size any player reached
  events: number;     // streamer powers triggered
}

/* ── Tuning ──────────────────────────────────────────────────────────────── */
export const TUNING = {
  startMass: 12,
  minMass: 6,                 // below this → eliminated
  radiusK: 4.2,               // radius = sqrt(mass) * k
  radiusEase: 8,              // per-second easing toward target radius
  friction: 2.2,             // velocity damping per second
  wanderAccel: 70,
  baseSpeed: 220,             // small-ball top speed; scaled down by radius
  speedSizePenalty: 0.014,    // bigger = slower
  cooldownMs: 2500,           // anti-spam: messages within this window ≈ 0 pts
  streakWindowMs: 12000,      // gap under which streak continues
  spawnGain: 5,               // first message after offline
  shortMsgLen: 3,             // "k", "ok", "aaa" → reduced
  dominationAdvantage: 1.18,  // size ratio needed to drain
  drainPerSec: 9,             // mass/sec drained on sustained contact
  goldenGainPerSec: 14,
  feedWords: ['<3', 'gg', 'amo', 'top', 'cresce', 'lindo', 'goat', 'pog'],
  trollWords: ['lixo', 'troll', 'cai', 'morre', 'noob', 'bot', 'feio'],
  streamerFeed: 6,
  streamerTroll: 5,
  xpMultiplier: 2,            // global multiplier applied to all points earned from chat
  bossMassPerPlayer: 2,       // LIVE BOSS HP = playerCount * this (ex: 10 jogadores → 20 de vida)
  bossMassFloor: 20,          // piso de vida do boss quando tem poucos jogadores no chat
  bossDamageBySec: 80,        // how fast a player chips the boss on contact
  bossHitPerSec: 16,          // damage the boss deals back to a touching player
  bossPlayerGrowthPerDamage: 0.8, // fração do dano no boss que vira massa pro jogador que bateu (2x o ganho normal de dreno)
  giantHuntMaxDrainFraction: 1 / 3, // Caça ao Gigante: o chat pode tirar no máximo 1/3 da vida do alvo
  bossRadiusScale: 3,         // boss aparece bem maior que uma bola comum da mesma massa/vida
  bossRadiusFloor: 50,        // tamanho mínimo do boss em px, mesmo com pouca vida (lobby pequeno)
} as const;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
export function radiusForMass(mass: number): number {
  return Math.sqrt(Math.max(mass, 1)) * TUNING.radiusK;
}

/** O boss usa a mesma "vida = massa" pro dano, mas aparece bem maior na tela —
 * o tamanho dele acompanha a vida (encolhe conforme apanha), só que numa
 * escala bem mais generosa que uma bola comum, com um piso pra nunca sumir. */
export function radiusForBoss(mass: number): number {
  return Math.max(TUNING.bossRadiusFloor, radiusForMass(mass) * TUNING.bossRadiusScale);
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
}

export function createWorld(width: number, height: number): World {
  return {
    width,
    height,
    time: 0,
    balls: new Map(),
    particles: [],
    floats: [],
    meteors: [],
    events: { xpRain: 0, smallRevolt: 0, giantHunt: 0, happyHour: 0 },
    golden: null,
    huntedId: null,
    huntedStartMass: null,
    streamerId: null,
    bossId: null,
    moment: null,
    xpRainSpawnAcc: 0,
    stats: { messages: 0, eaten: 0, maxMass: 0, events: 0 },
  };
}

/** Chat bots (NightBOT, PlayerSkinsBOT, ...) never become players. */
export function isBotName(id: string): boolean {
  return id.trim().toLowerCase().endsWith('bot');
}

function randPos(w: World): { x: number; y: number } {
  return { x: 80 + Math.random() * (w.width - 160), y: 80 + Math.random() * (w.height - 160) };
}

function spawnBurst(w: World, x: number, y: number, color: string, n: number, kind: ParticleKind, speed = 180) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    w.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5, maxLife: 1,
      size: 2 + Math.random() * 3,
      color, kind,
    });
  }
}

function addFloat(w: World, x: number, y: number, text: string, color: string, size = 16) {
  w.floats.push({ x, y, vy: -42, life: 1.1, maxLife: 1.1, text, color, size });
}

/* ── Chat ingestion ──────────────────────────────────────────────────────── */
export interface IncomingMessage {
  username: string;
  text: string;
  color: string;
  source: ChatSource;
}

/** Apply a single chat message: spawn/revive/grow a ball and award points. */
export function applyMessage(w: World, msg: IncomingMessage): void {
  const id = msg.username.trim().toLowerCase();
  if (!id) return;
  if (isBotName(id)) return; // ignore chat bots (NightBOT, PlayerSkinsBOT, ...)
  w.stats.messages++;
  const now = w.time;
  const text = msg.text.trim();
  const lower = text.toLowerCase();

  // Streamer-ball feed/troll reacts to *anyone's* message keywords.
  if (w.streamerId) {
    const sb = w.balls.get(w.streamerId);
    if (sb && sb.id !== id) {
      if (TUNING.feedWords.some(k => lower.includes(k))) {
        sb.mass += TUNING.streamerFeed;
        addFloat(w, sb.x, sb.y - sb.radius - 6, `+${TUNING.streamerFeed}`, '#7CFFB2');
      } else if (TUNING.trollWords.some(k => lower.includes(k))) {
        sb.mass = Math.max(TUNING.minMass, sb.mass - TUNING.streamerTroll);
        addFloat(w, sb.x, sb.y - sb.radius - 6, `-${TUNING.streamerTroll}`, '#FF6B6B');
      }
    }
  }

  let ball = w.balls.get(id);
  const hue = hexToHue(msg.color) ?? hashHue(id);

  // anti-spam multiplier
  let mult = 1;
  const isReturning = !ball || ball.ghost;
  if (ball && !ball.ghost) {
    if (now - ball.lastMsgAt < TUNING.cooldownMs) mult *= 0.08;       // flood
    if (lower === ball.lastText && lower.length > 0) mult *= 0.1;     // repeat
  }
  if (text.length < TUNING.shortMsgLen) mult *= 0.3;                  // "k", "ok"

  // streak / combo
  let streak = 1;
  if (ball && now - ball.lastMsgAt < TUNING.streakWindowMs) streak = ball.streak + 1;

  // base gain
  let gain = isReturning ? TUNING.spawnGain : 1;
  gain *= mult;
  if (streak === 5) gain += 10;
  else if (streak === 20) gain += 50;

  // global multipliers
  if (now < w.events.xpRain) gain *= 5;
  if (now < w.events.happyHour && ball && now - ball.spawnAt < 5 * 60_000) gain *= 4;
  gain *= TUNING.xpMultiplier;

  if (!ball) {
    const p = randPos(w);
    ball = {
      id, name: msg.username, source: msg.source, color: msg.color || '#9147FF', hue,
      x: p.x, y: p.y, vx: 0, vy: 0,
      mass: Math.max(TUNING.startMass, TUNING.startMass + gain - 1),
      radius: radiusForMass(TUNING.startMass),
      streak, lastMsgAt: now, lastText: lower, spawnAt: now,
      hitFlash: 0, wobble: Math.random() * 10, wanderAngle: Math.random() * Math.PI * 2,
      ghost: false, isStreamer: false, isBoss: false, threatId: null,
    };
    w.balls.set(id, ball);
    spawnBurst(w, ball.x, ball.y, `hsl(${hue},90%,60%)`, 16, 'spawn');
  } else {
    if (ball.ghost) {
      // revive from ghost
      ball.ghost = false;
      ball.mass = TUNING.startMass;
      const p = randPos(w);
      ball.x = p.x; ball.y = p.y; ball.vx = 0; ball.vy = 0;
      spawnBurst(w, ball.x, ball.y, `hsl(${hue},90%,60%)`, 14, 'spawn');
    }
    ball.mass += gain;
    ball.name = msg.username;
    ball.streak = streak;
    ball.lastMsgAt = now;
    ball.lastText = lower;
    ball.hue = hue;
  }

  if (gain >= 1) {
    const label = streak === 5 ? '+10 COMBO' : streak === 20 ? '+50 COMBO!' : `+${Math.round(gain)}`;
    addFloat(w, ball.x, ball.y - ball.radius - 8, label,
      streak >= 5 ? '#FFD24A' : '#FFFFFF', streak >= 20 ? 22 : 15);
  }
}

/* ── Streamer ball ───────────────────────────────────────────────────────── */
export function toggleStreamerBall(w: World, name: string): void {
  if (w.streamerId) {
    const sb = w.balls.get(w.streamerId);
    if (sb) spawnBurst(w, sb.x, sb.y, '#00E5FF', 22, 'pop');
    w.balls.delete(w.streamerId);
    w.streamerId = null;
    return;
  }
  const id = `__streamer__:${name.trim().toLowerCase() || 'streamer'}`;
  const p = { x: w.width / 2, y: w.height / 2 };
  const ball: Ball = {
    id, name: name.trim() || 'STREAMER', source: 'twitch', color: '#00E5FF', hue: 187,
    x: p.x, y: p.y, vx: 0, vy: 0,
    mass: TUNING.startMass * 4, radius: radiusForMass(TUNING.startMass * 4),
    streak: 0, lastMsgAt: w.time, lastText: '', spawnAt: w.time,
    hitFlash: 0, wobble: 0, wanderAngle: 0, ghost: false, isStreamer: true, isBoss: false, threatId: null,
  };
  w.balls.set(id, ball);
  w.streamerId = id;
  spawnBurst(w, ball.x, ball.y, '#00E5FF', 26, 'spawn');
}

/* ── Streamer events ─────────────────────────────────────────────────────── */
export function triggerXpRain(w: World) {
  w.events.xpRain = w.time + 30_000;
  w.stats.events++;
  setMoment(w, 'CHUVA DE XP', 'todos ganham 5x pontos por 30s', 6, null);
}
export function triggerHappyHour(w: World) {
  w.events.happyHour = w.time + 5 * 60_000;
  w.stats.events++;
  setMoment(w, 'HAPPY HOUR', 'novos viewers +300% XP por 5min', 6, null);
}
export function triggerSmallRevolt(w: World) {
  w.events.smallRevolt = w.time + 25_000;
  w.stats.events++;
  setMoment(w, 'REVOLTA DOS PEQUENOS', 'os pequenos ficam rápidos e mortais!', 8, null);
}
export function triggerGiantHunt(w: World) {
  const big = biggestBall(w);
  if (!big) return;
  w.huntedId = big.id;
  w.huntedStartMass = big.mass;
  w.events.giantHunt = w.time + 30_000;
  w.stats.events++;
  setMoment(w, 'CAÇA AO GIGANTE', `${big.name} está marcado! encostem nele!`, 8, big.id);
}
export function triggerGoldenZone(w: World) {
  const p = {
    x: w.width * (0.3 + Math.random() * 0.4),
    y: w.height * (0.3 + Math.random() * 0.4),
  };
  w.golden = { x: p.x, y: p.y, r: Math.min(w.width, w.height) * 0.16, until: w.time + 35_000 };
  w.stats.events++;
  setMoment(w, 'ZONA DOURADA', 'fiquem nela pra dobrar pontos!', 6, null);
}
export function triggerMeteor(w: World) {
  const big = biggestBall(w);
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    // bias one meteor toward the biggest ball
    const targetX = i === 0 && big ? big.x : 80 + Math.random() * (w.width - 160);
    const groundY = i === 0 && big ? big.y : 120 + Math.random() * (w.height - 240);
    w.meteors.push({
      x: targetX - 120 - Math.random() * 80,
      y: -80 - Math.random() * 200,
      vx: 220 + Math.random() * 120,
      vy: 520 + Math.random() * 160,
      groundY,
      r: 22 + Math.random() * 16,
      done: false,
    });
  }
  w.stats.events++;
  setMoment(w, 'METEORO!', 'corram dos meteoros 🌠', 6, big?.id ?? null);
}

export function triggerBoss(w: World) {
  if (w.bossId) return;
  const id = '__boss__';
  // Vida do boss escala com o tamanho do chat: 2x o nº de jogadores ativos
  // (ex: 10 bolas no jogo → 20 de vida, ou seja, 20 "porradas" pra matar).
  const hp = Math.max(TUNING.bossMassFloor, playerCount(w) * TUNING.bossMassPerPlayer);
  const ball: Ball = {
    id, name: 'CHEFE DO CHAT', source: 'twitch', color: '#ff2d2d', hue: 0,
    x: w.width / 2, y: w.height / 2, vx: 0, vy: 0,
    mass: hp, radius: radiusForBoss(hp),
    streak: 0, lastMsgAt: w.time, lastText: '', spawnAt: w.time,
    hitFlash: 0, wobble: 0, wanderAngle: 0,
    ghost: false, isStreamer: false, isBoss: true, threatId: null,
  };
  w.balls.set(id, ball);
  w.bossId = id;
  w.stats.events++;
  spawnBurst(w, ball.x, ball.y, '#ff3030', 40, 'pop', 320);
  setMoment(w, 'LIVE BOSS', 'derrotem o chefe do chat juntos! 💀', 8, id);
}

function defeatBoss(w: World, boss: Ball) {
  spawnBurst(w, boss.x, boss.y, '#ffae3c', 60, 'meteor', 420);
  spawnBurst(w, boss.x, boss.y, '#ff3030', 40, 'pop', 360);
  // scatter loot to nearby players
  for (const b of w.balls.values()) {
    if (b.ghost || b.isBoss) continue;
    const d = Math.hypot(b.x - boss.x, b.y - boss.y);
    if (d < boss.radius * 4) b.mass += 40 * (1 - d / (boss.radius * 4));
  }
  w.balls.delete(boss.id);
  w.bossId = null;
  setMoment(w, 'CHEFE DERROTADO!', 'o chat venceu o boss juntos 🎉', 7, null);
}

function setMoment(w: World, title: string, sub: string, seconds: number, focusId: string | null) {
  w.moment = { title, sub, until: w.time + seconds * 1000, focusId, shake: 0.9 };
}

export function biggestBall(w: World): Ball | null {
  let best: Ball | null = null;
  for (const b of w.balls.values()) {
    if (b.ghost || b.isBoss) continue;
    if (!best || b.mass > best.mass) best = b;
  }
  return best;
}

/* ── Simulation step ─────────────────────────────────────────────────────── */
export function stepWorld(w: World, dtMs: number): void {
  const dt = Math.min(dtMs, 50) / 1000; // clamp to avoid huge steps after tab blur
  w.time += dtMs;

  const smallRevolt = w.time < w.events.smallRevolt;
  const giantHunt = w.time < w.events.giantHunt && w.huntedId !== null;
  const hunted = giantHunt ? w.balls.get(w.huntedId!) ?? null : null;
  if (hunted && hunted.ghost) { w.huntedId = null; w.huntedStartMass = null; }

  // expire golden zone
  if (w.golden && w.time > w.golden.until) w.golden = null;
  if (w.moment && w.time > w.moment.until) w.moment = null;

  // average mass for "small" classification
  let total = 0, n = 0;
  for (const b of w.balls.values()) {
    if (!b.ghost) {
      total += b.mass; n++;
      if (!b.isBoss && b.mass > w.stats.maxMass) w.stats.maxMass = b.mass;
    }
  }
  const avgMass = n > 0 ? total / n : TUNING.startMass;

  // ── per-ball movement ──
  for (const b of w.balls.values()) {
    if (b.ghost) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= 0.96; b.vy *= 0.96;
      continue;
    }
    b.wobble += dt * (4 + 60 / Math.max(b.radius, 8));

    // wander heading drift
    b.wanderAngle += (Math.random() - 0.5) * 2.4 * dt * 4;
    let ax = Math.cos(b.wanderAngle) * TUNING.wanderAccel;
    let ay = Math.sin(b.wanderAngle) * TUNING.wanderAccel;

    const isSmall = b.mass < avgMass * 0.85;

    // golden zone attraction
    if (w.golden) {
      const dx = w.golden.x - b.x, dy = w.golden.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = 140;
      ax += (dx / d) * pull; ay += (dy / d) * pull;
    }

    // giant hunt: everyone (except target) chases hunted
    if (hunted && b.id !== hunted.id) {
      const dx = hunted.x - b.x, dy = hunted.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      ax += (dx / d) * 240; ay += (dy / d) * 240;
    } else if (hunted && b.id === hunted.id) {
      // the hunted flees the crowd centroid
      ax *= 1.6; ay *= 1.6;
    }

    // small revolt: small balls hunt big ones; otherwise small balls flee bigger
    let nearest: Ball | null = null, nearestD = Infinity;
    for (const o of w.balls.values()) {
      if (o === b || o.ghost) continue;
      const dx = o.x - b.x, dy = o.y - b.y;
      const d = dx * dx + dy * dy;
      if (d < nearestD) { nearestD = d; nearest = o; }
    }
    b.threatId = null;
    // movement reaction only during the "Revolta dos Pequenos" power — the
    // small balls hunt the big ones. No generic chasing/fleeing otherwise.
    if (nearest && smallRevolt && isSmall && nearest.mass > b.mass) {
      const dx = nearest.x - b.x, dy = nearest.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 360) { ax += (dx / d) * 200; ay += (dy / d) * 200; }
    }

    // integrate
    b.vx += ax * dt; b.vy += ay * dt;
    b.vx -= b.vx * Math.min(TUNING.friction * dt, 0.9);
    b.vy -= b.vy * Math.min(TUNING.friction * dt, 0.9);

    // speed cap by size; small-revolt small balls get a burst
    let maxSpeed = TUNING.baseSpeed / (1 + b.radius * TUNING.speedSizePenalty);
    if (smallRevolt && isSmall) maxSpeed *= 1.8;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > maxSpeed) { b.vx = (b.vx / sp) * maxSpeed; b.vy = (b.vy / sp) * maxSpeed; }

    b.x += b.vx * dt; b.y += b.vy * dt;

    // ease radius toward mass-derived target
    const target = b.isBoss ? radiusForBoss(b.mass) : radiusForMass(b.mass);
    b.radius += (target - b.radius) * Math.min(TUNING.radiusEase * dt, 1);

    // walls
    if (b.x < b.radius) { b.x = b.radius; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > w.width - b.radius) { b.x = w.width - b.radius; b.vx = -Math.abs(b.vx) * 0.6; }
    if (b.y < b.radius) { b.y = b.radius; b.vy = Math.abs(b.vy) * 0.6; }
    if (b.y > w.height - b.radius) { b.y = w.height - b.radius; b.vy = -Math.abs(b.vy) * 0.6; }

    // golden zone passive gain
    if (w.golden) {
      const d = Math.hypot(w.golden.x - b.x, w.golden.y - b.y);
      if (d < w.golden.r) b.mass += TUNING.goldenGainPerSec * dt;
    }

    if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt * 3);
  }

  // ── collisions + domination (spatial grid) ──
  resolveCollisions(w, dt, { smallRevolt, hunted });

  // ── eliminate starved balls ──
  for (const b of w.balls.values()) {
    if (!b.ghost && !b.isBoss && b.mass < TUNING.minMass) eliminate(w, b);
  }

  // ── boss defeat ──
  if (w.bossId) {
    const boss = w.balls.get(w.bossId);
    if (boss && boss.mass <= TUNING.minMass) defeatBoss(w, boss);
  }

  // ── meteors ──
  for (const m of w.meteors) {
    if (m.done) continue;
    m.x += m.vx * dt; m.y += m.vy * dt;
    // trail
    if (Math.random() < 0.6) w.particles.push({
      x: m.x, y: m.y, vx: -m.vx * 0.1, vy: -m.vy * 0.1,
      life: 0.4, maxLife: 0.4, size: m.r * 0.4, color: '#FF8A3C', kind: 'meteor',
    });
    if (m.y >= m.groundY) detonateMeteor(w, m);
  }
  w.meteors = w.meteors.filter(m => !m.done);

  // ── XP rain particles ──
  if (w.time < w.events.xpRain) {
    w.xpRainSpawnAcc += dtMs;
    while (w.xpRainSpawnAcc > 22) {
      w.xpRainSpawnAcc -= 22;
      w.particles.push({
        x: Math.random() * w.width, y: -10,
        vx: -10 + Math.random() * 20, vy: 260 + Math.random() * 120,
        life: 2.4, maxLife: 2.4, size: 3 + Math.random() * 3,
        color: '#FFD24A', kind: 'xp',
      });
    }
  }

  // ── particles / floats decay ──
  for (const p of w.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.97; p.vy *= 0.97;
    if (p.kind !== 'xp' && p.kind !== 'meteor') p.vy += 60 * dt; // slight gravity
    p.life -= dt;
  }
  w.particles = w.particles.length > 1200 ? w.particles.filter(p => p.life > 0).slice(-1200)
    : w.particles.filter(p => p.life > 0);

  for (const f of w.floats) { f.y += f.vy * dt; f.life -= dt; }
  w.floats = w.floats.filter(f => f.life > 0);
}

interface StepFlags { smallRevolt: boolean; hunted: Ball | null }

function resolveCollisions(w: World, dt: number, flags: StepFlags) {
  const balls = [...w.balls.values()].filter(b => !b.ghost);
  const cell = 120;
  const grid = new Map<string, Ball[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (const b of balls) {
    const cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell);
    const k = key(cx, cy);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(b);
  }
  const checked = new Set<string>();
  for (const a of balls) {
    const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = grid.get(key(gx, gy));
        if (!bucket) continue;
        for (const b of bucket) {
          if (a === b) continue;
          const pairKey = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);
          interact(w, a, b, dt, flags);
        }
      }
    }
  }
}

function interact(w: World, a: Ball, b: Ball, dt: number, flags: StepFlags) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return;

  const nx = dx / dist, ny = dy / dist;
  const overlap = minDist - dist;

  // push apart weighted by mass (heavier moves less)
  const ma = a.mass, mb = b.mass, sum = ma + mb;
  a.x -= nx * overlap * (mb / sum); a.y -= ny * overlap * (mb / sum);
  b.x += nx * overlap * (ma / sum); b.y += ny * overlap * (ma / sum);

  // small bounce impulse
  const push = 40 * Math.min(overlap / minDist, 1);
  a.vx -= nx * push * (mb / sum); a.vy -= ny * push * (mb / sum);
  b.vx += nx * push * (ma / sum); b.vy += ny * push * (ma / sum);

  // ── LIVE BOSS: the player always damages the boss; boss damages back ──
  if (a.isBoss || b.isBoss) {
    const boss = a.isBoss ? a : b;
    const pl = a.isBoss ? b : a;
    if (pl.isBoss) return; // safety
    const dmg = TUNING.bossDamageBySec * dt;
    boss.mass -= dmg;
    pl.mass += dmg * TUNING.bossPlayerGrowthPerDamage; // atacar o boss faz crescer 2x mais que o normal
    boss.hitFlash = 1;
    pl.mass = Math.max(TUNING.minMass, pl.mass - TUNING.bossHitPerSec * dt);
    // knock the player outward from the boss
    const dirx = (pl.x - boss.x) / dist, diry = (pl.y - boss.y) / dist;
    pl.vx += dirx * 90; pl.vy += diry * 90;
    if (Math.random() < 0.5) spawnBurst(w, pl.x, pl.y, '#ffae3c', 2, 'steal', 120);
    return;
  }

  // ── domination by proximity ──
  let predator: Ball | null = null, prey: Ball | null = null;
  const hunted = flags.hunted;

  // Stealing only happens through streamer powers — never in normal play.
  if (hunted && (a.id === hunted.id || b.id === hunted.id)) {
    // giant hunt: the OTHER ball drains the hunted, fast
    predator = a.id === hunted.id ? b : a;
    prey = hunted;
  } else if (flags.smallRevolt && Math.abs(a.mass - b.mass) > 1) {
    // revolt: smaller drains bigger
    predator = a.mass < b.mass ? a : b;
    prey = a.mass < b.mass ? b : a;
  }

  if (predator && prey) {
    let rate = TUNING.drainPerSec;
    if (hunted && prey.id === hunted.id) rate *= 2.4;
    if (flags.smallRevolt && predator.mass < prey.mass) rate *= 1.8;
    let amount = Math.min(rate * dt, prey.mass - 1);
    // Caça ao Gigante: por mais gente que cerque o alvo, o total dreanado no
    // evento não passa de 1/3 da vida que ele tinha quando foi marcado.
    if (hunted && prey.id === hunted.id && w.huntedStartMass !== null) {
      const floor = w.huntedStartMass * (1 - TUNING.giantHuntMaxDrainFraction);
      amount = Math.min(amount, Math.max(0, prey.mass - floor));
    }
    if (amount > 0) {
      prey.mass -= amount;
      predator.mass += amount;
      prey.hitFlash = 1;
      if (Math.random() < 0.4) {
        spawnBurst(w, prey.x, prey.y, `hsl(${prey.hue},90%,60%)`, 2, 'steal', 90);
      }
    }
  }
}

function eliminate(w: World, b: Ball) {
  if (!b.isStreamer) w.stats.eaten++;
  spawnBurst(w, b.x, b.y, `hsl(${b.hue},90%,62%)`, 26, 'pop', 240);
  const wasHunted = w.huntedId === b.id;
  const wasStreamer = b.isStreamer;
  if (b.isStreamer) {
    // streamer ball revives small instead of becoming a ghost
    b.mass = TUNING.startMass * 2;
    const p = randPos(w);
    b.x = p.x; b.y = p.y; b.vx = 0; b.vy = 0;
  } else {
    b.ghost = true;
    b.mass = TUNING.minMass;
    b.vx = (Math.random() - 0.5) * 60;
    b.vy = (Math.random() - 0.5) * 60;
  }
  if (wasHunted) {
    w.huntedId = null;
    w.huntedStartMass = null;
    w.events.giantHunt = 0;
    setMoment(w, `${b.name} FOI DESTRONADO!`, 'o gigante caiu 👑💥', 6, null);
  } else if (wasStreamer) {
    setMoment(w, `${b.name} EXPLODIU!`, 'o chat derrubou o streamer 😂', 5, null);
  }
}

function detonateMeteor(w: World, m: Meteor) {
  m.done = true;
  spawnBurst(w, m.x, m.groundY, '#FF8A3C', 30, 'meteor', 320);
  const blast = m.r * 5;
  for (const b of w.balls.values()) {
    if (b.ghost) continue;
    const d = Math.hypot(b.x - m.x, b.y - m.groundY);
    if (d < blast) {
      const frac = 1 - d / blast;
      const loss = b.mass * 0.35 * frac;     // big balls lose a chunk
      b.mass = Math.max(TUNING.minMass, b.mass - loss);
      b.hitFlash = 1;
      // knockback
      const nx = (b.x - m.x) / (d || 1), ny = (b.y - m.groundY) / (d || 1);
      b.vx += nx * 260 * frac; b.vy += ny * 260 * frac;
      // scatter food the small ones can eat (visual)
      spawnBurst(w, b.x, b.y, `hsl(${b.hue},90%,60%)`, Math.round(6 * frac), 'steal', 160);
    }
  }
}

/* ── Leaderboard snapshot for the UI ─────────────────────────────────────── */
export interface LeaderRow {
  id: string; name: string; mass: number; streak: number; hue: number;
  source: ChatSource; hunted: boolean; streamer: boolean; ghost: boolean;
}

export function leaderboard(w: World, top = 10): LeaderRow[] {
  return [...w.balls.values()]
    .filter(b => !b.ghost && !b.isBoss && !isBotName(b.id))
    .sort((a, b) => b.mass - a.mass)
    .slice(0, top)
    .map(b => ({
      id: b.id, name: b.name, mass: Math.round(b.mass), streak: b.streak, hue: b.hue,
      source: b.source, hunted: w.huntedId === b.id, streamer: b.isStreamer, ghost: false,
    }));
}

export function playerCount(w: World): number {
  let c = 0;
  for (const b of w.balls.values()) if (!b.ghost && !b.isBoss && !isBotName(b.id)) c++;
  return c;
}
