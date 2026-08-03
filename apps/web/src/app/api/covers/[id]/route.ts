import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "fs";
import { Readable } from "stream";
import path from "path";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

function resolveLocalCover(coverPath: string) {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (path.isAbsolute(coverPath)) return coverPath;
  return path.join(/*turbopackIgnore: true*/ dataDir, coverPath);
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track?.coverPath) {
    return NextResponse.json({ error: "No cover" }, { status: 404 });
  }

  const filePath = resolveLocalCover(track.coverPath);
  if (existsSync(filePath)) {
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Fallback: cover may live only on the telegram worker volume
  const streamBase = process.env.STREAM_SERVICE_URL || "http://localhost:8090";
  const name = path.basename(track.coverPath);
  const upstream = await fetch(`${streamBase}/covers/${encodeURIComponent(name)}`, {
    headers: { "X-Ingest-Secret": process.env.INGEST_SECRET || "" },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Cover missing" }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
