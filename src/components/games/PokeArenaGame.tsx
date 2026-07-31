'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  BOSSES, EVENTS, ITEMS, STYLES, WEATHER,
  artworkUrl, species,
  type EventKey, type ItemKey, type WeatherKey,
} from './pokearena/data';
import {
  SUPPORT_COMMANDS, activeCount, ballRain, captureRemainMs, currentCine,
  endEverything, joinRemainMs, sessionRows, setEvent, setWeather,
  spawnPokemon, startDungeon, startTournament, summonBoss,
  type BossState, type Fighter, type World,
} from './pokearena/engine';
import { pokeArenaSession, type FinalStats } from './pokearena/session';
import { pokeStore } from './pokearena/storage';
import { createScene, renderScene, type Scene } from './pokearena/render';
import {
  CtrlButton, HpBar, MiniButton, PowerButton, RightPanel,
  SourceIcon, Sprite, TrainerCardOverlay, TypeChip,
  type PanelTab,
} from './pokearena/ui';

const MIN_MESSAGES_FOR_RANK = 5;

interface Props { onBack: () => void }

export default function PokeArenaGame({ onBack }: Props) {
  const {
    chatMessages, setChatRegistrationRequested, setChatRegistrationStopRequested,
    setParticipants, setRaffleStage, setActiveTab,
  } = useStore();

  const world = pokeArenaSession.world;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene>(createScene());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [, forceTick] = useState(0);
  const [started, setStarted] = useState(pokeArenaSession.started);
  const [running, setRunning] = useState(pokeArenaSession.running);
  const [finished, setFinished] = useState(pokeArenaSession.finished);
  const [finalStats, setFinalStats] = useState<FinalStats>(pokeArenaSession.finalStats);
  const [tab, setTab] = useState<PanelTab>('chat');
  const [showHelp, setShowHelp] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [bossPick, setBossPick] = useState(false);

  /* ---------------------------------------------------------- boot --- */
  useEffect(() => {
    pokeArenaSession.init();
    // Liga a escuta do chat. Se fomos nós que abrimos, fechamos ao sair — assim
    // voltar pro sorteio não deixa "BUSCANDO NO CHAT" ligado sozinho.
    const wasActive = useStore.getState().chatRegistrationActive;
    if (!wasActive) setChatRegistrationRequested(true);
    return () => { if (!wasActive) setChatRegistrationStopRequested(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------- render loop --- */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [started, finished]);

  useEffect(() => {
    const loop = (t: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      const { w, h, dpr } = sizeRef.current;
      const dt = lastRef.current ? t - lastRef.current : 16;
      lastRef.current = t;
      if (ctx && w > 0 && h > 0) {
        const wd = pokeArenaSession.world;
        const s = wd.spawn;
        const aura = s && s.phase !== 'fled'
          ? (s.shiny ? '#FFD24A' : s.legendary ? '#FF9EC4' : null)
          : null;
        ctx.save(); ctx.scale(dpr, dpr);
        renderScene(ctx, sceneRef.current, w, h, dt, {
          weather: wd.weather,
          ballRain: wd.ballRainUntil > wd.time,
          spotlight: wd.mode === 'spawn',
          aura,
        });
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  /* ------------------------------------------------ refresh da UI --- */
  useEffect(() => {
    const iv = setInterval(() => {
      setRunning(pokeArenaSession.running);
      forceTick(n => n + 1);
    }, 140);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, tab]);

  /* ------------------------------------------------------ ações --- */
  const act = useCallback((fn: (w: World) => void) => { pokeArenaSession.act(fn); forceTick(n => n + 1); }, []);

  const handlePlay = useCallback(() => { pokeArenaSession.start(); setStarted(true); setRunning(true); }, []);
  const togglePause = useCallback(() => {
    if (pokeArenaSession.running) { pokeArenaSession.pause(); setRunning(false); }
    else { pokeArenaSession.resume(); setRunning(true); }
  }, []);

  const handleFinalize = useCallback(() => {
    pokeArenaSession.finalize();
    setFinalStats(pokeArenaSession.finalStats);
    setRunning(false); setFinished(true);
    if (pokeArenaSession.finalStats.messages >= MIN_MESSAGES_FOR_RANK) {
      fetch('/api/streamer/rank-game-completed', { method: 'POST' }).catch(() => {});
    }
  }, []);

  const handleContinue = useCallback(() => {
    pokeArenaSession.continueGame(); setFinished(false); setRunning(true);
  }, []);

  const handleSorteio = useCallback(() => {
    const rows = sessionRows(pokeArenaSession.world);
    const parts = rows.map((r, i) => ({
      id: `pa_${r.nick}_${i}`, number: i + 1, name: r.display, source: r.source,
      tickets: Math.max(1, Math.round(r.points / 2)),
    }));
    setParticipants(parts);
    setChatRegistrationStopRequested(true); // fecha a lista: só quem jogou entra
    setRaffleStage(1); setActiveTab('raffle');
  }, [setParticipants, setChatRegistrationStopRequested, setRaffleStage, setActiveTab]);

  if (!started) {
    return <IntroScreen onPlay={handlePlay} onBack={onBack} showHelp={showHelp}
      onHelp={() => setShowHelp(true)} onCloseHelp={() => setShowHelp(false)} />;
  }
  if (finished) {
    return <ResultsScreen stats={finalStats} onSorteio={handleSorteio} onContinue={handleContinue} onExit={onBack} />;
  }

  const w = world;
  const wd = WEATHER[w.weather];
  const ev = w.event ? EVENTS[w.event] : null;
  const cine = currentCine(w);
  const busy = w.mode !== 'idle' && w.mode !== 'spawn';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ------------------------------------------------------- header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,210,74,0.15)' }}>
        <button onClick={onBack} className="flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FFD24A')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          VOLTAR
        </button>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <PokeballIcon />
        <span className="font-orbitron font-bold text-sm tracking-widest text-white">POKÉARENA LIVE</span>

        <div className="flex items-center gap-1.5 ml-2">
          <Badge color={wd.color}>{wd.emoji} {wd.label}</Badge>
          {ev && <Badge color={ev.color}>{ev.emoji} {ev.label}</Badge>}
          {w.doubleXp && <Badge color="#7CFFB2">⚡ XP ×2</Badge>}
          {w.doubleShiny && <Badge color="#FFD24A">✨ SHINY ×2</Badge>}
        </div>

        <span className="font-rajdhani text-xs tracking-wider text-white/35 ml-1">
          {pokeStore.trainers.size} treinadores · {activeCount(w)} ativos
        </span>

        <div className="ml-auto flex items-center gap-2">
          <CtrlButton onClick={() => setShowConfig(true)} color="#8FE3F0">⚙ AJUSTES</CtrlButton>
          {!running
            ? <CtrlButton onClick={togglePause} color="#53FC1C">▶ RETOMAR</CtrlButton>
            : <CtrlButton onClick={togglePause} color="#FFD24A">⏸ PAUSAR</CtrlButton>}
          <CtrlButton onClick={handleFinalize} color="#00E5FF">🏁 FINALIZAR</CtrlButton>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ------------------------------------------------ controles */}
        <div className="flex flex-col flex-shrink-0 overflow-y-auto"
          style={{ width: 268, background: 'rgba(5,14,28,0.94)', borderRight: '1px solid rgba(255,255,255,0.09)', scrollbarWidth: 'none' }}>

          <SectionTitle emoji="🎮" text="CONTROLE DA LIVE" />
          <div className="grid grid-cols-3 gap-2 px-3">
            <PowerButton emoji="🌿" label="SPAWN" color="#7CFFB2" desc="Faz um Pokémon selvagem aparecer agora. O chat captura com !pokeball."
              onClick={() => act(x => spawnPokemon(x))} disabled={busy} />
            <PowerButton emoji="👑" label="LENDÁRIO" color="#FF9EC4" desc="Spawn garantido de um lendário — ideal para meta de inscritos batida."
              onClick={() => act(x => spawnPokemon(x, { legendary: true }))} disabled={busy} />
            <PowerButton emoji="⚔️" label="BOSS" color="#FF6B6B" desc="Invoca um boss. O chat entra com !battle e luta junto."
              onClick={() => setBossPick(true)} disabled={busy} />
            <PowerButton emoji="🕯️" label="DUNGEON" color="#B45CD8" desc="Abre uma expedição com salas, mini boss e boss final. Chat entra com !join."
              onClick={() => act(x => startDungeon(x, Math.floor(Math.random() * 4)))} disabled={busy} />
            <PowerButton emoji="🏆" label="TORNEIO" color="#FFD24A" desc="Sorteia 16 treinadores e roda um chaveamento automático."
              onClick={() => act(x => { if (!startTournament(x)) alert('Ninguém tem Pokémon ainda — faça alguns spawns antes.'); })} disabled={busy} />
            <PowerButton emoji="🎁" label="CHUVA" color="#4FA3FF" desc="Chuva de pokébolas: todo mundo que apareceu na live ganha uma Great Ball."
              onClick={() => act(x => ballRain(x, 'greatball', 1))} />
            <PowerButton emoji="⚡" label="XP ×2" color="#7CFFB2" desc="Dobra todo o XP ganho enquanto estiver ligado."
              onClick={() => act(x => { x.doubleXp = !x.doubleXp; })} active={w.doubleXp} />
            <PowerButton emoji="✨" label="SHINY ×2" color="#FFD24A" desc="Dobra a chance de aparecer um shiny."
              onClick={() => act(x => { x.doubleShiny = !x.doubleShiny; })} active={w.doubleShiny} />
            <PowerButton emoji="🛑" label="ENCERRAR" color="#FF6B6B" desc="Encerra evento, boss, dungeon ou torneio em andamento."
              onClick={() => act(x => endEverything(x))} />
          </div>

          <SectionTitle emoji="🌦️" text="CLIMA" />
          <div className="grid grid-cols-4 gap-1.5 px-3">
            {(Object.keys(WEATHER) as WeatherKey[]).map(k => (
              <MiniButton key={k} emoji={WEATHER[k].emoji} label={WEATHER[k].label} color={WEATHER[k].color}
                desc={WEATHER[k].desc} active={w.weather === k} onClick={() => act(x => setWeather(x, k))} />
            ))}
          </div>

          <SectionTitle emoji="🎉" text="EVENTOS ESPECIAIS" />
          <div className="grid grid-cols-4 gap-1.5 px-3">
            {(Object.keys(EVENTS) as EventKey[]).map(k => (
              <MiniButton key={k} emoji={EVENTS[k].emoji} label={EVENTS[k].label.replace('EVENTO ', '')} color={EVENTS[k].color}
                desc={EVENTS[k].desc} active={w.event === k}
                onClick={() => act(x => setEvent(x, x.event === k ? null : k))} />
            ))}
          </div>

          <SectionTitle emoji="🛍️" text="LOJA / RECOMPENSAS" />
          <div className="px-3">
            <button onClick={() => setShowShop(true)}
              className="w-full font-orbitron text-[10px] tracking-widest py-2.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,158,196,0.1)', border: '1px solid rgba(255,158,196,0.4)', color: '#FF9EC4' }}>
              🎁 DISTRIBUIR ITENS
            </button>
            <p className="font-rajdhani text-[10px] text-white/30 mt-1.5 leading-snug">
              Entregue bolas, doces e pedras para quem seguiu, deu sub, gift ou raid.
            </p>
          </div>

          <SectionTitle emoji="💬" text="COMANDOS DO CHAT" />
          <div className="px-3 pb-4 space-y-1.5">
            <CmdLine cmd="!pokeball" desc="tenta capturar o selvagem" color="#FF6B6B" />
            <CmdLine cmd="!greatball / !ultraball / !masterball" desc="mais chance (gasta item)" color="#4FA3FF" />
            <CmdLine cmd="!battle" desc="entra na luta contra o boss" color="#FFD24A" />
            <CmdLine cmd="!join" desc="entra na dungeon" color="#B45CD8" />
            <CmdLine cmd="!favorite <nome>" desc="define o pokémon de batalha" color="#00E5FF" />
            <CmdLine cmd="!style attack|defense|support|speed" desc="muda a IA do pokémon" color="#7CFFB2" />
            <CmdLine cmd="!heal !shield !rage !boost !cheer" desc="apoio na batalha (cooldown 45s)" color="#FF9EC4" />
            <CmdLine cmd="!pokedex" desc="mostra a equipe dele na tela" color="#8FE3F0" />
          </div>
        </div>

        {/* ---------------------------------------------------- palco */}
        <div ref={wrapRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          <canvas ref={canvasRef} className="block absolute inset-0" />

          {w.mode === 'idle' && <IdleStage w={w} />}
          {w.mode === 'spawn' && w.spawn && <SpawnStage w={w} />}
          {w.mode === 'boss' && w.boss && <BattleStage w={w} b={w.boss} />}
          {w.mode === 'dungeon' && w.dungeon && <DungeonStage w={w} />}
          {w.mode === 'tournament' && w.tournament && <TournamentStage w={w} />}

          <AnimatePresence>
            {cine && <CinematicOverlay key={cine.id} kind={cine.kind} title={cine.title} sub={cine.sub}
              sid={cine.sid} color={cine.color} />}
          </AnimatePresence>

          <AnimatePresence>
            {w.cards[0] && <TrainerCardOverlay key={w.cards[0].nick} nick={w.cards[0].nick} />}
          </AnimatePresence>
        </div>

        {/* --------------------------------------------------- painel */}
        <RightPanel tab={tab} onTab={setTab} messages={chatMessages} chatEndRef={chatEndRef}
          feedItems={w.feed} version={pokeStore.version} />
      </div>

      {/* ------------------------------------------------------ modais */}
      <AnimatePresence>
        {bossPick && <BossPicker onPick={id => { act(x => summonBoss(x, id)); setBossPick(false); }} onClose={() => setBossPick(false)} />}
        {showShop && <ShopModal onClose={() => setShowShop(false)} />}
        {showConfig && <ConfigModal w={w} onAct={act} onClose={() => setShowConfig(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ========================================================== PALCOS ======= */

function IdleStage({ w }: { w: World }) {
  const remain = w.autoSpawn ? Math.max(0, w.nextSpawnAt - w.time) : 0;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
      <motion.span style={{ fontSize: 58 }} animate={{ y: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity }}>🌿</motion.span>
      <h2 className="font-orbitron font-bold text-xl tracking-widest text-white mt-3"
        style={{ textShadow: '0 2px 14px rgba(0,0,0,0.8)' }}>O MAPA ESTÁ CALMO</h2>
      <p className="font-rajdhani text-sm text-white/60 mt-2 max-w-md leading-relaxed"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
        Pokémon aparecem sozinhos de tempos em tempos — ou use os botões da esquerda
        para invocar spawn, boss, dungeon e torneio na hora.
      </p>
      {w.autoSpawn && (
        <div className="mt-4 px-4 py-2 rounded-full"
          style={{ background: 'rgba(6,16,32,0.8)', border: '1px solid rgba(124,255,178,0.35)' }}>
          <span className="font-orbitron text-xs tracking-widest" style={{ color: '#7CFFB2' }}>
            PRÓXIMO SPAWN EM {fmtClock(remain)}
          </span>
        </div>
      )}
    </div>
  );
}

function SpawnStage({ w }: { w: World }) {
  const s = w.spawn!;
  const sp = species(s.sid);
  const remain = captureRemainMs(w);
  const pct = s.phase === 'open' ? (remain / Math.max(1, w.captureWindowMs)) * 100 : 0;
  const entries = [...s.entries.values()];

  return (
    <div className="absolute inset-0 flex flex-col items-center pointer-events-none">
      {/* placa do selvagem */}
      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
        className="mt-5 flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl"
        style={{
          background: 'rgba(6,16,32,0.88)',
          border: `1px solid ${s.shiny ? 'rgba(255,210,74,0.7)' : sp.legendary ? 'rgba(255,158,196,0.7)' : 'rgba(124,255,178,0.4)'}`,
          boxShadow: s.shiny ? '0 0 26px rgba(255,210,74,0.35)' : 'none',
        }}>
        <div className="flex items-center gap-2">
          {s.shiny && <span className="text-sm">✨</span>}
          {sp.legendary && <span className="text-sm">👑</span>}
          <span className="font-orbitron font-bold text-lg tracking-widest text-white">{sp.name.toUpperCase()}</span>
          <span className="font-orbitron text-xs" style={{ color: '#FFD24A' }}>Lv {s.lvl}</span>
        </div>
        <div className="flex items-center gap-1">
          {sp.types.map(t => <TypeChip key={t} type={t} />)}
          {s.shiny && <span className="font-orbitron font-bold text-[8px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,210,74,0.2)', border: '1px solid rgba(255,210,74,0.7)', color: '#FFD24A' }}>SHINY</span>}
        </div>
      </motion.div>

      {/* o pokémon */}
      <div className="flex-1 flex items-center justify-center relative" style={{ marginTop: -20 }}>
        {s.phase === 'wobble' || s.phase === 'caught' ? (
          <WobbleBall wobbles={s.wobbles} caught={s.phase === 'caught'} />
        ) : s.phase === 'fled' ? (
          <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0, scale: 0.6, x: 120 }} transition={{ duration: 1.6 }}>
            <Sprite sid={s.sid} shiny={s.shiny} size={190} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.2, opacity: 0, y: -40 }}
            animate={{ scale: 1, opacity: 1, y: [0, -10, 0] }}
            transition={{ scale: { type: 'spring', stiffness: 220, damping: 14 }, opacity: { duration: 0.3 }, y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ filter: s.shiny ? 'drop-shadow(0 0 18px rgba(255,210,74,0.9))' : 'drop-shadow(0 8px 14px rgba(0,0,0,0.6))' }}>
            <Sprite sid={s.sid} shiny={s.shiny} size={190} />
          </motion.div>
        )}
      </div>

      {/* barra de tempo + chamada */}
      {s.phase === 'open' && (
        <div className="w-full flex flex-col items-center pb-5 px-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-orbitron font-bold text-sm tracking-[0.3em] text-white"
              style={{ textShadow: '0 0 14px rgba(124,255,178,0.9)' }}>DIGITE !POKEBALL</span>
            <span className="font-orbitron font-black text-xl tabular-nums" style={{ color: pct < 30 ? '#FF6B6B' : '#7CFFB2' }}>
              {Math.ceil(remain / 1000)}s
            </span>
          </div>
          <div className="w-full max-w-lg h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct < 30 ? '#FF6B6B' : '#7CFFB2', transition: 'width .15s linear', boxShadow: '0 0 10px currentColor' }} />
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap justify-center max-w-2xl">
            <span className="font-orbitron text-[10px] tracking-widest text-white/50">
              {entries.length} {entries.length === 1 ? 'TENTATIVA' : 'TENTATIVAS'}
            </span>
            {entries.slice(-14).map(e => (
              <span key={e.nick} className="font-rajdhani text-[11px] px-1.5 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(6,16,32,0.8)', border: `1px solid ${ITEMS[e.ball].color}55`, color: e.color }}>
                {ITEMS[e.ball].emoji} {e.display}
              </span>
            ))}
          </div>
        </div>
      )}

      {s.phase === 'wobble' && s.winner && (
        <div className="pb-8 text-center">
          <span className="font-orbitron font-bold text-sm tracking-widest text-white"
            style={{ textShadow: '0 0 12px rgba(255,210,74,0.9)' }}>
            {ITEMS[s.winner.ball].emoji} {s.winner.display} lançou a {ITEMS[s.winner.ball].label}!
          </span>
        </div>
      )}
    </div>
  );
}

function WobbleBall({ wobbles, caught }: { wobbles: number; caught: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        key={wobbles}
        animate={caught ? { rotate: 0, scale: [1, 1.25, 1] } : { rotate: [0, -24, 24, -14, 0] }}
        transition={{ duration: caught ? 0.5 : 0.7 }}>
        <BallGraphic size={92} glow={caught} />
      </motion.div>
      {caught ? (
        <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          className="font-orbitron font-black text-2xl tracking-widest mt-4"
          style={{ color: '#FFD24A', textShadow: '0 0 22px rgba(255,210,74,0.9)' }}>CAPTURADO!</motion.span>
      ) : (
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2.5 h-2.5 rounded-full"
              style={{ background: i < wobbles ? '#FFD24A' : 'rgba(255,255,255,0.2)', boxShadow: i < wobbles ? '0 0 10px #FFD24A' : 'none' }} />
          ))}
        </div>
      )}
    </div>
  );
}

function BallGraphic({ size = 64, glow }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ filter: glow ? 'drop-shadow(0 0 18px rgba(255,210,74,0.95))' : 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' }}>
      <circle cx="50" cy="50" r="46" fill="#F5F5F5" stroke="#1A1A1A" strokeWidth="5" />
      <path d="M4 50a46 46 0 0 1 92 0z" fill="#EE3B3B" stroke="#1A1A1A" strokeWidth="5" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="#1A1A1A" strokeWidth="6" />
      <circle cx="50" cy="50" r="14" fill="#F5F5F5" stroke="#1A1A1A" strokeWidth="5" />
      <circle cx="50" cy="50" r="6" fill="#DDD" stroke="#1A1A1A" strokeWidth="3" />
    </svg>
  );
}

/* --------------------------------------------------------------- batalha */

function BattleStage({ w, b, header }: { w: World; b: BossState; header?: React.ReactNode }) {
  const sp = species(b.sid);
  const joining = b.phase === 'joining';
  const remain = joinRemainMs(w);
  const alive = b.fighters.filter(f => !f.down);

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      {header}
      {/* boss */}
      <div className="flex flex-col items-center pt-4 px-8">
        <div className="w-full max-w-xl rounded-2xl px-4 py-2.5"
          style={{ background: 'rgba(6,16,32,0.88)', border: '1px solid rgba(255,107,107,0.45)', boxShadow: '0 0 22px rgba(255,107,107,0.2)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">{b.emoji}</span>
            <span className="font-orbitron font-bold text-sm tracking-widest text-white">{b.name.toUpperCase()}</span>
            <span className="font-orbitron text-[10px] text-white/40">Lv {b.lvl}</span>
            <div className="flex gap-1 ml-1">{sp.types.map(t => <TypeChip key={t} type={t} small />)}</div>
            <span className="ml-auto font-orbitron text-[11px] tabular-nums" style={{ color: '#FF6B6B' }}>
              {Math.max(0, b.hp)} / {b.maxHp}
            </span>
          </div>
          <HpBar value={b.hp} max={b.maxHp} color="#FF6B6B" height={10} />
          {b.lastMove && b.phase === 'fighting' && (
            <p className="font-rajdhani text-[11px] text-white/45 mt-1">último golpe: {b.lastMove}</p>
          )}
        </div>

        <motion.div className="mt-2"
          animate={b.hitFlash > w.time ? { x: [0, -8, 8, 0], filter: ['brightness(3)', 'brightness(1)'] } : { y: [0, -8, 0] }}
          transition={b.hitFlash > w.time ? { duration: 0.18 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.7))' }}>
          <Sprite sid={b.sid} size={150} />
        </motion.div>
      </div>

      {joining ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="font-orbitron font-black text-3xl tracking-[0.25em] text-white"
            style={{ textShadow: '0 0 20px rgba(255,107,107,0.9)' }}>!BATTLE</span>
          <span className="font-orbitron text-sm tracking-widest mt-2" style={{ color: '#FFD24A' }}>
            ENTRADA FECHA EM {Math.ceil(remain / 1000)}s
          </span>
          <span className="font-rajdhani text-sm text-white/60 mt-1">
            {b.fighters.length} {b.fighters.length === 1 ? 'treinador na arena' : 'treinadores na arena'}
          </span>
          <div className="flex flex-wrap gap-1.5 justify-center mt-3 max-w-3xl px-6">
            {b.fighters.slice(-24).map(f => (
              <span key={f.nick} className="font-rajdhani text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(6,16,32,0.85)', border: '1px solid rgba(255,255,255,0.12)', color: f.color }}>
                <Sprite sid={f.sid} shiny={f.shiny} size={18} animated={false} />{f.display}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* time */}
          <div className="flex-1 min-h-0 overflow-hidden px-4 pt-3">
            <div className="flex flex-wrap gap-1.5 justify-center content-start max-h-full overflow-hidden">
              {b.fighters.slice(0, 40).map(f => <FighterCard key={f.nick} f={f} now={w.time} />)}
            </div>
          </div>

          {/* rodapé: torcida + log */}
          <div className="flex items-end gap-3 px-4 pb-3">
            <div className="rounded-xl px-3 py-2 flex-shrink-0"
              style={{ background: 'rgba(6,16,32,0.86)', border: '1px solid rgba(255,158,196,0.35)', width: 170 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">📣</span>
                <span className="font-orbitron text-[9px] tracking-widest text-white/55">TORCIDA</span>
              </div>
              <HpBar value={b.cheer} max={400} color="#FF9EC4" height={6} />
              <p className="font-rajdhani text-[10px] text-white/35 mt-1">
                +{Math.round(Math.min(50, b.cheer / 8))}% de dano · !cheer
              </p>
              <p className="font-rajdhani text-[10px] text-white/45 mt-1">
                {alive.length} de pé · {b.fighters.length - alive.length} caídos
              </p>
            </div>
            <div className="flex-1 min-w-0 rounded-xl px-3 py-2 overflow-hidden"
              style={{ background: 'rgba(6,16,32,0.86)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 92 }}>
              {b.log.slice(-4).map(l => (
                <p key={l.id} className="font-rajdhani text-[11px] leading-snug truncate" style={{ color: l.color }}>{l.text}</p>
              ))}
            </div>
            <div className="rounded-xl px-3 py-2 flex-shrink-0"
              style={{ background: 'rgba(6,16,32,0.86)', border: '1px solid rgba(255,255,255,0.1)', width: 150 }}>
              <span className="font-orbitron text-[9px] tracking-widest text-white/45">APOIO DO CHAT</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {SUPPORT_COMMANDS.map(c => (
                  <span key={c.cmd} className="font-rajdhani text-[10px] text-white/55" title={c.desc}>{c.emoji}{c.cmd}</span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FighterCard({ f, now }: { f: Fighter; now: number }) {
  const st = STYLES[f.style];
  const hit = f.hitFlash > now;
  return (
    <motion.div animate={hit ? { x: [0, -3, 3, 0] } : {}} transition={{ duration: 0.15 }}
      className="flex flex-col items-center rounded-lg px-1.5 py-1 relative"
      style={{
        width: 76,
        background: f.down ? 'rgba(255,107,107,0.07)' : 'rgba(6,16,32,0.82)',
        border: `1px solid ${f.down ? 'rgba(255,107,107,0.3)' : f.shieldUntil > now ? '#4FA3FF' : 'rgba(255,255,255,0.1)'}`,
        opacity: f.down ? 0.45 : 1,
      }}>
      {f.rageUntil > now && <span className="absolute -top-1 -right-1 text-[10px]">🔥</span>}
      {f.boostUntil > now && <span className="absolute -top-1 -left-1 text-[10px]">⚡</span>}
      <Sprite sid={f.sid} shiny={f.shiny} size={34} />
      <span className="font-rajdhani font-bold text-[10px] text-white truncate w-full text-center leading-none">{f.display}</span>
      <span className="font-orbitron text-[7px]" style={{ color: st.color }}>{st.emoji} Lv{f.lvl}</span>
      <div className="w-full mt-0.5"><HpBar value={f.hp} max={f.maxHp} height={4} /></div>
      <span className="font-orbitron text-[7px] text-white/40 mt-0.5">{f.damage}</span>
    </motion.div>
  );
}

/* --------------------------------------------------------------- dungeon */

function DungeonStage({ w }: { w: World }) {
  const d = w.dungeon!;
  const header = (
    <div className="flex flex-col items-center pt-3">
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
        style={{ background: 'rgba(6,16,32,0.88)', border: '1px solid rgba(180,92,216,0.5)' }}>
        <span className="text-sm">{d.emoji}</span>
        <span className="font-orbitron font-bold text-xs tracking-widest text-white">{d.name}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {d.rooms.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: r.cleared ? 'rgba(124,255,178,0.16)' : i === d.index ? 'rgba(255,210,74,0.16)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${r.cleared ? '#7CFFB2' : i === d.index ? '#FFD24A' : 'rgba(255,255,255,0.12)'}`,
                }}>
                <span className="text-xs">{r.cleared ? '✔' : r.kind === 'boss' ? '👑' : r.kind === 'mini' ? '💀' : '🐾'}</span>
              </div>
            </div>
            {i < d.rooms.length - 1 && <div style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.18)' }} />}
          </div>
        ))}
      </div>
    </div>
  );

  if (d.phase === 'joining') {
    return (
      <div className="absolute inset-0 flex flex-col items-center pointer-events-none">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className="font-orbitron font-black text-3xl tracking-[0.25em] text-white"
            style={{ textShadow: '0 0 20px rgba(180,92,216,0.9)' }}>!JOIN</span>
          <span className="font-orbitron text-sm tracking-widest mt-2" style={{ color: '#FFD24A' }}>
            EXPEDIÇÃO PARTE EM {Math.ceil(joinRemainMs(w) / 1000)}s
          </span>
          <span className="font-rajdhani text-sm text-white/60 mt-1">{d.party.length} na equipe</span>
          <div className="flex flex-wrap gap-1.5 justify-center mt-3 max-w-3xl px-6">
            {d.party.slice(-30).map(n => {
              const t = pokeStore.get(n);
              return t ? (
                <span key={n} className="font-rajdhani text-[11px] px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(6,16,32,0.85)', border: '1px solid rgba(180,92,216,0.3)', color: t.color }}>{t.display}</span>
              ) : null;
            })}
          </div>
        </div>
      </div>
    );
  }
  if (d.battle) return <BattleStage w={w} b={d.battle} header={header} />;
  return <div className="absolute inset-0 flex items-center justify-center pointer-events-none">{header}</div>;
}

/* --------------------------------------------------------------- torneio */

function TournamentStage({ w }: { w: World }) {
  const tn = w.tournament!;
  const round = tn.rounds[tn.roundIndex];
  const m = round?.[tn.matchIndex];

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      <div className="flex items-center justify-center gap-2 pt-3">
        <span className="text-sm">🏆</span>
        <span className="font-orbitron font-bold text-xs tracking-widest text-white">
          CAMPEONATO — {roundName(tn.rounds.length - tn.roundIndex)}
        </span>
      </div>

      {tn.phase === 'done' && tn.champion ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 15 }} className="flex flex-col items-center">
            <span className="text-4xl">👑</span>
            <Sprite sid={tn.champion.sid} shiny={tn.champion.shiny} size={150} />
            <span className="font-orbitron font-black text-2xl tracking-widest text-white mt-2"
              style={{ textShadow: '0 0 20px rgba(255,210,74,0.9)' }}>{tn.champion.display}</span>
            <span className="font-rajdhani text-sm text-white/60">
              campeão com {species(tn.champion.sid).name} Lv {tn.champion.lvl}
            </span>
          </motion.div>
        </div>
      ) : m && m.a && m.b ? (
        <div className="flex-1 flex items-center justify-center gap-8 px-8">
          <MatchSide e={m.a} hp={m.hpA} align="right" />
          <span className="font-orbitron font-black text-2xl text-white/50">VS</span>
          <MatchSide e={m.b} hp={m.hpB} align="left" />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-rajdhani text-sm text-white/50">preparando o confronto...</span>
        </div>
      )}

      {/* chaveamento */}
      <div className="flex items-start justify-center gap-4 pb-4 px-6 overflow-x-auto">
        {tn.rounds.map((r, ri) => (
          <div key={ri} className="flex flex-col gap-1 flex-shrink-0">
            <span className="font-orbitron text-[8px] tracking-widest text-white/35 text-center mb-0.5">{roundName(tn.rounds.length - ri)}</span>
            {r.slice(0, 8).map((mm, mi) => (
              <div key={mi} className="rounded-md px-2 py-1"
                style={{
                  background: ri === tn.roundIndex && mi === tn.matchIndex ? 'rgba(255,210,74,0.14)' : 'rgba(6,16,32,0.8)',
                  border: `1px solid ${ri === tn.roundIndex && mi === tn.matchIndex ? '#FFD24A' : 'rgba(255,255,255,0.1)'}`,
                  minWidth: 96,
                }}>
                <p className="font-rajdhani text-[10px] truncate leading-tight"
                  style={{ color: mm.winner && mm.winner === mm.a ? '#7CFFB2' : 'rgba(255,255,255,0.6)' }}>{mm.a?.display ?? '—'}</p>
                <p className="font-rajdhani text-[10px] truncate leading-tight"
                  style={{ color: mm.winner && mm.winner === mm.b ? '#7CFFB2' : 'rgba(255,255,255,0.6)' }}>{mm.b?.display ?? '—'}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchSide({ e, hp, align }: { e: NonNullable<import('./pokearena/engine').Entrant>; hp: number; align: 'left' | 'right' }) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end' : 'items-start'}`} style={{ width: 220 }}>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
        style={{ transform: align === 'left' ? 'scaleX(-1)' : undefined }}>
        <Sprite sid={e.sid} shiny={e.shiny} size={110} />
      </motion.div>
      <span className="font-orbitron font-bold text-sm text-white truncate w-full"
        style={{ textAlign: align, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>{e.display}</span>
      <span className="font-rajdhani text-[11px] text-white/50 w-full" style={{ textAlign: align }}>
        {species(e.sid).name} Lv {e.lvl}
      </span>
      <div className="w-full mt-1"><HpBar value={hp} max={100} height={7} /></div>
    </div>
  );
}

function roundName(fromEnd: number): string {
  if (fromEnd <= 1) return 'FINAL';
  if (fromEnd === 2) return 'SEMIFINAL';
  if (fromEnd === 3) return 'QUARTAS';
  if (fromEnd === 4) return 'OITAVAS';
  return `RODADA ${fromEnd}`;
}

/* ------------------------------------------------------------ cinemática */

function CinematicOverlay({ kind, title, sub, sid, color }: {
  kind: string; title: string; sub: string; sid: number | null; color: string;
}) {
  const big = kind === 'shiny' || kind === 'legendary' || kind === 'champion' || kind === 'evolve';
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      style={{ background: big ? `radial-gradient(circle at 50% 45%, ${color}33, rgba(2,6,16,0.86) 70%)` : 'transparent' }}>

      {big && sid != null && (
        <motion.img
          src={artworkUrl(sid)} alt=""
          initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
          style={{ width: 260, height: 260, objectFit: 'contain', filter: `drop-shadow(0 0 34px ${color})` }}
        />
      )}

      <motion.div
        initial={{ scale: 0.6, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="flex flex-col items-center px-8 py-3 rounded-2xl"
        style={{
          background: 'rgba(4,10,22,0.86)',
          border: `1px solid ${color}`,
          boxShadow: `0 0 34px ${color}66`,
          marginTop: big ? -18 : 0,
        }}>
        <span className="font-orbitron font-black tracking-widest text-center"
          style={{ fontSize: big ? 30 : 20, color: '#fff', textShadow: `0 0 22px ${color}` }}>{title}</span>
        <span className="font-rajdhani text-sm text-white/70 mt-1 text-center">{sub}</span>
      </motion.div>

      {kind === 'shiny' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(14)].map((_, i) => (
            <motion.span key={i} className="absolute text-2xl"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0], x: Math.cos((i / 14) * 6.28) * 260, y: Math.sin((i / 14) * 6.28) * 180 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.09 }}>✨</motion.span>
          ))}
        </div>
      )}
      {kind === 'evolve' && (
        <motion.div className="absolute inset-0"
          animate={{ opacity: [0, 0.55, 0, 0.4, 0] }} transition={{ duration: 2.4, repeat: Infinity }}
          style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.9), transparent 45%)' }} />
      )}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- modais */

function Modal({ title, children, onClose, width = 520 }: {
  title: string; children: React.ReactNode; onClose: () => void; width?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: 'rgba(2,6,16,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ width, maxHeight: '82vh', background: 'rgba(6,16,32,0.98)', border: '1px solid rgba(0,229,255,0.28)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="font-orbitron font-bold text-xs tracking-widest text-white">{title}</span>
          <button onClick={onClose} className="font-orbitron text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">FECHAR ✕</button>
        </div>
        <div className="overflow-y-auto p-5" style={{ scrollbarWidth: 'none' }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

function BossPicker({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  return (
    <Modal title="INVOCAR BOSS" onClose={onClose} width={620}>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {BOSSES.map(b => (
          <button key={b.id} onClick={() => onPick(b.id)}
            className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
            style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.06)')}>
            <Sprite sid={b.id} size={54} />
            <span className="min-w-0">
              <span className="font-orbitron font-bold text-xs text-white block">{b.emoji} {b.name}</span>
              <span className="font-rajdhani text-[10px] text-white/45 block leading-snug">{b.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function ShopModal({ onClose }: { onClose: () => void }) {
  const [nick, setNick] = useState('');
  const [item, setItem] = useState<ItemKey>('greatball');
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');

  const giveOne = () => {
    const t = pokeStore.get(nick);
    if (!t) { setMsg(`"${nick}" ainda não jogou nenhuma vez.`); return; }
    pokeStore.giveItem(t, item, qty);
    setMsg(`${t.display} recebeu ${qty}× ${ITEMS[item].label}.`);
    setNick('');
  };
  const giveAll = () => {
    const n = pokeStore.giveItemToAll(item, qty, 6 * 60 * 60_000);
    setMsg(`${n} treinadores receberam ${qty}× ${ITEMS[item].label}.`);
  };

  const PRESETS: { label: string; item: ItemKey; emoji: string }[] = [
    { label: 'SEGUIU', item: 'pokeball', emoji: '❤️' },
    { label: 'SUB', item: 'greatball', emoji: '⭐' },
    { label: 'GIFT SUB', item: 'ultraball', emoji: '🎁' },
    { label: 'RAID', item: 'candy', emoji: '🚀' },
  ];

  return (
    <Modal title="LOJA / RECOMPENSAS" onClose={onClose}>
      <p className="font-rajdhani text-xs text-white/45 mb-3 leading-relaxed">
        Entregue itens como recompensa por seguir, sub, gift sub, raid ou metas da live.
        A Pokébola comum é infinita para todo mundo — os itens abaixo são o que dá vantagem real.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setItem(p.item)}
            className="font-orbitron text-[9px] tracking-widest px-2.5 py-1.5 rounded-lg"
            style={{
              background: item === p.item ? `${ITEMS[p.item].color}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${item === p.item ? ITEMS[p.item].color : 'rgba(255,255,255,0.1)'}`,
              color: item === p.item ? ITEMS[p.item].color : 'rgba(255,255,255,0.5)',
            }}>
            {p.emoji} {p.label} → {ITEMS[p.item].label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {(Object.keys(ITEMS) as ItemKey[]).map(k => (
          <button key={k} onClick={() => setItem(k)}
            className="flex items-center gap-2 p-2 rounded-lg text-left"
            style={{
              background: item === k ? `${ITEMS[k].color}1a` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${item === k ? ITEMS[k].color : 'rgba(255,255,255,0.08)'}`,
            }}>
            <span className="text-base">{ITEMS[k].emoji}</span>
            <span className="min-w-0">
              <span className="font-orbitron font-bold text-[10px] text-white block truncate">{ITEMS[k].label}</span>
              <span className="font-rajdhani text-[10px] text-white/40 block leading-tight">{ITEMS[k].desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="font-orbitron text-[10px] tracking-widest text-white/45">QUANTIDADE</span>
        {[1, 3, 5, 10].map(n => (
          <button key={n} onClick={() => setQty(n)}
            className="font-orbitron text-[10px] px-2.5 py-1 rounded-md"
            style={{
              background: qty === n ? 'rgba(0,229,255,0.16)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${qty === n ? '#00E5FF' : 'rgba(255,255,255,0.1)'}`,
              color: qty === n ? '#00E5FF' : 'rgba(255,255,255,0.5)',
            }}>{n}×</button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input value={nick} onChange={e => setNick(e.target.value)} placeholder="nick do viewer (opcional)"
          className="flex-1 font-rajdhani text-xs px-3 py-2 rounded-lg text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }} />
        <CtrlButton onClick={giveOne} color="#7CFFB2" disabled={!nick.trim()}>DAR PRA ELE</CtrlButton>
        <CtrlButton onClick={giveAll} color="#FFD24A">DAR PRA TODOS</CtrlButton>
      </div>
      {msg && <p className="font-rajdhani text-xs" style={{ color: '#7CFFB2' }}>{msg}</p>}
    </Modal>
  );
}

function ConfigModal({ w, onAct, onClose }: { w: World; onAct: (fn: (x: World) => void) => void; onClose: () => void }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  return (
    <Modal title="AJUSTES DA POKÉARENA" onClose={onClose}>
      <Row label="Spawn automático" desc="Faz Pokémon aparecerem sozinhos durante a live.">
        <button onClick={() => onAct(x => { x.autoSpawn = !x.autoSpawn; })}
          className="font-orbitron text-[10px] tracking-widest px-3 py-1.5 rounded-lg"
          style={{
            background: w.autoSpawn ? 'rgba(124,255,178,0.16)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${w.autoSpawn ? '#7CFFB2' : 'rgba(255,255,255,0.12)'}`,
            color: w.autoSpawn ? '#7CFFB2' : 'rgba(255,255,255,0.45)',
          }}>{w.autoSpawn ? 'LIGADO' : 'DESLIGADO'}</button>
      </Row>

      <Row label={`Intervalo entre spawns — ${fmtMin(w.spawnIntervalMs)}`} desc="De quanto em quanto tempo aparece um Pokémon sozinho.">
        <input type="range" min={30} max={3600} step={30} value={w.spawnIntervalMs / 1000}
          onChange={e => onAct(x => { x.spawnIntervalMs = Number(e.target.value) * 1000; x.nextSpawnAt = Math.min(x.nextSpawnAt, x.time + x.spawnIntervalMs); })}
          className="w-48" />
      </Row>

      <Row label={`Janela de captura — ${Math.round(w.captureWindowMs / 1000)}s`} desc="Tempo que o chat tem para digitar !pokeball.">
        <input type="range" min={10} max={180} step={5} value={w.captureWindowMs / 1000}
          onChange={e => onAct(x => { x.captureWindowMs = Number(e.target.value) * 1000; })}
          className="w-48" />
      </Row>

      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="font-orbitron text-[10px] tracking-widest text-white/45 mb-2">DADOS DA COMUNIDADE</p>
        <p className="font-rajdhani text-xs text-white/45 leading-relaxed mb-3">
          {pokeStore.trainers.size} treinadores salvos · {pokeStore.dex.caught.length} espécies na pokédex.
          {pokeStore.lastError && <span style={{ color: '#FFD24A' }}> ({pokeStore.lastError})</span>}
        </p>
        <div className="flex gap-2">
          <CtrlButton onClick={() => { void pokeStore.flush(); }} color="#7CFFB2">💾 SALVAR AGORA</CtrlButton>
          <CtrlButton onClick={() => { pokeArenaSession.resetSession(); onClose(); }} color="#FFD24A">↺ NOVA SESSÃO</CtrlButton>
          {confirmWipe ? (
            <CtrlButton onClick={() => { pokeArenaSession.wipeTrainers(); setConfirmWipe(false); }} color="#FF6B6B">
              ⚠ CONFIRMAR APAGAR TUDO
            </CtrlButton>
          ) : (
            <CtrlButton onClick={() => setConfirmWipe(true)} color="#FF6B6B">🗑 APAGAR PROGRESSO</CtrlButton>
          )}
        </div>
        <p className="font-rajdhani text-[10px] text-white/25 mt-2">
          &quot;Nova sessão&quot; zera só a live atual. &quot;Apagar progresso&quot; apaga a coleção de todos os viewers — não tem volta.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex-1 min-w-0">
        <p className="font-orbitron text-[11px] text-white">{label}</p>
        <p className="font-rajdhani text-[11px] text-white/35 leading-snug">{desc}</p>
      </div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- telas */

function IntroScreen({ onPlay, onBack, onHelp, showHelp, onCloseHelp }: {
  onPlay: () => void; onBack: () => void; onHelp: () => void; showHelp: boolean; onCloseHelp: () => void;
}) {
  const showcase = [25, 6, 150, 143, 94, 130];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,210,74,0.09), transparent 60%)' }} />

      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <PokeballIcon size={34} />
        <h1 className="font-orbitron font-black text-3xl tracking-[0.2em] text-white">POKÉARENA LIVE</h1>
      </motion.div>
      <p className="font-rajdhani text-sm text-white/50 mt-3 text-center max-w-xl leading-relaxed">
        O chat inteiro monta uma coleção de Pokémon durante a live. Sem login, sem download:
        o progresso fica no nickname e volta na próxima transmissão.
      </p>

      <div className="flex gap-3 mt-8">
        {showcase.map((id, i) => (
          <motion.div key={id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: [0, -8, 0] }}
            transition={{ opacity: { delay: i * 0.08 }, y: { duration: 2 + i * 0.2, repeat: Infinity } }}>
            <Sprite sid={id} size={72} />
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-10">
        <button onClick={onPlay}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-orbitron font-bold text-xs tracking-widest transition-all"
          style={{ background: 'rgba(255,210,74,0.12)', border: '1px solid rgba(255,210,74,0.5)', color: '#FFD24A' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,210,74,0.22)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(255,210,74,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,210,74,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}>
          ▶ COMEÇAR A LIVE
        </button>
        <button onClick={onHelp}
          className="px-5 py-3.5 rounded-xl font-orbitron text-xs tracking-widest"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}>
          ? COMO FUNCIONA
        </button>
        <button onClick={onBack}
          className="px-5 py-3.5 rounded-xl font-orbitron text-xs tracking-widest"
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
          VOLTAR
        </button>
      </div>

      <AnimatePresence>
        {showHelp && (
          <Modal title="COMO FUNCIONA A POKÉARENA" onClose={onCloseHelp} width={600}>
            <HelpBlock title="1. Pokémon aparecem no mapa" text="De tempos em tempos (ou quando você aperta SPAWN) um Pokémon selvagem surge na tela com um cronômetro." />
            <HelpBlock title="2. O chat captura" text="Todo mundo digita !pokeball. Quem tiver Great/Ultra/Master Ball pode usar !greatball, !ultraball ou !masterball para ter mais chance. No fim da janela o sistema sorteia o vencedor e a bola chacoalha três vezes na tela." />
            <HelpBlock title="3. A coleção é permanente" text="O Pokémon fica vinculado ao nickname do chat. Não existe login nem cadastro: na próxima live o viewer continua com a mesma equipe, nível e itens." />
            <HelpBlock title="4. XP e evolução" text="Capturar dá 50 XP, lutar 30, boss 150, evento 80. Quando o Pokémon bate o nível certo ele evolui com animação ao vivo para todo mundo ver." />
            <HelpBlock title="5. Boss, dungeon e torneio" text="Você invoca um boss e o chat entra com !battle. A dungeon tem salas e boss final (!join). O torneio sorteia 16 treinadores e roda o chaveamento sozinho." />
            <HelpBlock title="6. O chat interfere na luta" text="!heal !shield !rage !boost !cheer têm cooldown de 45s por pessoa. E cada um define o estilo do seu Pokémon com !style attack|defense|support|speed." />
            <HelpBlock title="7. Clima e eventos mudam o jogo" text="Chuva, noite, tempestade, lua cheia, nevasca e areia mudam quais tipos aparecem, a chance de shiny e a força do boss. Eventos filtram o spawn (só fogo, só Kanto, shiny em dobro…)." />
            <HelpBlock title="8. No final, vira sorteio" text="Ao FINALIZAR, quem jogou entra no sorteio com bilhetes proporcionais à participação da live." />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function HelpBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-3.5">
      <p className="font-orbitron font-bold text-[11px] tracking-wider mb-1" style={{ color: '#FFD24A' }}>{title}</p>
      <p className="font-rajdhani text-xs text-white/55 leading-relaxed">{text}</p>
    </div>
  );
}

function ResultsScreen({ stats, onSorteio, onContinue, onExit }: {
  stats: FinalStats; onSorteio: () => void; onContinue: () => void; onExit: () => void;
}) {
  const top = useMemo(() => pokeStore.ranking('level', 10), []);
  const rows = useMemo(() => sessionRows(pokeArenaSession.world), []);

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-8 py-8" style={{ scrollbarWidth: 'none' }}>
      <motion.h1 initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
        className="font-orbitron font-black text-2xl tracking-[0.2em] text-white">FIM DA POKÉARENA</motion.h1>
      <p className="font-rajdhani text-sm text-white/45 mt-1">
        {fmtClock(stats.elapsedMs)} de live · {stats.trainers} treinadores participaram
      </p>

      <div className="grid gap-2.5 mt-6 w-full" style={{ maxWidth: 760, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <Stat emoji="🌿" label="SPAWNS" value={stats.spawns} color="#7CFFB2" />
        <Stat emoji="🎯" label="CAPTURAS" value={stats.captures} color="#00E5FF" />
        <Stat emoji="✨" label="SHINYS" value={stats.shinies} color="#FFD24A" />
        <Stat emoji="👑" label="LENDÁRIOS" value={stats.legendaries} color="#FF9EC4" />
        <Stat emoji="⚔️" label="BATALHAS" value={stats.battles} color="#FF6B6B" />
        <Stat emoji="🏆" label="BOSSES" value={stats.bossesDown} color="#B45CD8" />
      </div>

      <div className="w-full mt-7" style={{ maxWidth: 760 }}>
        <p className="font-orbitron text-[11px] tracking-widest text-white/45 mb-2">🏆 TOP TREINADORES DA COMUNIDADE</p>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {top.length === 0 ? (
            <p className="font-rajdhani text-xs text-white/25 text-center py-6">ninguém jogou ainda</p>
          ) : top.map((t, i) => {
            const fav = pokeStore.fighterOf(t);
            return (
              <div key={t.nick} className="flex items-center gap-3 px-4 py-2.5"
                style={{ background: i === 0 ? 'rgba(255,210,74,0.07)' : i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                <span className="font-orbitron font-bold text-sm w-6 text-center"
                  style={{ color: i === 0 ? '#FFD24A' : i < 3 ? '#00E5FF' : 'rgba(255,255,255,0.35)' }}>{i + 1}</span>
                {fav && <Sprite sid={fav.sid} shiny={fav.shiny} size={34} animated={false} />}
                <span className="flex-1 min-w-0">
                  <span className="font-rajdhani font-bold text-sm text-white flex items-center gap-1.5">
                    <SourceIcon source={t.source} />{t.display}
                  </span>
                  <span className="font-rajdhani text-[11px] text-white/35">
                    ⭐ Nível {t.lvl} · {fav ? species(fav.sid).name : '—'} · 🏅 {t.captures} capturas
                  </span>
                </span>
                {t.shinies > 0 && <span className="font-rajdhani text-[11px]" style={{ color: '#FFD24A' }}>✨ {t.shinies}</span>}
                {t.legendaries > 0 && <span className="font-rajdhani text-[11px]" style={{ color: '#FF9EC4' }}>👑 {t.legendaries}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-8 pb-4">
        <button onClick={onSorteio} disabled={rows.length === 0}
          className="px-7 py-3.5 rounded-xl font-orbitron font-bold text-xs tracking-widest transition-all disabled:opacity-40"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.5)', color: '#00E5FF' }}>
          🎁 SORTEAR ENTRE OS {rows.length} QUE JOGARAM
        </button>
        <button onClick={onContinue}
          className="px-6 py-3.5 rounded-xl font-orbitron text-xs tracking-widest"
          style={{ background: 'rgba(124,255,178,0.1)', border: '1px solid rgba(124,255,178,0.4)', color: '#7CFFB2' }}>
          ▶ CONTINUAR JOGANDO
        </button>
        <button onClick={onExit}
          className="px-6 py-3.5 rounded-xl font-orbitron text-xs tracking-widest"
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
          SAIR
        </button>
      </div>
    </div>
  );
}

function Stat({ emoji, label, value, color }: { emoji: string; label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center py-3 rounded-xl"
      style={{ background: `${color}0f`, border: `1px solid ${color}33` }}>
      <span className="text-lg">{emoji}</span>
      <span className="font-orbitron font-black text-xl" style={{ color }}>{value}</span>
      <span className="font-orbitron text-[8px] tracking-widest text-white/40">{label}</span>
    </div>
  );
}

/* --------------------------------------------------------------- pedaços */

function SectionTitle({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <span className="text-xs">{emoji}</span>
      <span className="font-orbitron text-white/45 tracking-widest text-[10px]">{text}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="font-orbitron font-bold text-[9px] tracking-wider px-2 py-1 rounded-md whitespace-nowrap"
      style={{ background: `${color}1f`, border: `1px solid ${color}66`, color }}>{children}</span>
  );
}

function CmdLine({ cmd, desc, color }: { cmd: string; desc: string; color: string }) {
  return (
    <div className="leading-tight">
      <span className="font-rajdhani font-bold text-[11px]" style={{ color }}>{cmd}</span>
      <span className="font-rajdhani text-[10px] text-white/30"> — {desc}</span>
    </div>
  );
}

function PokeballIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 0 6px rgba(255,210,74,0.5))' }}>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#FFD24A" strokeWidth="7" />
      <path d="M6 50h88" stroke="#FFD24A" strokeWidth="7" />
      <circle cx="50" cy="50" r="13" fill="#0a0a0a" stroke="#FFD24A" strokeWidth="7" />
    </svg>
  );
}

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtMin(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}min ${s % 60}s` : `${m}min`;
}
