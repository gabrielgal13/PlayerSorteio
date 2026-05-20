export interface GameParticipant {
  name: string;
  source: 'twitch' | 'kick' | 'youtube';
  timestamp: number;
}

export interface GameGuess {
  name: string;
  source: 'twitch' | 'kick' | 'youtube';
  text: string;
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
  timestamp: number;
}

export type GameEvent =
  | { type: 'participant_add'; participant: GameParticipant }
  | { type: 'guess_add'; guess: GameGuess }
  | { type: 'guesses_clear' }
  | { type: 'round_start' }
  | { type: 'round_end' };

// ── In-memory store (single Node.js process) ──────────────────────────────────
const participants: GameParticipant[] = [];
const guesses = new Map<string, GameGuess>();
let acceptingGuesses = false;
const listeners = new Set<(e: GameEvent) => void>();

function emit(e: GameEvent) {
  listeners.forEach(fn => fn(e));
}

export function subscribe(fn: (e: GameEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Participants ──────────────────────────────────────────────────────────────
export function addParticipant(
  name: string,
  source: 'twitch' | 'kick' | 'youtube',
): GameParticipant | null {
  if (participants.some(p => p.name.toLowerCase() === name.toLowerCase())) return null;
  const p: GameParticipant = { name, source, timestamp: Date.now() };
  participants.push(p);
  emit({ type: 'participant_add', participant: p });
  return p;
}

export function getParticipants(): GameParticipant[] {
  return [...participants];
}

export function clearParticipants() {
  participants.length = 0;
}

export function isParticipant(name: string): boolean {
  return participants.some(p => p.name.toLowerCase() === name.toLowerCase());
}

// ── Guesses ───────────────────────────────────────────────────────────────────
export function addGuess(
  name: string,
  source: 'twitch' | 'kick' | 'youtube',
  text: string,
  lat: number | null,
  lng: number | null,
): GameGuess | null {
  if (!acceptingGuesses) return null;
  const key = name.toLowerCase();
  if (guesses.has(key)) return null; // one guess per round
  const g: GameGuess = { name, source, text, lat, lng, geocoded: lat != null, timestamp: Date.now() };
  guesses.set(key, g);
  emit({ type: 'guess_add', guess: g });
  return g;
}

export function getGuesses(): GameGuess[] {
  return Array.from(guesses.values());
}

export function clearGuesses() {
  guesses.clear();
  emit({ type: 'guesses_clear' });
}

// ── Round control ─────────────────────────────────────────────────────────────
export function startRound() {
  guesses.clear();
  acceptingGuesses = true;
  emit({ type: 'round_start' });
}

export function endRound() {
  acceptingGuesses = false;
  emit({ type: 'round_end' });
}

export function isAcceptingGuesses(): boolean {
  return acceptingGuesses;
}

export function getFullState() {
  return {
    participants: getParticipants(),
    guesses: getGuesses(),
    acceptingGuesses,
  };
}
