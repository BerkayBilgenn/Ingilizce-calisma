import { NextRequest, NextResponse } from "next/server";
import { readyDb, sessionId } from "@/lib/server";
import { setDailyCheck } from "@/lib/store";
import { istanbulDay } from "@/lib/study";

export async function POST(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(body?.wordId) || typeof body?.checked !== "boolean") return NextResponse.json({ error: "Geçersiz kart." }, { status: 400 });
  try {
    await setDailyCheck(await readyDb(), participantId, body.wordId, body.checked, istanbulDay(new Date()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kart kaydedilemedi." }, { status: 400 });
  }
}
