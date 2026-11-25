import { describe, expect, it } from "vitest";
import { platformFrom, shouldSuggestInstall } from "@/lib/install";

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
