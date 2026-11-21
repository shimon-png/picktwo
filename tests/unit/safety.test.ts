import { describe, expect, it } from "vitest";
import { decideImage, shouldAutoHide, strictest, isSevere } from "@/server/services/safety";

describe("decideImage", () => {
  it("allows clean photos", () => {
    expect(decideImage({ sexual: 0.01, violence: 0.02 }).verdict).toBe("allow");
  });
  it("blocks clearly explicit photos", () => {
    const d = decideImage({ sexual: 0.95 });
    expect(d.verdict).toBe("block");
    expect(d.reasons[0]).toMatch(/^sexual 0\.95/);
  });
  it("holds borderline photos for review", () => {
    expect(decideImage({ sexual: 0.4 }).verdict).toBe("review");
    expect(decideImage({ "violence/graphic": 0.5 }).verdict).toBe("review");
  });
  it("sends anything involving minors to a human, even if also explicit", () => {
    expect(decideImage({ sexual: 0.99, "sexual/minors": 0.3 }).verdict).toBe("review");
  });
  it("holds provider-flagged photos even under thresholds", () => {
    expect(decideImage({ sexual: 0.1 }, true).verdict).toBe("review");
  });
});

describe("strictest", () => {
  it("picks the strictest verdict", () => {
    expect(strictest([{ verdict: "allow", reasons: [] }, { verdict: "review", reasons: ["x"] }])).toEqual({ verdict: "review", reasons: ["x"] });
    expect(strictest([]).verdict).toBe("allow");
  });
});

describe("shouldAutoHide", () => {
  const rules = { autoHideReports: 3, severeAutoHideReports: 2, childSafetyAutoHideReports: 2 };
  it("hides after enough flags of any kind", () => {
    expect(shouldAutoHide({ total: 2, severe: 0, childSafety: 0 }, rules)).toBe(false);
    expect(shouldAutoHide({ total: 3, severe: 0, childSafety: 0 }, rules)).toBe(true);
  });
  it("hides sooner for nudity / child safety", () => {
    expect(shouldAutoHide({ total: 2, severe: 2, childSafety: 0 }, rules)).toBe(true);
    expect(shouldAutoHide({ total: 1, severe: 1, childSafety: 1 }, rules)).toBe(false);
  });
  it("treats 0 as off", () => {
    expect(shouldAutoHide({ total: 9, severe: 9, childSafety: 9 }, { autoHideReports: 0, severeAutoHideReports: 0, childSafetyAutoHideReports: 0 })).toBe(false);
  });
  it("knows severe reasons", () => {
    expect(isSevere("nudity")).toBe(true);
    expect(isSevere("spam")).toBe(false);
  });
});
