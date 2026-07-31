'use client';
import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import MascotContainer from '@/components/mascots/MascotContainer';

const PRIZE_ICONS = ['🏆', '🎮', '💰', '🎁', '⚔️', '🔥', '💎', '🌟'];


function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function hexToRgb(hex: string) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`;
}

function stripParens(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}


export default function ResultsPanel() {
  const {
    history, currentUser, chatMessages, themeColor,
    sessionStartTimestamp, sessionDuration, sessionParticipantCount,
    participants, liveViewerCount, twitchConfig, twitchConnected,
    setRaffleStage, setActiveTab,
    clearPrizes, setParticipants,
  } = useStore();

  const hasAnyPlatform = twitchConnected || Boolean(currentUser?.kickChannel) || Boolean(currentUser?.youtubeChannel);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const accent = themeColor;
  const accentRgb = hexToRgb(themeColor);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const myHistory = history.filter(r => r.streamer === currentUser?.username);
  const sessionResults = myHistory
    .filter(r => sessionStartTimestamp != null && r.timestamp >= sessionStartTimestamp)
    .reverse();

  const uniqueWinners = new Set(sessionResults.map(r => r.winner.name)).size;

  const exportResults = () => {
    if (!sessionResults.length) return;
    const csv = [
      'Nº,Nome,Prêmio,Data,Confirmado',
      ...sessionResults.map(r =>
        `${r.winner.number},"${r.winner.name}","${r.prize.name}",${new Date(r.timestamp).toLocaleString('pt-BR')},${r.confirmed ? 'Sim' : 'Não'}`
      ),
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })),
      download: `sorteio_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-visible" style={{ padding: '16px', gap: '12px' }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-3 min-h-0 overflow-visible relative z-10">

          {/* Participantes */}
          <div className="rounded-xl glass" style={{ border: `1px solid rgba(${accentRgb},0.2)`, padding: '16px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={accent}>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <span className="font-orbitron text-xs tracking-widest text-white/40 uppercase">Participantes</span>
            </div>
            <p className="font-orbitron font-black text-3xl" style={{ color: accent }}>{participants.length}</p>
            <p className="font-rajdhani text-xs text-white/30 tracking-widest mt-1 uppercase">Inscritos</p>
          </div>

          {/* Duração */}
          <div className="rounded-xl glass" style={{ border: '1px solid rgba(255,209,102,0.2)', padding: '16px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD166">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
              </svg>
              <span className="font-orbitron text-xs tracking-widest text-white/40 uppercase">Duração do Sorteio</span>
            </div>
            <p className="font-orbitron font-black text-3xl text-neon-gold">{formatDuration(sessionDuration)}</p>
            <p className="font-rajdhani text-xs text-white/30 tracking-widest mt-1 uppercase">Minutos</p>
          </div>

          {/* Status */}
          <div className="rounded-xl glass" style={{ border: '1px solid rgba(0,255,163,0.2)', padding: '16px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#00FFA3">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="font-orbitron text-xs tracking-widest text-white/40 uppercase">Status</span>
            </div>
            <p className="font-orbitron font-black text-xl" style={{ color: '#00FFA3' }}>CONCLUÍDO</p>
            <p className="font-rajdhani text-xs text-white/30 tracking-widest mt-1 uppercase">Com Sucesso</p>
          </div>

          {/* Mascot */}
          <div className="flex-1 relative w-full min-h-0 overflow-visible" style={{ marginTop: '-100px' }}>
            <MascotContainer isExploding={false} isScorched={false} maxScale={1.25} />
          </div>

          {/* VALEU CHAT */}
          <div className="w-full rounded-xl px-3 py-2.5 text-center flex-shrink-0"
            style={{ background: `rgba(${accentRgb},0.08)`, border: `1px solid rgba(${accentRgb},0.2)` }}>
            <p className="font-orbitron font-bold text-sm tracking-widest" style={{ color: accent }}>
              VALEU, CHAT!
            </p>
            <p className="font-rajdhani text-xs text-white/40 mt-0.5">Vocês são demais! 💚</p>
          </div>
        </div>

        {/* ── CENTER ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Header */}
          <div className="text-center flex-shrink-0">
            <motion.div className="text-3xl mb-1 inline-block"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}>
              👑
            </motion.div>
            <p className="font-rajdhani text-xs tracking-[0.3em] text-white/40 uppercase">Sorteio Finalizado!</p>
            <h1 className="font-orbitron font-black text-2xl tracking-widest mt-0.5"
              style={{ color: accent, textShadow: `0 0 40px rgba(${accentRgb},0.6)` }}>
              RESULTADOS DO SORTEIO
            </h1>
            <div className="flex items-center justify-center gap-3 mt-1">
              <div className="h-px flex-1 rounded-full" style={{ background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.4))` }} />
              <p className="font-rajdhani text-xs text-white/30">Obrigado a todos que participaram! 🔥</p>
              <div className="h-px flex-1 rounded-full" style={{ background: `linear-gradient(90deg, rgba(${accentRgb},0.4), transparent)` }} />
            </div>
          </div>

          {/* Results table */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0" style={{ gap: '8px', paddingRight: '4px' }}>
            {sessionResults.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🏆</div>
                <p className="font-rajdhani text-white/30 text-sm tracking-widest">Nenhum resultado nesta sessão</p>
              </div>
            ) : sessionResults.map((result, i) => {
              return (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="flex items-center gap-4 rounded-xl"
                  style={{
                    padding: '24px 32px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Rank number */}
                  <div
                    className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-orbitron font-black text-lg"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
                  >
                    {i + 1}
                  </div>

                  {/* Prize image */}
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.15)' }}>
                    {result.prize.imageUrl ? (
                      <img src={result.prize.imageUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl">{PRIZE_ICONS[result.prize.order % PRIZE_ICONS.length] ?? '🏆'}</span>
                    )}
                  </div>

                  {/* Prize name + qty */}
                  <div className="flex-shrink-0 min-w-[200px]">
                    <p className="font-orbitron font-bold text-lg text-white tracking-wide leading-tight">
                      {stripParens(result.prize.name)}
                    </p>
                    <p className="font-rajdhani text-sm text-white/30 tracking-widest mt-0.5">
                      {result.prize.quantity}x
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-px h-16" style={{ background: 'rgba(255,255,255,0.08)' }} />

                  {/* Winner */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-orbitron font-bold text-lg"
                      style={{ background: `rgba(${accentRgb},0.18)`, color: accent, border: `1px solid rgba(${accentRgb},0.3)` }}
                    >
                      {stripParens(result.winner.name)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-rajdhani font-bold tracking-[0.3em] text-white/30 uppercase"
                        style={{ fontSize: '11px' }}>
                        GANHADOR
                      </p>
                      <p className="font-rajdhani font-bold text-2xl text-white leading-tight truncate">
                        {stripParens(result.winner.name)}
                      </p>
                      <p className="font-rajdhani text-sm text-white/30 truncate">
                        @{stripParens(result.winner.name).toLowerCase().replace(/\s+/g, '')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-3 min-h-0">

          {/* Resumo Geral */}
          <div className="glass rounded-xl flex-shrink-0" style={{ border: `1px solid rgba(${accentRgb},0.15)`, padding: '16px' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={accent}>
                <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/>
              </svg>
              <span className="font-orbitron text-xs tracking-widest text-white/60">RESUMO GERAL</span>
            </div>
            <div className="flex flex-col" style={{ gap: '10px' }}>
              {[
                { label: 'Prêmios Sorteados', value: sessionResults.length },
                { label: 'Total de Vencedores', value: uniqueWinners },
                { label: 'Participações no Chat', value: chatMessages.length.toLocaleString('pt-BR') },
                { label: 'Pico de Espectadores', value: sessionParticipantCount.toLocaleString('pt-BR') },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="font-rajdhani text-xs text-white/40 tracking-wider leading-tight">{label}</span>
                  <span className="font-orbitron font-bold text-sm text-white/80 flex-shrink-0">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat da Live */}
          <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Chat header */}
            <div className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="font-orbitron text-xs tracking-widest text-white/50">CHAT DA LIVE</span>
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-neon-green ml-1"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0" style={{ padding: '12px', gap: '6px' }}>
              {chatMessages.length === 0 ? (
                <p className="font-rajdhani text-xs text-white/20 text-center pt-4 tracking-widest">
                  sem mensagens
                </p>
              ) : chatMessages.slice(-40).map((msg, i) => (
                <div key={msg.id ?? i} className="flex items-start gap-1.5">
                  <span className="font-rajdhani font-bold text-xs flex-shrink-0 leading-snug"
                    style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {msg.source === 'twitch' && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}>
                        <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                      </svg>
                    )}
                    {msg.source === 'kick' && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}>
                        <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                      </svg>
                    )}
                    {msg.source === 'youtube' && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                        <path d="m10 15 5-3-5-3z"/>
                      </svg>
                    )}
                    {msg.username}:
                  </span>
                  <span className="font-rajdhani text-xs text-white/55 break-words leading-snug">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTIONS ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center"
        style={{ gap: '12px', padding: '12px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Ver Histórico */}
        <motion.button
          onClick={() => { setRaffleStage(1); setActiveTab('history'); }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
          style={{
            height: '52px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
          </svg>
          <div>
            <div>VER HISTÓRICO</div>
            <div className="font-rajdhani tracking-wider opacity-50" style={{ fontSize: '10px' }}>DO SORTEIO</div>
          </div>
        </motion.button>

        {/* Novo Sorteio */}
        <motion.button
          onClick={() => { clearPrizes(); setParticipants([]); setRaffleStage(1); setActiveTab('raffle'); }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex-[1.4] flex items-center justify-center gap-2.5 rounded-xl font-orbitron font-bold tracking-widest text-sm"
          style={{
            height: '52px',
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 100%)`,
            color: '#050816',
            boxShadow: `0 0 28px rgba(${accentRgb},0.3)`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          <div>
            <div>NOVO SORTEIO</div>
            <div className="font-rajdhani tracking-wider opacity-70" style={{ fontSize: '10px' }}>COMEÇAR AGORA</div>
          </div>
        </motion.button>

        {/* Exportar */}
        <motion.button
          onClick={exportResults}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="flex-1 flex items-center justify-center gap-2.5 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
          style={{
            height: '52px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          <div>
            <div>EXPORTAR RESULTADOS</div>
            <div className="font-rajdhani tracking-wider opacity-50" style={{ fontSize: '10px' }}>BAIXAR .CSV</div>
          </div>
        </motion.button>
      </div>

      {/* ── LIVE BANNER ──────────────────────────────────────────────── */}
      {hasAnyPlatform && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 font-rajdhani text-xs text-white/20"
          style={{ padding: '6px 16px 10px' }}>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          {(() => {
            const channelName = (twitchConnected && twitchConfig.channel)
              ? twitchConfig.channel
              : currentUser?.kickChannel || currentUser?.youtubeChannel || currentUser?.username || '';
            return liveViewerCount !== null && liveViewerCount > 0 ? (
              <>
                <span>Transmitido ao vivo para</span>
                <span className="font-orbitron font-bold" style={{ color: 'rgba(145,71,255,0.85)', fontSize: 11 }}>
                  {liveViewerCount.toLocaleString('pt-BR')}
                </span>
                <span>pessoa{liveViewerCount !== 1 ? 's' : ''}</span>
                {channelName && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-orbitron font-bold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                      {channelName}
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <span>Sorteio transmitido ao vivo</span>
                {channelName && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-orbitron font-bold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                      {channelName}
                    </span>
                  </>
                )}
              </>
            );
          })()}
          <span className="flex items-center gap-1.5 ml-1">
            {twitchConnected && twitchConfig.channel && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(145,71,255,0.6)">
                <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
              </svg>
            )}
            {currentUser?.kickChannel && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(83,252,28,0.6)">
                <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
              </svg>
            )}
            {currentUser?.youtubeChannel && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,0,0,0.6)">
                <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.9C6.8 19 12 19 12 19s4.8 0 7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.8 14.5V9l5.4 2.8-5.4 2.7z"/>
              </svg>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
