import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem } from '@/lib/waxpeer';
import {
  findPendingDelivery,
  saveDeliveryAddress,
  STEAM_LINK_REGEX,
  findMissingAddressFields,
  buildMissingFieldsMessage,
  buildAddressConfirmationMessage,
} from '@/lib/deliveryCapture';

export async function POST(req: NextRequest) {
  const { winnerName, text, source } = await req.json() as {
    winnerName: string;
    text: string;
    source: 'youtube' | 'kick';
  };

  if (!winnerName?.trim() || !text?.trim()) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 });
  }

  const pending = await findPendingDelivery({ winnerName, source });
  if (!pending) {
    return NextResponse.json({ ok: false, error: 'Nenhuma entrega pendente para esse usuário' });
  }

  // ── Prêmio físico (Camisa) — coleta endereço (e camisa escolhida) em vez de trade link ──
  // O nick já veio conferido pelo findPendingDelivery acima (só acha entrega
  // pendente pro nick exato do ganhador) — mensagens de outra pessoa caem no
  // "Nenhuma entrega pendente" logo no início desta função.
  if (pending.mode !== 'trade_link') {
    const missing = findMissingAddressFields(text.trim(), pending.mode);
    if (missing.length > 0) {
      return NextResponse.json({
        ok: true,
        complete: false,
        source,
        mode: pending.mode,
        missing,
        message: buildMissingFieldsMessage(missing, pending.mode),
      });
    }
    await saveDeliveryAddress(pending.id, text.trim());
    return NextResponse.json({
      ok: true,
      complete: true,
      source,
      mode: pending.mode,
      message: buildAddressConfirmationMessage(pending.mode),
    });
  }

  if (!STEAM_LINK_REGEX.test(text)) {
    return NextResponse.json({ ok: false, error: 'Link inválido' });
  }
  const tradeLink = text;

  await prisma.raffleHistory.update({
    where: { id: pending.id },
    data: { tradeLink },
  });

  // Compra + entrega no Waxpeer agora que temos o trade link
  if (process.env.WAXPEER_API_KEY) {
    try {
      let bought: { id: string; price: number } | null = null;
      let lastError = '';
      for (let attempt = 1; attempt <= 5; attempt++) {
        const listings = await checkStock(pending.prizeName);
        if (!listings.length) { lastError = 'Item não encontrado no Waxpeer'; break; }
        try {
          const result = await buyItem(listings[0], tradeLink, pending.id);
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
          where: { id: pending.id },
          data: { marketplaceItemId: bought.id, deliveryStatus: 'item_comprado' },
        });
        console.log(`[chat-trade-link] ${source} | ${winnerName} → item_comprado (${bought.id})`);
      } else {
        await prisma.raffleHistory.update({
          where: { id: pending.id },
          data: { deliveryStatus: 'erro_compra' },
        });
        console.log(`[chat-trade-link] ${source} | ${winnerName} → erro_compra: ${lastError}`);
      }
    } catch (err) {
      console.error('[chat-trade-link] erro inesperado:', err);
      await prisma.raffleHistory.update({
        where: { id: pending.id },
        data: { deliveryStatus: 'erro_compra' },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, source, mode: pending.mode });
}
