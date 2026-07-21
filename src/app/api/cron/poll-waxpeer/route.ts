import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  checkTradesByProjectId,
  checkTradesById,
  classifyTradeStatus,
  type WaxpeerTradeStatus,
} from '@/lib/waxpeer';

/* ── Configuração ────────────────────────────────────────────────────── */

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
  let failed = 0;
  const now = new Date();

  for (const entry of pending) {
    const trade =
      byProjectId.get(entry.id) ??
      (entry.marketplaceItemId ? byTradeId.get(entry.marketplaceItemId) : undefined);

    // Nenhum registro na Waxpeer ainda — fica pendente (próximo tick tenta de novo).
    if (!trade) {
      const age = Date.now() - entry.timestamp.getTime();
      if (age > MAX_PENDING_AGE_MS) {
        console.log(`[poll-waxpeer] ${entry.id} sem registro na Waxpeer após ${Math.round(age / 60000)}min`);
        await markDeliveryError(entry.id, 'sem registro na Waxpeer');
        failed++;
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
      console.log(`[poll-waxpeer] ${entry.id} falhou: ${outcome.reason}`);
      await markDeliveryError(entry.id, outcome.reason);
      failed++;
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
    failed,
  });
}

/**
 * Marca a entrega como `erro_entrega` pra revisão manual.
 *
 * Antes daqui saía uma re-compra automática na Waxpeer (dinheiro real, até 3x
 * por item). Como a classificação de status da Waxpeer não é confiável o
 * bastante — chegou a tratar entrega concluída como falha — nenhuma compra é
 * disparada sozinha: quem decide re-comprar é uma pessoa, olhando o registro.
 */
async function markDeliveryError(id: string, reason?: string) {
  await prisma.raffleHistory.update({
    where: { id },
    data: { deliveryStatus: 'erro_entrega', marketplaceCheckedAt: new Date() },
  });
  console.log(`[poll-waxpeer] ${id} → erro_entrega (${reason ?? 'sem motivo'}) — revisar na mão`);
}

