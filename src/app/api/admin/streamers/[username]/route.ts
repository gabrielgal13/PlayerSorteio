import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const body = await req.json();

  const streamer = await prisma.streamer.findUnique({
    where: { username },
    select: { id: true, pscBalance: true },
  });
  if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body.isAffiliate === 'boolean') data.isAffiliate = body.isAffiliate;

  if (typeof body.pscBalance === 'number' && body.pscBalance >= 0) {
    data.pscBalance = body.pscBalance;

    const delta = body.pscBalance - streamer.pscBalance;
    if (delta !== 0) {
      await prisma.pscTransaction.create({
        data: {
          streamerId: streamer.id,
          type: delta > 0 ? 'credit' : 'debit',
          amount: Math.abs(delta),
          description: body.pscDescription ?? 'Ajuste manual (admin)',
        },
      });
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });

  const updated = await prisma.streamer.update({
    where: { username },
    data,
    select: { username: true, displayName: true, pscBalance: true, isAffiliate: true },
  });

  return NextResponse.json(updated);
}
