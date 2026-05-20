import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/streamer/preferences
// body: { username, audioEnabled?, eventMusic?, eventEffect?, spinEffect?, socoChuteModeEnabled? }
export async function PATCH(req: NextRequest) {
  const { username, ...prefs } = await req.json();
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.upsert({
    where: { username },
    update: prefs,
    create: { username, passwordHash: '', ...prefs },
  });

  return NextResponse.json({
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
  });
}
