import { describe, expect, it } from "vitest";
import { activeOn, dayIndex, istanbulDay } from "../lib/study";

describe("Istanbul study days", () => {
  it("changes day at Istanbul midnight", () => {
    expect(istanbulDay(new Date("2026-09-20T20:59:59Z"))).toBe("2026-09-20");
    expect(istanbulDay(new Date("2026-09-20T21:00:00Z"))).toBe("2026-09-21");
  });

  it("counts exactly seven active calendar days", () => {
    expect(dayIndex("2026-09-20", "2026-09-20")).toBe(1);
    expect(dayIndex("2026-09-20", "2026-09-26")).toBe(7);
    expect(activeOn("2026-09-20", "2026-09-26")).toBe(true);
    expect(activeOn("2026-09-20", "2026-09-27")).toBe(false);
    expect(activeOn("2026-09-20", "2026-09-19")).toBe(false);
  });

  it("supports an explicit 100-day program duration", () => {
    expect(activeOn("2026-09-21", "2026-12-29", 100)).toBe(true);
    expect(activeOn("2026-09-21", "2026-12-30", 100)).toBe(false);
  });
});
