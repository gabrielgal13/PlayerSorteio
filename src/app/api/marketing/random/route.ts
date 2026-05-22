import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
