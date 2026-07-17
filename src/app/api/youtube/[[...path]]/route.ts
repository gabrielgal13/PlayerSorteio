import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDeliveryMode } from '@/lib/prizeDelivery';

function getOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return `http://${host}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

async function refreshYoutubeToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) return null;
  await prisma.appConfig.upsert({
    where: { key: 'youtube_bot_access_token' },
    create: { key: 'youtube_bot_access_token', value: data.access_token },
    update: { value: data.access_token },
  });
  return data.access_token;
}

async function getYoutubeTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: ['youtube_bot_access_token', 'youtube_bot_refresh_token'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return { access: map['youtube_bot_access_token'] ?? null, refresh: map['youtube_bot_refresh_token'] ?? null };
}

async function getLiveChatId(youtubeHandle: string): Promise<string | null> {
  const API_KEY = process.env.YOUTUBE_API_KEY!;
  const cleanHandle = youtubeHandle.replace(/^@/, '');

  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(cleanHandle)}&key=${API_KEY}`,
  );
  if (!channelRes.ok) return null;
  const channelData = await channelRes.json() as { items?: { id: string }[] };
  const channelId = channelData.items?.[0]?.id;
  if (!channelId) return null;

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&eventType=live&type=video&part=id&key=${API_KEY}`,
  );
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json() as { items?: { id: { videoId: string } }[] };
  const videoId = searchData.items?.[0]?.id?.videoId;
  if (!videoId) return null;

  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=liveStreamingDetails&key=${API_KEY}`,
  );
  if (!videoRes.ok) return null;
  const videoData = await videoRes.json() as { items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[] };
  return videoData.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
}

async function sendMessage(liveChatId: string, message: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: {
        type: 'textMessageEvent',
        liveChatId,
        textMessageDetails: { messageText: message },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
    return { ok: false, error: err.error?.message };
  }
  return { ok: true };
}

async function sendWithRefresh(liveChatId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { access, refresh } = await getYoutubeTokens();
  if (!access && !refresh) return { ok: false, error: 'Bot YouTube não autenticado' };

  let token = access;
  if (!token && refresh) token = await refreshYoutubeToken(refresh);
  if (!token) return { ok: false, error: 'Falha ao renovar token YouTube' };

  let result = await sendMessage(liveChatId, message, token);
  if (!result.ok && refresh) {
    const newToken = await refreshYoutubeToken(refresh);
    if (newToken) result = await sendMessage(liveChatId, message, newToken);
  }
  return result;
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0] = path ?? [];

  if (seg0 === 'status') {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['youtube_bot_access_token', 'youtube_bot_channel_name'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return NextResponse.json({
      connected: Boolean(map['youtube_bot_access_token']),
      channelName: map['youtube_bot_channel_name'] ?? null,
    });
  }

  if (seg0 === 'auth') {
    if (!process.env.YOUTUBE_CLIENT_ID)
      return NextResponse.json({ error: 'YOUTUBE_CLIENT_ID não configurado no .env' }, { status: 503 });
    const origin = getOrigin(req);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.YOUTUBE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', `${origin}/api/youtube/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.force-ssl');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return NextResponse.redirect(authUrl.toString());
  }

  if (seg0 === 'callback') {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'OAuth cancelado' }, { status: 400 });

    const origin = getOrigin(req);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/youtube/callback`,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return NextResponse.json({ error: `Falha OAuth Google: ${err}` }, { status: 502 });
    }
    const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string };

    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    const channelData = await channelRes.json() as { items?: { snippet?: { title?: string } }[] };
    const channelName = channelData.items?.[0]?.snippet?.title ?? 'Conta YouTube';

    const upserts = [
      prisma.appConfig.upsert({ where: { key: 'youtube_bot_access_token' }, create: { key: 'youtube_bot_access_token', value: tokenData.access_token }, update: { value: tokenData.access_token } }),
      prisma.appConfig.upsert({ where: { key: 'youtube_bot_channel_name' }, create: { key: 'youtube_bot_channel_name', value: channelName }, update: { value: channelName } }),
    ];
    if (tokenData.refresh_token) {
      upserts.push(prisma.appConfig.upsert({ where: { key: 'youtube_bot_refresh_token' }, create: { key: 'youtube_bot_refresh_token', value: tokenData.refresh_token }, update: { value: tokenData.refresh_token } }));
    }
    await Promise.all(upserts);

    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:monospace;padding:2rem;background:#0a0a0a;color:#FF0000">
      <h2>✅ Bot YouTube conectado!</h2>
      <p>Conta: <strong>${channelName}</strong></p>
      <p>Mensagens de ganhador serão enviadas no chat do YouTube automaticamente.</p>
      <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0] = path ?? [];

  if (seg0 === 'send') {
    const { youtubeHandle, message } = await req.json() as { youtubeHandle: string; message: string };
    if (!youtubeHandle || !message?.trim())
      return NextResponse.json({ ok: false, error: 'youtubeHandle e message são obrigatórios' }, { status: 400 });

    const liveChatId = await getLiveChatId(youtubeHandle);
    if (!liveChatId)
      return NextResponse.json({ ok: false, error: 'Canal não está ao vivo ou sem liveChatId' });

    const result = await sendWithRefresh(liveChatId, message.trim());
    return NextResponse.json(result);
  }

  if (seg0 === 'notify') {
    const { youtubeHandle, winnerName, prizeName, winnerSource } = await req.json() as { youtubeHandle: string; winnerName: string; prizeName?: string; winnerSource?: string | null };
    if (!youtubeHandle || !winnerName)
      return NextResponse.json({ ok: false, error: 'youtubeHandle e winnerName são obrigatórios' }, { status: 400 });

    const muteRow = await prisma.appConfig.findUnique({ where: { key: 'bot_messages_muted' } });
    if (muteRow?.value === 'true') return NextResponse.json({ ok: true, muted: true });

    const liveChatId = await getLiveChatId(youtubeHandle);
    if (!liveChatId)
      return NextResponse.json({ ok: false, error: 'Canal não está ao vivo' });

    const greetings = ['parabéns', 'gg', 'show de bola', 'incrível', 'mandou bem', 'topzera'];
    const emojis = ['🎉', '🏆', '🎁', '⭐', '🔥', '💎', '🚀', '👑'];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    const e1 = emojis[Math.floor(Math.random() * emojis.length)];
    const e2 = emojis[Math.floor(Math.random() * emojis.length)];
    const prizePart = prizeName ? ` levou ${prizeName.replace(/\s*\(.*?\)/g, '').trim()}` : '';
    const botName = process.env.TWITCH_BOT_USERNAME ?? 'PlayerSkinsBOT';
    const isYoutubeWinner = !winnerSource || winnerSource === 'youtube';
    const deliveryMode = prizeName ? getDeliveryMode(prizeName) : 'trade_link';
    const askText = deliveryMode === 'address_and_shirt'
      ? 'seu endereço no formato Rua/Numero/Bairro/Estado/CEP e a Camiseta que você quer'
      : deliveryMode === 'address'
      ? 'seu endereço no formato Rua/Numero/Bairro/Estado/CEP'
      : 'seu Steam trade link';
    const instruction = isYoutubeWinner
      ? ` | Para receber, marque @${botName} aqui no chat com ${askText}!`
      : '';
    const message = `${e1} @${winnerName} ${g}!${prizePart}${instruction} ${e2}`;

    const result = await sendWithRefresh(liveChatId, message);
    return NextResponse.json({ ...result, message });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
