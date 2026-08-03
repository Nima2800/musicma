import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  channelTelegramId: z.string().min(1),
  coverUrl: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (!secret || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({
    where: { telegramId: parsed.data.channelTelegramId },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const updated = await prisma.channel.update({
    where: { id: channel.id },
    data: { coverUrl: parsed.data.coverUrl },
  });

  return NextResponse.json({ ok: true, id: updated.id, coverUrl: updated.coverUrl });
}
