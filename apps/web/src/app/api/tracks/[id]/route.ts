import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrack } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const track = await prisma.track.findUnique({
    where: { id },
    include: { channel: { select: { slug: true, title: true, username: true } } },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  return NextResponse.json({ track: serializeTrack(track) });
}
