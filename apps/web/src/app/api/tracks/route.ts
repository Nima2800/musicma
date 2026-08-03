import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrack } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 24)));
  const skip = (page - 1) * limit;

  const where = {
    isAvailable: true,
    ...(channel
      ? {
          channel: {
            OR: [{ slug: channel }, { id: channel }],
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { artist: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [tracks, total] = await Promise.all([
    prisma.track.findMany({
      where,
      include: { channel: { select: { slug: true, title: true, username: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.track.count({ where }),
  ]);

  return NextResponse.json({
    tracks: tracks.map(serializeTrack),
    page,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
