import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDeliveryMode } from '@/lib/prizeDelivery';

// Kick — unofficial token approach (no OAuth app required)
// Get the bearer token: login as the bot account at kick.com →
//   DevTools (F12) → Network → any request → copy "Authorization: Bearer <token>"

async function getKickChatroomId(channel: string): Promise<string | null> {
  const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!res.ok) return null;
  const data = await res.json() as { chatroom?: { id?: number } };
  const id = data?.chatroom?.id;
  return id != null ? String(id) : null;
}

async function getKickToken(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: 'kick_bot_access_token' } });
  return row?.value ?? null;
}

async function sendKickMessage(chatroomId: string, message: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://kick.com/api/v2/messages/send/${chatroomId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({ content: message, type: 'message' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    return { ok: false, error: err.message ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const [seg0] = path ?? [];

  if (seg0 === 'status') {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['kick_bot_access_token', 'kick_bot_username'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return NextResponse.json({
      connected: Boolean(map['kick_bot_access_token']),
      username: map['kick_bot_username'] ?? null,
    });
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

  // Save bearer token manually (no OAuth)
  if (seg0 === 'token') {
    const { token } = await req.json() as { token: string };
    if (!token?.trim())
      return NextResponse.json({ ok: false, error: 'Token vazio' }, { status: 400 });

    const t = token.trim();

    // Try to get the username from the token
    let username = 'bot';
    const verifyRes = await fetch('https://kick.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({})) as { username?: string; name?: string };
      username = data.username ?? data.name ?? 'bot';
    }

    await Promise.all([
      prisma.appConfig.upsert({
        where: { key: 'kick_bot_access_token' },
        create: { key: 'kick_bot_access_token', value: t },
        update: { value: t },
      }),
      prisma.appConfig.upsert({
        where: { key: 'kick_bot_username' },
        create: { key: 'kick_bot_username', value: username },
        update: { value: username },
      }),
    ]);

    return NextResponse.json({ ok: true, username });
  }

  if (seg0 === 'send') {
    const { kickChannel, message, chatroomId: provided } = await req.json() as { kickChannel: string; message: string; chatroomId?: string };
    if (!kickChannel || !message?.trim())
      return NextResponse.json({ ok: false, error: 'kickChannel e message são obrigatórios' }, { status: 400 });

    const token = await getKickToken();
    if (!token) return NextResponse.json({ ok: false, error: 'Bot Kick não autenticado' });

    const chatroomId = provided ?? await getKickChatroomId(kickChannel);
    if (!chatroomId) return NextResponse.json({ ok: false, error: `Canal Kick "${kickChannel}" não encontrado` });

    const result = await sendKickMessage(chatroomId, message.trim(), token);
    return NextResponse.json(result);
  }

  if (seg0 === 'notify') {
    const { kickChannel, winnerName, prizeName, chatroomId: provided, winnerSource } = await req.json() as { kickChannel: string; winnerName: string; prizeName?: string; chatroomId?: string; winnerSource?: string | null };
    if (!kickChannel || !winnerName)
      return NextResponse.json({ ok: false, error: 'kickChannel e winnerName são obrigatórios' }, { status: 400 });

    const muteRow = await prisma.appConfig.findUnique({ where: { key: 'bot_messages_muted' } });
    if (muteRow?.value === 'true') return NextResponse.json({ ok: true, muted: true });

    const token = await getKickToken();
    if (!token) return NextResponse.json({ ok: false, error: 'Bot Kick não autenticado' });

    const chatroomId = provided ?? await getKickChatroomId(kickChannel);
    if (!chatroomId) return NextResponse.json({ ok: false, error: `Canal Kick "${kickChannel}" não encontrado` });

    const greetings = ['parabéns', 'gg', 'show de bola', 'incrível', 'mandou bem', 'topzera'];
    const emojis = ['🎉', '🏆', '🎁', '⭐', '🔥', '💎', '🚀', '👑'];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    const e1 = emojis[Math.floor(Math.random() * emojis.length)];
    const e2 = emojis[Math.floor(Math.random() * emojis.length)];
    const prizePart = prizeName ? ` levou ${prizeName.replace(/\s*\(.*?\)/g, '').trim()}` : '';
    const botName = process.env.TWITCH_BOT_USERNAME ?? 'PlayerSkinsBOT';
    const isKickWinner = !winnerSource || winnerSource === 'kick';
    const deliveryMode = prizeName ? getDeliveryMode(prizeName) : 'trade_link';
    const askText = deliveryMode === 'address_and_shirt'
      ? 'seu endereço completo (com CEP) e qual camisa você quer'
      : deliveryMode === 'address'
      ? 'seu endereço completo (com CEP)'
      : 'seu Steam trade link';
    const instruction = isKickWinner
      ? ` | Para receber, marque @${botName} aqui no chat com ${askText}!`
      : '';
    const message = `${e1} @${winnerName} ${g}!${prizePart}${instruction} ${e2}`;

    const result = await sendKickMessage(chatroomId, message, token);
    return NextResponse.json({ ...result, message });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
