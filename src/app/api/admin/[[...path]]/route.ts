import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const ADMIN_LIST_NAME = '__admin_products__';

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
      select: { username: true, displayName: true, pscBalance: true, isAffiliate: true },
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
    return NextResponse.json(list?.items ?? []);
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
        username: true, displayName: true, pscBalance: true, isAffiliate: true,
        themeColor: true, twitchChannel: true, kickChannel: true, youtubeChannel: true,
        forcePasswordChange: true,
      },
    });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    return NextResponse.json(streamer);
  }

  // GET /api/admin/deliveries — all RaffleHistory across all streamers with stats
  if (seg0 === 'deliveries' && !seg1) {
    const filter = _req.nextUrl.searchParams.get('filter') ?? 'all';
    const errorStatuses = ['erro_tradelink', 'erro_entrega', 'erro_compra'];
    const pendingStatuses = ['novo', 'aguardando_tradelink', 'item_comprado'];
    const notDeliveredStatuses = ['novo', 'aguardando_tradelink', 'item_comprado', 'tradelocked', 'erro_tradelink', 'erro_entrega', 'erro_compra'];

    const where =
      filter === 'pending'     ? { deliveryStatus: { in: pendingStatuses } }
      : filter === 'error'     ? { deliveryStatus: { in: errorStatuses } }
      : filter === 'undelivered' ? { deliveryStatus: { in: notDeliveredStatuses } }
      : {};

    const [rows, totalPending, totalError, totalUndelivered] = await Promise.all([
      prisma.raffleHistory.findMany({
        where,
        include: { streamer: { select: { username: true, displayName: true } } },
        orderBy: { timestamp: 'desc' },
        take: 500,
      }),
      prisma.raffleHistory.count({ where: { deliveryStatus: { in: pendingStatuses } } }),
      prisma.raffleHistory.count({ where: { deliveryStatus: { in: errorStatuses } } }),
      prisma.raffleHistory.count({ where: { deliveryStatus: { in: notDeliveredStatuses } } }),
    ]);

    const items = rows.map(r => ({
      id: r.id,
      winnerName: r.winnerName,
      winnerSource: r.winnerSource,
      prizeName: r.prizeName,
      prizeDescription: r.prizeDescription,
      prizeImageUrl: r.prizeImageUrl,
      prizePscValue: r.prizePscValue,
      tradeLink: r.tradeLink,
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

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// POST /api/admin/psc
// POST /api/admin/streamers
// POST /api/admin/streamers/[username]/products
// POST /api/admin/marketing
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

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
    const { username, displayName, password, mascot, themeColor, raffleEffect, pscBalance } = await req.json();
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
        passwordHash,
        mascot: mascot || 'dreads',
        themeColor: themeColor || '#00E5FF',
        eventEffect: raffleEffect || 'confetti',
        pscBalance: typeof pscBalance === 'number' && pscBalance >= 0 ? pscBalance : 0,
        isAdmin: false,
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
    const { name, description, imageUrl, quantity, pscValue, skipPsc } = body;
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
    return NextResponse.json(item, { status: 201 });
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

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PATCH /api/admin/streamers/[username]
// PATCH /api/admin/marketing/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1, seg2] = path ?? [];

  // PATCH /api/admin/deliveries/[id]
  if (seg0 === 'deliveries' && seg1) {
    const { tradeLink, deliveryStatus } = await req.json();
    const data: Record<string, unknown> = {};
    if (tradeLink !== undefined) data.tradeLink = tradeLink || null;
    if (deliveryStatus !== undefined) {
      data.deliveryStatus = deliveryStatus;
      if (deliveryStatus === 'tradelocked') {
        const current = await prisma.raffleHistory.findUnique({ where: { id: seg1 }, select: { tradeLockAt: true } });
        if (!current?.tradeLockAt) data.tradeLockAt = new Date();
      }
    }
    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    const updated = await prisma.raffleHistory.update({ where: { id: seg1 }, data });
    return NextResponse.json({ ok: true, tradeLockAt: updated.tradeLockAt?.getTime() ?? null });
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
        isAffiliate?: boolean; pscBalance?: number; displayName?: string | null;
        passwordHash?: string; forcePasswordChange?: boolean; themeColor?: string;
        twitchChannel?: string | null; kickChannel?: string | null; youtubeChannel?: string | null;
      } = {};
      if (typeof body.isAffiliate === 'boolean') updateData.isAffiliate = body.isAffiliate;
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
      if (Object.keys(updateData).length === 0)
        return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
      const updated = await prisma.streamer.update({
        where: { username },
        data: updateData,
        select: { username: true, displayName: true, pscBalance: true, isAffiliate: true, themeColor: true, twitchChannel: true, kickChannel: true, youtubeChannel: true, forcePasswordChange: true },
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
