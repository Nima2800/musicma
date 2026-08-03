import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeTrack } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const tracks = await prisma.track.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { artist: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { channel: { select: { title: true, slug: true, username: true } } },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ tracks: tracks.map(serializeTrack) });
}

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  artist: z.string().nullable().optional(),
  album: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  language: z.string().nullable().optional(),
  isRemix: z.boolean().optional(),
  isInstrumental: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  caption: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { id, ...data } = parsed.data;
  const track = await prisma.track.update({
    where: { id },
    data,
    include: { channel: { select: { title: true, slug: true, username: true } } },
  });
  return NextResponse.json({ track: serializeTrack(track) });
}
