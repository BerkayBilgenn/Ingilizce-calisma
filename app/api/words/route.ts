import { NextRequest, NextResponse } from "next/server";
import { readyDb, sessionId } from "@/lib/server";
import { addActiveWord, removeActiveWord } from "@/lib/store";
import { istanbulDay } from "@/lib/study";

export async function POST(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.term !== "string" || typeof body?.meaning !== "string") return NextResponse.json({ error: "Kelime ve Türkçesini girin." }, { status: 400 });
  try {
    const wordId = await addActiveWord(await readyDb(), participantId, { term: body.term, meaning: body.meaning }, istanbulDay(new Date()));
    return NextResponse.json({ ok: true, wordId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kelime eklenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(body?.wordId)) return NextResponse.json({ error: "Geçersiz kelime." }, { status: 400 });
  try {
    await removeActiveWord(await readyDb(), participantId, body.wordId, istanbulDay(new Date()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kelime çıkarılamadı." }, { status: 400 });
  }
}
