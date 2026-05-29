import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem, withdrawItem, browseItems } from '@/lib/waxpeer';


// GET  /api/marketplace/stock?item=AK-47%20%7C%20Redline%20(Field-Tested)
// POST /api/marketplace/buy      { prizeName, winnerName, username }
// POST /api/marketplace/withdraw { waxpeerItemId, tradeLink, username, winnerName }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'debug') {
    const item = req.nextUrl.searchParams.get('item');
    if (!item) return NextResponse.json({ error: 'item required' }, { status: 400 });
    if (!process.env.WAXPEER_API_KEY) return NextResponse.json({ error: 'WAXPEER_API_KEY não configurada' });
    try {
      const listings = await checkStock(item);
      return NextResponse.json({ ok: true, count: listings.length, listings: listings.slice(0, 3), apiKeyPrefix: process.env.WAXPEER_API_KEY.slice(0, 6) + '...' });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
    }
  }

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
      console.log('[marketplace/buy] prizeName:', prizeName, '| winnerName:', winnerName, '| username:', username);
      const listings = await checkStock(prizeName);
      console.log('[marketplace/buy] checkStock returned', listings.length, 'listings');
      if (!listings.length) {
        return NextResponse.json({ ok: false, error: 'Item não encontrado no Waxpeer' });
      }

      const cheapest = listings[0];
      console.log('[marketplace/buy] cheapest:', cheapest);
      const buyResult = await buyItem(cheapest);
      console.log('[marketplace/buy] buyResult:', buyResult);

      if (!buyResult.success) {
        return NextResponse.json({ ok: false, error: buyResult.msg });
      }

      await updateHistoryMarketplace(username, winnerName, prizeName, buyResult.id);

      return NextResponse.json({ ok: true, waxpeerItemId: buyResult.id, price: cheapest.price });
    } catch (e) {
      console.error('[marketplace/buy] erro:', e);
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
