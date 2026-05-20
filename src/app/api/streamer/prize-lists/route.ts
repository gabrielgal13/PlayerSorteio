import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/streamer/prize-lists?username=xxx
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json([]);

  const lists = await prisma.prizeList.findMany({
    where: { streamerId: streamer.id },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(lists);
}

// POST /api/streamer/prize-lists
// body: { username, name, description?, visibility?, coverUrl?, items: Prize[] }
export async function POST(req: NextRequest) {
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

// PUT /api/streamer/prize-lists?id=xxx
// body: { username, name?, description?, visibility?, coverUrl?, items?: Prize[] }
export async function PUT(req: NextRequest) {
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

// DELETE /api/streamer/prize-lists?id=xxx&username=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const username = req.nextUrl.searchParams.get('username');
  if (!id || !username) return NextResponse.json({ error: 'id and username required' }, { status: 400 });

  const streamer = await prisma.streamer.findUnique({ where: { username } });
  if (!streamer) return NextResponse.json({ ok: true });

  await prisma.prizeList.deleteMany({ where: { id, streamerId: streamer.id } });
  return NextResponse.json({ ok: true });
}
