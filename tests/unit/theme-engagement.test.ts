import { describe, expect, it } from "vitest";
import { guessTheme, themeOf, themeLabel } from "@/lib/theme-guess";
import { themeEngagement, themeHighlights, type BattleMeta, type Person } from "@/server/services/theme-engagement-rules";

describe("guessTheme", () => {
  it("puts specific themes before broad ones", () => {
    expect(guessTheme({ title: "He cheated 2 years ago. Now he wants to be 'fully trusted'. Fair?" })).toBe("cheating_trust");
    expect(guessTheme({ title: "My husband's ex texted him 'I still think about us'. Let it go?" })).toBe("exes");
    expect(guessTheme({ title: "Bachelorette for 8 girls. Nashville or Scottsdale?" })).toBe("weddings");
    expect(guessTheme({ title: "My Hinge 'Green flags' prompt. Which answer?" })).toBe("dating");
    expect(guessTheme({ title: "My husband says I spend too much on skincare. Who's right?" })).toBe("couples");
    expect(guessTheme({ title: "Girls trip to Puerto Rico, 6 of us. San Juan or Rincón?" })).toBe("travel");
    expect(guessTheme({ title: "Do I let my 15 year old daughter date?" })).toBe("family_parenting");
    expect(guessTheme({ title: "Two job offers, same pay. Which one?" })).toBe("career");
  });
  it("falls back to the story and labels, then other", () => {
    expect(guessTheme({ title: "Which one?", context: "For my cat" })).toBe("pets");
    expect(guessTheme({ title: "Which one?" })).toBe("other");
  });
  it("prefers the AI tag", () => {
    expect(themeOf({ title: "Hinge prompt", tags: { brain: { theme: "money" } } })).toEqual({ theme: "money", ai: true });
    expect(themeOf({ title: "Hinge prompt", tags: {} })).toEqual({ theme: "dating", ai: false });
    expect(themeLabel("family_parenting")).toBe("Family & parenting");
    expect(themeLabel("weddings")).toBe("Weddings");
  });
});

describe("themeEngagement", () => {
  const NOW = Date.parse("2026-11-25T12:00:00Z");
  const old = "2026-11-23T15:00:00.000Z"; // over 24h ago
  const battles = new Map<string, BattleMeta>([
    ["c1", { slug: "c1", title: "Couples 1", theme: "couples", ai: false, kind: "text" }],
    ["c2", { slug: "c2", title: "Couples 2", theme: "couples", ai: true, kind: "photo" }],
    ["d1", { slug: "d1", title: "Dating 1", theme: "dating", ai: false, kind: "text" }],
  ]);
  const person = (p: Partial<Person>): Person => ({ handle: null, signedUp: false, hasAccount: false, activeDays: 1, firstSeen: old, lastSeen: old, ...p });
  const people = new Map<string, Person>([
    ["u1", person({ handle: "amy", signedUp: true, hasAccount: true, activeDays: 2, lastSeen: "2026-11-25T10:00:00.000Z" })],
    ["g1", person({})], // bounced guest
    ["g2", person({})], // bounced guest who saw nothing
    ["g3", person({ activeDays: 2 })], // came back: not bounced
  ]);
  const t = (m: number) => new Date(Date.parse(old) + m * 60_000).toISOString();
  const te = themeEngagement({
    battles,
    people,
    signups: 2,
    now: NOW,
    seen: [
      { who: "u1", battleId: "c1", at: t(1) },
      { who: "u1", battleId: "c1", at: t(2) }, // shown twice, counted once
      { who: "u1", battleId: "d1", at: t(3) },
      { who: "g1", battleId: "c1", at: t(1) },
      { who: "g1", battleId: "d1", at: t(5) },
      { who: "g3", battleId: "c2", at: t(1) },
    ],
    votes: [
      { who: "u1", battleId: "c1", at: t(2) },
      { who: "u1", battleId: "c2", at: t(4) }, // voted without a deck view (battle page)
      { who: "g1", battleId: "c1", at: t(2) },
    ],
    skips: [
      { who: "u1", battleId: "d1", at: t(3) },
      { who: "g3", battleId: "d1", at: t(2) }, // skip with no logged view still counts
    ],
  });

  it("counts seen, voted, skipped and left per theme", () => {
    const c = te.themes.find((x) => x.theme === "couples")!;
    const d = te.themes.find((x) => x.theme === "dating")!;
    expect(c).toMatchObject({ battles: 2, seen: 3, voted: 2, skipped: 0, left: 1, votes: 3, voters: 2, signupVoters: 1, aiTagged: 1 });
    expect(c.voteRate).toBeCloseTo(2 / 3);
    expect(c.pctVoters).toBe(1);
    expect(c.pctSignups).toBe(0.5);
    expect(d).toMatchObject({ seen: 2, voted: 0, skipped: 2, left: 1, votes: 0 });
    expect(d.skipRate).toBe(1);
    // Columns add up to the totals (and so to the tiles).
    expect(te.themes.reduce((a, x) => a + x.votes, 0)).toBe(te.totals.votes);
    expect(te.themes.reduce((a, x) => a + x.skipped, 0)).toBe(te.totals.skipped);
    expect(te.themes.reduce((a, x) => a + x.seen, 0)).toBe(te.totals.seen);
    expect(te.themeKinds.find((x) => x.theme === "couples" && x.kind === "photo")).toMatchObject({ votes: 1, seen: 1 });
  });

  it("finds bounced visitors and the battle they left on", () => {
    expect(te.totals.bounced).toBe(2);
    expect(te.totals.bouncedNoBattle).toBe(1);
    expect(te.bounce.lastBattles).toEqual([{ battleId: "d1", slug: "d1", title: "Dating 1", theme: "dating", kind: "text", people: 1, voted: 0, skipped: 0, left: 1 }]);
    expect(te.themes.find((x) => x.theme === "dating")!.pctBounced).toBe(1);
    expect(te.bounce.lastThree).toEqual(expect.arrayContaining([{ theme: "dating", n: 1 }, { theme: "couples", n: 1 }]));
    expect(te.bounce.avgVotesBeforeLeaving).toBe(0.5);
  });

  it("lists each voter with themes and skips", () => {
    expect(te.voters.map((v) => v.who)).toEqual(["u1", "g1"]);
    expect(te.voters[0]).toMatchObject({ handle: "amy", signedUp: true, votes: 2, seen: 2, skips: 1, left: 0, themes: [{ theme: "couples", n: 2 }] });
    expect(te.voters[0].skipped).toEqual([{ slug: "d1", title: "Dating 1", theme: "dating" }]);
  });

  it("writes plain headlines", () => {
    const h = themeHighlights(te, themeLabel, 1, 1);
    expect(h[0]).toMatch(/^Most votes: Couples/);
    expect(h.join(" ")).toMatch(/Most skipped: Dating/);
  });
});
