import { describe, expect, it } from "vitest";
import { isValidAboutAnswer, nextAboutCard, shuffled, type AboutQuestionId, type AboutSchedule, type AboutState } from "@/lib/about";
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
  it("follows the plan for a guest: sex 2, age 4, relationship 7, ZIP 12; nothing else before sign-up", () => {
    expect(play(40)).toEqual(["2:sex", "4:age", "7:relationship", "12:zip"]);
  });
  it("adds kids, housing, work once signed in", () => {
    expect(play(40, 16)).toEqual(["2:sex", "4:age", "7:relationship", "12:zip", "20:kids", "25:housing", "35:work"]);
  });
  it("never two in a row: a due card waits for the gap", () => {
    expect(nextAboutCard(st({ votes: 5, lastAskAt: 4 }), sched)).toBeNull();
    expect(nextAboutCard(st({ votes: 6, lastAskAt: 4 }), sched)).toBe("sex");
  });
  it("a skipped question comes back once, 10 votes later, then never", () => {
    const seq = play(40, Infinity, ["sex"]);
    expect(seq.filter((x) => x.endsWith(":sex"))).toEqual(["2:sex", "12:sex"]);
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
    expect(isValidAboutAnswer("relationship", "TAKEN")).toBe(true);
    expect(isValidAboutAnswer("zip", "78704")).toBe(true);
    expect(isValidAboutAnswer("zip", "<script>")).toBe(false);
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
