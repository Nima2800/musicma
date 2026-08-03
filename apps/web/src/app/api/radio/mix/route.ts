import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrack, toPlayerTrack } from "@/lib/serialize";

type Body = {
  channelIds?: string[];
  likesOnly?: boolean;
  likedIds?: string[];
  excludeIds?: string[];
  limit?: number;
};

/**
 * Build a radio mix: prefer unheard + newest, optional channel/likes filters.
 */
export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const limit = Math.min(60, Math.max(8, body.limit || 28));
  const likesOnly = Boolean(body.likesOnly);
  const likedIds = [...new Set((body.likedIds || []).filter(Boolean))];
  const excludeIds = new Set((body.excludeIds || []).filter(Boolean));
  const channelIds = [...new Set((body.channelIds || []).filter(Boolean))];

  if (likesOnly && likedIds.length === 0) {
    return NextResponse.json({
      tracks: [],
      meta: { reason: "no_likes", message: "هنوز آهنگی لایک نکرده‌ای." },
    });
  }

  const where = {
    isAvailable: true,
    isPublished: true,
    ...(likesOnly ? { id: { in: likedIds.slice(0, 400) } } : {}),
    ...(channelIds.length ? { channelId: { in: channelIds } } : {}),
  };

  const rows = await prisma.track.findMany({
    where,
    include: { channel: { select: { slug: true, title: true, username: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: likesOnly ? Math.min(400, likedIds.length) : 220,
  });

  if (!rows.length) {
    return NextResponse.json({
      tracks: [],
      meta: { reason: "empty", message: "با این فیلترها آهنگی پیدا نشد." },
    });
  }

  const scored = rows.map((t, i) => {
    const heard = excludeIds.has(t.id);
    // Newer rows come first from query; keep that signal, boost unheard heavily.
    const recency = rows.length - i;
    const score = (heard ? 0 : 10_000) + recency * 3 + Math.random() * 40;
    return { t, heard, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Keep some variety: take top unheard chunk, then sprinkle a few heard if needed.
  const unheard = scored.filter((x) => !x.heard).map((x) => x.t);
  const heard = scored.filter((x) => x.heard).map((x) => x.t);
  const mixed = [...unheard, ...heard].slice(0, limit);

  // Soft shuffle inside windows of 5 so order stays roughly fresh-first.
  const windowed: typeof mixed = [];
  for (let i = 0; i < mixed.length; i += 5) {
    const chunk = mixed.slice(i, i + 5);
    for (let j = chunk.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [chunk[j], chunk[k]] = [chunk[k], chunk[j]];
    }
    windowed.push(...chunk);
  }

  return NextResponse.json({
    tracks: windowed.map((t) => toPlayerTrack(serializeTrack(t))),
    meta: {
      totalCandidates: rows.length,
      unheardCount: unheard.length,
      likesOnly,
      channelCount: channelIds.length,
    },
  });
}
