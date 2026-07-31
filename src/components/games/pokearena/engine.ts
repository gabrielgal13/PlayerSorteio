/* ============================================================================
 * POKÉARENA LIVE — motor do jogo
 *
 * Estado puro + funções de passo. Nada de React aqui: o componente só lê o
 * `World` e chama estas funções. O chat entra por `applyMessage`.
 * ========================================================================== */
'use client';
import {
  BALL_COMMANDS, BOSSES, CAPTURABLE, EVENTS, ITEMS, LEGENDARIES, SHINY_BASE_CHANCE,
  STYLES, STYLE_ALIASES, WEATHER, XP, artworkUrl, effectiveness, movesFor, species,
  type EventKey, type ItemKey, type PType, type StyleKey, type WeatherKey,
} from './data';
import {
  pokeStore, scoreCreature, normNick,
  type Creature, type Source, type Trainer,
} from './storage';

/* ------------------------------------------------------------------ tipos */

export type Mode = 'idle' | 'spawn' | 'boss' | 'dungeon' | 'tournament';

export interface SpawnEntry {
  nick: string; display: string; color: string; source: Source;
  ball: ItemKey; at: number;
}

export interface SpawnState {
  sid: number; shiny: boolean; lvl: number;
  /** appearing → open (chat digita) → wobble (a bola chacoalha) → caught/fled */
  phase: 'appearing' | 'open' | 'wobble' | 'caught' | 'fled';
  phaseUntil: number;
  endsAt: number;
  entries: Map<string, SpawnEntry>;
  winner: SpawnEntry | null;
  wobbles: number;
  legendary: boolean;
}

export interface Fighter {
  nick: string; display: string; color: string; source: Source;
  uid: string; sid: number; lvl: number; shiny: boolean;
  hp: number; maxHp: number; atk: number; def: number;
  interval: number;          // ms entre ataques
  nextAt: number;
  style: StyleKey;
  charge: number;            // 0..100 → libera a ultimate
  shieldUntil: number;
  rageUntil: number;
  boostUntil: number;
  damage: number;
  down: boolean;
  lastMove: string;
  hitFlash: number;          // world time até quando pisca
}

export interface BattleLine { id: string; text: string; color: string; at: number; }

export interface BossState {
  sid: number; name: string; emoji: string; types: PType[];
  hp: number; maxHp: number; lvl: number;
  phase: 'joining' | 'fighting' | 'won' | 'lost';
  phaseUntil: number;
  fighters: Fighter[];
  nextAt: number;
  bigAt: number;
  log: BattleLine[];
  cheer: number;
  lastMove: string;
  hitFlash: number;
  /** true quando é uma sala de dungeon (recompensa menor, sem cinemática final) */
  room: boolean;
  reward: number;
}

export interface DungeonRoom { kind: 'mob' | 'mini' | 'boss'; sid: number; name: string; cleared: boolean; }

export interface DungeonState {
  name: string; emoji: string;
  rooms: DungeonRoom[];
  index: number;
  phase: 'joining' | 'running' | 'won' | 'lost';
  phaseUntil: number;
  party: string[];
  battle: BossState | null;
}

export interface Entrant {
  nick: string; display: string; color: string;
  sid: number; lvl: number; shiny: boolean; power: number;
}

export interface Match {
  a: Entrant | null; b: Entrant | null;
  winner: Entrant | null;
  hpA: number; hpB: number;
  done: boolean;
}

export interface TournamentState {
  phase: 'running' | 'done';
  rounds: Match[][];
  roundIndex: number;
  matchIndex: number;
  nextAt: number;
  champion: Entrant | null;
  lastHit: string;
}

export type CineKind = 'spawn' | 'capture' | 'shiny' | 'legendary' | 'evolve' | 'boss' | 'victory' | 'defeat' | 'champion' | 'event';

export interface Cinematic {
  id: string;
  kind: CineKind;
  title: string;
  sub: string;
  sid: number | null;
  shiny: boolean;
  color: string;
  durationMs: number;
  until: number;   // preenchido quando entra em cena
}

export interface FeedItem { id: string; icon: string; text: string; color: string; at: number; }

export interface CardQuery { nick: string; until: number; }

export interface World {
  time: number;
  mode: Mode;

  weather: WeatherKey;
  weatherUntil: number;
  event: EventKey | null;
  eventUntil: number;
  doubleXp: boolean;
  doubleShiny: boolean;
  ballRainUntil: number;

  autoSpawn: boolean;
  spawnIntervalMs: number;
  nextSpawnAt: number;
  captureWindowMs: number;

  spawn: SpawnState | null;
  boss: BossState | null;
  dungeon: DungeonState | null;
  tournament: TournamentState | null;

  cine: Cinematic[];
  feed: FeedItem[];
  cards: CardQuery[];

  stats: {
    spawns: number; captures: number; shinies: number; legendaries: number;
    battles: number; bossesDown: number; messages: number; commands: number;
  };

  /** nick → world time da última participação (usado em ranking de presença) */
  active: Map<string, number>;
  supportCd: Map<string, number>;
  /** quem participou NESTA sessão — vira a lista do sorteio no final */
  session: Map<string, SessionRow>;
}

export interface SessionRow {
  nick: string; display: string; source: Source; color: string; points: number;
}

/* ------------------------------------------------------------------ utils */

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function createWorld(): World {
  return {
    time: 0,
    mode: 'idle',
    weather: 'clear', weatherUntil: 0,
    event: null, eventUntil: 0,
    doubleXp: false, doubleShiny: false,
    ballRainUntil: 0,
    autoSpawn: true, spawnIntervalMs: 5 * 60_000, nextSpawnAt: 20_000,
    captureWindowMs: 30_000,
    spawn: null, boss: null, dungeon: null, tournament: null,
    cine: [], feed: [], cards: [],
    stats: { spawns: 0, captures: 0, shinies: 0, legendaries: 0, battles: 0, bossesDown: 0, messages: 0, commands: 0 },
    active: new Map(), supportCd: new Map(), session: new Map(),
  };
}

/** Pontua a participação da sessão atual (base do sorteio ao finalizar). */
function mark(w: World, t: Trainer, points: number) {
  const row = w.session.get(t.nick);
  if (row) { row.points += points; row.display = t.display; }
  else w.session.set(t.nick, { nick: t.nick, display: t.display, source: t.source, color: t.color, points });
  w.active.set(t.nick, w.time);
}

export function sessionRows(w: World): SessionRow[] {
  return [...w.session.values()].sort((a, b) => b.points - a.points);
}

export function feed(w: World, icon: string, text: string, color = '#00E5FF') {
  w.feed.push({ id: uid(), icon, text, color, at: w.time });
  if (w.feed.length > 80) w.feed.splice(0, w.feed.length - 80);
}

function cine(w: World, c: Omit<Cinematic, 'id' | 'until'>) {
  w.cine.push({ ...c, id: uid(), until: 0 });
  if (w.cine.length > 6) w.cine.splice(0, w.cine.length - 6);
}

function battleLog(b: BossState, text: string, color = 'rgba(255,255,255,0.7)') {
  b.log.push({ id: uid(), text, color, at: Date.now() });
  if (b.log.length > 60) b.log.splice(0, b.log.length - 60);
}

/* ------------------------------------------------------------ modificadores */

function weatherDef(w: World) { return WEATHER[w.weather]; }
function eventDef(w: World) { return w.event ? EVENTS[w.event] : null; }

export function shinyChance(w: World): number {
  const ev = eventDef(w);
  return SHINY_BASE_CHANCE * weatherDef(w).shiny * (ev?.shiny ?? 1) * (w.doubleShiny ? 2 : 1);
}

export function xpMult(w: World): number { return w.doubleXp ? 2 : 1; }

/** Sorteia a espécie do próximo spawn respeitando clima e evento. */
function rollSpecies(w: World, forceLegendary = false) {
  const ev = eventDef(w);
  if (forceLegendary) return pick(LEGENDARIES);
  if (ev && Math.random() < ev.legendaryChance) return pick(LEGENDARIES);

  let pool = CAPTURABLE;
  if (ev) {
    if (ev.onlyTypes.length) pool = pool.filter(s => s.types.some(t => ev.onlyTypes.includes(t)));
    if (ev.onlyGen) pool = pool.filter(s => s.gen === ev.onlyGen);
  }
  if (pool.length === 0) pool = CAPTURABLE;

  // peso: raro aparece menos; clima multiplica os tipos favorecidos
  const favors = weatherDef(w).favors;
  const weights = pool.map(s => {
    let ww = [0, 30, 14, 6, 2.2, 0.4][s.rarity] ?? 6;
    if (favors.length && s.types.some(t => favors.includes(t))) ww *= 4;
    return ww;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/* -------------------------------------------------------------- spawn/captura */

export function spawnPokemon(w: World, opts: { legendary?: boolean; sid?: number } = {}) {
  if (w.mode !== 'idle' && w.mode !== 'spawn') return;
  if (w.spawn && w.spawn.phase !== 'caught' && w.spawn.phase !== 'fled') return;

  const sp = opts.sid != null ? species(opts.sid) : rollSpecies(w, opts.legendary);
  const shiny = Math.random() < shinyChance(w);
  const lvl = sp.legendary
    ? Math.round(rnd(45, 70))
    : Math.max(2, Math.round(rnd(3, 12) + sp.stage * 9 + sp.rarity * 3));

  w.spawn = {
    sid: sp.id, shiny, lvl,
    phase: 'appearing', phaseUntil: w.time + 1800,
    endsAt: w.time + 1800 + w.captureWindowMs * weatherDef(w).capture,
    entries: new Map(), winner: null, wobbles: 0,
    legendary: sp.legendary,
  };
  w.mode = 'spawn';
  w.stats.spawns++;
  pokeStore.markDex(sp.id);

  const color = shiny ? '#FFD24A' : sp.legendary ? '#FF9EC4' : '#7CFFB2';
  if (shiny) {
    cine(w, {
      kind: 'shiny', title: '✦ SHINY ✦', sub: `Um ${sp.name} SHINY apareceu!`,
      sid: sp.id, shiny: true, color: '#FFD24A', durationMs: 4200,
    });
  } else if (sp.legendary) {
    cine(w, {
      kind: 'legendary', title: 'LENDÁRIO!', sub: `${sp.name} surgiu do nada!`,
      sid: sp.id, shiny: false, color: '#FF9EC4', durationMs: 3600,
    });
  } else {
    cine(w, {
      kind: 'spawn', title: 'POKÉMON SELVAGEM!', sub: `Um ${sp.name} apareceu!`,
      sid: sp.id, shiny: false, color: '#7CFFB2', durationMs: 2200,
    });
  }
  feed(w, shiny ? '✨' : sp.legendary ? '👑' : '🌿', `${sp.name}${shiny ? ' SHINY' : ''} apareceu — chat tem ${Math.round(w.captureWindowMs / 1000)}s`, color);
  scheduleNextSpawn(w);
}

function scheduleNextSpawn(w: World) {
  const ev = eventDef(w);
  w.nextSpawnAt = w.time + w.spawnIntervalMs * (ev?.spawnSpeed ?? 1);
}

function resolveCapture(w: World) {
  const s = w.spawn;
  if (!s) return;
  const entries = [...s.entries.values()];
  if (entries.length === 0) {
    s.phase = 'fled';
    s.phaseUntil = w.time + 2600;
    feed(w, '💨', `${species(s.sid).name} fugiu — ninguém tentou capturar.`, 'rgba(255,255,255,0.4)');
    return;
  }
  const master = entries.filter(e => e.ball === 'masterball');
  const pool = master.length ? master : entries;
  const weights = pool.map(e => ITEMS[e.ball].weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let winner = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { winner = pool[i]; break; } }

  s.winner = winner;
  s.phase = 'wobble';
  s.wobbles = 0;
  s.phaseUntil = w.time + 900;
}

function completeCapture(w: World) {
  const s = w.spawn;
  if (!s || !s.winner) return;
  const sp = species(s.sid);
  const t = pokeStore.ensure(s.winner.display, s.winner.source, s.winner.color);
  const creature = pokeStore.addCreature(t, s.sid, s.lvl, s.shiny);
  grantXp(w, t, creature, XP.capture, 'captura');
  mark(w, t, s.shiny ? 6 : sp.legendary ? 5 : 3);

  w.stats.captures++;
  if (s.shiny) w.stats.shinies++;
  if (sp.legendary) w.stats.legendaries++;

  s.phase = 'caught';
  s.phaseUntil = w.time + 4200;

  cine(w, {
    kind: 'capture',
    title: `${t.display} capturou ${sp.name}!`,
    sub: s.shiny ? '✦ SHINY ✦ que sorte absurda' : sp.legendary ? '👑 UM LENDÁRIO!' : `com ${ITEMS[s.winner.ball].label} · Lv ${s.lvl}`,
    sid: s.sid, shiny: s.shiny,
    color: s.shiny ? '#FFD24A' : sp.legendary ? '#FF9EC4' : '#7CFFB2',
    durationMs: 4200,
  });
  feed(w, s.shiny ? '✨' : '🎯', `${t.display} capturou ${sp.name}${s.shiny ? ' SHINY' : ''} (Lv ${s.lvl})`, s.shiny ? '#FFD24A' : '#7CFFB2');

  // consolo para quem tentou e não levou
  for (const e of s.entries.values()) {
    if (e.nick === s.winner.nick) continue;
    const other = pokeStore.get(e.nick);
    if (other) { pokeStore.addTrainerXp(other, Math.round(XP.assist * xpMult(w))); mark(w, other, 1); }
  }
}

/* ------------------------------------------------------------ XP / evolução */

function grantXp(w: World, t: Trainer, creature: Creature | null, base: number, reason: string) {
  const amount = Math.round(base * xpMult(w));
  const ups = pokeStore.addTrainerXp(t, amount);
  if (ups > 0) {
    feed(w, '⭐', `${t.display} subiu para o nível ${t.lvl}! (${reason})`, '#FFD24A');
  }
  if (creature) {
    pokeStore.addCreatureXp(creature, amount);
    tryEvolve(w, t, creature);
  }
}

export function tryEvolve(w: World, t: Trainer, c: Creature, force = false) {
  const sp = species(c.sid);
  if (sp.evolvesTo.length === 0) return false;
  if (!force && (sp.evolveLevel === 0 || c.lvl < sp.evolveLevel)) return false;

  const fromName = sp.name;
  const nextId = sp.evolvesTo.length === 1 ? sp.evolvesTo[0] : pick(sp.evolvesTo);
  c.sid = nextId;
  const to = species(nextId);
  pokeStore.markDex(nextId, { caught: true, shiny: c.shiny });
  pokeStore.touch();

  cine(w, {
    kind: 'evolve',
    title: 'EVOLUÇÃO!',
    sub: `O ${fromName} de ${t.display} virou ${to.name}!`,
    sid: nextId, shiny: c.shiny, color: '#8FE3F0', durationMs: 4600,
  });
  feed(w, '🌀', `${fromName} de ${t.display} evoluiu para ${to.name}!`, '#8FE3F0');
  return true;
}

/* ------------------------------------------------------------------ combate */

function makeFighter(t: Trainer, c: Creature, w: World): Fighter {
  const sp = species(c.sid);
  const st = STYLES[c.style ?? t.style];
  const maxHp = Math.round((sp.power * 2.2 + c.lvl * 9) * st.def * (c.shiny ? 1.08 : 1));
  return {
    nick: t.nick, display: t.display, color: t.color, source: t.source,
    uid: c.uid, sid: c.sid, lvl: c.lvl, shiny: c.shiny,
    hp: maxHp, maxHp,
    atk: (sp.power * 0.5 + c.lvl * 1.7) * st.atk * (c.shiny ? 1.06 : 1),
    def: (sp.power * 0.3 + c.lvl * 1.0) * st.def,
    interval: 1500 / st.spd,
    nextAt: w.time + rnd(200, 1200),
    style: c.style ?? t.style,
    charge: 0,
    shieldUntil: 0, rageUntil: 0, boostUntil: 0,
    damage: 0, down: false, lastMove: '', hitFlash: 0,
  };
}

function damageOf(f: Fighter, movePower: number, moveType: PType, targetTypes: PType[], targetDef: number, w: World): { dmg: number; eff: number } {
  const eff = effectiveness(moveType, targetTypes);
  let atk = f.atk;
  if (f.rageUntil > w.time) atk *= 1.6;
  if (f.boostUntil > w.time) atk *= 1.3;
  const raw = (atk * (movePower / 42)) * eff / (1 + targetDef / 90);
  return { dmg: Math.max(1, Math.round(raw * rnd(0.86, 1.14))), eff };
}

export function joinBattle(w: World, t: Trainer): 'ok' | 'no-team' | 'already' | 'closed' {
  const b = activeBattle(w);
  if (!b) return 'closed';
  if (b.phase === 'won' || b.phase === 'lost') return 'closed';
  if (b.fighters.some(f => f.nick === t.nick)) return 'already';
  const c = pokeStore.fighterOf(t);
  if (!c) return 'no-team';
  const f = makeFighter(t, c, w);
  b.fighters.push(f);
  t.battles++;
  mark(w, t, 2);
  if (b.phase === 'joining') recalcBossHp(w, b);
  return 'ok';
}

function recalcBossHp(w: World, b: BossState) {
  const n = Math.max(1, b.fighters.length);
  const avg = b.fighters.reduce((s, f) => s + f.atk, 0) / n || 20;
  const base = b.room ? 420 : 1100;
  b.maxHp = Math.round((base + avg * n * 6.5) * weatherDef(w).bossHp * b.lvl / 60);
  b.hp = b.maxHp;
}

export function activeBattle(w: World): BossState | null {
  if (w.boss) return w.boss;
  if (w.dungeon?.battle) return w.dungeon.battle;
  return null;
}

export function summonBoss(w: World, bossId: number) {
  if (w.mode !== 'idle' && w.mode !== 'spawn') return;
  const def = BOSSES.find(b => b.id === bossId) ?? BOSSES[0];
  const sp = species(def.id);
  const lvl = 70;
  w.boss = {
    sid: def.id, name: def.name, emoji: def.emoji, types: sp.types,
    hp: 1, maxHp: 1, lvl,
    phase: 'joining', phaseUntil: w.time + 45_000,
    fighters: [], nextAt: 0, bigAt: 0, log: [], cheer: 0,
    lastMove: '', hitFlash: 0, room: false,
    reward: XP.boss,
  };
  recalcBossHp(w, w.boss);
  w.mode = 'boss';
  w.spawn = null;
  w.stats.battles++;
  cine(w, {
    kind: 'boss', title: `${def.emoji} ${def.name.toUpperCase()} APARECEU`,
    sub: 'Digite !battle no chat pra entrar na luta!',
    sid: def.id, shiny: false, color: '#FF6B6B', durationMs: 4000,
  });
  feed(w, '⚔️', `${def.name} foi invocado! Chat entra com !battle`, '#FF6B6B');
}

function startFight(w: World, b: BossState) {
  b.phase = 'fighting';
  recalcBossHp(w, b);
  b.nextAt = w.time + 1500;
  b.bigAt = w.time + 14_000;
  battleLog(b, `A batalha contra ${b.name} começou! ${b.fighters.length} treinadores.`, '#FFD24A');
}

function stepBattle(w: World, b: BossState) {
  if (b.phase === 'joining') {
    if (w.time >= b.phaseUntil) {
      if (b.fighters.length === 0) {
        b.phase = 'lost';
        b.phaseUntil = w.time + 4000;
        battleLog(b, 'Ninguém entrou na batalha…', 'rgba(255,255,255,0.4)');
        feed(w, '💤', `${b.name} foi embora — ninguém entrou.`, 'rgba(255,255,255,0.4)');
      } else startFight(w, b);
    }
    return;
  }
  if (b.phase !== 'fighting') return;

  const alive = b.fighters.filter(f => !f.down);
  if (alive.length === 0) { endBattle(w, b, false); return; }
  if (b.hp <= 0) { endBattle(w, b, true); return; }

  // ataques dos jogadores
  for (const f of alive) {
    if (w.time < f.nextAt) continue;
    const moves = movesFor(species(f.sid).types);
    const st = STYLES[f.style];
    f.charge = Math.min(100, f.charge + 14 * st.ultBias);
    let move = moves[0];
    if (f.charge >= 100) { move = moves[3]; f.charge = 0; }
    else if (Math.random() < 0.3) move = moves[2];
    else if (Math.random() < 0.45) move = moves[1];

    const { dmg, eff } = damageOf(f, move.power, move.type, b.types, 42 + b.lvl * 0.6, w);
    const cheerBonus = 1 + Math.min(0.5, b.cheer / 400);
    const final = Math.round(dmg * cheerBonus);
    b.hp -= final;
    b.hitFlash = w.time + 140;
    f.damage += final;
    f.lastMove = move.name;
    f.nextAt = w.time + f.interval * rnd(0.85, 1.15);

    const tr = pokeStore.get(f.nick);
    if (tr) { tr.damage += final; }

    if (move.slot === 'ult' || eff >= 2) {
      battleLog(b, `${f.display} usou ${move.name}${eff >= 2 ? ' — SUPER EFICAZ!' : ''} (${final})`,
        eff >= 2 ? '#7CFFB2' : '#FFD24A');
    }

    // suporte cura os feridos
    if (st.heal > 0) {
      const hurt = b.fighters.filter(x => !x.down && x.hp < x.maxHp * 0.7);
      if (hurt.length) {
        const target = hurt.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
        target.hp = Math.min(target.maxHp, target.hp + Math.round(target.maxHp * 0.07 * st.heal * 2));
      }
    }
    if (b.hp <= 0) { endBattle(w, b, true); return; }
  }

  // ataque do boss
  if (w.time >= b.nextAt) {
    const big = w.time >= b.bigAt;
    const moves = movesFor(b.types);
    const move = big ? moves[3] : pick([moves[0], moves[1], moves[2]]);
    const targets = big ? alive : alive.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(3, alive.length));
    for (const t of targets) {
      if (t.shieldUntil > w.time) { t.shieldUntil = 0; continue; }
      const eff = effectiveness(move.type, species(t.sid).types);
      const raw = (b.lvl * 2.6 + 34) * (move.power / 46) * eff / (1 + t.def / 70) * (big ? 1.5 : 1);
      const dmg = Math.max(1, Math.round(raw * rnd(0.85, 1.15)));
      t.hp -= dmg;
      t.hitFlash = w.time + 160;
      if (t.hp <= 0) {
        t.hp = 0; t.down = true;
        battleLog(b, `${t.display} caiu!`, '#FF6B6B');
      }
    }
    b.lastMove = move.name;
    if (big) {
      battleLog(b, `${b.name} usou ${move.name} em TODO MUNDO!`, '#FF6B6B');
      b.bigAt = w.time + rnd(13_000, 19_000);
    }
    b.nextAt = w.time + rnd(1500, 2200);
    b.cheer = Math.max(0, b.cheer - 6);
  }
}

function endBattle(w: World, b: BossState, won: boolean) {
  b.phase = won ? 'won' : 'lost';
  b.phaseUntil = w.time + (b.room ? 2600 : 6000);

  const ranked = [...b.fighters].sort((x, y) => y.damage - x.damage);
  for (const f of b.fighters) {
    const t = pokeStore.get(f.nick);
    if (!t) continue;
    const c = t.team.find(x => x.uid === f.uid) ?? null;
    const base = b.room ? XP.battle : won ? b.reward : Math.round(b.reward * 0.35);
    grantXp(w, t, c, base + (won && ranked[0]?.nick === f.nick ? 60 : 0), won ? 'boss derrotado' : 'batalha');
    mark(w, t, won ? 3 : 1);
    if (won) {
      t.wins++; t.streak++; t.bestStreak = Math.max(t.bestStreak, t.streak);
      if (c) c.wins++;
      if (!b.room && Math.random() < 0.4) {
        const drop: ItemKey = Math.random() < 0.6 ? 'greatball' : Math.random() < 0.7 ? 'ultraball' : 'candy';
        pokeStore.giveItem(t, drop, 1);
      }
    } else {
      t.streak = 0;
    }
  }
  pokeStore.touch();

  if (!b.room) {
    if (won) {
      w.stats.bossesDown++;
      const mvp = ranked[0];
      cine(w, {
        kind: 'victory', title: 'BOSS DERROTADO!',
        sub: mvp ? `MVP: ${mvp.display} com ${mvp.damage} de dano` : 'A comunidade venceu!',
        sid: b.sid, shiny: false, color: '#7CFFB2', durationMs: 5000,
      });
      feed(w, '🏆', `${b.name} caiu! ${b.fighters.length} treinadores levaram XP.`, '#7CFFB2');
    } else {
      cine(w, {
        kind: 'defeat', title: 'O TIME CAIU…',
        sub: `${b.name} venceu dessa vez. Bora de novo?`,
        sid: b.sid, shiny: false, color: '#FF6B6B', durationMs: 4200,
      });
      feed(w, '💀', `${b.name} derrotou o chat.`, '#FF6B6B');
    }
  }
}

/* ----------------------------------------------------------------- dungeon */

const DUNGEONS = [
  { name: 'CAVERNA DO MEWTWO', emoji: '🕳️', boss: 150, mobs: [95, 74, 41, 42, 24, 66] },
  { name: 'TORRE DO HO-OH', emoji: '🗼', boss: 250, mobs: [92, 93, 37, 58, 77, 126] },
  { name: 'FOSSO DO GROUDON', emoji: '🌋', boss: 383, mobs: [111, 104, 50, 27, 74, 105] },
  { name: 'ABISSO DO KYOGRE', emoji: '🌊', boss: 382, mobs: [72, 73, 90, 116, 118, 98] },
];

export function startDungeon(w: World, index = 0) {
  if (w.mode !== 'idle' && w.mode !== 'spawn') return;
  const d = DUNGEONS[index % DUNGEONS.length];
  const mobs = [...d.mobs].sort(() => Math.random() - 0.5);
  const rooms: DungeonRoom[] = [
    { kind: 'mob', sid: mobs[0], name: species(mobs[0]).name, cleared: false },
    { kind: 'mob', sid: mobs[1], name: species(mobs[1]).name, cleared: false },
    { kind: 'mini', sid: mobs[2], name: `${species(mobs[2]).name} Alfa`, cleared: false },
    { kind: 'mob', sid: mobs[3], name: species(mobs[3]).name, cleared: false },
    { kind: 'boss', sid: d.boss, name: species(d.boss).name, cleared: false },
  ];
  w.dungeon = {
    name: d.name, emoji: d.emoji, rooms, index: 0,
    phase: 'joining', phaseUntil: w.time + 45_000,
    party: [], battle: null,
  };
  w.mode = 'dungeon';
  w.spawn = null;
  cine(w, {
    kind: 'boss', title: `${d.emoji} ${d.name}`,
    sub: 'Digite !join pra entrar na expedição!',
    sid: d.boss, shiny: false, color: '#B45CD8', durationMs: 4200,
  });
  feed(w, '🕯️', `${d.name} aberta — chat entra com !join`, '#B45CD8');
}

function dungeonRoomBattle(w: World, d: DungeonState): BossState {
  const room = d.rooms[d.index];
  const sp = species(room.sid);
  const lvl = room.kind === 'boss' ? 70 : room.kind === 'mini' ? 45 : 30;
  const b: BossState = {
    sid: room.sid, name: room.name, emoji: room.kind === 'boss' ? '👑' : room.kind === 'mini' ? '💀' : '🐾',
    types: sp.types, hp: 1, maxHp: 1, lvl,
    phase: 'fighting', phaseUntil: 0,
    fighters: [], nextAt: w.time + 1400, bigAt: w.time + 12_000,
    log: [], cheer: 0, lastMove: '', hitFlash: 0,
    room: room.kind !== 'boss',
    reward: room.kind === 'boss' ? XP.dungeon : XP.battle,
  };
  for (const nick of d.party) {
    const t = pokeStore.get(nick);
    if (!t) continue;
    const c = pokeStore.fighterOf(t);
    if (!c) continue;
    b.fighters.push(makeFighter(t, c, w));
  }
  recalcBossHp(w, b);
  battleLog(b, `Sala ${d.index + 1}/${d.rooms.length}: ${room.name}`, '#B45CD8');
  return b;
}

function stepDungeon(w: World, d: DungeonState) {
  if (d.phase === 'joining') {
    if (w.time >= d.phaseUntil) {
      if (d.party.length === 0) {
        d.phase = 'lost'; d.phaseUntil = w.time + 3500;
        feed(w, '💤', 'Ninguém entrou na dungeon.', 'rgba(255,255,255,0.4)');
      } else {
        d.phase = 'running';
        d.battle = dungeonRoomBattle(w, d);
        w.stats.battles++;
      }
    }
    return;
  }
  if (d.phase !== 'running' || !d.battle) return;

  stepBattle(w, d.battle);
  const b = d.battle;
  if (b.phase === 'won' && w.time >= b.phaseUntil) {
    d.rooms[d.index].cleared = true;
    if (d.index >= d.rooms.length - 1) {
      d.phase = 'won'; d.phaseUntil = w.time + 6000;
      cine(w, {
        kind: 'victory', title: 'DUNGEON CONCLUÍDA!',
        sub: `${d.party.length} treinadores limparam ${d.name}`,
        sid: d.rooms[d.rooms.length - 1].sid, shiny: false, color: '#B45CD8', durationMs: 5200,
      });
      feed(w, '🏆', `${d.name} concluída!`, '#B45CD8');
      for (const nick of d.party) {
        const t = pokeStore.get(nick);
        if (t) pokeStore.giveItem(t, Math.random() < 0.5 ? 'ultraball' : 'candy', 1);
      }
      d.battle = null;
    } else {
      d.index++;
      d.battle = dungeonRoomBattle(w, d);
      feed(w, '🚪', `Time avançou para ${d.rooms[d.index].name}`, '#B45CD8');
    }
  } else if (b.phase === 'lost' && w.time >= b.phaseUntil) {
    d.phase = 'lost'; d.phaseUntil = w.time + 5000;
    cine(w, {
      kind: 'defeat', title: 'EXPEDIÇÃO FRACASSOU',
      sub: `O time caiu na sala ${d.index + 1} de ${d.rooms.length}`,
      sid: b.sid, shiny: false, color: '#FF6B6B', durationMs: 4200,
    });
    feed(w, '💀', `Time caiu em ${d.name}.`, '#FF6B6B');
    d.battle = null;
  }
}

/* ---------------------------------------------------------------- torneio */

export function startTournament(w: World, size = 16): boolean {
  if (w.mode !== 'idle' && w.mode !== 'spawn') return false;
  const pool = [...pokeStore.trainers.values()].filter(t => t.team.length > 0);
  if (pool.length < 2) return false;

  const chosen = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(size, pool.length));
  const entrants: Entrant[] = chosen.map(t => {
    const c = pokeStore.fighterOf(t)!;
    return {
      nick: t.nick, display: t.display, color: t.color,
      sid: c.sid, lvl: c.lvl, shiny: c.shiny, power: scoreCreature(c),
    };
  });

  // completa com "byes" até a potência de 2
  let slots = 2;
  while (slots < entrants.length) slots *= 2;
  const seeded: (Entrant | null)[] = [...entrants];
  while (seeded.length < slots) seeded.push(null);

  const first: Match[] = [];
  for (let i = 0; i < slots; i += 2) {
    first.push({ a: seeded[i], b: seeded[i + 1], winner: null, hpA: 100, hpB: 100, done: false });
  }
  const rounds: Match[][] = [first];
  let n = first.length;
  while (n > 1) {
    n = Math.ceil(n / 2);
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null, hpA: 100, hpB: 100, done: false })));
  }

  w.tournament = {
    phase: 'running', rounds, roundIndex: 0, matchIndex: 0,
    nextAt: w.time + 1500, champion: null, lastHit: '',
  };
  w.mode = 'tournament';
  w.spawn = null;
  cine(w, {
    kind: 'event', title: '🏆 CAMPEONATO', sub: `${entrants.length} treinadores no chaveamento`,
    sid: null, shiny: false, color: '#FFD24A', durationMs: 3800,
  });
  feed(w, '🏆', `Campeonato começou com ${entrants.length} treinadores.`, '#FFD24A');
  return true;
}

function stepTournament(w: World, tn: TournamentState) {
  if (tn.phase !== 'running' || w.time < tn.nextAt) return;
  const round = tn.rounds[tn.roundIndex];
  const m = round[tn.matchIndex];

  if (!m) { advanceTournament(w, tn); return; }

  // bye automático
  if (!m.a || !m.b) {
    m.winner = m.a ?? m.b;
    m.done = true;
    tn.nextAt = w.time + 250;
    advanceTournament(w, tn);
    return;
  }

  // troca de golpes até alguém zerar
  const pa = m.a.power, pb = m.b.power;
  const ta = species(m.a.sid).types, tb = species(m.b.sid).types;
  const effA = effectiveness(ta[0], tb), effB = effectiveness(tb[0], ta);
  const dmgA = Math.max(3, (pa / pb) * 9 * Math.max(0.5, effA) * rnd(0.7, 1.3));
  const dmgB = Math.max(3, (pb / pa) * 9 * Math.max(0.5, effB) * rnd(0.7, 1.3));
  m.hpB -= dmgA; m.hpA -= dmgB;
  tn.lastHit = `${m.a.display} × ${m.b.display}`;
  tn.nextAt = w.time + 520;

  if (m.hpA <= 0 || m.hpB <= 0) {
    m.hpA = Math.max(0, m.hpA); m.hpB = Math.max(0, m.hpB);
    m.winner = m.hpA > m.hpB ? m.a : m.b;
    m.done = true;
    const loser = m.winner === m.a ? m.b : m.a;
    const wt = pokeStore.get(m.winner.nick);
    if (wt) {
      wt.wins++; wt.streak++; wt.bestStreak = Math.max(wt.bestStreak, wt.streak);
      const c = wt.team.find(x => x.sid === m.winner!.sid);
      grantXp(w, wt, c ?? null, XP.battle, 'torneio');
    }
    const lt = pokeStore.get(loser.nick);
    if (lt) { lt.streak = 0; pokeStore.addTrainerXp(lt, Math.round(XP.assist * xpMult(w))); }
    feed(w, '⚔️', `${m.winner.display} venceu ${loser.display}`, '#FFD24A');
    tn.nextAt = w.time + 900;
    advanceTournament(w, tn);
  }
}

function advanceTournament(w: World, tn: TournamentState) {
  const round = tn.rounds[tn.roundIndex];
  if (tn.matchIndex < round.length - 1) { tn.matchIndex++; return; }

  // fim da rodada → semeia a próxima
  if (tn.roundIndex >= tn.rounds.length - 1) {
    const champ = round[0].winner;
    tn.champion = champ;
    tn.phase = 'done';
    tn.nextAt = w.time + 14_000;  // tempo do pódio antes de voltar pro mapa
    if (champ) {
      const t = pokeStore.get(champ.nick);
      if (t) {
        const c = t.team.find(x => x.sid === champ.sid) ?? null;
        grantXp(w, t, c, XP.tournament, 'campeão');
        pokeStore.giveItem(t, 'masterball', 1);
      }
      cine(w, {
        kind: 'champion', title: `🏆 ${t?.display ?? champ.display} É O CAMPEÃO!`,
        sub: `${species(champ.sid).name} Lv ${champ.lvl} · +1 Master Ball`,
        sid: champ.sid, shiny: champ.shiny, color: '#FFD24A', durationMs: 6000,
      });
      feed(w, '👑', `${champ.display} é o campeão do torneio!`, '#FFD24A');
    }
    return;
  }

  const next = tn.rounds[tn.roundIndex + 1];
  for (let i = 0; i < next.length; i++) {
    next[i].a = round[i * 2]?.winner ?? null;
    next[i].b = round[i * 2 + 1]?.winner ?? null;
  }
  tn.roundIndex++;
  tn.matchIndex = 0;
  tn.nextAt = w.time + 1400;
}

/* -------------------------------------------------------- controles do host */

export function setWeather(w: World, key: WeatherKey, durationMs = 10 * 60_000) {
  w.weather = key;
  w.weatherUntil = key === 'clear' ? 0 : w.time + durationMs;
  const d = WEATHER[key];
  feed(w, d.emoji, `Clima mudou: ${d.label}`, d.color);
  if (key !== 'clear') {
    cine(w, { kind: 'event', title: `${d.emoji} ${d.label}`, sub: d.desc, sid: null, shiny: false, color: d.color, durationMs: 2600 });
  }
}

export function setEvent(w: World, key: EventKey | null, durationMs = 8 * 60_000) {
  w.event = key;
  w.eventUntil = key ? w.time + durationMs : 0;
  if (key) {
    const d = EVENTS[key];
    feed(w, d.emoji, `${d.label} iniciado — ${d.desc}`, d.color);
    cine(w, { kind: 'event', title: `${d.emoji} ${d.label}`, sub: d.desc, sid: null, shiny: false, color: d.color, durationMs: 3200 });
    scheduleNextSpawn(w);
  } else {
    feed(w, '🛑', 'Evento encerrado.', 'rgba(255,255,255,0.5)');
  }
}

export function ballRain(w: World, key: ItemKey = 'pokeball', qty = 1) {
  const n = pokeStore.giveItemToAll(key === 'pokeball' ? 'greatball' : key, qty, 3 * 60 * 60_000);
  w.ballRainUntil = w.time + 9000;
  const item = ITEMS[key === 'pokeball' ? 'greatball' : key];
  feed(w, '🎁', `Chuva de ${item.label}! ${n} treinadores receberam ${qty}.`, item.color);
  cine(w, {
    kind: 'event', title: '🎁 CHUVA DE POKÉBOLAS',
    sub: `${n} treinadores ganharam ${qty}× ${item.label}`,
    sid: null, shiny: false, color: item.color, durationMs: 3400,
  });
}

export function endEverything(w: World) {
  w.spawn = null; w.boss = null; w.dungeon = null; w.tournament = null;
  w.event = null; w.eventUntil = 0;
  w.doubleXp = false; w.doubleShiny = false;
  w.mode = 'idle';
  feed(w, '🛑', 'Tudo encerrado — voltando ao mapa.', 'rgba(255,255,255,0.5)');
}

/* -------------------------------------------------------------------- passo */

export function stepWorld(w: World, dtMs: number) {
  const dt = Math.min(dtMs, 120);
  w.time += dt;

  if (w.weatherUntil && w.time >= w.weatherUntil) setWeather(w, 'clear');
  if (w.event && w.eventUntil && w.time >= w.eventUntil) setEvent(w, null);

  // cinemáticas em fila
  if (w.cine.length) {
    const head = w.cine[0];
    if (head.until === 0) head.until = w.time + head.durationMs;
    else if (w.time >= head.until) w.cine.shift();
  }
  // consultas de !pokedex entram em fila: cada cartão só começa a contar quando
  // chega à frente, senão os seguintes já nasceriam vencidos e piscariam na tela
  if (w.cards.length) {
    const card = w.cards[0];
    if (card.until === 0) card.until = w.time + 6000;
    else if (w.time >= card.until) w.cards.shift();
  }

  switch (w.mode) {
    case 'spawn': {
      const s = w.spawn;
      if (!s) { w.mode = 'idle'; break; }
      if (s.phase === 'appearing' && w.time >= s.phaseUntil) s.phase = 'open';
      else if (s.phase === 'open' && w.time >= s.endsAt) resolveCapture(w);
      else if (s.phase === 'wobble' && w.time >= s.phaseUntil) {
        s.wobbles++;
        if (s.wobbles >= 3) completeCapture(w);
        else s.phaseUntil = w.time + 750;
      } else if ((s.phase === 'caught' || s.phase === 'fled') && w.time >= s.phaseUntil) {
        w.spawn = null; w.mode = 'idle';
      }
      break;
    }
    case 'boss': {
      const b = w.boss;
      if (!b) { w.mode = 'idle'; break; }
      stepBattle(w, b);
      if ((b.phase === 'won' || b.phase === 'lost') && w.time >= b.phaseUntil) {
        w.boss = null; w.mode = 'idle';
      }
      break;
    }
    case 'dungeon': {
      const d = w.dungeon;
      if (!d) { w.mode = 'idle'; break; }
      stepDungeon(w, d);
      if ((d.phase === 'won' || d.phase === 'lost') && w.time >= d.phaseUntil) {
        w.dungeon = null; w.mode = 'idle';
      }
      break;
    }
    case 'tournament': {
      const tn = w.tournament;
      if (!tn) { w.mode = 'idle'; break; }
      stepTournament(w, tn);
      if (tn.phase === 'done' && w.time >= tn.nextAt) { w.tournament = null; w.mode = 'idle'; }
      break;
    }
    default: {
      if (w.autoSpawn && w.time >= w.nextSpawnAt) spawnPokemon(w);
    }
  }
}

/* --------------------------------------------------------------- chat --- */

const SUPPORT_CD = 45_000;

export interface ChatIn { username: string; text: string; color: string; source: Source; }

export function applyMessage(w: World, msg: ChatIn) {
  const raw = msg.text.trim();
  w.stats.messages++;
  if (!raw.startsWith('!')) return;

  const [cmdRaw, ...rest] = raw.slice(1).split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/[^\wáéíóúâêôãõç]/gi, '');
  const arg = rest.join(' ');
  if (!cmd) return;

  const nick = normNick(msg.username);
  w.active.set(nick, w.time);
  w.stats.commands++;

  /* --- captura --- */
  const ball = BALL_COMMANDS[cmd];
  if (ball) {
    const s = w.spawn;
    if (!s || s.phase !== 'open') return;
    if (s.entries.has(nick)) return;
    const t = pokeStore.ensure(msg.username, msg.source, msg.color);
    const usable = pokeStore.useItem(t, ball) ? ball : 'pokeball';
    s.entries.set(nick, {
      nick, display: t.display, color: t.color, source: msg.source,
      ball: usable, at: w.time,
    });
    mark(w, t, 1);
    return;
  }

  /* --- entrar em batalha / dungeon --- */
  if (cmd === 'battle' || cmd === 'fight' || cmd === 'lutar' || cmd === 'batalha') {
    const t = pokeStore.ensure(msg.username, msg.source, msg.color);
    const r = joinBattle(w, t);
    if (r === 'no-team') feed(w, '❔', `${t.display} tentou lutar mas não tem nenhum Pokémon.`, 'rgba(255,255,255,0.35)');
    else if (r === 'ok') feed(w, '⚔️', `${t.display} entrou na batalha!`, t.color);
    return;
  }

  if (cmd === 'join' || cmd === 'entrardungeon' || cmd === 'expedicao') {
    const d = w.dungeon;
    if (d && d.phase === 'joining') {
      const t = pokeStore.ensure(msg.username, msg.source, msg.color);
      if (!pokeStore.fighterOf(t)) return;
      if (!d.party.includes(t.nick)) {
        d.party.push(t.nick);
        mark(w, t, 2);
        feed(w, '🕯️', `${t.display} entrou na expedição (${d.party.length})`, '#B45CD8');
      }
      return;
    }
    // fora da dungeon, !join também serve pra batalha
    const t = pokeStore.ensure(msg.username, msg.source, msg.color);
    joinBattle(w, t);
    return;
  }

  /* --- favorito / estilo --- */
  if (cmd === 'favorite' || cmd === 'favorito' || cmd === 'fav') {
    const t = pokeStore.get(nick);
    if (!t) return;
    const c = pokeStore.setFavoriteByName(t, arg);
    if (c) feed(w, '⭐', `${t.display} escolheu ${species(c.sid).name} como favorito.`, t.color);
    return;
  }

  if (cmd === 'style' || cmd === 'estilo') {
    const t = pokeStore.get(nick);
    if (!t) return;
    const key = STYLE_ALIASES[arg.trim().toLowerCase()];
    if (!key) return;
    pokeStore.setStyle(t, key);
    feed(w, STYLES[key].emoji, `${t.display} mudou o estilo para ${STYLES[key].label}.`, STYLES[key].color);
    return;
  }

  /* --- comandos de suporte no combate --- */
  const support = SUPPORT[cmd];
  if (support) {
    const b = activeBattle(w);
    if (!b || b.phase !== 'fighting') return;
    const t = pokeStore.get(nick);
    if (!t) return;
    const cd = w.supportCd.get(`${nick}:${support.key}`) ?? 0;
    if (w.time < cd) return;
    w.supportCd.set(`${nick}:${support.key}`, w.time + SUPPORT_CD);
    support.apply(w, b, t);
    mark(w, t, 1);
    return;
  }

  /* --- consultas na tela --- */
  if (cmd === 'pokedex' || cmd === 'time' || cmd === 'equipe' || cmd === 'meupokemon') {
    const t = pokeStore.get(nick);
    if (!t) return;
    if (w.cards.some(c => c.nick === t.nick)) return;
    if (w.cards.length > 4) return;
    w.cards.push({ nick: t.nick, until: 0 });
    return;
  }
}

interface SupportDef { key: string; apply: (w: World, b: BossState, t: Trainer) => void; }

const SUPPORT: Record<string, SupportDef> = {};
function reg(names: string[], key: string, apply: SupportDef['apply']) {
  for (const n of names) SUPPORT[n] = { key, apply };
}

reg(['heal', 'cura', 'curar'], 'heal', (w, b, t) => {
  const hurt = b.fighters.filter(f => !f.down && f.hp < f.maxHp);
  const revive = b.fighters.filter(f => f.down);
  if (revive.length && (t.items.potion ?? 0) > 0) {
    const f = pick(revive);
    pokeStore.useItem(t, 'potion');
    f.down = false; f.hp = Math.round(f.maxHp * 0.5);
    battleLog(b, `${t.display} usou uma Poção e reviveu ${f.display}!`, '#7CFFB2');
    return;
  }
  if (!hurt.length) return;
  const f = hurt.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.22));
  battleLog(b, `${t.display} curou ${f.display}`, '#7CFFB2');
});

reg(['shield', 'escudo', 'proteger'], 'shield', (w, b, t) => {
  const own = b.fighters.find(f => f.nick === t.nick && !f.down);
  const target = own ?? pick(b.fighters.filter(f => !f.down) as Fighter[]);
  if (!target) return;
  target.shieldUntil = w.time + 20_000;
  battleLog(b, `${t.display} colocou um escudo em ${target.display}`, '#4FA3FF');
});

reg(['rage', 'furia', 'fúria'], 'rage', (w, b, t) => {
  const own = b.fighters.find(f => f.nick === t.nick && !f.down);
  if (!own) return;
  own.rageUntil = w.time + 12_000;
  battleLog(b, `${t.display} entrou em FÚRIA (+60% de dano)`, '#FF6B6B');
});

reg(['boost', 'turbo'], 'boost', (w, b, t) => {
  const alive = b.fighters.filter(f => !f.down);
  if (!alive.length) return;
  const target = alive.sort((a, c) => c.damage - a.damage)[0];
  target.boostUntil = w.time + 14_000;
  battleLog(b, `${t.display} deu turbo em ${target.display}`, '#FFD24A');
});

reg(['cheer', 'torcer', 'torcida', 'vai'], 'cheer', (_w, b) => {
  b.cheer = Math.min(400, b.cheer + 12);
  if (b.cheer % 60 < 12) battleLog(b, `A torcida está gritando! (+${Math.round(Math.min(50, b.cheer / 8))}% de dano)`, '#FF9EC4');
});

export const SUPPORT_COMMANDS = [
  { cmd: '!heal', label: 'CURA', emoji: '💚', desc: 'Cura o aliado mais ferido (ou revive com Poção).' },
  { cmd: '!shield', label: 'ESCUDO', emoji: '🛡️', desc: 'Bloqueia o próximo golpe do boss.' },
  { cmd: '!rage', label: 'FÚRIA', emoji: '🔥', desc: '+60% de dano no seu Pokémon por 12s.' },
  { cmd: '!boost', label: 'TURBO', emoji: '⚡', desc: '+30% de dano em quem mais está batendo.' },
  { cmd: '!cheer', label: 'TORCIDA', emoji: '📣', desc: 'Torcida coletiva: aumenta o dano de todos.' },
];

/* ------------------------------------------------------------- helpers UI */

export function captureRemainMs(w: World): number {
  const s = w.spawn;
  if (!s || s.phase !== 'open') return 0;
  return Math.max(0, s.endsAt - w.time);
}

export function joinRemainMs(w: World): number {
  const b = w.boss;
  if (b && b.phase === 'joining') return Math.max(0, b.phaseUntil - w.time);
  const d = w.dungeon;
  if (d && d.phase === 'joining') return Math.max(0, d.phaseUntil - w.time);
  return 0;
}

export function currentCine(w: World): Cinematic | null {
  return w.cine[0] ?? null;
}

export function cineArt(c: Cinematic): string | null {
  return c.sid == null ? null : artworkUrl(c.sid);
}

export function activeCount(w: World, windowMs = 15 * 60_000): number {
  let n = 0;
  for (const t of w.active.values()) if (w.time - t <= windowMs) n++;
  return n;
}
