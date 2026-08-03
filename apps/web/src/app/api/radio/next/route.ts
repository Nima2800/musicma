import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrack, toPlayerTrack } from "@/lib/serialize";

/** Suggest similar tracks for Radio Mode. */
export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("trackId");
  const exclude = new Set(
    (req.nextUrl.searchParams.get("exclude") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (trackId) exclude.add(trackId);

  let seed: {
    mood: string | null;
    genre: string | null;
    artist: string | null;
    channelId: string;
  } | null = null;

  if (trackId) {
    seed = await prisma.track.findUnique({
      where: { id: trackId },
      select: { mood: true, genre: true, artist: true, channelId: true },
    });
  }

  const base = { isAvailable: true, isPublished: true, id: { notIn: [...exclude].slice(0, 80) } };

  const or: Record<string, unknown>[] = [];
  if (seed?.mood) or.push({ mood: seed.mood });
  if (seed?.genre) or.push({ genre: { contains: seed.genre, mode: "insensitive" as const } });
  if (seed?.artist) or.push({ artist: { contains: seed.artist, mode: "insensitive" as const } });
  if (seed?.channelId) or.push({ channelId: seed.channelId });

  const tracks = await prisma.track.findMany({
    where: or.length ? { ...base, OR: or } : base,
    include: { channel: { select: { slug: true, title: true, username: true } } },
    orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  if (!tracks.length) {
    const fallback = await prisma.track.findMany({
      where: base,
      include: { channel: { select: { slug: true, title: true, username: true } } },
      orderBy: { playCount: "desc" },
      take: 8,
    });
    return NextResponse.json({
      tracks: fallback.map((t) => toPlayerTrack(serializeTrack(t))),
    });
  }

  // Light shuffle among matches so radio feels fresh.
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  return NextResponse.json({
    tracks: shuffled.map((t) => toPlayerTrack(serializeTrack(t))),
  });
}
