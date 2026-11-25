import { describe, expect, it } from "vitest";
import { axisWhy, lean, radarPoints, scoreAxes, typeName, visibleAxes, type TastePick } from "@/lib/taste-profile";

const pick = (chosen: string[], other: string[] = []): TastePick => ({ chosen, other });
const byId = (picks: TastePick[]) => Object.fromEntries(scoreAxes(picks).map((a) => [a.id, a]));

describe("scoreAxes", () => {
  it("a pick counts for the chosen side and against the side passed on", () => {
    const s = byId([pick(["romantic"], ["practical"]), pick(["romantic"]), pick([], ["practical"]), pick(["practical"]), pick(["romantic"]), pick(["romantic"])]);
    // 5 lean romantic, 1 practical over 6 battles → (5 − 1) / 6
    expect(s.romantic.n).toBe(6);
    expect(s.romantic.leftPicks).toBe(5);
    expect(s.romantic.score).toBeCloseTo(4 / 6);
    expect(s.direct.n).toBe(0);
    expect(s.direct.score).toBe(0);
  });
  it("is pulled toward 0 with fewer than 5 battles", () => {
    expect(byId([pick(["direct"])]).direct.score).toBeCloseTo(0.2);
    expect(byId([pick(["direct"]), pick(["direct"]), pick(["direct"]), pick(["direct"]), pick(["direct"])]).direct.score).toBe(1);
  });
  it("multi-trait poles: risk_taking counts as adventurous, traditional as classic", () => {
    const s = byId([pick(["risk_taking"]), pick(["traditional"])]);
    expect(s.adventurous.score).toBeGreaterThan(0);
    expect(s.trendy.score).toBeLessThan(0);
  });
  it("a pick that hits both poles cancels out", () => {
    expect(byId([pick(["romantic", "practical"])]).romantic).toMatchObject({ n: 1, score: 0, leftPicks: 0 });
  });
});

describe("unlocks, names, why", () => {
  const axes = scoreAxes([
    ...Array(6).fill(pick(["cautious"], ["risk_taking"])),
    ...Array(5).fill(pick(["premium_taste"])),
    ...Array(2).fill(pick(["direct"])),
  ]);
  it("nothing before 10 votes, the 2 best-evidenced at 10, all 6 at 30", () => {
    expect(visibleAxes(axes, 9, 10, 30)).toEqual([]);
    expect(visibleAxes(axes, 10, 10, 30).map((a) => a.id)).toEqual(["adventurous", "spender"]);
    expect(visibleAxes(axes, 30, 10, 30)).toHaveLength(6);
  });
  it("type name from the two strongest leans", () => {
    expect(typeName(axes)).toBe("Careful splurger");
    expect(typeName(scoreAxes([]))).toBeNull();
  });
  it("lean + why", () => {
    const adv = axes.find((a) => a.id === "adventurous")!;
    expect(lean(adv)).toBe("Cautious");
    expect(axisWhy(adv)).toMatch(/^You leaned cautious on 6 of 6 battles/);
    expect(axisWhy(axes.find((a) => a.id === "forgiving")!)).toBe("No battles have tested this yet.");
  });
  it("radar points: 0 sits on the middle ring, +1 on the outer", () => {
    const [top] = radarPoints([1, 0, 0, 0, 0, 0]);
    expect(top).toEqual([100, 20]);
    expect(radarPoints([0, 0, 0, 0, 0, 0])[0]).toEqual([100, 60]);
  });
});
