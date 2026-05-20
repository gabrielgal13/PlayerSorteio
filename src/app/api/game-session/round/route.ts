import { NextRequest } from 'next/server';
import { startRound, endRound, isAcceptingGuesses } from '@/lib/gameSession';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const { active } = await req.json() as { active: boolean };
  if (active) {
    startRound();
  } else {
    endRound();
  }
  return Response.json({ active: isAcceptingGuesses() }, { headers: CORS_HEADERS });
}
