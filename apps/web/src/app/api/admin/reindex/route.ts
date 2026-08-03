import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { callStream } from "@/lib/stream";

const schema = z.object({
  channelId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  mode: z.enum(["latest", "catchup"]).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { res, data } = await callStream("/reindex", {
    method: "POST",
    json: {
      channelId: parsed.data.channelId,
      limit: parsed.data.limit ?? 10,
      mode: parsed.data.mode ?? "latest",
    },
  });

  return NextResponse.json(data, { status: res.status });
}
