import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, sessionCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
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
    twitchChannel: streamer.twitchChannel,
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
