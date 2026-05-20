import { NextRequest } from 'next/server';
import { addParticipant, getParticipants, clearParticipants } from '@/lib/gameSession';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return Response.json(getParticipants(), { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; source?: 'twitch' | 'kick' | 'youtube' };
  const { name, source } = body;
  if (!name || !source) {
    return Response.json({ error: 'name and source are required' }, { status: 400, headers: CORS_HEADERS });
  }
  const p = addParticipant(name, source);
  if (!p) {
    return Response.json({ error: 'already registered' }, { status: 409, headers: CORS_HEADERS });
  }
  return Response.json(p, { status: 201, headers: CORS_HEADERS });
}

export async function DELETE() {
  clearParticipants();
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
