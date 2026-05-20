import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/streamer/delivery
// body: { historyId, tradeLink?, deliveryStatus? }
export async function PATCH(req: NextRequest) {
  const { historyId, tradeLink, deliveryStatus } = await req.json();
  if (!historyId) return NextResponse.json({ error: 'historyId required' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (tradeLink !== undefined) data.tradeLink = tradeLink || null;
  if (deliveryStatus !== undefined) {
    data.deliveryStatus = deliveryStatus;
    if (deliveryStatus === 'tradelocked') {
      const current = await prisma.raffleHistory.findUnique({ where: { id: historyId }, select: { tradeLockAt: true } });
      if (!current?.tradeLockAt) data.tradeLockAt = new Date();
    }
  }

  const updated = await prisma.raffleHistory.update({ where: { id: historyId }, data });
  return NextResponse.json({ ok: true, tradeLockAt: updated.tradeLockAt?.getTime() ?? null });
}
