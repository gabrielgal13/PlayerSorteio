import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const streamers = await prisma.streamer.findMany({
    where: { isAdmin: false },
    select: { username: true, displayName: true, pscBalance: true, isAffiliate: true },
    orderBy: { username: 'asc' },
  });
  return NextResponse.json(streamers);
}

export async function POST(req: NextRequest) {
  const { username, displayName, password, mascot, themeColor, raffleEffect, pscBalance } = await req.json();

  if (!username || !password)
    return NextResponse.json({ error: 'Username e senha são obrigatórios.' }, { status: 400 });

  const existing = await prisma.streamer.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });
  if (existing)
    return NextResponse.json({ error: 'Username já existe.' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  const streamer = await prisma.streamer.create({
    data: {
      username: username.toLowerCase(),
      displayName: displayName || username,
      passwordHash,
      mascot: mascot || 'dreads',
      themeColor: themeColor || '#00E5FF',
      eventEffect: raffleEffect || 'confetti',
      pscBalance: typeof pscBalance === 'number' && pscBalance >= 0 ? pscBalance : 0,
      isAdmin: false,
    },
  });

  return NextResponse.json({ username: streamer.username }, { status: 201 });
}
