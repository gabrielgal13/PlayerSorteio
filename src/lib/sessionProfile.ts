import { prisma } from '@/lib/prisma';

type StreamerRecord = NonNullable<Awaited<ReturnType<typeof prisma.streamer.findUnique>>>;

/**
 * Payload que o client usa pra montar a sessão.
 *
 * Usado tanto pelo login normal quanto pelo MODO TESTE do admin — o admin
 * precisa ver a conta exatamente como o streamer configurou, então os dois
 * caminhos devolvem o mesmo shape. O que muda no modo teste é só o que o
 * client faz com isso (sem PSC) e o que o middleware deixa gravar (nada).
 */
export function buildSessionProfile(streamer: StreamerRecord) {
  return {
    username: streamer.username,
    mascot: streamer.mascot,
    displayName: streamer.displayName,
    forcePasswordChange: streamer.forcePasswordChange,
    twitchChannel: streamer.twitchChannel,
    twitchAffiliateEnabled: streamer.twitchAffiliateEnabled,
    twitchSubsConnected: Boolean(streamer.twitchUserId && streamer.twitchUserAccessToken),
    kickChannel: streamer.kickChannel,
    kickChatroomId: streamer.kickChatroomId,
    youtubeChannel: streamer.youtubeChannel,
    youtubeDisplayName: streamer.youtubeDisplayName,
    isAdmin: streamer.isAdmin,
    isAffiliate: streamer.isAffiliate,
    pscBalance: streamer.pscBalance,
    audioEnabled: streamer.audioEnabled,
    excelImportEnabled: streamer.excelImportEnabled,
    excelPrizesImportEnabled: streamer.excelPrizesImportEnabled,
    eventMusic: streamer.eventMusic,
    eventEffect: streamer.eventEffect,
    spinEffect: streamer.spinEffect,
    themeColor: streamer.themeColor,
    socoChuteModeEnabled: streamer.socoChuteModeEnabled,
    raffleTriggerMode: streamer.raffleTriggerMode,
    autoRoundDelay: streamer.autoRoundDelay,
    chatTriggerCount: streamer.chatTriggerCount,
    chatTriggerCommand: streamer.chatTriggerCommand,
    raffleAnimationStyle: streamer.raffleAnimationStyle,
    winnerTimeoutEnabled: streamer.winnerTimeoutEnabled,
    chatWarsSprite: streamer.chatWarsSprite,
    chatWarsBossSprite: streamer.chatWarsBossSprite,
    twitchConfig: {
      channel: streamer.twitchChannel ?? '',
      registrationCommand: streamer.registrationCommand,
      claimCommand: streamer.claimCommand,
      validationTimeout: streamer.validationTimeout,
    },
  };
}
