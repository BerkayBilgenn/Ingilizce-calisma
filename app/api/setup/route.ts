import { NextRequest, NextResponse } from "next/server";
import { issueSession } from "@/lib/auth";
import { createInitialSetup, type PersonInput } from "@/lib/store";
import { createSet } from "@/lib/store";
import { readyDb, secureMatch } from "@/lib/server";

function parseWords(raw: string) {
  return raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    if (separator < 1 || !line.slice(separator + 1).trim()) throw new Error("Her satırı İngilizce = Türkçe biçiminde yazın.");
    return { term: line.slice(0, separator).trim(), meaning: line.slice(separator + 1).trim() };
  });
}

function setSession(response: NextResponse, participantId: number) {
  response.cookies.set("session", issueSession(participantId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const formSubmission = (request.headers.get("content-type") || "").includes("application/x-www-form-urlencoded");
  let body: { secret?: unknown; people?: PersonInput[]; words?: string } | null;
  if (formSubmission) {
    const form = await request.formData();
    body = {
      secret: form.get("secret"),
      people: [1, 2].map((n) => ({ name: String(form.get(`name${n}`) || ""), phone: String(form.get(`phone${n}`) || ""), pin: String(form.get(`pin${n}`) || "") })),
      words: String(form.get("words") || ""),
    };
  } else {
    body = await request.json().catch(() => null);
  }
  if (!secureMatch(body?.secret, process.env.SETUP_SECRET)) return NextResponse.json({ error: "Kurulum anahtarı yanlış." }, { status: 403 });
  if (!Array.isArray(body?.people)) return NextResponse.json({ error: "İki kişi gerekli." }, { status: 400 });
  try {
    const db = await readyDb();
    const [adminId] = await createInitialSetup(db, body.people as PersonInput[]);
    if (formSubmission && body.words?.trim()) await createSet(db, adminId, parseWords(body.words), new Date().toISOString().slice(0, 10));
    if (formSubmission) return setSession(NextResponse.redirect(new URL("/", request.url), 303), adminId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (formSubmission) return new NextResponse(error instanceof Error ? error.message : "Kurulum tamamlanamadı.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kurulum tamamlanamadı." }, { status: 400 });
  }
}
