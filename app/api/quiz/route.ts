import { NextRequest, NextResponse } from "next/server";
import { readyDb, sessionId } from "@/lib/server";
import { answerQuiz, getQuizDay, getQuizOverview } from "@/lib/store";
import { istanbulDay } from "@/lib/study";

export async function GET(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const rawDay = request.nextUrl.searchParams.get("day");
  const today = istanbulDay(new Date());
  try {
    const db = await readyDb();
    if (rawDay === null) return NextResponse.json({ days: await getQuizOverview(db, participantId, today) });
    const quizDay = Number(rawDay);
    if (!Number.isSafeInteger(quizDay)) return NextResponse.json({ error: "Geçersiz quiz günü." }, { status: 400 });
    return NextResponse.json(await getQuizDay(db, participantId, quizDay, today));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Quiz yüklenemedi." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(body?.wordId) || typeof body?.selectedMeaning !== "string") {
    return NextResponse.json({ error: "Geçersiz quiz cevabı." }, { status: 400 });
  }
  try {
    return NextResponse.json(await answerQuiz(await readyDb(), participantId, body.wordId, body.selectedMeaning, istanbulDay(new Date())));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cevap kaydedilemedi." }, { status: 400 });
  }
}
