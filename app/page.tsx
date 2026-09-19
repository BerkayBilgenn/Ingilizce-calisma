import { cookies } from "next/headers";
import { readSession } from "@/lib/auth";
import { readyDb } from "@/lib/server";
import { getDashboard } from "@/lib/store";
import { istanbulDay } from "@/lib/study";
import StudyApp from "@/components/study-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await readyDb();
  const result = await db.execute("SELECT COUNT(*) AS count FROM participants");
  const setupNeeded = Number(result.rows[0].count) === 0;
  const token = (await cookies()).get("session")?.value;
  const personId = readSession(token);
  let dashboard = null;
  if (personId && !setupNeeded) {
    try { dashboard = await getDashboard(db, personId, istanbulDay(new Date())); } catch { /* Stale session. */ }
  }
  return <StudyApp setupNeeded={setupNeeded} initial={dashboard} today={istanbulDay(new Date())} />;
}
