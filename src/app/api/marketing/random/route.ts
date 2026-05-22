import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const images = await prisma.marketingImage.findMany({
    where: { active: true },
    select: { id: true, imageData: true, label: true },
  });
  if (images.length === 0) return NextResponse.json(null);
  const random = images[Math.floor(Math.random() * images.length)];
  return NextResponse.json(random);
}
