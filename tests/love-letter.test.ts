import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoveLetter, { loveLetterReducer } from "@/components/love-letter";

describe("loveLetterReducer", () => {
  it("opens the letter and starts a fresh celebration", () => {
    expect(loveLetterReducer({ open: false, celebration: 2 }, { type: "open" }))
      .toEqual({ open: true, celebration: 3 });
  });

  it("closes the letter without resetting its celebration", () => {
    expect(loveLetterReducer({ open: true, celebration: 3 }, { type: "close" }))
      .toEqual({ open: false, celebration: 3 });
  });

  it("renders four decorated paper edges and an inline love flourish without a sign-off", () => {
    const markup = renderToStaticMarkup(createElement(LoveLetter));

    expect(markup.match(/data-paper-edge=/g)).toHaveLength(4);
    expect(markup).toContain("love-letter-inline-sparkles");
    expect(markup).not.toContain("Daima senin");
  });
});
