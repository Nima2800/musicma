import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import {
  getTelegramCredentials,
  maskSecret,
  setSetting,
  SETTING_KEYS,
} from "@/lib/settings";
import { callStream } from "@/lib/stream";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiId, apiHash } = await getTelegramCredentials();
  let telegram: Record<string, unknown> = {
    configured: Boolean(apiId && apiHash),
    connected: false,
    authorized: false,
  };
  try {
    const status = await callStream("/telegram/status", { method: "GET" });
    if (status.res.ok) telegram = status.data as Record<string, unknown>;
  } catch {
    // worker offline
  }

  return NextResponse.json({
    apiId: apiId || "",
    apiHashMasked: maskSecret(apiHash),
    hasApiHash: Boolean(apiHash),
    telegram,
  });
}

const saveSchema = z.object({
  apiId: z.string().min(1),
  apiHash: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const current = await getTelegramCredentials();
  const apiHash = parsed.data.apiHash || current.apiHash;
  if (!apiHash) {
    return NextResponse.json({ error: "apiHash required" }, { status: 400 });
  }

  await setSetting(SETTING_KEYS.apiId, parsed.data.apiId.trim());
  await setSetting(SETTING_KEYS.apiHash, apiHash.trim());

  const { res, data } = await callStream("/telegram/configure", {
    method: "POST",
    json: {
      apiId: Number(parsed.data.apiId.trim()),
      apiHash: apiHash.trim(),
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: data.detail || data.error || "Worker configure failed", telegram: data },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true, telegram: data });
}
