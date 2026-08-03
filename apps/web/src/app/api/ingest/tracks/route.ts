import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import {
  cleanTitle,
  detectInstrumental,
  detectRemix,
  guessLanguage,
  guessMood,
  guessQuality,
  parseArtistTitle,
  syntheticWaveform,
  telegramPostUrl,
} from "@/lib/metadata";

const trackSchema = z.object({
  title: z.string().min(1),
  artist: z.string().nullable().optional(),
  album: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().nonnegative().nullable().optional(),
  coverPath: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  language: z.string().nullable().optional(),
  isRemix: z.boolean().optional(),
  isInstrumental: z.boolean().optional(),
  bitrate: z.number().int().nullable().optional(),
  quality: z.string().nullable().optional(),
  waveformPeaks: z.array(z.number()).nullable().optional(),
  fingerprint: z.string().nullable().optional(),
  telegramPostUrl: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  isAvailable: z.boolean().optional(),
  channelTelegramId: z.string().min(1),
  telegramMessageId: z.union([z.number(), z.string()]),
  telegramFileId: z.union([z.number(), z.string()]).nullable().optional(),
  telegramFileUniqueId: z.string().min(1),
  telegramAccessHash: z.string().nullable().optional(),
});

const bodySchema = z.object({
  tracks: z.array(trackSchema).min(1),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (!secret || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const minDuration = Number(process.env.MIN_DURATION_SECONDS || 70);
  let upserted = 0;

  for (const item of parsed.data.tracks) {
    // Ignore short clips (voice notes, previews) — keep only real tracks
    if (item.duration != null && item.duration < minDuration) continue;

    const channel = await prisma.channel.findUnique({
      where: { telegramId: item.channelTelegramId },
    });
    if (!channel) continue;

    const messageId = BigInt(item.telegramMessageId);
    const fileId =
      item.telegramFileId === null || item.telegramFileId === undefined
        ? null
        : BigInt(item.telegramFileId);
    const fileSize =
      item.fileSize === null || item.fileSize === undefined
        ? null
        : BigInt(item.fileSize);

    const blob = `${item.title} ${item.artist || ""} ${item.caption || ""}`;
    const parsedName = parseArtistTitle(item.title);
    const title = cleanTitle(item.title) || parsedName.title;
    const artist = item.artist ?? parsedName.artist;
    const duration = item.duration ?? null;
    const qualityGuess = guessQuality(
      item.fileSize ?? null,
      duration,
    );

    const shared = {
      title,
      artist,
      album: item.album ?? null,
      duration,
      mimeType: item.mimeType ?? null,
      fileSize,
      coverPath: item.coverPath ?? null,
      caption: item.caption ?? null,
      genre: item.genre ?? null,
      mood: item.mood ?? guessMood(blob),
      year: item.year ?? null,
      language: item.language ?? guessLanguage(blob),
      isRemix: item.isRemix ?? detectRemix(blob),
      isInstrumental: item.isInstrumental ?? detectInstrumental(blob),
      bitrate: item.bitrate ?? qualityGuess.bitrate,
      quality: item.quality ?? qualityGuess.quality,
      waveformPeaks: item.waveformPeaks ?? syntheticWaveform(item.telegramFileUniqueId),
      fingerprint: item.fingerprint ?? null,
      telegramPostUrl:
        item.telegramPostUrl ?? telegramPostUrl(channel.username, messageId.toString()),
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      telegramFileId: fileId,
      telegramFileUniqueId: item.telegramFileUniqueId,
      telegramAccessHash: item.telegramAccessHash ?? null,
      isAvailable: item.isAvailable ?? true,
    };

    const byUnique = await prisma.track.findUnique({
      where: { telegramFileUniqueId: item.telegramFileUniqueId },
    });
    const byMessage = await prisma.track.findUnique({
      where: {
        channelId_telegramMessageId: {
          channelId: channel.id,
          telegramMessageId: messageId,
        },
      },
    });

    if (byUnique) {
      await prisma.track.update({ where: { id: byUnique.id }, data: shared });
    } else if (byMessage) {
      await prisma.track.update({ where: { id: byMessage.id }, data: shared });
    } else {
      await prisma.track.create({
        data: {
          ...shared,
          channelId: channel.id,
          telegramMessageId: messageId,
          slug: uniqueSlug(title, String(messageId)),
        },
      });
    }

    await prisma.syncCursor.upsert({
      where: { channelId: channel.id },
      create: { channelId: channel.id, lastMessageId: messageId },
      update: { lastMessageId: messageId },
    });

    await prisma.channel.update({
      where: { id: channel.id },
      data: { lastIndexedAt: new Date() },
    });

    upserted += 1;
  }

  return NextResponse.json({ ok: true, upserted });
}
