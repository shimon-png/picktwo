/**
 * Categories are no longer part of the product (no picker, filter or labels). The table and the
 * battle.category_id column remain for existing data; every new battle is stored as DEFAULT_CATEGORY_ID.
 * This list only seeds the category table (FK target).
 */
export const CATEGORIES = [
  { id: "gifts", name: "Gifts", emoji: "🎁", featured: true, sort: 1 },
  { id: "baby-names", name: "Baby names", emoji: "🍼", featured: false, sort: 2 },
  { id: "home-design", name: "Home & design", emoji: "🏡", featured: false, sort: 3 },
  { id: "what-to-wear", name: "What to wear", emoji: "👗", featured: false, sort: 4 },
  { id: "big-purchases", name: "Big purchases", emoji: "🛒", featured: false, sort: 5 },
  { id: "words", name: "Words that matter", emoji: "✍️", featured: false, sort: 6 },
  { id: "other", name: "Other", emoji: "✨", featured: false, sort: 7 },
] as const;
export const DEFAULT_CATEGORY_ID = "other";

/** `tone` maps to the colour pairs in globals.css (e.g. pink → bg-pink-soft text-pink). */
export type Tone = "pink" | "teal" | "green" | "violet" | "amber" | "blue" | "coral" | "neutral";
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
/** Required profile fields (the user's own sex and age range; ZIP is validated in validators.ts). */
export const SEX_OPTIONS = [
  { id: "MALE", label: "Male" },
  { id: "FEMALE", label: "Female" },
  { id: "UNDISCLOSED", label: "Prefer not to say" },
] as const;
export const SEX_IDS = ["MALE", "FEMALE", "UNDISCLOSED"] as const;
export const AGE_RANGES = [
  { id: "AGE_18_24", label: "18–24" },
  { id: "AGE_25_34", label: "25–34" },
  { id: "AGE_35_44", label: "35–44" },
  { id: "AGE_45_54", label: "45–54" },
  { id: "AGE_55_64", label: "55–64" },
  { id: "AGE_65_PLUS", label: "65+" },
] as const;
export const AGE_RANGE_IDS = ["AGE_18_24", "AGE_25_34", "AGE_35_44", "AGE_45_54", "AGE_55_64", "AGE_65_PLUS"] as const;
export const KIDS_STATUS_OPTIONS = [
  { id: "YES", label: "Yes" },
  { id: "NO", label: "No" },
  { id: "EXPECTING", label: "Expecting" },
  { id: "UNDISCLOSED", label: "Prefer not to say" },
] as const;
export const KIDS_STATUS_IDS = ["YES", "NO", "EXPECTING", "UNDISCLOSED"] as const;
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
  { id: "5d", label: "5 days", hours: 120 },
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
  /** Battles a signed-out visitor can vote on before the "Sign up to keep voting" gate (15 since Nov 25, Shimon; was 5). */
  guestVoteLimit: 15,
  /**
   * Sign-up gate A/B test (services/gate-test.ts): % of new signed-out browsers put in group B, where the gate is a
   * closable dialog and they can keep voting. Group A (control) is the hard gate. 0 = test off, everyone gets A.
   * Assignments are saved, so changing this only affects browsers seen after the change.
   */
  gateTestPct: 50,
  /**
   * About-you cards in the Vote deck (lib/about.ts): the vote number each question is first asked after (0 = off).
   * Guests: sex, age, relationship, ZIP. With an account: kids, housing, work.
   */
  aboutSexAt: 2,
  aboutAgeAt: 4,
  aboutRelationshipAt: 7,
  aboutZipAt: 12,
  aboutKidsAt: 20,
  aboutHousingAt: 25,
  aboutWorkAt: 35,
  /** Votes between two about-you cards (2 = never two in a row, two battles between). */
  aboutMinGap: 2,
  /** A skipped question comes back once, this many votes later. */
  aboutSkipRetry: 10,
  /** Share of people (stable per account/browser) who never see about-you cards, to measure their cost in votes. */
  aboutHoldoutPct: 10,
  /** Group B: the closable sign-up dialog shows again every this many votes after the free ones. */
  softGateEvery: 5,
  /** Close the loop (docs/rules/close-the-loop-and-experts.md): longest a battle can run, in hours (5 days). */
  maxBattleHours: 120,
  /** Posting is blocked while a user has this many closed battles with no reported choice (0 = off). */
  maxUnreportedBattles: 3,
  /** Correct picks needed for Pro (check), Expert (gold check) and Super expert (diamond check). */
  proAt: 20,
  expertAt: 50,
  superExpertAt: 100,
  /** Lifecycle emails (docs/emails.md). Vote milestones that send an email (0 = unused slot). */
  emailMilestone1: 1,
  emailMilestone2: 10,
  emailMilestone3: 50,
  emailMilestone4: 100,
  /** At most one milestone email per battle in this many hours (the highest crossed one wins). */
  emailMilestoneGapHours: 6,
  /** Engagement emails (roundup, nudges, voter updates…) per person. */
  emailPerDay: 1,
  emailPerWeek: 4,
  /** Optional ceiling on all emails except sign-in codes, per UTC day. 0 = no ceiling (Resend Pro, Nov 23 2026). */
  emailDailyBudget: 0,
  /** Local quiet hours: nothing sends from emailQuietStart:00 until emailQuietEnd:00. */
  emailQuietStart: 21,
  emailQuietEnd: 8,
  /** Skip "real-time" emails if the person used the app in the last N minutes (they already saw it). */
  emailActiveSkipMinutes: 30,
  /** "Needs more votes" goes out at the halfway point if a battle has fewer votes than this. */
  emailNeedsVotesUnder: 5,
  /** Weekly roundup: local day (0 = Sunday) and hour. */
  emailWeeklyDay: 0,
  emailWeeklyHour: 9,
  /** Data brain Phase 3: how much Shimon's engagement score moves the Vote deck order (0 = off). */
  engagementWeight: 2,
  /** Percent of people (by account/device) who keep the old deck order, to measure the engine's lift. */
  engagementHoldoutPct: 10,
  /** Data brain Phase 4: win-back emails to people drifting away. 0 = off (default), 1 = on. */
  winbackEmails: 0,
  /** Percent of lapsing people who get no email (stable per account), to measure whether the emails bring people back. */
  winbackHoldoutPct: 20,
  /** Lapsing = away ≥ twice your usual gap between active days, at least this many days… */
  winbackMinIdleDays: 3,
  /** …and at most this many (people gone longer are left alone). */
  winbackMaxIdleDays: 30,
  /** At most one win-back per person in this many days. */
  winbackCooldownDays: 14,
  /** Most win-back emails sent in one daily run. */
  winbackDailyMax: 200,
  /** Brain "Clean" view counts real activity from this New York day on (YYYYMMDD). The "All data" view ignores it. */
  brainCleanFrom: 20261123,
  /** Admin "Sign-ups by source": engaged = voted on this many different days (or posted a battle)… */
  engagedMinVoteDays: 3,
  /** …within this many days of signing up. */
  engagedWindowDays: 14,
} as const;
export type Economy = { -readonly [K in keyof typeof ECONOMY_DEFAULTS]: number };

export const FEATURE_DEFAULTS = {
  /** Hold every photo for admin review when no automated screener is configured. */
  requireImageModeration: false,
  /** Open flags that hide a battle pending review (0 = off): child safety, nudity/child safety, any reason. */
  childSafetyAutoHideReports: 2,
  severeAutoHideReports: 2,
  autoHideReports: 3,
};

export const POLICY_VERSION = "2026-11-draft";

/** Battle questions can tell a short story (Alex, Nov 22 2026). The deck shrinks long ones to fit. */
export const TITLE_MAX = 160;
