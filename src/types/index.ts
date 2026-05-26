export type MascotType = 'careca' | 'dreads';

export interface StreamerProfile {
  username: string;
  password: string;
  rememberMe?: boolean;
  mascot: MascotType;
  displayName?: string;
  twitchChannel?: string;
  kickChannel?: string;
  kickChatroomId?: number;
  youtubeChannel?: string;
  youtubeDisplayName?: string;
  initialPscBalance?: number;
  isAdmin?: boolean;
}

export interface Participant {
  id: string;
  number: number;
  name: string;
  source?: 'twitch' | 'kick' | 'youtube';
}

export interface Prize {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity: number;
  order: number;
  pscValue?: number;
  skipPsc?: boolean;
}

export interface SavedPrizeListItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  quantity: number;
  pscValue?: number;
  skipPsc?: boolean;
  order: number;
}

export interface SavedPrizeList {
  id: string;
  name: string;
  description?: string;
  visibility?: string;
  coverUrl?: string;
  items: SavedPrizeListItem[];
  createdAt: string;
  updatedAt: string;
}

export type RaffleStatus =
  | 'idle'
  | 'suspense'
  | 'spinning'
  | 'revealing'
  | 'winner'
  | 'validating'
  | 'chat-verifying'
  | 'chat-verified'
  | 'confirmed'
  | 'timeout'
  | 'reroll';

export type DeliveryStatus = 'novo' | 'tradelocked' | 'entregue' | 'aguardando_tradelink';

export interface RaffleResult {
  id: string;
  winner: Participant;
  prize: Prize;
  streamer: string;
  timestamp: number;
  confirmed: boolean;
  tradeLink?: string;
  deliveryStatus?: DeliveryStatus;
  tradeLockAt?: number;
}

export interface TwitchConfig {
  channel: string;
  claimCommand: string;
  validationTimeout: number;
  registrationCommand: string;
}

export type AppTab = 'setup' | 'raffle' | 'history' | 'twitch' | 'games' | 'entregas' | 'psc-history';

export type EventMusicTrack = 'cyberpunk' | 'epic' | 'lofi' | 'off';
export type EventEffectType = 'confetti' | 'fireworks' | 'sparkles' | 'none';
export type RaffleSpinEffect = 'numbers' | 'name-reel' | 'wheel' | 'matrix';
export type RaffleTriggerMode = 'manual' | 'auto' | 'chat';
export type RaffleAnimationStyle = 'balada' | 'concerto' | 'fogos' | 'scifi';

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  color: string;
  source: 'twitch' | 'kick' | 'youtube';
  timestamp: number;
}

export interface PendingMarketplaceDelivery {
  winnerName: string;
  prizeName: string;
  waxpeerItemId: string | null;
  status: 'buying' | 'waiting_tradelink' | 'withdrawing' | 'done' | 'failed';
}

export interface AppState {
  isLoggedIn: boolean;
  currentUser: StreamerProfile | null;
  participants: Participant[];
  prizes: Prize[];
  history: RaffleResult[];
  raffleStatus: RaffleStatus;
  currentWinner: Participant | null;
  currentPrize: Prize | null;
  activeTab: AppTab;
  obsMode: boolean;
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  validationCountdown: number;
  audioEnabled: boolean;
  excelImportEnabled: boolean;
  excelPrizesImportEnabled: boolean;
  chatRegistrationActive: boolean;
  chatRegistrationRequested: boolean;
  chatRegistrationStopRequested: boolean;
  winnerChatMessage: string | null;
  raffleStage: 1 | 2 | 3;
  sessionStartTimestamp: number | null;
  sessionDuration: number;
  sessionParticipantCount: number;
  liveViewerCount: number | null;
  eventBackground: string | null;
  chatMessages: ChatMessage[];
  pscBalance: number;
  isAffiliate: boolean;
  pscBalances: Record<string, number>;
  themeColor: string;
  eventMusic: EventMusicTrack;
  eventEffect: EventEffectType;
  spinEffect: RaffleSpinEffect;
  socoChuteModeEnabled: boolean;
  raffleTriggerMode: RaffleTriggerMode;
  autoRoundDelay: number;
  chatTriggerCount: number;
  chatTriggerCommand: string;
  mascotSocoKey: number;
  mascotChuteKey: number;
  mascotHp: number;
  mascotMaxHp: number;
  mascotDead: boolean;
  mascotDeadThisRound: boolean;
  autoRevealWinner: boolean;
  raffleAnimationStyle: RaffleAnimationStyle;
  pendingMarketplaceDelivery: PendingMarketplaceDelivery | null;
}
