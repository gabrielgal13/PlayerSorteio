import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const idNum = Number(id);

  try {
    if (body.active !== undefined) {
      await prisma.$executeRaw`UPDATE "MarketingImage" SET active = ${body.active} WHERE id = ${idNum}`;
    }
    if (body.label !== undefined) {
      await prisma.$executeRaw`UPDATE "MarketingImage" SET label = ${body.label} WHERE id = ${idNum}`;
    }
    if (body.order !== undefined) {
      await prisma.$executeRaw`UPDATE "MarketingImage" SET "order" = ${body.order} WHERE id = ${idNum}`;
    }
    const updated = await prisma.$queryRaw<Array<{ id: number; active: boolean; label: string | null; order: number }>>`
      SELECT id, active, label, "order" FROM "MarketingImage" WHERE id = ${idNum}
    `;
    return NextResponse.json(updated[0] ?? { id: idNum });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  try {
    await prisma.$executeRaw`DELETE FROM "MarketingImage" WHERE id = ${idNum}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
