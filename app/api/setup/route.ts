import { NextRequest, NextResponse } from "next/server";
import { createInitialSetup, type PersonInput } from "@/lib/store";
import { readyDb, secureMatch } from "@/lib/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!secureMatch(body?.secret, process.env.SETUP_SECRET)) return NextResponse.json({ error: "Kurulum anahtarı yanlış." }, { status: 403 });
  if (!Array.isArray(body?.people)) return NextResponse.json({ error: "İki kişi gerekli." }, { status: 400 });
  try {
    const db = await readyDb();
    await createInitialSetup(db, body.people as PersonInput[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kurulum tamamlanamadı." }, { status: 400 });
  }
}
