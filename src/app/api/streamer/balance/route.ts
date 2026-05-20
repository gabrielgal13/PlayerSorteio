import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/streamer/balance
// body: { username, pscBalance }
export async function PATCH(req: NextRequest) {
  const { username, pscBalance } = await req.json();
  if (!username || pscBalance === undefined)
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const streamer = await prisma.streamer.update({
    where: { username },
    data: { pscBalance },
  });

  return NextResponse.json({ pscBalance: streamer.pscBalance });
}
