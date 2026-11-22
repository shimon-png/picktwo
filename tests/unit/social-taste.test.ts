import { describe, it, expect } from "vitest";
import { agreementPct, rankTwins, similarityScore } from "@/server/services/taste";
import { canSendDm, pairKey, type DmCheck } from "@/server/services/dm-rules";

describe("taste similarity", () => {
  it("agreement percentage", () => {
    expect(agreementPct(7, 10)).toBe(70);
    expect(agreementPct(0, 0)).toBe(0);
  });
  it("more evidence beats a lucky streak", () => {
    expect(similarityScore(9, 10)).toBeGreaterThan(similarityScore(1, 1));
    expect(similarityScore(30, 40)).toBeGreaterThan(similarityScore(3, 4));
    expect(similarityScore(10, 10)).toBeGreaterThan(similarityScore(9, 10));
    expect(similarityScore(0, 5)).toBe(0);
  });
  it("ranks and filters by minimum shared battles", () => {
    const out = rankTwins([
      { id: "a", shared: 2, agree: 2 },
      { id: "b", shared: 10, agree: 9 },
      { id: "c", shared: 4, agree: 4 },
      { id: "d", shared: 10, agree: 3 },
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "d"]);
    expect(out[0].pct).toBe(90);
  });
});

describe("direct message rules", () => {
  const base: DmCheck = {
    senderBanned: false, recipientExists: true, recipientBanned: false, recipientReachable: true,
    blocked: false, recipientPolicy: "EVERYONE", recipientFollowsSender: false, recipientWroteFirst: false, self: false,
  };
  it("pair key is order independent", () => {
    expect(pairKey("b", "a")).toEqual(["a", "b"]);
    expect(pairKey("a", "b")).toEqual(["a", "b"]);
  });
  it("allows by default", () => expect(canSendDm(base)).toEqual({ ok: true }));
  it("blocks win over everything", () => {
    expect(canSendDm({ ...base, blocked: true, recipientWroteFirst: true })).toEqual({ ok: false, reason: "blocked" });
  });
  it("respects the recipient's policy for new conversations", () => {
    expect(canSendDm({ ...base, recipientPolicy: "NOBODY" })).toEqual({ ok: false, reason: "policy" });
    expect(canSendDm({ ...base, recipientPolicy: "FOLLOWING" })).toEqual({ ok: false, reason: "policy" });
    expect(canSendDm({ ...base, recipientPolicy: "FOLLOWING", recipientFollowsSender: true })).toEqual({ ok: true });
  });
  it("replies are allowed whatever the policy", () => {
    expect(canSendDm({ ...base, recipientPolicy: "NOBODY", recipientWroteFirst: true })).toEqual({ ok: true });
  });
  it("can't message yourself, banned or unreachable accounts", () => {
    expect(canSendDm({ ...base, self: true }).ok).toBe(false);
    expect(canSendDm({ ...base, senderBanned: true }).ok).toBe(false);
    expect(canSendDm({ ...base, recipientBanned: true }).ok).toBe(false);
    expect(canSendDm({ ...base, recipientReachable: false })).toEqual({ ok: false, reason: "unreachable" });
  });
});
