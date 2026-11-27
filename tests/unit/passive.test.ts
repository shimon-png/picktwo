import { describe, expect, it } from "vitest";
import { deviceTier, geoFromHeaders, groupPeople, incomeBand, parseAcsZipRows, parseDevice, screenKey } from "@/server/services/passive-rules";

const IPHONE_X_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Twitter for iPhone/10.70";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S928U Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 352.0.0";
const TIKTOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_36.5.0 BytedanceWebview/d8a21c6";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("parseDevice", () => {
  it("platform, OS, browser and in-app browser", () => {
    expect(parseDevice(IPHONE_X_APP)).toMatchObject({ platform: "ios", osVersion: "18.1", inApp: "x" });
    expect(parseDevice(IPHONE_SAFARI)).toMatchObject({ platform: "ios", browser: "safari", inApp: null });
    expect(parseDevice(IG_ANDROID)).toMatchObject({ platform: "android", osVersion: "14", inApp: "instagram" });
    expect(parseDevice(TIKTOK).inApp).toBe("tiktok");
    expect(parseDevice(MAC)).toMatchObject({ platform: "desktop", browser: "chrome" });
    expect(parseDevice("").platform).toBe("other");
  });
});

describe("deviceTier", () => {
  it("iPhone class from screen + density, either orientation", () => {
    expect(deviceTier({ platform: "ios", screenW: 430, screenH: 932, dpr: 3 })).toBe("flagship");
    expect(deviceTier({ platform: "ios", screenW: 932, screenH: 430, dpr: 3 })).toBe("flagship");
    expect(deviceTier({ platform: "ios", screenW: 393, screenH: 852, dpr: 3 })).toBe("mid");
    expect(deviceTier({ platform: "ios", screenW: 375, screenH: 667, dpr: 2 })).toBe("budget");
    expect(deviceTier({ platform: "ios", screenW: 380, screenH: 800, dpr: 3 })).toBe("unknown");
    expect(deviceTier({ platform: "ios", screenW: 820, screenH: 1180, dpr: 2 })).toBe("mid"); // iPad
  });
  it("Android from model, else memory", () => {
    expect(deviceTier({ platform: "android", model: "SM-S928U" })).toBe("flagship");
    expect(deviceTier({ platform: "android", model: "Pixel 8a" })).toBe("mid");
    expect(deviceTier({ platform: "android", model: "Pixel 9 Pro" })).toBe("flagship");
    expect(deviceTier({ platform: "android", model: "SM-A156U" })).toBe("budget");
    expect(deviceTier({ platform: "android", model: "moto g play - 2024" })).toBe("budget");
    expect(deviceTier({ platform: "android", memoryGb: 8 })).toBe("flagship");
    expect(deviceTier({ platform: "android", memoryGb: 2 })).toBe("budget");
    expect(deviceTier({ platform: "android" })).toBe("unknown");
    expect(deviceTier({ platform: "desktop" })).toBe("desktop");
  });
  it("screenKey", () => {
    expect(screenKey(852, 393, 3)).toBe("393x852@3");
    expect(screenKey(null, 3, 3)).toBeNull();
  });
});

describe("incomeBand", () => {
  it("ZIP median with a phone nudge near the edges", () => {
    expect(incomeBand(40_000, "mid")).toBe("lower");
    expect(incomeBand(75_000, "mid")).toBe("middle");
    expect(incomeBand(120_000, "budget")).toBe("upper");
    expect(incomeBand(90_000, "flagship")).toBe("upper"); // 103.5k
    expect(incomeBand(60_000, "budget")).toBe("lower"); // 52.2k
    expect(incomeBand(null, "flagship")).toBeNull();
  });
});

describe("Census + geo parsing", () => {
  it("parses ACS rows and drops missing values", () => {
    const rows = parseAcsZipRows([
      ["B19013_001E", "B25003_001E", "B25003_003E", "zip code tabulation area"],
      ["85000", "1000", "400", "10001"],
      ["-666666666", "0", "0", "00601"],
      ["70000", "10", "5", "bad"],
    ]);
    expect(rows).toEqual([
      { zip: "10001", medianIncome: 85000, renterPct: 0.4 },
      { zip: "00601", medianIncome: null, renterPct: null },
    ]);
    expect(parseAcsZipRows({})).toEqual([]);
  });
  it("reads Vercel geo headers", () => {
    const h: Record<string, string> = { "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "TX", "x-vercel-ip-city": "San%20Antonio", "x-vercel-ip-postal-code": "78205" };
    expect(geoFromHeaders((n) => h[n] ?? null)).toEqual({ country: "US", region: "TX", city: "San Antonio", zip: "78205" });
    expect(geoFromHeaders(() => null)).toEqual({ country: null, region: null, city: null, zip: null });
  });
});

describe("groupPeople", () => {
  it("counts per group, biggest first", () => {
    const g = groupPeople(
      [{ k: "ios", v: true, s: false }, { k: "ios", v: false, s: false }, { k: "android", v: true, s: true }],
      (p) => p.k,
      (p) => p.v,
      (p) => p.s,
    );
    expect(g).toEqual([
      { key: "ios", visitors: 2, voted: 1, signedUp: 0 },
      { key: "android", visitors: 1, voted: 1, signedUp: 1 },
    ]);
  });
});
