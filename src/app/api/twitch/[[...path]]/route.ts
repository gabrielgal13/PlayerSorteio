import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem } from '@/lib/waxpeer';

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

async function refreshTwitchBotToken(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: 'twitch_bot_refresh_token' } });
  if (!row?.value) return null;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      refresh_token: row.value,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token: string; refresh_token?: string };
  await prisma.appConfig.upsert({ where: { key: 'twitch_bot_user_token' }, create: { key: 'twitch_bot_user_token', value: data.access_token }, update: { value: data.access_token } });
  if (data.refresh_token) {
    await prisma.appConfig.upsert({ where: { key: 'twitch_bot_refresh_token' }, create: { key: 'twitch_bot_refresh_token', value: data.refresh_token }, update: { value: data.refresh_token } });
  }
  return data.access_token;
}

async function getBotWithRefresh(): Promise<{ token: string; userId: string } | null> {
  const bot = await getBotConfig();
  if (bot.token && bot.userId) return { token: bot.token, userId: bot.userId };
  const newToken = await refreshTwitchBotToken();
  if (!newToken) return null;
  const updated = await getBotConfig();
  if (!updated.token || !updated.userId) return null;
  return { token: updated.token, userId: updated.userId };
}

async function sendBotChatMessage(broadcasterId: string, message: string): Promise<{ ok: boolean; sent?: boolean | null; dropped?: boolean; reason?: unknown; twitchResponse?: unknown }> {
  const bot = await getBotWithRefresh();
  if (!bot) return { ok: false };

  const doSend = (token: string) =>
    fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: bot.userId, message }),
    });

  let res = await doSend(bot.token);
  if (res.status === 401) {
    const newToken = await refreshTwitchBotToken();
    if (!newToken) return { ok: false };
    res = await doSend(newToken);
  }

  const msgData = await res.json() as { data?: { is_sent?: boolean; drop_reason?: unknown }[] };
  const sent = msgData.data?.[0];
  if (res.ok && sent && sent.is_sent === false) {
    return { ok: false, dropped: true, reason: sent.drop_reason, twitchResponse: msgData };
  }
  return { ok: res.ok, sent: sent?.is_sent ?? null, twitchResponse: msgData };
}

async function sendTwitchWhisper(toUserId: string, message: string): Promise<void> {
  const bot = await getBotWithRefresh();
  if (!bot) return;
  try {
    const res = await fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${bot.userId}&to_user_id=${toUserId}`, {
      method: 'POST',
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${bot.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (res.status === 401) {
      const newToken = await refreshTwitchBotToken();
      if (!newToken) return;
      await fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${bot.userId}&to_user_id=${toUserId}`, {
        method: 'POST',
        headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
    }
  } catch { /* ignore */ }
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

    const bot = await getBotWithRefresh();
    if (!bot) return Response.json({ ok: false, step: 'bot_config', error: 'Bot não autenticado. Faça /api/twitch/eventsub/auth primeiro.' });

    const appToken = await getAppToken();
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
    });
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId) return Response.json({ ok: false, step: 'broadcaster_lookup', error: `Canal "${channel}" não encontrado na Twitch` });

    const result = await sendBotChatMessage(broadcasterId, `@${winner} parabéns! (mensagem de teste)`);
    return Response.json({ ...result, botUserId: bot.userId, broadcasterId });
  }

  // ── status ───────────────────────────────────────────────────────────────
  if (seg0 === 'status') {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['twitch_bot_user_token', 'twitch_bot_username'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return NextResponse.json({
      connected: Boolean(map['twitch_bot_user_token']),
      username: map['twitch_bot_username'] ?? null,
    });
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
    const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string };
    const userToken = tokenData.access_token;

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${userToken}` },
    });
    if (!userRes.ok) return NextResponse.json({ error: 'Falha ao obter dados do bot' }, { status: 502 });
    const userData = await userRes.json() as { data?: { id: string; login: string; display_name: string }[] };
    const bot = userData.data?.[0];
    if (!bot) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const upserts: Promise<unknown>[] = [
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_user_token' }, create: { key: 'twitch_bot_user_token', value: userToken }, update: { value: userToken } }),
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_user_id' }, create: { key: 'twitch_bot_user_id', value: bot.id }, update: { value: bot.id } }),
      prisma.appConfig.upsert({ where: { key: 'twitch_bot_username' }, create: { key: 'twitch_bot_username', value: bot.login }, update: { value: bot.login } }),
    ];
    if (tokenData.refresh_token) {
      upserts.push(prisma.appConfig.upsert({ where: { key: 'twitch_bot_refresh_token' }, create: { key: 'twitch_bot_refresh_token', value: tokenData.refresh_token }, update: { value: tokenData.refresh_token } }));
    }
    await Promise.all(upserts);

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
// POST /api/twitch/send             → envia mensagem genérica no chat (comandos do bot)
// POST /api/twitch/eventsub/setup   → cria a assinatura EventSub
// POST /api/twitch/eventsub         → webhook da Twitch (challenge + notificações)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0, seg1] = path ?? [];

  // ── Enviar mensagem genérica (bot commands) ───────────────────────────────
  if (seg0 === 'send' && !seg1) {
    const { channel, message } = await req.json() as { channel: string; message: string };
    if (!channel || !message?.trim())
      return NextResponse.json({ ok: false, error: 'channel e message são obrigatórios' }, { status: 400 });

    if (!await getBotWithRefresh())
      return NextResponse.json({ ok: false, error: 'Bot não autenticado' });

    const appToken = await getAppToken();
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
    });
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId)
      return NextResponse.json({ ok: false, error: `Canal "${channel}" não encontrado` });

    const result = await sendBotChatMessage(broadcasterId, message.trim());
    return NextResponse.json(result);
  }

  // ── Notificar ganhador no chat ────────────────────────────────────────────
  if (seg0 === 'notify' && !seg1) {
    const { channel, winnerName, prizeName, winnerSource } = await req.json() as { channel: string; winnerName: string; prizeName?: string; winnerSource?: string | null };
    if (!channel || !winnerName)
      return NextResponse.json({ ok: false, error: 'channel e winnerName são obrigatórios' }, { status: 400 });

    const muteRow = await prisma.appConfig.findUnique({ where: { key: 'bot_messages_muted' } });
    if (muteRow?.value === 'true') return NextResponse.json({ ok: true, muted: true });

    if (!await getBotWithRefresh())
      return NextResponse.json({ ok: false, error: 'Bot não autenticado' });

    const appToken = await getAppToken();
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
    });
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId)
      return NextResponse.json({ ok: false, error: `Canal "${channel}" não encontrado` });

    const greetings = ['parabéns', 'gg', 'level up', 'show de bola', 'topzera', 'mandou bem', 'que sorte hein', 'boa demais'];
    const emojis = ['🎉', '🏆', '🎁', '⭐', '🔥', '💎', '🚀', '👑'];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    const e1 = emojis[Math.floor(Math.random() * emojis.length)];
    const e2 = emojis[Math.floor(Math.random() * emojis.length)];
    const prizePart = prizeName ? ` levou ${prizeName.replace(/\s*\(.*?\)/g, '').trim()}` : '';
    const botName = process.env.TWITCH_BOT_USERNAME ?? 'PlayerSkinsBOT';
    const isTwitchWinner = !winnerSource || winnerSource === 'twitch';
    const instruction = isTwitchWinner ? ` | Para receber, mande seu Steam trade link por WHISPER para @${botName}` : '';
    const message = `${e1} @${winnerName} ${g}!${prizePart}${instruction} ${e2}`;

    const result = await sendBotChatMessage(broadcasterId, message);
    return NextResponse.json({ ...result, message });
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
        from_user_id: string;
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
        await sendTwitchWhisper(
          payload.event.from_user_id,
          'Link inválido! Envie apenas o trade link Steam no formato: https://steamcommunity.com/tradeoffer/new/?partner=XXXXXXXX&token=XXXXXXXX',
        );
        return new NextResponse('ok', { status: 200 });
      }
      const tradeLink = text;

      // Busca entrega pendente — inclui afiliados (aguardando_tradelink) e não-afiliados (novo/sem status)
      // winnerSource null = inscrito manualmente (aceito de qualquer plataforma)
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // últimas 6h
      const entry = await prisma.raffleHistory.findFirst({
        where: {
          winnerName: { equals: senderLogin, mode: 'insensitive' },
          deliveryStatus: { notIn: ['entregue', 'tradelocked'] },
          tradeLink: null,
          timestamp: { gte: cutoff },
          OR: [{ winnerSource: 'twitch' }, { winnerSource: null }],
        },
        orderBy: { timestamp: 'desc' },
      });

      if (!entry) {
        await sendTwitchWhisper(
          payload.event.from_user_id,
          'Nenhuma entrega pendente encontrada para sua conta. Se você ganhou há mais de 6 horas, entre em contato com o streamer.',
        );
        return new NextResponse('ok', { status: 200 });
      }

      // Salva o trade link sempre, independente de ser afiliado ou não
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { tradeLink },
      });

      // Compra + entrega P2P direto na Steam do tradeLink (apenas afiliados / Waxpeer items)
      if (process.env.WAXPEER_API_KEY && !entry.marketplaceItemId) {
        try {
          let bought: { id: string } | null = null;
          let lastError = '';
          for (let attempt = 1; attempt <= 5; attempt++) {
            const listings = await checkStock(entry.prizeName);
            if (!listings.length) { lastError = 'Item não encontrado'; break; }
            try {
              const result = await buyItem(listings[0], tradeLink, entry.id);
              bought = { id: String(result.id) };
              break;
            } catch (err) {
              lastError = String(err);
              if (attempt < 5) await new Promise(r => setTimeout(r, 500));
            }
          }
          await prisma.raffleHistory.update({
            where: { id: entry.id },
            data: bought
              ? { marketplaceItemId: bought.id, deliveryStatus: 'item_comprado' }
              : { deliveryStatus: 'erro_compra' },
          });
          if (!bought) console.log('[twitch/whisper] erro compra:', entry.winnerName, lastError);
        } catch (err) {
          console.error('[twitch/whisper] erro inesperado:', err);
        }
      }

      return new NextResponse('ok', { status: 200 });
    }

    return new NextResponse('ok', { status: 200 });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
