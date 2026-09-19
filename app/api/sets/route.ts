import { NextRequest, NextResponse } from "next/server";
import { readyDb, sessionId } from "@/lib/server";
import { createSet, getParticipant, type WordInput } from "@/lib/store";
import { istanbulDay } from "@/lib/study";

export async function POST(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const db = await readyDb();
  const person = await getParticipant(db, participantId);
  if (person?.role !== "admin") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.words)) return NextResponse.json({ error: "Kelime listesi gerekli." }, { status: 400 });
  try {
    const setId = await createSet(db, participantId, body.words as WordInput[], istanbulDay(new Date()));
    return NextResponse.json({ ok: true, setId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Liste kaydedilemedi." }, { status: 400 });
  }
}
