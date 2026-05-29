import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const ADMIN_LIST_NAME = '__admin_products__';

// GET /api/streamer/config?username=xxx
// GET /api/streamer/history?username=xxx
// GET /api/streamer/psc-history?username=xxx&days=30
// GET /api/streamer/prize-lists?username=xxx
// GET /api/streamer/admin-products  (header: x-session-username)
// GET /api/streamer/bot-commands?username=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'config') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json(null);
    return NextResponse.json({
      twitchChannel: streamer.twitchChannel,
      registrationCommand: streamer.registrationCommand,
      claimCommand: streamer.claimCommand,
      validationTimeout: streamer.validationTimeout,
    });
  }

  if (route === 'history') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json([]);
    const rows = await prisma.raffleHistory.findMany({
      where: { streamerId: streamer.id },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      winner: { id: r.id, number: r.winnerNumber, name: r.winnerName, source: r.winnerSource ?? undefined },
      prize: {
        id: r.id,
        name: r.prizeName,
        description: r.prizeDescription ?? undefined,
        imageUrl: r.prizeImageUrl ?? undefined,
        quantity: r.prizeQuantity,
        order: 0,
        pscValue: r.prizePscValue ?? undefined,
      },
      streamer: username,
      timestamp: r.timestamp.getTime(),
      confirmed: r.confirmed,
      tradeLink: r.tradeLink ?? undefined,
      deliveryStatus: (r.deliveryStatus ?? 'novo') as import('@/types').DeliveryStatus,
      tradeLockAt: r.tradeLockAt?.getTime() ?? undefined,
      marketplaceItemId: r.marketplaceItemId ?? undefined,
    })));
  }

  if (route === 'psc-history') {
    const username = req.nextUrl.searchParams.get('username');
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '0', 10);
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ entries: [], balance: 0 });

    const since = days > 0 ? new Date(Date.now() - days * 86400_000) : undefined;
    const dateFilter = since ? { gte: since } : undefined;

    let rawCredits: Awaited<ReturnType<typeof prisma.pscTransaction.findMany>> = [];
    try {
      rawCredits = await prisma.pscTransaction.findMany({
        where: { streamerId: streamer.id, ...(dateFilter ? { timestamp: dateFilter } : {}) },
        orderBy: { timestamp: 'desc' },
      });
    } catch { /* model not yet loaded */ }

    const rawDebits = await prisma.raffleHistory.findMany({
      where: {
        streamerId: streamer.id,
        prizePscValue: { gt: 0 },
        ...(dateFilter ? { timestamp: dateFilter } : {}),
      },
      orderBy: { timestamp: 'desc' },
    });

    type Entry = { id: string; type: 'credit' | 'debit'; amount: number; description: string; timestamp: number };
    const entries: Entry[] = [
      ...rawCredits.map(c => ({ id: c.id, type: 'credit' as const, amount: c.amount, description: c.description, timestamp: c.timestamp.getTime() })),
      ...rawDebits.map(d => ({ id: d.id, type: 'debit' as const, amount: d.prizePscValue!, description: d.prizeName, timestamp: d.timestamp.getTime() })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ entries, balance: streamer.pscBalance });
  }

  if (route === 'prize-lists') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json([]);
    const lists = await prisma.prizeList.findMany({
      where: { streamerId: streamer.id, NOT: { name: ADMIN_LIST_NAME } },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(lists);
  }

  if (route === 'admin-products') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const list = await prisma.prizeList.findFirst({
      where: { streamerId: streamer.id, name: ADMIN_LIST_NAME },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(list?.items ?? []);
  }

  if (route === 'bot-commands') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json([]);
    const commands = await prisma.botCommand.findMany({
      where: { streamerId: streamer.id },
      select: { id: true, command: true, response: true },
    });
    return NextResponse.json(commands);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// POST /api/streamer/history
// POST /api/streamer/prize-lists
// POST /api/streamer/change-password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'history') {
    const { username, result } = await req.json();
    if (!username || !result) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    await prisma.raffleHistory.create({
      data: {
        ...(result.id ? { id: result.id } : {}),
        streamerId: streamer.id,
        winnerNumber: result.winner.number,
        winnerName: result.winner.name,
        winnerSource: result.winner.source ?? null,
        prizeName: result.prize.name,
        prizeDescription: result.prize.description ?? null,
        prizeImageUrl: result.prize.imageUrl ?? null,
        prizeQuantity: result.prize.quantity,
        prizePscValue: result.prize.pscValue ?? null,
        confirmed: result.confirmed,
        timestamp: new Date(result.timestamp),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'change-password') {
    const { username, newPassword } = await req.json();
    if (!username || !newPassword?.trim())
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.streamer.update({
      where: { username },
      data: { passwordHash, forcePasswordChange: false },
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'prize-lists') {
    const { username, name, description, visibility, coverUrl, items } = await req.json();
    if (!username || !name) return NextResponse.json({ error: 'username and name required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const list = await prisma.prizeList.create({
      data: {
        streamerId: streamer.id,
        name,
        description: description ?? null,
        visibility: visibility ?? 'public',
        coverUrl: coverUrl ?? null,
        items: {
          create: (items ?? []).map((p: { name: string; description?: string; imageUrl?: string; quantity: number; pscValue?: number; skipPsc?: boolean; order: number }, i: number) => ({
            name: p.name,
            description: p.description ?? null,
            imageUrl: p.imageUrl ?? null,
            quantity: p.quantity,
            pscValue: p.pscValue ?? null,
            skipPsc: p.skipPsc ?? false,
            order: p.order ?? i,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PUT /api/streamer/prize-lists?id=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'prize-lists') {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { username, name, description, visibility, coverUrl, items } = await req.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const existing = await prisma.prizeList.findFirst({ where: { id, streamerId: streamer.id } });
    if (!existing) return NextResponse.json({ error: 'list not found' }, { status: 404 });
    await prisma.prizeListItem.deleteMany({ where: { prizeListId: id } });
    const list = await prisma.prizeList.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description !== undefined ? (description ?? null) : existing.description,
        visibility: visibility ?? existing.visibility,
        coverUrl: coverUrl !== undefined ? (coverUrl ?? null) : existing.coverUrl,
        items: {
          create: (items ?? []).map((p: { name: string; description?: string; imageUrl?: string; quantity: number; pscValue?: number; skipPsc?: boolean; order: number }, i: number) => ({
            name: p.name,
            description: p.description ?? null,
            imageUrl: p.imageUrl ?? null,
            quantity: p.quantity,
            pscValue: p.pscValue ?? null,
            skipPsc: p.skipPsc ?? false,
            order: p.order ?? i,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PATCH /api/streamer/balance
// PATCH /api/streamer/config
// PATCH /api/streamer/preferences
// PATCH /api/streamer/delivery
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'balance') {
    const { username, pscBalance } = await req.json();
    if (!username || pscBalance === undefined)
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    const streamer = await prisma.streamer.update({ where: { username }, data: { pscBalance } });
    return NextResponse.json({ pscBalance: streamer.pscBalance });
  }

  if (route === 'config') {
    const body = await req.json();
    const { username, ...config } = body;
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.update({ where: { username }, data: config });
    return NextResponse.json({
      twitchChannel: streamer.twitchChannel,
      registrationCommand: streamer.registrationCommand,
      claimCommand: streamer.claimCommand,
      validationTimeout: streamer.validationTimeout,
    });
  }

  if (route === 'preferences') {
    const { username, ...prefs } = await req.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.upsert({
      where: { username },
      update: prefs,
      create: { username, passwordHash: '', ...prefs },
    });
    return NextResponse.json({
      audioEnabled: streamer.audioEnabled,
      excelImportEnabled: streamer.excelImportEnabled,
      excelPrizesImportEnabled: streamer.excelPrizesImportEnabled,
      eventMusic: streamer.eventMusic,
      eventEffect: streamer.eventEffect,
      spinEffect: streamer.spinEffect,
      themeColor: streamer.themeColor,
      socoChuteModeEnabled: streamer.socoChuteModeEnabled,
      raffleTriggerMode: streamer.raffleTriggerMode,
      autoRoundDelay: streamer.autoRoundDelay,
      chatTriggerCount: streamer.chatTriggerCount,
      chatTriggerCommand: streamer.chatTriggerCommand,
      raffleAnimationStyle: streamer.raffleAnimationStyle,
    });
  }

  if (route === 'delivery') {
    const { historyId, tradeLink, deliveryStatus } = await req.json();
    if (!historyId) return NextResponse.json({ error: 'historyId required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (tradeLink !== undefined) data.tradeLink = tradeLink || null;
    if (deliveryStatus !== undefined) {
      data.deliveryStatus = deliveryStatus;
      if (deliveryStatus === 'tradelocked') {
        const current = await prisma.raffleHistory.findUnique({ where: { id: historyId }, select: { tradeLockAt: true } });
        if (!current?.tradeLockAt) data.tradeLockAt = new Date();
      }
    }
    const updated = await prisma.raffleHistory.update({ where: { id: historyId }, data });
    return NextResponse.json({ ok: true, tradeLockAt: updated.tradeLockAt?.getTime() ?? null });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// DELETE /api/streamer/history?username=xxx
// DELETE /api/streamer/prize-lists?id=xxx&username=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'history') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ ok: true });
    await prisma.raffleHistory.deleteMany({ where: { streamerId: streamer.id } });
    return NextResponse.json({ ok: true });
  }

  if (route === 'prize-lists') {
    const id = req.nextUrl.searchParams.get('id');
    const username = req.nextUrl.searchParams.get('username');
    if (!id || !username) return NextResponse.json({ error: 'id and username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ ok: true });
    await prisma.prizeList.deleteMany({ where: { id, streamerId: streamer.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
