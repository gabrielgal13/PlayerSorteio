'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { useHangmanStore } from '@/store/useHangmanStore';

/* ── helpers ────────────────────────────────────────────────────────────────── */
function validVote(msg: string, allowNums: boolean): string | null {
  const t = msg.trim().toUpperCase();
  if (t.length !== 1) return null;
  if (/[A-Z]/.test(t)) return t;
  if (allowNums && /[0-9]/.test(t)) return t;
  return null;
}

function charNeedsGuess(c: string, allowNums: boolean) {
  return /[A-Z]/.test(c) || (allowNums && /[0-9]/.test(c));
}

/* ── Toggle ──────────────────────────────────────────────────────────────────── */
function Toggle({ value, onChange, color = '#00E5FF' }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button onClick={() => onChange(!value)}
      className="w-10 h-6 rounded-full transition-all relative flex-shrink-0"
      style={{ background: value ? color : 'rgba(255,255,255,0.1)', border: `1px solid ${value ? color : 'rgba(255,255,255,0.08)'}` }}>
      <motion.div className="w-4 h-4 rounded-full bg-white absolute top-0.5"
        animate={{ left: value ? '22px' : '4px' }} transition={{ duration: 0.18 }} />
    </button>
  );
}

/* ── Scaffold SVG ────────────────────────────────────────────────────────────── */
function ScaffoldSVG({ wrongCount, maxLives, isOver }: { wrongCount: number; maxLives: number; isOver: boolean }) {
  const n = Math.min(Math.round((wrongCount / maxLives) * 6), 6);
  const clr = isOver ? '#FF3333' : '#39FF14';
  const lp = {
    stroke: clr, strokeWidth: 3.5 as number,
    strokeLinecap: 'round' as const,
    filter: isOver ? 'url(#dg)' : 'url(#bg)',
    fill: 'none',
  };

  return (
    <svg viewBox="0 0 220 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="dg"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="sg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {/* scaffold */}
      <rect x="10" y="282" width="200" height="11" rx="4" fill="#0a0a1a" stroke="rgba(57,255,20,0.45)" strokeWidth="1.5" filter="url(#sg)" />
      <rect x="38" y="18" width="12" height="266" rx="4" fill="#0a0a1a" stroke="rgba(57,255,20,0.28)" strokeWidth="1.5" />
      <rect x="38" y="18" width="132" height="12" rx="4" fill="#0a0a1a" stroke="rgba(57,255,20,0.28)" strokeWidth="1.5" filter="url(#sg)" />
      <line x1="38" y1="70" x2="92" y2="18" stroke="rgba(57,255,20,0.15)" strokeWidth="2" strokeLinecap="round" />
      <rect x="162" y="30" width="8" height="40" rx="2" fill="#1e1e30" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      <AnimatePresence>
        {n >= 1 && (
          <motion.g key="head"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{ transformOrigin: '166px 98px' }}>
            <circle cx={166} cy={98} r={22} {...lp} />
            {isOver && (
              <>
                <line x1={158} y1={91} x2={163} y2={96} stroke={clr} strokeWidth={2} strokeLinecap="round" />
                <line x1={163} y1={91} x2={158} y2={96} stroke={clr} strokeWidth={2} strokeLinecap="round" />
                <line x1={170} y1={91} x2={175} y2={96} stroke={clr} strokeWidth={2} strokeLinecap="round" />
                <line x1={175} y1={91} x2={170} y2={96} stroke={clr} strokeWidth={2} strokeLinecap="round" />
                <path d="M 159 109 Q 166 104 173 109" stroke={clr} strokeWidth={2} fill="none" strokeLinecap="round" />
              </>
            )}
          </motion.g>
        )}
        {n >= 2 && (
          <motion.path key="body" d="M 166 120 L 166 188" {...lp}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.35 }} />
        )}
        {n >= 3 && (
          <motion.path key="larm" d="M 166 146 L 135 174" {...lp}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.28 }} />
        )}
        {n >= 4 && (
          <motion.path key="rarm" d="M 166 146 L 197 174" {...lp}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.28 }} />
        )}
        {n >= 5 && (
          <motion.path key="lleg" d="M 166 188 L 138 240" {...lp}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.30 }} />
        )}
        {n >= 6 && (
          <motion.path key="rleg" d="M 166 188 L 194 240" {...lp}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.30 }} />
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ── ETAPAS indicators ───────────────────────────────────────────────────────── */
function EtapasBar({ wrongCount, maxLives }: { wrongCount: number; maxLives: number }) {
  const n = Math.min(Math.round((wrongCount / maxLives) * 6), 6);
  const parts = [
    { label: 'CABEÇA', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="7" /><path d="M9 10h.01M15 10h.01" strokeLinecap="round" /></svg> },
    { label: 'TRONCO', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="8" width="10" height="12" rx="2" /><path d="M12 8V4" strokeLinecap="round" /></svg> },
    { label: 'BR.ESQ', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="17" y1="5" x2="7" y2="19" strokeLinecap="round" /></svg> },
    { label: 'BR.DIR', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="7" y1="5" x2="17" y2="19" strokeLinecap="round" /></svg> },
    { label: 'PER.ESQ', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4 L12 16 L6 22" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { label: 'PER.DIR', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 4 L12 16 L18 22" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {parts.map((p, i) => (
        <div key={i} title={p.label}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: i < n ? 'rgba(255,51,51,0.18)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${i < n ? 'rgba(255,51,51,0.5)' : 'rgba(255,255,255,0.08)'}`,
            color: i < n ? '#FF3333' : 'rgba(255,255,255,0.2)',
            boxShadow: i < n ? '0 0 8px rgba(255,51,51,0.2)' : 'none',
          }}>
          {p.icon}
        </div>
      ))}
    </div>
  );
}

/* ── Chat message type ───────────────────────────────────────────────────────── */
interface ChatMsg { id: number; user: string; letter: string; source: 'twitch' | 'kick' | 'youtube'; }

/* ── Main component ──────────────────────────────────────────────────────────── */
export default function HangmanGame({ onBack }: { onBack?: () => void } = {}) {
  const { currentUser, addParticipantFromChat } = useStore();
  const {
    phase, word, guessedLetters, wrongLetters,
    lastChosenLetter, lastWasCorrect, config,
    setConfig, startGame, setPhase, processGuess, resetGame,
  } = useHangmanStore();

  const [inputWord, setInputWord] = useState('');
  const [showWord, setShowWord] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [timer, setTimer] = useState(0);
  const [displayVotes, setDisplayVotes] = useState<Record<string, number>>({});
  const [addedToRaffleCount, setAddedToRaffleCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  const chatMsgIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const tmiRef = useRef<unknown>(null);
  const kickWsRef = useRef<WebSocket | null>(null);
  const youtubeIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const youtubeLiveChatIdRef = useRef<string | null>(null);
  const youtubePageTokenRef = useRef<string | null>(null);
  const youtubeSeenIdsRef = useRef<Set<string>>(new Set());
  const localVotesRef = useRef<Record<string, number>>({});
  const localVotersRef = useRef<string[]>([]);
  const chatVotersRef = useRef<Record<string, string[]>>({});

  const phaseRef = useRef(phase);
  const configRef = useRef(config);
  const guessedRef = useRef(guessedLetters);
  const wrongRef = useRef(wrongLetters);
  const processGuessRef = useRef(processGuess);
  const setPhaseRef = useRef(setPhase);
  const addParticipantFromChatRef = useRef(addParticipantFromChat);
  const setAddedToRaffleCountRef = useRef(setAddedToRaffleCount);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { guessedRef.current = guessedLetters; }, [guessedLetters]);
  useEffect(() => { wrongRef.current = wrongLetters; }, [wrongLetters]);
  useEffect(() => { processGuessRef.current = processGuess; }, [processGuess]);
  useEffect(() => { setPhaseRef.current = setPhase; }, [setPhase]);
  useEffect(() => { addParticipantFromChatRef.current = addParticipantFromChat; }, [addParticipantFromChat]);

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (phase === 'reveal' && lastWasCorrect && lastChosenLetter) {
      const voters = chatVotersRef.current[lastChosenLetter] ?? [];
      setScores(prev => {
        const next = { ...prev };
        voters.forEach(u => { next[u] = (next[u] ?? 0) + 100; });
        return next;
      });
    }
  }, [phase, lastWasCorrect, lastChosenLetter]);

  /* ── YouTube polling ─────────────────────────────────────────────────────── */
  const startYoutubePoll = useCallback((handle: string, onMessage: (name: string, text: string) => void) => {
    youtubeSeenIdsRef.current = new Set();
    let retryDelay = 10000;
    const poll = async () => {
      try {
        const params = new URLSearchParams();
        if (youtubeLiveChatIdRef.current) {
          params.set('liveChatId', youtubeLiveChatIdRef.current);
          if (youtubePageTokenRef.current) params.set('pageToken', youtubePageTokenRef.current);
        } else {
          params.set('handle', handle);
        }
        const res = await fetch(`/api/youtube-live-chat?${params}`);
        if (!res.ok) {
          if (!youtubeLiveChatIdRef.current) {
            retryDelay = Math.min(retryDelay * 1.5, 60000);
            youtubeIntervalRef.current = setTimeout(poll, retryDelay);
          }
          return;
        }
        retryDelay = 10000;
        const data = await res.json() as {
          liveChatId: string;
          messages: { id: string; authorDetails: { displayName: string }; snippet: { displayMessage: string } }[];
          nextPageToken: string | null;
          pollingIntervalMillis: number;
        };
        if (!youtubeLiveChatIdRef.current) {
          youtubeLiveChatIdRef.current = data.liveChatId;
          youtubePageTokenRef.current = data.nextPageToken;
          youtubeSeenIdsRef.current = new Set(data.messages.map(m => m.id));
          for (const msg of data.messages.slice(-5)) {
            const name = msg.authorDetails?.displayName ?? 'anon';
            const text = msg.snippet?.displayMessage ?? '';
            if (text) onMessage(name, text);
          }
        } else {
          for (const msg of data.messages) {
            if (youtubeSeenIdsRef.current.has(msg.id)) continue;
            youtubeSeenIdsRef.current.add(msg.id);
            const name = msg.authorDetails?.displayName ?? 'anon';
            const text = msg.snippet?.displayMessage ?? '';
            if (text) onMessage(name, text);
          }
          youtubePageTokenRef.current = data.nextPageToken;
        }
        const delay = Math.max(data.pollingIntervalMillis ?? 5000, 3000);
        youtubeIntervalRef.current = setTimeout(poll, delay);
      } catch {
        retryDelay = Math.min(retryDelay * 1.5, 60000);
        youtubeIntervalRef.current = setTimeout(poll, retryDelay);
      }
    };
    poll();
  }, []);

  const stopYoutubePoll = useCallback(() => {
    if (youtubeIntervalRef.current) { clearTimeout(youtubeIntervalRef.current); youtubeIntervalRef.current = null; }
    youtubeLiveChatIdRef.current = null;
    youtubePageTokenRef.current = null;
    youtubeSeenIdsRef.current = new Set();
  }, []);

  /* ── handleChat ──────────────────────────────────────────────────────────── */
  const handleChat = useCallback((displayName: string, msg: string, source: 'twitch' | 'kick' | 'youtube' = 'twitch') => {
    const letter = validVote(msg, configRef.current.allowNumbersSymbols);
    if (!letter) return;

    const chatMsg: ChatMsg = { id: chatMsgIdRef.current++, user: displayName, letter, source };
    setChatMessages(prev => prev.length >= 120 ? [...prev.slice(1), chatMsg] : [...prev, chatMsg]);

    if (phaseRef.current !== 'countdown') return;
    if (guessedRef.current.includes(letter) || wrongRef.current.includes(letter)) return;

    if (!chatVotersRef.current[letter]) chatVotersRef.current[letter] = [];
    chatVotersRef.current[letter].push(displayName.toLowerCase());

    if (configRef.current.hardcore && localVotersRef.current.includes(displayName.toLowerCase())) return;
    localVotesRef.current[letter] = (localVotesRef.current[letter] ?? 0) + 1;
    if (configRef.current.hardcore) localVotersRef.current.push(displayName.toLowerCase());

    const added = addParticipantFromChatRef.current(displayName, source);
    if (added) setAddedToRaffleCountRef.current(prev => prev + 1);
  }, []);

  /* ── Connect / disconnect ────────────────────────────────────────────────── */
  const connectChat = useCallback(async () => {
    if (!currentUser) return;
    const { twitchChannel, kickChatroomId, kickChannel, youtubeChannel } = currentUser;
    try {
      const tmi = await import('tmi.js');
      const client = new tmi.Client({ channels: [twitchChannel || ''], connection: { reconnect: true, secure: true } });
      client.on('message', (_ch: string, tags: Record<string, string>, msg: string) => {
        handleChat(tags['display-name'] || tags.username || '', msg, 'twitch');
      });
      await client.connect();
      tmiRef.current = client;
      setChatConnected(true);
    } catch (e) { console.warn('Twitch hangman:', e); }

    if (kickChatroomId || kickChannel) {
      try {
        let cid = kickChatroomId;
        if (!cid && kickChannel) {
          const r = await fetch(`/api/kick-channel/${kickChannel}`);
          cid = (await r.json() as { chatroomId: number }).chatroomId;
        }
        const ws = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false');
        ws.addEventListener('open', () => ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${cid}.v2` } })));
        ws.addEventListener('message', (ev) => {
          try {
            const m = JSON.parse(ev.data as string) as { event: string; data: unknown };
            if (m.event === 'pusher:ping') { ws.send(JSON.stringify({ event: 'pusher:pong', data: {} })); return; }
            if (m.event === 'App\\Events\\ChatMessageEvent') {
              const p = (typeof m.data === 'string' ? JSON.parse(m.data) : m.data) as { sender?: { username?: string }; content?: string };
              if (p?.sender?.username && p?.content) handleChat(p.sender.username, p.content, 'kick');
            }
          } catch { /* ignore */ }
        });
        kickWsRef.current = ws;
      } catch (e) { console.warn('Kick hangman:', e); }
    }
    if (youtubeChannel) startYoutubePoll(youtubeChannel, (name, text) => handleChat(name, text, 'youtube'));
  }, [currentUser, handleChat, startYoutubePoll]);

  const disconnectChat = useCallback(async () => {
    const c = tmiRef.current as { disconnect?: () => Promise<void> } | null;
    try { await c?.disconnect?.(); } catch { /* ignore */ }
    tmiRef.current = null;
    kickWsRef.current?.close();
    kickWsRef.current = null;
    stopYoutubePoll();
    setChatConnected(false);
  }, [stopYoutubePoll]);

  useEffect(() => () => { disconnectChat(); }, [disconnectChat]);
  useEffect(() => { if (phase === 'ready' && !chatConnected) connectChat(); }, [phase, chatConnected, connectChat]);
  useEffect(() => { if (phase === 'config') disconnectChat(); }, [phase, disconnectChat]);

  /* ── Vote display sync ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'countdown') return;
    localVotesRef.current = {};
    localVotersRef.current = [];
    chatVotersRef.current = {};
    setDisplayVotes({});
    const iv = setInterval(() => setDisplayVotes({ ...localVotesRef.current }), 250);
    return () => clearInterval(iv);
  }, [phase]);

  /* ── Countdown timer ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'countdown') return;
    const effective = configRef.current.turbo ? 5 : configRef.current.timePerRound;
    setTimer(effective);
    const iv = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          const sorted = Object.entries(localVotesRef.current).sort(([, a], [, b]) => b - a);
          if (sorted.length === 0) setPhaseRef.current('ready');
          else processGuessRef.current(sorted[0][0]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  /* ── Auto-advance reveal → ready ─────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = setTimeout(() => setPhaseRef.current('ready'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => { if (phase === 'ready') setAddedToRaffleCount(0); }, [phase]);

  /* ── Computed values ─────────────────────────────────────────────────────── */
  const livesLeft = config.lives - wrongLetters.length;
  const effectiveTime = config.turbo ? 5 : config.timePerRound;

  const displayChars = word.split('').map((char) => ({
    char,
    shown: char === ' ' ? ' ' : !charNeedsGuess(char, config.allowNumbersSymbols) ? char : guessedLetters.includes(char) ? char : '_',
    isBlank: charNeedsGuess(char, config.allowNumbersSymbols) && !guessedLetters.includes(char),
    justRevealed: char === lastChosenLetter && lastWasCorrect === true && phase === 'reveal',
  }));

  const nonSpaceCount = word.replace(/ /g, '').length;
  const wordFontSize = nonSpaceCount <= 5 ? 52 : nonSpaceCount <= 9 ? 40 : nonSpaceCount <= 14 ? 30 : 24;

  const sortedVotes = Object.entries(displayVotes).sort(([, a], [, b]) => b - a).slice(0, 8);
  const maxVotes = sortedVotes[0]?.[1] ?? 1;
  const totalVotes = Object.values(displayVotes).reduce((s, v) => s + v, 0);

  const allTried = [...new Set([...guessedLetters, ...wrongLetters])].sort();
  const topScores = Object.entries(scores).sort(([, a], [, b]) => b - a).slice(0, 5);

  /* ════════════════════════════════════════════════════════════════════════════
     CONFIG SCREEN
  ════════════════════════════════════════════════════════════════════════════ */
  if (phase === 'config') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-rajdhani text-xs tracking-widest transition-all mb-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#00E5FF'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              JOGOS
            </button>
          )}
          <div className="text-center space-y-1">
            <h1 className="font-orbitron text-2xl font-black tracking-widest text-white">JOGO DA FORCA</h1>
            <p className="font-rajdhani text-sm text-white/30 tracking-wide">Chat vota a letra — a mais spammada é escolhida</p>
          </div>

          {/* Word + category */}
          <div className="glass rounded-2xl p-5 space-y-4" style={{ border: '1px solid rgba(0,229,255,0.15)' }}>
            <div className="space-y-2">
              <span className="block font-rajdhani text-xs text-white/40 tracking-widest uppercase">Palavra / Frase</span>
              <div className="relative">
                <input
                  type={showWord ? 'text' : 'password'}
                  value={inputWord}
                  onChange={e => setInputWord(e.target.value.toUpperCase())}
                  placeholder="Ex: VALORANT"
                  className="input-neon w-full px-4 py-3 rounded-xl font-mono text-lg uppercase tracking-widest pr-12"
                  maxLength={30}
                />
                <button onClick={() => setShowWord(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showWord
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" /></svg>
                  }
                </button>
              </div>
              {inputWord.length > 0 && (
                <p className="font-rajdhani text-xs text-white/30">
                  {inputWord.length} caracteres · {[...new Set(inputWord.replace(/ /g, '').split('').filter(c => /[A-Z]/.test(c)))].length} letras únicas
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="block font-rajdhani text-xs text-white/40 tracking-widest uppercase">Categoria</span>
              <input type="text" value={config.category} onChange={e => setConfig({ category: e.target.value })}
                placeholder="Ex: Games, Filmes, Esportes..."
                className="input-neon w-full px-3 py-2.5 rounded-lg font-rajdhani text-sm" maxLength={30} />
            </div>
          </div>

          {/* Settings */}
          <div className="glass rounded-2xl p-5 space-y-4" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="block font-rajdhani text-xs text-white/30 tracking-widest uppercase">Configurações</span>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-rajdhani text-sm font-bold text-white/70">Tempo por rodada</p>
                <p className="font-rajdhani text-xs text-white/30">Segundos para o chat votar</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setConfig({ timePerRound: Math.max(5, config.timePerRound - 5) })}
                  className="w-7 h-7 rounded-lg font-bold text-sm transition-all"
                  style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>−</button>
                <span className="font-mono text-neon-cyan font-bold w-8 text-center">{config.timePerRound}s</span>
                <button onClick={() => setConfig({ timePerRound: Math.min(30, config.timePerRound + 5) })}
                  className="w-7 h-7 rounded-lg font-bold text-sm transition-all"
                  style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>+</button>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-rajdhani text-sm font-bold text-white/70">Vidas</p>
                <p className="font-rajdhani text-xs text-white/30">Erros permitidos antes do game over</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setConfig({ lives: Math.max(1, config.lives - 1) })}
                  className="w-7 h-7 rounded-lg font-bold text-sm"
                  style={{ background: 'rgba(255,68,68,0.1)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.2)' }}>−</button>
                <span className="font-mono text-red-400 font-bold w-4 text-center">{config.lives}</span>
                <button onClick={() => setConfig({ lives: Math.min(10, config.lives + 1) })}
                  className="w-7 h-7 rounded-lg font-bold text-sm"
                  style={{ background: 'rgba(255,68,68,0.1)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.2)' }}>+</button>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-rajdhani text-sm font-bold text-white/70">Modo Hardcore</p>
                <p className="font-rajdhani text-xs text-white/30">Cada usuário vota só 1× por rodada</p>
              </div>
              <Toggle value={config.hardcore} onChange={v => setConfig({ hardcore: v })} color="#FF4444" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-rajdhani text-sm font-bold text-white/70">Modo Turbo ⚡</p>
                <p className="font-rajdhani text-xs text-white/30">Força 5 segundos por rodada</p>
              </div>
              <Toggle value={config.turbo} onChange={v => setConfig({ turbo: v })} color="#FF9900" />
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-1.5">
              <p className="font-rajdhani text-sm font-bold text-white/70">Dica <span className="font-normal text-white/30">(opcional)</span></p>
              <input type="text" value={config.hint} onChange={e => setConfig({ hint: e.target.value })}
                placeholder="Ex: É um jogo de FPS competitivo..."
                className="input-neon w-full px-3 py-2.5 rounded-lg font-rajdhani text-sm" maxLength={80} />
            </div>

            <div className="h-px bg-white/5" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-rajdhani text-sm font-bold text-white/70">Liberar números / símbolos</p>
                <p className="font-rajdhani text-xs text-white/30">Números na palavra precisarão ser adivinhados</p>
              </div>
              <Toggle value={config.allowNumbersSymbols} onChange={v => setConfig({ allowNumbersSymbols: v })} />
            </div>
          </div>

          <motion.button
            onClick={() => startGame(inputWord)}
            disabled={inputWord.trim().length < 2}
            whileHover={inputWord.trim().length >= 2 ? { scale: 1.02 } : {}}
            whileTap={inputWord.trim().length >= 2 ? { scale: 0.98 } : {}}
            className="w-full py-4 rounded-2xl font-orbitron font-bold tracking-widest text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: inputWord.trim().length >= 2 ? 'linear-gradient(135deg, rgba(57,255,20,0.18), rgba(0,255,163,0.18))' : 'rgba(255,255,255,0.03)',
              border: inputWord.trim().length >= 2 ? '1px solid rgba(57,255,20,0.5)' : '1px solid rgba(255,255,255,0.06)',
              color: inputWord.trim().length >= 2 ? '#39FF14' : 'rgba(255,255,255,0.2)',
              boxShadow: inputWord.trim().length >= 2 ? '0 0 30px rgba(57,255,20,0.15)' : 'none',
            }}>
            INICIAR JOGO
          </motion.button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
     GAME SCREEN
  ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── 3-column main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: Scaffold + Mascote + Stats ── */}
        <div className="flex-shrink-0 flex flex-col border-r border-white/5" style={{ width: 210 }}>

          {/* Scaffold area */}
          <div className="flex-1 flex items-center justify-center p-3 relative" style={{ minHeight: 220 }}>
            <ScaffoldSVG wrongCount={wrongLetters.length} maxLives={config.lives} isOver={phase === 'lost'} />
            {/* Mascote placeholder — será substituído pelas imagens das partes do corpo */}
            {/* TODO: body part images */}
          </div>

          {/* ETAPAS */}
          <div className="px-3 pb-2">
            <p className="font-orbitron text-white/25 tracking-widest mb-1.5" style={{ fontSize: 8 }}>ETAPAS</p>
            <EtapasBar wrongCount={wrongLetters.length} maxLives={config.lives} />
          </div>

          {/* ERROS */}
          <div className="px-3 pb-2 flex items-center gap-2">
            <span className="font-orbitron text-white/30 tracking-widest" style={{ fontSize: 9 }}>ERROS</span>
            <span className="font-orbitron font-black"
              style={{ fontSize: 14, color: wrongLetters.length > 0 ? '#FF3333' : 'rgba(255,255,255,0.35)', textShadow: wrongLetters.length > 0 ? '0 0 12px rgba(255,51,51,0.4)' : 'none' }}>
              {wrongLetters.length} / {config.lives}
            </span>
          </div>

          {/* DICA */}
          {config.hint && (
            <div className="px-3 pb-2">
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,209,102,0.05)', border: '1px solid rgba(255,209,102,0.13)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,209,102,0.7)">
                    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
                  </svg>
                  <span className="font-orbitron font-bold" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,209,102,0.7)' }}>DICA</span>
                </div>
                <p className="font-rajdhani text-white/45" style={{ fontSize: 11, lineHeight: 1.4 }}>{config.hint}</p>
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="px-3 pb-3 flex flex-col gap-2">
            {chatConnected && (
              <div className="flex items-center gap-1.5">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-neon-green"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(0,255,163,0.55)' }}>chat conectado</span>
              </div>
            )}
            {addedToRaffleCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,102,51,0.08)', border: '1px solid rgba(255,102,51,0.22)' }}>
                <span style={{ fontSize: 12 }}>🎲</span>
                <span className="font-rajdhani font-bold" style={{ fontSize: 10, color: '#FF6633' }}>+{addedToRaffleCount} no sorteio</span>
              </div>
            )}
            <button onClick={resetGame}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:text-red-400 hover:bg-red-500/10"
              style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
              SAIR DO JOGO
            </button>
          </div>
        </div>

        {/* ── CENTER: main game ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Top bar: CATEGORIA + TIMER */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              </svg>
              <div>
                <p className="font-orbitron text-white/20 tracking-widest" style={{ fontSize: 7 }}>CATEGORIA</p>
                <p className="font-orbitron font-bold text-white tracking-wide" style={{ fontSize: 12 }}>{config.category || 'GERAL'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {config.turbo && <span className="font-orbitron px-2 py-0.5 rounded" style={{ fontSize: 8, color: '#FF9900', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)' }}>TURBO ⚡</span>}
              {config.hardcore && <span className="font-orbitron px-2 py-0.5 rounded" style={{ fontSize: 8, color: '#FF4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)' }}>HARDCORE</span>}

              {phase === 'countdown' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.22)' }}>
                  <div className="flex flex-col items-end">
                    <p className="font-orbitron text-white/20 tracking-widest" style={{ fontSize: 7 }}>PRÓXIMA RODADA EM</p>
                    <div className="flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFD166">
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                      </svg>
                      <AnimatePresence mode="popLayout">
                        <motion.span key={timer}
                          initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="font-orbitron font-black"
                          style={{ fontSize: 22, color: timer <= 3 ? '#FF4444' : '#FFD166', letterSpacing: '0.05em', lineHeight: 1 }}>
                          {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Word display */}
          <div className="px-5 py-4 flex flex-col items-center flex-shrink-0">
            <div className="flex flex-wrap justify-center" style={{ gap: '8px 14px' }}>
              {displayChars.map((dc, i) =>
                dc.char === ' ' ? (
                  <div key={i} style={{ width: wordFontSize * 0.5 }} />
                ) : (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <motion.span className="font-orbitron font-black"
                      style={{
                        fontSize: wordFontSize,
                        lineHeight: 1,
                        color: dc.isBlank ? 'rgba(255,255,255,0.15)'
                          : dc.justRevealed ? '#39FF14'
                          : phase === 'lost' ? '#FF5522'
                          : '#39FF14',
                        textShadow: dc.isBlank ? 'none'
                          : dc.justRevealed ? '0 0 28px #39FF14'
                          : phase === 'lost' ? '0 0 20px rgba(255,85,34,0.5)'
                          : '0 0 16px rgba(57,255,20,0.45)',
                        minWidth: wordFontSize * 0.58,
                        textAlign: 'center',
                      }}
                      animate={dc.justRevealed ? { scale: [0.4, 1.35, 1] } : {}}
                      transition={{ duration: 0.45 }}>
                      {dc.shown}
                    </motion.span>
                    {charNeedsGuess(dc.char, config.allowNumbersSymbols) && (
                      <div className="rounded-full" style={{
                        height: 2,
                        width: wordFontSize * 0.58,
                        background: dc.isBlank ? 'rgba(255,255,255,0.1)'
                          : phase === 'lost' ? 'rgba(255,85,34,0.4)'
                          : 'rgba(57,255,20,0.4)',
                      }} />
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* COMO FUNCIONA */}
          <div className="px-5 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="font-orbitron text-white/20 tracking-widest text-center mb-3" style={{ fontSize: 8 }}>COMO FUNCIONA</p>
              <div className="flex justify-around gap-2">
                {[
                  {
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,229,255,0.55)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>,
                    n: '1.', label: 'O CHAT ENVIA', sub: 'LETRAS',
                  },
                  {
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,229,255,0.55)"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" /></svg>,
                    n: '2.', label: 'A LETRA MAIS', sub: 'VOTADA É ESCOLHIDA',
                  },
                  {
                    icon: phase === 'reveal'
                      ? lastWasCorrect
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(57,255,20,0.8)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,51,51,0.8)"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>,
                    n: '3.',
                    label: phase === 'reveal' && lastWasCorrect ? 'ACERTOU!' : 'ACERTOU?',
                    sub: phase === 'reveal' && !lastWasCorrect ? 'ERROU! MAIS UMA\nPARTE DO CORPO' : 'LETRA REVELADA!\nERROU? MAIS UMA PARTE',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    {item.icon}
                    <p className="font-orbitron text-white/40 text-center" style={{ fontSize: 8 }}>{item.n} {item.label}</p>
                    <p className="font-rajdhani text-white/20 text-center" style={{ fontSize: 10, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action area */}
          <div className="flex-1 px-5 pb-3 min-h-0 flex">
            <AnimatePresence mode="wait">

              {/* COUNTDOWN: LETRA MAIS VOTADA + DISTRIBUIÇÃO */}
              {phase === 'countdown' && (
                <motion.div key="countdown"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex gap-3 w-full">

                  <div className="w-36 flex-shrink-0 rounded-2xl flex flex-col items-center justify-center p-4"
                    style={{ background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.12)' }}>
                    <p className="font-orbitron text-white/25 tracking-widest text-center mb-2" style={{ fontSize: 7 }}>LETRA MAIS VOTADA</p>
                    <AnimatePresence mode="wait">
                      {sortedVotes[0] ? (
                        <motion.div key={sortedVotes[0][0]}
                          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center">
                          <span className="font-orbitron font-black leading-none"
                            style={{ fontSize: 68, color: '#39FF14', textShadow: '0 0 40px rgba(57,255,20,0.5)' }}>
                            {sortedVotes[0][0]}
                          </span>
                          <span className="font-orbitron font-bold" style={{ fontSize: 18, color: '#39FF14' }}>
                            {Math.round(sortedVotes[0][1] / Math.max(totalVotes, 1) * 100)}%
                          </span>
                          <span className="font-rajdhani text-white/30" style={{ fontSize: 10 }}>
                            {totalVotes} VOTOS
                          </span>
                        </motion.div>
                      ) : (
                        <motion.p key="w" className="font-rajdhani text-center text-white/15" style={{ fontSize: 11 }}>
                          Aguardando votos...
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1 rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="font-orbitron text-white/20 tracking-widest mb-3" style={{ fontSize: 7 }}>DISTRIBUIÇÃO DE VOTOS</p>
                    <div className="space-y-2">
                      {sortedVotes.length === 0 ? (
                        <p className="font-rajdhani text-center text-white/15" style={{ fontSize: 11 }}>Aguardando votos do chat…</p>
                      ) : (
                        sortedVotes.map(([letter, count], i) => (
                          <div key={letter} className="flex items-center gap-2">
                            <span className="font-orbitron font-bold w-4 text-right flex-shrink-0" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                            <span className="font-orbitron font-black w-5 flex-shrink-0"
                              style={{ fontSize: 14, color: i === 0 ? '#39FF14' : 'rgba(0,229,255,0.7)' }}>
                              {letter}
                            </span>
                            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 14, background: 'rgba(255,255,255,0.05)' }}>
                              <motion.div className="h-full rounded-full"
                                style={{ background: i === 0 ? 'linear-gradient(90deg,#39FF14,#00CC50)' : 'linear-gradient(90deg,rgba(0,229,255,0.5),rgba(0,100,255,0.4))' }}
                                animate={{ width: `${(count / maxVotes) * 100}%` }}
                                transition={{ duration: 0.2 }} />
                            </div>
                            <span className="font-orbitron font-bold text-right flex-shrink-0" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', minWidth: 54 }}>
                              {Math.round(count / Math.max(totalVotes, 1) * 100)}% ({count})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* READY */}
              {phase === 'ready' && (
                <motion.div key="ready"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col items-center justify-center gap-4 w-full">
                  <p className="font-rajdhani text-white/30 tracking-widest text-center" style={{ fontSize: 12 }}>
                    Chat vota por {effectiveTime}s · {livesLeft} vida{livesLeft !== 1 ? 's' : ''} restante{livesLeft !== 1 ? 's' : ''}
                  </p>
                  <motion.button
                    onClick={() => setPhase('countdown')}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="px-10 py-4 rounded-2xl font-orbitron font-bold tracking-widest text-sm"
                    style={{ background: 'linear-gradient(135deg, rgba(57,255,20,0.15), rgba(0,255,163,0.12))', border: '1px solid rgba(57,255,20,0.5)', color: '#39FF14', boxShadow: '0 0 28px rgba(57,255,20,0.12)' }}>
                    INICIAR RODADA
                  </motion.button>
                </motion.div>
              )}

              {/* REVEAL */}
              {phase === 'reveal' && (
                <motion.div key="reveal"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-3 w-full">
                  <motion.span
                    initial={{ scale: 0.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="font-orbitron font-black leading-none"
                    style={{ fontSize: 88, color: lastWasCorrect ? '#39FF14' : '#FF3333', textShadow: `0 0 60px ${lastWasCorrect ? '#39FF14' : '#FF3333'}` }}>
                    {lastChosenLetter}
                  </motion.span>
                  <motion.p initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}
                    className="font-orbitron font-bold tracking-widest"
                    style={{ fontSize: 18, color: lastWasCorrect ? '#39FF14' : '#FF3333' }}>
                    {lastWasCorrect ? '✓ ACERTOU!' : '✗ ERROU!'}
                  </motion.p>
                </motion.div>
              )}

              {/* WON */}
              {phase === 'won' && (
                <motion.div key="won"
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-4 w-full">
                  <motion.p className="font-orbitron font-black tracking-widest"
                    style={{ fontSize: 30, color: '#FFD166', textShadow: '0 0 40px #FFD166' }}
                    animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    O CHAT GANHOU! 🎉
                  </motion.p>
                  <div className="flex flex-wrap justify-center" style={{ gap: '6px 10px' }}>
                    {word.split('').map((c, i) =>
                      c === ' ' ? <div key={i} style={{ width: 16 }} /> : (
                        <motion.span key={i}
                          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.045 }}
                          className="font-orbitron font-black"
                          style={{ fontSize: 26, color: '#FFD166', textShadow: '0 0 18px rgba(255,209,102,0.55)' }}>
                          {c}
                        </motion.span>
                      )
                    )}
                  </div>
                  <button onClick={resetGame}
                    className="px-8 py-2.5 rounded-xl font-orbitron font-bold tracking-widest text-sm transition-all hover:scale-105"
                    style={{ background: 'rgba(255,209,102,0.12)', border: '1px solid rgba(255,209,102,0.4)', color: '#FFD166' }}>
                    JOGAR NOVAMENTE
                  </button>
                </motion.div>
              )}

              {/* LOST */}
              {phase === 'lost' && (
                <motion.div key="lost"
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-4 w-full">
                  <p className="font-orbitron font-black tracking-widest"
                    style={{ fontSize: 30, color: '#FF3333', textShadow: '0 0 40px #FF3333' }}>
                    GAME OVER
                  </p>
                  <p className="font-rajdhani text-sm tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>A palavra era:</p>
                  <div className="flex flex-wrap justify-center" style={{ gap: '6px 10px' }}>
                    {word.split('').map((c, i) =>
                      c === ' ' ? <div key={i} style={{ width: 16 }} /> : (
                        <motion.span key={i}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.055 }}
                          className="font-orbitron font-black"
                          style={{ fontSize: 26, color: '#FF5522', textShadow: '0 0 16px rgba(255,85,34,0.5)' }}>
                          {c}
                        </motion.span>
                      )
                    )}
                  </div>
                  <button onClick={resetGame}
                    className="px-8 py-2.5 rounded-xl font-orbitron font-bold tracking-widest text-sm transition-all hover:scale-105"
                    style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.35)', color: '#FF3333' }}>
                    JOGAR NOVAMENTE
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT: Chat + Ranking ── */}
        <div className="flex-shrink-0 flex flex-col border-l border-white/5" style={{ width: 248 }}>

          {/* Chat header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 flex-shrink-0">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-neon-green"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="font-orbitron font-bold text-white tracking-widest" style={{ fontSize: 10 }}>CHAT DA LIVE</span>
          </div>

          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
            {chatMessages.length === 0 ? (
              <p className="font-rajdhani text-center text-white/15 pt-6" style={{ fontSize: 11 }}>
                Aguardando mensagens...
              </p>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} className="flex items-center gap-1.5 py-px">
                  <span className="font-rajdhani font-bold truncate" style={{ color: 'rgba(0,229,255,0.65)', fontSize: 11, maxWidth: 130, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
                    {msg.user}:
                  </span>
                  <span className="font-orbitron font-black flex-shrink-0" style={{ fontSize: 13, color: '#FFD166' }}>{msg.letter}</span>
                </div>
              ))
            )}
          </div>

          {/* Ranking */}
          <div className="border-t border-white/5 p-3 flex-shrink-0">
            <p className="font-orbitron font-bold text-white tracking-widest mb-2" style={{ fontSize: 9 }}>RANKING PARTICIPANTES</p>
            {topScores.length === 0 ? (
              <p className="font-rajdhani text-white/15 text-center" style={{ fontSize: 10 }}>Nenhum participante ainda</p>
            ) : (
              <div className="space-y-1.5">
                {topScores.map(([user, pts], i) => (
                  <div key={user} className="flex items-center gap-2">
                    <span className="font-orbitron font-black w-4 text-center flex-shrink-0"
                      style={{ fontSize: 10, color: i === 0 ? '#FFD166' : i === 1 ? 'rgba(200,200,200,0.8)' : i === 2 ? 'rgba(190,130,60,0.9)' : 'rgba(255,255,255,0.25)' }}>
                      {i + 1}
                    </span>
                    <span className="font-rajdhani text-white/55 flex-1 truncate" style={{ fontSize: 12 }}>{user}</span>
                    <span className="font-orbitron font-bold flex-shrink-0" style={{ fontSize: 9, color: '#39FF14' }}>{pts} pts</span>
                  </div>
                ))}
              </div>
            )}
            {topScores.length >= 5 && (
              <button className="w-full mt-2 py-1.5 rounded-lg font-orbitron font-bold tracking-widest transition-all hover:brightness-125"
                style={{ fontSize: 8, color: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)' }}>
                VER RANKING COMPLETO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Palavras tentadas + Participe ── */}
      <div className="flex-shrink-0 flex border-t border-white/5" style={{ minHeight: 88 }}>

        {/* Palavras já tentadas */}
        <div className="flex-1 px-5 py-3">
          <p className="font-orbitron text-white/20 tracking-widest mb-2" style={{ fontSize: 8 }}>PALAVRAS JÁ TENTADAS</p>
          <div className="flex flex-wrap gap-1.5">
            {allTried.length === 0 ? (
              <p className="font-rajdhani text-white/15" style={{ fontSize: 11 }}>Nenhuma letra tentada ainda</p>
            ) : (
              allTried.map(letter => (
                <motion.div key={letter}
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-orbitron font-black"
                  style={{
                    fontSize: 13,
                    background: wrongLetters.includes(letter) ? 'rgba(255,51,51,0.12)' : 'rgba(57,255,20,0.08)',
                    border: `1px solid ${wrongLetters.includes(letter) ? 'rgba(255,51,51,0.38)' : 'rgba(57,255,20,0.28)'}`,
                    color: wrongLetters.includes(letter) ? '#FF3333' : '#39FF14',
                  }}>
                  {letter}
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Participe e concorra */}
        <div className="flex-shrink-0 border-l border-white/5 px-4 py-3 flex flex-col justify-center" style={{ width: 248 }}>
          <div className="rounded-xl p-3" style={{ background: 'rgba(57,255,20,0.04)', border: '1px solid rgba(57,255,20,0.15)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ fontSize: 18 }}>🎁</span>
              <p className="font-orbitron font-bold tracking-widest" style={{ fontSize: 8, color: '#39FF14' }}>PARTICIPE E CONCORRA!</p>
            </div>
            <p className="font-rajdhani text-white/30" style={{ fontSize: 10, lineHeight: 1.4 }}>
              Todos que participaram do jogo da forca concorrem a prêmios no final da live!
            </p>
            {addedToRaffleCount > 0 && (
              <p className="font-orbitron font-bold mt-1.5" style={{ fontSize: 9, color: '#FFD166' }}>
                +{addedToRaffleCount} no sorteio
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
