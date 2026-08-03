import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  trackId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  try {
    await prisma.track.update({
      where: { id: parsed.data.trackId },
      data: { playCount: { increment: 1 } },
    });

    if (prisma.playEvent) {
      await prisma.playEvent.create({ data: { trackId: parsed.data.trackId } }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
