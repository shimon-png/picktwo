import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { plusUntilFrom, verifyStripeSignature } from "@/server/services/plus-rules";
import { platformFrom, shouldSuggestInstall } from "@/lib/install";

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const sign = (t: number, b = body, s = secret) => createHmac("sha256", s).update(`${t}.${b}`).digest("hex");
  it("accepts a fresh, correct signature", () => {
    expect(verifyStripeSignature(body, `t=1000,v1=${sign(1000)}`, secret, 1010)).toBe(true);
    expect(verifyStripeSignature(body, `t=1000,v1=deadbeef,v1=${sign(1000)}`, secret, 1010)).toBe(true);
  });
  it("rejects tampering, old timestamps and missing parts", () => {
    expect(verifyStripeSignature('{"id":"evt_2"}', `t=1000,v1=${sign(1000)}`, secret, 1010)).toBe(false);
    expect(verifyStripeSignature(body, `t=1000,v1=${sign(1000)}`, secret, 2000)).toBe(false);
    expect(verifyStripeSignature(body, `t=1000,v1=${sign(1000, body, "other")}`, secret, 1010)).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
    expect(verifyStripeSignature(body, "t=1000", secret, 1000)).toBe(false);
  });
});

describe("plusUntilFrom", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("runs to the period end (+1h grace) while paid", () => {
    expect(plusUntilFrom({ status: "active", current_period_end: 1_800_000_000 }, now).getTime()).toBe(1_800_000_000_000 + 3600_000);
    expect(plusUntilFrom({ status: "past_due", items: { data: [{ current_period_end: 1_800_000_000 }] } }, now).getTime()).toBe(1_800_000_000_000 + 3600_000);
  });
  it("ends now when canceled or unpaid", () => {
    expect(plusUntilFrom({ status: "canceled", current_period_end: 1_800_000_000 }, now)).toEqual(now);
    expect(plusUntilFrom({ status: "active" }, now)).toEqual(now);
  });
});

describe("install suggestion", () => {
  const base = { platform: "ios" as const, standalone: false, visits: 3, dismissedAt: null, now: 10 * 86400_000, canPrompt: false };
  it("phones after a couple of visits", () => {
    expect(shouldSuggestInstall(base)).toBe(true);
    expect(shouldSuggestInstall({ ...base, visits: 1 })).toBe(false);
    expect(shouldSuggestInstall({ ...base, standalone: true })).toBe(false);
    expect(shouldSuggestInstall({ ...base, platform: "desktop" })).toBe(false);
  });
  it("Android needs the browser's prompt; snoozes after Not now", () => {
    expect(shouldSuggestInstall({ ...base, platform: "android" })).toBe(false);
    expect(shouldSuggestInstall({ ...base, platform: "android", canPrompt: true })).toBe(true);
    expect(shouldSuggestInstall({ ...base, dismissedAt: 5 * 86400_000 })).toBe(false);
    expect(shouldSuggestInstall({ ...base, dismissedAt: 5 * 86400_000, now: 20 * 86400_000 })).toBe(true);
  });
  it("platform from user agent", () => {
    expect(platformFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(platformFrom("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
    expect(platformFrom("Mozilla/5.0 (Macintosh)")).toBe("desktop");
  });
});
