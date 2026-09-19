import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, ensureSchema } from "../lib/db";
import { claimSlot, formatMessage, slotKey } from "../lib/agent";

describe("four-hour reminder slots", () => {
  it("opens only for the first five minutes of Istanbul slots", () => {
    expect(slotKey(new Date("2026-09-20T05:01:00Z"))).toBe("2026-09-20-08");
    expect(slotKey(new Date("2026-09-20T05:05:00Z"))).toBeNull();
    expect(slotKey(new Date("2026-09-20T21:01:00Z"))).toBe("2026-09-21-00");
  });

  it("formats two separate remaining-word sections", () => {
    const message = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [{ term: "apple", meaning: "elma" }], learned: [] }, { name: "Deniz", remaining: [{ term: "book", meaning: "kitap" }], learned: [] }] });
    expect(message).toContain("Ada");
    expect(message).toContain("apple — elma");
    expect(message).toContain("Deniz");
    expect(message).toContain("book — kitap");
    const complete = formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [{ term: "apple", meaning: "elma" }] }, { name: "Deniz", remaining: [], learned: [{ term: "book", meaning: "kitap" }] }] });
    expect(complete).toContain("Ada · bugün tüm kelimeleri öğrendim");
    expect(complete).toContain("apple — elma");
    expect(complete).toContain("Deniz · bugün tüm kelimeleri öğrendim");
    expect(formatMessage({ day: "2026-09-20", people: [{ name: "Ada", remaining: [], learned: [] }, { name: "Deniz", remaining: [], learned: [] }] })).toBeNull();
  });

  it("claims a slot only once", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kelime-agent-"));
    const db = createDb(`file:${join(directory, "test.db")}`);
    await ensureSchema(db);
    expect(await claimSlot(db, "2026-09-20-12", "message")).toBe(true);
    expect(await claimSlot(db, "2026-09-20-12", "message")).toBe(false);
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
