import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/streamer/config?username=xxx
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json(null);

  return NextResponse.json({
    twitchChannel: streamer.twitchChannel,
    registrationCommand: streamer.registrationCommand,
    claimCommand: streamer.claimCommand,
    validationTimeout: streamer.validationTimeout,
  });
}

// PATCH /api/streamer/config
// body: { username, twitchChannel?, registrationCommand?, claimCommand?, validationTimeout? }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { username, ...config } = body;

  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.update({
    where: { username },
    data: config,
  });

  return NextResponse.json({
    twitchChannel: streamer.twitchChannel,
    registrationCommand: streamer.registrationCommand,
    claimCommand: streamer.claimCommand,
    validationTimeout: streamer.validationTimeout,
  });
}
