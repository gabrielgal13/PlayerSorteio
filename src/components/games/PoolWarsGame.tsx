'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  leaderboard, playerCount, teamAlive,
  triggerSpin, triggerSoap, triggerWave, triggerShrink, triggerSumo, triggerLowGrav, triggerIce, triggerQuake,
  spawnShark, invertGravity, superForce, freezeRandom, spawnBanana,
  CLASSES, TEAM_COLOR,
  type World, type LeaderRow, type EventKey, type Team, type VoteState,
} from './poolwars/engine';
import { poolWarsSession, type FinalStats } from './poolwars/session';
import { createCamera, updateCamera, render, type Camera } from './poolwars/render';
import { processSprite, getTintedSprite, type ProcessedSprite } from './chatwars/spriteProcessor';
import type { ChatMessage } from '@/types';

const EVENT_COOLDOWN = 12_000;
// Rank da comunidade: só pontua "jogo concluído" se teve interação de chat real.
const MIN_MESSAGES_FOR_RANK = 5;

interface Props { onBack: () => void }

interface EventDef { key: EventKey; label: string; icon: string; color: string; fn: (w: World) => void; desc: string; }
const EVENT_DEFS: EventDef[] = [
  { key: 'spin',    label: 'GIRATÓRIA',  icon: '🌀', color: '#22d3ee', fn: triggerSpin,    desc: 'A piscina inteira gira. Todo mundo desliza pra fora — caos puro.' },
  { key: 'soap',    label: 'SABÃO',      icon: '🧼', color: '#7CFFB2', fn: triggerSoap,    desc: 'A plataforma fica escorregadia MUITO. Ninguém consegue frear.' },
  { key: 'wave',    label: 'ONDA',       icon: '🌊', color: '#38bdf8', fn: triggerWave,    desc: 'Uma onda gigante empurra todos os bonecos numa direção só.' },
  { key: 'shrink',  label: 'MINI MAPA',  icon: '🟦', color: '#a855f7', fn: triggerShrink,  desc: 'O mapa encolhe — sobra um quadradinho. Desespero total.' },
  { key: 'sumo',    label: 'SUMÔ',       icon: '🟠', color: '#FF8A3C', fn: triggerSumo,    desc: 'Todo mundo fica pesadão: difícil de empurrar e lento.' },
  { key: 'lowGrav', label: 'GRAV. BAIXA',icon: '🪶', color: '#c4b5fd', fn: triggerLowGrav, desc: 'Gravidade baixa: saltos gigantes e empurrões que voam longe.' },
  { key: 'ice',     label: 'GELO',       icon: '🧊', color: '#bfe9ff', fn: triggerIce,     desc: 'Pista de gelo: pouca aderência, escorrega pra todo lado.' },
  { key: 'quake',   label: 'TERREMOTO',  icon: '💥', color: '#FF6B6B', fn: triggerQuake,   desc: 'A piscina treme e arremessa todo mundo em direções aleatórias.' },
];

interface ChaosDef { key: string; label: string; icon: string; color: string; fn: (w: World) => void; desc: string; }
const CHAOS_DEFS: ChaosDef[] = [
  { key: 'shark',  label: 'TUBARÃO',  icon: '🦈', color: '#38bdf8', fn: spawnShark,     desc: 'Solta um tubarão que persegue e arremessa quem encostar.' },
  { key: 'invert', label: 'INVERTER', icon: '🔄', color: '#a855f7', fn: invertGravity,  desc: 'Inverte a gravidade: todos são jogados pra fora da piscina.' },
  { key: 'super',  label: 'SUPER FORÇA',icon: '💪', color: '#FFD24A', fn: superForce,   desc: 'Dá super força ao time que está perdendo o round.' },
  { key: 'freeze', label: 'CONGELAR', icon: '🧊', color: '#bfe9ff', fn: freezeRandom,   desc: 'Congela um jogador aleatório — vira estátua por uns segundos.' },
  { key: 'banana', label: 'BANANAS',  icon: '🍌', color: '#ffe14a', fn: spawnBanana,    desc: 'Espalha cascas de banana. Quem pisar, escorrega voando.' },
];

export default function PoolWarsGame({ onBack }: Props) {
  const {
    chatMessages, chatRegistrationActive, setChatRegistrationRequested,
    setParticipants, setRaffleStage, setActiveTab, currentUser,
  } = useStore();
  const spriteUrl = currentUser?.chatWarsSprite || '/spritepadrao.png';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Camera | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const [running, setRunning] = useState(poolWarsSession.running);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [pcount, setPcount] = useState(0);
  const [alive, setAlive] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [score, setScore] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [roundNo, setRoundNo] = useState(1);
  const [moment, setMoment] = useState<{ title: string; sub: string } | null>(null);
  const [vote, setVote] = useState<{ remain: number; options: VoteState['options'] } | null>(null);
  const [timers, setTimers] = useState<{ key: EventKey; remain: number }[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [streamerName, setStreamerName] = useState('');
  const [streamerOn, setStreamerOn] = useState(poolWarsSession.streamerOn);
  const [started, setStarted] = useState(poolWarsSession.started);
  const [finished, setFinished] = useState(poolWarsSession.finished);
  const [finalRows, setFinalRows] = useState<LeaderRow[]>(poolWarsSession.finalRows);
  const [finalStats, setFinalStats] = useState<FinalStats>(poolWarsSession.finalStats);
  const [showHelp, setShowHelp] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<ProcessedSprite | null>(null);
  const [sprite, setSprite] = useState<ProcessedSprite | null>(null);

  useEffect(() => {
    poolWarsSession.init();
    if (!chatRegistrationActive) setChatRegistrationRequested(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    spriteRef.current = null;
    const img = new Image();
    img.onload = () => { try { const p = processSprite(img); spriteRef.current = p; setSprite(p); } catch { spriteRef.current = null; setSprite(null); } };
    img.onerror = () => { spriteRef.current = null; setSprite(null); };
    img.src = spriteUrl;
    return () => { spriteRef.current = null; };
  }, [spriteUrl]);

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
    if (!camRef.current) camRef.current = createCamera(poolWarsSession.world);
    const loop = (t: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      const cam = camRef.current!;
      const { w, h, dpr } = sizeRef.current;
      const dtMs = lastTimeRef.current ? t - lastTimeRef.current : 16;
      lastTimeRef.current = t;
      const dt = Math.min(dtMs, 50) / 1000;
      if (ctx && w > 0 && h > 0) {
        updateCamera(cam, poolWarsSession.world, w, h, dt);
        ctx.save(); ctx.scale(dpr, dpr);
        render(ctx, poolWarsSession.world, cam, w, h, spriteRef.current);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const w = poolWarsSession.world;
      setBoard(leaderboard(w, 6));
      setPcount(playerCount(w));
      setAlive(teamAlive(w));
      setScore({ A: w.scoreA, B: w.scoreB });
      setRoundNo(w.round);
      setMoment(w.moment ? { title: w.moment.title, sub: w.moment.sub } : null);
      setRunning(poolWarsSession.running);
      setStreamerOn(poolWarsSession.streamerOn);
      setVote(w.vote && w.time < w.vote.until
        ? { remain: Math.ceil((w.vote.until - w.time) / 1000), options: w.vote.options.map(o => ({ ...o })) }
        : null);
      const now = w.time;
      const t: { key: EventKey; remain: number }[] = [];
      (Object.keys(w.events) as (keyof typeof w.events)[]).forEach(k => {
        if ((EVENT_DEFS.some(d => d.key === k)) && w.events[k] > now) {
          t.push({ key: k as EventKey, remain: Math.ceil((w.events[k] - now) / 1000) });
        }
      });
      setTimers(t);
    }, 200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fireEvent = useCallback((key: string, fn: (w: World) => void) => {
    if ((cooldowns[key] ?? 0) > Date.now()) return;
    poolWarsSession.fireEvent(fn);
    setCooldowns(prev => ({ ...prev, [key]: Date.now() + EVENT_COOLDOWN }));
  }, [cooldowns]);

  const handleStreamerToggle = useCallback(() => {
    poolWarsSession.toggleStreamer(streamerName || 'STREAMER');
    setStreamerOn(poolWarsSession.streamerOn);
  }, [streamerName]);

  const handlePlay = useCallback(() => { poolWarsSession.start(); setStarted(true); setRunning(true); }, []);
  const togglePause = useCallback(() => {
    if (poolWarsSession.running) { poolWarsSession.pause(); setRunning(false); }
    else { poolWarsSession.resume(); setRunning(true); }
  }, []);
  const handleFinalize = useCallback(() => {
    poolWarsSession.finalize();
    setFinalRows(poolWarsSession.finalRows); setFinalStats(poolWarsSession.finalStats);
    setRunning(false); setFinished(true);
    if (poolWarsSession.finalStats.messages >= MIN_MESSAGES_FOR_RANK) {
      fetch('/api/streamer/rank-game-completed', { method: 'POST' }).catch(() => {});
    }
  }, []);
  const handleContinue = useCallback(() => { poolWarsSession.continueGame(); setFinished(false); setRunning(true); }, []);

  const handleSorteio = useCallback(() => {
    const rows = leaderboard(poolWarsSession.world, 9999);
    const parts = rows.map((r, i) => ({
      id: `pw_${r.id}_${i}`, number: i + 1, name: r.name, source: r.source,
      tickets: Math.max(1, r.knockouts + 1),
    }));
    setParticipants(parts); setRaffleStage(1); setActiveTab('raffle');
  }, [setParticipants, setRaffleStage, setActiveTab]);

  const handleReset = useCallback(() => {
    poolWarsSession.reset();
    camRef.current = createCamera(poolWarsSession.world);
    setStreamerOn(false); setBoard([]); setPcount(0); setScore({ A: 0, B: 0 });
  }, []);

  if (!started) {
    return <IntroScreen onPlay={handlePlay} onBack={onBack} onHelp={() => setShowHelp(true)}
      showHelp={showHelp} onCloseHelp={() => setShowHelp(false)} />;
  }
  if (finished) {
    return <ResultsScreen rows={finalRows} stats={finalStats} messages={chatMessages} endRef={chatEndRef}
      sprite={sprite} onSorteio={handleSorteio} onContinue={handleContinue} onExit={onBack} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(56,189,248,0.15)' }}>
        <button onClick={onBack} className="flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#38bdf8')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          VOLTAR
        </button>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <PoolIcon />
        <span className="font-orbitron font-bold text-sm tracking-widest text-white">POOL WARS</span>
        <span className="font-rajdhani text-xs tracking-wider text-white/35 ml-1">round {roundNo} · {pcount} {pcount === 1 ? 'jogador' : 'jogadores'}</span>

        {/* team score */}
        <div className="ml-3 flex items-center gap-2">
          <TeamPill team="A" alive={alive.A} score={score.A} />
          <span className="font-orbitron text-white/40 text-xs">×</span>
          <TeamPill team="B" alive={alive.B} score={score.B} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!running
            ? <CtrlButton onClick={togglePause} color="#53FC1C">▶ RETOMAR</CtrlButton>
            : <CtrlButton onClick={togglePause} color="#FFD24A">⏸ PAUSAR</CtrlButton>}
          <CtrlButton onClick={handleReset} color="#FF6B6B">↺ RESET</CtrlButton>
          <CtrlButton onClick={handleFinalize} color="#38bdf8">🏁 FINALIZAR</CtrlButton>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT: ranking + powers */}
        <div className="flex flex-col flex-shrink-0" style={{ width: 280, background: 'rgba(5,14,28,0.94)', borderRight: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-base">🏆</span>
            <span className="font-orbitron text-white/45 tracking-widest text-xs">TOP LUTADORES</span>
            <motion.div className="w-2 h-2 rounded-full bg-red-500 ml-auto" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px', scrollbarWidth: 'none' }}>
            {board.length === 0 ? (
              <p className="font-rajdhani text-white/20 text-center text-xs tracking-wider mt-6">aguardando lutadores...</p>
            ) : board.map((row, i) => (
              <div key={row.id} className="flex items-center gap-2 py-2 px-2 rounded-lg mb-1"
                style={{ background: row.king ? 'rgba(255,210,74,0.08)' : 'rgba(255,255,255,0.02)' }}>
                <span className="font-orbitron text-xs w-5 text-center flex-shrink-0" style={{ color: i === 0 ? '#FFD24A' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEAM_COLOR[row.team], boxShadow: `0 0 6px ${TEAM_COLOR[row.team]}` }} />
                <span className="font-rajdhani font-bold text-xs text-white truncate flex-1 flex items-center gap-1">
                  {row.king && <span title="rei da piscina">👑</span>}
                  {row.streamer && <span title="streamer">⭐</span>}
                  <span title={CLASSES[row.cls].label}>{CLASSES[row.cls].emoji}</span>
                  {row.name}
                </span>
                {!row.alive && <span title="na água" className="text-[10px]">💦</span>}
                <span className="font-orbitron text-[11px] text-[#38bdf8] flex-shrink-0">{row.knockouts} KO</span>
              </div>
            ))}
          </div>

          {/* events */}
          <div className="flex-shrink-0" style={{ padding: '12px 14px', borderTop: '1px solid rgba(56,189,248,0.14)', background: 'rgba(56,130,246,0.04)' }}>
            <span className="font-orbitron text-white/45 tracking-widest text-[11px]">🌊 EVENTOS DA PISCINA</span>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {EVENT_DEFS.map(def => (
                <PowerCard key={def.key} icon={def.icon} label={def.label} color={def.color} desc={def.desc}
                  cooldownUntil={cooldowns[def.key] ?? 0} disabled={!running} onClick={() => fireEvent(def.key, def.fn)} />
              ))}
            </div>
            <span className="font-orbitron text-white/45 tracking-widest text-[11px] mt-3 block">💀 CAOS DO STREAMER</span>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {CHAOS_DEFS.map(def => (
                <PowerCard key={def.key} icon={def.icon} label={def.label} color={def.color} desc={def.desc}
                  cooldownUntil={cooldowns[def.key] ?? 0} disabled={!running} onClick={() => fireEvent(def.key, def.fn)} small />
              ))}
            </div>
          </div>

          {/* streamer ball */}
          <div className="flex-shrink-0" style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="font-orbitron text-white/35 tracking-widest text-[10px]">ENTRAR NA PISCINA</span>
            <div className="flex gap-2 mt-2">
              <input value={streamerName} onChange={e => setStreamerName(e.target.value)} placeholder="seu nick" disabled={streamerOn}
                className="flex-1 min-w-0 font-rajdhani text-xs px-2 py-1.5 rounded-lg text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }} />
              <button onClick={handleStreamerToggle} className="font-orbitron text-[10px] tracking-widest px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: streamerOn ? 'rgba(255,107,107,0.18)' : 'rgba(56,189,248,0.12)', border: `1px solid ${streamerOn ? 'rgba(255,107,107,0.5)' : 'rgba(56,189,248,0.4)'}`, color: streamerOn ? '#FF6B6B' : '#38bdf8' }}>
                {streamerOn ? 'SAIR' : 'ENTRAR'}
              </button>
            </div>
            <p className="font-rajdhani text-[10px] text-white/30 mt-1.5 leading-snug">
              chat manda <span className="text-[#7CFFB2]">!push · !jump · !dash · !defend</span> pra controlar o boneco
            </p>
          </div>
        </div>

        {/* CENTER: arena */}
        <div ref={wrapRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          <canvas ref={canvasRef} className="block" />

          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(13,59,102,0.7), rgba(43,127,184,0.55))', border: '1px solid rgba(190,233,255,0.45)', boxShadow: '0 0 18px rgba(56,189,248,0.35)' }}>
            <motion.span className="w-2 h-2 rounded-full" style={{ background: '#7CFFB2', boxShadow: '0 0 8px #7CFFB2' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.1, repeat: Infinity }} />
            <span className="font-orbitron font-bold text-[11px] tracking-widest text-white">{pcount} {pcount === 1 ? 'NA PISCINA' : 'NA PISCINA'}</span>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="font-orbitron font-bold text-sm tracking-[0.35em]" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 0 14px rgba(56,189,248,0.8)' }}>
              DERRUBE TODO MUNDO!
            </span>
          </div>

          {/* active event timers */}
          <div className="absolute top-9 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 pointer-events-none max-w-[80%]">
            <AnimatePresence>
              {timers.map(t => {
                const m = EVENT_DEFS.find(d => d.key === t.key)!;
                return (
                  <motion.div key={t.key} initial={{ opacity: 0, scale: 0.7, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7, y: -6 }} transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: `${m.color}26`, border: `1px solid ${m.color}`, boxShadow: `0 0 12px ${m.color}55` }}>
                    <span className="text-xs leading-none">{m.icon}</span>
                    <span className="font-orbitron font-bold text-[9px] tracking-widest text-white">{m.label}</span>
                    <span className="font-orbitron font-bold text-[11px] tabular-nums" style={{ color: m.color }}>{t.remain}s</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* idle hint */}
          {!running && pcount === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
              <span style={{ fontSize: 56 }}>🏊</span>
              <h2 className="font-orbitron font-bold text-xl tracking-widest text-white mt-4">POOL WARS</h2>
              <p className="font-rajdhani text-sm text-white/45 mt-2 max-w-md leading-relaxed">
                Cada viewer vira um boneco e entra num time. Mandem mensagem pra ganhar energia e usem
                <span className="text-[#7CFFB2] font-bold"> !push !jump !dash !defend </span>pra derrubar o outro time na água!
              </p>
            </div>
          )}

          {/* moment banner */}
          <AnimatePresence>
            {moment && (
              <motion.div key={moment.title} className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none text-center"
                initial={{ opacity: 0, scale: 0.6, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -10 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
                <div className="font-orbitron font-bold text-2xl tracking-widest" style={{ color: '#fff', textShadow: '0 0 18px rgba(56,189,248,0.9), 0 0 6px rgba(255,255,255,0.8)' }}>{moment.title}</div>
                <div className="font-rajdhani text-sm tracking-wide text-white/70 mt-1">{moment.sub}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* chat vote */}
          <AnimatePresence>
            {vote && (
              <motion.div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                <div className="rounded-2xl px-5 py-3" style={{ background: 'rgba(6,16,32,0.92)', border: '1px solid rgba(56,189,248,0.5)', boxShadow: '0 0 24px rgba(56,189,248,0.3)' }}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="font-orbitron font-bold text-xs tracking-widest text-white">🗳️ CHAT ESCOLHE O CAOS</span>
                    <span className="font-orbitron font-bold text-sm tabular-nums" style={{ color: '#38bdf8' }}>{vote.remain}s</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {vote.options.map((o, i) => {
                      const totalV = vote.options.reduce((s, x) => s + x.votes, 0) || 1;
                      const pct = Math.round((o.votes / totalV) * 100);
                      return (
                        <div key={o.key} className="flex flex-col items-center w-28 rounded-xl px-2 py-2" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)' }}>
                          <span className="text-xl">{o.emoji}</span>
                          <span className="font-orbitron font-bold text-[10px] tracking-widest text-white mt-1">{i + 1}. {o.label}</span>
                          <div className="w-full h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#38bdf8' }} />
                          </div>
                          <span className="font-rajdhani text-[10px] text-white/55 mt-0.5">{o.votes} votos</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: chat */}
        <LiveChatPanel messages={chatMessages} endRef={chatEndRef} />
      </div>
    </div>
  );
}

function TeamPill({ team, alive, score }: { team: Team; alive: number; score: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: `${TEAM_COLOR[team]}1f`, border: `1px solid ${TEAM_COLOR[team]}66` }}>
      <span className="w-2 h-2 rounded-full" style={{ background: TEAM_COLOR[team], boxShadow: `0 0 6px ${TEAM_COLOR[team]}` }} />
      <span className="font-orbitron font-bold text-xs text-white">TIME {team}</span>
      <span className="font-orbitron font-black text-sm" style={{ color: TEAM_COLOR[team] }}>{score}</span>
      <span className="font-rajdhani text-[10px] text-white/40">({alive})</span>
    </div>
  );
}

function LiveChatPanel({ messages, endRef }: { messages: ChatMessage[]; endRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: 420, background: 'rgba(5,14,28,0.94)', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>
      <div className="flex items-center gap-3 flex-shrink-0" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="font-orbitron text-white/40 tracking-widest text-xs">CHAT DA LIVE</span>
        <motion.div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0" style={{ padding: '16px 20px', scrollbarWidth: 'none' }}>
        {messages.length === 0 ? (
          <p className="font-rajdhani text-white/20 text-center tracking-wider leading-relaxed text-xs">aguardando mensagens...</p>
        ) : messages.slice(-50).map(msg => (
          <div key={msg.id} className="leading-relaxed break-words text-xs">
            <span className="font-rajdhani font-bold" style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {msg.source === 'twitch' && <svg width="10" height="10" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}><path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z" /></svg>}
              {msg.source === 'kick' && <svg width="10" height="10" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}><path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z" /></svg>}
              {msg.source === 'youtube' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>}
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

function CtrlButton({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-lg transition-all"
      style={{ background: `${color}1f`, border: `1px solid ${color}66`, color }}>{children}</button>
  );
}

function PowerCard({ icon, label, color, desc, cooldownUntil, disabled, onClick, small }: {
  icon: string; label: string; color: string; desc: string; cooldownUntil: number; disabled: boolean; onClick: () => void; small?: boolean;
}) {
  const [remain, setRemain] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setRemain(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))), 200);
    return () => clearInterval(iv);
  }, [cooldownUntil]);
  const onCd = remain > 0;
  const dimmed = disabled || onCd;
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={dimmed}
        className="w-full relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all overflow-hidden"
        style={{ aspectRatio: '1 / 1', background: dimmed ? 'rgba(255,255,255,0.03)' : `${color}12`, border: `1px solid ${dimmed ? 'rgba(255,255,255,0.08)' : color + '55'}`, cursor: dimmed ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <span className={small ? 'text-base leading-none' : 'text-lg leading-none'} style={{ filter: dimmed ? 'grayscale(0.6)' : 'none' }}>{icon}</span>
        <span className="font-orbitron font-bold tracking-wide leading-tight text-center px-0.5" style={{ fontSize: small ? 6 : 7, color: dimmed ? 'rgba(255,255,255,0.4)' : color }}>{label}</span>
        {onCd && <div className="absolute inset-0 flex items-center justify-center font-orbitron font-bold text-base" style={{ background: 'rgba(5,14,28,0.7)', color: '#fff' }}>{remain}</div>}
      </button>
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-left" style={{ width: 200 }}>
        <div className="rounded-xl px-3 py-2.5 shadow-xl" style={{ background: 'rgba(8,16,32,0.97)', border: `1px solid ${color}`, boxShadow: `0 0 20px ${color}55` }}>
          <div className="flex items-center gap-1.5 font-orbitron font-bold text-[11px] tracking-widest" style={{ color }}><span className="text-sm">{icon}</span>{label}</div>
          <p className="font-rajdhani text-[12px] leading-snug mt-1.5" style={{ color: 'rgba(255,255,255,0.78)' }}>{desc}</p>
        </div>
        <div className="absolute right-full top-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: `7px solid ${color}` }} />
      </div>
    </div>
  );
}

/* ── Intro ───────────────────────────────────────────────────────────────── */
function IntroScreen({ onPlay, onBack, onHelp, showHelp, onCloseHelp }: {
  onPlay: () => void; onBack: () => void; onHelp: () => void; showHelp: boolean; onCloseHelp: () => void;
}) {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center"
      style={{ background: 'radial-gradient(circle at 50% 40%, #0d3b66 0%, #0a2a4a 50%, #06223f 100%), radial-gradient(circle at 20% 30%, rgba(56,189,248,0.25), transparent 42%), radial-gradient(circle at 80% 70%, rgba(124,255,178,0.16), transparent 42%)' }}>
      <button onClick={onBack} className="absolute top-4 left-4 z-20 flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#38bdf8')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
        VOLTAR
      </button>

      {/* floating emoji deco */}
      {[['🦈', '8%', '6%', 0], ['🍌', '14%', '84%', 0.5], ['🛟', '74%', '8%', 0.9], ['🌊', '78%', '82%', 0.3], ['💦', '40%', '90%', 0.7]].map(([e, top, left, d], i) => (
        <motion.div key={i} className="absolute hidden md:block" style={{ top: top as string, left: left as string, fontSize: 64 }}
          animate={{ y: [0, -18, 0], rotate: [-6, 6, -6] }} transition={{ duration: 4 + (d as number), repeat: Infinity, ease: 'easeInOut', delay: d as number }}>{e}</motion.div>
      ))}

      <motion.div className="relative z-10 flex flex-col items-center text-center px-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <motion.div style={{ fontSize: 44, lineHeight: 1, filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.8))' }} animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>🏊</motion.div>
        <div className="leading-[0.82] -mt-1" style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontStyle: 'italic' }}>
          <div style={{ fontSize: 'clamp(46px, 8vw, 88px)', color: '#fff', textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 0 24px rgba(56,189,248,0.55)' }}>POOL</div>
          <div style={{ fontSize: 'clamp(46px, 8vw, 88px)', backgroundImage: 'linear-gradient(90deg, #38bdf8, #22d3ee, #7CFFB2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 22px rgba(56,189,248,0.6))' }}>WARS</div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span style={{ width: 28, height: 2, background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
          <span className="font-orbitron font-bold text-xs tracking-[0.3em] text-white/85">DERRUBE O OUTRO TIME!</span>
          <span style={{ width: 28, height: 2, background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
        </div>
        <p className="font-rajdhani text-base text-white/65 mt-6 leading-relaxed max-w-md">
          O chat vira bonecos equilibrados numa piscina flutuante.<br />Mande mensagem pra ganhar energia e use
          <span className="font-bold" style={{ color: '#7CFFB2' }}> !push !jump !dash !defend </span>
          pra jogar a galera na água!
        </p>
        <motion.button onClick={onPlay} className="mt-7 flex items-center justify-center gap-3 font-orbitron font-black tracking-widest text-white rounded-2xl"
          style={{ padding: '16px 56px', fontSize: 18, background: 'linear-gradient(180deg, #38bdf8, #1d7fc0)', boxShadow: '0 8px 24px rgba(56,189,248,0.45), inset 0 2px 0 rgba(255,255,255,0.4)', border: '1px solid rgba(160,220,255,0.6)' }}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '4px 6px', display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg></span>
          JOGAR AGORA
        </motion.button>
        <button onClick={onHelp} className="mt-3 flex items-center gap-2 font-orbitron text-xs tracking-widest rounded-xl px-5 py-2.5 transition-all"
          style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.14)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.06)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" strokeLinecap="round" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>
          COMO JOGAR
        </button>
      </motion.div>

      <HowToPlay open={showHelp} onClose={onCloseHelp} onPlay={onPlay} />
    </div>
  );
}

function HowToPlay({ open, onClose, onPlay }: { open: boolean; onClose: () => void; onPlay: () => void }) {
  const rules: [string, string][] = [
    ['💬', 'Cada mensagem no chat enche a ENERGIA do seu boneco. Sem energia, sem golpe.'],
    ['🎮', 'Comandos: !push (ombrada), !jump (pula), !dash (avança) e !defend (segura firme).'],
    ['🟦', 'Quem cai na água sai do round — volte mandando mensagem no chat.'],
    ['🤝', 'Você entra automático no TIME A (azul) ou TIME B (vermelho), sempre equilibrado.'],
    ['🧱', 'Classes: 🛡️ Tanque, 🍔 Gordão, 🥷 Ninja, 🐒 Macaco e 🟢 Mola — cada uma joga diferente.'],
    ['🌊', 'A cada ~30s o chat VOTA um evento: giratória, sabão, onda, gelo, terremoto e mais.'],
    ['👑', 'Quem derruba mais vira REI DA PISCINA e todos vão pra cima dele.'],
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-30 flex items-center justify-center p-6" style={{ background: 'rgba(3,10,20,0.7)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={e => e.stopPropagation()} className="relative rounded-2xl w-full max-w-lg"
            style={{ background: 'rgba(6,16,32,0.98)', border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 0 40px rgba(56,189,248,0.4)' }}
            initial={{ scale: 0.9, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 10 }}>
            <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xl">🏊</span>
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
              <button onClick={() => { onClose(); onPlay(); }} className="w-full flex items-center justify-center gap-2 font-orbitron font-bold tracking-widest text-white rounded-xl py-3"
                style={{ background: 'linear-gradient(180deg, #38bdf8, #1d7fc0)', border: '1px solid rgba(160,220,255,0.6)', boxShadow: '0 6px 18px rgba(56,189,248,0.4)' }}>
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

/* ── Results ─────────────────────────────────────────────────────────────── */
const CONFETTI = (() => {
  let s = 7654321;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cols = ['#38bdf8', '#7CFFB2', '#FFD24A', '#22D3EE', '#FF6BD6', '#bfe9ff'];
  return Array.from({ length: 40 }, () => ({ left: rnd() * 100, top: rnd() * 72, col: cols[Math.floor(rnd() * cols.length)], w: 4 + rnd() * 5, h: 7 + rnd() * 9, rot: rnd() * 360, delay: rnd() * 2.5, dur: 2.4 + rnd() * 2.5 }));
})();

function ResultBall({ hue, name, size, sprite, team }: { hue: number; name: string; size: number; sprite?: ProcessedSprite | null; team: Team }) {
  const spriteUrl = useMemo(() => (sprite ? getTintedSprite(sprite, hue).toDataURL() : null), [sprite, hue]);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full relative flex items-end justify-center overflow-hidden"
        style={{
          background: spriteUrl ? `center / 138% 138% no-repeat url(${spriteUrl})` : `radial-gradient(circle at 32% 26%, hsl(${hue},100%,82%), hsl(${hue},90%,54%) 56%, hsl(${hue},85%,32%))`,
          boxShadow: `0 0 30px ${TEAM_COLOR[team]}`, border: `3px solid ${TEAM_COLOR[team]}`,
        }}>
        <span className="font-orbitron font-bold text-white relative z-10 truncate px-1" style={{ fontSize: Math.max(9, size * 0.115), marginBottom: size * 0.1, maxWidth: size * 0.96, textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}>{name}</span>
      </div>
    </div>
  );
}

function ResultsScreen({ rows, stats, messages, endRef, sprite, onSorteio, onContinue, onExit }: {
  rows: LeaderRow[]; stats: FinalStats; messages: ChatMessage[]; endRef: React.RefObject<HTMLDivElement | null>;
  sprite?: ProcessedSprite | null; onSorteio: () => void; onContinue: () => void; onExit: () => void;
}) {
  const top = rows.slice(0, 5);
  const secs = Math.floor(stats.elapsedMs / 1000);
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const teamWin = stats.roundsA === stats.roundsB ? null : (stats.roundsA > stats.roundsB ? 'A' : 'B');
  const statRows: [string, string][] = [
    ['Mensagens enviadas', stats.messages.toLocaleString('pt-BR')],
    ['Quedas na água', stats.knockouts.toLocaleString('pt-BR')],
    ['Rounds — Time A', String(stats.roundsA)],
    ['Rounds — Time B', String(stats.roundsB)],
    ['Tempo online', elapsed],
    ['Eventos ativados', String(stats.events)],
  ];
  return (
    <div className="flex flex-1 min-h-0">
      <div className="relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-6 py-8"
        style={{ background: 'radial-gradient(circle at 50% 34%, #0d3b66 0%, #0a2a4a 45%, #06223f 100%), radial-gradient(circle at 18% 78%, rgba(124,255,178,0.14), transparent 42%), radial-gradient(circle at 82% 72%, rgba(56,189,248,0.16), transparent 42%)' }}>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(6,16,32,0.72)', border: '1px solid rgba(56,189,248,0.4)' }}>
          <span style={{ fontSize: 16 }}>🏊</span>
          <span className="font-orbitron font-bold text-[10px] tracking-widest text-white/90">PARTIDA ENCERRADA</span>
        </div>

        <div className="absolute bottom-4 left-4 z-20 rounded-2xl overflow-hidden" style={{ width: 280, background: 'rgba(6,16,32,0.82)', border: '1px solid rgba(56,189,248,0.35)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 13 }}>📊</span>
            <span className="font-orbitron font-bold text-[11px] tracking-widest text-white/85">ESTATÍSTICAS DA PARTIDA</span>
          </div>
          <div className="px-4 py-1">
            {statRows.map(([label, value], i) => (
              <div key={label} className="flex items-center justify-between py-2" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <span className="font-rajdhani text-[13px] text-white/60">{label}</span>
                <span className="font-orbitron font-bold text-[13px] text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {CONFETTI.map((c, i) => (
          <motion.div key={i} className="absolute pointer-events-none" style={{ left: `${c.left}%`, top: `${c.top}%`, width: c.w, height: c.h, background: c.col, borderRadius: 2, transform: `rotate(${c.rot}deg)`, opacity: 0.85 }}
            animate={{ y: [0, 16, 0], rotate: [c.rot, c.rot + 40, c.rot] }} transition={{ duration: c.dur, repeat: Infinity, ease: 'easeInOut', delay: c.delay }} />
        ))}

        <motion.div className="text-center relative z-10" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div style={{ fontSize: 34, lineHeight: 0.8 }}>🏆</div>
          <h1 className="font-orbitron italic font-black tracking-wider mt-1"
            style={{ fontSize: 'clamp(34px, 6vw, 60px)', backgroundImage: 'linear-gradient(180deg, #ffffff 30%, #bfe9ff 70%, #38bdf8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.3)) drop-shadow(0 0 24px rgba(56,189,248,0.7))' }}>
            FIM DE JOGO!
          </h1>
          {teamWin && (
            <div className="inline-flex items-center gap-2 mt-3 rounded-xl px-5 py-2" style={{ background: `${TEAM_COLOR[teamWin as Team]}33`, border: `1px solid ${TEAM_COLOR[teamWin as Team]}` }}>
              <span style={{ fontSize: 14 }}>👑</span>
              <span className="font-orbitron font-bold text-xs tracking-widest text-white">TIME {teamWin} DOMINOU A PISCINA!</span>
            </div>
          )}
          {top[0] && (
            <div className="inline-flex items-center gap-2 mt-3 ml-2 rounded-xl px-5 py-2" style={{ background: 'rgba(255,210,74,0.2)', border: '1px solid rgba(255,210,74,0.6)' }}>
              <span style={{ fontSize: 14 }}>🥇</span>
              <span className="font-orbitron font-bold text-xs tracking-widest text-white">REI DA PISCINA: {top[0].name} ({top[0].knockouts} KO)</span>
            </div>
          )}
        </motion.div>

        {top.length === 0 ? (
          <p className="font-rajdhani text-white/40 mt-16 relative z-10">ninguém entrou na piscina ainda.</p>
        ) : (
          <div className="flex items-end justify-center gap-4 md:gap-8 mt-12 relative z-10">
            {top[1] && <PodiumPlace row={top[1]} rank={2} sprite={sprite} />}
            {top[0] && <PodiumPlace row={top[0]} rank={1} sprite={sprite} />}
            {top[2] && <PodiumPlace row={top[2]} rank={3} sprite={sprite} />}
          </div>
        )}

        <div className="flex flex-col items-center gap-3 mt-12 relative z-10">
          <motion.button onClick={onSorteio} className="flex flex-col items-center justify-center rounded-2xl text-white"
            style={{ padding: '14px 48px', background: 'linear-gradient(180deg, #38bdf8, #1d7fc0)', border: '1px solid rgba(160,220,255,0.7)', boxShadow: '0 8px 26px rgba(56,189,248,0.5), inset 0 2px 0 rgba(255,255,255,0.35)' }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <span className="font-orbitron font-black tracking-widest text-lg flex items-center gap-2">🎟️ SORTEIO</span>
            <span className="font-rajdhani text-[11px] tracking-wide text-white/80">vira sorteio · 1 ticket + 1 por queda</span>
          </motion.button>
          <div className="flex items-center gap-3">
            <button onClick={onContinue} className="font-orbitron text-[11px] tracking-widest px-5 py-2.5 rounded-xl" style={{ color: '#53FC1C', background: 'rgba(83,252,28,0.08)', border: '1px solid rgba(83,252,28,0.4)' }}>▶ CONTINUAR JOGO</button>
            <button onClick={onExit} className="font-orbitron text-[11px] tracking-widest px-5 py-2.5 rounded-xl" style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)' }}>✕ SAIR</button>
          </div>
        </div>
      </div>
      <LiveChatPanel messages={messages} endRef={endRef} />
    </div>
  );
}

const PODIUM_H = [128, 92, 70];
const PODIUM_BALL = [150, 112, 104];
function PodiumPlace({ row, rank, sprite }: { row: LeaderRow; rank: 1 | 2 | 3; sprite?: ProcessedSprite | null }) {
  const idx = rank - 1;
  return (
    <motion.div className="flex flex-col items-center justify-end relative z-10" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.12, type: 'spring', stiffness: 220, damping: 18 }}>
      {rank === 1 && <div style={{ fontSize: PODIUM_BALL[0] * 0.3, marginBottom: -6 }}>👑</div>}
      <ResultBall hue={row.hue} name={row.name} size={PODIUM_BALL[idx]} sprite={sprite} team={row.team} />
      <div className="font-orbitron font-black mt-1.5" style={{ color: '#FFD24A', fontSize: rank === 1 ? 24 : 19, textShadow: '0 0 12px rgba(255,210,74,0.7)' }}>{row.knockouts} KO</div>
      <div className="relative flex flex-col items-center justify-center mt-2"
        style={{ width: rank === 1 ? 150 : 124, height: PODIUM_H[idx], borderRadius: '12px 12px 4px 4px', background: 'linear-gradient(180deg,#1d7fc0,#0d3b66)', border: '1px solid rgba(160,220,255,0.55)', boxShadow: '0 12px 30px rgba(20,80,140,0.5), inset 0 3px 0 rgba(255,255,255,0.28)' }}>
        <span className="font-orbitron font-black text-white relative z-10" style={{ fontSize: rank === 1 ? 52 : 38, textShadow: '0 3px 8px rgba(0,0,0,0.5)' }}>{rank}</span>
      </div>
    </motion.div>
  );
}

function PoolIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="pw-glow"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g filter="url(#pw-glow)" stroke="#38bdf8" strokeWidth="1.8" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 13 Q7 10 12 13 T20.5 13" />
        <path d="M3.5 16.5 Q7 13.5 12 16.5 T20.5 16.5" />
      </g>
    </svg>
  );
}
