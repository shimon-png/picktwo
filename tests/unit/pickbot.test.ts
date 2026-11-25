import { describe, expect, it } from "vitest";
import {
  answerKind,
  answersLeft,
  battlesTime,
  callCost,
  crowdAgreed,
  neededQuestions,
  nextStep,
  parseAnswer,
  parseClassification,
  partialField,
  pickQuickBattles,
  resultsDue,
  scrubIdentifiers,
  type Classification,
} from "@/lib/pickbot";

const c = (o: Partial<Classification> = {}): Classification => ({ scope: "decision", theme: "fashion_beauty", extended: [], title: "Dress", crisis: false, ...o });
const all = { sex: "F", age: "25-34", relationship: "SINGLE", zip: "10001" };

describe("nextStep", () => {
  it("asks missing profile questions one at a time, in order", () => {
    expect(nextStep({ c: c(), known: {}, votes: 0, target: 30, state: {} })).toEqual({ type: "gate", q: "sex", index: 1, total: 4 });
    expect(nextStep({ c: c(), known: { sex: "F", age: "x" }, votes: 0, target: 30, state: {} })).toEqual({ type: "gate", q: "relationship", index: 3, total: 4 });
  });
  it("adds extended questions only when relevant", () => {
    expect(neededQuestions(c({ extended: ["kids"] }))).toEqual(["sex", "age", "relationship", "zip", "kids"]);
    expect(nextStep({ c: c({ extended: ["kids"] }), known: all, votes: 40, target: 30, state: {} })).toEqual({ type: "gate", q: "kids", index: 5, total: 5 });
  });
  it("skipping the questions moves on", () => {
    expect(nextStep({ c: c(), known: {}, votes: 40, target: 30, state: { skipGates: true } })).toEqual({ type: "answer", kind: "tailored" });
  });
  it("offers general or tailored under the target, then quick battles", () => {
    expect(nextStep({ c: c(), known: all, votes: 18, target: 30, state: {} })).toEqual({ type: "choice", left: 12 });
    expect(nextStep({ c: c(), known: all, votes: 18, target: 30, state: { choice: "tailored" } })).toEqual({ type: "battles", left: 12 });
    expect(nextStep({ c: c(), known: all, votes: 30, target: 30, state: { choice: "tailored" } })).toEqual({ type: "answer", kind: "tailored" });
    expect(nextStep({ c: c(), known: all, votes: 18, target: 30, state: { choice: "tailored", stopBattles: true } })).toEqual({ type: "answer", kind: "general" });
    expect(nextStep({ c: c(), known: all, votes: 18, target: 30, state: { choice: "general" } })).toEqual({ type: "answer", kind: "general" });
  });
  it("off-topic questions get no gates", () => {
    expect(nextStep({ c: c({ scope: "off_topic" }), known: {}, votes: 0, target: 30, state: {} })).toEqual({ type: "off_topic" });
  });
  it("answer kind and time estimate", () => {
    expect(answerKind(29, 30)).toBe("general");
    expect(battlesTime(12)).toBe("~2 min");
    expect(battlesTime(3)).toBe("~30 sec");
  });
});

describe("pickQuickBattles", () => {
  it("prefers the question's theme", () => {
    const feed = [
      { id: "1", theme: "money" },
      { id: "2", theme: "fashion_beauty" },
      { id: "3", theme: null },
      { id: "4", theme: "fashion_beauty" },
    ];
    expect(pickQuickBattles(feed, "fashion_beauty", 3).map((b) => b.id)).toEqual(["2", "4", "1"]);
    expect(pickQuickBattles(feed, "other", 2).map((b) => b.id)).toEqual(["1", "2"]);
  });
});

describe("parsers", () => {
  it("classification falls back safely", () => {
    expect(parseClassification({ scope: "x", theme: "nope", extended: ["kids", "pets"], crisis: "yes" }, "Which dress?")).toEqual({
      scope: "decision",
      theme: "other",
      extended: ["kids"],
      title: "Which dress?",
      crisis: false,
    });
  });
  it("answer needs a pick", () => {
    expect(parseAnswer({ why: "x" })).toBeNull();
    expect(parseAnswer({ pick: "Green", why: "Bold", crowd: "", confidence: "weird", flip: "Black tie", care: "" })).toMatchObject({ pick: "Green", confidence: "fairly_sure" });
  });
  it("reads a field that is still streaming", () => {
    expect(partialField('{"pick": "Dress A, the gr', "pick")).toBe("Dress A, the gr");
    expect(partialField('{"pick": "A \\"bold\\" one", "why": "You lean', "why")).toBe("You lean");
    expect(partialField('{"pick": "Line\\nbreak", "why"', "pick")).toBe("Line\nbreak");
    expect(partialField('{"pick": "half \\', "pick")).toBe("half ");
    expect(partialField('{"pi', "pick")).toBe("");
  });
});

describe("money and limits", () => {
  it("prices a call", () => {
    expect(callCost("claude-sonnet-5-5", { input_tokens: 5000, output_tokens: 2500 })).toBeCloseTo(0.035);
    expect(callCost("claude-opus-5-5", { input_tokens: 0, cache_read_input_tokens: 10000, output_tokens: 0 })).toBeCloseTo(0.004);
    expect(callCost("unknown", { input_tokens: 1 })).toBe(0);
  });
  it("free answers left", () => {
    expect(answersLeft(1, 3, false)).toBe(2);
    expect(answersLeft(5, 3, false)).toBe(0);
    expect(answersLeft(5, 3, true)).toBeNull();
  });
});

describe("crowd", () => {
  it("scrubs identifiers from drafts", () => {
    const r = scrubIdentifiers("Text me at 555-123-4567 or jo@x.com, I'm @jojo on here. See https://x.co/a .");
    expect(r.text).toBe("Text me at or, I'm on here. See.");
    expect(r.removed).toEqual(["email", "link", "phone number", "username"]);
    expect(scrubIdentifiers("Green or burgundy?")).toEqual({ text: "Green or burgundy?", removed: [] });
  });
  it("results come back at close or the vote threshold, once", () => {
    expect(resultsDue({ status: "OPEN", votes: 10, delivered: false }, 50)).toBe(false);
    expect(resultsDue({ status: "OPEN", votes: 50, delivered: false }, 50)).toBe(true);
    expect(resultsDue({ status: "CLOSED", votes: 3, delivered: false }, 50)).toBe(true);
    expect(resultsDue({ status: "CLOSED", votes: 3, delivered: true }, 50)).toBe(false);
  });
  it("crowd agreement", () => {
    expect(crowdAgreed("A", 60, 40)).toBe(true);
    expect(crowdAgreed("B", 60, 40)).toBe(false);
    expect(crowdAgreed("A", 5, 5)).toBeNull();
    expect(crowdAgreed(null, 6, 5)).toBeNull();
  });
});
