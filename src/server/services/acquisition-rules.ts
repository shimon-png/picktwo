/**
 * Where a sign-up came from, judged by their first visit (pure, unit tested). Shown on /admin/brain.
 * Uses the attribution the browser logs on `session_start` (lib/events.ts `attribution()` / `firstTouch()`).
 */

export type Source = "x_campaign" | "x_organic" | "other_campaign" | "referral" | "direct" | "unknown";

export const SOURCE_LABELS: Record<Source, string> = {
  x_campaign: "X campaign (ads)",
  x_organic: "X organic (shared links)",
  other_campaign: "Other campaigns",
  referral: "Other websites",
  direct: "Direct / organic",
  unknown: "Unknown (signed up before tracking)",
};

const X_HOSTS = /^(t\.co|(www\.|mobile\.)?(x|twitter)\.com)$/i;
const X_UTM = /^(x|twitter|x\.com|twitter\.com)$/i;
const CLICK_IDS = ["fbclid", "gclid", "ttclid", "msclkid", "li_fat_id", "rdt_cid", "sccid"];

/** `touch` = a session_start's props (or its `first` = the browser's very first visit, which wins when present). */
export function classifySource(touch: Record<string, unknown> | null | undefined): Source {
  if (!touch) return "unknown";
  const s = tagReader(touch);
  if (s("twclid") || X_UTM.test(s("utm_source"))) return "x_campaign";
  if (s("utm_source") || s("utm_campaign") || CLICK_IDS.some((k) => s(k))) return "other_campaign";
  if (s("referrerHost")) return X_HOSTS.test(s("referrerHost")) ? "x_organic" : "referral";
  return "direct";
}

/** Reads trimmed string tags from a touch, where the browser's first visit (`first`) wins when present. */
function tagReader(touch: Record<string, unknown>) {
  const t = (touch.first && typeof touch.first === "object" ? touch.first : touch) as Record<string, unknown>;
  return (k: string) => (typeof t[k] === "string" ? (t[k] as string).trim() : "");
}

/** Shown for a campaign visit (an ad click) whose link carried no utm_campaign. */
export const NO_CAMPAIGN_TAG = "(no utm_campaign)";

/**
 * Which ad campaign a visit came from (Alex + Shimon, Nov 26: compare the "Who's right?" and "Got a question?" X
 * campaigns): its `utm_campaign`, cleaned (lower case, spaces to `_`, at most 40 characters). Only for campaign
 * visits (X campaign / other campaigns); null for organic, referral, direct and unknown. Same first-visit rule as
 * `classifySource()`.
 */
export function campaignOf(touch: Record<string, unknown> | null | undefined): string | null {
  const src = classifySource(touch);
  if (src !== "x_campaign" && src !== "other_campaign") return null;
  const c = tagReader(touch!)("utm_campaign").toLowerCase().replace(/\s+/g, "_").slice(0, 40);
  return c || NO_CAMPAIGN_TAG;
}

/** Engaged = voted on `minDays`+ different days, or posted a battle, within `windowDays` of signing up. */
export function isEngaged(o: { voteDays: number; postedBattle: boolean }, minDays: number) {
  return o.postedBattle || o.voteDays >= minDays;
}
