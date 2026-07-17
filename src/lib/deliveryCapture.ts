import { prisma } from './prisma';
import { getDeliveryMode, type DeliveryMode } from './prizeDelivery';

export const WINNER_CUTOFF_MS = 6 * 60 * 60 * 1000; // 6h
export const STEAM_LINK_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;

// Mensagens de "camisa" viram texto livre — exige um mínimo de caracteres para
// não confundir uma linha de chat qualquer com o endereço real.
export const MIN_ADDRESS_LENGTH = 15;

// ── Validação de campos do endereço ─────────────────────────────────────────
// O ganhador de uma "Camisa" precisa mandar o endereço nesse formato:
//   Rua:
//   Numero:
//   Bairro:
//   Estado:
//   CEP:
//   Camiseta:   (só quando o prêmio exige escolha de camiseta)
// Cada campo é "detectado" checando se o rótulo (ou, no caso do CEP, o
// próprio padrão numérico) aparece em algum lugar da mensagem.
interface AddressFieldDef {
  label: string;
  test: (text: string) => boolean;
}

const ADDRESS_FIELDS: AddressFieldDef[] = [
  { label: 'Rua', test: (t) => /\brua\b/i.test(t) },
  { label: 'Numero', test: (t) => /\bn[uú]mero\b/i.test(t) || /\bn[ºo°]\.?\s*\d/i.test(t) },
  { label: 'Bairro', test: (t) => /\bbairro\b/i.test(t) },
  { label: 'Estado', test: (t) => /\bestado\b/i.test(t) },
  { label: 'CEP', test: (t) => /\bcep\b/i.test(t) || /\b\d{5}-?\d{3}\b/.test(t) },
];

const SHIRT_FIELD: AddressFieldDef = { label: 'Camiseta', test: (t) => /\bcamis(a|eta)\b/i.test(t) };

function getRequiredAddressFields(mode: DeliveryMode): AddressFieldDef[] {
  return mode === 'address_and_shirt' ? [...ADDRESS_FIELDS, SHIRT_FIELD] : ADDRESS_FIELDS;
}

// Retorna os rótulos que faltam na mensagem (lista vazia = endereço completo).
export function findMissingAddressFields(text: string, mode: DeliveryMode): string[] {
  return getRequiredAddressFields(mode).filter(f => !f.test(text)).map(f => f.label);
}

function addressFormatTemplate(mode: DeliveryMode): string {
  const lines = ['Rua:', 'Numero:', 'Bairro:', 'Estado:', 'CEP:'];
  if (mode === 'address_and_shirt') lines.push('Camiseta:');
  return lines.join('\n');
}

// Mensagem pedindo o endereço pela primeira vez (whisper enviado assim que o
// ganhador é anunciado, ou primeira resposta quando ele chama o bot).
export function buildAddressRequestMessage(mode: DeliveryMode): string {
  return `Parabéns pela Camisa! 🎁 Pra eu providenciar o envio, me manda o endereço completo nesse formato:\n${addressFormatTemplate(mode)}`;
}

// Mensagem apontando o que faltou preencher, reforçando o formato esperado.
export function buildMissingFieldsMessage(missing: string[], mode: DeliveryMode): string {
  return `Faltou informar: ${missing.join(', ')}. Manda de novo com tudo, nesse formato:\n${addressFormatTemplate(mode)}`;
}

// Mensagem final de confirmação, quando todos os campos foram encontrados.
export function buildAddressConfirmationMessage(mode: DeliveryMode): string {
  const what = mode === 'address_and_shirt' ? 'Endereço e camiseta confirmados' : 'Endereço confirmado';
  return `${what}! ✅ Sua camisa será enviada o mais rápido possível. 🎁`;
}

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
