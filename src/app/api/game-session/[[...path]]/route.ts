import { NextRequest } from 'next/server';
import {
  addParticipant, getParticipants, clearParticipants,
  startRound, endRound, isAcceptingGuesses,
  subscribe, getFullState, GameEvent,
  addGuess, getGuesses, clearGuesses, isParticipant,
} from '@/lib/gameSession';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (!route) {
    return Response.json(getParticipants(), { headers: CORS });
  }

  if (route === 'stream') {
    const enc = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    const stream = new ReadableStream({
      start(controller) {
        const init = JSON.stringify({ type: 'init', ...getFullState() });
        controller.enqueue(enc.encode(`data: ${init}\n\n`));
        unsubscribe = subscribe((e: GameEvent) => {
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* disconnected */ }
        });
      },
      cancel() { unsubscribe?.(); },
    });
    return new Response(stream, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  if (route === 'guesses') {
    return Response.json(getGuesses(), { headers: CORS });
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (!route) {
    const body = await req.json() as { name?: string; source?: 'twitch' | 'kick' | 'youtube' };
    const { name, source } = body;
    if (!name || !source)
      return Response.json({ error: 'name and source are required' }, { status: 400, headers: CORS });
    const p = addParticipant(name, source);
    if (!p)
      return Response.json({ error: 'already registered' }, { status: 409, headers: CORS });
    return Response.json(p, { status: 201, headers: CORS });
  }

  if (route === 'round') {
    const { active } = await req.json() as { active: boolean };
    if (active) startRound(); else endRound();
    return Response.json({ active: isAcceptingGuesses() }, { headers: CORS });
  }

  if (route === 'guesses') {
    const body = await req.json() as { name?: string; source?: 'twitch' | 'kick' | 'youtube'; text?: string };
    const { name, source, text } = body;
    if (!name || !source || !text)
      return Response.json({ error: 'name, source, text required' }, { status: 400, headers: CORS });
    if (!isParticipant(name))
      return Response.json({ error: 'not a registered participant' }, { status: 403, headers: CORS });
    if (!isAcceptingGuesses())
      return Response.json({ error: 'not accepting guesses right now' }, { status: 409, headers: CORS });

    const g = addGuess(name, source, text, null, null);
    if (!g)
      return Response.json({ error: 'already guessed this round' }, { status: 409, headers: CORS });

    (async () => {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'WorldGuessr-ChatGame/1.0 (contato: gabriel.galiano13@gmail.com)', 'Accept-Language': 'pt-BR,pt,en' } },
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json() as { lat?: string; lon?: string }[];
          if (geoData[0]) {
            g.lat = parseFloat(geoData[0].lat!);
            g.lng = parseFloat(geoData[0].lon!);
            g.geocoded = true;
          }
        }
      } catch { /* geocode failed */ }
    })();

    return Response.json(g, { status: 201, headers: CORS });
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (!route) {
    clearParticipants();
    return new Response(null, { status: 204, headers: CORS });
  }

  if (route === 'guesses') {
    clearGuesses();
    return new Response(null, { status: 204, headers: CORS });
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
}
