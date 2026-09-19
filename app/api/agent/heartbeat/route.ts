import { NextRequest, NextResponse } from "next/server";
import { touchAgent } from "@/lib/agent";
import { readyDb, secureMatch } from "@/lib/server";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureMatch(auth, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  await touchAgent(await readyDb(), Boolean(body.connected), typeof body.groupName === "string" ? body.groupName : undefined, Boolean(body.success));
  return NextResponse.json({ ok: true });
}
