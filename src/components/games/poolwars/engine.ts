/* ============================================================================
 * POOL WARS — simulation engine (framework-agnostic)
 * ----------------------------------------------------------------------------
 * Top-down physics brawl on a shrinking floating platform over water.
 * Each viewer becomes a little fighter, auto-assigned to TEAM A or TEAM B.
 * Chatting fills the fighter's ENERGY; command words (!push / !jump / !dash /
 * !defend) spend energy to shove enemies off the platform. Knock everyone of
 * the other team into the water to win the round → "REI DA PISCINA".
 *
 * Pure-ish data + step functions over a mutable `World`. No React, no canvas.
 * ========================================================================== */

export type ChatSource = 'twitch' | 'kick' | 'youtube';
export type Team = 'A' | 'B';
export type ClassKind = 'tank' | 'fatso' | 'ninja' | 'monkey' | 'spring';
export type Action = 'push' | 'jump' | 'dash' | 'defend';

export interface ClassDef {
  key: ClassKind;
  label: string;
  emoji: string;
  weight: number;   // knockback resistance + pushing power
  radius: number;   // body size
  speed: number;    // top speed multiplier
  jump: number;     // hop height multiplier
  desc: string;
}

export const CLASSES: Record<ClassKind, ClassDef> = {
  tank:   { key: 'tank',   label: 'TANQUE', emoji: '🛡️', weight: 2.1, radius: 40, speed: 0.8,  jump: 0.8,  desc: 'Pesado e difícil de empurrar, mas lento.' },
  fatso:  { key: 'fatso',  label: 'GORDÃO', emoji: '🍔', weight: 2.7, radius: 46, speed: 0.65, jump: 0.6,  desc: 'O mais pesado de todos — quase impossível de derrubar.' },
  ninja:  { key: 'ninja',  label: 'NINJA',  emoji: '🥷', weight: 0.85, radius: 30, speed: 1.5,  jump: 1.1,  desc: 'Leve e rapidíssimo, com dash mortal.' },
  monkey: { key: 'monkey', label: 'MACACO', emoji: '🐒', weight: 1.0, radius: 32, speed: 1.2,  jump: 1.2,  desc: 'Agarra o inimigo e puxa junto pra fora.' },
  spring: { key: 'spring', label: 'MOLA',   emoji: '🟢', weight: 0.9, radius: 32, speed: 1.05, jump: 1.8,  desc: 'Pula altíssimo e cria uma onda de choque ao cair.' },
};

const CLASS_LIST = Object.keys(CLASSES) as ClassKind[];

export interface Fighter {
  id: string;            // lowercased username — stable key
  name: string;
  source: ChatSource;
  color: string;
  hue: number;
  team: Team;
  cls: ClassKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;             // hop height (fake 3D) — 0 = on platform
  vz: number;
  radius: number;        // eased visual radius
  energy: number;        // 0..ENERGY_MAX — filled by chatting
  facing: number;        // heading radians
  streak: number;
  lastMsgAt: number;
  lastText: string;
  spawnAt: number;
  outAt: number;         // world time the fighter fell in the water (0 = alive)
  alive: boolean;        // on the platform
  invinUntil: number;    // spawn protection (no falling)
  braceUntil: number;    // !defend — resists knockback
  frozenUntil: number;   // streamer freeze
  actionCdUntil: number; // per-fighter action throttle
  lastHitBy: string;     // id of last enemy that shoved it (kill credit)
  lastHitAt: number;
  knockouts: number;     // enemies it sent into the water
  hitFlash: number;
  wobble: number;
  wanderAngle: number;
  isStreamer: boolean;
}

export type ParticleKind = 'splash' | 'pop' | 'energy' | 'shock' | 'spawn' | 'star';
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; kind: ParticleKind;
}
export interface FloatText {
  x: number; y: number; vy: number; life: number; maxLife: number;
  text: string; color: string; size: number;
}
export interface Banana { x: number; y: number; }
export interface Shark { x: number; y: number; vx: number; vy: number; angle: number; until: number; }

export interface VoteState {
  until: number;
  options: { key: EventKey; label: string; emoji: string; votes: number }[];
  voters: Set<string>;
}

export interface LiveMoment { title: string; sub: string; until: number; shake: number; }

export type EventKey =
  | 'spin' | 'soap' | 'wave' | 'shrink' | 'sumo' | 'lowGrav' | 'ice' | 'quake';

export interface ActiveEvents {
  spin: number; soap: number; wave: number; shrink: number;
  sumo: number; lowGrav: number; ice: number; quake: number;
  invertGrav: number;      // streamer power
  superA: number; superB: number;
}

export interface Platform { cx: number; cy: number; r: number; targetR: number; baseR: number; }

export interface MatchStats {
  messages: number; knockouts: number; events: number;
  roundsA: number; roundsB: number;
}

export interface World {
  width: number; height: number;
  time: number;
  fighters: Map<string, Fighter>;
  particles: Particle[];
  floats: FloatText[];
  bananas: Banana[];
  shark: Shark | null;
  platform: Platform;
  events: ActiveEvents;
  waveDir: { x: number; y: number };
  vote: VoteState | null;
  nextVoteAt: number;
  moment: LiveMoment | null;
  round: number;
  kingId: string | null;
  intermissionUntil: number;   // between rounds
  scoreA: number;
  scoreB: number;
  stats: MatchStats;
}

/* ── Tuning ──────────────────────────────────────────────────────────────── */
export const TUNING = {
  energyMax: 100,
  energyPerMsg: 16,
  energyDecay: 3,            // /sec passive drain — keeps it "use it or lose it"
  spawnEnergy: 40,
  cooldownMs: 1800,         // anti-spam: rapid msgs give little energy
  streakWindowMs: 12000,
  shortMsgLen: 3,
  friction: 2.4,            // platform grip (lower = slippery)
  iceFriction: 0.7,
  soapFriction: 0.35,
  baseSpeed: 230,
  wanderAccel: 50,
  seekAccel: 120,           // auto-aggression toward nearest enemy
  // action costs
  costPush: 26, costJump: 18, costDash: 30, costDefend: 16,
  pushImpulse: 560,         // base shove strength
  dashImpulse: 480,
  jumpShock: 360,           // spring landing shockwave
  actionCdMs: 550,
  braceMs: 2600,
  invinMs: 1600,
  hopGravity: 1400,
  voteEveryMs: 32_000,
  voteDurMs: 14_000,
  roundShrinkRate: 4.2,     // px/sec the platform breathes inward over a round
  intermissionMs: 4500,
  feedWords: ['gg', 'vai', 'forca', 'força', 'top', 'goat', 'pog', 'amo', 'lindo'],
} as const;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function hashHue(s: string): number { return hashInt(s) % 360; }

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

export const TEAM_HUE: Record<Team, number> = { A: 205, B: 8 };
export const TEAM_COLOR: Record<Team, string> = { A: '#2B8CFF', B: '#FF4040' };

export function createWorld(width: number, height: number): World {
  const baseR = Math.min(width, height) * 0.42;
  return {
    width, height, time: 0,
    fighters: new Map(),
    particles: [], floats: [], bananas: [],
    shark: null,
    platform: { cx: width / 2, cy: height / 2, r: baseR, targetR: baseR, baseR },
    events: {
      spin: 0, soap: 0, wave: 0, shrink: 0, sumo: 0, lowGrav: 0, ice: 0, quake: 0,
      invertGrav: 0, superA: 0, superB: 0,
    },
    waveDir: { x: 1, y: 0 },
    vote: null,
    nextVoteAt: TUNING.voteEveryMs,
    moment: null,
    round: 1,
    kingId: null,
    intermissionUntil: 0,
    scoreA: 0, scoreB: 0,
    stats: { messages: 0, knockouts: 0, events: 0, roundsA: 0, roundsB: 0 },
  };
}

export function isBotName(id: string): boolean {
  return id.trim().toLowerCase().endsWith('bot');
}

function classFor(id: string): ClassKind {
  return CLASS_LIST[hashInt(id + 'cls') % CLASS_LIST.length];
}

function teamCounts(w: World): { A: number; B: number } {
  let A = 0, B = 0;
  for (const f of w.fighters.values()) { if (f.team === 'A') A++; else B++; }
  return { A, B };
}

function spawnPoint(w: World, team: Team): { x: number; y: number } {
  // each team starts on its own half of the pool
  const { cx, cy, r } = w.platform;
  const side = team === 'A' ? -1 : 1;
  const ang = Math.random() * Math.PI * 2;
  const rad = r * 0.55 * Math.sqrt(Math.random());
  return { x: cx + side * r * 0.32 + Math.cos(ang) * rad * 0.5, y: cy + Math.sin(ang) * rad };
}

function burst(w: World, x: number, y: number, color: string, n: number, kind: ParticleKind, speed = 200) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    w.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5, maxLife: 1, size: 2 + Math.random() * 3, color, kind,
    });
  }
}
function addFloat(w: World, x: number, y: number, text: string, color: string, size = 16) {
  w.floats.push({ x, y, vy: -46, life: 1.1, maxLife: 1.1, text, color, size });
}
function setMoment(w: World, title: string, sub: string, seconds: number) {
  w.moment = { title, sub, until: w.time + seconds * 1000, shake: 0.9 };
}

/* ── Chat ingestion ──────────────────────────────────────────────────────── */
export interface IncomingMessage { username: string; text: string; color: string; source: ChatSource; }

const CMD_WORDS: Record<Action, string[]> = {
  push:   ['!push', 'push', 'empurra', 'empurrão', 'empurrao', 'soco', 'bate', 'ombrada'],
  jump:   ['!jump', 'jump', 'pula', 'pulo', 'salta', 'salto'],
  dash:   ['!dash', 'dash', 'corre', 'avança', 'avanca', 'investe', 'ataca'],
  defend: ['!defend', 'defend', 'segura', 'defende', 'block', 'guarda', 'firme'],
};

function detectAction(lower: string): Action | null {
  for (const a of ['push', 'dash', 'jump', 'defend'] as Action[]) {
    if (CMD_WORDS[a].some(k => lower.includes(k))) return a;
  }
  return null;
}

export function applyMessage(w: World, msg: IncomingMessage): void {
  const id = msg.username.trim().toLowerCase();
  if (!id || isBotName(id)) return;
  w.stats.messages++;
  const now = w.time;
  const text = msg.text.trim();
  const lower = text.toLowerCase();
  const hue = hexToHue(msg.color) ?? hashHue(id);

  // vote ballot — viewers pick an event by emoji/keyword/number
  if (w.vote && now < w.vote.until) castVote(w, id, lower);

  let f = w.fighters.get(id);

  // anti-spam energy multiplier
  let mult = 1;
  if (f && f.alive) {
    if (now - f.lastMsgAt < TUNING.cooldownMs) mult *= 0.25;
    if (lower === f.lastText && lower.length > 0) mult *= 0.2;
  }
  if (text.length < TUNING.shortMsgLen) mult *= 0.5;

  let streak = 1;
  if (f && now - f.lastMsgAt < TUNING.streakWindowMs) streak = f.streak + 1;

  if (!f) {
    const { A, B } = teamCounts(w);
    const team: Team = A === B ? (hashInt(id) % 2 === 0 ? 'A' : 'B') : (A < B ? 'A' : 'B');
    const cls = classFor(id);
    const p = spawnPoint(w, team);
    f = {
      id, name: msg.username, source: msg.source, color: msg.color || TEAM_COLOR[team], hue,
      team, cls, x: p.x, y: p.y, vx: 0, vy: 0, z: 0, vz: 0,
      radius: CLASSES[cls].radius, energy: TUNING.spawnEnergy,
      facing: team === 'A' ? 0 : Math.PI, streak, lastMsgAt: now, lastText: lower, spawnAt: now,
      outAt: 0, alive: true, invinUntil: now + TUNING.invinMs, braceUntil: 0, frozenUntil: 0,
      actionCdUntil: 0, lastHitBy: '', lastHitAt: 0, knockouts: 0,
      hitFlash: 0, wobble: Math.random() * 10, wanderAngle: Math.random() * Math.PI * 2, isStreamer: false,
    };
    w.fighters.set(id, f);
    burst(w, f.x, f.y, TEAM_COLOR[team], 16, 'spawn');
    addFloat(w, f.x, f.y - f.radius - 8, `${CLASSES[cls].emoji} ${CLASSES[cls].label}`, TEAM_COLOR[team], 14);
  } else {
    if (!f.alive) reviveFighter(w, f);
    f.name = msg.username;
    f.streak = streak;
    f.lastMsgAt = now;
    f.lastText = lower;
    f.hue = hue;
  }

  // energy gain
  let gain = TUNING.energyPerMsg * mult;
  if (TUNING.feedWords.some(k => lower.includes(k))) gain += 8;
  if (streak === 5) gain += 16;
  else if (streak >= 15 && streak % 5 === 0) gain += 24;
  f.energy = Math.min(TUNING.energyMax, f.energy + gain);
  if (gain >= 4) addFloat(w, f.x, f.y - f.radius - 6, `+${Math.round(gain)}⚡`, '#7CE0FF', 13);

  // command → action (throttled per fighter, gated by energy)
  const action = detectAction(lower);
  if (action && f.alive && now >= f.actionCdUntil && f.frozenUntil < now) {
    performAction(w, f, action);
    f.actionCdUntil = now + TUNING.actionCdMs;
  }
}

function reviveFighter(w: World, f: Fighter) {
  const p = spawnPoint(w, f.team);
  f.alive = true; f.outAt = 0; f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0; f.z = 0; f.vz = 0;
  f.energy = Math.max(f.energy, TUNING.spawnEnergy);
  f.invinUntil = w.time + TUNING.invinMs;
  burst(w, f.x, f.y, TEAM_COLOR[f.team], 14, 'spawn');
}

function nearestEnemy(w: World, f: Fighter): Fighter | null {
  let best: Fighter | null = null, bd = Infinity;
  for (const o of w.fighters.values()) {
    if (o === f || !o.alive || o.team === f.team) continue;
    const d = (o.x - f.x) ** 2 + (o.y - f.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function performAction(w: World, f: Fighter, action: Action) {
  const cls = CLASSES[f.cls];
  if (action === 'defend') {
    if (f.energy < TUNING.costDefend) return;
    f.energy -= TUNING.costDefend;
    f.braceUntil = w.time + TUNING.braceMs;
    burst(w, f.x, f.y, '#8af', 8, 'shock', 90);
    addFloat(w, f.x, f.y - f.radius - 6, '🛡️ FIRME', '#9bd6ff', 14);
    return;
  }
  if (action === 'jump') {
    if (f.energy < TUNING.costJump || f.z > 1) return;
    f.energy -= TUNING.costJump;
    f.vz = 520 * cls.jump;
    addFloat(w, f.x, f.y - f.radius - 6, '⬆️', '#fff', 16);
    return;
  }
  const target = nearestEnemy(w, f);
  if (action === 'dash') {
    if (f.energy < TUNING.costDash) return;
    f.energy -= TUNING.costDash;
    let ang = f.facing;
    if (target) ang = Math.atan2(target.y - f.y, target.x - f.x);
    f.facing = ang;
    const imp = TUNING.dashImpulse * cls.speed;
    f.vx += Math.cos(ang) * imp; f.vy += Math.sin(ang) * imp;
    burst(w, f.x, f.y, TEAM_COLOR[f.team], 8, 'shock', 160);
    return;
  }
  // push — shoulder bash toward nearest enemy in range
  if (f.energy < TUNING.costPush) return;
  f.energy -= TUNING.costPush;
  if (target) {
    const dx = target.x - f.x, dy = target.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    f.facing = Math.atan2(dy, dx);
    const reach = f.radius + target.radius + 70;
    // lunge toward the enemy
    f.vx += (dx / dist) * 200; f.vy += (dy / dist) * 200;
    if (dist <= reach) shove(w, f, target, dx / dist, dy / dist, TUNING.pushImpulse);
    else addFloat(w, f.x, f.y - f.radius - 6, '👊', '#fff', 16);
  }
}

/** Apply a knockback impulse from attacker → victim, scaled by weight + brace. */
function shove(w: World, attacker: Fighter, victim: Fighter, nx: number, ny: number, base: number) {
  if (w.time < victim.invinUntil) return;
  const aw = effectiveWeight(w, attacker), vw = effectiveWeight(w, victim);
  let power = base * (aw / vw);
  if (w.time < victim.braceUntil) power *= 0.35;
  if (attacker.team === 'A' && w.time < w.events.superA) power *= 1.7;
  if (attacker.team === 'B' && w.time < w.events.superB) power *= 1.7;
  if (w.kingId === victim.id) power *= 1.25;           // gang up on the king
  victim.vx += nx * power; victim.vy += ny * power;
  victim.hitFlash = 1;
  victim.lastHitBy = attacker.id; victim.lastHitAt = w.time;
  // monkey grabs — gets dragged along with the victim
  if (attacker.cls === 'monkey') { attacker.vx += nx * power * 0.4; attacker.vy += ny * power * 0.4; }
  burst(w, victim.x, victim.y, '#fff', 10, 'pop', 200);
  addFloat(w, victim.x, victim.y - victim.radius - 6, '💥', '#fff', 18);
}

function effectiveWeight(w: World, f: Fighter): number {
  let wt = CLASSES[f.cls].weight;
  if (w.time < w.events.sumo) wt *= 2;
  return wt;
}

/* ── Streamer powers + events ────────────────────────────────────────────── */
export function triggerSpin(w: World)    { w.events.spin = w.time + 18_000; w.stats.events++; setMoment(w, 'PISCINA GIRATÓRIA', 'tudo gira — segurem firme!', 6); }
export function triggerSoap(w: World)    { w.events.soap = w.time + 16_000; w.stats.events++; setMoment(w, 'SABÃO!', 'a plataforma escorrega MUITO', 6); }
export function triggerIce(w: World)     { w.events.ice = w.time + 16_000; w.stats.events++; setMoment(w, 'GELO', 'pista escorregadia, sem freio', 6); }
export function triggerSumo(w: World)    { w.events.sumo = w.time + 18_000; w.stats.events++; setMoment(w, 'MODO SUMÔ', 'todo mundo fica pesadão', 6); }
export function triggerLowGrav(w: World) { w.events.lowGrav = w.time + 18_000; w.stats.events++; setMoment(w, 'GRAVIDADE BAIXA', 'saltos gigantes!', 6); }
export function triggerQuake(w: World) {
  w.events.quake = w.time + 7_000; w.stats.events++;
  for (const f of w.fighters.values()) {
    if (!f.alive) continue;
    const a = Math.random() * Math.PI * 2;
    f.vx += Math.cos(a) * 260; f.vy += Math.sin(a) * 260;
  }
  setMoment(w, 'TERREMOTO!', 'a piscina treme — caos total', 6);
}
export function triggerWave(w: World) {
  const a = Math.floor(Math.random() * 4) * (Math.PI / 2);
  w.waveDir = { x: Math.cos(a), y: Math.sin(a) };
  w.events.wave = w.time + 6_000; w.stats.events++;
  for (const f of w.fighters.values()) {
    if (!f.alive) continue;
    f.vx += w.waveDir.x * 360; f.vy += w.waveDir.y * 360;
  }
  setMoment(w, 'ONDA GIGANTE', 'a água empurra geral!', 6);
}
export function triggerShrink(w: World) {
  w.events.shrink = w.time + 20_000;
  w.platform.targetR = Math.max(w.platform.baseR * 0.42, w.platform.baseR * 0.5);
  w.stats.events++;
  setMoment(w, 'MINI PLATAFORMA', 'o mapa encolheu — desespero!', 6);
}

// streamer-only chaos buttons
export function spawnShark(w: World) {
  const { cx, cy, r } = w.platform;
  const a = Math.random() * Math.PI * 2;
  w.shark = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0, angle: a + Math.PI, until: w.time + 16_000 };
  w.stats.events++;
  setMoment(w, '🦈 TUBARÃO!', 'fujam — ele empurra forte', 6);
}
export function invertGravity(w: World) {
  w.events.invertGrav = w.time + 9_000; w.stats.events++;
  setMoment(w, 'GRAVIDADE INVERTIDA', 'tudo é jogado pra fora!', 6);
}
export function superForce(w: World) {
  // buff whichever team is currently losing the round (fewer alive)
  let A = 0, B = 0;
  for (const f of w.fighters.values()) if (f.alive) { if (f.team === 'A') A++; else B++; }
  const team: Team = A <= B ? 'A' : 'B';
  if (team === 'A') w.events.superA = w.time + 12_000; else w.events.superB = w.time + 12_000;
  w.stats.events++;
  setMoment(w, `SUPER FORÇA — TIME ${team}`, 'empurrões turbinados por 12s', 6);
}
export function freezeRandom(w: World) {
  const alive = [...w.fighters.values()].filter(f => f.alive && w.time > f.invinUntil);
  if (!alive.length) return;
  const v = alive[Math.floor(Math.random() * alive.length)];
  v.frozenUntil = w.time + 4500; v.vx = 0; v.vy = 0;
  w.stats.events++;
  burst(w, v.x, v.y, '#bfefff', 18, 'star', 140);
  setMoment(w, `${v.name} CONGELOU!`, 'parado feito estátua 🧊', 5);
}
export function spawnBanana(w: World) {
  const { cx, cy, r } = w.platform;
  for (let i = 0; i < 4; i++) {
    const ang = Math.random() * Math.PI * 2, rad = r * 0.85 * Math.sqrt(Math.random());
    w.bananas.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
  }
  w.stats.events++;
  setMoment(w, '🍌 BANANAS!', 'pisou, escorregou', 5);
}

export const EVENT_LABELS: Record<EventKey, { label: string; emoji: string }> = {
  spin:    { label: 'GIRATÓRIA', emoji: '🌀' },
  soap:    { label: 'SABÃO',     emoji: '🧼' },
  wave:    { label: 'ONDA',      emoji: '🌊' },
  shrink:  { label: 'MINI MAPA', emoji: '🟦' },
  sumo:    { label: 'SUMÔ',      emoji: '🟠' },
  lowGrav: { label: 'GRAV. BAIXA', emoji: '🪶' },
  ice:     { label: 'GELO',      emoji: '🧊' },
  quake:   { label: 'TERREMOTO', emoji: '💥' },
};
export const EVENT_FN: Record<EventKey, (w: World) => void> = {
  spin: triggerSpin, soap: triggerSoap, wave: triggerWave, shrink: triggerShrink,
  sumo: triggerSumo, lowGrav: triggerLowGrav, ice: triggerIce, quake: triggerQuake,
};

/* ── Chat vote ───────────────────────────────────────────────────────────── */
export function startVote(w: World) {
  const keys = Object.keys(EVENT_LABELS) as EventKey[];
  // shuffle + take 3
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const pick = keys.slice(0, 3);
  w.vote = {
    until: w.time + TUNING.voteDurMs,
    options: pick.map(k => ({ key: k, label: EVENT_LABELS[k].label, emoji: EVENT_LABELS[k].emoji, votes: 0 })),
    voters: new Set(),
  };
  setMoment(w, 'VOTAÇÃO DO CHAT', 'digitem 1, 2 ou 3 pra escolher o caos', 5);
}
function castVote(w: World, id: string, lower: string) {
  const v = w.vote!;
  if (v.voters.has(id)) return;
  let idx = -1;
  if (/(^|\D)1(\D|$)/.test(lower)) idx = 0;
  else if (/(^|\D)2(\D|$)/.test(lower)) idx = 1;
  else if (/(^|\D)3(\D|$)/.test(lower)) idx = 2;
  else idx = v.options.findIndex(o => lower.includes(o.label.toLowerCase()) || lower.includes(o.emoji));
  if (idx < 0 || idx >= v.options.length) return;
  v.options[idx].votes++;
  v.voters.add(id);
}
function resolveVote(w: World) {
  const v = w.vote!;
  w.vote = null;
  const winner = v.options.reduce((a, b) => (b.votes > a.votes ? b : a), v.options[0]);
  EVENT_FN[winner.key](w);
}

/* ── Streamer ball (joins the brawl on whichever team needs it) ──────────── */
export function toggleStreamerBall(w: World, name: string): void {
  const existing = [...w.fighters.values()].find(f => f.isStreamer);
  if (existing) {
    burst(w, existing.x, existing.y, '#00E5FF', 22, 'pop');
    w.fighters.delete(existing.id);
    return;
  }
  const id = `__streamer__:${name.trim().toLowerCase() || 'streamer'}`;
  const { A, B } = teamCounts(w);
  const team: Team = A <= B ? 'A' : 'B';
  const p = spawnPoint(w, team);
  const f: Fighter = {
    id, name: name.trim() || 'STREAMER', source: 'twitch', color: '#00E5FF', hue: 187,
    team, cls: 'tank', x: p.x, y: p.y, vx: 0, vy: 0, z: 0, vz: 0,
    radius: CLASSES.tank.radius * 1.2, energy: TUNING.energyMax,
    facing: 0, streak: 0, lastMsgAt: w.time, lastText: '', spawnAt: w.time,
    outAt: 0, alive: true, invinUntil: w.time + 2000, braceUntil: 0, frozenUntil: 0,
    actionCdUntil: 0, lastHitBy: '', lastHitAt: 0, knockouts: 0,
    hitFlash: 0, wobble: 0, wanderAngle: 0, isStreamer: true,
  };
  w.fighters.set(id, f);
  burst(w, f.x, f.y, '#00E5FF', 26, 'spawn');
}

/* ── Simulation step ─────────────────────────────────────────────────────── */
export function stepWorld(w: World, dtMs: number): void {
  const dt = Math.min(dtMs, 50) / 1000;
  w.time += dtMs;
  const now = w.time;

  if (w.moment && now > w.moment.until) w.moment = null;

  // vote scheduling
  if (!w.vote && now >= w.nextVoteAt && w.fighters.size >= 2) startVote(w);
  if (w.vote && now >= w.vote.until) { resolveVote(w); w.nextVoteAt = now + TUNING.voteEveryMs; }

  // platform breathing / shrink event
  const p = w.platform;
  if (now < w.events.shrink) {
    // held small
  } else if (now >= w.intermissionUntil) {
    p.targetR = Math.max(p.baseR * 0.5, p.targetR - TUNING.roundShrinkRate * dt);
  }
  p.r += (p.targetR - p.r) * Math.min(3 * dt, 1);

  const slippery = now < w.events.soap ? TUNING.soapFriction
    : now < w.events.ice ? TUNING.iceFriction : TUNING.friction;
  const spin = now < w.events.spin;
  const wave = now < w.events.wave;
  const lowGrav = now < w.events.lowGrav;
  const invert = now < w.events.invertGrav;
  const hopG = TUNING.hopGravity * (lowGrav ? 0.4 : 1);

  for (const f of w.fighters.values()) {
    if (!f.alive) { // swimmer drift
      f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.95; f.vy *= 0.95;
      f.wobble += dt * 3;
      continue;
    }
    f.wobble += dt * (5 + 40 / Math.max(f.radius, 10));
    const cls = CLASSES[f.cls];
    const frozen = now < f.frozenUntil;

    let ax = 0, ay = 0;
    if (!frozen) {
      // wander
      f.wanderAngle += (Math.random() - 0.5) * 3 * dt * 4;
      ax += Math.cos(f.wanderAngle) * TUNING.wanderAccel;
      ay += Math.sin(f.wanderAngle) * TUNING.wanderAccel;
      // auto-aggression: drift toward nearest enemy if it has energy to spend
      if (f.energy > 25) {
        const t = nearestEnemy(w, f);
        if (t) {
          const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
          ax += (dx / d) * TUNING.seekAccel; ay += (dy / d) * TUNING.seekAccel;
          f.facing = Math.atan2(dy, dx);
        }
      }
    }

    // platform spin → tangential swirl + slight outward drift
    if (spin) {
      const dx = f.x - p.cx, dy = f.y - p.cy;
      ax += -dy * 1.4 + dx * 0.25;
      ay += dx * 1.4 + dy * 0.25;
    }
    // inverted gravity → flung outward from centre
    if (invert) {
      const dx = f.x - p.cx, dy = f.y - p.cy, d = Math.hypot(dx, dy) || 1;
      ax += (dx / d) * 220; ay += (dy / d) * 220;
    }
    // ongoing wave push
    if (wave) { ax += w.waveDir.x * 120; ay += w.waveDir.y * 120; }

    f.vx += ax * dt; f.vy += ay * dt;
    // friction
    f.vx -= f.vx * Math.min(slippery * dt, 0.9);
    f.vy -= f.vy * Math.min(slippery * dt, 0.9);

    // speed cap (only on self-driven motion; knockback can exceed briefly)
    const maxSpeed = TUNING.baseSpeed * cls.speed;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > maxSpeed * 2.6) { f.vx = (f.vx / sp) * maxSpeed * 2.6; f.vy = (f.vy / sp) * maxSpeed * 2.6; }

    f.x += f.vx * dt; f.y += f.vy * dt;

    // vertical hop
    if (f.z > 0 || f.vz > 0) {
      f.vz -= hopG * dt;
      f.z += f.vz * dt;
      if (f.z <= 0) {
        f.z = 0;
        // spring landing shockwave
        if (f.cls === 'spring' && f.vz < -260) springLand(w, f);
        f.vz = 0;
      }
    }

    // energy decay
    f.energy = Math.max(0, f.energy - TUNING.energyDecay * dt);

    if (f.braceUntil > now) { f.vx *= 0.86; f.vy *= 0.86; } // bracing roots you a bit
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt * 3);
    f.radius += (cls.radius * (now < w.events.sumo ? 1.25 : 1) - f.radius) * Math.min(8 * dt, 1);

    // fall off the platform (only while grounded + not protected)
    if (f.z <= 0 && now > f.invinUntil) {
      const d = Math.hypot(f.x - p.cx, f.y - p.cy);
      if (d > p.r + f.radius * 0.2) dropFighter(w, f);
    }
  }

  // bananas — slip the unlucky
  if (w.bananas.length) {
    for (const f of w.fighters.values()) {
      if (!f.alive || f.z > 6) continue;
      for (let i = w.bananas.length - 1; i >= 0; i--) {
        const b = w.bananas[i];
        if (Math.hypot(f.x - b.x, f.y - b.y) < f.radius * 0.8) {
          const a = Math.random() * Math.PI * 2;
          f.vx += Math.cos(a) * 520; f.vy += Math.sin(a) * 520;
          addFloat(w, f.x, f.y - f.radius - 6, '🍌💫', '#ffe14a', 16);
          burst(w, b.x, b.y, '#ffe14a', 8, 'star', 120);
          w.bananas.splice(i, 1);
        }
      }
    }
  }

  // shark
  if (w.shark) updateShark(w, dt);

  // collisions
  resolveCollisions(w);

  // king of the pool = most knockouts
  let king: Fighter | null = null;
  for (const f of w.fighters.values()) {
    if (f.alive && f.knockouts > 0 && (!king || f.knockouts > king.knockouts)) king = f;
  }
  w.kingId = king ? king.id : null;

  // round resolution: one team wiped off the platform
  if (now >= w.intermissionUntil) checkRoundEnd(w);
  else if (now < w.intermissionUntil && p.targetR < p.baseR) {
    // intermission: regrow platform + revive everyone for the next round
    p.targetR = p.baseR;
  }

  // particles / floats
  for (const pt of w.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.95; pt.vy *= 0.95; pt.life -= dt;
  }
  w.particles = w.particles.length > 900 ? w.particles.filter(pt => pt.life > 0).slice(-900)
    : w.particles.filter(pt => pt.life > 0);
  for (const fl of w.floats) { fl.y += fl.vy * dt; fl.life -= dt; }
  w.floats = w.floats.filter(fl => fl.life > 0);

  if (w.shark && now > w.shark.until) w.shark = null;
}

function springLand(w: World, f: Fighter) {
  burst(w, f.x, f.y, '#7CFFB2', 18, 'shock', 260);
  for (const o of w.fighters.values()) {
    if (o === f || !o.alive) continue;
    const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (d < f.radius * 4) {
      const k = (1 - d / (f.radius * 4));
      shove(w, f, o, dx / d, dy / d, TUNING.jumpShock * k);
    }
  }
}

function updateShark(w: World, dt: number) {
  const s = w.shark!;
  // chase nearest alive fighter
  let target: Fighter | null = null, bd = Infinity;
  for (const f of w.fighters.values()) {
    if (!f.alive) continue;
    const d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2;
    if (d < bd) { bd = d; target = f; }
  }
  if (target) {
    const ang = Math.atan2(target.y - s.y, target.x - s.x);
    s.vx += Math.cos(ang) * 700 * dt; s.vy += Math.sin(ang) * 700 * dt;
    s.angle = ang;
  }
  const sp = Math.hypot(s.vx, s.vy), max = 360;
  if (sp > max) { s.vx = (s.vx / sp) * max; s.vy = (s.vy / sp) * max; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  if (Math.random() < 0.5) burst(w, s.x, s.y, '#bfe9ff', 1, 'splash', 60);
  for (const f of w.fighters.values()) {
    if (!f.alive || w.time < f.invinUntil) continue;
    const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d < f.radius + 36) {
      f.vx += (dx / d) * 620; f.vy += (dy / d) * 620;
      f.hitFlash = 1; f.lastHitBy = '';
      addFloat(w, f.x, f.y - f.radius - 6, '🦈', '#fff', 18);
      burst(w, f.x, f.y, '#fff', 8, 'pop', 200);
    }
  }
}

function resolveCollisions(w: World) {
  const list = [...w.fighters.values()].filter(f => f.alive);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (Math.abs(a.z - b.z) > 30) continue; // one is hopping over the other
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const minD = a.radius + b.radius;
      if (dist >= minD) continue;
      const nx = dx / dist, ny = dy / dist, overlap = minD - dist;
      const aw = effectiveWeight(w, a), bw = effectiveWeight(w, b), sum = aw + bw;
      a.x -= nx * overlap * (bw / sum); a.y -= ny * overlap * (bw / sum);
      b.x += nx * overlap * (aw / sum); b.y += ny * overlap * (aw / sum);
      // bump impulse, transfers momentum (heavier wins)
      const push = 60 * Math.min(overlap / minD, 1);
      a.vx -= nx * push * (bw / sum); a.vy -= ny * push * (bw / sum);
      b.vx += nx * push * (aw / sum); b.vy += ny * push * (aw / sum);
      // moving fighters body-check enemies (passive shove)
      if (a.team !== b.team) {
        const av = Math.hypot(a.vx, a.vy), bv = Math.hypot(b.vx, b.vy);
        if (av > 260 && av > bv) { shove(w, a, b, nx, ny, av * 0.9); a.vx *= 0.6; a.vy *= 0.6; }
        else if (bv > 260 && bv > av) { shove(w, b, a, -nx, -ny, bv * 0.9); b.vx *= 0.6; b.vy *= 0.6; }
      }
    }
  }
}

function dropFighter(w: World, f: Fighter) {
  f.alive = false; f.outAt = w.time;
  w.stats.knockouts++;
  burst(w, f.x, f.y, '#bfe9ff', 24, 'splash', 220);
  addFloat(w, f.x, f.y, 'SPLASH!', '#bfe9ff', 20);
  // kill credit → attacker + team score
  if (f.lastHitBy && w.time - f.lastHitAt < 4000) {
    const killer = w.fighters.get(f.lastHitBy);
    if (killer && killer.team !== f.team) {
      killer.knockouts++;
      if (killer.team === 'A') w.scoreA++; else w.scoreB++;
      addFloat(w, killer.x, killer.y - killer.radius - 10, '+1 KO', TEAM_COLOR[killer.team], 16);
    }
  }
  // fling the swimmer outward so it floats off-platform
  const dx = f.x - w.platform.cx, dy = f.y - w.platform.cy, d = Math.hypot(dx, dy) || 1;
  f.vx = (dx / d) * 80; f.vy = (dy / d) * 80;
}

function checkRoundEnd(w: World) {
  let A = 0, B = 0, total = 0;
  for (const f of w.fighters.values()) {
    total++;
    if (f.alive) { if (f.team === 'A') A++; else B++; }
  }
  if (total < 2) return;
  if (A > 0 && B > 0) return;
  if (A === 0 && B === 0) return;
  const winner: Team = A > 0 ? 'A' : 'B';
  if (winner === 'A') { w.scoreA += 3; w.stats.roundsA++; } else { w.scoreB += 3; w.stats.roundsB++; }
  w.round++;
  w.intermissionUntil = w.time + TUNING.intermissionMs;
  w.platform.targetR = w.platform.baseR;
  // confetti + revive everyone for the next round
  for (const f of w.fighters.values()) {
    if (f.team === winner) { for (let i = 0; i < 3; i++) burst(w, f.x, f.y, TEAM_COLOR[winner], 6, 'star', 200); }
    reviveFighter(w, f);
  }
  setMoment(w, `TIME ${winner} VENCEU O ROUND ${w.round - 1}!`, `placar ${w.scoreA} × ${w.scoreB}`, 5);
}

/* ── Leaderboard snapshot ────────────────────────────────────────────────── */
export interface LeaderRow {
  id: string; name: string; team: Team; cls: ClassKind; knockouts: number;
  energy: number; hue: number; alive: boolean; king: boolean;
  source: ChatSource; streamer: boolean;
}
export function leaderboard(w: World, top = 10): LeaderRow[] {
  return [...w.fighters.values()]
    .filter(f => !isBotName(f.id))
    .sort((a, b) => b.knockouts - a.knockouts || (b.alive ? 1 : 0) - (a.alive ? 1 : 0))
    .slice(0, top)
    .map(f => ({
      id: f.id, name: f.name, team: f.team, cls: f.cls, knockouts: f.knockouts,
      energy: Math.round(f.energy), hue: f.hue, alive: f.alive, king: w.kingId === f.id,
      source: f.source, streamer: f.isStreamer,
    }));
}
export function playerCount(w: World): number {
  let c = 0;
  for (const f of w.fighters.values()) if (!isBotName(f.id)) c++;
  return c;
}
export function teamAlive(w: World): { A: number; B: number } {
  let A = 0, B = 0;
  for (const f of w.fighters.values()) if (f.alive) { if (f.team === 'A') A++; else B++; }
  return { A, B };
}
