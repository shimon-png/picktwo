import { describe, it, expect } from "vitest";
import { agreementPct, rankTwins, similarityScore } from "@/server/services/taste";
import { canType, dmState, pairKey, sendDeniedMessage, type DmFacts } from "@/server/services/dm-rules";

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

describe("direct message rules (requests, follow + messages-on)", () => {
  const base: DmFacts = {
    self: false, meBanned: false, otherBanned: false, otherReachable: true, blocked: false,
    meChatOn: true, otherChatOn: true, iFollow: true, convo: null,
  };
  it("pair key is order independent", () => {
    expect(pairKey("b", "a")).toEqual(["a", "b"]);
  });
  it("you need to follow them to start", () => {
    expect(dmState({ ...base, iFollow: false })).toEqual({ kind: "follow_first" });
    expect(dmState(base)).toEqual({ kind: "can_request" });
  });
  it("your messages must be on to send; you're sent to Settings first", () => {
    expect(dmState({ ...base, meChatOn: false })).toEqual({ kind: "enable_chat", then: "send" });
  });
  it("a request doesn't need the other person to have messages on yet", () => {
    expect(dmState({ ...base, otherChatOn: false })).toEqual({ kind: "can_request" });
  });
  it("after sending, you wait (also after a decline, which isn't revealed)", () => {
    expect(dmState({ ...base, convo: { status: "PENDING", requestedByMe: true } })).toEqual({ kind: "request_sent" });
    expect(dmState({ ...base, convo: { status: "DECLINED", requestedByMe: true } })).toEqual({ kind: "request_sent" });
  });
  it("the receiver must turn messages on, then accepts one request at a time", () => {
    const req = { status: "PENDING" as const, requestedByMe: false };
    expect(dmState({ ...base, meChatOn: false, convo: req })).toEqual({ kind: "enable_chat", then: "accept" });
    expect(dmState({ ...base, iFollow: false, convo: req })).toEqual({ kind: "request_received" });
    expect(dmState({ ...base, convo: { status: "DECLINED", requestedByMe: false } })).toEqual({ kind: "declined" });
  });
  it("accepted = chat while both have messages on", () => {
    const ok = { status: "ACCEPTED" as const, requestedByMe: true };
    expect(dmState({ ...base, convo: ok })).toEqual({ kind: "chat" });
    expect(dmState({ ...base, otherChatOn: false, convo: ok })).toEqual({ kind: "other_off" });
    expect(dmState({ ...base, meChatOn: false, convo: ok })).toEqual({ kind: "enable_chat", then: "chat" });
  });
  it("blocks, bans and seed profiles stop everything", () => {
    expect(dmState({ ...base, blocked: true, convo: { status: "ACCEPTED", requestedByMe: true } }).kind).toBe("unavailable");
    expect(dmState({ ...base, otherReachable: false })).toEqual({ kind: "unavailable", reason: "unreachable" });
    expect(dmState({ ...base, self: true }).kind).toBe("unavailable");
  });
  it("only can_request and chat can type", () => {
    expect(canType({ kind: "can_request" })).toBe(true);
    expect(canType({ kind: "chat" })).toBe(true);
    expect(canType({ kind: "request_sent" })).toBe(false);
    expect(sendDeniedMessage({ kind: "follow_first" }, "maya")).toMatch(/Follow @maya/);
  });
});
