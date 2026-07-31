'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  leaderboard, playerCount,
  triggerXpRain, triggerHappyHour, triggerSmallRevolt, triggerGiantHunt,
  triggerGoldenZone, triggerMeteor, triggerBoss,
  type World, type LeaderRow,
} from './chatwars/engine';
import { chatWarsSession, type FinalStats } from './chatwars/session';
import { createCamera, updateCamera, render, type Camera } from './chatwars/render';
import { processSprite, getTintedSprite, type ProcessedSprite } from './chatwars/spriteProcessor';
import type { ChatMessage } from '@/types';

const EVENT_COOLDOWN = 14_000;
// Rank da comunidade: só pontua "jogo concluído" se teve interação de chat real.
const MIN_MESSAGES_FOR_RANK = 5;

interface Props { onBack: () => void }

type EventKey = 'xpRain' | 'giantHunt' | 'smallRevolt' | 'meteor' | 'golden' | 'happyHour';

interface EventDef {
  key: EventKey; label: string; icon: string; color: string;
  fn: (w: World) => void; desc: string;
}
const EVENT_DEFS: EventDef[] = [
  { key: 'xpRain', label: 'CHUVA DE XP', icon: '🌧️', color: '#FFD24A', fn: triggerXpRain,
    desc: 'Por 30s quem mandar mensagem no chat ganha 5x pontos. Perfeito pra quem chegou agora crescer rápido.' },
  { key: 'giantHunt', label: 'CAÇA AO GIGANTE', icon: '🎯', color: '#FF3030', fn: triggerGiantHunt,
    desc: 'Marca o maior jogador com uma coroa. Todos correm pra encostar e roubar a massa dele.' },
  { key: 'smallRevolt', label: 'REVOLTA DOS PEQUENOS', icon: '⚡', color: '#53FC1C', fn: triggerSmallRevolt,
    desc: 'Por 25s as bolas pequenas ficam rápidas e mortais — caçam e roubam massa dos gigantes.' },
  { key: 'meteor', label: 'METEORO', icon: '☄️', color: '#FF8A3C', fn: triggerMeteor,
    desc: 'Chovem meteoros no mapa. Acertam os gigantes e explodem a massa deles pelo chão.' },
  { key: 'golden', label: 'ZONA DOURADA', icon: '⭐', color: '#FFE066', fn: triggerGoldenZone,
    desc: 'Surge uma área dourada. Quem ficar dentro ganha pontos dobrados — gera treta na hora.' },
  { key: 'happyHour', label: 'HAPPY HOUR', icon: '🎉', color: '#FF6BD6', fn: triggerHappyHour,
    desc: 'Por 5 min novos viewers ganham +300% de XP. Ótimo pra retenção de quem chegou tarde.' },
];

export default function ChatWarsGame({ onBack }: Props) {
  const {
    chatMessages, setChatRegistrationRequested, setChatRegistrationStopRequested,
    setParticipants, setRaffleStage, setActiveTab, currentUser,
  } = useStore();
  // sprite custom do streamer, ou o padrão da pasta public
  const spriteUrl = currentUser?.chatWarsSprite || '/spritepadrao.png';
  // sprite do LIVE BOSS — cai no sprite neutro se o streamer não configurou um específico
  const bossSpriteUrl = currentUser?.chatWarsBossSprite || spriteUrl;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Camera | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // local state mirrors the persistent session so screens render correctly
  const [running, setRunning] = useState(chatWarsSession.running);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [pcount, setPcount] = useState(0);
  const [moment, setMoment] = useState<{ title: string; sub: string } | null>(null);
  const [activeFx, setActiveFx] = useState<{ xpRain: boolean; golden: boolean; revolt: boolean; hunt: boolean; happy: boolean }>(
    { xpRain: false, golden: false, revolt: false, hunt: false, happy: false });
  const [cooldowns, setCooldowns] = useState<Record<EventKey, number>>({
    xpRain: 0, giantHunt: 0, smallRevolt: 0, meteor: 0, golden: 0, happyHour: 0,
  });
  const [streamerName, setStreamerName] = useState('');
  const [streamerOn, setStreamerOn] = useState(chatWarsSession.streamerOn);
  const [bossActive, setBossActive] = useState(false);
  const [timers, setTimers] = useState<{ key: EventKey; remain: number }[]>([]);
  const [started, setStarted] = useState(chatWarsSession.started);
  const [finished, setFinished] = useState(chatWarsSession.finished);
  const [finalRows, setFinalRows] = useState<LeaderRow[]>(chatWarsSession.finalRows);
  const [finalStats, setFinalStats] = useState<FinalStats>(chatWarsSession.finalStats);
  const [showHelp, setShowHelp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<ProcessedSprite | null>(null);
  const bossSpriteRef = useRef<ProcessedSprite | null>(null);
  // mirror of the processed sprite for render-time consumers (results screen)
  const [sprite, setSprite] = useState<ProcessedSprite | null>(null);

  /* ── boot the persistent session + keep the chat connection alive ────────── */
  useEffect(() => {
    chatWarsSession.init();
    // Liga a escuta do chat pro jogo. Se fomos nós que abrimos, fechamos ao sair —
    // assim voltar pro sorteio não deixa "BUSCANDO NO CHAT" ligado sozinho.
    const wasActive = useStore.getState().chatRegistrationActive;
    if (!wasActive) setChatRegistrationRequested(true);
    return () => { if (!wasActive) setChatRegistrationStopRequested(true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── load + process the sprite (runs once per URL change) ───────────────── */
  useEffect(() => {
    spriteRef.current = null;
    const img = new Image();
    img.onload = () => {
      try { const p = processSprite(img); spriteRef.current = p; setSprite(p); }
      catch { spriteRef.current = null; setSprite(null); }
    };
    img.onerror = () => { spriteRef.current = null; setSprite(null); };
    img.src = spriteUrl;
    return () => { spriteRef.current = null; };
  }, [spriteUrl]);

  /* ── load + process the LIVE BOSS sprite (runs once per URL change) ──────── */
  useEffect(() => {
    bossSpriteRef.current = null;
    const img = new Image();
    img.onload = () => {
      try { bossSpriteRef.current = processSprite(img); }
      catch { bossSpriteRef.current = null; }
    };
    img.onerror = () => { bossSpriteRef.current = null; };
    img.src = bossSpriteUrl;
    return () => { bossSpriteRef.current = null; };
  }, [bossSpriteUrl]);

  /* ── canvas sizing ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [started, finished]);

  /* ── render loop — draws the session world (stepping happens in session) ──── */
  useEffect(() => {
    if (!camRef.current) camRef.current = createCamera(chatWarsSession.world);
    const loop = (t: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      const cam = camRef.current!;
      const { w, h, dpr } = sizeRef.current;
      const dtMs = lastTimeRef.current ? t - lastTimeRef.current : 16;
      lastTimeRef.current = t;
      const dt = Math.min(dtMs, 50) / 1000;

      if (ctx && w > 0 && h > 0) {
        updateCamera(cam, chatWarsSession.world, w, h, dt);
        ctx.save();
        ctx.scale(dpr, dpr);
        render(ctx, chatWarsSession.world, cam, w, h, spriteRef.current, bossSpriteRef.current);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  /* ── UI snapshot (board / events / moment / session flags) ───────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      const w = chatWarsSession.world;
      setBoard(leaderboard(w, 5));
      setPcount(playerCount(w));
      setActiveFx({
        xpRain: w.time < w.events.xpRain,
        golden: !!w.golden,
        revolt: w.time < w.events.smallRevolt,
        hunt: w.time < w.events.giantHunt && !!w.huntedId,
        happy: w.time < w.events.happyHour,
      });
      setBossActive(!!w.bossId);
      setMoment(w.moment ? { title: w.moment.title, sub: w.moment.sub } : null);
      setRunning(chatWarsSession.running);
      setStreamerOn(chatWarsSession.streamerOn);

      const now = w.time;
      const t: { key: EventKey; remain: number }[] = [];
      const push = (key: EventKey, until: number) => {
        if (until > now) t.push({ key, remain: Math.ceil((until - now) / 1000) });
      };
      push('xpRain', w.events.xpRain);
      if (w.huntedId) push('giantHunt', w.events.giantHunt);
      push('smallRevolt', w.events.smallRevolt);
      push('happyHour', w.events.happyHour);
      if (w.golden) push('golden', w.golden.until);
      setTimers(t);
    }, 200);
    return () => clearInterval(iv);
  }, []);

  /* ── keep the live chat scrolled to the bottom ───────────────────────────── */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  /* ── cooldown ticker ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      setCooldowns(prev => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        (Object.keys(prev) as EventKey[]).forEach(k => {
          if (prev[k] > 0 && prev[k] <= now) { next[k] = 0; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 250);
    return () => clearInterval(iv);
  }, []);

  const fireEvent = useCallback((key: EventKey, fn: (w: World) => void) => {
    if (cooldowns[key] > Date.now()) return;
    chatWarsSession.fireEvent(fn);
    setCooldowns(prev => ({ ...prev, [key]: Date.now() + EVENT_COOLDOWN }));
  }, [cooldowns]);

  const handleStreamerToggle = useCallback(() => {
    chatWarsSession.toggleStreamer(streamerName || 'STREAMER');
    setStreamerOn(chatWarsSession.streamerOn);
  }, [streamerName]);

  const handlePlay = useCallback(() => { chatWarsSession.start(); setStarted(true); setRunning(true); }, []);

  const togglePause = useCallback(() => {
    if (chatWarsSession.running) { chatWarsSession.pause(); setRunning(false); }
    else { chatWarsSession.resume(); setRunning(true); }
  }, []);

  const handleFinalize = useCallback(() => {
    chatWarsSession.finalize();
    setFinalRows(chatWarsSession.finalRows);
    setFinalStats(chatWarsSession.finalStats);
    setRunning(false);
    setFinished(true);
    if (chatWarsSession.finalStats.messages >= MIN_MESSAGES_FOR_RANK) {
      fetch('/api/streamer/rank-game-completed', { method: 'POST' }).catch(() => {});
    }
  }, []);

  const handleContinue = useCallback(() => { chatWarsSession.continueGame(); setFinished(false); setRunning(true); }, []);

  /* ── Sorteio: quem jogou vira participante ────────────────────────────────── */
  /*    weighted=true  → tickets proporcionais aos pontos (1 a cada 10 pts)     */
  /*    weighted=false → 1 ticket pra todo mundo, pontos não contam             */
  /*    Não para o jogo — a sessão continua rodando em segundo plano. */
  const handleSorteio = useCallback((weighted: boolean) => {
    const rows = leaderboard(chatWarsSession.world, 9999);
    const parts = rows.map((r, i) => ({
      id: `cw_${r.id}_${i}`,
      number: i + 1,
      name: r.name,
      source: r.source,
      ...(weighted && { tickets: Math.max(1, Math.floor(r.mass / 10)) }),
    }));
    setParticipants(parts);
    setChatRegistrationStopRequested(true); // fecha a lista: só quem jogou entra
    setRaffleStage(1);
    setActiveTab('raffle');
  }, [setParticipants, setChatRegistrationStopRequested, setRaffleStage, setActiveTab]);

  const handleReset = useCallback(() => {
    chatWarsSession.reset();
    camRef.current = createCamera(chatWarsSession.world);
    setStreamerOn(false);
    setBoard([]);
    setPcount(0);
  }, []);

  const activeMap: Record<EventKey, boolean> = {
    xpRain: activeFx.xpRain, giantHunt: activeFx.hunt, smallRevolt: activeFx.revolt,
    meteor: false, golden: activeFx.golden, happyHour: activeFx.happy,
  };

  if (!started) {
    return (
      <IntroScreen onPlay={handlePlay} onBack={onBack} onHelp={() => setShowHelp(true)}
        showHelp={showHelp} onCloseHelp={() => setShowHelp(false)} />
    );
  }

  if (finished) {
    return (
      <ResultsScreen rows={finalRows} stats={finalStats} messages={chatMessages} endRef={chatEndRef}
        sprite={sprite}
        onSorteio={handleSorteio} onContinue={handleContinue} onExit={onBack} />
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
        <button onClick={onBack}
          className="flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          VOLTAR
        </button>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <SwordIcon />
        <span className="font-orbitron font-bold text-sm tracking-widest text-white">CHAT WARS</span>
        <span className="font-rajdhani text-xs tracking-wider text-white/35 ml-1">
          {pcount} {pcount === 1 ? 'jogador' : 'jogadores'} no mapa
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!running ? (
            <CtrlButton onClick={togglePause} color="#53FC1C">
              ▶ RETOMAR
            </CtrlButton>
          ) : (
            <CtrlButton onClick={togglePause} color="#FFD24A">
              ⏸ PAUSAR
            </CtrlButton>
          )}
          <CtrlButton onClick={handleReset} color="#FF6B6B">↺ RESET</CtrlButton>
          <CtrlButton onClick={handleFinalize} color="#A855F7">🏁 FINALIZAR</CtrlButton>
        </div>
      </div>

      {/* Ranking (left) · Arena (center) · Chat + Poderes (right) */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: RANKING + STREAMER BALL ── */}
        <div className="flex flex-col flex-shrink-0"
          style={{ width: 268, background: 'rgba(5,8,22,0.93)', borderRight: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-center gap-2 flex-shrink-0"
            style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-base">🏆</span>
            <span className="font-orbitron text-white/45 tracking-widest text-xs">TOP 5</span>
            <motion.div className="w-2 h-2 rounded-full bg-red-500 ml-auto"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px', scrollbarWidth: 'none' }}>
            {board.length === 0 ? (
              <p className="font-rajdhani text-white/20 text-center text-xs tracking-wider mt-6">
                aguardando jogadores...
              </p>
            ) : board.map((row, i) => (
              <div key={row.id}
                className="flex items-center gap-2 py-2 px-2 rounded-lg mb-1"
                style={{ background: i === 0 ? 'rgba(255,210,74,0.08)' : 'rgba(255,255,255,0.02)' }}>
                <span className="font-orbitron text-xs w-5 text-center flex-shrink-0"
                  style={{ color: i === 0 ? '#FFD24A' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: `hsl(${row.hue},90%,60%)`, boxShadow: `0 0 6px hsl(${row.hue},90%,60%)` }} />
                <span className="font-rajdhani font-bold text-xs text-white truncate flex-1 flex items-center gap-1">
                  {row.hunted && <span title="caçado">👑</span>}
                  {row.streamer && <span title="streamer">⭐</span>}
                  {row.name}
                </span>
                {row.streak >= 5 && (
                  <span className="font-rajdhani text-[10px] text-[#FFD24A]" title="combo">🔥{row.streak}</span>
                )}
                <span className="font-orbitron text-[11px] text-[#00E5FF] flex-shrink-0">{row.mass}</span>
              </div>
            ))}
          </div>

          {/* powers */}
          <div className="flex-shrink-0" style={{ padding: '12px 14px', borderTop: '1px solid rgba(0,229,255,0.12)', background: 'rgba(124,58,237,0.04)' }}>
            <span className="font-orbitron text-white/45 tracking-widest text-[11px]">⚡ EVENTOS DO STREAMER</span>

            <div className="grid grid-cols-3 gap-2 mt-2">
              {EVENT_DEFS.map(def => (
                <EventCard key={def.key} def={def} active={activeMap[def.key]}
                  cooldownUntil={cooldowns[def.key]} disabled={!running}
                  onClick={() => fireEvent(def.key, def.fn)} />
              ))}
            </div>

            {/* LIVE BOSS */}
            <button onClick={() => { if (running && !bossActive) chatWarsSession.fireEvent(triggerBoss); }}
              disabled={!running || bossActive}
              className="w-full mt-2.5 rounded-xl flex flex-col items-center justify-center py-2.5 transition-all"
              style={{
                background: bossActive ? 'rgba(120,20,20,0.35)' : 'linear-gradient(135deg, rgba(255,40,40,0.22), rgba(140,10,30,0.45))',
                border: `1px solid ${bossActive ? 'rgba(255,80,80,0.4)' : 'rgba(255,60,60,0.7)'}`,
                boxShadow: bossActive ? '0 0 16px rgba(255,40,40,0.5)' : '0 0 16px rgba(255,40,40,0.3)',
                cursor: !running || bossActive ? 'not-allowed' : 'pointer',
                opacity: !running ? 0.45 : 1,
              }}>
              <span className="font-orbitron font-bold text-sm tracking-widest flex items-center gap-2"
                style={{ color: bossActive ? 'rgba(255,150,150,0.85)' : '#FF5555' }}>
                💀 LIVE BOSS
              </span>
              <span className="font-rajdhani text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {bossActive ? 'CHEFE NO MAPA — DERROTEM JUNTOS!' : 'INVOCA O CHEFE DO CHAT'}
              </span>
            </button>
          </div>

          {/* streamer ball */}
          <div className="flex-shrink-0" style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="font-orbitron text-white/35 tracking-widest text-[10px]">STREAMER BALL</span>
            <div className="flex gap-2 mt-2">
              <input value={streamerName} onChange={e => setStreamerName(e.target.value)}
                placeholder="seu nick" disabled={streamerOn}
                className="flex-1 min-w-0 font-rajdhani text-xs px-2 py-1.5 rounded-lg text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }} />
              <button onClick={handleStreamerToggle}
                className="font-orbitron text-[10px] tracking-widest px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{
                  background: streamerOn ? 'rgba(255,107,107,0.18)' : 'rgba(0,229,255,0.12)',
                  border: `1px solid ${streamerOn ? 'rgba(255,107,107,0.5)' : 'rgba(0,229,255,0.4)'}`,
                  color: streamerOn ? '#FF6B6B' : '#00E5FF',
                }}>
                {streamerOn ? 'TIRAR' : 'ENTRAR'}
              </button>
            </div>
            <p className="font-rajdhani text-[10px] text-white/30 mt-1.5 leading-snug">
              chat com <span className="text-[#7CFFB2]">gg / amo / top</span> alimenta · <span className="text-[#FF6B6B]">lixo / troll / cai</span> trolla
            </p>
          </div>
        </div>

        {/* ── CENTER: ARENA ── */}
        <div ref={wrapRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          <canvas ref={canvasRef} className="block" />

          {/* arena title */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="font-orbitron font-bold text-sm tracking-[0.35em]"
              style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 0 14px rgba(124,58,237,0.8)' }}>
              A BATALHA DO CHAT!
            </span>
          </div>

          {/* active power timers */}
          <div className="absolute top-9 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
            <AnimatePresence>
              {timers.map(t => {
                const m = EVENT_DEFS.find(d => d.key === t.key)!;
                const label = t.remain >= 60
                  ? `${Math.floor(t.remain / 60)}:${String(t.remain % 60).padStart(2, '0')}`
                  : `${t.remain}s`;
                return (
                  <motion.div key={t.key}
                    initial={{ opacity: 0, scale: 0.7, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.7, y: -6 }} transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1"
                    style={{
                      background: `${m.color}26`, border: `1px solid ${m.color}`,
                      boxShadow: `0 0 12px ${m.color}55`,
                    }}>
                    <span className="text-xs leading-none">{m.icon}</span>
                    <span className="font-orbitron font-bold text-[9px] tracking-widest" style={{ color: '#fff' }}>{m.label}</span>
                    <span className="font-orbitron font-bold text-[11px] tabular-nums" style={{ color: m.color }}>{label}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* full-screen event tints */}
          <FxTint show={activeFx.xpRain} color="rgba(255,210,74,0.10)" />
          <FxTint show={activeFx.golden} color="rgba(255,190,60,0.07)" />
          <FxTint show={activeFx.revolt} color="rgba(83,252,28,0.07)" />
          <FxTint show={activeFx.hunt} color="rgba(255,48,48,0.07)" />

          {/* idle hint */}
          {!running && pcount === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
              <SwordIcon big />
              <h2 className="font-orbitron font-bold text-xl tracking-widest text-white mt-4">CHAT WARS</h2>
              <p className="font-rajdhani text-sm text-white/45 mt-2 max-w-md leading-relaxed">
                Cada viewer que falar no chat vira uma bolinha viva. Quanto mais participa, mais cresce.
                Clique <span className="text-[#53FC1C] font-bold">INICIAR</span> e mande a galera mandar mensagem!
              </p>
            </div>
          )}

          {/* live moment banner */}
          <AnimatePresence>
            {moment && (
              <motion.div key={moment.title}
                className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none text-center"
                initial={{ opacity: 0, scale: 0.6, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
                <div className="font-orbitron font-bold text-2xl tracking-widest"
                  style={{ color: '#fff', textShadow: '0 0 18px rgba(0,229,255,0.9), 0 0 6px rgba(255,255,255,0.8)' }}>
                  {moment.title}
                </div>
                <div className="font-rajdhani text-sm tracking-wide text-white/70 mt-1">{moment.sub}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: CHAT DA LIVE ── */}
        <LiveChatPanel messages={chatMessages} endRef={chatEndRef} />
      </div>

    </div>
  );
}

/* ── Live chat panel (shared by game + results) ──────────────────────────── */
function LiveChatPanel({ messages, endRef }: {
  messages: ChatMessage[]; endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col flex-shrink-0"
      style={{ width: 420, background: 'rgba(5,8,22,0.93)', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>
      <div className="flex items-center gap-3 flex-shrink-0"
        style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="font-orbitron text-white/40 tracking-widest text-xs">CHAT DA LIVE</span>
        <motion.div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" style={{ padding: '16px 20px', scrollbarWidth: 'none' }}>
        {messages.length === 0 ? (
          <p className="font-rajdhani text-white/20 text-center tracking-wider leading-relaxed text-xs">
            aguardando mensagens...
          </p>
        ) : messages.slice(-50).map(msg => (
          <div key={msg.id} className="leading-relaxed break-words text-xs">
            <span className="font-rajdhani font-bold" style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {msg.source === 'twitch' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}>
                  <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                </svg>
              )}
              {msg.source === 'kick' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}>
                  <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                </svg>
              )}
              {msg.source === 'youtube' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                  <path d="m10 15 5-3-5-3z"/>
                </svg>
              )}
              {msg.username}
            </span>
            <span className="font-rajdhani text-white/25">: </span>
            <span className="font-rajdhani text-white/65">{msg.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ── small UI pieces ─────────────────────────────────────────────────────── */
function CtrlButton({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-lg transition-all"
      style={{ background: `${color}1f`, border: `1px solid ${color}66`, color }}>
      {children}
    </button>
  );
}

function EventCard({ def, active, cooldownUntil, disabled, onClick }: {
  def: EventDef; active: boolean; cooldownUntil: number; disabled: boolean; onClick: () => void;
}) {
  const [remain, setRemain] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setRemain(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))), 200);
    return () => clearInterval(iv);
  }, [cooldownUntil]);
  const onCd = remain > 0;
  const dimmed = disabled || onCd;
  const { color, icon, label, desc } = def;
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={dimmed}
        className="w-full relative flex flex-col items-center justify-center gap-1 rounded-xl transition-all overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          background: active ? `${color}30` : dimmed ? 'rgba(255,255,255,0.03)' : `${color}12`,
          border: `1px solid ${active ? color : dimmed ? 'rgba(255,255,255,0.08)' : color + '55'}`,
          boxShadow: active ? `0 0 16px ${color}66, inset 0 0 12px ${color}33` : 'none',
          cursor: dimmed ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}>
        <span className="text-xl leading-none" style={{ filter: dimmed ? 'grayscale(0.6)' : 'none' }}>{icon}</span>
        <span className="font-orbitron font-bold tracking-wide leading-tight text-center px-0.5"
          style={{ fontSize: 8, color: active ? '#fff' : dimmed ? 'rgba(255,255,255,0.4)' : color }}>
          {label}
        </span>
        {onCd && (
          <div className="absolute inset-0 flex items-center justify-center font-orbitron font-bold text-lg"
            style={{ background: 'rgba(5,8,22,0.7)', color: '#fff' }}>
            {remain}
          </div>
        )}
      </button>

      {/* popup próprio — abre pro lado da arena (direita) */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 pointer-events-none
                      opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-left"
        style={{ width: 210 }}>
        <div className="rounded-xl px-3 py-2.5 shadow-xl"
          style={{ background: 'rgba(8,11,28,0.97)', border: `1px solid ${color}`, boxShadow: `0 0 20px ${color}55` }}>
          <div className="flex items-center gap-1.5 font-orbitron font-bold text-[11px] tracking-widest" style={{ color }}>
            <span className="text-sm">{icon}</span>{label}
          </div>
          <p className="font-rajdhani text-[12px] leading-snug mt-1.5" style={{ color: 'rgba(255,255,255,0.78)' }}>{desc}</p>
        </div>
        {/* seta apontando pro card */}
        <div className="absolute right-full top-1/2 -translate-y-1/2"
          style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: `7px solid ${color}` }} />
      </div>
    </div>
  );
}

function FxTint({ show, color }: { show: boolean; color: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: color }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} />
      )}
    </AnimatePresence>
  );
}

/* ── Intro / landing screen ──────────────────────────────────────────────── */
interface DecoSpec {
  hue: number; name: string; size: number; mood: 'angry' | 'happy' | 'smug' | 'surprised';
  crown?: boolean; pos: React.CSSProperties; delay: number;
}
const DECO_BALLS: DecoSpec[] = [
  { hue: 0,   name: 'ifexsternz2',      size: 180, mood: 'angry',     crown: true, pos: { top: '8%',  left: '2%' },    delay: 0 },
  { hue: 210, name: 'Tio_DanCS',        size: 120, mood: 'angry',     pos: { bottom: '8%', left: '4%' },              delay: 0.6 },
  { hue: 280, name: 'tvsleep',          size: 140, mood: 'happy',     pos: { top: '34%', right: '3%' },               delay: 0.3 },
  { hue: 140, name: 'gustavokobemusic', size: 120, mood: 'surprised', pos: { bottom: '6%', right: '5%' },             delay: 0.9 },
  { hue: 30,  name: 'lookmydemon',      size: 78,  mood: 'smug',      pos: { top: '6%',  right: '12%' },              delay: 0.45 },
];
const ACCENT_DOTS: { hue: number; size: number; pos: React.CSSProperties; delay: number }[] = [
  { hue: 50,  size: 16, pos: { top: '18%', left: '30%' }, delay: 0.2 },
  { hue: 200, size: 12, pos: { top: '12%', left: '46%' }, delay: 0.5 },
  { hue: 320, size: 14, pos: { bottom: '20%', left: '24%' }, delay: 0.8 },
  { hue: 160, size: 10, pos: { bottom: '30%', right: '26%' }, delay: 0.35 },
  { hue: 280, size: 18, pos: { top: '46%', left: '12%' }, delay: 0.65 },
  { hue: 20,  size: 12, pos: { bottom: '14%', left: '46%' }, delay: 0.95 },
];

function IntroScreen({ onPlay, onBack, onHelp, showHelp, onCloseHelp }: {
  onPlay: () => void; onBack: () => void; onHelp: () => void; showHelp: boolean; onCloseHelp: () => void;
}) {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at 50% 38%, #1a1140 0%, #0d0a26 45%, #04030f 100%),' +
          'radial-gradient(circle at 18% 28%, rgba(120,60,220,0.25), transparent 40%),' +
          'radial-gradient(circle at 82% 30%, rgba(40,90,230,0.22), transparent 42%),' +
          'radial-gradient(circle at 30% 80%, rgba(210,40,170,0.20), transparent 40%)',
      }}>
      {/* back */}
      <button onClick={onBack}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        VOLTAR
      </button>

      {/* decorative balls */}
      {DECO_BALLS.map((d, i) => <DecoBall key={i} spec={d} />)}
      {ACCENT_DOTS.map((d, i) => (
        <motion.div key={`dot${i}`} className="absolute rounded-full"
          style={{ ...d.pos, width: d.size, height: d.size,
            background: `radial-gradient(circle at 35% 30%, hsl(${d.hue},100%,75%), hsl(${d.hue},90%,50%))`,
            boxShadow: `0 0 12px hsl(${d.hue},90%,55%)` }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3 + d.delay, repeat: Infinity, ease: 'easeInOut', delay: d.delay }} />
      ))}

      {/* center hero */}
      <motion.div className="relative z-10 flex flex-col items-center text-center px-6"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* crown */}
        <motion.div style={{ fontSize: 40, lineHeight: 1, filter: 'drop-shadow(0 0 10px rgba(255,210,74,0.8))' }}
          animate={{ y: [0, -6, 0], rotate: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          👑
        </motion.div>

        {/* logo */}
        <div className="leading-[0.82] -mt-1" style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontStyle: 'italic' }}>
          <div style={{ fontSize: 'clamp(46px, 8vw, 88px)', color: '#fff', textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(120,80,240,0.55)' }}>
            CHAT
          </div>
          <div style={{
            fontSize: 'clamp(46px, 8vw, 88px)',
            backgroundImage: 'linear-gradient(90deg, #a855f7, #6366f1, #22d3ee)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: 'drop-shadow(0 0 22px rgba(99,102,241,0.6))',
          }}>
            WARS
          </div>
        </div>

        {/* subtitle */}
        <div className="flex items-center gap-3 mt-3">
          <span style={{ width: 28, height: 2, background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
          <span className="font-orbitron font-bold text-xs tracking-[0.3em] text-white/85">A BATALHA DO CHAT!</span>
          <span style={{ width: 28, height: 2, background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
        </div>

        {/* pitch */}
        <p className="font-rajdhani text-base text-white/65 mt-6 leading-relaxed max-w-sm">
          Participe do chat, ganhe pontos,<br />cresça sua bola e domine o mapa!<br />
          Quanto mais você fala, <span className="font-bold" style={{ color: '#FF6BD6' }}>maior</span> você fica!
        </p>

        {/* play */}
        <motion.button onClick={onPlay}
          className="mt-7 flex items-center justify-center gap-3 font-orbitron font-black tracking-widest text-white rounded-2xl"
          style={{
            padding: '16px 56px', fontSize: 18,
            background: 'linear-gradient(180deg, #5df66e, #22c248)',
            boxShadow: '0 8px 24px rgba(34,194,72,0.45), inset 0 2px 0 rgba(255,255,255,0.4)',
            border: '1px solid rgba(120,255,140,0.6)',
          }}
          whileHover={{ scale: 1.04, boxShadow: '0 10px 32px rgba(34,194,72,0.6), inset 0 2px 0 rgba(255,255,255,0.5)' }}
          whileTap={{ scale: 0.97 }}>
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '4px 6px', display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
          </span>
          JOGAR AGORA
        </motion.button>

        {/* how to play */}
        <button onClick={onHelp}
          className="mt-3 flex items-center gap-2 font-orbitron text-xs tracking-widest rounded-xl px-5 py-2.5 transition-all"
          style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.06)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" strokeLinecap="round" /><circle cx="12" cy="17" r="0.6" fill="currentColor" />
          </svg>
          COMO JOGAR
        </button>
      </motion.div>

      <HowToPlay open={showHelp} onClose={onCloseHelp} onPlay={onPlay} />
    </div>
  );
}

function DecoBall({ spec }: { spec: DecoSpec }) {
  const { hue, name, size, mood, crown, pos, delay } = spec;
  const eye = size * 0.13;
  const eyeTop = size * 0.3;
  const eyeGap = size * 0.16;
  const angry = mood === 'angry';
  return (
    <motion.div className="absolute hidden md:block" style={{ ...pos, width: size, height: size }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, y: [0, -16, 0] }}
      transition={{ opacity: { duration: 0.5, delay }, scale: { duration: 0.5, delay },
        y: { duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay } }}>
      {crown && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.22, fontSize: size * 0.34, filter: 'drop-shadow(0 0 8px rgba(255,210,74,0.8))' }}>👑</div>
      )}
      <div className="relative w-full h-full rounded-full flex flex-col items-center justify-end"
        style={{
          background: `radial-gradient(circle at 32% 28%, hsl(${hue},100%,80%), hsl(${hue},88%,52%) 58%, hsl(${hue},85%,32%))`,
          boxShadow: `0 0 34px hsl(${hue},90%,55%), inset 0 -10px 22px rgba(0,0,0,0.4), inset 8px 10px 18px rgba(255,255,255,0.35)`,
          border: `2px solid hsl(${hue},100%,82%)`,
        }}>
        {/* eyes */}
        <div className="absolute" style={{ top: eyeTop, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: eyeGap }}>
          {[-1, 1].map(s => (
            <div key={s} className="relative rounded-full bg-white"
              style={{ width: eye, height: angry ? eye * 0.7 : eye, transform: angry ? `rotate(${s * 18}deg)` : 'none' }}>
              <div className="absolute rounded-full" style={{ width: eye * 0.5, height: eye * 0.5, background: '#1a0a20', bottom: 1, left: '50%', transform: 'translateX(-50%)' }} />
            </div>
          ))}
        </div>
        {/* name */}
        <span className="font-orbitron font-bold text-white relative z-10"
          style={{ fontSize: Math.max(10, size * 0.11), marginBottom: size * 0.16, textShadow: '0 2px 4px rgba(0,0,0,0.7)' }}>
          {name}
        </span>
      </div>
    </motion.div>
  );
}

function HowToPlay({ open, onClose, onPlay }: { open: boolean; onClose: () => void; onPlay: () => void }) {
  const rules: [string, string][] = [
    ['💬', 'Cada mensagem no chat dá pontos pra sua bola. Quanto mais (e melhor) você fala, maior ela fica.'],
    ['🐢', 'Bola grande é mais forte, mas mais lenta. Bola pequena é rápida e foge fácil.'],
    ['💥', 'Quando duas bolas se esbarram, a maior morde a menor e rouba 1 de vida — uma vez por batida, aí quicam e se separam.'],
    ['🚫', 'Spam, flood e mensagens repetidas valem quase nada. Mensagens muito curtas valem menos.'],
    ['🔥', 'Combos: 5 e 20 mensagens seguidas dão bônus extra de pontos.'],
    ['⚡', 'Roubo em massa (dreno rápido) só rola nos PODERES do streamer (Caça ao Gigante, Revolta dos Pequenos, Meteoro e Live Boss).'],
    ['💀', 'Live Boss: o chat inteiro precisa derrotar o chefe junto, encostando nele.'],
    ['🛡️', 'Sua bola nunca morre — ela pode encolher até o mínimo, mas continua sempre em jogo.'],
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-30 flex items-center justify-center p-6"
          style={{ background: 'rgba(3,4,12,0.7)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={e => e.stopPropagation()}
            className="relative rounded-2xl w-full max-w-lg"
            style={{ background: 'rgba(8,11,28,0.98)', border: '1px solid rgba(0,229,255,0.3)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}
            initial={{ scale: 0.9, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 10 }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xl">🎮</span>
              <span className="font-orbitron font-bold text-sm tracking-widest text-white">COMO JOGAR</span>
              <button onClick={onClose} className="ml-auto text-white/40 hover:text-white transition-colors font-orbitron text-lg leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {rules.map(([icon, txt], i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0">{icon}</span>
                  <p className="font-rajdhani text-sm text-white/75 leading-snug">{txt}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => { onClose(); onPlay(); }}
                className="w-full flex items-center justify-center gap-2 font-orbitron font-bold tracking-widest text-white rounded-xl py-3"
                style={{ background: 'linear-gradient(180deg, #5df66e, #22c248)', border: '1px solid rgba(120,255,140,0.6)', boxShadow: '0 6px 18px rgba(34,194,72,0.4)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                BORA JOGAR!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Results / podium screen ─────────────────────────────────────────────── */
function fmtPts(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
  return String(Math.round(n));
}

// deterministic confetti specs (computed once)
const CONFETTI = (() => {
  let s = 1234567;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cols = ['#FFD24A', '#FF5BAE', '#7C5CFF', '#22D3EE', '#53FC1C', '#FF8A3C'];
  return Array.from({ length: 40 }, () => ({
    left: rnd() * 100, top: rnd() * 72, col: cols[Math.floor(rnd() * cols.length)],
    w: 4 + rnd() * 5, h: 7 + rnd() * 9, rot: rnd() * 360, delay: rnd() * 2.5, dur: 2.4 + rnd() * 2.5,
  }));
})();

function BallFace({ mood, wink, size }: { mood: 'happy' | 'angry'; wink?: boolean; size: number }) {
  const dark = '#1a0a20';
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 pointer-events-none" width={size} height={size}>
      {mood === 'happy' ? (
        <>
          {/* left eye */}
          <circle cx="35" cy="43" r="10" fill="#fff" />
          <circle cx="35" cy="44" r="5.2" fill={dark} />
          <circle cx="37" cy="42" r="1.8" fill="#fff" />
          {/* right eye — wink or open */}
          {wink ? (
            <path d="M56 45 Q66 37 76 45" stroke={dark} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="65" cy="43" r="10" fill="#fff" />
              <circle cx="65" cy="44" r="5.2" fill={dark} />
              <circle cx="67" cy="42" r="1.8" fill="#fff" />
            </>
          )}
          {/* big open smile */}
          <path d="M33 60 Q50 86 67 60 Q50 70 33 60 Z" fill={dark} />
          <path d="M40 66 Q50 74 60 66" fill="#ff5e7a" opacity="0.9" />
        </>
      ) : (
        <>
          {/* angry slanted eyes */}
          <g transform="rotate(-18 35 45)"><ellipse cx="35" cy="45" rx="10" ry="7" fill="#fff" /><circle cx="35" cy="47" r="4.6" fill={dark} /></g>
          <g transform="rotate(18 65 45)"><ellipse cx="65" cy="45" rx="10" ry="7" fill="#fff" /><circle cx="65" cy="47" r="4.6" fill={dark} /></g>
          {/* brows */}
          <path d="M22 33 L44 41" stroke={dark} strokeWidth="5.5" strokeLinecap="round" />
          <path d="M78 33 L56 41" stroke={dark} strokeWidth="5.5" strokeLinecap="round" />
          {/* gritted mouth */}
          <path d="M37 66 Q50 60 63 66 Q50 74 37 66 Z" fill={dark} />
        </>
      )}
    </svg>
  );
}

function ResultBall({ hue, name, size, rank, crown, streamer, sprite }: {
  hue: number; name: string; size: number; rank: number; crown?: boolean; streamer?: boolean;
  sprite?: ProcessedSprite | null;
}) {
  const mood: 'happy' | 'angry' = rank === 1 || rank === 5 ? 'happy' : 'angry';
  // tinted sprite as a data URL (cached per hue), same look as in-game
  const spriteUrl = useMemo(
    () => (sprite ? getTintedSprite(sprite, hue).toDataURL() : null),
    [sprite, hue],
  );
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {crown && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.4, fontSize: size * 0.44, filter: 'drop-shadow(0 0 10px rgba(255,210,74,0.95))' }}>👑</div>
      )}
      <div className="w-full h-full rounded-full relative flex items-end justify-center overflow-hidden"
        style={{
          // scaled past 100% so the sprite's transparent margin is pushed out and
          // the artwork fills the whole circle (overflow clipped to the round shape)
          background: spriteUrl
            ? `center / 138% 138% no-repeat url(${spriteUrl})`
            : `radial-gradient(circle at 32% 26%, hsl(${hue},100%,82%), hsl(${hue},90%,54%) 56%, hsl(${hue},85%,32%))`,
          boxShadow: spriteUrl
            ? `0 0 30px hsl(${hue},90%,55%)`
            : `0 0 30px hsl(${hue},90%,55%), inset 0 -9px 20px rgba(0,0,0,0.42), inset 7px 9px 16px rgba(255,255,255,0.4)`,
          border: spriteUrl ? 'none' : `2px solid ${streamer ? '#9be9ff' : `hsl(${hue},100%,84%)`}`,
        }}>
        <BallFace mood={mood} wink={rank === 1} size={size} />
        <span className="font-orbitron font-bold text-white relative z-10 truncate px-1"
          style={{ fontSize: Math.max(9, size * 0.115), marginBottom: size * 0.1, maxWidth: size * 0.96, textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}>
          {name}
        </span>
      </div>
    </div>
  );
}

function GoldLaurel({ size }: { size: number }) {
  const leaf = (x: number, y: number, rot: number, k: number) => (
    <ellipse key={k} cx={x} cy={y} rx="5.5" ry="2.8" transform={`rotate(${rot} ${x} ${y})`} fill="url(#laurelG)" />
  );
  return (
    <svg viewBox="0 0 90 70" width={size} height={size * 0.78} className="pointer-events-none">
      <defs>
        <linearGradient id="laurelG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF1A6" /><stop offset="1" stopColor="#D9971A" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map(i => leaf(20 - i * 1.5, 56 - i * 11, 70 - i * 12, i))}
      {[0, 1, 2, 3, 4].map(i => leaf(70 + i * 1.5, 56 - i * 11, -70 + i * 12, i + 10))}
    </svg>
  );
}

const PODIUM_H = [128, 92, 70];
const PODIUM_BALL = [150, 112, 104];
const PODIUM_GRAD = [
  'linear-gradient(180deg,#7c3aed,#4324a0)',
  'linear-gradient(180deg,#6d5bd0,#3a2f86)',
  'linear-gradient(180deg,#8a4fd6,#4a2a8a)',
];

function PodiumPlace({ row, rank, sprite }: { row: LeaderRow; rank: 1 | 2 | 3; sprite?: ProcessedSprite | null }) {
  const idx = rank - 1;
  return (
    <motion.div className="flex flex-col items-center justify-end relative z-10"
      initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.12, type: 'spring', stiffness: 220, damping: 18 }}>
      <ResultBall hue={row.hue} name={row.name} size={PODIUM_BALL[idx]} rank={rank} crown={rank === 1} streamer={row.streamer} sprite={sprite} />
      <div className="font-orbitron font-black mt-1.5" style={{ color: '#FFD24A', fontSize: rank === 1 ? 24 : 19, textShadow: '0 0 12px rgba(255,210,74,0.7)' }}>
        {fmtPts(row.mass)}
      </div>
      <div className="font-orbitron text-white/45 tracking-widest" style={{ fontSize: 9, marginTop: -2 }}>PONTOS</div>
      {/* pedestal */}
      <div className="relative flex flex-col items-center justify-center mt-2"
        style={{
          width: rank === 1 ? 150 : 124, height: PODIUM_H[idx],
          borderRadius: '12px 12px 4px 4px', background: PODIUM_GRAD[idx],
          border: '1px solid rgba(180,150,255,0.55)',
          boxShadow: `0 12px 30px rgba(80,40,160,0.5), inset 0 3px 0 rgba(255,255,255,0.28), inset 0 -10px 18px rgba(0,0,0,0.3)`,
        }}>
        {rank === 1 && (
          <div className="absolute" style={{ top: '52%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.9 }}>
            <GoldLaurel size={92} />
          </div>
        )}
        <span className="font-orbitron font-black text-white relative z-10"
          style={{ fontSize: rank === 1 ? 52 : 38, textShadow: '0 3px 8px rgba(0,0,0,0.5)' }}>{rank}</span>
      </div>
    </motion.div>
  );
}

function SidePlace({ row, rank, sprite }: { row: LeaderRow; rank: number; sprite?: ProcessedSprite | null }) {
  return (
    <motion.div className="flex flex-col items-center justify-end pb-1 relative z-10"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
      <div className="font-orbitron font-black text-white/45 text-sm mb-1">{rank}º</div>
      <ResultBall hue={row.hue} name={row.name} size={70} rank={rank} streamer={row.streamer} sprite={sprite} />
      <div className="font-orbitron font-bold mt-1" style={{ color: '#FFD24A', fontSize: 13 }}>{fmtPts(row.mass)}</div>
      <div className="font-orbitron text-white/40 tracking-widest" style={{ fontSize: 7 }}>PTS</div>
    </motion.div>
  );
}

function ResultsScreen({ rows, stats, messages, endRef, sprite, onSorteio, onContinue, onExit }: {
  rows: LeaderRow[]; stats: FinalStats; messages: ChatMessage[];
  endRef: React.RefObject<HTMLDivElement | null>;
  sprite?: ProcessedSprite | null;
  onSorteio: (weighted: boolean) => void; onContinue: () => void; onExit: () => void;
}) {
  const top = rows.slice(0, 5);
  const secs = Math.floor(stats.elapsedMs / 1000);
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const statRows: [string, string][] = [
    ['Mensagens enviadas', stats.messages.toLocaleString('pt-BR')],
    ['Maior tamanho atingido', Math.round(stats.maxMass).toLocaleString('pt-BR')],
    ['Tempo online', elapsed],
    ['Eventos ativados', String(stats.events)],
  ];
  return (
    <div className="flex flex-1 min-h-0">
    <div className="relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-6 py-8"
      style={{
        background:
          'radial-gradient(circle at 50% 34%, #2a1a5e 0%, #150f38 40%, #08061c 100%),' +
          'radial-gradient(circle at 18% 78%, rgba(210,40,170,0.16), transparent 42%),' +
          'radial-gradient(circle at 82% 72%, rgba(40,90,230,0.16), transparent 42%)',
      }}>
      {/* top-left: logo + status */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(10,12,28,0.72)', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 0 16px rgba(124,58,237,0.25)' }}>
          <div className="leading-[0.78] italic" style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900 }}>
            <div style={{ fontSize: 16, color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>CHAT</div>
            <div style={{ fontSize: 16, backgroundImage: 'linear-gradient(90deg,#a855f7,#6366f1,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>WARS</div>
          </div>
          <span style={{ fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(255,210,74,0.8))' }}>👑</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.45), rgba(99,102,241,0.3))', border: '1px solid rgba(180,150,255,0.5)' }}>
          <span style={{ fontSize: 11 }}>👑</span>
          <span className="font-orbitron font-bold text-[10px] tracking-widest text-white/90">JOGO ENCERRADO</span>
        </div>
      </div>

      {/* bottom-left: match stats */}
      <div className="absolute bottom-4 left-4 z-20 rounded-2xl overflow-hidden"
        style={{ width: 280, background: 'rgba(10,12,28,0.82)', border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 0 22px rgba(124,58,237,0.2)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 13 }}>📊</span>
          <span className="font-orbitron font-bold text-[11px] tracking-widest text-white/85">ESTATÍSTICAS DA PARTIDA</span>
        </div>
        <div className="px-4 py-1">
          {statRows.map(([label, value], i) => (
            <div key={label} className="flex items-center justify-between py-2"
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
              <span className="font-rajdhani text-[13px] text-white/60">{label}</span>
              <span className="font-orbitron font-bold text-[13px] text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* confetti */}
      {CONFETTI.map((c, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
          style={{ left: `${c.left}%`, top: `${c.top}%`, width: c.w, height: c.h, background: c.col, borderRadius: 2, transform: `rotate(${c.rot}deg)`, opacity: 0.85 }}
          animate={{ y: [0, 16, 0], rotate: [c.rot, c.rot + 40, c.rot] }}
          transition={{ duration: c.dur, repeat: Infinity, ease: 'easeInOut', delay: c.delay }} />
      ))}

      {/* header */}
      <motion.div className="text-center relative z-10" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ fontSize: 34, lineHeight: 0.6, filter: 'drop-shadow(0 0 10px rgba(255,210,74,0.85))' }}>👑</div>
        <h1 className="font-orbitron italic font-black tracking-wider mt-1"
          style={{
            fontSize: 'clamp(34px, 6vw, 60px)',
            backgroundImage: 'linear-gradient(180deg, #ffffff 30%, #c4b5fd 70%, #8b5cf6)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.3)) drop-shadow(0 0 24px rgba(124,58,237,0.7))',
          }}>
          FIM DE JOGO!
        </h1>
        <p className="font-rajdhani text-white/55 text-sm mt-1">Foi uma batalha épica! Obrigado por participar!</p>
        {top[0] && (
          <div className="inline-flex items-center gap-2 mt-3 rounded-xl px-5 py-2"
            style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.6), rgba(99,102,241,0.5))', border: '1px solid rgba(180,150,255,0.55)', boxShadow: '0 0 18px rgba(124,58,237,0.4)' }}>
            <span style={{ fontSize: 14 }}>👑</span>
            <span className="font-orbitron font-bold text-xs tracking-widest text-white">REI DO CHAT: {top[0].name}</span>
          </div>
        )}
      </motion.div>

      {top.length === 0 ? (
        <p className="font-rajdhani text-white/40 mt-16 relative z-10">ninguém entrou no jogo ainda.</p>
      ) : (
        <div className="relative flex items-end justify-center gap-2 md:gap-5 mt-10">
          {/* purple ambient glow behind everything */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ width: 760, height: 540, top: '-24%',
              background: 'radial-gradient(ellipse at center, rgba(138,79,255,0.55), rgba(99,60,200,0.20) 45%, transparent 72%)' }} />

          {/* golden rays radiating from behind the winner (two counter-rotating layers) */}
          <motion.div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 620, height: 620, top: '-32%',
              background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,210,90,0.22) 0deg 6deg, transparent 6deg 15deg)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 58%)',
              maskImage: 'radial-gradient(circle, #000 0%, transparent 58%)',
            }}
            animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 540, height: 540, top: '-27%',
              background: 'repeating-conic-gradient(from 3deg at 50% 50%, rgba(255,236,160,0.16) 0deg 3deg, transparent 3deg 11deg)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 55%)',
              maskImage: 'radial-gradient(circle, #000 0%, transparent 55%)',
            }}
            animate={{ rotate: -360 }} transition={{ duration: 72, repeat: Infinity, ease: 'linear' }} />

          {/* bright pulsing golden core right on the winner */}
          <motion.div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ width: 380, height: 380, top: '-12%',
              background: 'radial-gradient(circle, rgba(255,246,205,0.6) 0%, rgba(255,200,70,0.5) 26%, rgba(255,170,40,0.18) 48%, transparent 62%)' }}
            animate={{ opacity: [0.72, 1, 0.72], scale: [0.95, 1.06, 0.95] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />

          {top[3] && <SidePlace row={top[3]} rank={4} sprite={sprite} />}
          {top[1] && <PodiumPlace row={top[1]} rank={2} sprite={sprite} />}
          {top[0] && <PodiumPlace row={top[0]} rank={1} sprite={sprite} />}
          {top[2] && <PodiumPlace row={top[2]} rank={3} sprite={sprite} />}
          {top[4] && <SidePlace row={top[4]} rank={5} sprite={sprite} />}
        </div>
      )}

      {/* actions */}
      <div className="flex flex-col items-center gap-3 mt-10 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button onClick={() => onSorteio(false)}
            className="flex flex-col items-center justify-center rounded-2xl text-white"
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(180deg, #c084fc, #7c3aed)',
              border: '1px solid rgba(216,180,254,0.7)',
              boxShadow: '0 8px 26px rgba(124,58,237,0.5), inset 0 2px 0 rgba(255,255,255,0.35)',
            }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <span className="font-orbitron font-black tracking-widest text-base flex items-center gap-2">🎟️ SORTEIO 1:1</span>
            <span className="font-rajdhani text-[11px] tracking-wide text-white/80">1 ticket por participante</span>
          </motion.button>
          <motion.button onClick={() => onSorteio(true)}
            className="flex flex-col items-center justify-center rounded-2xl text-white"
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(180deg, #fbbf24, #d97706)',
              border: '1px solid rgba(253,224,153,0.7)',
              boxShadow: '0 8px 26px rgba(217,119,6,0.45), inset 0 2px 0 rgba(255,255,255,0.35)',
            }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <span className="font-orbitron font-black tracking-widest text-base flex items-center gap-2">🏆 SORTEIO POR PONTOS</span>
            <span className="font-rajdhani text-[11px] tracking-wide text-white/80">1 ticket a cada 10 pontos</span>
          </motion.button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onContinue}
            className="font-orbitron text-[11px] tracking-widest px-5 py-2.5 rounded-xl transition-all"
            style={{ color: '#53FC1C', background: 'rgba(83,252,28,0.08)', border: '1px solid rgba(83,252,28,0.4)' }}>
            ▶ CONTINUAR JOGO
          </button>
          <button onClick={onExit}
            className="font-orbitron text-[11px] tracking-widest px-5 py-2.5 rounded-xl transition-all"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)' }}>
            ✕ SAIR
          </button>
        </div>
      </div>
    </div>
    <LiveChatPanel messages={messages} endRef={endRef} />
    </div>
  );
}

function SwordIcon({ big }: { big?: boolean } = {}) {
  const s = big ? 56 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cw-glow"><feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter="url(#cw-glow)" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M14.5 3.5 L20 3.5 L20 9 L9.5 19.5 L5.5 19.5 L4.5 18.5 L4.5 14.5 Z" opacity="0.9" />
        <path d="M14.5 9.5 L7 17" />
        <circle cx="6.2" cy="17.8" r="1.6" />
      </g>
    </svg>
  );
}
