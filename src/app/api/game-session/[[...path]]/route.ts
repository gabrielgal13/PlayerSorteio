import { NextRequest } from 'next/server';
import {
  addParticipant, getParticipants, clearParticipants,
  startRound, endRound, isAcceptingGuesses, getFullState,
  addGuess, getGuesses, clearGuesses, isParticipant, updateGuessLocation,
} from '@/lib/gameSession';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const POLL_INTERVAL_MS = 1500;

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
    return Response.json(await getParticipants(), { headers: CORS });
  }

  if (route === 'stream') {
    const enc = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          if (closed) return;
          try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { closed = true; }
        };

        const initial = await getFullState();
        send({ type: 'init', ...initial });
        let knownNames = new Set(initial.participants.map(p => p.name.toLowerCase()));

        // Vercel Serverless instances don't share memory, so there's no in-process
        // pub/sub to rely on here — poll the shared store instead and diff.
        while (!closed) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
          if (closed) break;
          try {
            const current = await getParticipants();
            for (const p of current) {
              const key = p.name.toLowerCase();
              if (!knownNames.has(key)) {
                knownNames.add(key);
                send({ type: 'add', participant: p });
              }
            }
            if (current.length < knownNames.size) {
              // list was cleared server-side
              knownNames = new Set(current.map(p => p.name.toLowerCase()));
            }
          } catch {
            // transient store error — keep the connection alive, try again next tick
          }
        }
      },
      cancel() { closed = true; },
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
    return Response.json(await getGuesses(), { headers: CORS });
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
    const p = await addParticipant(name, source);
    if (!p)
      return Response.json({ error: 'already registered' }, { status: 409, headers: CORS });
    return Response.json(p, { status: 201, headers: CORS });
  }

  if (route === 'round') {
    const { active } = await req.json() as { active: boolean };
    if (active) await startRound(); else await endRound();
    return Response.json({ active: await isAcceptingGuesses() }, { headers: CORS });
  }

  if (route === 'guesses') {
    const body = await req.json() as { name?: string; source?: 'twitch' | 'kick' | 'youtube'; text?: string };
    const { name, source, text } = body;
    if (!name || !source || !text)
      return Response.json({ error: 'name, source, text required' }, { status: 400, headers: CORS });
    if (!(await isParticipant(name)))
      return Response.json({ error: 'not a registered participant' }, { status: 403, headers: CORS });
    if (!(await isAcceptingGuesses()))
      return Response.json({ error: 'not accepting guesses right now' }, { status: 409, headers: CORS });

    const g = await addGuess(name, source, text, null, null);
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
            await updateGuessLocation(name, parseFloat(geoData[0].lat!), parseFloat(geoData[0].lon!));
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
    await clearParticipants();
    return new Response(null, { status: 204, headers: CORS });
  }

  if (route === 'guesses') {
    await clearGuesses();
    return new Response(null, { status: 204, headers: CORS });
  }

  return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
}
