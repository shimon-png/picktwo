import { describe, it, expect } from "vitest";
import { classifySource, isEngaged } from "@/server/services/acquisition-rules";

describe("classifySource", () => {
  it("X ad clicks (twclid) and utm_source=x/twitter are the X campaign", () => {
    expect(classifySource({ twclid: "abc", landing: "/" })).toBe("x_campaign");
    expect(classifySource({ utm_source: "twitter", utm_medium: "paid" })).toBe("x_campaign");
    expect(classifySource({ utm_source: "X" })).toBe("x_campaign");
  });
  it("links from X without campaign tags are X organic", () => {
    expect(classifySource({ referrerHost: "t.co" })).toBe("x_organic");
    expect(classifySource({ referrerHost: "x.com" })).toBe("x_organic");
    expect(classifySource({ referrerHost: "mobile.twitter.com" })).toBe("x_organic");
  });
  it("other campaigns, other websites, direct", () => {
    expect(classifySource({ fbclid: "1" })).toBe("other_campaign");
    expect(classifySource({ utm_source: "newsletter" })).toBe("other_campaign");
    expect(classifySource({ referrerHost: "www.google.com" })).toBe("referral");
    expect(classifySource({ landing: "/" })).toBe("direct");
    expect(classifySource(null)).toBe("unknown");
  });
  it("the browser's first visit wins over this session", () => {
    expect(classifySource({ referrerHost: "www.google.com", first: { twclid: "x1" } })).toBe("x_campaign");
  });
});

describe("isEngaged", () => {
  it("3+ vote days or a posted battle", () => {
    expect(isEngaged({ voteDays: 3, postedBattle: false }, 3)).toBe(true);
    expect(isEngaged({ voteDays: 2, postedBattle: false }, 3)).toBe(false);
    expect(isEngaged({ voteDays: 0, postedBattle: true }, 3)).toBe(true);
  });
});
