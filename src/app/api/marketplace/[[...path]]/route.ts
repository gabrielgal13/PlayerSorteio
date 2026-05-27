import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem, withdrawItem, browseItems } from '@/lib/waxpeer';

// ─── App token cache (igual ao twitch route) ─────────────────────────────────
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

// Envia mensagem no chat via bot avisando o ganhador de mandar trade link via whisper
async function notifyWinnerViaChat(twitchChannel: string, winnerName: string, prizeName: string) {
  try {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['twitch_bot_user_token', 'twitch_bot_user_id'] } },
    });
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const botToken = map['twitch_bot_user_token'];
    const botUserId = map['twitch_bot_user_id'];
    if (!botToken || !botUserId) return;

    const appToken = await getAppToken();
    const userRes = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(twitchChannel)}`,
      { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${appToken}` } },
    );
    if (!userRes.ok) return;
    const userData = await userRes.json() as { data?: { id: string }[] };
    const broadcasterId = userData.data?.[0]?.id;
    if (!broadcasterId) return;

    const message = `@${winnerName} parabéns!`;

    await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: botUserId, message }),
    });
  } catch { /* notificação é best-effort, não bloqueia o buy */ }
}

// GET  /api/marketplace/stock?item=AK-47%20%7C%20Redline%20(Field-Tested)
// POST /api/marketplace/buy      { prizeName, winnerName, username }
// POST /api/marketplace/withdraw { waxpeerItemId, tradeLink, username, winnerName }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'stock') {
    const item = req.nextUrl.searchParams.get('item');
    if (!item) return NextResponse.json({ error: 'item required' }, { status: 400 });
    try {
      const listings = await checkStock(item);
      return NextResponse.json({ ok: true, listings, available: listings.length > 0 });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
    }
  }

  if (route === 'browse') {
    const search = req.nextUrl.searchParams.get('search') ?? '';
    const limit = req.nextUrl.searchParams.get('limit') ? Number(req.nextUrl.searchParams.get('limit')) : 200;
    const minPrice = req.nextUrl.searchParams.get('min_price') ? Number(req.nextUrl.searchParams.get('min_price')) : 0;
    const maxPrice = req.nextUrl.searchParams.get('max_price') ? Number(req.nextUrl.searchParams.get('max_price')) : 0;
    const wears = req.nextUrl.searchParams.getAll('wears');
    const weaponType = req.nextUrl.searchParams.get('weapon_type') ?? '';
    const statTrakOnly = req.nextUrl.searchParams.get('stattrak') === 'true';
    if (!process.env.WAXPEER_API_KEY) {
      return NextResponse.json({ ok: false, items: [], error: 'WAXPEER_API_KEY não configurada' });
    }
    try {
      const items = await browseItems(search, limit, minPrice, maxPrice, wears, weaponType, statTrakOnly);
      return NextResponse.json({ ok: true, items }, {
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
      });
    } catch (e) {
      return NextResponse.json({ ok: false, items: [], error: String(e) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'buy') {
    const { prizeName, winnerName, username } = await req.json() as {
      prizeName: string;
      winnerName: string;
      username: string;
    };

    if (!prizeName || !winnerName || !username) {
      return NextResponse.json({ error: 'prizeName, winnerName e username são obrigatórios' }, { status: 400 });
    }

    if (!process.env.WAXPEER_API_KEY) {
      return NextResponse.json({ ok: false, error: 'WAXPEER_API_KEY não configurada' }, { status: 503 });
    }

    try {
      const listings = await checkStock(prizeName);
      if (!listings.length) {
        return NextResponse.json({ ok: false, error: 'Item não encontrado no Waxpeer' });
      }

      const cheapest = listings[0];
      const buyResult = await buyItem(cheapest);

      if (!buyResult.success) {
        return NextResponse.json({ ok: false, error: buyResult.msg });
      }

      // Atualiza o history entry e notifica o ganhador no chat (paralelo, best-effort)
      const twitchChannel = await updateHistoryMarketplace(username, winnerName, prizeName, buyResult.id);
      if (twitchChannel) {
        notifyWinnerViaChat(twitchChannel, winnerName, prizeName).catch(() => {});
      }

      return NextResponse.json({ ok: true, waxpeerItemId: buyResult.id, price: cheapest.price });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
    }
  }

  if (route === 'withdraw') {
    const { waxpeerItemId, tradeLink, username, winnerName } = await req.json() as {
      waxpeerItemId: string;
      tradeLink: string;
      username: string;
      winnerName: string;
    };

    if (!waxpeerItemId || !tradeLink || !username) {
      return NextResponse.json({ error: 'waxpeerItemId, tradeLink e username são obrigatórios' }, { status: 400 });
    }

    const steamLinkRegex = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;
    if (!steamLinkRegex.test(tradeLink)) {
      return NextResponse.json({ ok: false, error: 'Trade link Steam inválido' }, { status: 400 });
    }

    if (!process.env.WAXPEER_API_KEY) {
      return NextResponse.json({ ok: false, error: 'WAXPEER_API_KEY não configurada' }, { status: 503 });
    }

    try {
      const result = await withdrawItem(waxpeerItemId, tradeLink);

      if (!result.success) {
        return NextResponse.json({ ok: false, error: result.msg });
      }

      // Atualiza o history entry com tradeLink + status entregue
      try {
        const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
        if (streamer) {
          const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000); // últimas 3 horas
          await prisma.raffleHistory.updateMany({
            where: {
              streamerId: streamer.id,
              winnerName,
              timestamp: { gte: cutoff },
            },
            data: {
              tradeLink,
              deliveryStatus: 'entregue',
              marketplaceItemId: waxpeerItemId,
            },
          });
        }
      } catch { /* history update é best-effort */ }

      return NextResponse.json({ ok: true, msg: result.msg });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

async function updateHistoryMarketplace(
  username: string,
  winnerName: string,
  prizeName: string,
  marketplaceItemId: string,
): Promise<string | null> {
  const streamer = await prisma.streamer.findUnique({
    where: { username },
    select: { id: true, twitchChannel: true },
  });
  if (!streamer) return null;

  const cutoff = new Date(Date.now() - 60_000); // últimos 60 segundos
  let attempts = 0;
  while (attempts < 5) {
    const entry = await prisma.raffleHistory.findFirst({
      where: { streamerId: streamer.id, winnerName, prizeName, timestamp: { gte: cutoff } },
      orderBy: { timestamp: 'desc' },
    });
    if (entry) {
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { marketplaceItemId, deliveryStatus: 'aguardando_tradelink' },
      });
      return streamer.twitchChannel ?? null;
    }
    await new Promise(r => setTimeout(r, 400));
    attempts++;
  }
  return streamer.twitchChannel ?? null;
}
