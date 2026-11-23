import { describe, it, expect } from "vitest";
import {
  capBlock, emailMilestones, groupEnabled, inQuietHours, isoWeekKey, localTime, needsAddress, nextLocalHour, pastHalfway, timeZoneFor, withUtm,
} from "@/server/services/email-rules";

const limits = { emailPerDay: 1, emailPerWeek: 4, emailDailyBudget: 80 };

describe("email caps", () => {
  it("the global budget stops everything (keeps room for sign-in codes)", () => {
    expect(capBlock("battle_live", { userToday: 0, userWeek: 0, globalToday: 80 }, limits)).toBe("budget");
  });
  it("engagement emails are capped per person; battle emails aren't", () => {
    expect(capBlock("weekly", { userToday: 1, userWeek: 1, globalToday: 3 }, limits)).toBe("daily_cap");
    expect(capBlock("weekly", { userToday: 0, userWeek: 4, globalToday: 3 }, limits)).toBe("weekly_cap");
    expect(capBlock("vote_milestone", { userToday: 5, userWeek: 9, globalToday: 3 }, limits)).toBeNull();
    expect(capBlock("weekly", { userToday: 0, userWeek: 0, globalToday: 3 }, limits)).toBeNull();
  });
  it("commercial emails need a postal address", () => {
    expect(needsAddress("weekly", "")).toBe(true);
    expect(needsAddress("weekly", "1 Main St, NY")).toBe(false);
    expect(needsAddress("battle_live", "")).toBe(false);
  });
});

describe("preferences", () => {
  it("battles follow notifyEmail; others default on; welcome always", () => {
    expect(groupEnabled("battles", { notifyEmail: false, emailPrefs: {} })).toBe(false);
    expect(groupEnabled("weekly", { notifyEmail: true, emailPrefs: {} })).toBe(true);
    expect(groupEnabled("weekly", { notifyEmail: true, emailPrefs: { weekly: false } })).toBe(false);
    expect(groupEnabled("always", { notifyEmail: false, emailPrefs: { weekly: false } })).toBe(true);
  });
});

describe("time", () => {
  it("maps US states to zones, defaults to Eastern", () => {
    expect(timeZoneFor("US", "CA")).toBe("America/Los_Angeles");
    expect(timeZoneFor("US", "California")).toBe("America/Los_Angeles");
    expect(timeZoneFor("US", "New Mexico")).toBe("America/Denver");
    expect(timeZoneFor("US", "New York")).toBe("America/New_York");
    expect(timeZoneFor("US", "TX")).toBe("America/Chicago");
    expect(timeZoneFor(null, null)).toBe("America/New_York");
    expect(timeZoneFor("GB", null)).toBe("Europe/London");
  });
  it("quiet hours wrap midnight", () => {
    expect(inQuietHours(22, 21, 8)).toBe(true);
    expect(inQuietHours(3, 21, 8)).toBe(true);
    expect(inQuietHours(8, 21, 8)).toBe(false);
    expect(inQuietHours(14, 21, 8)).toBe(false);
  });
  it("local time and the next 8 am", () => {
    const d = new Date("2026-11-22T14:30:00Z"); // Sunday 9:30 am in New York
    expect(localTime(d, "America/New_York")).toEqual({ weekday: 0, hour: 9 });
    const next = nextLocalHour(new Date("2026-11-23T03:10:00Z"), "America/New_York", 8); // 10:10 pm NY
    expect(next.toISOString()).toBe("2026-11-23T13:00:00.000Z");
  });
  it("ISO week keys", () => {
    expect(isoWeekKey(new Date("2026-11-22T12:00:00Z"))).toBe("2026-W47");
    expect(isoWeekKey(new Date("2026-11-23T12:00:00Z"))).toBe("2026-W48");
  });
});

describe("triggers", () => {
  it("milestones from config, 0 = unused", () => {
    expect(emailMilestones({ emailMilestone1: 1, emailMilestone2: 10, emailMilestone3: 0, emailMilestone4: 100 })).toEqual([1, 10, 100]);
  });
  it("halfway point", () => {
    const c = new Date("2026-11-20T00:00:00Z");
    const d = new Date("2026-11-22T00:00:00Z");
    expect(pastHalfway(c, d, new Date("2026-11-20T23:00:00Z"))).toBe(false);
    expect(pastHalfway(c, d, new Date("2026-11-21T00:00:00Z"))).toBe(true);
  });
  it("adds UTM tags", () => {
    expect(withUtm("https://crowdpick.ai/b/x?src=a", "weekly")).toBe("https://crowdpick.ai/b/x?src=a&utm_source=email&utm_medium=email&utm_campaign=weekly");
  });
});
