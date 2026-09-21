import { describe, expect, it } from "vitest";
import { curriculumWords } from "../lib/curriculum";

describe("100-day curriculum", () => {
  it("contains 100 complete days of ten unique words", () => {
    expect(curriculumWords).toHaveLength(1000);
    expect(new Set(curriculumWords.map((word) => word.term.toLocaleLowerCase("en"))).size).toBe(1000);
    for (let day = 1; day <= 100; day++) {
      expect(curriculumWords.filter((word) => word.dayNumber === day)).toHaveLength(10);
    }
    expect(curriculumWords.every((word) => word.term && word.meaning && word.pronunciation && word.level && word.category)).toBe(true);
  });

  it("preserves the CSV ordering and pronunciation", () => {
    expect(curriculumWords[0]).toMatchObject({ term: "accept", meaning: "kabul etmek", pronunciation: "ık-SEPT", dayNumber: 1, position: 0 });
    expect(curriculumWords[999]).toMatchObject({ term: "wheel", meaning: "tekerlek", pronunciation: "wiil", dayNumber: 100, position: 999 });
  });
});
