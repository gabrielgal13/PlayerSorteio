/* ============================================================================
 * CHAT WARS — persistent session (module-level singleton)
 *
 * The simulation lives here, NOT inside the React component. It keeps stepping
 * the world and ingesting chat even when the <ChatWarsGame> view is unmounted
 * (e.g. the streamer navigated to the raffle lobby). The game only stops when
 * the streamer finalizes it or the page is closed.
 *
 * The component is purely a view: it renders `session.world` and calls these
 * methods for controls.
 * ========================================================================== */
'use client';
import {
  createWorld, stepWorld, applyMessage, leaderboard,
  toggleStreamerBall, WORLD_MIN_W, WORLD_MIN_H,
  type World, type LeaderRow, type MatchStats,
} from './engine';
import { useStore } from '@/store/useStore';

// O mundo começa nesse mínimo e CRESCE sozinho conforme entra gente (ver
// growWorld no engine), então poucas bolas ficam pertinho e grandes, e uma
// multidão ganha espaço pra não travar. Só zera de volta ao mínimo no reset.
const WORLD_W = WORLD_MIN_W;
const WORLD_H = WORLD_MIN_H;

export type FinalStats = MatchStats & { elapsedMs: number };

class ChatWarsSession {
  world: World = createWorld(WORLD_W, WORLD_H);
  started = false;
  running = false;
  finished = false;
  streamerOn = false;
  finalRows: LeaderRow[] = [];
  finalStats: FinalStats = { messages: 0, maxMass: 0, events: 0, elapsedMs: 0 };

  private seen = new Set<string>();
  private raf: number | null = null;
  private last = 0;
  private inited = false;

  /** Wire up the chat subscription + start the persistent stepping loop hook. */
  init() {
    if (this.inited) return;
    this.inited = true;
    // don't replay the chat history that already exists when we boot
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
    this.streamerOn = !!this.world.streamerId;
  }
}

export const chatWarsSession = new ChatWarsSession();
