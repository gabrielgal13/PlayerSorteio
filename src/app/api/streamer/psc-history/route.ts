import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/streamer/psc-history?username=xxx&days=30
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '0', 10);

  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json({ entries: [], balance: 0 });

  const since = days > 0 ? new Date(Date.now() - days * 86400_000) : undefined;
  const dateFilter = since ? { gte: since } : undefined;

  let rawCredits: Awaited<ReturnType<typeof prisma.pscTransaction.findMany>> = [];
  try {
    rawCredits = await prisma.pscTransaction.findMany({
      where: { streamerId: streamer.id, ...(dateFilter ? { timestamp: dateFilter } : {}) },
      orderBy: { timestamp: 'desc' },
    });
  } catch {
    // model not yet loaded in running server — credits will be empty until restart
  }

  const rawDebits = await prisma.raffleHistory.findMany({
    where: {
      streamerId: streamer.id,
      prizePscValue: { gt: 0 },
      ...(dateFilter ? { timestamp: dateFilter } : {}),
    },
    orderBy: { timestamp: 'desc' },
  });

  const credits = rawCredits;
  const debits = rawDebits;

  type Entry = {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    timestamp: number;
  };

  const entries: Entry[] = [
    ...credits.map(c => ({
      id: c.id,
      type: 'credit' as const,
      amount: c.amount,
      description: c.description,
      timestamp: c.timestamp.getTime(),
    })),
    ...debits.map(d => ({
      id: d.id,
      type: 'debit' as const,
      amount: d.prizePscValue!,
      description: d.prizeName,
      timestamp: d.timestamp.getTime(),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({ entries, balance: streamer.pscBalance });
}
