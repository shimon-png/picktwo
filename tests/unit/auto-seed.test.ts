import { describe, expect, it } from "vitest";
import {
  draftProblems,
  isDuplicate,
  isHumanBattle,
  mulberry32,
  photoCount,
  planVotes,
  seedHandle,
  shouldStartBatch,
  storyRepeat,
  topicPlan,
  voiceFromLabels,
  watchedRank,
  type SeedDraft,
} from "@/lib/auto-seed";
import { tieredPick } from "@/server/services/ranking";

const clean = () => false;
const text: SeedDraft = {
  kind: "text",
  voice: "F",
  topic: "couples",
  title: "He put my $90 sweater in the dryer and says it's 'just a little smaller now'. Who's right?",
  story: "It fits our 8 year old niece now.",
  a: "I'm right",
  b: "He's right",
  aLine: "",
  bLine: "",
  pctA: 88,
};

describe("auto-seed trigger", () => {
  const base = { enabled: true, remaining: 40, threshold: 50, lastFinishedAt: null, cooldownHours: 12, now: new Date("2026-11-26T12:00:00Z") };
  it("starts at or under the threshold", () => {
    expect(shouldStartBatch(base).start).toBe(true);
    expect(shouldStartBatch({ ...base, remaining: 50 }).start).toBe(true);
    expect(shouldStartBatch({ ...base, remaining: 51 }).start).toBe(false);
  });
  it("respects off, no voters and the cooldown", () => {
    expect(shouldStartBatch({ ...base, enabled: false }).start).toBe(false);
    expect(shouldStartBatch({ ...base, remaining: null }).start).toBe(false);
    expect(shouldStartBatch({ ...base, lastFinishedAt: "2026-11-26T06:00:00Z" }).start).toBe(false);
    expect(shouldStartBatch({ ...base, lastFinishedAt: "2026-11-25T23:00:00Z" }).start).toBe(true);
  });
  it("watches the 10th voter, or the last one when fewer voted", () => {
    expect(watchedRank(300, 10)).toBe(10);
    expect(watchedRank(4, 10)).toBe(4);
    expect(watchedRank(0, 10)).toBeNull();
  });
});

describe("batch mix", () => {
  it("is 33 photo / 67 text for 100", () => {
    expect(photoCount(100, 33)).toBe(33);
    expect(photoCount(10, 0)).toBe(0);
  });
  it("plans exactly n topics, heaviest on couples", () => {
    const t = topicPlan(100);
    expect(t).toHaveLength(100);
    const n = (k: string) => t.filter((x) => x === k).length;
    expect(n("couples")).toBeGreaterThan(n("life"));
    expect(topicPlan(7)).toHaveLength(7);
  });
});

describe("draft checks", () => {
  it("passes a good text battle", () => {
    expect(draftProblems(text, clean)).toEqual([]);
  });
  it("catches a story that repeats the title", () => {
    const d = { ...text, story: "He put my sweater in the dryer and it's smaller now." };
    expect(storyRepeat(d.title, d.story)).toBeGreaterThan(0.5);
    expect(draftProblems(d, clean)).toContain("story repeats the title");
  });
  it("catches AI phrasing, emoji, long labels and profanity", () => {
    expect(draftProblems({ ...text, story: "Not a fight, not a breakup." }, clean)).toContain("sounds like AI");
    expect(draftProblems({ ...text, story: "ugh 😩" }, clean)).toContain("emoji");
    expect(draftProblems({ ...text, a: "x".repeat(61) }, clean)).toContain("option label over 60");
    expect(draftProblems(text, () => true)).toContain("profanity filter");
  });
  it("keeps photo battles to things and places, never looks or kids", () => {
    const photo: SeedDraft = { ...text, kind: "photo", title: "Wedding venue: $9k barn or my parents' backyard for free?", a: "The barn", b: "The backyard", queryA: "rustic barn wedding venue", queryB: "backyard wedding string lights" };
    expect(draftProblems(photo, clean)).toEqual([]);
    expect(draftProblems({ ...photo, a: "Long hair", b: "Bob", queryA: "woman long hair", queryB: "bob haircut" }, clean)).toContain("photo battle compares looks");
    expect(draftProblems({ ...photo, queryA: "toddler at birthday party" }, clean)).toContain("kids in a photo");
    expect(draftProblems({ ...photo, queryB: "" }, clean)).toContain("photo search missing");
  });
  it("spots duplicates", () => {
    expect(isDuplicate("He put my $90 sweater in the dryer and says it's just a little smaller now. Who's right??", [text.title])).toBe(true);
    expect(isDuplicate("My 6 year old wants to quit soccer halfway through the season. Make her finish?", [text.title])).toBe(false);
  });
});

describe("posters and votes", () => {
  it("makes believable handles", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 300; i++) expect(seedHandle(i % 3 === 0 ? "M" : "F", r)).toMatch(/^[a-z0-9_]{3,20}$/);
  });
  it("reads the poster's voice from partner answers", () => {
    expect(voiceFromLabels(["I'm right", "He's right"])).toBe("F");
    expect(voiceFromLabels(["She's right", "I'm right"])).toBe("M");
    expect(voiceFromLabels(["Fair", "Not fair"])).toBe("N");
  });
  it("spreads votes after posting, roughly on the planned split", () => {
    const now = Date.parse("2026-11-26T20:00:00Z");
    const createdAt = now - 6 * 3600_000;
    const v = planVotes({ n: 2000, pctA: 80, createdAt, now, words: 120, photo: false, rand: mulberry32(3) });
    expect(v.every((x) => x.at >= createdAt + 4 * 60_000 && x.at <= now)).toBe(true);
    const a = v.filter((x) => x.side === "A").length / v.length;
    expect(a).toBeGreaterThan(0.74);
    expect(a).toBeLessThan(0.86);
    expect(v.every((x) => x.dwellMs >= 1100 && x.dwellMs <= 25000)).toBe(true);
  });
});

describe("real people's battles first", () => {
  it("tells human battles from seeds", () => {
    expect(isHumanBattle({ id: "abc", authorHasEmail: true })).toBe(true);
    expect(isHumanBattle({ id: "abc", authorHasEmail: false, pickbot: true })).toBe(true);
    expect(isHumanBattle({ id: "seed_auto_x", authorHasEmail: false })).toBe(false);
    expect(isHumanBattle({ id: "abc", authorHasEmail: false })).toBe(false);
  });
  it("orders featured, then human, then seed, whatever the score", () => {
    const row = (id: string, featured: boolean, human: boolean) => ({ id, featured, human, categoryId: "other", authorId: id });
    const sorted = [row("seed1", false, false), row("seed2", false, false), row("human1", false, true), row("feat", true, false), row("human2", false, true)];
    expect(tieredPick(sorted, 10).map((x) => x.id)).toEqual(["feat", "human1", "human2", "seed1", "seed2"]);
    expect(tieredPick(sorted, 2).map((x) => x.id)).toEqual(["feat", "human1"]);
    // Seed battles that fill a missing taste trait go before other seeds, never before real people's.
    const withFill = sorted.map((x) => (x.id === "seed2" ? { ...x, fill: true } : x));
    expect(tieredPick(withFill, 10).map((x) => x.id)).toEqual(["feat", "human1", "human2", "seed2", "seed1"]);
  });
});
