import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (!secret || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    include: { syncCursor: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    channels: channels.map((c) => ({
      id: c.id,
      title: c.title,
      username: c.username,
      telegramId: c.telegramId,
      slug: c.slug,
      autoSync: c.autoSync,
      isValidated: c.isValidated,
      lastMessageId: c.syncCursor?.lastMessageId?.toString() ?? "0",
    })),
  });
}
