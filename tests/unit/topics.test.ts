import { describe, expect, it } from "vitest";
import { countTopics, deckTopic, pickerDue, streakTopic, topicGate, topicOf } from "@/lib/topics";

describe("topicOf", () => {
  it("uses the poster's own pick first", () => {
    expect(topicOf({ title: "My ex texted me", tags: { topic: "money" } })).toBe("money");
  });
  it("ignores an unknown own pick", () => {
    expect(topicOf({ title: "My ex texted me happy birthday", tags: { topic: "nope" } })).toBe("couples");
  });
  it("folds exes, cheating, dating and who's right into Couples", () => {
    expect(topicOf({ title: "My ex texted me happy birthday. Do I reply?" })).toBe("couples");
    expect(topicOf({ title: "Found flirty texts on his phone" })).toBe("couples");
    expect(topicOf({ title: "First date at a bowling alley?" })).toBe("couples");
    expect(topicOf({ title: "My husband wants to skip Christmas. Who's right?" })).toBe("couples");
    expect(topicOf({ title: "Anything", tags: { brain: { theme: "cheating_trust" } } })).toBe("couples");
  });
  it("finds babies, investing and current events by their words", () => {
    expect(topicOf({ title: "Gender reveal party or keep it a surprise?" })).toBe("babies");
    expect(topicOf({ title: "Our 6 month old still wakes up at 3am" })).toBe("babies");
    expect(topicOf({ title: "Put my bonus in index funds or pay off my car?" })).toBe("investing");
    expect(topicOf({ title: "Bitcoin or a Roth IRA?" })).toBe("investing");
    expect(topicOf({ title: "My dad and I argue about politics at every dinner" })).toBe("news");
    expect(topicOf({ title: "Is the economy heading for a recession?" })).toBe("news");
  });
  it("uses the auto-seed topic", () => {
    expect(topicOf({ title: "Thanksgiving with my uncle", tags: { seed: { topic: "politics" } } })).toBe("news");
    expect(topicOf({ title: "Should I take the offer?", tags: { seed: { topic: "jobs" } } })).toBe("money");
  });
  it("maps the AI theme, else the word guess, else Everyday life", () => {
    expect(topicOf({ title: "x", tags: { brain: { theme: "career" } } })).toBe("money");
    expect(topicOf({ title: "x", tags: { brain: { theme: "weddings" } } })).toBe("weddings");
    expect(topicOf({ title: "x", tags: { brain: { theme: "family_parenting" } } })).toBe("family");
    expect(topicOf({ title: "My roommate never does the dishes" })).toBe("friends");
    expect(topicOf({ title: "Coffee or tea?" })).toBe("everyday");
    expect(topicOf({ title: "x", tags: { brain: { theme: "travel" } } })).toBe("everyday");
  });
});

describe("deckTopic + countTopics", () => {
  it("cleans unknown values to Mix", () => {
    expect(deckTopic("couples")).toBe("couples");
    expect(deckTopic("drop table")).toBe("mix");
    expect(deckTopic(undefined)).toBe("mix");
  });
  it("counts battles per topic, zero for the rest", () => {
    const c = countTopics(["couples", "couples", "money"]);
    expect(c.couples).toBe(2);
    expect(c.money).toBe(1);
    expect(c.babies).toBe(0);
  });
});

describe("pickerDue", () => {
  const base = { picks: 6, at: 6, topic: "mix" as const, shown: false, busy: false };
  it("shows once on Mix at the pick", () => {
    expect(pickerDue(base)).toBe(true);
    expect(pickerDue({ ...base, picks: 5 })).toBe(false);
    expect(pickerDue({ ...base, shown: true })).toBe(false);
    expect(pickerDue({ ...base, busy: true })).toBe(false);
    expect(pickerDue({ ...base, topic: "couples" })).toBe(false);
    expect(pickerDue({ ...base, at: 0 })).toBe(false);
  });
  it("waits a pick when busy, then shows", () => {
    expect(pickerDue({ ...base, picks: 7 })).toBe(true);
  });
});

describe("streakTopic", () => {
  const base = { recent: ["money", "couples", "couples", "couples"] as const, run: 3, skips: 2, minSkips: 2, topic: "mix" as const, offered: [] as string[] };
  it("offers the topic after a run, only for people who skip", () => {
    expect(streakTopic({ ...base, recent: [...base.recent] })).toBe("couples");
    expect(streakTopic({ ...base, recent: [...base.recent], skips: 1 })).toBe(null);
  });
  it("needs the whole run on one topic, never Everyday life, once per topic, only on Mix", () => {
    expect(streakTopic({ ...base, recent: ["couples", "money", "couples"] })).toBe(null);
    expect(streakTopic({ ...base, recent: ["everyday", "everyday", "everyday"] })).toBe(null);
    expect(streakTopic({ ...base, recent: [...base.recent], offered: ["couples"] })).toBe(null);
    expect(streakTopic({ ...base, recent: [...base.recent], topic: "couples" })).toBe(null);
    expect(streakTopic({ ...base, recent: ["couples", "couples"] })).toBe(null);
  });
});

describe("topicGate", () => {
  it("walls group A from the 10th vote in a topic", () => {
    expect(topicGate({ votes: 9, at: 10, soft: false, every: 5 })).toBe(null);
    expect(topicGate({ votes: 10, at: 10, soft: false, every: 5 })).toBe("wall");
    expect(topicGate({ votes: 13, at: 10, soft: false, every: 5 })).toBe("wall");
  });
  it("prompts group B at 10 and every 5 after", () => {
    expect(topicGate({ votes: 10, at: 10, soft: true, every: 5 })).toBe("prompt");
    expect(topicGate({ votes: 12, at: 10, soft: true, every: 5 })).toBe(null);
    expect(topicGate({ votes: 15, at: 10, soft: true, every: 5 })).toBe("prompt");
  });
  it("is off at 0", () => {
    expect(topicGate({ votes: 50, at: 0, soft: false, every: 5 })).toBe(null);
  });
});
