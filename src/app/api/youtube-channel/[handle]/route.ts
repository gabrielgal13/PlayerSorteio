import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ handle: string }> },
) {
  const { handle } = await context.params;
  const YT_KEY = process.env.YOUTUBE_API_KEY;

  if (!YT_KEY) {
    return Response.json({ error: 'YOUTUBE_API_KEY não configurada' }, { status: 503 });
  }

  try {
    const clean = handle.replace(/^@/, '');
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(clean)}&key=${YT_KEY}`,
    );
    const data = await res.json();

    if (!res.ok || !data?.items?.length) {
      return Response.json({ error: 'Canal não encontrado' }, { status: 404 });
    }

    const ch = data.items[0];
    return Response.json({
      id: ch.id,
      handle: `@${clean}`,
      displayName: ch.snippet?.title ?? clean,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
