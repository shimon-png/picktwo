import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ASKING_PRESETS, ASKING_TOPICS, askingDue, askingMemory, eligible, pickAsking, presetBattleId, presetScore, type AskingPreset } from "@/lib/asking";
import { TITLE_MAX } from "@/lib/constants";

const base = { exclude: new Set<string>(), month: 11, seed: "s" };

describe("People like you are asking: the bank", () => {
  it("has about 50 questions with unique, url-safe ids across every topic", () => {
    expect(ASKING_PRESETS.length).toBeGreaterThanOrEqual(50);
    const ids = ASKING_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z_]{2,40}$/);
    for (const t of ASKING_TOPICS) expect(ASKING_PRESETS.filter((p) => p.topic === t).length).toBeGreaterThanOrEqual(5);
  });
  it("fits a battle: title, short labels, a story that doesn't repeat the title", () => {
    for (const p of ASKING_PRESETS) {
      expect(p.q.length, p.id).toBeLessThanOrEqual(TITLE_MAX);
      expect(p.a.length, p.id).toBeLessThanOrEqual(60);
      expect(p.b.length, p.id).toBeLessThanOrEqual(60);
      expect(p.a).not.toBe(p.b);
      if (p.context) expect(p.q.toLowerCase().includes(p.context.toLowerCase()), p.id).toBe(false);
      for (const m of p.months ?? []) expect(m >= 1 && m <= 12).toBe(true);
    }
  });
  it("has a battle for every preset in migration 0043 (re-run scripts/gen-asking-presets.ts after editing the bank)", () => {
    const sql = readFileSync("drizzle/0043_asking_presets.sql", "utf8");
    for (const p of ASKING_PRESETS) {
      expect(sql, p.id).toContain(`'${presetBattleId(p.id)}'`);
      expect(sql, p.id).toContain(p.q.replace(/'/g, "''"));
    }
  });
});

describe("People like you are asking: picking", () => {
  const p = (x: Partial<AskingPreset>): AskingPreset => ({ id: "x", q: "Q?", a: "A", b: "B", topic: "life", ...x });

  it("respects sex, age and season, letting unknowns through", () => {
    const her = p({ sex: "FEMALE", ages: ["AGE_18_24"], months: [11, 12] });
    expect(eligible(her, { month: 11 })).toBe(true);
    expect(eligible(her, { month: 11, sex: "FEMALE", age: "AGE_18_24" })).toBe(true);
    expect(eligible(her, { month: 11, sex: "MALE" })).toBe(false);
    expect(eligible(her, { month: 11, sex: "UNDISCLOSED" })).toBe(true);
    expect(eligible(her, { month: 11, age: "AGE_45_54" })).toBe(false);
    expect(eligible(her, { month: 6 })).toBe(false);
  });

  it("ranks the chosen topic, then ad words, then the season", () => {
    const plain = p({});
    expect(presetScore(p({ topic: "money" }), { month: 1, topic: "money" })).toBeGreaterThan(presetScore(plain, { month: 1, topic: "money" }));
    expect(presetScore(p({ keys: ["hinge"] }), { month: 1, campaign: "x dating hinge 2" })).toBeGreaterThan(presetScore(plain, { month: 1, campaign: "x dating hinge 2" }));
    expect(presetScore(p({ topic: "dating" }), { month: 1, campaign: "utm dating" })).toBeGreaterThan(presetScore(plain, { month: 1, campaign: "utm dating" }));
    expect(presetScore(p({ months: [1] }), { month: 1 })).toBeGreaterThan(presetScore(plain, { month: 1 }));
  });

  it("returns five questions on five different topics, never an excluded (retired or voted) one", () => {
    const out = pickAsking({ ...base, exclude: new Set(["w_party", "g_santa"]) });
    expect(out).toHaveLength(5);
    expect(new Set(out.map((x) => x.topic)).size).toBe(5);
    expect(out.map((x) => x.id)).not.toContain("w_party");
    expect(out.map((x) => x.id)).not.toContain("g_santa");
  });

  it("is stable for one person and rotates across people (no single question for everyone)", () => {
    expect(pickAsking({ ...base, seed: "u1:d" }).map((x) => x.id)).toEqual(pickAsking({ ...base, seed: "u1:d" }).map((x) => x.id));
    const seen = new Map<string, number>();
    const firsts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const out = pickAsking({ ...base, seed: `u${i}` });
      out.forEach((x) => seen.set(x.id, (seen.get(x.id) ?? 0) + 1));
      firsts.set(out[0].id, (firsts.get(out[0].id) ?? 0) + 1);
    }
    expect(seen.size).toBeGreaterThan(20);
    // No question takes the first slot for more than a fifth of people.
    for (const n of firsts.values()) expect(n).toBeLessThan(400);
    expect(pickAsking({ ...base, seed: "x", n: 3 })).toHaveLength(3);
  });

  it("leans on what we know: a woman from a dating ad mostly sees dating", () => {
    let dating = 0;
    for (let i = 0; i < 500; i++) {
      const out = pickAsking({ ...base, seed: `w${i}`, sex: "FEMALE", age: "AGE_25_34", campaign: "x_dating_hinge" });
      if (out.some((x) => x.topic === "dating")) dating++;
      for (const x of out) expect(x.sex === "MALE").toBe(false);
    }
    expect(dating).toBeGreaterThan(450);
  });

  it("follows the What's on your mind topic with more than one question", () => {
    const out = pickAsking({ ...base, topic: "money" });
    expect(out.filter((x) => x.topic === "money").length).toBeGreaterThanOrEqual(2);
  });

  it("shows at the set pick, then every N picks, a limited number of times, never over another card", () => {
    const d = { at: 6, every: 12, rounds: 3 };
    const n = { lastAt: null };
    expect(askingDue({ ...d, ...n, picks: 5, shown: 0, busy: false })).toBe(false);
    expect(askingDue({ ...d, ...n, picks: 6, shown: 0, busy: false })).toBe(true);
    expect(askingDue({ ...d, ...n, picks: 6, shown: 0, busy: true })).toBe(false);
    expect(askingDue({ ...d, ...n, picks: 7, shown: 0, busy: false })).toBe(true);
    expect(askingDue({ ...d, picks: 10, shown: 1, lastAt: 6, busy: false })).toBe(false);
    expect(askingDue({ ...d, picks: 18, shown: 1, lastAt: 6, busy: false })).toBe(true);
    expect(askingDue({ ...d, picks: 99, shown: 3, lastAt: 90, busy: false })).toBe(false);
    expect(askingDue({ ...d, ...n, at: 0, picks: 99, shown: 0, busy: false })).toBe(false);
  });
  it("waits a full gap after it last showed, even when the tab's pick count is far past it (coming back from Pickbot)", () => {
    const d = { at: 6, every: 12, rounds: 3 };
    // Shown at pick 20, back in the deck at pick 21: not again until pick 32.
    expect(askingDue({ ...d, picks: 21, shown: 1, lastAt: 20, busy: false })).toBe(false);
    expect(askingDue({ ...d, picks: 31, shown: 1, lastAt: 20, busy: false })).toBe(false);
    expect(askingDue({ ...d, picks: 32, shown: 1, lastAt: 20, busy: false })).toBe(true);
  });
  it("reads the tab's saved state, and drops it when it doesn't fit the pick count", () => {
    expect(askingMemory(JSON.stringify({ shown: 1, lastAt: 20 }), 21)).toEqual({ shown: 1, lastAt: 20 });
    expect(askingMemory(JSON.stringify({ shown: 1, lastAt: 20 }), 3)).toEqual({ shown: 0, lastAt: null });
    expect(askingMemory("nope", 5)).toEqual({ shown: 0, lastAt: null });
    expect(askingMemory(null, 5)).toEqual({ shown: 0, lastAt: null });
  });
});
