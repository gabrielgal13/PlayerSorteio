import { NextRequest } from 'next/server';
import { addGuess, getGuesses, clearGuesses, isAcceptingGuesses, isParticipant } from '@/lib/gameSession';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return Response.json(getGuesses(), { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; source?: 'twitch' | 'kick' | 'youtube'; text?: string };
  const { name, source, text } = body;

  if (!name || !source || !text) {
    return Response.json({ error: 'name, source, text required' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!isParticipant(name)) {
    return Response.json({ error: 'not a registered participant' }, { status: 403, headers: CORS_HEADERS });
  }
  if (!isAcceptingGuesses()) {
    return Response.json({ error: 'not accepting guesses right now' }, { status: 409, headers: CORS_HEADERS });
  }

  // Register guess immediately so SSE fires without waiting for geocoding
  const g = addGuess(name, source, text, null, null);
  if (!g) {
    return Response.json({ error: 'already guessed this round' }, { status: 409, headers: CORS_HEADERS });
  }

  // Geocode in background — updates the in-memory guess object with coords for WorldGuessr
  (async () => {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'WorldGuessr-ChatGame/1.0 (contato: gabriel.galiano13@gmail.com)',
            'Accept-Language': 'pt-BR,pt,en',
          },
        },
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

  return Response.json(g, { status: 201, headers: CORS_HEADERS });
}

export async function DELETE() {
  clearGuesses();
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
