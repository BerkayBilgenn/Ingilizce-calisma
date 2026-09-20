import { NextRequest, NextResponse } from "next/server";
import { completeLearningNotice, completeSlot } from "@/lib/agent";
import { readyDb, secureMatch } from "@/lib/server";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureMatch(auth, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.slotKey !== "string" || !["sent", "failed", "uncertain"].includes(body?.status)) return NextResponse.json({ error: "Geçersiz gönderim." }, { status: 400 });
  const db = await readyDb();
  const notice = /^notice-([1-9]\d*)$/.exec(body.slotKey);
  if (notice) await completeLearningNotice(db, Number(notice[1]), body.status, body.messageId, body.error);
  else await completeSlot(db, body.slotKey, body.status, body.messageId, body.error);
  return NextResponse.json({ ok: true });
}
