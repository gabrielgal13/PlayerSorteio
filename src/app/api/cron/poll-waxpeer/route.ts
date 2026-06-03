import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  checkStock,
  buyItem,
  checkTradesByProjectId,
  checkTradesById,
  classifyTradeStatus,
  type WaxpeerTradeStatus,
} from '@/lib/waxpeer';

/* ── Configuração ────────────────────────────────────────────────────── */

// Quantas re-compras automáticas antes de desistir e marcar erro_entrega.
const MAX_RETRIES = 3;
// Máximo de entregas pendentes processadas por tick (evita estouro de timeout).
const BATCH_SIZE = 50;
// Idade máxima de uma compra ainda em `item_comprado` antes de considerar perdida.
// Waxpeer dá ~5min pro vendedor mandar a oferta + tempo de aceitação na Steam.
// 30min cobre confortavelmente esse intervalo.
const MAX_PENDING_AGE_MS = 30 * 60 * 1000;

/* ── Handler ─────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  // Mesmo pattern dos outros crons: Vercel manda Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.WAXPEER_API_KEY) {
    return NextResponse.json({ ok: false, error: 'WAXPEER_API_KEY não configurada' });
  }

  // Pega todas as compras em `item_comprado` com marketplaceItemId definido.
  const pending = await prisma.raffleHistory.findMany({
    where: {
      deliveryStatus: 'item_comprado',
      marketplaceItemId: { not: null },
    },
    orderBy: { timestamp: 'desc' },
    take: BATCH_SIZE,
  });

  if (!pending.length) {
    return NextResponse.json({ ok: true, checked: 0, delivered: 0, retried: 0, failed: 0 });
  }

  const projectIds = pending.map(p => p.id);
  // Tenta primeiro pelo project_id (preferencial — historyId).
  let trades: WaxpeerTradeStatus[] = await checkTradesByProjectId(projectIds);

  // Fallback: compras antigas (sem project_id) — consulta pelo marketplaceItemId.
  if (trades.length < pending.length) {
    const covered = new Set(trades.map(t => t.project_id).filter(Boolean));
    const missingIds = pending
      .filter(p => !covered.has(p.id))
      .map(p => p.marketplaceItemId!)
      .filter(Boolean);
    if (missingIds.length) {
      const byId = await checkTradesById(missingIds);
      trades = trades.concat(byId);
    }
  }

  // Indexa por project_id e id da Waxpeer pra match rápido.
  const byProjectId = new Map<string, WaxpeerTradeStatus>();
  const byTradeId = new Map<string, WaxpeerTradeStatus>();
  for (const t of trades) {
    if (t.project_id) byProjectId.set(t.project_id, t);
    if (t.id !== undefined && t.id !== null) byTradeId.set(String(t.id), t);
  }

  let delivered = 0;
  let retried = 0;
  let failed = 0;
  const now = new Date();

  for (const entry of pending) {
    const trade =
      byProjectId.get(entry.id) ??
      (entry.marketplaceItemId ? byTradeId.get(entry.marketplaceItemId) : undefined);

    // Nenhum registro na Waxpeer ainda — fica pendente (próximo tick tenta de novo).
    if (!trade) {
      // Se já passou muito tempo, considera perdida e tenta re-comprar / falha.
      const age = Date.now() - entry.timestamp.getTime();
      if (age > MAX_PENDING_AGE_MS) {
        console.log(`[poll-waxpeer] ${entry.id} sem registro na Waxpeer após ${Math.round(age / 60000)}min — tentando retry`);
        const ok = await retryPurchase(entry);
        if (ok) retried++;
        else failed++;
      } else {
        await prisma.raffleHistory.update({
          where: { id: entry.id },
          data: { marketplaceCheckedAt: now },
        });
      }
      continue;
    }

    const outcome = classifyTradeStatus(trade);

    if (outcome.kind === 'delivered') {
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { deliveryStatus: 'entregue', marketplaceCheckedAt: now },
      });
      console.log(`[poll-waxpeer] ${entry.id} (${entry.winnerName} | ${entry.prizeName}) → entregue`);
      delivered++;
      continue;
    }

    if (outcome.kind === 'failed') {
      console.log(`[poll-waxpeer] ${entry.id} falhou: ${outcome.reason} — retries=${entry.marketplaceRetries}`);
      const ok = await retryPurchase(entry);
      if (ok) retried++;
      else failed++;
      continue;
    }

    // pending — só registra que checamos
    await prisma.raffleHistory.update({
      where: { id: entry.id },
      data: { marketplaceCheckedAt: now },
    });
  }

  return NextResponse.json({
    ok: true,
    checked: pending.length,
    delivered,
    retried,
    failed,
  });
}

/**
 * Tenta re-comprar o item (mesmo prizeName/tradeLink, novo listing).
 * Sem reembolso de PSC: o usuário já pagou e queremos entregar.
 * Após `MAX_RETRIES` tentativas falhadas seguidas, marca `erro_entrega`.
 */
async function retryPurchase(entry: {
  id: string;
  prizeName: string;
  tradeLink: string | null;
  marketplaceRetries: number;
  winnerName: string;
}): Promise<boolean> {
  if (!entry.tradeLink) {
    await prisma.raffleHistory.update({
      where: { id: entry.id },
      data: { deliveryStatus: 'erro_entrega', marketplaceCheckedAt: new Date() },
    });
    return false;
  }

  if (entry.marketplaceRetries >= MAX_RETRIES) {
    console.log(`[poll-waxpeer] ${entry.id} esgotou retries (${entry.marketplaceRetries}) — erro_entrega`);
    await prisma.raffleHistory.update({
      where: { id: entry.id },
      data: { deliveryStatus: 'erro_entrega', marketplaceCheckedAt: new Date() },
    });
    return false;
  }

  try {
    const listings = await checkStock(entry.prizeName);
    if (!listings.length) {
      console.log(`[poll-waxpeer] ${entry.id} sem stock no Waxpeer pra retry`);
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: {
          marketplaceRetries: { increment: 1 },
          marketplaceCheckedAt: new Date(),
        },
      });
      return false;
    }

    const result = await buyItem(listings[0], entry.tradeLink, entry.id);
    await prisma.raffleHistory.update({
      where: { id: entry.id },
      data: {
        marketplaceItemId: String(result.id),
        marketplaceRetries: { increment: 1 },
        marketplaceCheckedAt: new Date(),
        // deliveryStatus permanece em `item_comprado` (próximo tick verifica de novo)
      },
    });
    console.log(`[poll-waxpeer] ${entry.id} re-comprado (retry #${entry.marketplaceRetries + 1}) → ${result.id}`);
    return true;
  } catch (err) {
    console.log(`[poll-waxpeer] ${entry.id} retry falhou:`, String(err));
    await prisma.raffleHistory.update({
      where: { id: entry.id },
      data: {
        marketplaceRetries: { increment: 1 },
        marketplaceCheckedAt: new Date(),
      },
    });
    return false;
  }
}
