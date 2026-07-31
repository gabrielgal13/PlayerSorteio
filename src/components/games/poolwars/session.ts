/* ============================================================================
 * POOL WARS — persistent session (module-level singleton)
 *
 * Mirrors the Chat Wars session pattern: the simulation lives here, NOT in the
 * React component, so the brawl keeps running + ingesting chat even when the
 * <PoolWarsGame> view is unmounted (streamer browsing the raffle lobby, etc.).
 * The component is a pure view over `session.world`.
 * ========================================================================== */
'use client';
import {
  createWorld, stepWorld, applyMessage, leaderboard,
  toggleStreamerBall, type World, type LeaderRow, type MatchStats,
} from './engine';
import { useStore } from '@/store/useStore';

const WORLD_W = 1700;
const WORLD_H = 1100;

export type FinalStats = MatchStats & { elapsedMs: number };

class PoolWarsSession {
  world: World = createWorld(WORLD_W, WORLD_H);
  started = false;
  running = false;
  finished = false;
  streamerOn = false;
  finalRows: LeaderRow[] = [];
  finalStats: FinalStats = { messages: 0, knockouts: 0, events: 0, roundsA: 0, roundsB: 0, elapsedMs: 0 };

  private seen = new Set<string>();
  private raf: number | null = null;
  private last = 0;
  private inited = false;

  init() {
    if (this.inited) return;
    this.inited = true;
    this.seen = new Set(useStore.getState().chatMessages.map(m => m.id));
    useStore.subscribe((state, prev) => {
      if (state.chatMessages === prev.chatMessages) return;
      for (const m of state.chatMessages) {
        if (this.seen.has(m.id)) continue;
        this.seen.add(m.id);
        if (this.running) {
          applyMessage(this.world, { username: m.username, text: m.text, color: m.color, source: m.source });
          useStore.getState().addParticipantFromChat(m.username, m.source);
        }
      }
      if (this.seen.size > 600) this.seen = new Set(state.chatMessages.map(m => m.id));
    });
  }

  private loop = () => {
    const now = performance.now();
    const dt = this.last ? now - this.last : 16;
    this.last = now;
    if (this.running) stepWorld(this.world, dt);
    this.raf = requestAnimationFrame(this.loop);
  };

  private ensureLoop() {
    if (this.raf == null) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); }
  }

  start() { this.started = true; this.finished = false; this.running = true; this.ensureLoop(); }
  pause() { this.running = false; }
  resume() { this.running = true; this.ensureLoop(); }

  finalize() {
    this.finalRows = leaderboard(this.world, 9999);
    this.finalStats = { ...this.world.stats, elapsedMs: this.world.time };
    this.running = false;
    this.finished = true;
  }

  continueGame() { this.finished = false; this.running = true; this.ensureLoop(); }

  reset() {
    this.world = createWorld(WORLD_W, WORLD_H);
    this.streamerOn = false;
    this.finalRows = [];
    this.seen = new Set(useStore.getState().chatMessages.map(m => m.id));
  }

  fireEvent(fn: (w: World) => void) { fn(this.world); }

  toggleStreamer(name: string) {
    toggleStreamerBall(this.world, name);
    this.streamerOn = [...this.world.fighters.values()].some(f => f.isStreamer);
  }
}

export const poolWarsSession = new PoolWarsSession();
