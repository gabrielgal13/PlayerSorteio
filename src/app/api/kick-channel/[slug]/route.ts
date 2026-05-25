import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
    }

    const data = await res.json();
    const chatroomId: number | undefined = data?.chatroom?.id;

    if (!chatroomId) {
      return Response.json({ error: 'chatroom_id não encontrado' }, { status: 404 });
    }

    return Response.json({ chatroomId });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
