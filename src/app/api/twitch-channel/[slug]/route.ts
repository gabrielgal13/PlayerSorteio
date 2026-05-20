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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  try {
    const token = await getAppToken();
    const headers = {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    };

    const userRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(slug)}`,
      { headers },
    );

    if (!userRes.ok) return Response.json({ error: 'Erro ao consultar Twitch' }, { status: 502 });

    const userData = await userRes.json();
    if (!userData.data?.length) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });

    const user = userData.data[0];

    const streamRes = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(slug)}`,
      { headers },
    );

    let isLive = false;
    if (streamRes.ok) {
      const streamData = await streamRes.json();
      isLive = streamData.data?.length > 0;
    }

    return Response.json({
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      isLive,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
