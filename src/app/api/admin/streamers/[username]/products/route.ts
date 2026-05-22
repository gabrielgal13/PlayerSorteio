import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_LIST_NAME = '__admin_products__';

async function getOrCreateAdminList(streamerId: string) {
  let list = await prisma.prizeList.findFirst({
    where: { streamerId, name: ADMIN_LIST_NAME },
  });
  if (!list) {
    list = await prisma.prizeList.create({
      data: { streamerId, name: ADMIN_LIST_NAME, visibility: 'private' },
    });
  }
  return list;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
  if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });

  const list = await prisma.prizeList.findFirst({
    where: { streamerId: streamer.id, name: ADMIN_LIST_NAME },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json(list?.items ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
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
