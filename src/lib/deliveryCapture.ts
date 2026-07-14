import { prisma } from './prisma';
import { getDeliveryMode, type DeliveryMode } from './prizeDelivery';

export const WINNER_CUTOFF_MS = 6 * 60 * 60 * 1000; // 6h
export const STEAM_LINK_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;

// Mensagens de "camisa" viram texto livre — exige um mínimo de caracteres para
// não confundir uma linha de chat qualquer com o endereço real.
export const MIN_ADDRESS_LENGTH = 15;

// "PrizeListItem".pinned e "RaffleHistory".deliveryAddress são colunas bolt-on
// (fora do client tipado) — garantimos a coluna antes de ler/escrever nela.
let deliveryAddressColumnReady = false;
export async function ensureDeliveryAddressColumn() {
  if (deliveryAddressColumnReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "RaffleHistory" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT`
  );
  deliveryAddressColumnReady = true;
}

export interface PendingDelivery {
  id: string;
  prizeName: string;
  marketplaceItemId: string | null;
  mode: DeliveryMode;
}

// Localiza a entrega pendente de um ganhador (por nome, últimas 6h, ainda não
// finalizada) e retorna o "modo" de coleta esperado com base no nome do prêmio.
// Retorna null quando não há pendência ou quando ela já foi preenchida.
export async function findPendingDelivery(params: {
  winnerName: string;
  source: 'twitch' | 'kick' | 'youtube';
  streamerId?: string;
}): Promise<PendingDelivery | null> {
  await ensureDeliveryAddressColumn();
  const cutoff = new Date(Date.now() - WINNER_CUTOFF_MS);
  const entry = await prisma.raffleHistory.findFirst({
    where: {
      winnerName: { equals: params.winnerName, mode: 'insensitive' },
      deliveryStatus: { notIn: ['entregue', 'tradelocked'] },
      timestamp: { gte: cutoff },
      OR: [{ winnerSource: params.source }, { winnerSource: null }],
      ...(params.streamerId ? { streamerId: params.streamerId } : {}),
    },
    orderBy: { timestamp: 'desc' },
  });
  if (!entry) return null;

  const mode = getDeliveryMode(entry.prizeName);
  if (mode === 'trade_link') {
    if (entry.tradeLink) return null; // já preenchido
  } else {
    const rows = await prisma.$queryRaw<Array<{ deliveryAddress: string | null }>>`
      SELECT "deliveryAddress" FROM "RaffleHistory" WHERE id = ${entry.id}
    `;
    if (rows[0]?.deliveryAddress) return null; // já preenchido
  }

  return { id: entry.id, prizeName: entry.prizeName, marketplaceItemId: entry.marketplaceItemId, mode };
}

export async function saveDeliveryAddress(historyId: string, address: string) {
  await ensureDeliveryAddressColumn();
  await prisma.$executeRaw`
    UPDATE "RaffleHistory"
    SET "deliveryAddress" = ${address}, "deliveryStatus" = 'endereco_recebido'
    WHERE id = ${historyId}
  `;
}
