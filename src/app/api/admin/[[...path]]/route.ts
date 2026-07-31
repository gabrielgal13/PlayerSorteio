import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ensureDeliveryAddressColumn, notifyWinnerDelivered } from '@/lib/deliveryCapture';
import { signToken, sessionCookieOptions } from '@/lib/auth';
import { buildSessionProfile } from '@/lib/sessionProfile';

const ADMIN_LIST_NAME = '__admin_products__';

// Produto fixo padrão: sempre disponível para todo streamer, começa com quantidade 0.
const DEFAULT_FIXED_PRODUCT_NAME = 'Camisa PlayerSkins';

// Garante que a tabela de produtos fixos (templates globais) existe e tem o item padrão.
let fixedProductsTableReady = false;
async function ensureFixedProductsTable() {
  if (fixedProductsTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FixedProduct" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "imageUrl" TEXT,
      "pscValue" INTEGER,
      "skipPsc" BOOLEAN NOT NULL DEFAULT false,
      "locked" BOOLEAN NOT NULL DEFAULT false,
      "order" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
    )
  `);
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "FixedProduct" WHERE name = ${DEFAULT_FIXED_PRODUCT_NAME}
  `;
  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "FixedProduct" (id, name, locked, "order")
      VALUES (${randomUUID()}, ${DEFAULT_FIXED_PRODUCT_NAME}, true, 0)
    `;
  }
  fixedProductsTableReady = true;
}

// Garante a coluna "pinned" em PrizeListItem — marca um produto exclusivo como
// destacado (fixo) somente para o streamer dono do item, sem afetar os demais.
let pinnedColumnReady = false;
async function ensurePinnedColumn() {
  if (pinnedColumnReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PrizeListItem" ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false`
  );
  pinnedColumnReady = true;
}

// Garante que as tabelas de propostas e vendas existam (sem depender de migration manual).
let affiliateTableReady = false;
async function ensureAffiliateTable() {
  if (affiliateTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AffiliateProposal" (
      "id" TEXT PRIMARY KEY,
      "streamerName" TEXT NOT NULL,
      "profitPct" DOUBLE PRECISION NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "accountConfirmed" BOOLEAN NOT NULL DEFAULT false,
      "shirtsConfirmed" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
    )
  `);
  // Colunas adicionadas depois — garante compatibilidade com tabelas já criadas.
  await prisma.$executeRawUnsafe(`ALTER TABLE "AffiliateProposal" ADD COLUMN IF NOT EXISTS "coupon" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AffiliateProposal" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3)`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE "AffiliateProposal" ADD COLUMN IF NOT EXISTS "contractMonths" INTEGER`).catch(() => {});
  affiliateTableReady = true;
}

// Versão do schema para invalidar cache quando mudar
const saleTableSchemaVersion = 4;
let saleTableReadyVersion = -1;
async function ensureSaleTable() {
  if (saleTableReadyVersion === saleTableSchemaVersion) return;
  try {
    // Tenta remover a constraint UNIQUE antiga (se existir)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_orderNumber_key"
    `).catch(() => {});

    // Cria a tabela se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Sale" (
        "id" TEXT PRIMARY KEY,
        "orderNumber" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "contactName" TEXT NOT NULL,
        "cpfCnpj" TEXT NOT NULL,
        "email" TEXT,
        "city" TEXT,
        "state" TEXT,
        "productDescription" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "totalPrice" DOUBLE PRECISION NOT NULL,
        "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'Em aberto',
        "affiliateUsername" TEXT,
        "trackingCode" TEXT,
        "observations" TEXT,
        "source" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        UNIQUE("orderNumber", "productDescription")
      )
    `);
    // Adiciona colunas se não existirem (para tabelas já criadas)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "affiliateUsername" TEXT`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "observations" TEXT`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "source" TEXT`).catch(() => {});
  } catch {
    // Tabela pode ter sido criada com constraint diferente, tenta atualizar
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Sale" ADD CONSTRAINT "Sale_orderNumber_productDescription_key"
        UNIQUE("orderNumber", "productDescription")
      `).catch(() => {});
    } catch {}
  }
  saleTableReadyVersion = saleTableSchemaVersion;
}

async function getOrCreateAdminList(streamerId: string) {
  let list = await prisma.prizeList.findFirst({ where: { streamerId, name: ADMIN_LIST_NAME } });
  if (!list) {
    list = await prisma.prizeList.create({
      data: { streamerId, name: ADMIN_LIST_NAME, visibility: 'private' },
    });
  }
  return list;
}

// GET /api/admin/streamers
// GET /api/admin/streamers/[username]/products
// GET /api/admin/marketing
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

  // GET /api/admin/streamers
  if (seg0 === 'streamers' && !seg1) {
    const streamers = await prisma.streamer.findMany({
      where: { isAdmin: false },
      select: { username: true, displayName: true, pscBalance: true, isAffiliate: true, testProfile: true },
      orderBy: { username: 'asc' },
    });
    return NextResponse.json(streamers);
  }

  // GET /api/admin/streamers/[username]/products
  if (seg0 === 'streamers' && seg1 && seg2 === 'products') {
    const username = seg1;
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const list = await prisma.prizeList.findFirst({
      where: { streamerId: streamer.id, name: ADMIN_LIST_NAME },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!list) return NextResponse.json([]);
    await ensurePinnedColumn();
    const pinnedRows = await prisma.$queryRaw<Array<{ id: string; pinned: boolean }>>`
      SELECT id, pinned FROM "PrizeListItem" WHERE "prizeListId" = ${list.id}
    `;
    const pinnedMap = new Map(pinnedRows.map(r => [r.id, r.pinned]));
    return NextResponse.json(list.items.map(item => ({ ...item, pinned: pinnedMap.get(item.id) ?? false })));
  }

  // GET /api/admin/fixed-products — templates globais (ex.: Camisa PlayerSkins) disponíveis para todo streamer
  if (seg0 === 'fixed-products' && !seg1) {
    await ensureFixedProductsTable();
    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string; description: string | null; imageUrl: string | null;
      pscValue: number | null; skipPsc: boolean; locked: boolean; order: number;
    }>>`
      SELECT id, name, description, "imageUrl", "pscValue", "skipPsc", locked, "order"
      FROM "FixedProduct"
      ORDER BY "order" ASC, "createdAt" ASC
    `;
    return NextResponse.json(rows);
  }

  // GET /api/admin/streamers/[username]/bot-commands
  if (seg0 === 'streamers' && seg1 && seg2 === 'bot-commands') {
    const username = seg1;
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const commands = await prisma.botCommand.findMany({
      where: { streamerId: streamer.id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(commands);
  }

  // GET /api/admin/streamers/[username]
  if (seg0 === 'streamers' && seg1 && !seg2) {
    const streamer = await prisma.streamer.findUnique({
      where: { username: seg1 },
      select: {
        username: true, displayName: true, pscBalance: true, isAffiliate: true, testProfile: true,
        themeColor: true, twitchChannel: true, kickChannel: true, youtubeChannel: true,
        forcePasswordChange: true, chatWarsSprite: true, chatWarsBossSprite: true, twitchAffiliateEnabled: true,
      },
    });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    return NextResponse.json(streamer);
  }

  // GET /api/admin/deliveries — all RaffleHistory across all streamers with stats
  if (seg0 === 'deliveries' && !seg1) {
    const filter = _req.nextUrl.searchParams.get('filter') ?? 'all';
    const errorStatuses = ['erro_tradelink', 'erro_entrega', 'erro_compra'];
    const pendingStatuses = ['novo', 'aguardando_tradelink', 'item_comprado', 'aguardando_endereco', 'endereco_recebido'];
    const notDeliveredStatuses = ['novo', 'aguardando_tradelink', 'item_comprado', 'tradelocked', 'aguardando_endereco', 'endereco_recebido', 'erro_tradelink', 'erro_entrega', 'erro_compra'];

    // Perfis de teste ficam fora da visão oficial — some da lista e dos contadores.
    const realStreamer = { streamer: { testProfile: false } };

    const where = {
      ...realStreamer,
      ...(filter === 'pending'       ? { deliveryStatus: { in: pendingStatuses } }
        : filter === 'error'         ? { deliveryStatus: { in: errorStatuses } }
        : filter === 'undelivered'   ? { deliveryStatus: { in: notDeliveredStatuses } }
        : {}),
    };

    const [rows, totalPending, totalError, totalUndelivered] = await Promise.all([
      prisma.raffleHistory.findMany({
        where,
        include: { streamer: { select: { username: true, displayName: true } } },
        orderBy: { timestamp: 'desc' },
        take: 500,
      }),
      prisma.raffleHistory.count({ where: { ...realStreamer, deliveryStatus: { in: pendingStatuses } } }),
      prisma.raffleHistory.count({ where: { ...realStreamer, deliveryStatus: { in: errorStatuses } } }),
      prisma.raffleHistory.count({ where: { ...realStreamer, deliveryStatus: { in: notDeliveredStatuses } } }),
    ]);

    await ensureDeliveryAddressColumn();
    const addrRows = rows.length > 0
      ? await prisma.$queryRaw<Array<{ id: string; deliveryAddress: string | null }>>`
          SELECT id, "deliveryAddress" FROM "RaffleHistory" WHERE id = ANY(${rows.map(r => r.id)})
        `
      : [];
    const addressMap = new Map(addrRows.map(r => [r.id, r.deliveryAddress]));

    const items = rows.map(r => ({
      id: r.id,
      winnerName: r.winnerName,
      winnerSource: r.winnerSource,
      prizeName: r.prizeName,
      prizeDescription: r.prizeDescription,
      prizeImageUrl: r.prizeImageUrl,
      prizePscValue: r.prizePscValue,
      tradeLink: r.tradeLink,
      deliveryAddress: addressMap.get(r.id) ?? null,
      deliveryStatus: r.deliveryStatus,
      tradeLockAt: r.tradeLockAt?.getTime() ?? null,
      timestamp: r.timestamp.getTime(),
      streamerUsername: r.streamer.username,
      streamerDisplayName: r.streamer.displayName,
    }));

    return NextResponse.json({
      items,
      counts: { pending: totalPending, error: totalError, undelivered: totalUndelivered, total: rows.length },
    });
  }

  // GET /api/admin/marketing/random — public endpoint (rewritten from /api/marketing/random)
  if (seg0 === 'marketing' && seg1 === 'random') {
    try {
      const images = await prisma.$queryRaw<Array<{ id: number; imageData: string; label: string | null }>>`
        SELECT id, "imageData", label FROM "MarketingImage" WHERE active = true
      `;
      if (images.length === 0) return NextResponse.json(null);
      const random = images[Math.floor(Math.random() * images.length)];
      return NextResponse.json(random);
    } catch {
      return NextResponse.json(null);
    }
  }

  // GET /api/admin/marketing
  if (seg0 === 'marketing' && !seg1) {
    try {
      const images = await prisma.$queryRaw<Array<{
        id: number; imageData: string; label: string | null;
        active: boolean; order: number; createdAt: Date;
      }>>`
        SELECT id, "imageData", label, active, "order", "createdAt"
        FROM "MarketingImage"
        ORDER BY "order" ASC, "createdAt" ASC
      `;
      return NextResponse.json(images);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // GET /api/admin/affiliate-proposals
  if (seg0 === 'affiliate-proposals') {
    try {
      await ensureAffiliateTable();
      const rows = await prisma.affiliateProposal.findMany({ orderBy: { createdAt: 'desc' } });
      return NextResponse.json(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // GET /api/admin/sales
  if (seg0 === 'sales') {
    try {
      await ensureSaleTable();
      const rows = await prisma.sale.findMany({ orderBy: { createdAt: 'desc' } });
      return NextResponse.json(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // GET /api/admin/bot-config
  if (seg0 === 'bot-config') {
    const row = await prisma.appConfig.findUnique({ where: { key: 'bot_messages_muted' } });
    return NextResponse.json({ muted: row?.value === 'true' });
  }

  // GET /api/admin/games-config
  if (seg0 === 'games-config') {
    const row = await prisma.appConfig.findUnique({ where: { key: 'games_disabled' } });
    let disabled: string[] = [];
    try { disabled = row ? JSON.parse(row.value) : []; } catch { disabled = []; }
    return NextResponse.json({ disabled });
  }

  // GET /api/admin/find-affiliate?name=...
  if (seg0 === 'find-affiliate') {
    try {
      const name = _req.nextUrl.searchParams.get('name');
      if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });

      // Procura streamer pelo campo "nome" (nome real do streamer)
      const streamers = await prisma.streamer.findMany({
        where: { isAffiliate: true },
        select: { username: true, displayName: true, nome: true },
      });

      const target = name.trim().toLowerCase();
      const found = streamers.find(s => {
        // Primeiro tenta pelo campo "nome"
        if (s.nome && s.nome.trim().toLowerCase() === target) return true;
        // Se não encontrar, tenta pelo displayName (extrai nome antes do ())
        const displayBaseName = (s.displayName || '').split('(')[0].trim().toLowerCase();
        return displayBaseName === target;
      });

      if (!found) return NextResponse.json({ error: 'Afiliado não encontrado.' }, { status: 404 });
      return NextResponse.json(found);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// POST /api/admin/psc
// POST /api/admin/streamers
// POST /api/admin/streamers/[username]/products
// POST /api/admin/marketing
// POST /api/admin/test-mode
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

  // POST /api/admin/test-mode  { username }
  // Troca a sessão do admin por uma sessão do streamer marcada como testMode.
  // A partir daí o middleware recusa toda escrita — o admin vê a conta exatamente
  // como o streamer configurou, mas nada do que fizer chega no banco.
  if (seg0 === 'test-mode' && !seg1) {
    const adminUsername = req.headers.get('x-session-username');
    if (!adminUsername) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { username } = await req.json() as { username?: string };
    if (!username?.trim())
      return NextResponse.json({ error: 'Informe o streamer.' }, { status: 400 });

    const streamer = await prisma.streamer.findFirst({
      where: { username: { equals: username.trim(), mode: 'insensitive' } },
    });
    if (!streamer)
      return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    if (streamer.isAdmin)
      return NextResponse.json({ error: 'Não dá pra testar uma conta de admin.' }, { status: 400 });

    const token = await signToken({
      username: streamer.username,
      isAdmin: false,
      testMode: true,
      adminUsername,
    });
    const res = NextResponse.json({ ...buildSessionProfile(streamer), testMode: true });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  }

  // POST /api/admin/affiliate-proposals
  if (seg0 === 'affiliate-proposals') {
    try {
      await ensureAffiliateTable();
      const { streamerName, profitPct, coupon, contractMonths } = await req.json();
      if (!streamerName?.trim())
        return NextResponse.json({ error: 'Nome do streamer é obrigatório.' }, { status: 400 });
      const pct = Number(profitPct);
      if (!Number.isFinite(pct) || pct <= 0)
        return NextResponse.json({ error: 'Porcentagem inválida.' }, { status: 400 });
      const months = Number(contractMonths);
      const created = await prisma.affiliateProposal.create({
        data: {
          streamerName: streamerName.trim(),
          profitPct: pct,
          coupon: typeof coupon === 'string' && coupon.trim() ? coupon.trim() : null,
          contractMonths: Number.isFinite(months) && months > 0 ? Math.round(months) : null,
        },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // POST /api/admin/sales/upload
  if (seg0 === 'sales' && seg1 === 'upload') {
    try {
      await ensureSaleTable();
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return NextResponse.json({ error: 'Arquivo CSV é obrigatório.' }, { status: 400 });

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) return NextResponse.json({ error: 'CSV vazio ou inválido.' }, { status: 400 });

      // Parse CSV respeitando aspas
      function parseCSVLine(line: string): string[] {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      }

      // Helper para converter valor monetário (ex: " 45,00" -> 45.00)
      function parsePrice(val: string): number {
        if (!val) return 0;
        return parseFloat(val.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
      }

      // Parse header
      const headerCols = parseCSVLine(lines[0]);
      const headers = headerCols.map(h => h.toLowerCase());

      const numIdx = headers.findIndex(h => h.includes('número do pedido'));
      const dateIdx = headers.findIndex(h => h.includes('data') && !h.includes('data prevista'));
      const nameIdx = headers.findIndex(h => h.includes('nome do contato'));
      const cpfIdx = headers.findIndex(h => h.includes('cpf/cnpj'));
      const emailIdx = headers.findIndex(h => h.includes('e-mail'));
      const cityIdx = headers.findIndex(h => h.includes('município') && !h.includes('entrega'));
      const stateIdx = headers.findIndex(h => h.includes('uf') && !h.includes('entrega'));
      const descIdx = headers.findIndex(h => h.includes('descrição'));
      const qtyIdx = headers.findIndex(h => h.includes('quantidade'));
      const unitPriceIdx = headers.findIndex(h => h.includes('valor unitário'));
      const discountIdx = headers.findIndex(h => h.includes('desconto do pedido') || h.includes('desconto item'));
      const freightIdx = headers.findIndex(h => h.includes('frete'));
      const statusIdx = headers.findIndex(h => h.includes('situação'));
      const trackingIdx = headers.findIndex(h => h.includes('código de rastreamento'));

      if (numIdx === -1 || nameIdx === -1 || descIdx === -1) {
        return NextResponse.json({ error: 'CSV faltando colunas obrigatórias (Número do pedido, Nome do contato, Descrição).' }, { status: 400 });
      }

      // Parse rows e deduplicar
      const existingSales = await prisma.sale.findMany({
        select: { orderNumber: true, productDescription: true }
      });
      const existingKeys = new Set(
        existingSales.map(s => `${s.orderNumber}|${s.productDescription}`)
      );
      const processedThisUpload = new Set<string>();
      const sales = [];
      let duplicateCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const orderNumber = cols[numIdx]?.trim();
        const productDesc = cols[descIdx]?.trim() || '';
        if (!orderNumber) continue;

        // Chave única composta: orderNumber + productDescription
        const uniqueKey = `${orderNumber}|${productDesc}`;

        if (existingKeys.has(uniqueKey) || processedThisUpload.has(uniqueKey)) {
          duplicateCount++;
          continue;
        }

        processedThisUpload.add(uniqueKey);
        const unitPrice = parsePrice(cols[unitPriceIdx] || '0');
        const qty = parseInt(cols[qtyIdx] || '1') || 1;
        const totalPrice = unitPrice * qty;

        const saleData = {
          orderNumber,
          date: cols[dateIdx] || '',
          contactName: cols[nameIdx] || '',
          cpfCnpj: cols[cpfIdx] || '',
          email: cols[emailIdx] || null,
          city: cols[cityIdx] || null,
          state: cols[stateIdx] || null,
          productDescription: cols[descIdx] || '',
          quantity: qty,
          unitPrice,
          totalPrice,
          discount: parsePrice(cols[discountIdx] || '0'),
          shipping: parsePrice(cols[freightIdx] || '0'),
          status: cols[statusIdx] || 'Em aberto',
          trackingCode: cols[trackingIdx] || null,
        };

        sales.push(prisma.sale.create({ data: saleData }));
      }

      // Insert new sales
      const created = await Promise.all(sales);
      return NextResponse.json({ inserted: created.length, duplicates: duplicateCount, sales: created }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // POST /api/admin/sales/manual — lançamento manual de receita/despesa
  if (seg0 === 'sales' && seg1 === 'manual') {
    try {
      await ensureSaleTable();
      const { type, description, value, date, observations, source } = await req.json();
      if (!description?.trim()) return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 });
      const val = Number(value);
      if (!Number.isFinite(val) || val <= 0) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
      const status = type === 'despesa' ? 'Despesa' : 'Receita';
      const created = await prisma.sale.create({
        data: {
          orderNumber: 'MANUAL-' + Date.now(),
          date: (typeof date === 'string' && date.trim()) ? date.trim() : new Date().toLocaleDateString('pt-BR'),
          contactName: 'Lançamento manual',
          cpfCnpj: '',
          productDescription: description.trim(),
          quantity: 1,
          unitPrice: val,
          totalPrice: val,
          status,
          observations: typeof observations === 'string' && observations.trim() ? observations.trim() : null,
          source: source === 'playerskins' ? 'playerskins' : 'vendas',
        },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // POST /api/admin/psc
  if (seg0 === 'psc') {
    const { amount, description } = await req.json();
    if (typeof amount !== 'number') return NextResponse.json({ error: 'invalid amount' }, { status: 400 });
    const streamers = await prisma.streamer.findMany({ where: { isAdmin: false } });
    const desc = description ?? 'Recarga PSC';
    await Promise.all(
      streamers.map(s =>
        prisma.$transaction([
          prisma.streamer.update({ where: { id: s.id }, data: { pscBalance: { increment: amount } } }),
          prisma.pscTransaction.create({ data: { streamerId: s.id, type: 'credit', amount, description: desc } }),
        ])
      )
    );
    return NextResponse.json({ ok: true, updated: streamers.length });
  }

  // POST /api/admin/streamers
  if (seg0 === 'streamers' && !seg1) {
    const { username, displayName, nome, password, mascot, themeColor, raffleEffect, pscBalance, twitchAffiliateEnabled } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: 'Username e senha são obrigatórios.' }, { status: 400 });
    const existing = await prisma.streamer.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (existing) return NextResponse.json({ error: 'Username já existe.' }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 10);
    const streamer = await prisma.streamer.create({
      data: {
        username: username.toLowerCase(),
        displayName: displayName || username,
        nome: nome || null,
        passwordHash,
        mascot: mascot || 'dreads',
        themeColor: themeColor || '#00E5FF',
        eventEffect: raffleEffect || 'confetti',
        pscBalance: typeof pscBalance === 'number' && pscBalance >= 0 ? pscBalance : 0,
        isAdmin: false,
        twitchAffiliateEnabled: twitchAffiliateEnabled === true,
      },
    });
    return NextResponse.json({ username: streamer.username }, { status: 201 });
  }

  // POST /api/admin/streamers/[username]/bot-commands
  if (seg0 === 'streamers' && seg1 && seg2 === 'bot-commands') {
    const username = seg1;
    const { command, response } = await req.json();
    if (!command?.trim() || !response?.trim())
      return NextResponse.json({ error: 'Comando e resposta são obrigatórios.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const cmd = await prisma.botCommand.create({
      data: {
        streamerId: streamer.id,
        command: command.trim(),
        response: response.trim(),
      },
    });
    return NextResponse.json(cmd, { status: 201 });
  }

  // POST /api/admin/streamers/[username]/products
  if (seg0 === 'streamers' && seg1 && seg2 === 'products') {
    const username = seg1;
    const body = await req.json();
    const { name, description, imageUrl, quantity, pscValue, skipPsc, pinned } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const list = await getOrCreateAdminList(streamer.id);
    const count = await prisma.prizeListItem.count({ where: { prizeListId: list.id } });
    const item = await prisma.prizeListItem.create({
      data: {
        prizeListId: list.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        imageUrl: imageUrl ?? null,
        quantity: typeof quantity === 'number' ? quantity : 1,
        pscValue: typeof pscValue === 'number' ? pscValue : null,
        skipPsc: skipPsc === true,
        order: count,
      },
    });
    await ensurePinnedColumn();
    if (pinned === true) {
      await prisma.$executeRaw`UPDATE "PrizeListItem" SET pinned = true WHERE id = ${item.id}`;
    }
    return NextResponse.json({ ...item, pinned: pinned === true }, { status: 201 });
  }

  // POST /api/admin/marketing
  if (seg0 === 'marketing' && !seg1) {
    try {
      const { imageData, label } = await req.json();
      if (!imageData) return NextResponse.json({ error: 'imageData obrigatório' }, { status: 400 });
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "MarketingImage"`;
      const orderVal = Number(countResult[0].count);
      const labelVal = label ?? null;
      const result = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "MarketingImage" ("imageData", label, active, "order", "createdAt")
        VALUES (${imageData}, ${labelVal}, true, ${orderVal}, NOW())
        RETURNING id
      `;
      return NextResponse.json({ id: result[0].id }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // POST /api/admin/bot-config
  if (seg0 === 'bot-config') {
    const { muted } = await req.json() as { muted: boolean };
    await prisma.appConfig.upsert({
      where: { key: 'bot_messages_muted' },
      create: { key: 'bot_messages_muted', value: muted ? 'true' : 'false' },
      update: { value: muted ? 'true' : 'false' },
    });
    return NextResponse.json({ ok: true, muted });
  }

  // POST /api/admin/games-config  { gameId, enabled }
  if (seg0 === 'games-config') {
    const { gameId, enabled } = await req.json() as { gameId: string; enabled: boolean };
    if (!gameId) return NextResponse.json({ error: 'gameId é obrigatório.' }, { status: 400 });
    const row = await prisma.appConfig.findUnique({ where: { key: 'games_disabled' } });
    let disabled: string[] = [];
    try { disabled = row ? JSON.parse(row.value) : []; } catch { disabled = []; }
    disabled = enabled ? disabled.filter(id => id !== gameId) : [...new Set([...disabled, gameId])];
    await prisma.appConfig.upsert({
      where: { key: 'games_disabled' },
      create: { key: 'games_disabled', value: JSON.stringify(disabled) },
      update: { value: JSON.stringify(disabled) },
    });
    return NextResponse.json({ ok: true, disabled });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PATCH /api/admin/streamers/[username]
// PATCH /api/admin/streamers/[username]/products (upsert por nome)
// PATCH /api/admin/marketing/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

  // PATCH /api/admin/fixed-products — ajusta a imagem do template fixo padrão (Camisa PlayerSkins)
  if (seg0 === 'fixed-products' && !seg1) {
    await ensureFixedProductsTable();
    const body = await req.json();
    const { id, imageUrl } = body;
    if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 });
    await prisma.$executeRaw`UPDATE "FixedProduct" SET "imageUrl" = ${imageUrl ?? null} WHERE id = ${id}`;
    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string; description: string | null; imageUrl: string | null;
      pscValue: number | null; skipPsc: boolean; locked: boolean;
    }>>`
      SELECT id, name, description, "imageUrl", "pscValue", "skipPsc", locked FROM "FixedProduct" WHERE id = ${id}
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Produto fixo não encontrado.' }, { status: 404 });
    return NextResponse.json(rows[0]);
  }

  // PATCH /api/admin/streamers/[username]/products — upsert de produto exclusivo por nome
  // Usado pelo item fixo padrão "Camisa PlayerSkins" e pelos itens marcados como
  // "fixo" (pinned) só para este streamer, onde o admin ajusta a quantidade.
  if (seg0 === 'streamers' && seg1 && seg2 === 'products') {
    const username = seg1;
    const body = await req.json();
    const { name, description, imageUrl, quantity, pscValue, skipPsc, pinned } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    if (typeof quantity !== 'number' || quantity < 0)
      return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const list = await getOrCreateAdminList(streamer.id);
    await ensurePinnedColumn();
    const existing = await prisma.prizeListItem.findFirst({ where: { prizeListId: list.id, name: name.trim() } });
    if (existing) {
      const updated = await prisma.prizeListItem.update({
        where: { id: existing.id },
        data: {
          quantity,
          ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
          ...(imageUrl !== undefined ? { imageUrl: imageUrl ?? null } : {}),
          ...(pscValue !== undefined ? { pscValue: typeof pscValue === 'number' ? pscValue : null } : {}),
          ...(skipPsc !== undefined ? { skipPsc: skipPsc === true } : {}),
        },
      });
      if (pinned !== undefined) {
        await prisma.$executeRaw`UPDATE "PrizeListItem" SET pinned = ${pinned === true} WHERE id = ${updated.id}`;
      }
      return NextResponse.json({ ...updated, pinned: pinned === true });
    }
    const count = await prisma.prizeListItem.count({ where: { prizeListId: list.id } });
    const created = await prisma.prizeListItem.create({
      data: {
        prizeListId: list.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        imageUrl: imageUrl ?? null,
        quantity,
        pscValue: typeof pscValue === 'number' ? pscValue : null,
        skipPsc: skipPsc === true,
        order: count,
      },
    });
    if (pinned === true) {
      await prisma.$executeRaw`UPDATE "PrizeListItem" SET pinned = true WHERE id = ${created.id}`;
    }
    return NextResponse.json({ ...created, pinned: pinned === true }, { status: 201 });
  }

  // PATCH /api/admin/affiliate-proposals/[id]
  if (seg0 === 'affiliate-proposals' && seg1) {
    try {
      await ensureAffiliateTable();
      const body = await req.json();
      const data: { status?: string; accountConfirmed?: boolean; shirtsConfirmed?: boolean; startedAt?: Date | null } = {};
      if (body.status !== undefined) {
        if (!['pending', 'accepted', 'refused'].includes(body.status))
          return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
        data.status = body.status;
        // Ao recusar, zera as confirmações secundárias.
        if (body.status === 'refused') { data.accountConfirmed = false; data.shirtsConfirmed = false; }
      }
      if (typeof body.accountConfirmed === 'boolean') data.accountConfirmed = body.accountConfirmed;
      if (typeof body.shirtsConfirmed === 'boolean') data.shirtsConfirmed = body.shirtsConfirmed;
      if (body.startedAt !== undefined) data.startedAt = body.startedAt ? new Date(body.startedAt) : null;
      if (Object.keys(data).length === 0)
        return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
      const updated = await prisma.affiliateProposal.update({ where: { id: seg1 }, data });
      return NextResponse.json(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // PATCH /api/admin/deliveries/[id]
  if (seg0 === 'deliveries' && seg1) {
    const { tradeLink, deliveryStatus, deliveryAddress } = await req.json();
    const data: Record<string, unknown> = {};
    if (tradeLink !== undefined) data.tradeLink = tradeLink || null;
    let justDelivered = false;
    if (deliveryStatus !== undefined) {
      const current = await prisma.raffleHistory.findUnique({
        where: { id: seg1 },
        select: { tradeLockAt: true, deliveryStatus: true },
      });
      data.deliveryStatus = deliveryStatus;
      if (deliveryStatus === 'tradelocked' && !current?.tradeLockAt) data.tradeLockAt = new Date();
      justDelivered = deliveryStatus === 'entregue' && current?.deliveryStatus !== 'entregue';
    }
    if (Object.keys(data).length === 0 && deliveryAddress === undefined)
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    const updated = Object.keys(data).length > 0
      ? await prisma.raffleHistory.update({ where: { id: seg1 }, data })
      : await prisma.raffleHistory.findUnique({ where: { id: seg1 } });
    if (deliveryAddress !== undefined) {
      await ensureDeliveryAddressColumn();
      await prisma.$executeRaw`UPDATE "RaffleHistory" SET "deliveryAddress" = ${deliveryAddress || null} WHERE id = ${seg1}`;
    }
    const delivered = justDelivered ? await notifyWinnerDelivered(seg1) : null;
    return NextResponse.json({ ok: true, tradeLockAt: updated?.tradeLockAt?.getTime() ?? null, delivered });
  }

  // PATCH /api/admin/streamers/[username]
  if (seg0 === 'streamers' && seg1 && !seg2) {
    try {
      const username = seg1;
      const body = await req.json();
      const streamer = await prisma.streamer.findUnique({
        where: { username },
        select: { id: true, pscBalance: true },
      });
      if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
      const updateData: {
        isAffiliate?: boolean; testProfile?: boolean; pscBalance?: number; displayName?: string | null; nome?: string | null;
        passwordHash?: string; forcePasswordChange?: boolean; themeColor?: string;
        twitchChannel?: string | null; kickChannel?: string | null; youtubeChannel?: string | null;
        chatWarsSprite?: string | null; chatWarsBossSprite?: string | null; twitchAffiliateEnabled?: boolean;
        twitchUserId?: string | null; twitchUserAccessToken?: string | null; twitchUserRefreshToken?: string | null;
      } = {};
      if (typeof body.isAffiliate === 'boolean') updateData.isAffiliate = body.isAffiliate;
      if (typeof body.testProfile === 'boolean') updateData.testProfile = body.testProfile;
      if (typeof body.pscBalance === 'number' && body.pscBalance >= 0) {
        updateData.pscBalance = body.pscBalance;
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
      if (body.displayName !== undefined) updateData.displayName = body.displayName || null;
      if (body.nome !== undefined) updateData.nome = body.nome || null;
      if (body.forcePasswordChange === true) {
        updateData.passwordHash = await bcrypt.hash('123', 10);
        updateData.forcePasswordChange = true;
      } else if (typeof body.password === 'string' && body.password.trim()) {
        updateData.passwordHash = await bcrypt.hash(body.password.trim(), 10);
        updateData.forcePasswordChange = false;
      }
      if (typeof body.themeColor === 'string' && body.themeColor) updateData.themeColor = body.themeColor;
      if (body.twitchChannel !== undefined) updateData.twitchChannel = body.twitchChannel || null;
      if (body.kickChannel !== undefined) updateData.kickChannel = body.kickChannel || null;
      if (body.youtubeChannel !== undefined) updateData.youtubeChannel = body.youtubeChannel || null;
      if (body.chatWarsSprite !== undefined) updateData.chatWarsSprite = body.chatWarsSprite || null;
      if (body.chatWarsBossSprite !== undefined) updateData.chatWarsBossSprite = body.chatWarsBossSprite || null;
      if (typeof body.twitchAffiliateEnabled === 'boolean') {
        updateData.twitchAffiliateEnabled = body.twitchAffiliateEnabled;
        // Revogar afiliação limpa o OAuth do streamer — volta pro fluxo manual antigo.
        if (!body.twitchAffiliateEnabled) {
          updateData.twitchUserId = null;
          updateData.twitchUserAccessToken = null;
          updateData.twitchUserRefreshToken = null;
        }
      }
      if (Object.keys(updateData).length === 0)
        return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
      const updated = await prisma.streamer.update({
        where: { username },
        data: updateData,
        select: { username: true, displayName: true, nome: true, pscBalance: true, isAffiliate: true, testProfile: true, themeColor: true, twitchChannel: true, kickChannel: true, youtubeChannel: true, forcePasswordChange: true, twitchAffiliateEnabled: true },
      });
      return NextResponse.json(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // PATCH /api/admin/marketing/[id]
  if (seg0 === 'marketing' && seg1) {
    const idNum = Number(seg1);
    const body = await req.json();
    try {
      if (body.active !== undefined)
        await prisma.$executeRaw`UPDATE "MarketingImage" SET active = ${body.active} WHERE id = ${idNum}`;
      if (body.label !== undefined)
        await prisma.$executeRaw`UPDATE "MarketingImage" SET label = ${body.label} WHERE id = ${idNum}`;
      if (body.order !== undefined)
        await prisma.$executeRaw`UPDATE "MarketingImage" SET "order" = ${body.order} WHERE id = ${idNum}`;
      const updated = await prisma.$queryRaw<Array<{ id: number; active: boolean; label: string | null; order: number }>>`
        SELECT id, active, label, "order" FROM "MarketingImage" WHERE id = ${idNum}
      `;
      return NextResponse.json(updated[0] ?? { id: idNum });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // PATCH /api/admin/sales/[id]
  if (seg0 === 'sales' && seg1) {
    try {
      await ensureSaleTable();
      const body = await req.json();
      const data: {
        status?: string; affiliateUsername?: string | null; observations?: string | null;
        date?: string; contactName?: string; productDescription?: string;
        quantity?: number; unitPrice?: number; totalPrice?: number;
      } = {};

      if (body.status !== undefined) {
        if (!['Em aberto', 'Finalizado', 'Despesa Afiliado', 'Receita', 'Despesa'].includes(body.status))
          return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
        data.status = body.status;
      }

      if (body.affiliateUsername !== undefined) {
        data.affiliateUsername = body.affiliateUsername || null;
      }

      if (body.observations !== undefined) {
        data.observations = body.observations || null;
      }

      if (typeof body.date === 'string' && body.date.trim()) data.date = body.date.trim();
      if (typeof body.contactName === 'string' && body.contactName.trim()) data.contactName = body.contactName.trim();
      if (typeof body.productDescription === 'string' && body.productDescription.trim()) data.productDescription = body.productDescription.trim();
      if (typeof body.quantity === 'number' && body.quantity >= 0) data.quantity = body.quantity;
      if (typeof body.unitPrice === 'number' && body.unitPrice >= 0) data.unitPrice = body.unitPrice;
      if (typeof body.totalPrice === 'number' && body.totalPrice >= 0) data.totalPrice = body.totalPrice;

      if (Object.keys(data).length === 0)
        return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });

      const updated = await prisma.sale.update({ where: { id: seg1 }, data });
      return NextResponse.json(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// DELETE /api/admin/streamers/[username]/products?itemId=xxx
// DELETE /api/admin/marketing/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

  // DELETE /api/admin/streamers/[username]/bot-commands?id=xxx
  if (seg0 === 'streamers' && seg1 && seg2 === 'bot-commands') {
    const username = seg1;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const cmd = await prisma.botCommand.findUnique({ where: { id } });
    if (!cmd || cmd.streamerId !== streamer.id)
      return NextResponse.json({ error: 'Comando não encontrado.' }, { status: 404 });
    await prisma.botCommand.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  // DELETE /api/admin/streamers/[username]/products?itemId=xxx
  if (seg0 === 'streamers' && seg1 && seg2 === 'products') {
    const username = seg1;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId é obrigatório.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const item = await prisma.prizeListItem.findUnique({
      where: { id: itemId },
      include: { prizeList: { select: { streamerId: true, name: true } } },
    });
    if (!item || item.prizeList.streamerId !== streamer.id || item.prizeList.name !== ADMIN_LIST_NAME)
      return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
    await prisma.prizeListItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  }

  // DELETE /api/admin/affiliate-proposals/[id]
  if (seg0 === 'affiliate-proposals' && seg1) {
    try {
      await ensureAffiliateTable();
      await prisma.affiliateProposal.delete({ where: { id: seg1 } });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // DELETE /api/admin/sales/clear?scope=vendas|playerskins (limpa só os dados do dashboard)
  if (seg0 === 'sales' && seg1 === 'clear') {
    try {
      await ensureSaleTable();
      const scope = req.nextUrl.searchParams.get('scope');
      // PlayerSkins limpa só os próprios lançamentos manuais.
      // Vendas limpa as vendas do CSV (source null) + seus lançamentos manuais.
      const deleted = scope === 'playerskins'
        ? await prisma.sale.deleteMany({ where: { source: 'playerskins' } })
        : await prisma.sale.deleteMany({ where: { OR: [{ source: null }, { source: 'vendas' }] } });
      return NextResponse.json({ ok: true, deleted: deleted.count });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // DELETE /api/admin/marketing/[id]
  if (seg0 === 'marketing' && seg1) {
    const idNum = Number(seg1);
    try {
      await prisma.$executeRaw`DELETE FROM "MarketingImage" WHERE id = ${idNum}`;
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
