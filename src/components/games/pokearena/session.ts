/* ============================================================================
 * POKÉARENA LIVE — sessão persistente (singleton de módulo)
 *
 * A simulação vive aqui, fora do React: o mundo continua rodando (spawns,
 * batalhas, captura) mesmo se o streamer sair para a aba do sorteio. Só para
 * quando ele finaliza o jogo ou fecha a página.
 * ========================================================================== */
'use client';
import { createWorld, stepWorld, applyMessage, feed, type World } from './engine';
import { pokeStore } from './storage';
import { useStore } from '@/store/useStore';

export interface FinalStats {
  spawns: number; captures: number; shinies: number; legendaries: number;
  battles: number; bossesDown: number; messages: number; commands: number;
  elapsedMs: number; trainers: number;
}

class PokeArenaSession {
  world: World = createWorld();
  started = false;
  running = false;
  finished = false;
  finalStats: FinalStats = {
    spawns: 0, captures: 0, shinies: 0, legendaries: 0,
    battles: 0, bossesDown: 0, messages: 0, commands: 0, elapsedMs: 0, trainers: 0,
  };

  private seen = new Set<string>();
  private raf: number | null = null;
  private last = 0;
  private inited = false;
  private unsub: (() => void) | null = null;

  /** Assina o chat e carrega os treinadores salvos deste streamer. */
  init() {
    if (this.inited) return;
    this.inited = true;

    void pokeStore.load(useStore.getState().currentUser?.username);

    // não reprocessa o histórico de chat que já existia ao abrir o jogo
    this.seen = new Set(useStore.getState().chatMessages.map(m => m.id));
    this.unsub = useStore.subscribe((state, prev) => {
      if (state.chatMessages === prev.chatMessages) return;
      for (const m of state.chatMessages) {
        if (this.seen.has(m.id)) continue;
        this.seen.add(m.id);
        if (this.running) {
          applyMessage(this.world, { username: m.username, text: m.text, color: m.color, source: m.source });
        }
      }
      if (this.seen.size > 600) this.seen = new Set(state.chatMessages.map(m => m.id));
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => { void pokeStore.flush(); });
    }
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

  start() {
    this.started = true; this.finished = false; this.running = true;
    feed(this.world, '🎬', 'PokéArena começou! Pokémon vão aparecer no mapa.', '#7CFFB2');
    this.ensureLoop();
  }
  pause() { this.running = false; void pokeStore.flush(); }
  resume() { this.running = true; this.ensureLoop(); }

  finalize() {
    const w = this.world;
    this.finalStats = {
      ...w.stats,
      elapsedMs: w.time,
      trainers: [...pokeStore.trainers.values()].filter(t => t.captures > 0 || t.battles > 0).length,
    };
    this.running = false;
    this.finished = true;
    void pokeStore.flush();
  }

  continueGame() { this.finished = false; this.running = true; this.ensureLoop(); }

  /** Zera só a sessão da live — o progresso dos treinadores continua salvo. */
  resetSession() {
    const keepSpawn = this.world.spawnIntervalMs;
    const keepWindow = this.world.captureWindowMs;
    const keepAuto = this.world.autoSpawn;
    this.world = createWorld();
    this.world.spawnIntervalMs = keepSpawn;
    this.world.captureWindowMs = keepWindow;
    this.world.autoSpawn = keepAuto;
    this.seen = new Set(useStore.getState().chatMessages.map(m => m.id));
  }

  /** Apaga TODO o progresso dos treinadores deste streamer. */
  wipeTrainers() {
    pokeStore.reset();
    void pokeStore.flush();
  }

  act(fn: (w: World) => void) { fn(this.world); }
}

export const pokeArenaSession = new PokeArenaSession();
