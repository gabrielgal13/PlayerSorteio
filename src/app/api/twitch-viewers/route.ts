import type { NextRequest } from 'next/server';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' },
  );

  if (!res.ok) throw new Error('Falha ao obter token Twitch');

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.value;
}

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel');
  if (!channel) return Response.json({ error: 'channel required' }, { status: 400 });

  try {
    const token = await getAppToken();
    const headers = {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    };

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      { headers, next: { revalidate: 0 } },
    );

    if (!res.ok) return Response.json({ error: 'Erro Twitch API' }, { status: 502 });

    const data = await res.json();
    const stream = data.data?.[0];

    return Response.json({
      isLive: Boolean(stream),
      viewerCount: stream?.viewer_count ?? 0,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
