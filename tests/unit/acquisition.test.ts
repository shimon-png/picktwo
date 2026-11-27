import { describe, it, expect } from "vitest";
import { campaignOf, classifySource, isEngaged, NO_CAMPAIGN_TAG } from "@/server/services/acquisition-rules";

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

describe("campaignOf", () => {
  it("names the utm_campaign of campaign visits, cleaned", () => {
    expect(campaignOf({ utm_source: "x", utm_campaign: "whos_right" })).toBe("whos_right");
    expect(campaignOf({ twclid: "1", utm_campaign: " Ask Question " })).toBe("ask_question");
    expect(campaignOf({ utm_source: "newsletter", utm_campaign: "dec" })).toBe("dec");
    expect(campaignOf({ utm_source: "x", utm_campaign: "a".repeat(60) })).toHaveLength(40);
  });
  it("an ad click without utm_campaign is untagged", () => {
    expect(campaignOf({ twclid: "1" })).toBe(NO_CAMPAIGN_TAG);
  });
  it("no campaign for organic, referral, direct or unknown visits", () => {
    expect(campaignOf({ referrerHost: "t.co" })).toBeNull();
    expect(campaignOf({ referrerHost: "www.google.com" })).toBeNull();
    expect(campaignOf({ landing: "/" })).toBeNull();
    expect(campaignOf(null)).toBeNull();
  });
  it("the browser's first visit wins", () => {
    expect(campaignOf({ utm_source: "x", utm_campaign: "later", first: { utm_source: "x", utm_campaign: "first" } })).toBe("first");
    expect(campaignOf({ utm_source: "x", utm_campaign: "later", first: { landing: "/" } })).toBeNull();
  });
});

describe("isEngaged", () => {
  it("3+ vote days or a posted battle", () => {
    expect(isEngaged({ voteDays: 3, postedBattle: false }, 3)).toBe(true);
    expect(isEngaged({ voteDays: 2, postedBattle: false }, 3)).toBe(false);
    expect(isEngaged({ voteDays: 0, postedBattle: true }, 3)).toBe(true);
  });
});
