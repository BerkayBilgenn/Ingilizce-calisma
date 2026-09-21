import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { curriculumWords } from "../lib/curriculum";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

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

  it("keeps the supplied CSV as the checked-in source", () => {
    const csv = readFileSync(new URL("../content/ingilizce-1000-kelime.csv", import.meta.url), "utf8");
    const [header, ...rows] = parseCsv(csv);
    expect(header).toEqual(["İngilizce", "Türkçe", "Okunuş", "Seviye", "Kategori"]);
    expect(rows).toHaveLength(1000);
    expect(rows).toEqual(curriculumWords.map((word) => [word.term, word.meaning, word.pronunciation, word.level, word.category]));
  });
});
