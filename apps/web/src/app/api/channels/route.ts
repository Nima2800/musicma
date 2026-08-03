import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeChannel } from "@/lib/serialize";

export async function GET() {
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    include: { _count: { select: { tracks: { where: { isAvailable: true } } } } },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ channels: channels.map(serializeChannel) });
}
