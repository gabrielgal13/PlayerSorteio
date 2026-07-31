'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import ParticleCanvas from '@/components/effects/ParticleCanvas';
import NeonGrid from '@/components/effects/NeonGrid';
import RaffleEngine from '@/components/raffle/RaffleEngine';
import EventConfig from '@/components/raffle/EventConfig';
import ResultsPanel from '@/components/raffle/ResultsPanel';
import TwitchPanel from '@/components/twitch/TwitchPanel';
import HistoryPanel from '@/components/history/HistoryPanel';
import HangmanGame from '@/components/games/HangmanGame';
import WorldGuessr from '@/components/games/WorldGuessr';
import SkribllGame from '@/components/games/SkribllGame';
import ChatWarsGame from '@/components/games/ChatWarsGame';
import PoolWarsGame from '@/components/games/PoolWarsGame';
import PokeArenaGame from '@/components/games/PokeArenaGame';
import GamesLobby from '@/components/games/GamesLobby';
import CommunityBar from '@/components/community/CommunityBar';
import EntregasPage from '@/components/deliveries/EntregasPage';
import PscHistoryPage from '@/components/psc/PscHistoryPage';
import type { AppTab } from '@/types';

const TABS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'raffle',
    label: 'LOBBY DO SORTEIO',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
      </svg>
    ),
  },
  {
    id: 'games',
    label: 'JOGOS',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5S19.33 12 18.5 12z"/>
      </svg>
    ),
  },
];

export default function Dashboard() {
  const {
    currentUser, logout,
    history,
    activeTab, setActiveTab,
    obsMode, setObsMode,
    audioEnabled, setAudioEnabled,
    raffleStage, setRaffleStage,
    eventBackground, setEventBackground,
    pscBalance,
    isAffiliate,
    testMode, exitTestMode,
  } = useStore();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [exitingTest, setExitingTest] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [activeGame, setActiveGame] = useState<'hangman' | 'worldguessr' | 'skribll' | 'chatwars' | 'poolwars' | 'pokearena' | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // eventBackground (fundo do mascote na hora do sorteio) também não sobrevive
  // a um refresh — só currentUser fica salvo. Se ainda não tem fundo custom
  // escolhido, reaplica o padrão do mascote a partir do que já está persistido.
  useEffect(() => {
    if (eventBackground) return;
    if (currentUser?.mascot === 'dreads') setEventBackground('/fundo-ganja.png');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.mascot]);

  // pscBalance/isAffiliate não sobrevivem a um refresh de página (não ficam no
  // localStorage) — resincroniza com o saldo real do banco assim que monta,
  // pra nunca mostrar um saldo desatualizado (ex: 0 depois de um F5).
  // Modo teste não tem PSC — resincronizar traria o saldo real do streamer de volta.
  useEffect(() => {
    if (!currentUser?.username || testMode) return;
    fetch(`/api/streamer/config?username=${encodeURIComponent(currentUser.username)}`)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.pscBalance === 'number') {
          useStore.setState({ pscBalance: data.pscBalance, isAffiliate: data.isAffiliate ?? true });
        }
      })
      .catch(() => {});
  }, [currentUser?.username, testMode]);

  useEffect(() => {
    if (activeTab !== 'games') setActiveGame(null);
  }, [activeTab]);

  const novosCount = history.filter(
    r => r.streamer === currentUser?.username && (r.deliveryStatus ?? 'novo') === 'novo'
  ).length;

  if (!currentUser) return null;

  return (
    <div
      className={`relative w-full h-screen flex flex-col overflow-hidden ${obsMode ? 'obs-mode' : ''}`}
      style={{ background: '#050816' }}
    >
      {/* Custom event background — during raffle (stage 2) and results (stage 3) */}
      {eventBackground && activeTab === 'raffle' && raffleStage === 2 && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <img
            src={eventBackground}
            alt=""
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.5) saturate(0.9)',
              transform: 'scale(1)',
              opacity: 0.82,
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,22,0.35)' }} />
        </div>
      )}

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <ParticleCanvas count={60} intensity="low" />
        <NeonGrid />
      </div>

      {/* MODO TESTE — faixa fixa no topo enquanto o admin está vendo a conta */}
      {testMode && !obsMode && (
        <motion.div
          className="relative z-30 flex items-center gap-3 px-4 md:px-6 py-2 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(255,180,0,0.16), rgba(255,120,0,0.08))',
            borderBottom: '1px solid rgba(255,180,0,0.35)',
          }}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <motion.span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: '#FFB400', boxShadow: '0 0 8px rgba(255,180,0,0.8)' }}
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <span
            className="font-orbitron font-bold tracking-widest flex-shrink-0"
            style={{ fontSize: '11px', color: 'rgba(255,180,0,0.95)' }}
          >
            MODO TESTE
          </span>
          <span className="font-rajdhani tracking-wide" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
            Vendo a conta de <span style={{ color: 'rgba(255,180,0,0.9)', fontWeight: 700 }}>
              {currentUser.displayName || currentUser.username}
            </span>{' '}
            — nada é gravado no banco, nenhum sorteio entra no histórico e não há PSC.
          </span>
          <div className="flex-1" />
          <button
            onClick={async () => { setExitingTest(true); await exitTestMode(); }}
            disabled={exitingTest}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-orbitron font-bold tracking-widest transition-all flex-shrink-0"
            style={{
              fontSize: '10px',
              background: 'rgba(255,180,0,0.12)',
              border: '1px solid rgba(255,180,0,0.4)',
              color: 'rgba(255,180,0,0.95)',
              opacity: exitingTest ? 0.5 : 1,
              cursor: exitingTest ? 'wait' : 'pointer',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {exitingTest ? 'SAINDO...' : 'SAIR DO MODO TESTE'}
          </button>
        </motion.div>
      )}

      {/* HEADER */}
      {!obsMode && (
        <motion.header
          className="relative z-20 flex items-center gap-4 px-4 md:px-6 py-3 hide-in-obs"
          style={{
            background: 'rgba(5,8,22,0.8)',
            borderBottom: '1px solid rgba(0,229,255,0.12)',
          }}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex flex-col items-start">
              <img src="/wordmark.png" alt="PlayerSkins" className="h-7 object-contain" />
              <span className="font-rajdhani text-xs tracking-widest text-white/25 -mt-0.5">LOBBY DO SORTEIO</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-rajdhani text-xs tracking-wider transition-all flex-shrink-0 ${
                  activeTab === tab.id ? 'tab-active' : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-neon-purple' : 'text-current'}>
                  {tab.icon}
                </span>
                {tab.label}

              </button>
            ))}
          </div>

          {/* PSC Balance — only for affiliates */}
          {isAffiliate && (
            <motion.div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,163,0.08), rgba(0,229,255,0.05))',
                border: '1px solid rgba(0,255,163,0.2)',
                boxShadow: pscBalance > 0 ? '0 0 16px rgba(0,255,163,0.08)' : 'none',
              }}
              animate={pscBalance > 0 ? { boxShadow: ['0 0 8px rgba(0,255,163,0.06)', '0 0 20px rgba(0,255,163,0.12)', '0 0 8px rgba(0,255,163,0.06)'] } : {}}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <span style={{ fontSize: '14px', lineHeight: 1 }}>💠</span>
              <div className="flex flex-col items-start">
                <span className="font-orbitron font-bold text-neon-green" style={{ fontSize: '13px', lineHeight: 1, letterSpacing: '0.04em' }}>
                  {Math.ceil(pscBalance).toLocaleString('pt-BR')}
                </span>
                <span className="font-rajdhani text-white/30 tracking-widest" style={{ fontSize: '8px' }}>
                  PLAYERSKINS COINS
                </span>
              </div>
            </motion.div>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Audio toggle */}
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Desativar som' : 'Ativar som'}
              className="p-2 rounded-lg transition-all"
              style={{ color: audioEnabled ? 'rgba(0,229,255,0.7)' : 'rgba(255,255,255,0.2)' }}
            >
              {audioEnabled ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              )}
            </button>

            {/* OBS mode toggle */}
            <button
              onClick={() => setObsMode(!obsMode)}
              title="Modo OBS"
              className="p-2 rounded-lg transition-all text-white/30 hover:text-neon-cyan hover:bg-neon-cyan/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </button>

            {/* User menu */}
            <div className="relative flex-shrink-0" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: showUserMenu ? 'rgba(0,229,255,0.15)' : 'rgba(0,229,255,0.1)',
                  border: showUserMenu ? '1px solid rgba(0,229,255,0.35)' : '1px solid rgba(0,229,255,0.2)',
                }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #00E5FF, #00CFFF)', color: '#050816', fontWeight: 700 }}>
                  {currentUser.displayName?.[0].toUpperCase()}
                </div>
                <span className="font-rajdhani text-xs text-neon-purple font-bold tracking-wide">
                  {currentUser.displayName}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(0,229,255,0.5)"
                  style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.13 }}
                    className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(6,9,24,0.98)',
                      border: '1px solid rgba(0,229,255,0.18)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                      minWidth: '170px',
                    }}
                  >
                    {!currentUser.isAdmin && (
                      <>
                        <button
                          onClick={() => { setShowUserMenu(false); setActiveTab('entregas'); }}
                          className="w-full flex items-center gap-3 px-4 py-3 font-rajdhani font-bold text-xs tracking-widest transition-all text-left"
                          style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; e.currentTarget.style.color = '#00E5FF'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                          </svg>
                          ENTREGAS
                          {novosCount > 0 && (
                            <span className="ml-auto font-orbitron" style={{ fontSize: '9px', background: 'rgba(0,229,255,0.2)', color: '#00E5FF', padding: '1px 5px', borderRadius: '4px' }}>
                              {novosCount}
                            </span>
                          )}
                        </button>
                        {isAffiliate && (
                          <button
                            onClick={() => { setShowUserMenu(false); setActiveTab('psc-history'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 font-rajdhani font-bold text-xs tracking-widest transition-all text-left"
                            style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,163,0.06)'; e.currentTarget.style.color = '#00FFA3'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                          >
                            <span style={{ fontSize: '13px', lineHeight: 1 }}>💠</span>
                            HISTÓRICO PSC
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => { setShowUserMenu(false); setActiveTab('history'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 font-rajdhani font-bold text-xs tracking-widest transition-all text-left"
                      style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.06)'; e.currentTarget.style.color = '#00E5FF'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                      </svg>
                      HISTÓRICO DE SORTEIOS
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); logout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 font-rajdhani font-bold text-xs tracking-widest transition-all text-left"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.08)'; e.currentTarget.style.color = '#FF4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                      </svg>
                      SAIR
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>
      )}

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">

          {/* SORTEIO — etapa 1: configuração / etapa 2: sorteio */}
          {activeTab === 'raffle' && (
            <motion.div key="raffle" className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}>

              <AnimatePresence mode="wait">
                {raffleStage === 1 ? (
                  <motion.div key="config" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}>
                    <EventConfig />
                  </motion.div>
                ) : raffleStage === 3 ? (
                  <motion.div key="results" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.4 }}>
                    <ResultsPanel />
                  </motion.div>
                ) : (
                  <motion.div key="engine" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}>
                    <RaffleEngine />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}


          {/* HISTORY */}
          {activeTab === 'history' && (
            <motion.div key="history"
              className="flex-1 px-4 md:px-6 pt-8 md:pt-10 pb-4 md:pb-6 overflow-y-auto"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="max-w-2xl mx-auto">
                <div className="glass rounded-2xl p-6" style={{ border: '1px solid rgba(0,229,255,0.12)' }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#00E5FF">
                        <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-orbitron font-bold text-sm tracking-widest text-white">HISTÓRICO</h2>
                      <div className="h-0.5 w-12 mt-1 rounded-full" style={{ background: 'linear-gradient(90deg, #00E5FF, transparent)' }} />
                    </div>
                  </div>
                  <HistoryPanel />
                </div>
              </div>
            </motion.div>
          )}

          {/* ENTREGAS */}
          {activeTab === 'entregas' && (
            <motion.div key="entregas"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <EntregasPage />
            </motion.div>
          )}

          {/* PSC HISTORY */}
          {activeTab === 'psc-history' && (
            <motion.div key="psc-history"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <PscHistoryPage />
            </motion.div>
          )}

          {/* GAMES */}
          {activeTab === 'games' && (
            <motion.div key="games"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              <AnimatePresence mode="wait">
                {activeGame === 'hangman' ? (
                  <motion.div key="hangman" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <HangmanGame onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : activeGame === 'worldguessr' ? (
                  <motion.div key="worldguessr" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <WorldGuessr onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : activeGame === 'skribll' ? (
                  <motion.div key="skribll" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <SkribllGame onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : activeGame === 'chatwars' ? (
                  <motion.div key="chatwars" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <ChatWarsGame onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : activeGame === 'poolwars' ? (
                  <motion.div key="poolwars" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <PoolWarsGame onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : activeGame === 'pokearena' ? (
                  <motion.div key="pokearena" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}>
                    <PokeArenaGame onBack={() => setActiveGame(null)} />
                  </motion.div>
                ) : (
                  <motion.div key="games-lobby" className="flex-1 flex flex-col min-h-0"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}>
                    <GamesLobby onSelectGame={id => setActiveGame(id)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>

        {/* TwitchPanel — sempre montado (hidden) para manter conexão de chat */}
        <div className="hidden">
          <TwitchPanel />
        </div>
      </main>

      {/* COMMUNITY BAR */}
      {!obsMode && raffleStage === 1 && <CommunityBar />}

      {/* OBS exit button */}
      {obsMode && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => setObsMode(false)}
            className="px-3 py-1.5 rounded-lg font-rajdhani text-xs tracking-widest"
            style={{ background: 'rgba(255,68,68,0.2)', border: '1px solid rgba(255,68,68,0.4)', color: '#FF4444' }}
          >
            EXIT OBS
          </button>
        </div>
      )}
    </div>
  );
}
