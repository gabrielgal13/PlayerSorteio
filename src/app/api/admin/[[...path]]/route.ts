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

  // PATCH /api/admin/streamers/[username]
  if (seg0 === 'streamers' && seg1 && !seg2) {
    const username = seg1;
    const body = await req.json();
    const streamer = await prisma.streamer.findUnique({
      where: { username },
      select: { id: true, pscBalance: true },
    });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (typeof body.isAffiliate === 'boolean') data.isAffiliate = body.isAffiliate;
    if (typeof body.pscBalance === 'number' && body.pscBalance >= 0) {
      data.pscBalance = body.pscBalance;
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
    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 });
    const updated = await prisma.streamer.update({
      where: { username },
      data,
      select: { username: true, displayName: true, pscBalance: true, isAffiliate: true },
    });
    return NextResponse.json(updated);
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
