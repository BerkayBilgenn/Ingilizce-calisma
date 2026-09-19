import { NextRequest, NextResponse } from "next/server";
import { issueSession } from "@/lib/auth";
import { readyDb } from "@/lib/server";
import { authenticate } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (typeof body?.phone !== "string" || typeof body?.pin !== "string") return NextResponse.json({ error: "Numara veya PIN hatalı." }, { status: 401 });
  const db = await readyDb();
  const person = await authenticate(db, body.phone, body.pin);
  if (!person) return NextResponse.json({ error: "Numara veya PIN hatalı." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", issueSession(person.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
