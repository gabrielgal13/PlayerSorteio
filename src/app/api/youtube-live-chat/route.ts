import { NextRequest } from 'next/server';
import { LiveChat } from 'youtube-chat';
import type { ChatItem, MessageItem } from 'youtube-chat/dist/types/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BufMsg = { cursor: number; id: string; name: string; text: string };

type Session = {
  liveChat: LiveChat;
  liveId: string | null;
  buffer: BufMsg[];
  nextCursor: number;
  lastAccess: number;
};

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const BUFFER_CAP = 500;

type GlobalCache = {
  sessions: Map<string, Session>;
  cleanupStarted: boolean;
};

const g = globalThis as unknown as { __ytChat?: GlobalCache };
if (!g.__ytChat) g.__ytChat = { sessions: new Map(), cleanupStarted: false };
const cache = g.__ytChat;

if (!cache.cleanupStarted) {
  cache.cleanupStarted = true;
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, s] of cache.sessions) {
      if (now - s.lastAccess > SESSION_TIMEOUT_MS) {
        try { s.liveChat.stop(); } catch { /* ignore */ }
        cache.sessions.delete(k);
      }
    }
  }, 60_000);
  (t as unknown as { unref?: () => void }).unref?.();
}

function msgItemsToText(items: MessageItem[]): string {
  return items.map(it => ('text' in it ? it.text : (it.emojiText ?? ''))).join('');
}

async function getOrCreate(handleInput: string): Promise<Session | { error: string; status: number }> {
  const clean = handleInput.replace(/^@/, '');
  const key = clean.toLowerCase();

  const existing = cache.sessions.get(key);
  if (existing) {
    existing.lastAccess = Date.now();
    return existing;
  }

  const liveChat = new LiveChat({ handle: clean });
  const session: Session = {
    liveChat,
    liveId: null,
    buffer: [],
    nextCursor: 0,
    lastAccess: Date.now(),
  };

  liveChat.on('start', (liveId) => { session.liveId = liveId; });
  liveChat.on('end', () => { session.liveId = null; });
  liveChat.on('error', (err) => { console.warn('[yt-chat]', err); });
  liveChat.on('chat', (chatItem: ChatItem) => {
    const text = msgItemsToText(chatItem.message);
    if (!text) return;
    session.buffer.push({
      cursor: session.nextCursor++,
      id: chatItem.id,
      name: chatItem.author.name,
      text,
    });
    if (session.buffer.length > BUFFER_CAP) session.buffer.shift();
  });

  let ok = false;
  try {
    ok = await liveChat.start();
  } catch (e) {
    return { error: `Falha ao conectar: ${String(e)}`, status: 500 };
  }
  if (!ok) {
    try { liveChat.stop(); } catch { /* ignore */ }
    return { error: 'Nenhuma live ativa', status: 404 };
  }

  cache.sessions.set(key, session);
  return session;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const handle = searchParams.get('handle');
  const liveChatId = searchParams.get('liveChatId');
  const pageToken = searchParams.get('pageToken');

  const handleKey = handle ?? liveChatId;
  if (!handleKey) {
    return Response.json({ error: 'handle ou liveChatId necessário' }, { status: 400 });
  }

  const result = await getOrCreate(handleKey);
  if ('error' in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const session = result;
  const parsed = pageToken ? parseInt(pageToken, 10) : NaN;
  const lastCursor = Number.isFinite(parsed) ? parsed : -1;

  const newMsgs = session.buffer.filter(m => m.cursor > lastCursor);
  const maxCursor = newMsgs.length > 0
    ? newMsgs[newMsgs.length - 1].cursor
    : lastCursor;

  return Response.json({
    liveChatId: handleKey.replace(/^@/, '').toLowerCase(),
    messages: newMsgs.map(m => ({
      id: m.id,
      authorDetails: { displayName: m.name },
      snippet: { displayMessage: m.text },
    })),
    nextPageToken: String(maxCursor),
    pollingIntervalMillis: 3000,
  });
}
