import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkStock, buyItem } from '@/lib/waxpeer';
import { getDeliveryMode } from '@/lib/prizeDelivery';
import {
  ensureDeliveryAddressColumn,
  saveDeliveryAddress,
  findMissingAddressFields,
  buildMissingFieldsMessage,
  buildAddressConfirmationMessage,
} from '@/lib/deliveryCapture';

const STEAM_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;
const WINNER_CUTOFF_MS = 6 * 60 * 60 * 1000; // 6 h
const LIVE_RECHECK_MS = 10 * 60 * 1000;       // re-detecta live a cada 10 min

// ─── YouTube helpers ──────────────────────────────────────────────────────────

async function getYoutubeAccessToken(): Promise<string | null> {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: ['youtube_bot_access_token', 'youtube_bot_refresh_token'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  let token = map['youtube_bot_access_token'] ?? null;
  const refresh = map['youtube_bot_refresh_token'] ?? null;

  if (!token && !refresh) return null;
  if (token) return token;

  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: refresh!,
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

async function detectLiveChatId(youtubeHandle: string): Promise<string | null> {
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
  const videoData = await videoRes.json() as {
    items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[]
  };
  return videoData.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
}

type ChatMessage = {
  authorDisplayName: string;
  text: string;
};

async function fetchChatPage(
  liveChatId: string,
  pageToken: string | null,
  accessToken: string,
): Promise<{ ok: boolean; nextPageToken: string | null; messages: ChatMessage[] }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
  url.searchParams.set('liveChatId', liveChatId);
  url.searchParams.set('part', 'snippet,authorDetails');
  url.searchParams.set('maxResults', '200');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return { ok: false, nextPageToken: null, messages: [] };

  const data = await res.json() as {
    nextPageToken?: string;
    items?: {
      snippet?: { textMessageDetails?: { messageText?: string }; displayMessage?: string };
      authorDetails?: { displayName?: string };
    }[];
  };

  const messages: ChatMessage[] = (data.items ?? []).map(item => ({
    authorDisplayName: item.authorDetails?.displayName ?? '',
    text: item.snippet?.textMessageDetails?.messageText ?? item.snippet?.displayMessage ?? '',
  }));

  return { ok: true, nextPageToken: data.nextPageToken ?? null, messages };
}

async function sendYoutubeMessage(liveChatId: string, message: string, accessToken: string): Promise<void> {
  try {
    await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: { type: 'textMessageEvent', liveChatId, textMessageDetails: { messageText: message } },
      }),
    });
  } catch { /* ignore */ }
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel sends Authorization: Bearer <CRON_SECRET> automatically
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const accessToken = await getYoutubeAccessToken();
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: 'YouTube bot não autenticado' });
  }

  // Bot name used to detect if a message is directed at the bot
  const botRow = await prisma.appConfig.findUnique({ where: { key: 'youtube_bot_channel_name' } });
  const botName = (botRow?.value ?? process.env.TWITCH_BOT_USERNAME ?? 'PlayerSkinsBOT').toLowerCase();

  const streamers = await prisma.streamer.findMany({
    where: { youtubeChannel: { not: null } },
    select: {
      id: true,
      username: true,
      youtubeChannel: true,
      youtubeLiveChatId: true,
      youtubeNextPageToken: true,
      youtubeLiveChatCheckedAt: true,
    },
  });

  const results: Record<string, unknown>[] = [];

  for (const streamer of streamers) {
    let liveChatId = streamer.youtubeLiveChatId;

    // ── Detect live if needed ──
    if (!liveChatId) {
      const lastCheck = streamer.youtubeLiveChatCheckedAt;
      const shouldRecheck = !lastCheck || Date.now() - lastCheck.getTime() > LIVE_RECHECK_MS;
      if (!shouldRecheck) {
        results.push({ streamer: streamer.username, status: 'not_live_skip' });
        continue;
      }

      liveChatId = await detectLiveChatId(streamer.youtubeChannel!);
      await prisma.streamer.update({
        where: { id: streamer.id },
        data: {
          youtubeLiveChatId: liveChatId ?? null,
          youtubeNextPageToken: null, // reset cursor for new stream
          youtubeLiveChatCheckedAt: new Date(),
        },
      });

      if (!liveChatId) {
        results.push({ streamer: streamer.username, status: 'not_live' });
        continue;
      }
    }

    // ── Fetch chat page ──
    const page = await fetchChatPage(liveChatId, streamer.youtubeNextPageToken, accessToken);

    if (!page.ok) {
      // Live chat ended or token expired — clear it so next run re-detects
      await prisma.streamer.update({
        where: { id: streamer.id },
        data: {
          youtubeLiveChatId: null,
          youtubeNextPageToken: null,
          youtubeLiveChatCheckedAt: new Date(),
        },
      });
      results.push({ streamer: streamer.username, status: 'live_ended' });
      continue;
    }

    // Always advance the cursor first
    await prisma.streamer.update({
      where: { id: streamer.id },
      data: { youtubeNextPageToken: page.nextPageToken },
    });

    // If this was the first fetch (no prior pageToken), skip processing to avoid
    // replaying old messages from before the cron started watching.
    if (!streamer.youtubeNextPageToken) {
      results.push({ streamer: streamer.username, status: 'cursor_initialised', messages: page.messages.length });
      continue;
    }

    if (page.messages.length === 0) {
      results.push({ streamer: streamer.username, status: 'no_new_messages' });
      continue;
    }

    // ── Get pending winners for this streamer ──
    const cutoff = new Date(Date.now() - WINNER_CUTOFF_MS);
    const pendingWinnersRaw = await prisma.raffleHistory.findMany({
      where: {
        streamerId: streamer.id,
        deliveryStatus: { notIn: ['entregue', 'tradelocked'] },
        tradeLink: null,
        timestamp: { gte: cutoff },
        OR: [{ winnerSource: 'youtube' }, { winnerSource: null }],
      },
    });

    // "tradeLink: null" acima também é verdade pra prêmios de endereço (Camisa),
    // que nunca preenchem esse campo — filtramos os que já têm endereço salvo.
    let pendingWinners = pendingWinnersRaw;
    if (pendingWinnersRaw.length > 0) {
      await ensureDeliveryAddressColumn();
      const ids = pendingWinnersRaw.map(w => w.id);
      const addrRows = await prisma.$queryRaw<Array<{ id: string; deliveryAddress: string | null }>>`
        SELECT id, "deliveryAddress" FROM "RaffleHistory" WHERE id = ANY(${ids})
      `;
      const addressDoneIds = new Set(addrRows.filter(r => r.deliveryAddress).map(r => r.id));
      pendingWinners = pendingWinnersRaw.filter(w => !addressDoneIds.has(w.id));
    }

    const winnerMap = new Map(pendingWinners.map(w => [w.winnerName.toLowerCase(), w]));
    let processed = 0;

    for (const msg of page.messages) {
      const sender = msg.authorDisplayName.toLowerCase();
      const winner = winnerMap.get(sender);

      if (!winner) continue; // Not a pending winner — ignore

      const mode = getDeliveryMode(winner.prizeName);

      // ── Prêmio físico (Camisa) — coleta endereço (e camisa escolhida) em vez de trade link ──
      // "winner" já veio filtrado pelo nick exato do ganhador (winnerMap acima) —
      // mensagens de qualquer outra pessoa nem chegam aqui (continue no !winner acima).
      if (mode !== 'trade_link') {
        const text = msg.text.trim();
        const missing = findMissingAddressFields(text, mode);
        if (missing.length === 0) {
          await saveDeliveryAddress(winner.id, text);
          await sendYoutubeMessage(
            liveChatId,
            `@${msg.authorDisplayName} ${buildAddressConfirmationMessage(mode)}`,
            accessToken,
          );
          winnerMap.delete(sender);
          processed++;
        } else if (text.toLowerCase().includes(`@${botName}`)) {
          await sendYoutubeMessage(
            liveChatId,
            `@${msg.authorDisplayName} ${buildMissingFieldsMessage(missing, mode)}`,
            accessToken,
          );
        }
        continue;
      }

      const steamMatch = msg.text.match(STEAM_REGEX);

      if (steamMatch) {
        const tradeLink = steamMatch[0];

        await prisma.raffleHistory.update({
          where: { id: winner.id },
          data: { tradeLink },
        });

        // Compra + entrega P2P direto na Steam do trade link
        if (process.env.WAXPEER_API_KEY && !winner.marketplaceItemId) {
          try {
            let bought: { id: string } | null = null;
            let lastError = '';
            for (let attempt = 1; attempt <= 5; attempt++) {
              const listings = await checkStock(winner.prizeName);
              if (!listings.length) { lastError = 'Item não encontrado'; break; }
              try {
                const result = await buyItem(listings[0], tradeLink, winner.id);
                bought = { id: String(result.id) };
                break;
              } catch (err) {
                lastError = String(err);
                if (attempt < 5) await new Promise(r => setTimeout(r, 500));
              }
            }
            await prisma.raffleHistory.update({
              where: { id: winner.id },
              data: bought
                ? { marketplaceItemId: bought.id, deliveryStatus: 'item_comprado' }
                : { deliveryStatus: 'erro_compra' },
            });
            if (!bought) console.log('[poll-youtube] erro compra:', winner.winnerName, lastError);
          } catch (err) {
            console.error('[poll-youtube] erro inesperado:', err);
          }
        }

        await sendYoutubeMessage(
          liveChatId,
          `@${msg.authorDisplayName} trade link recebido! Em breve você receberá o item. 🎁`,
          accessToken,
        );

        winnerMap.delete(sender); // avoid processing duplicates in same batch
        processed++;
      } else {
        // Winner sent a message but without a valid trade link — check if they mentioned the bot
        const mentionsBot = msg.text.toLowerCase().includes(`@${botName}`);
        if (mentionsBot) {
          await sendYoutubeMessage(
            liveChatId,
            `@${msg.authorDisplayName} link inválido! Envie apenas o trade link Steam no formato: https://steamcommunity.com/tradeoffer/new/?partner=XXXXXXXX&token=XXXXXXXX`,
            accessToken,
          );
        }
      }
    }

    results.push({ streamer: streamer.username, status: 'ok', messagesChecked: page.messages.length, processed });
  }

  return NextResponse.json({ ok: true, results });
}
