'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState, StreamerProfile, Participant, Prize,
  RaffleResult, RaffleStatus, AppTab, TwitchConfig, ChatMessage,
  EventMusicTrack, EventEffectType, RaffleSpinEffect, RaffleTriggerMode, DeliveryStatus,
  RaffleAnimationStyle, PendingMarketplaceDelivery, DeliveryUpdateResult,
} from '@/types';

interface AppActions {
  login: (profile: StreamerProfile) => Promise<void>;
  logout: () => void;
  enterTestMode: (username: string) => Promise<void>;
  exitTestMode: () => Promise<void>;
  deductPSC: (amount: number) => void;
  addPscToAll: (amount: number) => void;
  setParticipants: (participants: Participant[]) => void;
  addPrize: (prize: Omit<Prize, 'id' | 'order'>) => void;
  updatePrize: (id: string, updates: Partial<Prize>) => void;
  removePrize: (id: string) => void;
  setRaffleStatus: (status: RaffleStatus) => void;
  setCurrentWinner: (winner: Participant | null) => void;
  setCurrentPrize: (prize: Prize | null) => void;
  addHistory: (result: RaffleResult) => void;
  clearHistory: () => void;
  clearPrizes: () => void;
  reorderPrizes: (fromIndex: number, toIndex: number) => void;
  setActiveTab: (tab: AppTab) => void;
  setObsMode: (enabled: boolean) => void;
  setTwitchConfig: (config: Partial<TwitchConfig>) => void;
  setTwitchConnected: (connected: boolean) => void;
  setYoutubeChannel: (channel: string, displayName?: string) => void;
  setKickChannel: (channel: string, chatroomId?: number) => void;
  setTwitchAuthenticated: (channel: string, connected: boolean) => void;
  setValidationCountdown: (seconds: number) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setExcelImportEnabled: (enabled: boolean) => void;
  setExcelPrizesImportEnabled: (enabled: boolean) => void;
  setChatRegistrationActive: (active: boolean) => void;
  setChatRegistrationRequested: (v: boolean) => void;
  setChatRegistrationStopRequested: (v: boolean) => void;
  addParticipantFromChat: (username: string, source?: 'twitch' | 'kick' | 'youtube') => boolean;
  setWinnerChatMessage: (message: string | null) => void;
  setRaffleStage: (stage: 1 | 2 | 3) => void;
  setSessionStartTimestamp: (t: number | null) => void;
  setSessionDuration: (d: number) => void;
  setSessionParticipantCount: (n: number) => void;
  setLiveViewerCount: (n: number | null) => void;
  setEventBackground: (bg: string | null) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  setThemeColor: (color: string) => void;
  setEventMusic: (track: EventMusicTrack) => void;
  setEventEffect: (effect: EventEffectType) => void;
  setSpinEffect: (effect: RaffleSpinEffect) => void;
  saveConfigToDB: () => Promise<void>;
  updateDelivery: (id: string, tradeLink?: string, deliveryStatus?: DeliveryStatus, deliveryAddress?: string) => Promise<DeliveryUpdateResult | null>;
  triggerMascotSoco: () => void;
  triggerMascotChute: () => void;
  initMascotHp: (viewerCount: number) => void;
  reviveMascot: () => void;
  resetMascotRound: () => void;
  setAutoRevealWinner: (v: boolean) => void;
  setWinnerTimeoutEnabled: (v: boolean) => void;
  setSocoChuteModeEnabled: (v: boolean) => void;
  setRaffleTriggerMode: (mode: RaffleTriggerMode) => void;
  setAutoRoundDelay: (s: number) => void;
  setChatTriggerCount: (n: number) => void;
  setChatTriggerCommand: (cmd: string) => void;
  setRaffleAnimationStyle: (style: RaffleAnimationStyle) => void;
  setPendingMarketplaceDelivery: (d: PendingMarketplaceDelivery | null) => void;
  setForcePasswordChange: (v: boolean) => void;
}

const THEME_BY_MASCOT: Record<string, string> = {
  dreads: '#00FFA3',
  careca: '#00E5FF',
};

/** Nick mockado que o admin adiciona com um clique durante o modo teste. */
export const TEST_MODE_MOCK_PARTICIPANT = 'ddkf1ps';

/** Resposta de /api/auth/login, /api/admin/test-mode e /api/auth/exit-test-mode
 *  (os três devolvem o mesmo shape — ver `buildSessionProfile` no servidor). */
interface SessionProfileResponse {
  username: string;
  mascot: StreamerProfile['mascot'];
  displayName?: string | null;
  forcePasswordChange?: boolean;
  twitchChannel?: string | null;
  twitchAffiliateEnabled?: boolean;
  twitchSubsConnected?: boolean;
  kickChannel?: string | null;
  kickChatroomId?: number | null;
  youtubeChannel?: string | null;
  youtubeDisplayName?: string | null;
  isAdmin?: boolean;
  isAffiliate?: boolean;
  pscBalance: number;
  audioEnabled: boolean;
  excelImportEnabled?: boolean;
  excelPrizesImportEnabled?: boolean;
  eventMusic: EventMusicTrack;
  eventEffect: EventEffectType;
  spinEffect?: RaffleSpinEffect;
  themeColor?: string | null;
  socoChuteModeEnabled?: boolean;
  raffleTriggerMode?: string;
  autoRoundDelay?: number;
  chatTriggerCount?: number;
  chatTriggerCommand?: string;
  raffleAnimationStyle?: string;
  winnerTimeoutEnabled?: boolean;
  chatWarsSprite?: string | null;
  chatWarsBossSprite?: string | null;
  twitchConfig: TwitchConfig;
}

/** Traduz o payload de sessão pro estado da store. */
function profileToState(data: SessionProfileResponse) {
  const streamerProfile: StreamerProfile = {
    username: data.username,
    password: '',
    mascot: data.mascot,
    displayName: data.displayName ?? undefined,
    twitchChannel: data.twitchChannel ?? undefined,
    twitchAffiliateEnabled: data.twitchAffiliateEnabled,
    twitchSubsConnected: data.twitchSubsConnected,
    kickChannel: data.kickChannel ?? undefined,
    kickChatroomId: data.kickChatroomId ?? undefined,
    youtubeChannel: data.youtubeChannel ?? undefined,
    youtubeDisplayName: data.youtubeDisplayName ?? undefined,
    isAdmin: data.isAdmin,
    chatWarsSprite: data.chatWarsSprite,
    chatWarsBossSprite: data.chatWarsBossSprite,
  };

  return {
    isLoggedIn: true,
    currentUser: streamerProfile,
    forcePasswordChange: data.forcePasswordChange ?? false,
    twitchConfig: data.twitchConfig,
    eventBackground: data.mascot === 'dreads' ? '/fundo-ganja.png' : null,
    raffleStage: 1 as const,
    chatMessages: [],
    pscBalance: data.pscBalance,
    isAffiliate: data.isAffiliate ?? true,
    audioEnabled: data.audioEnabled,
    excelImportEnabled: data.excelImportEnabled ?? true,
    excelPrizesImportEnabled: data.excelPrizesImportEnabled ?? true,
    eventMusic: data.eventMusic,
    eventEffect: data.eventEffect,
    spinEffect: data.spinEffect ?? 'numbers',
    themeColor: data.themeColor ?? THEME_BY_MASCOT[data.mascot] ?? '#00E5FF',
    socoChuteModeEnabled: data.socoChuteModeEnabled ?? true,
    raffleTriggerMode: (data.raffleTriggerMode ?? 'manual') as RaffleTriggerMode,
    autoRoundDelay: data.autoRoundDelay ?? 30,
    chatTriggerCount: data.chatTriggerCount ?? 50,
    chatTriggerCommand: data.chatTriggerCommand ?? '!sortear',
    raffleAnimationStyle: (data.raffleAnimationStyle ?? 'balada') as RaffleAnimationStyle,
    winnerTimeoutEnabled: data.winnerTimeoutEnabled ?? true,
  };
}

/** Zera tudo que é de sessão de evento — usado ao entrar e ao sair do modo teste. */
const CLEARED_SESSION_STATE = {
  participants: [],
  prizes: [],
  history: [],
  raffleStatus: 'idle' as RaffleStatus,
  currentWinner: null,
  currentPrize: null,
  activeTab: 'raffle' as AppTab,
  twitchConnected: false,
  chatRegistrationActive: false,
  chatRegistrationRequested: false,
  chatRegistrationStopRequested: false,
  winnerChatMessage: null,
  liveViewerCount: null,
  sessionParticipantCount: 0,
  pendingMarketplaceDelivery: null,
};

export const useStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      currentUser: null,
      participants: [],
      prizes: [],
      history: [],
      raffleStatus: 'idle',
      currentWinner: null,
      currentPrize: null,
      activeTab: 'raffle',
      obsMode: false,
      twitchConfig: { channel: '', claimCommand: '!claim', validationTimeout: 60, registrationCommand: '!entrar' },
      twitchConnected: false,
      validationCountdown: 60,
      audioEnabled: true,
      excelImportEnabled: true,
      excelPrizesImportEnabled: true,
      chatRegistrationActive: false,
      chatRegistrationRequested: false,
      chatRegistrationStopRequested: false,
      winnerChatMessage: null,
      raffleStage: 1,
      sessionStartTimestamp: null,
      sessionDuration: 0,
      sessionParticipantCount: 0,
      liveViewerCount: null,
      eventBackground: null,
      chatMessages: [],
      pscBalance: 0,
      isAffiliate: true,
      pscBalances: {},
      themeColor: '#00E5FF',
      eventMusic: 'cyberpunk',
      eventEffect: 'confetti',
      spinEffect: 'numbers',
      mascotSocoKey: 0,
      mascotChuteKey: 0,
      mascotHp: 10,
      mascotMaxHp: 10,
      mascotDead: false,
      mascotDeadThisRound: false,
      autoRevealWinner: true,
      winnerTimeoutEnabled: true,
      raffleAnimationStyle: 'balada' as RaffleAnimationStyle,
      pendingMarketplaceDelivery: null,
      forcePasswordChange: false,
      testMode: false,
      testModeAdmin: null,
      socoChuteModeEnabled: true,
      raffleTriggerMode: 'manual' as RaffleTriggerMode,
      autoRoundDelay: 30,
      chatTriggerCount: 50,
      chatTriggerCommand: '!sortear',

      updateDelivery: (id, tradeLink, deliveryStatus, deliveryAddress) => {
        const now = Date.now();
        set({
          history: get().history.map(r => r.id === id ? {
            ...r,
            ...(tradeLink !== undefined && { tradeLink }),
            ...(deliveryAddress !== undefined && { deliveryAddress }),
            ...(deliveryStatus !== undefined && { deliveryStatus }),
            ...(deliveryStatus === 'tradelocked' && !r.tradeLockAt && { tradeLockAt: now }),
          } : r),
        });
        return fetch('/api/streamer/delivery', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ historyId: id, tradeLink, deliveryStatus, deliveryAddress }),
        })
          .then(r => r.json() as Promise<DeliveryUpdateResult>)
          .catch(() => null);
      },

      triggerMascotSoco: () => {
        const s = get();
        if (!s.mascotDead && !s.mascotDeadThisRound) {
          const newHp = s.mascotHp - 1;
          if (newHp <= 0) {
            set(st => ({ mascotSocoKey: st.mascotSocoKey + 1, mascotHp: 0, mascotDead: true, mascotDeadThisRound: true }));
          } else {
            set(st => ({ mascotSocoKey: st.mascotSocoKey + 1, mascotHp: newHp }));
          }
        } else {
          set(st => ({ mascotSocoKey: st.mascotSocoKey + 1 }));
        }
      },
      triggerMascotChute: () => {
        const s = get();
        if (!s.mascotDead && !s.mascotDeadThisRound) {
          const newHp = s.mascotHp - 1;
          if (newHp <= 0) {
            set(st => ({ mascotChuteKey: st.mascotChuteKey + 1, mascotHp: 0, mascotDead: true, mascotDeadThisRound: true }));
          } else {
            set(st => ({ mascotChuteKey: st.mascotChuteKey + 1, mascotHp: newHp }));
          }
        } else {
          set(st => ({ mascotChuteKey: st.mascotChuteKey + 1 }));
        }
      },
      initMascotHp: (viewerCount) => {
        const maxHp = viewerCount >= 1000 ? 20 : viewerCount >= 100 ? 10 : 5;
        set({ mascotHp: maxHp, mascotMaxHp: maxHp, mascotDead: false, mascotDeadThisRound: false });
      },
      reviveMascot: () => set({ mascotDead: false }),
      resetMascotRound: () => {
        const maxHp = get().mascotMaxHp;
        set({ mascotHp: maxHp, mascotDead: false, mascotDeadThisRound: false });
      },

      setAutoRevealWinner: (autoRevealWinner) => {
        set({ autoRevealWinner });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, autoRevealWinner }),
          }).catch(() => {});
        }
      },

      setWinnerTimeoutEnabled: (winnerTimeoutEnabled) => {
        set({ winnerTimeoutEnabled });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, winnerTimeoutEnabled }),
          }).catch(() => {});
        }
      },

      setSocoChuteModeEnabled: (socoChuteModeEnabled) => {
        set({ socoChuteModeEnabled });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, socoChuteModeEnabled }),
          }).catch(() => {});
        }
      },

      setRaffleTriggerMode: (raffleTriggerMode) => {
        set({ raffleTriggerMode });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, raffleTriggerMode }),
          }).catch(() => {});
        }
      },
      setAutoRoundDelay: (autoRoundDelay) => {
        set({ autoRoundDelay });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, autoRoundDelay }),
          }).catch(() => {});
        }
      },
      setChatTriggerCount: (chatTriggerCount) => {
        set({ chatTriggerCount });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, chatTriggerCount }),
          }).catch(() => {});
        }
      },
      setChatTriggerCommand: (chatTriggerCommand) => {
        set({ chatTriggerCommand });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, chatTriggerCommand }),
          }).catch(() => {});
        }
      },

      setPendingMarketplaceDelivery: (pendingMarketplaceDelivery) => set({ pendingMarketplaceDelivery }),

      setRaffleAnimationStyle: (raffleAnimationStyle) => {
        set({ raffleAnimationStyle });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, raffleAnimationStyle }),
          }).catch(() => {});
        }
      },

      login: async (profile) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: profile.username, password: profile.password, rememberMe: profile.rememberMe }),
        });
        if (!res.ok) throw new Error('Credenciais inválidas');

        const data = await res.json();

        set({ ...profileToState(data), testMode: false, testModeAdmin: null });

        // Carrega histórico do DB em background
        if (!data.isAdmin) {
          fetch(`/api/streamer/history?username=${data.username}`)
            .then(r => r.json())
            .then(history => { if (Array.isArray(history)) set({ history }); })
            .catch(() => {});
        }
      },

      // ── MODO TESTE ─────────────────────────────────────────────────────────
      // Troca a sessão do admin por uma sessão do streamer marcada como teste.
      // O bloqueio de escrita mora no middleware (a flag vai no cookie), então
      // nada aqui precisa lembrar de "não salvar" — o servidor recusa sozinho.
      enterTestMode: async (username) => {
        const admin = get().currentUser?.username ?? null;
        const res = await fetch('/api/admin/test-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? 'Não foi possível entrar no modo teste');

        set({
          ...profileToState(data),
          ...CLEARED_SESSION_STATE,
          // Modo teste não tem PSC: sem saldo e sem fluxo de afiliado (que é o
          // que dispara compra no marketplace e desconto de moeda).
          isAffiliate: false,
          pscBalance: 0,
          // Nunca cair na tela de trocar senha testando a conta de outro.
          forcePasswordChange: false,
          testMode: true,
          testModeAdmin: admin,
        });

        // Histórico real do streamer, só pra olhar — nada do teste é gravado.
        fetch(`/api/streamer/history?username=${encodeURIComponent(data.username)}`)
          .then(r => r.json())
          .then(history => { if (Array.isArray(history) && get().testMode) set({ history }); })
          .catch(() => {});
      },

      exitTestMode: async () => {
        const res = await fetch('/api/auth/exit-test-mode', { method: 'POST' });
        if (!res.ok) { get().logout(); return; }
        const data = await res.json();
        set({
          ...profileToState(data),
          ...CLEARED_SESSION_STATE,
          eventBackground: null,
          testMode: false,
          testModeAdmin: null,
        });
      },

      setForcePasswordChange: (forcePasswordChange) => set({ forcePasswordChange }),

      logout: () => {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        set({
          ...CLEARED_SESSION_STATE,
          isLoggedIn: false,
          currentUser: null,
          forcePasswordChange: false,
          testMode: false,
          testModeAdmin: null,
          raffleStage: 1,
          eventBackground: null,
          chatMessages: [],
        });
      },

      setParticipants: (participants) => set({ participants }),

      addPrize: (prize) => {
        const prizes = get().prizes;
        const newPrize: Prize = {
          ...prize,
          id: `prize_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          order: prizes.length,
        };
        set({ prizes: [...prizes, newPrize] });
      },

      updatePrize: (id, updates) =>
        set({ prizes: get().prizes.map(p => p.id === id ? { ...p, ...updates } : p) }),

      removePrize: (id) => set({ prizes: get().prizes.filter(p => p.id !== id) }),

      setRaffleStatus: (status) => set({ raffleStatus: status }),
      setCurrentWinner: (winner) => set({ currentWinner: winner }),
      setCurrentPrize: (prize) => set({ currentPrize: prize }),

      addHistory: (result) => {
        set({ history: [result, ...get().history].slice(0, 100) });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, result }),
          }).catch(() => {});
        }
      },

      clearHistory: () => {
        const username = get().currentUser?.username;
        set({ history: get().history.filter(r => r.streamer !== username) });
        if (username) {
          fetch(`/api/streamer/history?username=${username}`, { method: 'DELETE' }).catch(() => {});
        }
      },

      clearPrizes: () => set({ prizes: [], currentPrize: null }),

      reorderPrizes: (fromIndex, toIndex) => {
        const prizes = [...get().prizes];
        const [moved] = prizes.splice(fromIndex, 1);
        prizes.splice(toIndex, 0, moved);
        set({ prizes });
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setObsMode: (obsMode) => set({ obsMode }),
      setTwitchConfig: (config) => set({ twitchConfig: { ...get().twitchConfig, ...config } }),

      saveConfigToDB: async () => {
        const { currentUser, twitchConfig, audioEnabled, excelImportEnabled, excelPrizesImportEnabled, eventMusic, eventEffect, spinEffect, themeColor } = get();
        if (!currentUser || currentUser.isAdmin) return;
        await Promise.all([
          fetch('/api/streamer/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser.username,
              twitchChannel: twitchConfig.channel,
              registrationCommand: twitchConfig.registrationCommand,
              claimCommand: twitchConfig.claimCommand,
              validationTimeout: twitchConfig.validationTimeout,
            }),
          }),
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser.username,
              audioEnabled,
              excelImportEnabled,
              excelPrizesImportEnabled,
              eventMusic,
              eventEffect,
              spinEffect,
              themeColor,
            }),
          }),
        ]);
        set({ currentUser: { ...currentUser, twitchChannel: twitchConfig.channel || undefined } });
      },

      setTwitchConnected: (twitchConnected) => set({ twitchConnected }),

      setYoutubeChannel: (channel, displayName) => {
        const { currentUser } = get();
        if (!currentUser) return;
        const updated = { ...currentUser, youtubeChannel: channel, youtubeDisplayName: displayName ?? currentUser.youtubeDisplayName };
        set({ currentUser: updated });
        fetch('/api/streamer/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser.username, youtubeChannel: channel, youtubeDisplayName: displayName ?? null }),
        }).catch(() => {});
      },

      setKickChannel: (channel, chatroomId) => {
        const { currentUser } = get();
        if (!currentUser) return;
        const updated = { ...currentUser, kickChannel: channel || undefined, kickChatroomId: chatroomId };
        set({ currentUser: updated });
        fetch('/api/streamer/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser.username, kickChannel: channel || null, kickChatroomId: chatroomId ?? null }),
        }).catch(() => {});
      },
      setTwitchAuthenticated: (channel, connected) => {
        const { currentUser, twitchConfig } = get();
        if (!currentUser) return;
        set({
          currentUser: { ...currentUser, twitchChannel: channel || currentUser.twitchChannel, twitchSubsConnected: connected },
          twitchConfig: { ...twitchConfig, channel: channel || twitchConfig.channel },
        });
      },

      setValidationCountdown: (validationCountdown) => set({ validationCountdown }),

      setAudioEnabled: (audioEnabled) => {
        set({ audioEnabled });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, audioEnabled }),
          }).catch(() => {});
        }
      },

      setExcelImportEnabled: (excelImportEnabled) => {
        set({ excelImportEnabled });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, excelImportEnabled }),
          }).catch(() => {});
        }
      },

      setExcelPrizesImportEnabled: (excelPrizesImportEnabled) => {
        set({ excelPrizesImportEnabled });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, excelPrizesImportEnabled }),
          }).catch(() => {});
        }
      },

      setChatRegistrationActive: (chatRegistrationActive) => set({ chatRegistrationActive }),
      setChatRegistrationRequested: (chatRegistrationRequested) => set({ chatRegistrationRequested }),
      setChatRegistrationStopRequested: (chatRegistrationStopRequested) => set({ chatRegistrationStopRequested }),
      setWinnerChatMessage: (winnerChatMessage) => set({ winnerChatMessage }),

      addParticipantFromChat: (username: string, source?: 'twitch' | 'kick' | 'youtube') => {
        const { participants } = get();
        if (participants.some(p => p.name.toLowerCase() === username.toLowerCase())) return false;
        const nextNumber = participants.length > 0 ? Math.max(...participants.map(p => p.number)) + 1 : 1;
        const newParticipant: Participant = {
          id: `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          number: nextNumber,
          name: username,
          source,
        };
        set({ participants: [...participants, newParticipant] });
        return true;
      },
      setRaffleStage: (raffleStage) => set({ raffleStage }),
      setSessionStartTimestamp: (sessionStartTimestamp) => set({ sessionStartTimestamp }),
      setSessionDuration: (sessionDuration) => set({ sessionDuration }),
      setSessionParticipantCount: (sessionParticipantCount) => set({ sessionParticipantCount }),
      setLiveViewerCount: (liveViewerCount) => set({ liveViewerCount }),
      setEventBackground: (eventBackground) => set({ eventBackground }),
      setThemeColor: (themeColor) => {
        set({ themeColor });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, themeColor }),
          }).catch(() => {});
        }
      },

      setEventMusic: (eventMusic) => {
        set({ eventMusic });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, eventMusic }),
          }).catch(() => {});
        }
      },

      setEventEffect: (eventEffect) => {
        set({ eventEffect });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, eventEffect }),
          }).catch(() => {});
        }
      },

      setSpinEffect: (spinEffect) => {
        set({ spinEffect });
        const username = get().currentUser?.username;
        if (username) {
          fetch('/api/streamer/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, spinEffect }),
          }).catch(() => {});
        }
      },

      addChatMessage: (msg) => {
        const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        set({ chatMessages: [...get().chatMessages, { ...msg, id }].slice(-80) });
      },

      deductPSC: (amount) => {
        const { pscBalance, currentUser } = get();
        // Otimista pra UI responder na hora, mas o valor que vale é o que o
        // servidor devolve — ele calcula em cima do saldo real no banco, nunca
        // confia num valor absoluto vindo daqui (client pode estar desatualizado).
        set({ pscBalance: Math.max(0, pscBalance - amount) });
        if (currentUser && !currentUser.isAdmin) {
          fetch('/api/streamer/balance', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, amount }),
          })
            .then(r => r.json())
            .then(data => { if (typeof data.pscBalance === 'number') set({ pscBalance: data.pscBalance }); })
            .catch(() => {});
        }
      },

      addPscToAll: (amount) => {
        fetch('/api/admin/psc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        }).catch(() => {});
      },
    }),
    {
      name: 'playerskins-raffle-store',
      partialize: (state) => ({
        // Mantido como cache local para carregamento imediato enquanto DB responde
        isLoggedIn: state.isLoggedIn,
        currentUser: state.currentUser,
        forcePasswordChange: state.forcePasswordChange,
        // Precisa sobreviver ao F5: sem isso a UI voltaria "normal" (com PSC,
        // sem banner) enquanto o cookie ainda está em modo teste.
        testMode: state.testMode,
        testModeAdmin: state.testModeAdmin,
        twitchConfig: state.twitchConfig,
        audioEnabled: state.audioEnabled,
        excelImportEnabled: state.excelImportEnabled,
        excelPrizesImportEnabled: state.excelPrizesImportEnabled,
        eventMusic: state.eventMusic,
        eventEffect: state.eventEffect,
        spinEffect: state.spinEffect,
        autoRevealWinner: state.autoRevealWinner,
        winnerTimeoutEnabled: state.winnerTimeoutEnabled,
        socoChuteModeEnabled: state.socoChuteModeEnabled,
        raffleTriggerMode: state.raffleTriggerMode,
        autoRoundDelay: state.autoRoundDelay,
        chatTriggerCount: state.chatTriggerCount,
        chatTriggerCommand: state.chatTriggerCommand,
        raffleAnimationStyle: state.raffleAnimationStyle,
      }),
    }
  )
);
