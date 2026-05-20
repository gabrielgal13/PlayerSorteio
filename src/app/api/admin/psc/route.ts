import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/psc
// body: { amount, description? } — adiciona PSC a todos os streamers (não admin)
export async function POST(req: NextRequest) {
  const { amount, description } = await req.json();
  if (typeof amount !== 'number') return NextResponse.json({ error: 'invalid amount' }, { status: 400 });

  const streamers = await prisma.streamer.findMany({ where: { isAdmin: false } });
  const desc = description ?? 'Recarga PSC';

  await Promise.all(
    streamers.map(s =>
      prisma.$transaction([
        prisma.streamer.update({
          where: { id: s.id },
          data: { pscBalance: { increment: amount } },
        }),
        prisma.pscTransaction.create({
          data: {
            streamerId: s.id,
            type: 'credit',
            amount,
            description: desc,
          },
        }),
      ])
    )
  );

  return NextResponse.json({ ok: true, updated: streamers.length });
}
