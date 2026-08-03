import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { callStream } from "@/lib/stream";

const schema = z.object({
  query: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { res, data } = await callStream("/validate-channel", {
    method: "POST",
    json: { query: parsed.data.query.trim() },
  });

  return NextResponse.json(data, { status: res.status });
}
