import { describe, expect, it } from "vitest";
import { pickOpener, rescueIndex } from "@/server/services/ranking";

describe("pickOpener", () => {
  it("picks the proven battle with the best pick rate", () => {
    const items = [
      { id: "a", votes: 15, skips: 5 }, // 75%
      { id: "b", votes: 38, skips: 2 }, // 95%
      { id: "c", votes: 5, skips: 0 }, // too few decisions
    ];
    expect(pickOpener(items, 20, 0.8)?.id).toBe("b");
  });
  it("returns null when nothing is proven", () => {
    expect(pickOpener([{ id: "a", votes: 3, skips: 1 }], 20, 0.8)).toBeNull();
  });
  it("breaks ties by more decisions", () => {
    const items = [
      { id: "a", votes: 20, skips: 0 },
      { id: "b", votes: 20, skips: 0 },
    ];
    expect(pickOpener(items, 20, 1)?.id).toBe("a");
    expect(pickOpener([{ id: "a", votes: 20, skips: 0 }, { id: "b", votes: 40, skips: 0 }], 20, 1)?.id).toBe("b");
  });
});

describe("rescueIndex", () => {
  const rest = [{ pickRate: 0.6 }, { pickRate: 0.7 }, { pickRate: 0.95 }, {}];
  it("does nothing before the streak", () => {
    expect(rescueIndex(rest, 1, 2)).toBe(-1);
  });
  it("brings the best remaining card forward after the streak", () => {
    expect(rescueIndex(rest, 2, 2)).toBe(2);
  });
  it("is off at 0 and when the next card is already best", () => {
    expect(rescueIndex(rest, 5, 0)).toBe(-1);
    expect(rescueIndex([{ pickRate: 0.9 }, { pickRate: 0.5 }], 3, 2)).toBe(-1);
  });
  it("ignores cards without a rate", () => {
    expect(rescueIndex([{}, {}], 3, 2)).toBe(-1);
  });
});
