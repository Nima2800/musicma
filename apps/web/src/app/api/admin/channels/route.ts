import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { serializeChannel } from "@/lib/serialize";

const createSchema = z.object({
  title: z.string().min(1),
  username: z.string().optional().nullable(),
  telegramId: z.string().min(1),
  coverUrl: z.string().min(1).optional().nullable(),
  isValidated: z.boolean().optional(),
  autoSync: z.boolean().optional(),
});

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    include: {
      _count: { select: { tracks: true } },
      syncCursor: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    channels: channels.map((c) => ({
      ...serializeChannel(c),
      isActive: c.isActive,
      isValidated: c.isValidated,
      autoSync: c.autoSync,
      lastMessageId: c.syncCursor?.lastMessageId?.toString() ?? "0",
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.channel.findUnique({
    where: { telegramId: parsed.data.telegramId },
  });
  if (existing) {
    const updated = await prisma.channel.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title,
        username: parsed.data.username || null,
        coverUrl: parsed.data.coverUrl || null,
        isValidated: parsed.data.isValidated ?? true,
        autoSync: parsed.data.autoSync ?? existing.autoSync,
        isActive: true,
      },
      include: { _count: { select: { tracks: true } }, syncCursor: true },
    });
    return NextResponse.json({
      channel: {
        ...serializeChannel(updated),
        isValidated: updated.isValidated,
        autoSync: updated.autoSync,
        lastMessageId: updated.syncCursor?.lastMessageId?.toString() ?? "0",
      },
    });
  }

  const baseSlug = slugify(parsed.data.username || parsed.data.title);
  let slug = baseSlug;
  let i = 1;
  while (await prisma.channel.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const channel = await prisma.channel.create({
    data: {
      title: parsed.data.title,
      username: parsed.data.username || null,
      telegramId: parsed.data.telegramId,
      coverUrl: parsed.data.coverUrl || null,
      slug,
      isValidated: parsed.data.isValidated ?? true,
      autoSync: parsed.data.autoSync ?? true,
      syncCursor: { create: { lastMessageId: BigInt(0) } },
    },
    include: { _count: { select: { tracks: true } }, syncCursor: true },
  });

  return NextResponse.json(
    {
      channel: {
        ...serializeChannel(channel),
        isValidated: channel.isValidated,
        autoSync: channel.autoSync,
        lastMessageId: channel.syncCursor?.lastMessageId?.toString() ?? "0",
      },
    },
    { status: 201 },
  );
}

const patchSchema = z.object({
  id: z.string().min(1),
  autoSync: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const channel = await prisma.channel.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.autoSync === undefined ? {} : { autoSync: parsed.data.autoSync }),
      ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
    },
    include: { _count: { select: { tracks: true } }, syncCursor: true },
  });

  return NextResponse.json({
    channel: {
      ...serializeChannel(channel),
      isValidated: channel.isValidated,
      autoSync: channel.autoSync,
      lastMessageId: channel.syncCursor?.lastMessageId?.toString() ?? "0",
    },
  });
}
