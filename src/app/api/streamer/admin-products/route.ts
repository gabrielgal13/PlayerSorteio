import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_LIST_NAME = '__admin_products__';

export async function GET(req: NextRequest) {
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
