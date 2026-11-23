import { describe, expect, it } from "vitest";
import { clientEventsInput, voteInput } from "@/lib/validators";
import { isBotUserAgent, profileDiff } from "@/lib/analytics-rules";

const ev = { id: "abc123XYZ", name: "card_shown", at: 1763860000000, sessionId: "sess12345", seq: 3, props: { battleId: "b1", pos: 2 } };

describe("data brain client events", () => {
  it("accepts a well-formed batch", () => {
    expect(clientEventsInput.parse({ events: [ev] }).events).toHaveLength(1);
  });
  it("rejects unknown names, bad ids, huge props and big batches", () => {
    expect(() => clientEventsInput.parse({ events: [{ ...ev, name: "vote_cast" }] })).toThrow();
    expect(() => clientEventsInput.parse({ events: [{ ...ev, id: "x'; drop" }] })).toThrow();
    expect(() => clientEventsInput.parse({ events: [{ ...ev, props: { s: "x".repeat(3000) } }] })).toThrow();
    expect(() => clientEventsInput.parse({ events: Array(51).fill(ev) })).toThrow();
    expect(() => clientEventsInput.parse({ events: [{ ...ev, at: 9e15 }] })).toThrow();
  });
  it("vote meta is optional and validated", () => {
    expect(voteInput.parse({ side: "A" }).meta).toBeUndefined();
    expect(voteInput.parse({ side: "B", meta: { method: "swipe", pos: 4, sessionId: "sess12345" } }).meta?.method).toBe("swipe");
    expect(() => voteInput.parse({ side: "B", meta: { method: "shake" } })).toThrow();
  });
  it("flags bots", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("profileDiff", () => {
  it("keeps only changed demographic fields, old and new", () => {
    const d = profileDiff({ sex: "FEMALE", ageRange: "25_34", zipCode: "10001", kidAges: [] }, { sex: "FEMALE", ageRange: "35_44", zipCode: "10001", kidAges: ["AGE_0_2"] });
    expect(d).toEqual({ ageRange: { from: "25_34", to: "35_44" }, kidAges: { from: [], to: ["AGE_0_2"] } });
  });
  it("ignores fields the save didn't touch", () => {
    expect(profileDiff({ sex: "MALE", city: "Austin" }, { sex: "MALE" })).toEqual({});
  });
});
