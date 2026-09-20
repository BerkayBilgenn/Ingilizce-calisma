import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot, claimLearningNotice, claimSlot, formatMessage, slotKey } from "@/lib/agent";
import { istanbulDay } from "@/lib/study";
import { readyDb, secureMatch } from "@/lib/server";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureMatch(auth, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const force = request.nextUrl.searchParams.get("force") === "1";
  const now = new Date();
  const db = await readyDb();
  if (!force) {
    const notice = await claimLearningNotice(db, now);
    if (notice) return NextResponse.json(notice);
  }
  if (!force && request.nextUrl.searchParams.get("noticesOnly") === "1") return NextResponse.json({ skip: true, reason: "scheduled_paused" });
  const key = force ? `manual-${now.getTime()}` : slotKey(now);
  if (!key) return NextResponse.json({ skip: true, reason: "slot_closed" });
  const message = formatMessage(await buildSnapshot(db, istanbulDay(now)));
  const claimed = await claimSlot(db, key, message);
  if (!claimed) return NextResponse.json({ skip: true, reason: "already_claimed", slotKey: key });
  return NextResponse.json(message ? { slotKey: key, message } : { skip: true, slotKey: key });
}
