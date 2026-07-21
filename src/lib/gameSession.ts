import { Redis } from '@upstash/redis';

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

// ── Shared store (Upstash Redis, REST) ─────────────────────────────────────────
// Vercel Serverless Functions don't share process memory across instances, so
// state here MUST live in an external store, not a module-level variable.
const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)!,
  token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)!,
});

const PARTICIPANTS_KEY = 'game:participants';
const PARTICIPANTS_ORDER_KEY = 'game:participants:order';
const GUESSES_KEY = 'game:guesses';
const ACCEPTING_KEY = 'game:accepting';

// ── Participants ──────────────────────────────────────────────────────────────
export async function addParticipant(
  name: string,
  source: 'twitch' | 'kick' | 'youtube',
): Promise<GameParticipant | null> {
  const key = name.toLowerCase();
  const p: GameParticipant = { name, source, timestamp: Date.now() };
  const wasNew = await redis.hsetnx(PARTICIPANTS_KEY, key, p);
  if (!wasNew) return null;
  await redis.zadd(PARTICIPANTS_ORDER_KEY, { score: p.timestamp, member: key });
  return p;
}

export async function getParticipants(): Promise<GameParticipant[]> {
  const order = await redis.zrange<string[]>(PARTICIPANTS_ORDER_KEY, 0, -1);
  if (order.length === 0) return [];
  const entries = await redis.hmget<Record<string, GameParticipant>>(PARTICIPANTS_KEY, ...order);
  return order.map(key => entries?.[key]).filter((p): p is GameParticipant => Boolean(p));
}

export async function clearParticipants(): Promise<void> {
  await redis.del(PARTICIPANTS_KEY, PARTICIPANTS_ORDER_KEY);
}

export async function isParticipant(name: string): Promise<boolean> {
  return (await redis.hexists(PARTICIPANTS_KEY, name.toLowerCase())) === 1;
}

// ── Guesses ───────────────────────────────────────────────────────────────────
export async function addGuess(
  name: string,
  source: 'twitch' | 'kick' | 'youtube',
  text: string,
  lat: number | null,
  lng: number | null,
): Promise<GameGuess | null> {
  if (!(await isAcceptingGuesses())) return null;
  const key = name.toLowerCase();
  const g: GameGuess = { name, source, text, lat, lng, geocoded: lat != null, timestamp: Date.now() };
  const wasNew = await redis.hsetnx(GUESSES_KEY, key, g);
  if (!wasNew) return null; // one guess per round
  return g;
}

export async function getGuesses(): Promise<GameGuess[]> {
  const all = await redis.hgetall<Record<string, GameGuess>>(GUESSES_KEY);
  return all ? Object.values(all) : [];
}

export async function updateGuessLocation(name: string, lat: number, lng: number): Promise<void> {
  const key = name.toLowerCase();
  const existing = await redis.hget<GameGuess>(GUESSES_KEY, key);
  if (!existing) return;
  await redis.hset(GUESSES_KEY, { [key]: { ...existing, lat, lng, geocoded: true } });
}

export async function clearGuesses(): Promise<void> {
  await redis.del(GUESSES_KEY);
}

// ── Round control ─────────────────────────────────────────────────────────────
export async function startRound(): Promise<void> {
  await redis.del(GUESSES_KEY);
  await redis.set(ACCEPTING_KEY, '1');
}

export async function endRound(): Promise<void> {
  await redis.del(ACCEPTING_KEY);
}

export async function isAcceptingGuesses(): Promise<boolean> {
  return (await redis.get(ACCEPTING_KEY)) === '1';
}

export async function getFullState() {
  const [participants, guesses, acceptingGuesses] = await Promise.all([
    getParticipants(),
    getGuesses(),
    isAcceptingGuesses(),
  ]);
  return { participants, guesses, acceptingGuesses };
}
