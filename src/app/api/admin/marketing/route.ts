import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // use raw SQL to bypass any Prisma model mapping issues
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
    console.error('[marketing GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageData, label } = await req.json();
    if (!imageData) return NextResponse.json({ error: 'imageData obrigatório' }, { status: 400 });

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "MarketingImage"
    `;
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
    console.error('[marketing POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
