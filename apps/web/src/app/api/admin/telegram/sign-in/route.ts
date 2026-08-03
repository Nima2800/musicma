import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth";
import { callStream } from "@/lib/stream";

const schema = z.object({
  phone: z.string().min(5),
  code: z.string().min(1),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { res, data } = await callStream("/telegram/sign-in", {
    method: "POST",
    json: parsed.data,
  });

  return NextResponse.json(data, { status: res.status });
}
