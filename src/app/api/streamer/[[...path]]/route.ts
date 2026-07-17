import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ensureDeliveryAddressColumn } from '@/lib/deliveryCapture';
import { recordRaffleCompleted, recordGameCompleted, getRankStatus } from '@/lib/rankEngine';
import { INFINITE_QUANTITY } from '@/types';

const ADMIN_LIST_NAME = '__admin_products__';

// Resolve a origin real mesmo atrás de proxy/Vercel
function getOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

// Página que fecha o popup de OAuth e avisa a janela que abriu (postMessage).
function popupResponse(payload: { ok: boolean; channel?: string }) {
  const json = JSON.stringify({ type: 'twitch-streamer-oauth', ...payload }).replace(/</g, '\\u003c');
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:monospace;background:#0a0a0a;color:${payload.ok ? '#00E5FF' : '#FF4444'};padding:2rem">
    <p>${payload.ok ? 'Conectado! Fechando...' : 'Falha na conexão. Fechando...'}</p>
    <script>
      if (window.opener) window.opener.postMessage(${json}, window.location.origin);
      setTimeout(function () { window.close(); }, ${payload.ok ? 400 : 1800});
    </script>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
}

// GET /api/streamer/config?username=xxx
// GET /api/streamer/history?username=xxx
// GET /api/streamer/psc-history?username=xxx&days=30
// GET /api/streamer/prize-lists?username=xxx
// GET /api/streamer/admin-products  (header: x-session-username)
// GET /api/streamer/bot-commands?username=xxx
// GET /api/streamer/twitch-streamer-auth      → OAuth do streamer (channel:read:subscriptions)
// GET /api/streamer/twitch-streamer-callback  → OAuth finish (popup)
// GET /api/streamer/twitch-subscribers        → lista inscritos do canal
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'config') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json(null);
    return NextResponse.json({
      twitchChannel: streamer.twitchChannel,
      registrationCommand: streamer.registrationCommand,
      claimCommand: streamer.claimCommand,
      validationTimeout: streamer.validationTimeout,
    });
  }

  if (route === 'history') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json([]);
    const rows = await prisma.raffleHistory.findMany({
      where: { streamerId: streamer.id },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    await ensureDeliveryAddressColumn();
    const addrRows = rows.length > 0
      ? await prisma.$queryRaw<Array<{ id: string; deliveryAddress: string | null }>>`
          SELECT id, "deliveryAddress" FROM "RaffleHistory" WHERE id = ANY(${rows.map(r => r.id)})
        `
      : [];
    const addressMap = new Map(addrRows.map(r => [r.id, r.deliveryAddress]));
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      winner: { id: r.id, number: r.winnerNumber, name: r.winnerName, source: r.winnerSource ?? undefined },
      prize: {
        id: r.id,
        name: r.prizeName,
        description: r.prizeDescription ?? undefined,
        imageUrl: r.prizeImageUrl ?? undefined,
        quantity: r.prizeQuantity,
        order: 0,
        pscValue: r.prizePscValue ?? undefined,
      },
      streamer: username,
      timestamp: r.timestamp.getTime(),
      confirmed: r.confirmed,
      tradeLink: r.tradeLink ?? undefined,
      deliveryAddress: addressMap.get(r.id) ?? undefined,
      deliveryStatus: (r.deliveryStatus ?? 'novo') as import('@/types').DeliveryStatus,
      tradeLockAt: r.tradeLockAt?.getTime() ?? undefined,
      marketplaceItemId: r.marketplaceItemId ?? undefined,
    })));
  }

  if (route === 'psc-history') {
    const username = req.nextUrl.searchParams.get('username');
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '0', 10);
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ entries: [], balance: 0 });

    const since = days > 0 ? new Date(Date.now() - days * 86400_000) : undefined;
    const dateFilter = since ? { gte: since } : undefined;

    let rawCredits: Awaited<ReturnType<typeof prisma.pscTransaction.findMany>> = [];
    try {
      rawCredits = await prisma.pscTransaction.findMany({
        where: { streamerId: streamer.id, ...(dateFilter ? { timestamp: dateFilter } : {}) },
        orderBy: { timestamp: 'desc' },
      });
    } catch { /* model not yet loaded */ }

    const rawDebits = await prisma.raffleHistory.findMany({
      where: {
        streamerId: streamer.id,
        prizePscValue: { gt: 0 },
        ...(dateFilter ? { timestamp: dateFilter } : {}),
      },
      orderBy: { timestamp: 'desc' },
    });

    type Entry = { id: string; type: 'credit' | 'debit'; amount: number; description: string; timestamp: number };
    const entries: Entry[] = [
      ...rawCredits.map(c => ({ id: c.id, type: 'credit' as const, amount: c.amount, description: c.description, timestamp: c.timestamp.getTime() })),
      ...rawDebits.map(d => ({ id: d.id, type: 'debit' as const, amount: d.prizePscValue!, description: d.prizeName, timestamp: d.timestamp.getTime() })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ entries, balance: streamer.pscBalance });
  }

  if (route === 'prize-lists') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json([]);
    const lists = await prisma.prizeList.findMany({
      where: { streamerId: streamer.id, NOT: { name: ADMIN_LIST_NAME } },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(lists);
  }

  if (route === 'admin-products') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const list = await prisma.prizeList.findFirst({
      where: { streamerId: streamer.id, name: ADMIN_LIST_NAME },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    // Produtos com quantidade esgotada não aparecem mais para o streamer sortear
    // (quantidade infinita = INFINITE_QUANTITY nunca é filtrada).
    return NextResponse.json((list?.items ?? []).filter(item => item.quantity > 0 || item.quantity === INFINITE_QUANTITY));
  }

  if (route === 'bot-commands') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json([]);
    const commands = await prisma.botCommand.findMany({
      where: { streamerId: streamer.id },
      select: { id: true, command: true, response: true },
    });
    return NextResponse.json(commands);
  }

  // ── OAuth do streamer (não o bot) — pra ler a lista de inscritos do canal ──
  if (route === 'twitch-streamer-auth') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { twitchAffiliateEnabled: true } });
    if (!streamer?.twitchAffiliateEnabled) {
      return NextResponse.json({ error: 'Recurso disponível apenas para canais marcados como Afiliado/Parceiro Twitch.' }, { status: 403 });
    }

    const origin = getOrigin(req);
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', `${origin}/api/streamer/twitch-streamer-callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'channel:read:subscriptions');
    authUrl.searchParams.set('force_verify', 'true');
    authUrl.searchParams.set('state', username);
    return NextResponse.redirect(authUrl.toString());
  }

  if (route === 'twitch-streamer-callback') {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const username = req.headers.get('x-session-username');

    if (!username || username !== state || !code) return popupResponse({ ok: false });

    try {
      const streamer = await prisma.streamer.findUnique({ where: { username }, select: { twitchAffiliateEnabled: true } });
      if (!streamer?.twitchAffiliateEnabled) return popupResponse({ ok: false });

      const origin = getOrigin(req);
      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID!,
          client_secret: process.env.TWITCH_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${origin}/api/streamer/twitch-streamer-callback`,
        }),
      });
      if (!tokenRes.ok) return popupResponse({ ok: false });
      const tokenData = await tokenRes.json() as { access_token: string; refresh_token?: string };

      const userRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) return popupResponse({ ok: false });
      const userData = await userRes.json() as { data?: { id: string; login: string }[] };
      const twitchUser = userData.data?.[0];
      if (!twitchUser) return popupResponse({ ok: false });

      await prisma.streamer.update({
        where: { username },
        data: {
          twitchChannel: twitchUser.login,
          twitchUserId: twitchUser.id,
          twitchUserAccessToken: tokenData.access_token,
          twitchUserRefreshToken: tokenData.refresh_token ?? null,
        },
      });

      return popupResponse({ ok: true, channel: twitchUser.login });
    } catch {
      return popupResponse({ ok: false });
    }
  }

  if (route === 'twitch-subscribers') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer?.twitchAffiliateEnabled) {
      return NextResponse.json({ error: 'Recurso disponível apenas para canais marcados como Afiliado/Parceiro Twitch.' }, { status: 403 });
    }
    if (!streamer.twitchUserId || !streamer.twitchUserAccessToken) {
      return NextResponse.json({ error: 'Conecte sua conta Twitch em Configurações → Plataformas primeiro.' }, { status: 400 });
    }

    const fetchSubs = async (token: string) => {
      const subs: { userId: string; userName: string }[] = [];
      let cursor: string | undefined;
      do {
        const url = new URL('https://api.twitch.tv/helix/subscriptions');
        url.searchParams.set('broadcaster_id', streamer.twitchUserId!);
        url.searchParams.set('first', '100');
        if (cursor) url.searchParams.set('after', cursor);
        const res = await fetch(url, {
          headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) return { expired: true as const, subs: [] };
        if (!res.ok) {
          const body = await res.json().catch(() => ({} as { message?: string }));
          throw new Error(body.message || `Twitch respondeu ${res.status}`);
        }
        const data = await res.json() as { data: { user_id: string; user_name: string }[]; pagination?: { cursor?: string } };
        subs.push(...data.data.map(d => ({ userId: d.user_id, userName: d.user_name })));
        cursor = data.pagination?.cursor;
      } while (cursor);
      return { expired: false as const, subs };
    };

    try {
      let result = await fetchSubs(streamer.twitchUserAccessToken);
      if (result.expired) {
        if (!streamer.twitchUserRefreshToken) {
          return NextResponse.json({ error: 'Sessão Twitch expirada. Reconecte em Configurações → Plataformas.' }, { status: 401 });
        }
        const refreshRes = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID!,
            client_secret: process.env.TWITCH_CLIENT_SECRET!,
            refresh_token: streamer.twitchUserRefreshToken,
            grant_type: 'refresh_token',
          }),
        });
        if (!refreshRes.ok) {
          return NextResponse.json({ error: 'Sessão Twitch expirada. Reconecte em Configurações → Plataformas.' }, { status: 401 });
        }
        const refreshData = await refreshRes.json() as { access_token: string; refresh_token?: string };
        await prisma.streamer.update({
          where: { id: streamer.id },
          data: {
            twitchUserAccessToken: refreshData.access_token,
            twitchUserRefreshToken: refreshData.refresh_token ?? streamer.twitchUserRefreshToken,
          },
        });
        result = await fetchSubs(refreshData.access_token);
        if (result.expired) {
          return NextResponse.json({ error: 'Sessão Twitch expirada. Reconecte em Configurações → Plataformas.' }, { status: 401 });
        }
      }
      return NextResponse.json({ subscribers: result.subs });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao consultar inscritos da Twitch.' }, { status: 502 });
    }
  }

  if (route === 'rank-status') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const status = await getRankStatus(streamer.id);
    return NextResponse.json(status);
  }

  if (route === 'games-config') {
    const row = await prisma.appConfig.findUnique({ where: { key: 'games_disabled' } });
    let disabled: string[] = [];
    try { disabled = row ? JSON.parse(row.value) : []; } catch { disabled = []; }
    return NextResponse.json({ disabled });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// POST /api/streamer/history
// POST /api/streamer/prize-lists
// POST /api/streamer/change-password
// POST /api/streamer/twitch-streamer-disconnect  (header: x-session-username)
// POST /api/streamer/rank-game-completed          (header: x-session-username)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'history') {
    const { username, result } = await req.json();
    if (!username || !result) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    await prisma.raffleHistory.create({
      data: {
        ...(result.id ? { id: result.id } : {}),
        streamerId: streamer.id,
        winnerNumber: result.winner.number,
        winnerName: result.winner.name,
        winnerSource: result.winner.source ?? null,
        prizeName: result.prize.name,
        prizeDescription: result.prize.description ?? null,
        prizeImageUrl: result.prize.imageUrl ?? null,
        prizeQuantity: result.prize.quantity,
        prizePscValue: result.prize.pscValue ?? null,
        confirmed: result.confirmed,
        timestamp: new Date(result.timestamp),
      },
    });
    // Desconta 1 unidade do estoque de produtos exclusivos (admin) quando o prêmio
    // sorteado corresponde a um produto com quantidade limitada.
    const adminList = await prisma.prizeList.findFirst({
      where: { streamerId: streamer.id, name: ADMIN_LIST_NAME },
      select: { id: true },
    });
    if (adminList) {
      const adminItem = await prisma.prizeListItem.findFirst({
        where: { prizeListId: adminList.id, name: result.prize.name },
      });
      if (adminItem && adminItem.quantity !== INFINITE_QUANTITY && adminItem.quantity > 0) {
        await prisma.prizeListItem.update({
          where: { id: adminItem.id },
          data: { quantity: adminItem.quantity - 1 },
        });
      }
    }
    await recordRaffleCompleted(streamer.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (route === 'change-password') {
    const { username, newPassword } = await req.json();
    if (!username || !newPassword?.trim())
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'Streamer não encontrado.' }, { status: 404 });
    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.streamer.update({
      where: { username },
      data: { passwordHash, forcePasswordChange: false },
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'prize-lists') {
    const { username, name, description, visibility, coverUrl, items } = await req.json();
    if (!username || !name) return NextResponse.json({ error: 'username and name required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const list = await prisma.prizeList.create({
      data: {
        streamerId: streamer.id,
        name,
        description: description ?? null,
        visibility: visibility ?? 'public',
        coverUrl: coverUrl ?? null,
        items: {
          create: (items ?? []).map((p: { name: string; description?: string; imageUrl?: string; quantity: number; pscValue?: number; skipPsc?: boolean; order: number }, i: number) => ({
            name: p.name,
            description: p.description ?? null,
            imageUrl: p.imageUrl ?? null,
            quantity: p.quantity,
            pscValue: p.pscValue ?? null,
            skipPsc: p.skipPsc ?? false,
            order: p.order ?? i,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(list);
  }

  if (route === 'twitch-streamer-disconnect') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    await prisma.streamer.update({
      where: { username },
      data: { twitchUserId: null, twitchUserAccessToken: null, twitchUserRefreshToken: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (route === 'rank-game-completed') {
    const username = req.headers.get('x-session-username');
    if (!username) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const streamer = await prisma.streamer.findUnique({ where: { username }, select: { id: true } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const result = await recordGameCompleted(streamer.id);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PUT /api/streamer/prize-lists?id=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'prize-lists') {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { username, name, description, visibility, coverUrl, items } = await req.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ error: 'streamer not found' }, { status: 404 });
    const existing = await prisma.prizeList.findFirst({ where: { id, streamerId: streamer.id } });
    if (!existing) return NextResponse.json({ error: 'list not found' }, { status: 404 });
    await prisma.prizeListItem.deleteMany({ where: { prizeListId: id } });
    const list = await prisma.prizeList.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description !== undefined ? (description ?? null) : existing.description,
        visibility: visibility ?? existing.visibility,
        coverUrl: coverUrl !== undefined ? (coverUrl ?? null) : existing.coverUrl,
        items: {
          create: (items ?? []).map((p: { name: string; description?: string; imageUrl?: string; quantity: number; pscValue?: number; skipPsc?: boolean; order: number }, i: number) => ({
            name: p.name,
            description: p.description ?? null,
            imageUrl: p.imageUrl ?? null,
            quantity: p.quantity,
            pscValue: p.pscValue ?? null,
            skipPsc: p.skipPsc ?? false,
            order: p.order ?? i,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(list);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// PATCH /api/streamer/balance
// PATCH /api/streamer/config
// PATCH /api/streamer/preferences
// PATCH /api/streamer/delivery
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'balance') {
    const { username, pscBalance } = await req.json();
    if (!username || pscBalance === undefined)
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    const streamer = await prisma.streamer.update({ where: { username }, data: { pscBalance } });
    return NextResponse.json({ pscBalance: streamer.pscBalance });
  }

  if (route === 'config') {
    const body = await req.json();
    const { username, ...config } = body;
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.update({ where: { username }, data: config });
    return NextResponse.json({
      twitchChannel: streamer.twitchChannel,
      registrationCommand: streamer.registrationCommand,
      claimCommand: streamer.claimCommand,
      validationTimeout: streamer.validationTimeout,
    });
  }

  if (route === 'preferences') {
    const { username, ...prefs } = await req.json();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.upsert({
      where: { username },
      update: prefs,
      create: { username, passwordHash: '', ...prefs },
    });
    return NextResponse.json({
      audioEnabled: streamer.audioEnabled,
      excelImportEnabled: streamer.excelImportEnabled,
      excelPrizesImportEnabled: streamer.excelPrizesImportEnabled,
      eventMusic: streamer.eventMusic,
      eventEffect: streamer.eventEffect,
      spinEffect: streamer.spinEffect,
      themeColor: streamer.themeColor,
      socoChuteModeEnabled: streamer.socoChuteModeEnabled,
      raffleTriggerMode: streamer.raffleTriggerMode,
      autoRoundDelay: streamer.autoRoundDelay,
      chatTriggerCount: streamer.chatTriggerCount,
      chatTriggerCommand: streamer.chatTriggerCommand,
      raffleAnimationStyle: streamer.raffleAnimationStyle,
    });
  }

  if (route === 'delivery') {
    const { historyId, tradeLink, deliveryStatus, deliveryAddress } = await req.json();
    if (!historyId) return NextResponse.json({ error: 'historyId required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (tradeLink !== undefined) data.tradeLink = tradeLink || null;
    if (deliveryStatus !== undefined) {
      data.deliveryStatus = deliveryStatus;
      if (deliveryStatus === 'tradelocked') {
        const current = await prisma.raffleHistory.findUnique({ where: { id: historyId }, select: { tradeLockAt: true } });
        if (!current?.tradeLockAt) data.tradeLockAt = new Date();
      }
    }
    const updated = await prisma.raffleHistory.update({ where: { id: historyId }, data });
    if (deliveryAddress !== undefined) {
      await ensureDeliveryAddressColumn();
      await prisma.$executeRaw`UPDATE "RaffleHistory" SET "deliveryAddress" = ${deliveryAddress || null} WHERE id = ${historyId}`;
    }
    return NextResponse.json({ ok: true, tradeLockAt: updated.tradeLockAt?.getTime() ?? null });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// DELETE /api/streamer/history?username=xxx
// DELETE /api/streamer/prize-lists?id=xxx&username=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'history') {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ ok: true });
    await prisma.raffleHistory.deleteMany({ where: { streamerId: streamer.id } });
    return NextResponse.json({ ok: true });
  }

  if (route === 'prize-lists') {
    const id = req.nextUrl.searchParams.get('id');
    const username = req.nextUrl.searchParams.get('username');
    if (!id || !username) return NextResponse.json({ error: 'id and username required' }, { status: 400 });
    const streamer = await prisma.streamer.findUnique({ where: { username } });
    if (!streamer) return NextResponse.json({ ok: true });
    await prisma.prizeList.deleteMany({ where: { id, streamerId: streamer.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
