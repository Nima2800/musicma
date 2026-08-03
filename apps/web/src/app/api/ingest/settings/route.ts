import { NextRequest, NextResponse } from "next/server";
import { getTelegramCredentials } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-ingest-secret");
  if (!secret || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiId, apiHash } = await getTelegramCredentials();
  return NextResponse.json({
    apiId: apiId ? Number(apiId) : null,
    apiHash: apiHash || null,
  });
}
