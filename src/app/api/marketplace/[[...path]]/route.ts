import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem, withdrawItem, browseItems } from '@/lib/waxpeer';


// GET  /api/marketplace/stock?item=AK-47%20%7C%20Redline%20(Field-Tested)
// POST /api/marketplace/buy      { prizeName, winnerName, username, tradeLink, historyId? }
//   Compra + entrega P2P direto na Steam (partner+token do tradeLink)
// POST /api/marketplace/withdraw { waxpeerItemId, tradeLink, username, winnerName }
//   Legacy — não usado no fluxo novo (buy já entrega direto)

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
    const { prizeName, winnerName, username, historyId, tradeLink } = await req.json() as {
      prizeName: string;
      winnerName: string;
      username: string;
      historyId?: string;
      tradeLink: string;
    };

    if (!prizeName || !winnerName || !username || !tradeLink) {
      return NextResponse.json({ error: 'prizeName, winnerName, username e tradeLink são obrigatórios' }, { status: 400 });
    }

    const steamLinkRegex = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;
    if (!steamLinkRegex.test(tradeLink)) {
      return NextResponse.json({ ok: false, error: 'Trade link Steam inválido' }, { status: 400 });
    }

    if (!process.env.WAXPEER_API_KEY) {
      return NextResponse.json({ ok: false, error: 'WAXPEER_API_KEY não configurada' }, { status: 503 });
    }

    try {
      console.log('[marketplace/buy] prizeName:', prizeName, '| winnerName:', winnerName, '| username:', username);

      let buyResult: Awaited<ReturnType<typeof buyItem>> | null = null;
      let boughtListing: Awaited<ReturnType<typeof checkStock>>[number] | null = null;
      let lastError = '';
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const listings = await checkStock(prizeName);
        console.log('[marketplace/buy] attempt', attempt, '— checkStock returned', listings.length, 'listings');
        if (!listings.length) {
          await markHistoryError(historyId, username, winnerName, prizeName);
          return NextResponse.json({ ok: false, error: 'Item não encontrado no Waxpeer' });
        }
        const cheapest = listings[0];
        console.log('[marketplace/buy] tentando:', cheapest.name, 'price:', cheapest.price);
        try {
          const result = await buyItem(cheapest, tradeLink);
          buyResult = result;
          boughtListing = cheapest;
          break;
        } catch (buyErr) {
          lastError = String(buyErr);
          console.log('[marketplace/buy] tentativa', attempt, 'falhou:', lastError);
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500));
        }
      }

      if (!buyResult || !boughtListing) {
        await markHistoryError(historyId, username, winnerName, prizeName);
        return NextResponse.json({ ok: false, error: lastError || 'Compra falhou após múltiplas tentativas' });
      }
      console.log('[marketplace/buy] comprado e enviado:', boughtListing.name, 'result:', buyResult);

      try {
        await updateHistoryDelivered(username, winnerName, prizeName, buyResult.id, tradeLink, historyId);
      } catch (histErr) {
        console.error('[marketplace/buy] history update falhou (compra OK):', histErr);
      }

      return NextResponse.json({ ok: true, waxpeerItemId: buyResult.id, price: boughtListing.price });
    } catch (e) {
      console.error('[marketplace/buy] erro:', e);
      await markHistoryError(historyId, username, winnerName, prizeName);
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

async function updateHistoryDelivered(
  username: string,
  winnerName: string,
  prizeName: string,
  marketplaceItemId: string,
  tradeLink: string,
  historyId?: string,
): Promise<void> {
  const data = { marketplaceItemId, tradeLink, deliveryStatus: 'entregue' as const };

  if (historyId) {
    try {
      await prisma.raffleHistory.update({ where: { id: historyId }, data });
      return;
    } catch { /* fallthrough */ }
  }

  const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
  if (!streamer) return;

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const entry = await prisma.raffleHistory.findFirst({
    where: { streamerId: streamer.id, winnerName, prizeName, timestamp: { gte: cutoff } },
    orderBy: { timestamp: 'desc' },
  });
  if (entry) await prisma.raffleHistory.update({ where: { id: entry.id }, data });
}

async function markHistoryError(
  historyId: string | undefined,
  username: string,
  winnerName: string,
  prizeName: string,
): Promise<void> {
  try {
    if (historyId) {
      await prisma.raffleHistory.update({
        where: { id: historyId },
        data: { deliveryStatus: 'erro_compra' },
      });
      return;
    }
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return;
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const entry = await prisma.raffleHistory.findFirst({
      where: { streamerId: streamer.id, winnerName, prizeName, timestamp: { gte: cutoff } },
      orderBy: { timestamp: 'desc' },
    });
    if (entry) {
      await prisma.raffleHistory.update({
        where: { id: entry.id },
        data: { deliveryStatus: 'erro_compra' },
      });
    }
  } catch { /* best-effort */ }
}
