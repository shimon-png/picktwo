import { describe, expect, it } from "vitest";
import { activeMind, matchesMind, mindCardDue, mindFactor, mindNudgeDue, MIND_TOPICS, type MindRow } from "@/lib/mind";

const now = new Date("2026-11-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);
const rules = { mindAt: 3, mindDays: 7, mindNudgeAfter: 8 };
const row = (p: Partial<MindRow> = {}): MindRow => ({ at: daysAgo(1), topic: "money", answeredAt: daysAgo(1), nudgedAt: null, ...p });

describe("What's on your mind this week?", () => {
  it("has the six topics Alex asked for", () => {
    expect(MIND_TOPICS.map((t) => t.label)).toEqual(["Money", "Dating", "Work", "Family", "Gifts", "Where to live"]);
  });

  it("asks from mindAt votes on, once a week", () => {
    expect(mindCardDue({ votes: 2, last: null, now }, rules)).toBe(false);
    expect(mindCardDue({ votes: 3, last: null, now }, rules)).toBe(true);
    expect(mindCardDue({ votes: 9, last: row({ at: daysAgo(3) }), now }, rules)).toBe(false);
    // Skipped or left unanswered also waits for the week.
    expect(mindCardDue({ votes: 9, last: row({ at: daysAgo(3), topic: null, answeredAt: null }), now }, rules)).toBe(false);
    expect(mindCardDue({ votes: 9, last: row({ at: daysAgo(7) }), now }, rules)).toBe(true);
    expect(mindCardDue({ votes: 9, last: null, now }, { ...rules, mindAt: 0 })).toBe(false);
  });

  it("steers the deck for a week after the answer", () => {
    expect(activeMind(row(), now, 7)).toBe("money");
    expect(activeMind(row({ answeredAt: daysAgo(8) }), now, 7)).toBeNull();
    expect(activeMind(row({ topic: null, answeredAt: null }), now, 7)).toBeNull();
    expect(activeMind(null, now, 7)).toBeNull();
  });

  it("matches battles by AI theme, else by words", () => {
    expect(matchesMind("dating", { theme: "cheating_trust", title: "Is this okay?" })).toBe(true);
    expect(matchesMind("money", { theme: "fashion_beauty", title: "Which dress?" })).toBe(false);
    expect(matchesMind("gifts", { theme: "shopping", title: "Birthday gift for my boyfriend, which one?" })).toBe(true);
    expect(matchesMind("home", { theme: null, title: "Should we move to the suburbs?" })).toBe(true);
    expect(matchesMind("work", { theme: "other", title: "Pizza or tacos", context: "my boss is buying" })).toBe(true);
  });

  it("boosts matching battles only", () => {
    const b = { theme: "money", title: "Pay off debt or invest?" };
    expect(mindFactor("money", b, 5)).toBe(5);
    expect(mindFactor("dating", { theme: "food_drink", title: "Pizza or tacos?" }, 5)).toBe(1);
    expect(mindFactor(null, b, 5)).toBe(1);
    expect(mindFactor("money", b, 1)).toBe(1);
  });

  it("nudges signed-out people to sign up once, after a run of votes", () => {
    const a = { signedIn: false, last: row(), votesSince: 8, now };
    expect(mindNudgeDue(a, rules)).toBe(true);
    expect(mindNudgeDue({ ...a, votesSince: 7 }, rules)).toBe(false);
    expect(mindNudgeDue({ ...a, signedIn: true }, rules)).toBe(false);
    expect(mindNudgeDue({ ...a, last: row({ nudgedAt: daysAgo(0.5) }) }, rules)).toBe(false);
    expect(mindNudgeDue({ ...a, last: row({ topic: null, answeredAt: null }) }, rules)).toBe(false);
    expect(mindNudgeDue(a, { ...rules, mindNudgeAfter: 0 })).toBe(false);
  });
});
