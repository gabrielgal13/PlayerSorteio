export type MascotType = 'careca' | 'dreads';

/** Sentinel usado em `PrizeListItem.quantity` (produtos exclusivos do admin) para representar estoque ilimitado. */
export const INFINITE_QUANTITY = -1;

export interface StreamerProfile {
  username: string;
  password: string;
  rememberMe?: boolean;
  mascot: MascotType;
  displayName?: string;
  twitchChannel?: string;
  /** true quando o admin marcou este streamer como Afiliado/Parceiro Twitch de verdade — habilita OAuth real + "Por Sub". */
  twitchAffiliateEnabled?: boolean;
  /** true quando o streamer autenticou de verdade a própria conta Twitch (OAuth), habilitando leitura de inscritos. */
  twitchSubsConnected?: boolean;
  kickChannel?: string;
  kickChatroomId?: number;
  youtubeChannel?: string;
  youtubeDisplayName?: string;
  initialPscBalance?: number;
  isAdmin?: boolean;
  /** Chat Wars: sprite neutro (data URL) usado como base das bolinhas. */
  chatWarsSprite?: string | null;
  /** Chat Wars: sprite do LIVE BOSS (data URL). Sem isso, cai no sprite neutro. */
  chatWarsBossSprite?: string | null;
}

export interface Participant {
  id: string;
  number: number;
  name: string;
  source?: 'twitch' | 'kick' | 'youtube';
  /** Weighted-raffle tickets (chances). Undefined = 1. Used by the Chat Wars sorteio. */
  tickets?: number;
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

export type DeliveryStatus =
  | 'novo'
  | 'aguardando_tradelink'
  | 'item_comprado'
  | 'tradelocked'
  | 'aguardando_endereco'
  | 'endereco_recebido'
  | 'entregue'
  | 'erro_tradelink'
  | 'erro_entrega'
  | 'erro_compra';

// Resposta do PATCH de entrega. `delivered` só vem preenchido quando o status
// acabou de virar "entregue" — é o resultado do whisper de aviso ao ganhador.
export interface DeliveryUpdateResult {
  ok: boolean;
  tradeLockAt?: number | null;
  delivered?:
    | { notified: true; winnerName: string }
    | { notified: false; reason: 'mutado' | 'nao_twitch' | 'usuario_nao_encontrado' | 'falha_whisper' | 'erro' }
    | null;
}

export interface RaffleResult {
  id: string;
  winner: Participant;
  prize: Prize;
  streamer: string;
  timestamp: number;
  confirmed: boolean;
  tradeLink?: string;
  deliveryAddress?: string;
  deliveryStatus?: DeliveryStatus;
  tradeLockAt?: number;
  marketplaceItemId?: string | null;
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
  winnerTimeoutEnabled: boolean;
  raffleAnimationStyle: RaffleAnimationStyle;
  pendingMarketplaceDelivery: PendingMarketplaceDelivery | null;
  forcePasswordChange: boolean;
  /**
   * MODO TESTE: admin logado na conta de um streamer só pra olhar/testar.
   * Quem garante que nada é gravado é o middleware (a sessão no cookie carrega
   * a mesma flag) — aqui só controla a UI: banner, sem PSC, participante mock.
   */
  testMode: boolean;
  /** Username do admin que entrou no modo teste — pra voltar pro painel depois. */
  testModeAdmin: string | null;
}
