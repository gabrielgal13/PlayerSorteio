import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withdrawItem } from '@/lib/waxpeer';

const STEAM_LINK_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;

export async function POST(req: NextRequest) {
  const { winnerName, tradeLink, source } = await req.json() as {
    winnerName: string;
    tradeLink: string;
    source: 'youtube' | 'kick';
  };

  if (!winnerName?.trim() || !tradeLink?.trim() || !STEAM_LINK_REGEX.test(tradeLink)) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 });
  }

  // winnerSource null = inscrito manualmente (aceito de qualquer plataforma)
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // últimas 6 horas
  const entry = await prisma.raffleHistory.findFirst({
    where: {
      winnerName: { equals: winnerName, mode: 'insensitive' },
      deliveryStatus: { notIn: ['entregue', 'tradelocked'] },
      tradeLink: null,
      timestamp: { gte: cutoff },
      OR: [{ winnerSource: source }, { winnerSource: null }],
    },
    orderBy: { timestamp: 'desc' },
  });

  if (!entry) {
    return NextResponse.json({ ok: false, error: 'Nenhuma entrega pendente para esse usuário' });
  }

  await prisma.raffleHistory.update({
    where: { id: entry.id },
    data: { tradeLink },
  });

  if (entry.marketplaceItemId) {
    try {
      const result = await withdrawItem(entry.marketplaceItemId, tradeLink);
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { deliveryStatus: result.success ? 'entregue' : 'tradelocked' },
      });
    } catch { /* ignore — entrega será tentada manualmente */ }
  }

  console.log(`[chat-trade-link] ${source} | ${winnerName} → ${tradeLink}`);
  return NextResponse.json({ ok: true, source });
}
