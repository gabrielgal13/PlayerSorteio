import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const images = await prisma.marketingImage.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, active: true, order: true, createdAt: true, imageData: true },
    });
    return NextResponse.json(images);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[marketing GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageData, label } = await req.json();
    if (!imageData) return NextResponse.json({ error: 'imageData obrigatório' }, { status: 400 });

    const count = await prisma.marketingImage.count();
    const image = await prisma.marketingImage.create({
      data: { imageData, label: label ?? null, order: count },
    });
    return NextResponse.json(image, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[marketing POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
