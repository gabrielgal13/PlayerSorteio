import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');
  if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  if (!YT_KEY) return Response.json({ isLive: false, viewerCount: 0 });

  try {
    const clean = handle.replace(/^@/, '');

    // 1. Resolve handle → channel ID
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(clean)}&key=${YT_KEY}`,
      { next: { revalidate: 0 } },
    );
    const chData = await chRes.json();
    const channelId: string | undefined = chData?.items?.[0]?.id;
    if (!channelId) return Response.json({ isLive: false, viewerCount: 0 });

    // 2. Find active live stream on this channel
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${YT_KEY}`,
      { next: { revalidate: 0 } },
    );
    const searchData = await searchRes.json();
    const videoId: string | undefined = searchData?.items?.[0]?.id?.videoId;
    if (!videoId) return Response.json({ isLive: false, viewerCount: 0 });

    // 3. Get concurrent viewer count
    const vidRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${YT_KEY}`,
      { next: { revalidate: 0 } },
    );
    const vidData = await vidRes.json();
    const rawViewers: string | undefined = vidData?.items?.[0]?.liveStreamingDetails?.concurrentViewers;

    return Response.json({
      isLive: true,
      viewerCount: rawViewers ? parseInt(rawViewers, 10) : 0,
    });
  } catch {
    return Response.json({ isLive: false, viewerCount: 0 });
  }
}
