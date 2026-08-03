import { prisma } from "@/lib/db";
import { serializeChannel, serializeTrack, toPlayerTrack } from "@/lib/serialize";

const trackInclude = {
  channel: { select: { slug: true, title: true, username: true } },
} as const;

function baseWhere() {
  return { isAvailable: true, isPublished: true };
}

export async function getChannels() {
  try {
    const channels = await prisma.channel.findMany({
      where: { isActive: true },
      include: { _count: { select: { tracks: { where: { isAvailable: true } } } } },
      orderBy: { title: "asc" },
    });
    return channels.map(serializeChannel);
  } catch (err) {
    console.error("getChannels failed", err);
    return [];
  }
}

export type TrackSearchFilters = {
  channel?: string;
  q?: string;
  page?: number;
  limit?: number;
  language?: "fa" | "en" | "other";
  mood?: string;
  genre?: string;
  isRemix?: boolean;
  isInstrumental?: boolean;
  quality?: string;
  sort?: "new" | "old" | "popular";
  from?: string;
  to?: string;
  year?: number;
};

export async function getTracks(opts: TrackSearchFilters = {}) {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(50, Math.max(1, opts.limit || 24));
  const skip = (page - 1) * limit;
  const q = opts.q?.trim();

  const where = {
    ...baseWhere(),
    ...(opts.channel
      ? {
          channel: {
            OR: [{ slug: opts.channel }, { id: opts.channel }],
          },
        }
      : {}),
    ...(opts.language ? { language: opts.language } : {}),
    ...(opts.mood ? { mood: opts.mood } : {}),
    ...(opts.genre ? { genre: { contains: opts.genre, mode: "insensitive" as const } } : {}),
    ...(opts.isRemix === undefined ? {} : { isRemix: opts.isRemix }),
    ...(opts.isInstrumental === undefined ? {} : { isInstrumental: opts.isInstrumental }),
    ...(opts.quality ? { quality: opts.quality } : {}),
    ...(opts.year ? { year: opts.year } : {}),
    ...(opts.from || opts.to
      ? {
          publishedAt: {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { artist: { contains: q, mode: "insensitive" as const } },
            { album: { contains: q, mode: "insensitive" as const } },
            { caption: { contains: q, mode: "insensitive" as const } },
            { genre: { contains: q, mode: "insensitive" as const } },
            { channel: { title: { contains: q, mode: "insensitive" as const } } },
            { channel: { username: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const orderBy =
    opts.sort === "old"
      ? ({ createdAt: "asc" as const } as const)
      : opts.sort === "popular"
        ? ({ playCount: "desc" as const } as const)
        : ({ createdAt: "desc" as const } as const);

  try {
    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where,
        include: trackInclude,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.track.count({ where }),
    ]);

    return {
      tracks: tracks.map(serializeTrack),
      page,
      total,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    console.error("getTracks failed", err);
    return { tracks: [], page, total: 0, totalPages: 0 };
  }
}

async function popularByPlayCount(limit = 12) {
  const fallback = await prisma.track.findMany({
    where: baseWhere(),
    include: trackInclude,
    orderBy: { playCount: "desc" },
    take: limit,
  });
  return fallback.map(serializeTrack);
}

async function topByPlaysSince(since: Date, limit = 12) {
  try {
    if (!prisma.playEvent) return popularByPlayCount(limit);
    const grouped = await prisma.playEvent.groupBy({
      by: ["trackId"],
      where: { createdAt: { gte: since } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: limit,
    });
    if (!grouped.length) return popularByPlayCount(limit);

    const ids = grouped.map((g) => g.trackId);
    const tracks = await prisma.track.findMany({
      where: { id: { in: ids }, ...baseWhere() },
      include: trackInclude,
    });
    const map = new Map(tracks.map((t) => [t.id, t]));
    return ids.map((id) => map.get(id)).filter(Boolean).map((t) => serializeTrack(t!));
  } catch (err) {
    console.error("topByPlaysSince failed", err);
    return popularByPlayCount(limit);
  }
}

export async function getHomeSections() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const FOUR_H = 4 * 60 * 60 * 1000;
  const slot = Math.floor(Date.now() / FOUR_H);
  const featuredNextAt = new Date((slot + 1) * FOUR_H).toISOString();

  // One parallel round-trip instead of many sequential Prisma Cloud calls.
  const [
    channels,
    latest,
    marked,
    topPool,
    topToday,
    topWeek,
    trending,
    recentForChannels,
    artistsRaw,
    moodsRaw,
  ] = await Promise.all([
    getChannels(),
    prisma.track
      .findMany({
        where: baseWhere(),
        include: trackInclude,
        orderBy: { createdAt: "desc" },
        take: 16,
      })
      .catch((err) => {
        console.error("latest tracks failed", err);
        return [] as Awaited<ReturnType<typeof prisma.track.findMany>>;
      }),
    prisma.track
      .findMany({
        where: { ...baseWhere(), isFeatured: true },
        include: trackInclude,
        orderBy: [{ playCount: "desc" }, { updatedAt: "desc" }],
        take: 40,
      })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.track.findMany>>),
    prisma.track
      .findMany({
        where: baseWhere(),
        include: trackInclude,
        orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
        take: 40,
      })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.track.findMany>>),
    topByPlaysSince(dayAgo, 12),
    topByPlaysSince(weekAgo, 12),
    prisma.track
      .findMany({
        where: baseWhere(),
        include: trackInclude,
        orderBy: [{ playCount: "desc" }, { likeCount: "desc" }],
        take: 12,
      })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.track.findMany>>),
    prisma.track
      .findMany({
        where: baseWhere(),
        include: trackInclude,
        orderBy: { createdAt: "desc" },
        take: 48,
      })
      .catch(() => [] as Awaited<ReturnType<typeof prisma.track.findMany>>),
    prisma.track
      .groupBy({
        by: ["artist"],
        where: { ...baseWhere(), artist: { not: null } },
        _count: { artist: true },
        orderBy: { _count: { artist: "desc" } },
        take: 10,
      })
      .catch(() => []),
    prisma.track
      .groupBy({
        by: ["mood"],
        where: { ...baseWhere(), mood: { not: null } },
        _count: { mood: true },
        orderBy: { _count: { mood: "desc" } },
        take: 8,
      })
      .catch(() => []),
  ]);

  const pool = marked.length > 0 ? marked : topPool;
  const featured = pool.length ? pool[slot % pool.length]! : latest[0] ?? null;

  // Fresh-per-channel from one recent list (no N+1).
  const perChannel: ReturnType<typeof serializeTrack>[] = [];
  const seenCh = new Set<string>();
  for (const t of recentForChannels) {
    if (seenCh.has(t.channelId)) continue;
    seenCh.add(t.channelId);
    perChannel.push(serializeTrack(t));
    if (perChannel.length >= 8) break;
  }

  // Lightweight random from already-fetched pool (avoid RANDOM() round-trip).
  const randomSource = trending.length ? trending : latest;
  const randomTracks = [...randomSource]
    .sort(() => Math.random() - 0.5)
    .slice(0, 12)
    .map(serializeTrack);

  const popularArtists = (artistsRaw as { artist: string | null; _count: { artist: number } }[])
    .filter((a) => a.artist)
    .map((a) => ({ name: a.artist!, count: a._count.artist }));

  const popularMoods = (moodsRaw as { mood: string | null; _count: { mood: number } }[])
    .filter((m) => m.mood)
    .map((m) => ({ name: m.mood!, count: m._count.mood }));

  const hero =
    (featured && serializeTrack(featured)) ||
    (latest[0] && serializeTrack(latest[0])) ||
    null;

  return {
    channels,
    hero,
    featuredNextAt,
    latest: latest.map(serializeTrack),
    topToday,
    topWeek,
    trending: (trending.length ? trending : latest).map(serializeTrack),
    freshByChannel: perChannel,
    random: randomTracks,
    popularArtists,
    popularMoods,
  };
}

export { toPlayerTrack };
