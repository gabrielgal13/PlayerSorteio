/* ============================================================================
 * POKÉARENA LIVE — treinadores persistentes
 *
 * O espectador não tem login: a identidade é o nickname do chat. Todo o
 * progresso (equipe, níveis, itens, estatísticas) fica salvo por streamer e
 * volta exatamente de onde parou na live seguinte.
 *
 * Persistência em dois níveis:
 *   1. localStorage  — instantâneo, sobrevive a refresh e funciona offline;
 *   2. /api/streamer/pokearena — servidor, sobrevive a troca de máquina.
 * Se a API falhar (ex.: migration ainda não rodada) o jogo continua rodando
 * normalmente só com o localStorage.
 * ========================================================================== */
'use client';
import {
  ITEMS, MAX_LEVEL, TEAM_LIMIT, species, xpToNext,
  type ItemKey, type StyleKey,
} from './data';

export type Source = 'twitch' | 'kick' | 'youtube';

export interface Creature {
  uid: string;
  sid: number;       // species id
  lvl: number;
  xp: number;
  shiny: boolean;
  style: StyleKey;
  caughtAt: number;
  wins: number;
}

export interface Trainer {
  nick: string;      // chave em minúsculas
  display: string;
  source: Source;
  color: string;
  xp: number;
  lvl: number;
  captures: number;
  shinies: number;
  legendaries: number;
  battles: number;
  wins: number;
  damage: number;
  streak: number;
  bestStreak: number;
  items: Partial<Record<ItemKey, number>>;
  team: Creature[];
  favorite: string | null;   // uid
  style: StyleKey;
  firstSeen: number;
  lastSeen: number;
}

export interface Dex {
  seen: number[];
  caught: number[];
  shiny: number[];
  legendary: number[];
}

interface SaveBlob {
  v: 1;
  trainers: Trainer[];
  dex: Dex;
  savedAt: number;
}

const MAX_TRAINERS = 4000;
const PRUNE_AFTER_MS = 120 * 24 * 60 * 60 * 1000; // 120 dias sem aparecer

let uidSeq = 0;
function newUid(): string {
  uidSeq += 1;
  return `${Date.now().toString(36)}${uidSeq.toString(36)}`;
}

export function normNick(name: string): string {
  return name.trim().toLowerCase().replace(/^@/, '');
}

function emptyTrainer(display: string, source: Source, color: string): Trainer {
  const now = Date.now();
  return {
    nick: normNick(display), display: display.trim(), source, color,
    xp: 0, lvl: 1, captures: 0, shinies: 0, legendaries: 0,
    battles: 0, wins: 0, damage: 0, streak: 0, bestStreak: 0,
    items: { greatball: 0, ultraball: 0, masterball: 0, candy: 0, stone: 0, potion: 0 },
    team: [], favorite: null, style: 'attack',
    firstSeen: now, lastSeen: now,
  };
}

/* ------------------------------------------------------------------------- */

class PokeArenaStore {
  trainers = new Map<string, Trainer>();
  dex: Dex = { seen: [], caught: [], shiny: [], legendary: [] };
  loaded = false;
  syncing = false;
  lastError: string | null = null;
  /** Sobe a cada alteração — a UI usa pra saber que precisa re-renderizar. */
  version = 0;

  private streamer = 'anon';
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  private get lsKey() { return `pokearena:${this.streamer}`; }

  /* ------------------------------------------------------------ carga --- */

  async load(streamerUsername: string | undefined) {
    this.streamer = (streamerUsername || 'anon').toLowerCase();
    this.loaded = false;

    // 1) local primeiro — a tela abre já populada
    try {
      const raw = localStorage.getItem(this.lsKey);
      if (raw) this.hydrate(JSON.parse(raw) as SaveBlob);
    } catch { /* blob corrompido: começa limpo */ }

    // 2) servidor por cima, se for mais recente
    try {
      const res = await fetch('/api/streamer/pokearena');
      if (res.ok) {
        const body = await res.json() as { data: SaveBlob | null };
        if (body.data && body.data.trainers) {
          const localAt = this.lastSavedAt;
          if (!localAt || (body.data.savedAt ?? 0) >= localAt) this.hydrate(body.data);
        }
      }
    } catch {
      this.lastError = 'servidor indisponível — salvando só neste navegador';
    }

    this.loaded = true;
    this.version++;
  }

  private lastSavedAt = 0;

  private hydrate(blob: SaveBlob) {
    this.trainers = new Map();
    for (const t of blob.trainers ?? []) {
      const fixed: Trainer = {
        ...emptyTrainer(t.display || t.nick, t.source || 'twitch', t.color || '#00E5FF'),
        ...t,
        nick: normNick(t.nick || t.display),
        items: { ...t.items },
        team: (t.team ?? []).map(c => ({ ...c, style: c.style ?? 'attack' })),
      };
      this.trainers.set(fixed.nick, fixed);
    }
    this.dex = {
      seen: blob.dex?.seen ?? [], caught: blob.dex?.caught ?? [],
      shiny: blob.dex?.shiny ?? [], legendary: blob.dex?.legendary ?? [],
    };
    this.lastSavedAt = blob.savedAt ?? 0;
  }

  /* ------------------------------------------------------------ salvar --- */

  private serialize(): SaveBlob {
    let list = [...this.trainers.values()];
    if (list.length > MAX_TRAINERS) {
      const cutoff = Date.now() - PRUNE_AFTER_MS;
      const active = list.filter(t => t.lastSeen >= cutoff || t.team.length > 0);
      list = (active.length > 0 ? active : list)
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, MAX_TRAINERS);
    }
    return { v: 1, trainers: list, dex: this.dex, savedAt: Date.now() };
  }

  /** Marca alteração; grava local na hora e manda pro servidor com debounce. */
  touch() {
    this.version++;
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; void this.flush(); }, 4000);
  }

  async flush() {
    if (!this.dirty || !this.loaded) return;
    this.dirty = false;
    const blob = this.serialize();
    this.lastSavedAt = blob.savedAt;
    try { localStorage.setItem(this.lsKey, JSON.stringify(blob)); } catch { /* cota cheia */ }
    this.syncing = true;
    try {
      const res = await fetch('/api/streamer/pokearena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: blob }),
      });
      this.lastError = res.ok ? null : 'não deu pra salvar no servidor';
    } catch {
      this.lastError = 'servidor indisponível — salvando só neste navegador';
    } finally {
      this.syncing = false;
    }
  }

  /* --------------------------------------------------------- treinador --- */

  get(nickRaw: string): Trainer | undefined {
    return this.trainers.get(normNick(nickRaw));
  }

  ensure(display: string, source: Source, color: string): Trainer {
    const nick = normNick(display);
    let t = this.trainers.get(nick);
    if (!t) {
      t = emptyTrainer(display, source, color);
      this.trainers.set(nick, t);
      this.touch();
    }
    t.lastSeen = Date.now();
    if (display.trim()) t.display = display.trim();
    if (color) t.color = color;
    t.source = source;
    return t;
  }

  /** Soma XP no treinador e devolve quantos níveis ele subiu. */
  addTrainerXp(t: Trainer, amount: number): number {
    t.xp += Math.max(0, Math.round(amount));
    let ups = 0;
    while (t.lvl < MAX_LEVEL && t.xp >= xpToNext(t.lvl)) {
      t.xp -= xpToNext(t.lvl);
      t.lvl++; ups++;
    }
    this.touch();
    return ups;
  }

  /** Soma XP no Pokémon e devolve os níveis ganhos. */
  addCreatureXp(c: Creature, amount: number): number {
    c.xp += Math.max(0, Math.round(amount));
    let ups = 0;
    while (c.lvl < MAX_LEVEL && c.xp >= xpToNext(c.lvl)) {
      c.xp -= xpToNext(c.lvl);
      c.lvl++; ups++;
    }
    if (ups) this.touch();
    return ups;
  }

  addCreature(t: Trainer, sid: number, lvl: number, shiny: boolean): Creature {
    const c: Creature = {
      uid: newUid(), sid, lvl: Math.max(1, lvl), xp: 0, shiny,
      style: t.style, caughtAt: Date.now(), wins: 0,
    };
    t.team.push(c);
    if (t.team.length > TEAM_LIMIT) {
      // mantém os mais fortes + shinies + lendários
      t.team.sort((a, b) => scoreCreature(b) - scoreCreature(a));
      t.team = t.team.slice(0, TEAM_LIMIT);
    }
    if (!t.favorite) t.favorite = c.uid;
    t.captures++;
    if (shiny) t.shinies++;
    if (species(sid).legendary) t.legendaries++;
    this.markDex(sid, { caught: true, shiny });
    this.touch();
    return c;
  }

  /** Pokémon que entra em batalha: o favorito, senão o mais forte. */
  fighterOf(t: Trainer): Creature | null {
    if (t.team.length === 0) return null;
    if (t.favorite) {
      const fav = t.team.find(c => c.uid === t.favorite);
      if (fav) return fav;
    }
    return [...t.team].sort((a, b) => scoreCreature(b) - scoreCreature(a))[0];
  }

  /** `!favorite <nome>` — casa por prefixo, devolve o escolhido. */
  setFavoriteByName(t: Trainer, nameRaw: string): Creature | null {
    const q = nameRaw.trim().toLowerCase();
    if (!q) return null;
    const matches = t.team.filter(c => species(c.sid).name.toLowerCase().startsWith(q));
    const pick = (matches.length ? matches : t.team.filter(c => species(c.sid).name.toLowerCase().includes(q)))
      .sort((a, b) => scoreCreature(b) - scoreCreature(a))[0];
    if (!pick) return null;
    t.favorite = pick.uid;
    this.touch();
    return pick;
  }

  setStyle(t: Trainer, style: StyleKey) {
    t.style = style;
    const fav = this.fighterOf(t);
    if (fav) fav.style = style;
    this.touch();
  }

  giveItem(t: Trainer, key: ItemKey, qty = 1) {
    if (ITEMS[key] === undefined) return;
    t.items[key] = (t.items[key] ?? 0) + qty;
    this.touch();
  }

  /** Consome 1 unidade; pokébola comum é infinita. */
  useItem(t: Trainer, key: ItemKey): boolean {
    if (key === 'pokeball') return true;
    const have = t.items[key] ?? 0;
    if (have <= 0) return false;
    t.items[key] = have - 1;
    this.touch();
    return true;
  }

  giveItemToAll(key: ItemKey, qty: number, onlyActiveSinceMs?: number) {
    const cutoff = onlyActiveSinceMs ? Date.now() - onlyActiveSinceMs : 0;
    let n = 0;
    for (const t of this.trainers.values()) {
      if (t.lastSeen < cutoff) continue;
      t.items[key] = (t.items[key] ?? 0) + qty;
      n++;
    }
    this.touch();
    return n;
  }

  /* ------------------------------------------------------------ pokédex --- */

  markDex(sid: number, opts: { caught?: boolean; shiny?: boolean } = {}) {
    if (!this.dex.seen.includes(sid)) this.dex.seen.push(sid);
    if (opts.caught && !this.dex.caught.includes(sid)) this.dex.caught.push(sid);
    if (opts.shiny && !this.dex.shiny.includes(sid)) this.dex.shiny.push(sid);
    if (species(sid).legendary && opts.caught && !this.dex.legendary.includes(sid)) {
      this.dex.legendary.push(sid);
    }
    this.touch();
  }

  /* ----------------------------------------------------------- rankings --- */

  ranking(kind: RankKind, limit = 50): Trainer[] {
    const list = [...this.trainers.values()].filter(t => t.captures > 0 || t.battles > 0);
    const key = RANK_SORT[kind];
    return list.sort((a, b) => key(b) - key(a)).slice(0, limit);
  }

  reset() {
    this.trainers = new Map();
    this.dex = { seen: [], caught: [], shiny: [], legendary: [] };
    this.touch();
  }
}

/** Força relativa de um Pokémon — usada em ordenação e como base de combate. */
export function scoreCreature(c: Creature): number {
  const sp = species(c.sid);
  return sp.power + c.lvl * 4.5 + (c.shiny ? 12 : 0) + c.wins * 1.5;
}

export type RankKind = 'level' | 'captures' | 'shinies' | 'legendaries' | 'wins' | 'damage' | 'streak';

export const RANK_SORT: Record<RankKind, (t: Trainer) => number> = {
  level: t => t.lvl * 1e6 + t.xp,
  captures: t => t.captures,
  shinies: t => t.shinies,
  legendaries: t => t.legendaries,
  wins: t => t.wins,
  damage: t => t.damage,
  streak: t => t.bestStreak,
};

export const RANK_LABEL: Record<RankKind, { label: string; emoji: string }> = {
  level: { label: 'MAIOR NÍVEL', emoji: '⭐' },
  captures: { label: 'MAIS CAPTURAS', emoji: '🏅' },
  shinies: { label: 'MAIS SHINYS', emoji: '✨' },
  legendaries: { label: 'MAIS LENDÁRIOS', emoji: '👑' },
  wins: { label: 'MAIS VITÓRIAS', emoji: '🏆' },
  damage: { label: 'MAIS DANO', emoji: '💥' },
  streak: { label: 'MAIOR SEQUÊNCIA', emoji: '🔥' },
};

export const pokeStore = new PokeArenaStore();
