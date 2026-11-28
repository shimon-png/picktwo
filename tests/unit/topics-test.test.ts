import { describe, expect, it } from "vitest";
import { pickTopicsArm, summarizeTopicsTest, topicsCell, type TopicsVisitor } from "@/server/services/topics-test-rules";

const v = (o: Partial<TopicsVisitor>): TopicsVisitor => ({ day: "2026-11-28", arm: "control", votes: 0, sessions: 1, activeDays: 1, signedUp: false, choseTopic: false, ...o });

describe("pickTopicsArm", () => {
  it("is stable and respects the share", () => {
    expect(pickTopicsArm("dev_abc", 50)).toBe(pickTopicsArm("dev_abc", 50));
    expect(pickTopicsArm("dev_abc", 0)).toBe("control");
    expect(pickTopicsArm("dev_abc", 100)).toBe("topics");
    const n = Array.from({ length: 2000 }, (_, i) => pickTopicsArm(`dev_${i}`, 50)).filter((a) => a === "topics").length;
    expect(n).toBeGreaterThan(900);
    expect(n).toBeLessThan(1100);
  });
});

describe("topicsCell + summarizeTopicsTest", () => {
  it("counts visitors, votes, sign-ups and return visits", () => {
    const c = topicsCell([v({ votes: 4, sessions: 2, activeDays: 2, signedUp: true }), v({}), v({ votes: 2 })]);
    expect(c.visitors).toBe(3);
    expect(c.voters).toBe(2);
    expect(c.avgVotes).toBe(2);
    expect(c.votesPerSession).toBe(6 / 4);
    expect(c.signupRate).toBeCloseTo(1 / 3);
    expect(c.returned).toBe(1);
  });
  it("compares the groups day by day and overall", () => {
    const s = summarizeTopicsTest([
      v({ votes: 2 }),
      v({ votes: 4 }),
      v({ arm: "topics", votes: 6, choseTopic: true }),
      v({ arm: "topics", votes: 6, day: "2026-11-29" }),
    ]);
    expect(s.daily.map((d) => d.day)).toEqual(["2026-11-29", "2026-11-28"]);
    expect(s.total.control.avgVotes).toBe(3);
    expect(s.total.topics.avgVotes).toBe(6);
    expect(s.votesLift).toBe(1);
    expect(s.total.topics.choseTopic).toBe(1);
  });
});
