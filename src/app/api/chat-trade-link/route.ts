import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem } from '@/lib/waxpeer';

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

  // Compra + entrega no Waxpeer agora que temos o trade link
  if (process.env.WAXPEER_API_KEY) {
    try {
      let bought: { id: string; price: number } | null = null;
      let lastError = '';
      for (let attempt = 1; attempt <= 5; attempt++) {
        const listings = await checkStock(entry.prizeName);
        if (!listings.length) { lastError = 'Item não encontrado no Waxpeer'; break; }
        try {
          const result = await buyItem(listings[0], tradeLink, entry.id);
          bought = { id: String(result.id), price: listings[0].price };
          break;
        } catch (err) {
          lastError = String(err);
          console.log('[chat-trade-link] tentativa', attempt, 'falhou:', lastError);
          if (attempt < 5) await new Promise(r => setTimeout(r, 500));
        }
      }

      if (bought) {
        await prisma.raffleHistory.update({
          where: { id: entry.id },
          data: { marketplaceItemId: bought.id, deliveryStatus: 'item_comprado' },
        });
        console.log(`[chat-trade-link] ${source} | ${winnerName} → item_comprado (${bought.id})`);
      } else {
        await prisma.raffleHistory.update({
          where: { id: entry.id },
          data: { deliveryStatus: 'erro_compra' },
        });
        console.log(`[chat-trade-link] ${source} | ${winnerName} → erro_compra: ${lastError}`);
      }
    } catch (err) {
      console.error('[chat-trade-link] erro inesperado:', err);
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { deliveryStatus: 'erro_compra' },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, source });
}
