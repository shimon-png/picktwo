/**
 * Pure rules for lifecycle emails (no DB, no network) — unit tested. The plan is in docs/emails.md.
 */

export type EmailGroup = "battles" | "voted" | "weekly" | "tips" | "messages" | "always";

export type EmailKind =
  | "battle_live" // E1
  | "vote_milestone" // E2
  | "needs_votes" // E3
  | "results_in" // E4
  | "loop_reminder" // E5
  | "voter_updates" // E6 + E7 (outcomes of battles you voted on, helpful reasons), batched
  | "welcome" // E8
  | "first_battle_nudge" // E9
  | "tier_up" // E10
  | "winback" // E11
  | "weekly" // E12
  | "dm_request"; // someone who follows you wants to message you

type KindMeta = {
  group: EmailGroup;
  /** Counts toward the per-person daily/weekly cap. */
  engagement: boolean;
  /** Commercial under CAN-SPAM: needs a postal address in the footer (MAIL_POSTAL_ADDRESS). */
  commercial: boolean;
  /** Sent right after the person's own action, so quiet hours don't apply. */
  ignoresQuietHours: boolean;
};

export const EMAIL_KINDS: Record<EmailKind, KindMeta> = {
  battle_live: { group: "battles", engagement: false, commercial: false, ignoresQuietHours: true },
  vote_milestone: { group: "battles", engagement: false, commercial: false, ignoresQuietHours: false },
  needs_votes: { group: "battles", engagement: true, commercial: false, ignoresQuietHours: false },
  results_in: { group: "battles", engagement: false, commercial: false, ignoresQuietHours: false },
  loop_reminder: { group: "battles", engagement: false, commercial: false, ignoresQuietHours: false },
  voter_updates: { group: "voted", engagement: true, commercial: false, ignoresQuietHours: false },
  welcome: { group: "always", engagement: false, commercial: false, ignoresQuietHours: true },
  first_battle_nudge: { group: "tips", engagement: true, commercial: true, ignoresQuietHours: false },
  tier_up: { group: "tips", engagement: true, commercial: false, ignoresQuietHours: false },
  winback: { group: "tips", engagement: true, commercial: true, ignoresQuietHours: false },
  weekly: { group: "weekly", engagement: true, commercial: true, ignoresQuietHours: false },
  dm_request: { group: "messages", engagement: false, commercial: false, ignoresQuietHours: false },
};

export const EMAIL_GROUP_LABELS: Record<Exclude<EmailGroup, "always">, { label: string; desc: string }> = {
  battles: { label: "My battles", desc: "Your battle is live, vote milestones, results, close-the-loop reminders" },
  voted: { label: "Battles I voted on", desc: "How they turned out, “you called it”, when your reason helped" },
  weekly: { label: "Weekly roundup", desc: "A few battles picked for you and how your past picks turned out" },
  tips: { label: "Tips & reminders", desc: "Getting started, reaching a new priority tier, points about to fade" },
  messages: { label: "Message requests", desc: "When someone who follows you wants to send you a message" },
};

/** Is this group on for the person? "battles" uses the older notifyEmail column; others default to on. */
export function groupEnabled(group: EmailGroup, u: { notifyEmail: boolean; emailPrefs: Partial<Record<string, boolean>> }) {
  if (group === "always") return true;
  if (group === "battles") return u.notifyEmail;
  return u.emailPrefs[group] !== false;
}

export type CapCounts = { userToday: number; userWeek: number; globalToday: number };
export type CapLimits = { emailPerDay: number; emailPerWeek: number; emailDailyBudget: number };

/** Why an email can't go now (null = it can). The global budget applies to everything except sign-in codes. */
export function capBlock(kind: EmailKind, c: CapCounts, l: CapLimits): "budget" | "daily_cap" | "weekly_cap" | null {
  if (c.globalToday >= l.emailDailyBudget) return "budget";
  if (!EMAIL_KINDS[kind].engagement) return null;
  if (c.userToday >= l.emailPerDay) return "daily_cap";
  if (c.userWeek >= l.emailPerWeek) return "weekly_cap";
  return null;
}

/** Commercial emails need a postal address in the footer; without one we don't send them. */
export function needsAddress(kind: EmailKind, postalAddress: string | undefined | null) {
  return EMAIL_KINDS[kind].commercial && !postalAddress?.trim();
}

// ---------------- Time ----------------

/** US state → main IANA time zone (good enough for quiet hours and the Sunday roundup). */
const US_TZ: Record<string, string> = {
  // Pacific
  CA: "America/Los_Angeles", WA: "America/Los_Angeles", OR: "America/Los_Angeles", NV: "America/Los_Angeles",
  // Mountain
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Boise", MT: "America/Denver", NM: "America/Denver", UT: "America/Denver", WY: "America/Denver",
  // Central
  AL: "America/Chicago", AR: "America/Chicago", IA: "America/Chicago", IL: "America/Chicago", KS: "America/Chicago", LA: "America/Chicago",
  MN: "America/Chicago", MO: "America/Chicago", MS: "America/Chicago", ND: "America/Chicago", NE: "America/Chicago", OK: "America/Chicago",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", WI: "America/Chicago",
  // Alaska / Hawaii
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

/** Full state names (profiles store "California", ZIP lookups may give "CA"). */
const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", idaho: "ID", illinois: "IL",
  iowa: "IA", kansas: "KS", louisiana: "LA", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE",
  nevada: "NV", "new mexico": "NM", "north dakota": "ND", oklahoma: "OK", oregon: "OR", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", washington: "WA", wisconsin: "WI", wyoming: "WY", hawaii: "HI",
};

/** Best-guess time zone from the profile. Unknown → US Eastern (most users). */
export function timeZoneFor(country: string | null | undefined, region: string | null | undefined): string {
  if (!country || country === "US") {
    const r = (region ?? "").trim();
    const st = US_STATE_CODES[r.toLowerCase()] ?? r.toUpperCase();
    return US_TZ[st] ?? "America/New_York";
  }
  const byCountry: Record<string, string> = { GB: "Europe/London", IE: "Europe/Dublin", CA: "America/Toronto", AU: "Australia/Sydney", IL: "Asia/Jerusalem", DE: "Europe/Berlin", FR: "Europe/Paris" };
  return byCountry[country] ?? "UTC";
}

/** Local weekday (0 = Sunday) and hour of `date` in `tz`. */
export function localTime(date: Date, tz: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour: hour % 24 };
}

/** Is `hour` inside quiet hours [start, end) (wrapping past midnight)? */
export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** The next moment (on the hour) when it's `endHour` local time, within the next 24 hours. */
export function nextLocalHour(now: Date, tz: string, endHour: number): Date {
  const top = new Date(now);
  top.setUTCMinutes(0, 0, 0);
  for (let i = 1; i <= 25; i++) {
    const t = new Date(top.getTime() + i * 3600_000);
    if (localTime(t, tz).hour === endHour) return t;
  }
  return new Date(now.getTime() + 8 * 3600_000);
}

/** Week key like "2026-W48" (ISO week), used so the weekly roundup sends once per week. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------- Triggers ----------------

/** Milestones that send an email (from the economy config; 0 = unused). */
export function emailMilestones(e: { emailMilestone1: number; emailMilestone2: number; emailMilestone3: number; emailMilestone4: number }) {
  return [e.emailMilestone1, e.emailMilestone2, e.emailMilestone3, e.emailMilestone4].filter((n) => n > 0).sort((a, b) => a - b);
}

/** Has the battle passed the halfway point between posting and its deadline? */
export function pastHalfway(createdAt: Date, deadline: Date, now: Date) {
  return now.getTime() >= createdAt.getTime() + (deadline.getTime() - createdAt.getTime()) / 2;
}

/** Append UTM tags to an app link so the data brain can attribute visits to emails. */
export function withUtm(url: string, kind: EmailKind): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "email");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", kind);
  return u.toString();
}
