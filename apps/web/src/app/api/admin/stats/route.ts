import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [tracks, channels, topTracks, broken, unpublished] = await Promise.all([
    prisma.track.count(),
    prisma.channel.count({ where: { isActive: true } }),
    prisma.track.findMany({
      orderBy: { playCount: "desc" },
      take: 5,
      select: { id: true, title: true, playCount: true, artist: true },
    }),
    prisma.track.count({ where: { isAvailable: false } }),
    prisma.track.count({ where: { isPublished: false } }),
  ]);

  let playsWeek = 0;
  try {
    if (prisma.playEvent) {
      playsWeek = await prisma.playEvent.count({
        where: { createdAt: { gte: weekAgo } },
      });
    }
  } catch {
    playsWeek = 0;
  }

  return NextResponse.json({
    tracks,
    channels,
    playsWeek,
    topTracks,
    broken,
    unpublished,
  });
}
