import { NextRequest, NextResponse } from "next/server";
import { readyDb, sessionId } from "@/lib/server";
import { getLearnedWords } from "@/lib/store";

export async function GET(request: NextRequest) {
  const participantId = sessionId(request);
  if (!participantId) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 });
  try {
    return NextResponse.json({ words: await getLearnedWords(await readyDb(), participantId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kelimeler yüklenemedi." }, { status: 400 });
  }
}
