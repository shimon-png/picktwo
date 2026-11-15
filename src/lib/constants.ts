export const CATEGORIES = [
  { id: "gifts", name: "Gifts", emoji: "🎁", featured: true, sort: 1 },
  { id: "baby-names", name: "Baby names", emoji: "🍼", featured: false, sort: 2 },
  { id: "big-purchases", name: "Big purchases", emoji: "🛒", featured: false, sort: 3 },
  { id: "what-to-wear", name: "What to wear", emoji: "👗", featured: false, sort: 4 },
  { id: "home-design", name: "Home & design", emoji: "🏡", featured: false, sort: 5 },
  { id: "words", name: "Words that matter", emoji: "✍️", featured: false, sort: 6 },
  { id: "other", name: "Other", emoji: "✨", featured: false, sort: 7 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[6];

export const KID_AGES = [
  { id: "AGE_0_2", label: "0–2" },
  { id: "AGE_3_4", label: "3–4" },
  { id: "AGE_5_8", label: "5–8" },
  { id: "AGE_9_12", label: "9–12" },
  { id: "AGE_13_17", label: "13–17" },
] as const;
export const KID_AGE_IDS = ["AGE_0_2", "AGE_3_4", "AGE_5_8", "AGE_9_12", "AGE_13_17"] as const;
export const kidAgeLabel = (id: string) => KID_AGES.find((k) => k.id === id)?.label ?? id;

export const RECIPIENTS = ["Child", "Partner", "Parent", "Friend", "Myself", "Other"] as const;
export const BUDGETS = ["Under $25", "$25–50", "$50–100", "$100–250", "$250+"] as const;
export const OCCASIONS = ["Birthday", "Holiday", "Wedding", "Interview", "Date", "Everyday", "Other"] as const;
export const INTERESTS = ["Gifts", "Fashion", "Home", "Tech", "Parenting", "Names", "Writing", "Cars", "Food"] as const;

export const DEADLINE_PRESETS = [
  { id: "1h", label: "1 hour", hours: 1 },
  { id: "3h", label: "3 hours", hours: 3 },
  { id: "24h", label: "24 hours", hours: 24 },
  { id: "3d", label: "3 days", hours: 72 },
  { id: "7d", label: "7 days", hours: 168 },
] as const;

/** Priority Queue economy defaults (PRD 5.3). Overridable via AppConfig table. */
export const ECONOMY_DEFAULTS = {
  starterPoints: 10,
  firstBattleBonus: 5,
  votePoints: 1,
  voteReasonBonus: 1,
  reasonMinChars: 15,
  dailyVotePointCap: 50,
  ownerHelpfulPoints: 3,
  ownerHelpfulMaxPerBattle: 3,
  loopClosedPoints: 10,
  loopClosedFastBonus: 5,
  loopClosedFastHours: 48,
  outcomeNotePoints: 2,
  outcomeNoteMinChars: 20,
  calledItPoints: 2,
  minVotesForLoop: 3,
  inviteBonus: 5,
  boostCost: 15,
  boostHours: 6,
  boostVotes: 25,
  openLoopGraceHours: 72,
  decayPercent: 10,
  decayInactiveDays: 30,
  decayFloor: 10,
  minDwellMs: 1500,
  burstWindowSec: 60,
  burstMaxVotes: 10,
  degenerateMinVotes: 30,
  degenerateRatio: 0.9,
  priorityCap: 200,
} as const;
export type Economy = { -readonly [K in keyof typeof ECONOMY_DEFAULTS]: number };

export const FEATURE_DEFAULTS = {
  requireImageModeration: false,
  childSafetyAutoHideReports: 2,
};

export const POLICY_VERSION = "2026-11-draft";
