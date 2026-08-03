import type { Channel, Track } from "@prisma/client";
import { syntheticWaveform, telegramPostUrl } from "@/lib/metadata";

export type PublicTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  mimeType: string | null;
  coverUrl: string | null;
  caption: string | null;
  genre: string | null;
  mood: string | null;
  year: number | null;
  language: string | null;
  isRemix: boolean;
  isInstrumental: boolean;
  bitrate: number | null;
  quality: string | null;
  waveformPeaks: number[] | null;
  telegramPostUrl: string | null;
  publishedAt: string | null;
  channelId: string;
  channelSlug?: string;
  channelTitle?: string;
  channelUsername?: string | null;
  slug: string;
  playCount: number;
  likeCount: number;
  isFeatured: boolean;
  isPublished: boolean;
  isAvailable: boolean;
  createdAt: string;
};

export type PublicChannel = {
  id: string;
  title: string;
  username: string | null;
  slug: string;
  telegramId?: string;
  coverUrl: string | null;
  trackCount?: number;
  lastIndexedAt: string | null;
};

export function serializeTrack(
  track: Track & {
    channel?: Pick<Channel, "slug" | "title" | "username">;
  },
): PublicTrack {
  const peaks =
    (Array.isArray(track.waveformPeaks) ? (track.waveformPeaks as number[]) : null) ||
    syntheticWaveform(track.id);

  const postUrl =
    track.telegramPostUrl ||
    telegramPostUrl(track.channel?.username, track.telegramMessageId.toString());

  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    mimeType: track.mimeType,
    coverUrl: track.coverPath ? `/api/covers/${track.id}` : null,
    caption: track.caption,
    genre: track.genre,
    mood: track.mood,
    year: track.year,
    language: track.language,
    isRemix: track.isRemix,
    isInstrumental: track.isInstrumental,
    bitrate: track.bitrate,
    quality: track.quality,
    waveformPeaks: peaks,
    telegramPostUrl: postUrl,
    publishedAt: track.publishedAt?.toISOString() ?? null,
    channelId: track.channelId,
    channelSlug: track.channel?.slug,
    channelTitle: track.channel?.title,
    channelUsername: track.channel?.username ?? null,
    slug: track.slug,
    playCount: track.playCount,
    likeCount: track.likeCount,
    isFeatured: track.isFeatured,
    isPublished: track.isPublished,
    isAvailable: track.isAvailable,
    createdAt: track.createdAt.toISOString(),
  };
}

export function channelAvatarUrl(channel: Pick<Channel, "id" | "telegramId" | "coverUrl">) {
  if (channel.coverUrl) return channel.coverUrl;
  return `/api/channel-avatars/${channel.telegramId || channel.id}`;
}

export function serializeChannel(
  channel: Channel & { _count?: { tracks: number } },
): PublicChannel {
  return {
    id: channel.id,
    title: channel.title,
    username: channel.username,
    slug: channel.slug,
    telegramId: channel.telegramId,
    coverUrl: channelAvatarUrl(channel),
    trackCount: channel._count?.tracks,
    lastIndexedAt: channel.lastIndexedAt?.toISOString() ?? null,
  };
}

export function toPlayerTrack(track: PublicTrack) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    coverUrl: track.coverUrl,
    channelId: track.channelId,
    channelTitle: track.channelTitle,
    channelSlug: track.channelSlug,
    channelUsername: track.channelUsername,
    caption: track.caption,
    telegramPostUrl: track.telegramPostUrl,
    waveformPeaks: track.waveformPeaks,
    mood: track.mood,
    genre: track.genre,
    album: track.album,
    playCount: track.playCount,
    likeCount: track.likeCount,
  };
}
