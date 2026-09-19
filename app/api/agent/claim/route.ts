import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot, claimSlot, formatMessage, slotKey } from "@/lib/agent";
import { istanbulDay } from "@/lib/study";
import { readyDb, secureMatch } from "@/lib/server";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureMatch(auth, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const force = request.nextUrl.searchParams.get("force") === "1";
  const key = force ? `manual-${Date.now()}` : slotKey(new Date());
  if (!key) return NextResponse.json({ skip: true, reason: "slot_closed" });
  const db = await readyDb();
  const message = formatMessage(await buildSnapshot(db, istanbulDay(new Date())));
  const claimed = await claimSlot(db, key, message);
  if (!claimed) return NextResponse.json({ skip: true, reason: "already_claimed", slotKey: key });
  return NextResponse.json(message ? { slotKey: key, message } : { skip: true, slotKey: key });
}
