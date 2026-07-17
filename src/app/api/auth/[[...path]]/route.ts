import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, sessionCookieOptions, clearCookieOptions } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'login') {
    const { username, password, rememberMe = false } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });

    const streamer = await prisma.streamer.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (!streamer || !(await bcrypt.compare(password, streamer.passwordHash)))
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });

    const token = await signToken({ username: streamer.username, isAdmin: streamer.isAdmin });

    const res = NextResponse.json({
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
      chatWarsSprite: streamer.chatWarsSprite,
      twitchConfig: {
        channel: streamer.twitchChannel ?? '',
        registrationCommand: streamer.registrationCommand,
        claimCommand: streamer.claimCommand,
        validationTimeout: streamer.validationTimeout,
      },
    });

    res.cookies.set(sessionCookieOptions(token, rememberMe));
    return res;
  }

  if (route === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(clearCookieOptions());
    return res;
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
