import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

function localAvatarPaths(telegramId: string) {
  const base = path.join(/*turbopackIgnore: true*/ dataDir(), "channel-avatars");
  return [
    path.join(base, `${telegramId}.jpg`),
    path.join(base, `${telegramId}.jpeg`),
    path.join(base, `${telegramId}.png`),
    path.join(base, `${telegramId}.webp`),
  ];
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const channel = await prisma.channel.findFirst({
    where: {
      OR: [{ id }, { telegramId: id }],
    },
  });

  const telegramId = channel?.telegramId || id;

  for (const filePath of localAvatarPaths(telegramId)) {
    if (existsSync(filePath)) {
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      const ext = path.extname(filePath).toLowerCase();
      const type =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  const streamBase = process.env.STREAM_SERVICE_URL || "http://localhost:8090";
  const upstream = await fetch(
    `${streamBase}/channel-avatars/${encodeURIComponent(telegramId)}`,
    {
      headers: { "X-Ingest-Secret": process.env.INGEST_SECRET || "" },
    },
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Avatar missing" }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
