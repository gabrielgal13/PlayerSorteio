import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { active, label, order } = await req.json();
  const image = await prisma.marketingImage.update({
    where: { id: Number(id) },
    data: {
      ...(active !== undefined && { active }),
      ...(label !== undefined && { label }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(image);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.marketingImage.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
