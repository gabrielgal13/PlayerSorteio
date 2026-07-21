import { prisma } from '@/lib/prisma';

// ─── Twitch App Token (cached) ───────────────────────────────────────────────
let cachedAppToken: { value: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
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

export async function getBotConfig() {
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

export async function refreshTwitchBotToken(): Promise<string | null> {
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

export async function getBotWithRefresh(): Promise<{ token: string; userId: string } | null> {
  const bot = await getBotConfig();
  if (bot.token && bot.userId) return { token: bot.token, userId: bot.userId };
  const newToken = await refreshTwitchBotToken();
  if (!newToken) return null;
  const updated = await getBotConfig();
  if (!updated.token || !updated.userId) return null;
  return { token: updated.token, userId: updated.userId };
}

export async function sendBotChatMessage(broadcasterId: string, message: string): Promise<{ ok: boolean; sent?: boolean | null; dropped?: boolean; reason?: unknown; twitchResponse?: unknown }> {
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

export async function getTwitchUserIdByLogin(login: string): Promise<string | null> {
  const appToken = await getAppToken();
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as { data?: { id: string }[] };
  return data.data?.[0]?.id ?? null;
}

export async function sendTwitchWhisper(toUserId: string, message: string): Promise<boolean> {
  const bot = await getBotWithRefresh();
  if (!bot) return false;
  const doSend = (token: string) =>
    fetch(`https://api.twitch.tv/helix/whispers?from_user_id=${bot.userId}&to_user_id=${toUserId}`, {
      method: 'POST',
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
  try {
    let res = await doSend(bot.token);
    if (res.status === 401) {
      const newToken = await refreshTwitchBotToken();
      if (!newToken) return false;
      res = await doSend(newToken);
    }
    if (!res.ok) {
      // 401 aqui normalmente = token do bot sem o escopo user:manage:whispers
      // (precisa reautenticar em /api/twitch/eventsub/auth); 403 = conta do bot
      // sem telefone verificado.
      const body = await res.text().catch(() => '');
      console.error(`[whisper] falhou (${res.status}) para ${toUserId}: ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whisper] erro de rede:', e);
    return false;
  }
}

// Garante a assinatura EventSub channel.chat.message para um canal — chamado
// depois que o streamer conecta a conta Twitch (concede o escopo channel:bot).
// Sem isso a Twitch não entrega chat pro bot; exige o app access token e o
// user_id do bot autenticado com user:read:chat.
export async function ensureChatCommandSubscription(broadcasterId: string, callbackUrl: string): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return { ok: false, error: 'TWITCH_EVENTSUB_SECRET não configurada' };

  const bot = await getBotConfig();
  if (!bot.userId) return { ok: false, error: 'Bot não autenticado' };

  const appToken = await getAppToken();
  const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'channel.chat.message',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId, user_id: bot.userId },
      transport: { method: 'webhook', callback: callbackUrl, secret },
    }),
  });

  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null) as { message?: string } | null;
  // 409 = já existe assinatura pra esse canal — considera sucesso.
  if (res.status === 409) return { ok: true };
  return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
}
