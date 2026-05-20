import type { NextRequest } from 'next/server';

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
      next: { revalidate: 0 },
    });

    if (!res.ok) return Response.json({ isLive: false, viewerCount: 0 });

    const data = await res.json();
    const livestream = data?.livestream;

    return Response.json({
      isLive: Boolean(livestream),
      viewerCount: livestream?.viewer_count ?? 0,
    });
  } catch {
    return Response.json({ isLive: false, viewerCount: 0 });
  }
}
