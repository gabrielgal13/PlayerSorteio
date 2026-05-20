import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/streamer/history?username=xxx
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json([]);

  const rows = await prisma.raffleHistory.findMany({
    where: { streamerId: streamer.id },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });

  return NextResponse.json(rows.map(r => ({
    id: r.id,
    winner: { id: r.id, number: r.winnerNumber, name: r.winnerName, source: r.winnerSource ?? undefined },
    prize: {
      id: r.id,
      name: r.prizeName,
      description: r.prizeDescription ?? undefined,
      imageUrl: r.prizeImageUrl ?? undefined,
      quantity: r.prizeQuantity,
      order: 0,
      pscValue: r.prizePscValue ?? undefined,
    },
    streamer: username,
    timestamp: r.timestamp.getTime(),
    confirmed: r.confirmed,
    tradeLink: r.tradeLink ?? undefined,
    deliveryStatus: (r.deliveryStatus ?? 'novo') as 'novo' | 'tradelocked' | 'entregue',
    tradeLockAt: r.tradeLockAt?.getTime() ?? undefined,
  })));
}

// POST /api/streamer/history
export async function POST(req: NextRequest) {
  const { username, result } = await req.json();
  if (!username || !result) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });

  await prisma.raffleHistory.create({
    data: {
      streamerId: streamer.id,
      winnerNumber: result.winner.number,
      winnerName: result.winner.name,
      winnerSource: result.winner.source ?? null,
      prizeName: result.prize.name,
      prizeDescription: result.prize.description ?? null,
      prizeImageUrl: result.prize.imageUrl ?? null,
      prizeQuantity: result.prize.quantity,
      prizePscValue: result.prize.pscValue ?? null,
      confirmed: result.confirmed,
      timestamp: new Date(result.timestamp),
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/streamer/history?username=xxx
export async function DELETE(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json({ ok: true });

  await prisma.raffleHistory.deleteMany({ where: { streamerId: streamer.id } });
  return NextResponse.json({ ok: true });
}
