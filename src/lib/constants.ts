/** `tone` maps to the colour pairs in globals.css (e.g. pink → bg-pink-soft text-pink). */
export const CATEGORIES = [
  { id: "gifts", name: "Gifts", short: "Gifts", emoji: "🎁", tone: "pink", featured: true, sort: 1 },
  { id: "baby-names", name: "Baby names", short: "Baby names", emoji: "🍼", tone: "teal", featured: false, sort: 2 },
  { id: "home-design", name: "Home & design", short: "Home", emoji: "🏡", tone: "green", featured: false, sort: 3 },
  { id: "what-to-wear", name: "What to wear", short: "What to wear", emoji: "👗", tone: "violet", featured: false, sort: 4 },
  { id: "big-purchases", name: "Big purchases", short: "Big purchases", emoji: "🛒", tone: "amber", featured: false, sort: 5 },
  { id: "words", name: "Words that matter", short: "Words", emoji: "✍️", tone: "blue", featured: false, sort: 6 },
  { id: "other", name: "Other", short: "Other", emoji: "✨", tone: "neutral", featured: false, sort: 7 },
] as const;

export type Tone = (typeof CATEGORIES)[number]["tone"] | "coral";
/** Static class strings so Tailwind can see them. */
export const TONE_CLASSES: Record<Tone, { soft: string; solid: string }> = {
  pink: { soft: "bg-pink-soft text-pink", solid: "bg-pink text-white" },
  teal: { soft: "bg-teal-soft text-teal", solid: "bg-teal text-white" },
  green: { soft: "bg-green-soft text-green", solid: "bg-green text-white" },
  violet: { soft: "bg-violet-soft text-violet", solid: "bg-violet text-white" },
  amber: { soft: "bg-amber-soft text-amber-700", solid: "bg-amber text-white" },
  blue: { soft: "bg-accent-900 text-accent", solid: "bg-accent text-white" },
  coral: { soft: "bg-b-soft text-b", solid: "bg-b text-white" },
  neutral: { soft: "bg-surface text-zinc-600", solid: "bg-zinc-700 text-white" },
};
export const AVATAR_TONES: Tone[] = ["pink", "teal", "green", "violet"];

/**
 * One-tap reason chips shown after a vote (3 per battle). A chip counts as a valid reason for the
 * reason bonus even though it is shorter than `reasonMinChars`.
 */
export const REASON_SUGGESTIONS: Record<string, readonly string[]> = {
  gifts: ["Lasts longer", "More fun", "Better value"],
  "baby-names": ["Sounds better", "Easier to spell", "Ages well"],
  "home-design": ["Looks better", "More practical", "Easier to keep clean"],
  "what-to-wear": ["More flattering", "Fits the occasion", "More comfortable"],
  "big-purchases": ["Better value", "More reliable", "Better reviews"],
  words: ["Clearer", "Warmer", "More personal"],
  other: ["Just feels right", "More practical", "Better value"],
};
export const reasonSuggestions = (categoryId: string) => REASON_SUGGESTIONS[categoryId] ?? REASON_SUGGESTIONS.other;

/** Guess a category from the two option names (review sheet "we guessed"). */
export function guessCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  const rules: [CategoryId, RegExp][] = [
    ["baby-names", /\b(name|names|baby|boy|girl)\b/],
    ["what-to-wear", /\b(dress|shirt|jacket|coat|shoes?|boots|sneakers|outfit|suit|jeans|skirt|tie|hat|wear)\b/],
    ["gifts", /\b(lego|toy|set|game|gift|kit|book|puzzle|doll|easel|crayons?|art|plush|blocks)\b/],
    ["home-design", /\b(sofa|couch|rug|paint|wall|lamp|chair|table|kitchen|tile|curtains?|bed|room|wallpaper|shelf|cabinet)\b/],
    ["big-purchases", /\b(car|laptop|phone|tv|iphone|pixel|macbook|stroller|fridge|washer|camera|bike|vacuum)\b/],
    ["words", /\b(caption|speech|toast|message|text|email|card|wording|letter)\b/],
  ];
  for (const [id, re] of rules) if (re.test(t)) return id;
  return "gifts";
}

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
  /** Display tiers on the ⚡ meter: Normal below tierHighAt, High below tierTopAt, Top at/above. */
  tierHighAt: 20,
  tierTopAt: 40,
} as const;
export type Economy = { -readonly [K in keyof typeof ECONOMY_DEFAULTS]: number };

export const FEATURE_DEFAULTS = {
  requireImageModeration: false,
  childSafetyAutoHideReports: 2,
};

export const POLICY_VERSION = "2026-11-draft";
