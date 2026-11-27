import { describe, expect, it } from "vitest";
import { PREFER_NOT, PARTY_OPTIONS, RACE_OPTIONS, cardOrder, isValidAboutAnswer, nextAboutCard, shuffled, type AboutQuestionId, type AboutSchedule, type AboutState } from "@/lib/about";
import { ECONOMY_DEFAULTS } from "@/lib/constants";

const sched = ECONOMY_DEFAULTS as unknown as AboutSchedule;
const st = (p: Partial<AboutState> = {}): AboutState => ({ votes: 0, signedIn: false, answered: new Set(), skipped: new Map(), lastAskAt: null, ...p });

/** Plays a guest who answers everything: which card after which vote. */
function play(n: number, signedInFrom = Infinity, skip: AboutQuestionId[] = []) {
  const s = st();
  const out: string[] = [];
  for (let v = 1; v <= n; v++) {
    s.votes = v;
    s.signedIn = v >= signedInFrom;
    const q = nextAboutCard(s, sched);
    if (!q) continue;
    out.push(`${v}:${q}`);
    s.lastAskAt = v;
    if (skip.includes(q) && !s.skipped.has(q)) s.skipped.set(q, { times: 1, atVotes: v });
    else if (skip.includes(q)) s.skipped.set(q, { times: 2, atVotes: v });
    else s.answered.add(q);
  }
  return out;
}

describe("nextAboutCard", () => {
  it("follows the plan for a guest (Alex, Nov 25): no ZIP card; kids, education, home, race, party without an account", () => {
    expect(play(40)).toEqual(["2:sex", "4:age", "7:relationship", "9:kids", "11:education", "13:housing", "16:race", "19:party"]);
  });
  it("adds work once signed in", () => {
    expect(play(40, 16)).toEqual(["2:sex", "4:age", "7:relationship", "9:kids", "11:education", "13:housing", "16:race", "19:party", "35:work"]);
  });
  it("the ZIP card never shows, even if Config still schedules it", () => {
    expect(nextAboutCard(st({ votes: 12, answered: new Set<AboutQuestionId>(["sex", "age", "relationship", "kids", "education", "housing"]) }), { ...sched, aboutZipAt: 12 })).toBeNull();
  });
  it("never two in a row: a due card waits for the gap", () => {
    expect(nextAboutCard(st({ votes: 5, lastAskAt: 4 }), sched)).toBeNull();
    expect(nextAboutCard(st({ votes: 6, lastAskAt: 4 }), sched)).toBe("sex");
  });
  it("a skipped question comes back once, 10 votes later, then never", () => {
    const seq = play(40, Infinity, ["sex"]);
    expect(seq.filter((x) => x.endsWith(":sex"))).toEqual(["2:sex", "13:sex"]) // due at 12, but education was shown at 11, so it waits for the gap;
  });
  it("already-known answers are never asked; 0 turns a question off", () => {
    expect(nextAboutCard(st({ votes: 2, answered: new Set<AboutQuestionId>(["sex"]) }), sched)).toBeNull();
    expect(nextAboutCard(st({ votes: 4, answered: new Set<AboutQuestionId>(["sex"]) }), sched)).toBe("age");
    expect(nextAboutCard(st({ votes: 2 }), { ...sched, aboutSexAt: 0 })).toBeNull();
  });
});

describe("answers + shuffle", () => {
  it("valid answers only", () => {
    expect(isValidAboutAnswer("sex", "FEMALE")).toBe(true);
    expect(isValidAboutAnswer("sex", "UNDISCLOSED")).toBe(false);
    expect(isValidAboutAnswer("age", "AGE_25_34")).toBe(true);
    expect(isValidAboutAnswer("relationship", "DATING")).toBe(true);
    expect(isValidAboutAnswer("relationship", "TAKEN")).toBe(false);
    expect(isValidAboutAnswer("zip", "78704")).toBe(true);
    expect(isValidAboutAnswer("zip", "<script>")).toBe(false);
    expect(isValidAboutAnswer("education", "BACHELORS")).toBe(true);
    expect(isValidAboutAnswer("race", PREFER_NOT)).toBe(true);
    expect(isValidAboutAnswer("party", "INDEPENDENT")).toBe(true);
    expect(isValidAboutAnswer("party", "WHITE")).toBe(false);
  });
  it("card order: shuffled, but Prefer not to say always last", () => {
    for (let i = 0; i < 200; i++) {
      for (const opts of [RACE_OPTIONS, PARTY_OPTIONS] as readonly (readonly { id: string; label: string }[])[]) {
        const o = cardOrder(opts);
        expect(o).toHaveLength(opts.length);
        expect(o[o.length - 1].id).toBe(PREFER_NOT);
      }
    }
  });
  it("shuffle keeps every answer and spreads first place evenly", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const first = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const s = shuffled(items);
      expect([...s].sort()).toEqual(items);
      first.set(s[0], (first.get(s[0]) ?? 0) + 1);
    }
    for (const k of items) expect(first.get(k)!).toBeGreaterThan(800);
  });
});
