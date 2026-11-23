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
  const t = (touch.first && typeof touch.first === "object" ? touch.first : touch) as Record<string, unknown>;
  const s = (k: string) => (typeof t[k] === "string" ? (t[k] as string).trim() : "");
  if (s("twclid") || X_UTM.test(s("utm_source"))) return "x_campaign";
  if (s("utm_source") || s("utm_campaign") || CLICK_IDS.some((k) => s(k))) return "other_campaign";
  if (s("referrerHost")) return X_HOSTS.test(s("referrerHost")) ? "x_organic" : "referral";
  return "direct";
}

/** Engaged = voted on `minDays`+ different days, or posted a battle, within `windowDays` of signing up. */
export function isEngaged(o: { voteDays: number; postedBattle: boolean }, minDays: number) {
  return o.postedBattle || o.voteDays >= minDays;
}
