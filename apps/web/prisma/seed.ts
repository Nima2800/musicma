import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const channel = await prisma.channel.upsert({
    where: { telegramId: "-1000000000000" },
    create: {
      title: "Demo Lounge",
      username: "demo_lounge",
      telegramId: "-1000000000000",
      slug: "demo-lounge",
      syncCursor: { create: { lastMessageId: BigInt(0) } },
    },
    update: { title: "Demo Lounge", isActive: true },
  });

  await prisma.track.upsert({
    where: { telegramFileUniqueId: "demo-file-unique-1" },
    create: {
      title: "Midnight Warmup",
      artist: "Musicma Demo",
      duration: 180,
      mimeType: "audio/mpeg",
      fileSize: BigInt(1024),
      channelId: channel.id,
      telegramMessageId: BigInt(1),
      telegramFileId: BigInt(1),
      telegramFileUniqueId: "demo-file-unique-1",
      telegramAccessHash: "0",
      slug: "midnight-warmup-1",
      isAvailable: true,
    },
    update: {
      title: "Midnight Warmup",
      isAvailable: true,
    },
  });

  console.log("Seeded demo channel:", channel.slug);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
