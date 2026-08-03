import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const track = await prisma.track.findUnique({
    where: { id },
    include: { channel: true },
  });

  if (!track || !track.isAvailable) {
    return NextResponse.json({ error: "Track unavailable" }, { status: 404 });
  }

  const streamBase = process.env.STREAM_SERVICE_URL || "http://localhost:8090";
  const range = req.headers.get("range");

  const upstream = await fetch(`${streamBase}/stream/${id}`, {
    headers: {
      ...(range ? { Range: range } : {}),
      "X-Ingest-Secret": process.env.INGEST_SECRET || "",
      "X-Telegram-Channel-Id": track.channel.telegramId,
      "X-Telegram-Message-Id": String(track.telegramMessageId),
      "X-Telegram-File-Id": track.telegramFileId ? String(track.telegramFileId) : "",
      "X-Telegram-Access-Hash": track.telegramAccessHash || "",
      "X-Mime-Type": track.mimeType || "audio/mpeg",
      "X-File-Size": track.fileSize ? String(track.fileSize) : "",
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Upstream stream failed", detail: text.slice(0, 200) },
      { status: upstream.status || 502 },
    );
  }

  const headers = new Headers();
  const pass = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
  ];
  for (const key of pass) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (!headers.has("accept-ranges")) headers.set("Accept-Ranges", "bytes");
  if (!headers.has("content-type")) {
    headers.set("Content-Type", track.mimeType || "audio/mpeg");
  }
  headers.set("Cache-Control", "private, max-age=60");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
