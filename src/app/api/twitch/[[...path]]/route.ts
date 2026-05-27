import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { withdrawItem } from '@/lib/waxpeer';

// Resolve a origin real mesmo atrás de proxy/Vercel
function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

// ─── Twitch App Token (cached) ───────────────────────────────────────────────
let cachedAppToken: { value: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) return cachedAppToken.value;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error('Falha ao obter app token Twitch');
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedAppToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return cachedAppToken.value;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getBotConfig() {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: ['twitch_bot_user_token', 'twitch_bot_user_id', 'twitch_bot_username'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    token: map['twitch_bot_user_token'] ?? '',
    userId: map['twitch_bot_user_id'] ?? '',
    username: map['twitch_bot_username'] ?? '',
  };
}

function verifyEventSubSignature(secret: string, msgId: string, ts: string, body: string, sig: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(msgId + ts + body);
  const expected = Buffer.from('sha256=' + hmac.digest('hex'));
  const received = Buffer.from(sig);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// ─── GET handler ─────────────────────────────────────────────────────────────
// GET /api/twitch/viewers?channel=X
// GET /api/twitch/channel/[slug]
// GET /api/twitch/eventsub/auth        → OAuth start (deve ser acessado pelo admin logado como o bot)
// GET /api/twitch/eventsub/callback    → OAuth finish
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1] = path ?? [];

  // ── test-chat ─────────────────────────────────────────────────────────────
  // GET /api/twitch/test-chat?channel=liminhag0d&winner=alguem
  if (seg0 === 'test-chat') {
    const channel = req.nextUrl.searchParams.get('channel');
    const winner  = req.nextUrl.searchParams.get('winner') ?? 'Teste123';
    if (!channel) return Response.json({ error: 'channel required' }, { status: 400 });

    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['twitch_bot_user_token', 'twitch_bot_user_id'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const botToken = map['twitch_bot_user_token'];
    const botUserId = map['twitch_bot_user_id'];
    if (!botToken || !botUserId) {
      return Response.json({ ok: false, step: 'bot_config', error: 'Token ou ID do bot não encontrado no banco. Faça /api/twitch/eventsub/auth primeiro.' });
    }

    const appToken = await getAppToken();
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
    });
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId) {
      return Response.json({ ok: false, step: 'broadcaster_lookup', error: `Canal "${channel}" não encontrado na Twitch`, userData });
    }

    const msgRes = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: botUserId, message: `@${winner} parabéns! (mensagem de teste)` }),
    });
    const msgData = await msgRes.json();
    return Response.json({ ok: msgRes.ok, status: msgRes.status, twitchResponse: msgData, botUserId, broadcasterId });
  }

  // ── viewers ──────────────────────────────────────────────────────────────
  if (!seg0 || seg0 === 'viewers') {
    const channel = req.nextUrl.searchParams.get('channel');
    if (!channel) return Response.json({ error: 'channel required' }, { status: 400 });
    try {
      const token = await getAppToken();
      const headers = { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` };
      const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, { headers, next: { revalidate: 0 } });
      if (!res.ok) return Response.json({ error: 'Erro Twitch API' }, { status: 502 });
      const data = await res.json() as { data?: { viewer_count?: number }[] };
      const stream = data.data?.[0];
      return Response.json({ isLive: Boolean(stream), viewerCount: stream?.viewer_count ?? 0 });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── channel info ─────────────────────────────────────────────────────────
  if (seg0 === 'channel' && seg1) {
    try {
      const token = await getAppToken();
      const headers = { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` };
      const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(seg1)}`, { headers });
      if (!userRes.ok) return Response.json({ error: 'Erro ao consultar Twitch' }, { status: 502 });
      const userData = await userRes.json() as { data?: { login: string; display_name: string; profile_image_url: string }[] };
      if (!userData.data?.length) return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
      const user = userData.data[0];
      const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(seg1)}`, { headers });
      let isLive = false;
      if (streamRes.ok) {
        const sd = await streamRes.json() as { data?: unknown[] };
        isLive = (sd.data?.length ?? 0) > 0;
      }
      return Response.json({ login: user.login, displayName: user.display_name, profileImageUrl: user.profile_image_url, isLive });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── EventSub OAuth start ──────────────────────────────────────────────────
  if (seg0 === 'eventsub' && seg1 === 'auth') {
    const origin = getOrigin(req);
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', `${origin}/api/twitch/eventsub/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'user:read:whispers user:write:chat');
    authUrl.searchParams.set('force_verify', 'true');
    return NextResponse.redirect(authUrl.toString());
  }

  // ── EventSub OAuth callback ───────────────────────────────────────────────
  if (seg0 === 'eventsub' && seg1 === 'callback') {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'OAuth cancelado' }, { status: 400 });

    const origin = getOrigin(req);
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/twitch/eventsub/callback`,
      }),
    });

    if (!tokenRes.ok) return NextResponse.json({ error: 'Falha ao trocar código OAuth' }, { status: 502 });
    const tokenData = await tokenRes.json() as { access_token: string };
    const userToken = tokenData.access_token;

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${userToken}` },
    });
    if (!userRes.ok) return NextResponse.json({ error: 'Falha ao obter dados do bot' }, { status: 502 });
    const userData = await userRes.json() as { data?: { id: string; login: string; display_name: string }[] };
    const bot = userData.data?.[0];
    if (!bot) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    await Promise.all([
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_user_token' }, create: { key: 'twitch_bot_user_token', value: userToken }, update: { value: userToken } }),
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_user_id' }, create: { key: 'twitch_bot_user_id', value: bot.id }, update: { value: bot.id } }),
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_username' }, create: { key: 'twitch_bot_username', value: bot.login }, update: { value: bot.login } }),
    ]);

    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:monospace;padding:2rem;background:#0a0a0a;color:#00E5FF">
      <h2>✅ Bot conectado!</h2>
      <p>Conta: <strong>${bot.display_name}</strong> (${bot.login})</p>
      <p>Clique no botão abaixo para registrar o webhook EventSub:</p>
      <form method="POST" action="/api/twitch/eventsub/setup">
        <button type="submit" style="background:#00FFA3;color:#000;font-family:monospace;font-weight:bold;padding:0.75rem 1.5rem;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">
          Registrar Webhook →
        </button>
      </form>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─── POST handler ─────────────────────────────────────────────────────────────
// POST /api/twitch/notify           → envia mensagem de ganhador no chat
// POST /api/twitch/eventsub/setup   → cria a assinatura EventSub
// POST /api/twitch/eventsub         → webhook da Twitch (challenge + notificações)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1] = path ?? [];

  // ── Notificar ganhador no chat ────────────────────────────────────────────
  if (seg0 === 'notify' && !seg1) {
    const { channel, winnerName, prizeName } = await req.json() as { channel: string; winnerName: string; prizeName?: string };
    if (!channel || !winnerName) {
      return NextResponse.json({ ok: false, error: 'channel e winnerName são obrigatórios' }, { status: 400 });
    }

    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['twitch_bot_user_token', 'twitch_bot_user_id'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const botToken = map['twitch_bot_user_token'];
    const botUserId = map['twitch_bot_user_id'];
    if (!botToken || !botUserId) {
      return NextResponse.json({ ok: false, error: 'Bot não autenticado' });
    }

    const appToken = await getAppToken();
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
    });
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId) {
      return NextResponse.json({ ok: false, error: `Canal "${channel}" não encontrado` });
    }

    // Varia o conteúdo pra escapar do filtro anti-duplicata da Twitch (drop silencioso de mensagens similares em sequência)
    const greetings = ['parabéns', 'gg', 'level up', 'show de bola', 'topzera', 'mandou bem', 'que sorte hein', 'boa demais'];
    const emojis = ['🎉', '🏆', '🎁', '⭐', '🔥', '💎', '🚀', '👑'];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    const e1 = emojis[Math.floor(Math.random() * emojis.length)];
    const e2 = emojis[Math.floor(Math.random() * emojis.length)];
    const prizePart = prizeName ? ` levou ${prizeName.replace(/\s*\(.*?\)/g, '').trim()}` : '';
    const message = `${e1} @${winnerName} ${g}!${prizePart} ${e2}`;

    const msgRes = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: botUserId, message }),
    });
    const msgData = await msgRes.json() as { data?: { is_sent?: boolean; drop_reason?: { code?: string; message?: string } }[] };
    const sent = msgData.data?.[0];
    // Twitch retorna 200 mesmo quando dropa — precisa checar is_sent
    if (msgRes.ok && sent && sent.is_sent === false) {
      return NextResponse.json({ ok: false, dropped: true, reason: sent.drop_reason, message, twitchResponse: msgData });
    }
    return NextResponse.json({ ok: msgRes.ok, sent: sent?.is_sent ?? null, message, twitchResponse: msgData });
  }

  // ── Criar assinatura EventSub (chamado uma vez pelo admin) ────────────────
  if (seg0 === 'eventsub' && seg1 === 'setup') {
    const bot = await getBotConfig();
    if (!bot.userId) {
      return NextResponse.json({ error: 'Bot não autenticado. Acesse /api/twitch/eventsub/auth primeiro.' }, { status: 400 });
    }

    const secret = process.env.TWITCH_EVENTSUB_SECRET;
    if (!secret) return NextResponse.json({ error: 'TWITCH_EVENTSUB_SECRET não configurada' }, { status: 503 });

    // EventSub webhook subscriptions requerem App Access Token (client credentials), não user token
    const appToken = await getAppToken();
    const callbackUrl = `${getOrigin(req)}/api/twitch/eventsub`;

    const subRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${appToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user.whisper.message',
        version: '1',
        condition: { user_id: bot.userId },
        transport: { method: 'webhook', callback: callbackUrl, secret },
      }),
    });

    const subData = await subRes.json() as { data?: { id: string }[]; error?: string; message?: string };
    if (!subRes.ok) return NextResponse.json({ error: subData.message ?? subData.error }, { status: subRes.status });

    const subscriptionId = subData.data?.[0]?.id ?? '';
    await prisma.appConfig.upsert({
      where: { key: 'twitch_eventsub_subscription_id' },
      create: { key: 'twitch_eventsub_subscription_id', value: subscriptionId },
      update: { value: subscriptionId },
    });

    return NextResponse.json({ ok: true, subscriptionId, callbackUrl });
  }

  // ── Webhook EventSub da Twitch ────────────────────────────────────────────
  if (seg0 === 'eventsub' && !seg1) {
    const body = await req.text();
    const msgId    = req.headers.get('twitch-eventsub-message-id') ?? '';
    const msgTs    = req.headers.get('twitch-eventsub-message-timestamp') ?? '';
    const msgSig   = req.headers.get('twitch-eventsub-message-signature') ?? '';
    const msgType  = req.headers.get('twitch-eventsub-message-type') ?? '';

    const secret = process.env.TWITCH_EVENTSUB_SECRET ?? '';
    if (!verifyEventSubSignature(secret, msgId, msgTs, body, msgSig)) {
      return new NextResponse('Assinatura inválida', { status: 403 });
    }

    const payload = JSON.parse(body) as {
      challenge?: string;
      event?: {
        from_user_login: string;
        whisper: { text: string };
      };
    };

    // Challenge de verificação do webhook
    if (msgType === 'webhook_callback_verification') {
      return new NextResponse(payload.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Notificação de whisper
    if (msgType === 'notification' && payload.event) {
      const senderLogin = payload.event.from_user_login.toLowerCase();
      const text = payload.event.whisper.text.trim();

      const steamLinkRegex = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;
      if (!steamLinkRegex.test(text)) {
        return new NextResponse('ok', { status: 200 });
      }
      const tradeLink = text;

      // Busca entrega pendente — inclui afiliados (aguardando_tradelink) e não-afiliados (novo/sem status)
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // últimas 6h
      const entry = await prisma.raffleHistory.findFirst({
        where: {
          winnerName: { equals: senderLogin, mode: 'insensitive' },
          deliveryStatus: { notIn: ['entregue', 'tradelocked'] },
          tradeLink: null, // não reprocessar se já foi salvo
          timestamp: { gte: cutoff },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (!entry) {
        return new NextResponse('ok', { status: 200 });
      }

      // Salva o trade link sempre, independente de ser afiliado ou não
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { tradeLink },
      });

      // Só chama Waxpeer se o item foi comprado via marketplace (afiliados)
      if (entry.marketplaceItemId) {
        try {
          const result = await withdrawItem(entry.marketplaceItemId, tradeLink);
          await prisma.raffleHistory.update({
            where: { id: entry.id },
            data: { deliveryStatus: result.success ? 'entregue' : 'tradelocked' },
          });
        } catch { /* log seria ideal aqui */ }
      }

      return new NextResponse('ok', { status: 200 });
    }

    return new NextResponse('ok', { status: 200 });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
