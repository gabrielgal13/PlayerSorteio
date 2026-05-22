import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const images = await prisma.marketingImage.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, active: true, order: true, createdAt: true, imageData: true },
  });
  return NextResponse.json(images);
}

export async function POST(req: NextRequest) {
  const { imageData, label } = await req.json();
  if (!imageData) return NextResponse.json({ error: 'imageData obrigatório' }, { status: 400 });

  const count = await prisma.marketingImage.count();
  const image = await prisma.marketingImage.create({
    data: { imageData, label: label ?? null, order: count },
  });
  return NextResponse.json(image, { status: 201 });
}
