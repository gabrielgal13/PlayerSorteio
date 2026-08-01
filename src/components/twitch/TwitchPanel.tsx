'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { getDeliveryMode } from '@/lib/prizeDelivery';

export default function TwitchPanel() {
  const {
    currentUser,
    twitchConfig, setTwitchConfig,
    setTwitchConnected,
    raffleStatus, currentWinner, setRaffleStatus,
    chatRegistrationActive, setChatRegistrationActive,
    chatRegistrationRequested, setChatRegistrationRequested,
    chatRegistrationStopRequested, setChatRegistrationStopRequested,
    chatRegistrationWanted,
    addParticipantFromChat,
    setWinnerChatMessage,
    addChatMessage,
    raffleStage,
    triggerMascotSoco,
    triggerMascotChute,
    saveConfigToDB,
    initMascotHp,
  } = useStore();

  const CHAT_COLORS = ['#FF6B6B', '#FF9F43', '#FFD166', '#00FFA3', '#00E5FF', '#A855F7', '#FF6EFB', '#1F8CFF'];
  const getChatColor = (name: string) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return CHAT_COLORS[h % CHAT_COLORS.length];
  };

  useEffect(() => { import('tmi.js'); }, []);

  const tmiClientRef = useRef<unknown>(null);
  const kickWsRef = useRef<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [kickConnected, setKickConnected] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [error, setError] = useState('');
  const [sessionRegistrations, setSessionRegistrations] = useState<{ name: string; source: 'twitch' | 'kick' | 'youtube' }[]>([]);
  const hasAutoConnectedRef = useRef(false);
  const connectFnRef = useRef<(() => Promise<void>) | null>(null);
  const stopFnRef = useRef<(() => Promise<void>) | null>(null);

  const youtubeIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const youtubeLiveChatIdRef = useRef<string | null>(null);
  const youtubePageTokenRef = useRef<string | null>(null);
  const youtubeSeenIdsRef = useRef<Set<string>>(new Set());
  const youtubeSessionRef = useRef(0);

  const chatRegActiveRef = useRef(chatRegistrationActive);
  const registrationCommandRef = useRef(twitchConfig.registrationCommand);
  const raffleStatusRef = useRef(raffleStatus);
  const currentWinnerRef = useRef(currentWinner);
  const claimCommandRef = useRef(twitchConfig.claimCommand);
  const raffleStageRef = useRef(raffleStage);

  const botCommandsRef = useRef<{ command: string; response: string }[]>([]);

  // Chat-game guess tracking
  const acceptingGuessesRef = useRef(false);
  const chatGameParticipantsRef = useRef(new Set<string>());
  const guessedSetRef = useRef(new Set<string>());

  useEffect(() => { chatRegActiveRef.current = chatRegistrationActive; }, [chatRegistrationActive]);
  useEffect(() => { registrationCommandRef.current = twitchConfig.registrationCommand; }, [twitchConfig.registrationCommand]);
  useEffect(() => { raffleStatusRef.current = raffleStatus; }, [raffleStatus]);
  useEffect(() => { currentWinnerRef.current = currentWinner; }, [currentWinner]);
  useEffect(() => { claimCommandRef.current = twitchConfig.claimCommand; }, [twitchConfig.claimCommand]);
  useEffect(() => { raffleStageRef.current = raffleStage; }, [raffleStage]);

  useEffect(() => {
    const username = currentUser?.username;
    if (!username) return;
    fetch(`/api/streamer/bot-commands?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then((cmds: { command: string; response: string }[]) => { botCommandsRef.current = cmds; })
      .catch(() => {});
  }, [currentUser?.username]);

  const channel = twitchConfig.channel || currentUser?.twitchChannel || '';
  const hasKick = Boolean(currentUser?.kickChannel || currentUser?.kickChatroomId);
  const hasYoutube = Boolean(currentUser?.youtubeChannel);

  // ── Message handler — source distinguishes Twitch vs Kick vs YouTube ────
  const makeMessageHandler = (source: 'twitch' | 'kick' | 'youtube') => (displayName: string, message: string) => {
    if (raffleStageRef.current !== 3) {
      addChatMessage({
        username: displayName,
        text: message.trim(),
        color: getChatColor(displayName),
        source,
        timestamp: Date.now(),
      });
    }

    const msgTrimmed = message.trim().toLowerCase();

    if (
      raffleStatusRef.current === 'validating' &&
      currentWinnerRef.current &&
      displayName.toLowerCase() === currentWinnerRef.current.name.toLowerCase()
    ) {
      setWinnerChatMessage(message.trim());
    }

    if (
      raffleStatusRef.current === 'chat-verifying' &&
      currentWinnerRef.current &&
      displayName.toLowerCase() === currentWinnerRef.current.name.toLowerCase()
    ) {
      setWinnerChatMessage(message.trim());
      setRaffleStatus('chat-verified');
    }

    const regCmd = registrationCommandRef.current?.trim().toLowerCase();
    if (chatRegActiveRef.current && regCmd && msgTrimmed === regCmd) {
      const added = addParticipantFromChat(displayName, source);
      if (added) {
        setSessionRegistrations(prev => [...prev, { name: displayName, source }]);
        fetch('/api/game-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: displayName, source }),
        }).catch(() => {});
      }
    }

    // Capture chat-game guess: only !word messages from registered participants when round is active
    const nameKey = displayName.toLowerCase();
    const knownCommands = new Set([regCmd, claimCommandRef.current?.trim().toLowerCase(), '!soco', '!chute'].filter(Boolean));
    if (
      acceptingGuessesRef.current &&
      chatGameParticipantsRef.current.has(nameKey) &&
      !guessedSetRef.current.has(nameKey) &&
      msgTrimmed.startsWith('!') &&
      !knownCommands.has(msgTrimmed)
    ) {
      guessedSetRef.current.add(nameKey);
      fetch('/api/game-session/guesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName, source, text: message.trim() }),
      }).catch(() => {});
    }

    if (msgTrimmed === '!soco' || msgTrimmed === '!chute') {
      const { raffleStage: stage, raffleStatus: status, socoChuteModeEnabled } = useStore.getState();
      if (stage === 2 && status === 'idle' && socoChuteModeEnabled) {
        if (msgTrimmed === '!soco') triggerMascotSoco();
        else triggerMascotChute();
      }
    }

    const matchedCmd = botCommandsRef.current.find(c => c.command.trim().toLowerCase() === msgTrimmed);
    if (matchedCmd) {
      if (source === 'twitch') {
        const twitchChannel = useStore.getState().twitchConfig.channel || useStore.getState().currentUser?.twitchChannel;
        if (twitchChannel) {
          fetch('/api/twitch/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: twitchChannel, message: matchedCmd.response }),
          }).catch(() => {});
        }
      } else if (source === 'kick') {
        const kickChannel = useStore.getState().currentUser?.kickChannel;
        if (kickChannel) {
          fetch('/api/kick/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kickChannel, message: matchedCmd.response }),
          }).catch(() => {});
        }
      }
    }

    // YouTube / Kick: captura trade link (ou endereço, pra prêmios "Camisa") quando ganhador menciona o bot
    if (source === 'youtube' || source === 'kick') {
      const botName = (process.env.NEXT_PUBLIC_TWITCH_BOT_USERNAME ?? 'PlayerSkinsBOT').toLowerCase();
      const mentionsBot = message.toLowerCase().includes(`@${botName}`);
      const isCurrentWinner =
        currentWinnerRef.current &&
        displayName.toLowerCase() === currentWinnerRef.current.name.toLowerCase();

      const sendChatError = (errorMsg: string) => {
        const fullMsg = `@${displayName} ${errorMsg}`;
        const { currentUser: u } = useStore.getState();
        if (source === 'kick' && u?.kickChannel) {
          fetch('/api/kick/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kickChannel: u.kickChannel,
              message: fullMsg,
              ...(u.kickChatroomId ? { chatroomId: String(u.kickChatroomId) } : {}),
            }),
          }).catch(() => {});
        } else if (source === 'youtube' && u?.youtubeChannel) {
          fetch('/api/youtube/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeHandle: u.youtubeChannel, message: fullMsg }),
          }).catch(() => {});
        }
      };

      if (mentionsBot && isCurrentWinner) {
        const prizeName = useStore.getState().currentPrize?.name ?? '';
        const mode = getDeliveryMode(prizeName);

        if (mode !== 'trade_link') {
          // Prêmio físico (Camisa) — texto livre com endereço (e camisa escolhida).
          // O servidor valida os campos (Rua/Numero/Bairro/Estado/CEP[/Camiseta])
          // e devolve o que falta ou a confirmação, já prontos pra mandar no chat.
          const cleaned = message.replace(new RegExp(`@${botName}`, 'ig'), '').trim();
          fetch('/api/chat-trade-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ winnerName: displayName, text: cleaned, source }),
          })
            .then(res => res.json())
            .then((data: { ok?: boolean; message?: string }) => {
              if (data?.message) sendChatError(data.message);
            })
            .catch(() => {});
        } else {
          const steamMatch = message.match(/https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/);
          if (steamMatch) {
            fetch('/api/chat-trade-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ winnerName: displayName, text: steamMatch[0], source }),
            }).catch(() => {});
          } else {
            sendChatError('link inválido! Envie no formato: https://steamcommunity.com/tradeoffer/new/?partner=XXXXXXXX&token=XXXXXXXX');
          }
        }
      }
    }
  };

  // ── YouTube polling ──────────────────────────────────────────────────────
  const startYoutubePoll = (handle: string) => {
    const handleYoutube = makeMessageHandler('youtube');
    youtubeSeenIdsRef.current = new Set();
    youtubeLiveChatIdRef.current = null;
    youtubePageTokenRef.current = null;
    let retryDelay = 10000;
    const sessionId = ++youtubeSessionRef.current;

    const poll = async () => {
      if (youtubeSessionRef.current !== sessionId) return;
      try {
        const params = new URLSearchParams();
        if (youtubeLiveChatIdRef.current) {
          params.set('liveChatId', youtubeLiveChatIdRef.current);
          if (youtubePageTokenRef.current) params.set('pageToken', youtubePageTokenRef.current);
        } else {
          params.set('handle', handle);
        }

        const res = await fetch(`/api/youtube-live-chat?${params}`);
        if (youtubeSessionRef.current !== sessionId) return;

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          console.warn('YouTube chat error:', err.error);
          setYoutubeConnected(false);
          youtubeLiveChatIdRef.current = null;
          youtubePageTokenRef.current = null;
          retryDelay = Math.min(retryDelay * 1.5, 60000);
          youtubeIntervalRef.current = setTimeout(poll, retryDelay);
          return;
        }

        retryDelay = 10000;

        const data = await res.json() as {
          liveChatId: string;
          messages: { id: string; authorDetails: { displayName: string }; snippet: { displayMessage: string } }[];
          nextPageToken: string | null;
          pollingIntervalMillis: number;
        };

        if (youtubeSessionRef.current !== sessionId) return;

        if (!youtubeLiveChatIdRef.current) {
          youtubeLiveChatIdRef.current = data.liveChatId;
          setYoutubeConnected(true);
          youtubePageTokenRef.current = data.nextPageToken;
          youtubeSeenIdsRef.current = new Set(data.messages.map(m => m.id));
          // Show last 5 recent messages immediately on connect
          for (const msg of data.messages.slice(-5)) {
            const name = msg.authorDetails?.displayName ?? 'anon';
            const text = msg.snippet?.displayMessage ?? '';
            if (text) handleYoutube(name, text);
          }
        } else {
          for (const msg of data.messages) {
            if (youtubeSeenIdsRef.current.has(msg.id)) continue;
            youtubeSeenIdsRef.current.add(msg.id);
            const name = msg.authorDetails?.displayName ?? 'anon';
            const text = msg.snippet?.displayMessage ?? '';
            if (text) handleYoutube(name, text);
          }
          youtubePageTokenRef.current = data.nextPageToken;
        }

        const delay = Math.max(data.pollingIntervalMillis ?? 5000, 3000);
        youtubeIntervalRef.current = setTimeout(poll, delay);
      } catch (e) {
        if (youtubeSessionRef.current !== sessionId) return;
        console.warn('YouTube poll failed:', e);
        setYoutubeConnected(false);
        retryDelay = Math.min(retryDelay * 1.5, 60000);
        youtubeIntervalRef.current = setTimeout(poll, retryDelay);
      }
    };

    poll();
  };

  const stopYoutubePoll = () => {
    youtubeSessionRef.current++;
    if (youtubeIntervalRef.current) {
      clearTimeout(youtubeIntervalRef.current);
      youtubeIntervalRef.current = null;
    }
    youtubeLiveChatIdRef.current = null;
    youtubePageTokenRef.current = null;
    youtubeSeenIdsRef.current = new Set();
    setYoutubeConnected(false);
  };

  const connectAndStart = async () => {
    setIsConnecting(true);
    setError('');
    setSessionRegistrations([]);

    const handleTwitch = makeMessageHandler('twitch');
    const handleKick   = makeMessageHandler('kick');

    // ── Twitch ──────────────────────────────────────────────────────────────
    if (channel) {
      // Desconecta cliente anterior antes de criar um novo
      if (tmiClientRef.current && typeof (tmiClientRef.current as { disconnect?: () => void }).disconnect === 'function') {
        try { await (tmiClientRef.current as { disconnect: () => Promise<void> }).disconnect(); } catch { /* ignore */ }
        tmiClientRef.current = null;
      }
      try {
        const tmi = await import('tmi.js');
        const client = new tmi.Client({
          channels: [channel],
          connection: { reconnect: true, secure: true },
        });

        client.on('message', (_ch: string, tags: Record<string, string>, message: string) => {
          const displayName = tags['display-name'] || tags.username || 'anon';
          handleTwitch(displayName, message);
        });

        await client.connect();
        tmiClientRef.current = client;
        setTwitchConnected(true);

        // Fetch viewer count to set mascot HP
        try {
          const vRes = await fetch(`/api/twitch/viewers?channel=${encodeURIComponent(channel)}`);
          if (vRes.ok) {
            const vData = await vRes.json();
            initMascotHp(vData.viewerCount ?? 0);
          } else {
            initMascotHp(0);
          }
        } catch {
          initMascotHp(0);
        }
      } catch (e) {
        console.warn('Falha ao conectar Twitch:', e);
        setError(`Falha ao conectar Twitch: ${e}`);
      }
    }

    chatRegActiveRef.current = true;
    registrationCommandRef.current = twitchConfig.registrationCommand;
    setChatRegistrationActive(true);
    setIsConnecting(false);

    // ── Kick ─────────────────────────────────────────────────────────────────
    if (currentUser?.kickChannel || currentUser?.kickChatroomId) {
      try {
        let chatroomId: number;
        if (currentUser.kickChatroomId) {
          chatroomId = currentUser.kickChatroomId;
        } else {
          const res = await fetch(`/api/kick-channel/${currentUser.kickChannel}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          ({ chatroomId } = await res.json() as { chatroomId: number });
        }

        const ws = new WebSocket(
          `wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false`,
        );

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify({
            event: 'pusher:subscribe',
            data: { auth: '', channel: `chatrooms.${chatroomId}.v2` },
          }));
        });

        ws.addEventListener('message', (event) => {
          try {
            const msg = JSON.parse(event.data as string) as {
              event: string;
              data: string | Record<string, unknown>;
            };

            if (msg.event === 'pusher:ping') {
              ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
              return;
            }
            if (msg.event === 'pusher_internal:subscription_succeeded') {
              setKickConnected(true);
              return;
            }
            if (msg.event === 'App\\Events\\ChatMessageEvent') {
              const payload = (typeof msg.data === 'string'
                ? JSON.parse(msg.data)
                : msg.data) as { sender?: { username?: string }; content?: string };
              const username = payload?.sender?.username ?? '';
              const text = payload?.content ?? '';
              if (username && text) handleKick(username, text);
            }
          } catch { /* ignore parse errors */ }
        });

        ws.addEventListener('close', () => setKickConnected(false));
        kickWsRef.current = ws;
      } catch (e) {
        console.warn('Kick connection failed:', e);
      }
    }

    // ── YouTube ───────────────────────────────────────────────────────────────
    if (currentUser?.youtubeChannel) {
      startYoutubePoll(currentUser.youtubeChannel);
    }
  };

  connectFnRef.current = connectAndStart;

  // Auto-connect quando entra no sorteio (stage 2)
  useEffect(() => {
    const hasAnyPlatform = Boolean(channel || currentUser?.kickChannel || currentUser?.kickChatroomId || currentUser?.youtubeChannel);
    if (raffleStage === 2 && hasAnyPlatform && !chatRegistrationActive && !isConnecting && !hasAutoConnectedRef.current) {
      hasAutoConnectedRef.current = true;
      connectFnRef.current?.();
    }
    if (raffleStage === 1) {
      hasAutoConnectedRef.current = false;
      stopFnRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleStage]);

  // Reconecta se o canal mudar enquanto o chat já está ativo
  const channelMountedRef = useRef(false);
  useEffect(() => {
    if (!channelMountedRef.current) { channelMountedRef.current = true; return; }
    if (raffleStageRef.current === 2 && chatRegistrationActive && !isConnecting) {
      stopFnRef.current?.().then(() => {
        hasAutoConnectedRef.current = true;
        connectFnRef.current?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Conecta quando solicitado externamente
  useEffect(() => {
    if (chatRegistrationRequested && !chatRegistrationActive && !isConnecting) {
      setChatRegistrationRequested(false);
      connectFnRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRegistrationRequested]);

  // Desconecta quando solicitado externamente
  useEffect(() => {
    if (chatRegistrationStopRequested) {
      setChatRegistrationStopRequested(false);
      stopFnRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRegistrationStopRequested]);

  // Reabre a coleta pelo chat depois de um F5. O socket morre no refresh, então
  // não dá pra restaurar `chatRegistrationActive` direto — o que fica salvo é a
  // intenção, e aqui ela vira uma conexão de verdade pelo caminho normal.
  // Declarado DEPOIS do efeito de raffleStage de propósito: no mount aquele
  // chama stopAndDisconnect (stage 1), e este precisa rodar em seguida.
  useEffect(() => {
    if (chatRegistrationWanted && !chatRegistrationActive && !isConnecting) {
      setChatRegistrationRequested(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (kickWsRef.current) {
        kickWsRef.current.close();
        kickWsRef.current = null;
      }
      stopYoutubePoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to game-session stream to track round state for chat-game guesses
  useEffect(() => {
    const es = new EventSource('/api/game-session/stream');

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          type: string;
          participants?: { name: string }[];
          participant?: { name: string };
          acceptingGuesses?: boolean;
        };
        if (data.type === 'init') {
          chatGameParticipantsRef.current = new Set(
            (data.participants ?? []).map(p => p.name.toLowerCase()),
          );
          acceptingGuessesRef.current = data.acceptingGuesses ?? false;
          guessedSetRef.current.clear();
        } else if (data.type === 'participant_add' && data.participant) {
          chatGameParticipantsRef.current.add(data.participant.name.toLowerCase());
        } else if (data.type === 'round_start') {
          acceptingGuessesRef.current = true;
          guessedSetRef.current.clear();
        } else if (data.type === 'round_end') {
          acceptingGuessesRef.current = false;
        }
      } catch { /* ignore parse errors */ }
    };

    return () => es.close();
  }, []);

  const stopAndDisconnect = async () => {
    chatRegActiveRef.current = false;
    setChatRegistrationActive(false);
    if (tmiClientRef.current && typeof (tmiClientRef.current as { disconnect?: () => void }).disconnect === 'function') {
      try { await (tmiClientRef.current as { disconnect: () => Promise<void> }).disconnect(); } catch { /* ignore */ }
      tmiClientRef.current = null;
    }
    setTwitchConnected(false);
    if (kickWsRef.current) {
      kickWsRef.current.close();
      kickWsRef.current = null;
    }
    setKickConnected(false);
    stopYoutubePoll();
  };

  stopFnRef.current = stopAndDisconnect;

  const activePlatformCount = [true, hasKick, hasYoutube].filter(Boolean).length;
  const startLabel = chatRegistrationActive
    ? 'ENCERRAR INSCRIÇÕES'
    : activePlatformCount > 1
      ? `INICIAR INSCRIÇÕES (TWITCH${hasKick ? ' + KICK' : ''}${hasYoutube ? ' + YOUTUBE' : ''})`
      : 'INICIAR INSCRIÇÕES';

  return (
    <div className="space-y-4">

      {/* ── INSCRIÇÕES VIA CHAT ── */}
      <div className="rounded-xl overflow-hidden"
        style={{
          border: chatRegistrationActive
            ? '1px solid rgba(0,229,255,0.4)'
            : '1px solid rgba(255,255,255,0.08)',
        }}>

        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2"
          style={{
            background: chatRegistrationActive ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={chatRegistrationActive ? '#00E5FF' : 'rgba(255,255,255,0.3)'}>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span className="font-orbitron text-xs tracking-widest"
            style={{ color: chatRegistrationActive ? '#00E5FF' : 'rgba(255,255,255,0.3)' }}>
            INSCRIÇÕES VIA CHAT
          </span>
          {chatRegistrationActive && (
            <>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-neon-purple ml-1"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
              <div className="flex-1" />
              <span className="font-orbitron font-bold text-neon-purple">{sessionRegistrations.length}</span>
              <span className="font-rajdhani text-xs text-white/40 tracking-widest ml-1">inscritos</span>
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Command input */}
          <div className="space-y-1">
            <label className="block font-rajdhani text-xs text-white/40 tracking-widest uppercase">
              Comando de inscrição
            </label>
            <input
              type="text"
              value={twitchConfig.registrationCommand}
              onChange={e => setTwitchConfig({ registrationCommand: e.target.value })}
              onBlur={() => saveConfigToDB()}
              placeholder="!entrar"
              disabled={chatRegistrationActive}
              className="input-neon w-full px-3 py-2.5 rounded-lg font-mono text-sm disabled:opacity-50"
            />
            {!chatRegistrationActive && (
              <p className="font-rajdhani text-xs text-white/25">
                Qualquer pessoa que digitar este comando no chat será adicionada como participante
              </p>
            )}
          </div>

          {/* Channel info — idle state */}
          {!chatRegistrationActive && (
            <div className="space-y-2">
              {/* Twitch */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(145,71,255,0.6)">
                  <path d="M4.3 3H21v13.7l-4.3 4.3H3V7.3L4.3 3zM5 5.7V19h11l3-3V5H5zm6 3h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                <span className="font-rajdhani text-xs text-white/30 tracking-widest">Twitch:</span>
                <span className="font-mono text-xs text-neon-purple/70">#{channel}</span>
              </div>
              {/* Kick */}
              {hasKick && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(83,252,28,0.03)', border: '1px solid rgba(83,252,28,0.15)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(83,252,28,0.5)">
                    <path d="M3 3h18v18H3V3zm4 4v10h2V3.5l4 4.5-4 4.5V14h2l6-6-6-6H7z"/>
                  </svg>
                  <span className="font-rajdhani text-xs tracking-widest" style={{ color: 'rgba(83,252,28,0.45)' }}>Kick:</span>
                  <span className="font-mono text-xs" style={{ color: 'rgba(83,252,28,0.65)' }}>#{currentUser?.kickChannel}</span>
                </div>
              )}
              {/* YouTube */}
              {hasYoutube && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255,0,0,0.03)', border: '1px solid rgba(255,0,0,0.2)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,0,0,0.6)">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span className="font-rajdhani text-xs tracking-widest" style={{ color: 'rgba(255,80,80,0.55)' }}>YouTube:</span>
                  <span className="font-mono text-xs" style={{ color: 'rgba(255,80,80,0.75)' }}>
                    {currentUser?.youtubeDisplayName
                      ? `${currentUser.youtubeDisplayName} (${currentUser.youtubeChannel})`
                      : currentUser?.youtubeChannel}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Active status: show all platforms */}
          {chatRegistrationActive && (
            <div className="flex flex-wrap gap-2">
              {/* Twitch badge */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(145,71,255,0.08)', border: '1px solid rgba(145,71,255,0.2)' }}>
                <motion.div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#9147FF' }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
                <span className="font-orbitron text-xs" style={{ color: '#9147FF', fontSize: '10px' }}>TWITCH</span>
                <span className="font-mono text-xs text-white/30">#{channel}</span>
              </div>
              {/* Kick badge */}
              {hasKick && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{
                    background: kickConnected ? 'rgba(83,252,28,0.08)' : 'rgba(255,255,255,0.03)',
                    border: kickConnected ? '1px solid rgba(83,252,28,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: kickConnected ? '#53FC1C' : '#555' }}
                    animate={kickConnected ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 0.7, repeat: Infinity }} />
                  <span className="font-orbitron text-xs"
                    style={{ color: kickConnected ? '#53FC1C' : '#555', fontSize: '10px' }}>KICK</span>
                  <span className="font-mono text-xs" style={{ color: kickConnected ? 'rgba(255,255,255,0.3)' : '#444' }}>
                    #{currentUser?.kickChannel}
                  </span>
                  {!kickConnected && (
                    <motion.span
                      className="font-orbitron"
                      style={{ fontSize: '9px', color: '#888' }}
                      animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}>
                      conectando…
                    </motion.span>
                  )}
                </div>
              )}
              {/* YouTube badge */}
              {hasYoutube && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{
                    background: youtubeConnected ? 'rgba(255,0,0,0.08)' : 'rgba(255,255,255,0.03)',
                    border: youtubeConnected ? '1px solid rgba(255,0,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: youtubeConnected ? '#FF0000' : '#555' }}
                    animate={youtubeConnected ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 0.7, repeat: Infinity }} />
                  <span className="font-orbitron text-xs"
                    style={{ color: youtubeConnected ? '#FF4444' : '#555', fontSize: '10px' }}>YOUTUBE</span>
                  <span className="font-mono text-xs" style={{ color: youtubeConnected ? 'rgba(255,255,255,0.3)' : '#444' }}>
                    {currentUser?.youtubeDisplayName
                      ? `${currentUser.youtubeDisplayName} (${currentUser.youtubeChannel})`
                      : currentUser?.youtubeChannel}
                  </span>
                  {!youtubeConnected && (
                    <motion.span
                      className="font-orbitron"
                      style={{ fontSize: '9px', color: '#888' }}
                      animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}>
                      conectando…
                    </motion.span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)' }}>
              <p className="font-rajdhani text-xs" style={{ color: '#FF4444' }}>{error}</p>
            </div>
          )}

          {/* Start / Stop button */}
          {!chatRegistrationActive ? (
            <motion.button
              onClick={connectAndStart}
              disabled={isConnecting}
              whileHover={!isConnecting ? { scale: 1.02 } : {}}
              whileTap={!isConnecting ? { scale: 0.98 } : {}}
              className="w-full py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(31,140,255,0.2))',
                border: '1px solid rgba(0,229,255,0.4)',
                color: '#00E5FF',
                boxShadow: '0 0 20px rgba(0,229,255,0.15)',
              }}
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span className="inline-block w-3 h-3 border border-neon-purple/40 border-t-neon-purple rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  CONECTANDO...
                </span>
              ) : startLabel}
            </motion.button>
          ) : (
            <motion.button
              onClick={stopAndDisconnect}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
              style={{
                background: 'rgba(255,68,68,0.12)',
                border: '1px solid rgba(255,68,68,0.35)',
                color: '#FF4444',
              }}
            >
              ENCERRAR INSCRIÇÕES
            </motion.button>
          )}

          {/* Registration list */}
          <AnimatePresence>
            {sessionRegistrations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="px-3 py-2 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="font-rajdhani text-xs text-white/30 tracking-widest uppercase">
                    Lista de inscritos
                  </span>
                  <span className="font-orbitron text-xs text-neon-purple font-bold">
                    {sessionRegistrations.length}
                  </span>
                </div>
                <div className="overflow-y-auto max-h-72 p-2 space-y-1">
                  {sessionRegistrations.map((reg, i) => (
                    <motion.div
                      key={`${reg.name}_${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.08)' }}
                    >
                      <span className="font-orbitron text-neon-purple/50 flex-shrink-0"
                        style={{ fontSize: '10px', minWidth: '28px' }}>
                        #{i + 1}
                      </span>
                      <span className="font-rajdhani text-white/80 text-sm flex-1">{reg.name}</span>
                      {reg.source === 'youtube' ? (
                        <span className="font-orbitron px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ fontSize: '9px', color: '#FF4444', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.25)' }}>
                          YT
                        </span>
                      ) : reg.source === 'kick' ? (
                        <span className="font-orbitron px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ fontSize: '9px', color: '#53FC1C', background: 'rgba(83,252,28,0.1)', border: '1px solid rgba(83,252,28,0.25)' }}>
                          KICK
                        </span>
                      ) : activePlatformCount > 1 ? (
                        <span className="font-orbitron px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ fontSize: '9px', color: '#9147FF', background: 'rgba(145,71,255,0.1)', border: '1px solid rgba(145,71,255,0.25)' }}>
                          TWITCH
                        </span>
                      ) : null}
                      <span className="text-neon-green/60 flex-shrink-0" style={{ fontSize: '10px' }}>✓</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state while active */}
          {chatRegistrationActive && sessionRegistrations.length === 0 && (
            <div className="text-center py-3">
              <p className="font-rajdhani text-xs text-white/25 tracking-widest">
                Aguardando participantes digitarem{' '}
                <span className="font-mono text-neon-purple/60">{twitchConfig.registrationCommand}</span>
                {' '}no chat...
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
