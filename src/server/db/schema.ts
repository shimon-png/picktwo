import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@/lib/id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const now = (name: string) => timestamp(name, { mode: "date", withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { mode: "date", withTimezone: true });

export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);
export const visibilityEnum = pgEnum("visibility", ["PUBLIC", "LINK_ONLY", "FRIENDS"]);
export const battleStatusEnum = pgEnum("battle_status", ["OPEN", "CLOSED", "DELETED", "HIDDEN"]);
export const sideEnum = pgEnum("side", ["A", "B"]);
export const chosenEnum = pgEnum("chosen", ["A", "B", "NEITHER"]);
export const thumbEnum = pgEnum("thumb", ["UP", "DOWN"]);
export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "STARTER",
  "FIRST_BATTLE",
  "VOTE",
  "VOTE_REASON",
  "REASON_HELPFUL",
  "LOOP_CLOSED",
  "LOOP_CLOSED_FAST",
  "OUTCOME_NOTE",
  "CALLED_IT",
  "INVITE",
  "BOOST",
  "DECAY",
  "ADMIN_ADJUST",
]);
export const reportTargetEnum = pgEnum("report_target", ["BATTLE", "REASON", "USER"]);
export const reportStatusEnum = pgEnum("report_status", ["OPEN", "ACTIONED", "DISMISSED"]);

import type { BattleTarget } from "../services/targeting";
export type KidAge = "AGE_0_2" | "AGE_3_4" | "AGE_5_8" | "AGE_9_12" | "AGE_13_17";
import type { BrainTags } from "@/lib/brain-tags";
export type BattleTags = {
  kidAge?: KidAge[];
  recipient?: string;
  budget?: string;
  occasion?: string;
  target?: BattleTarget;
  brain?: BrainTags;
  /** Pinned first: the homepage hero and the top of everyone's Vote deck while it's open (set by a migration). */
  featured?: boolean;
  /** Backs a "People like you are asking" preset (lib/asking.ts, migration 0043); kept out of the Vote feed. */
  askingPreset?: string;
  /** Posted from a Pickbot thread ("Asked via Pickbot"). The asker is only in pickbot_thread, never shown. */
  pickbot?: boolean;
  /** Written by auto-seeding (services/auto-seed.ts): batch, poster voice, topic, planned split, photo credits. Never sent to the browser. */
  seed?: { auto: string; voice: "F" | "M" | "N"; topic: string; kind: "text" | "photo"; pctA: number; photos?: { id: number | string; by: string; page: string }[] };
};

// ---------- Users & auth (Auth.js drizzle adapter compatible) ----------
export const users = pgTable("user", {
  id: id(),
  email: text("email").unique(),
  emailVerified: ts("emailVerified"),
  name: text("name"),
  image: text("image"),
  handle: text("handle").unique(),
  bio: text("bio"),
  role: roleEnum("role").notNull().default("USER"),
  isAdultConfirmed: boolean("is_adult_confirmed").notNull().default(false),
  onboardedAt: ts("onboarded_at"),
  /** ISO 3166-1 alpha-2 code, e.g. "US" (older rows may hold free text). */
  country: text("country"),
  /** State / province / region name (from country-state-city). */
  region: text("region"),
  city: text("city"),
  zipCode: text("zip_code"),
  sex: text("sex"),
  ageRange: text("age_range"),
  /** Answer to "Do you have kids?": YES / NO / UNDISCLOSED (null = not answered). */
  kidsStatus: text("kids_status"),
  kidAges: text("kid_ages").array().$type<KidAge[]>().notNull().default([]),
  /** About-you cards (lib/about.ts): SINGLE / MARRIED / DATING (TAKEN folded into DATING, migration 0044); RENT / OWN / FAMILY; STUDENT / WORKING / BOTH / NEITHER. */
  relationship: text("relationship"),
  housing: text("housing"),
  workStatus: text("work_status"),
  /** Pickbot Plus (PRD §12, payments not built yet): Plus until this time. Unused until Stripe is added. */
  plusUntil: ts("plus_until"),
  stripeCustomerId: text("stripe_customer_id"),
  interests: text("interests").array().notNull().default([]),
  ppBalance: integer("pp_balance").notNull().default(10),
  /** Lifetime correct picks (votes that matched the poster's reported choice); drives Pro / Expert / Super expert. */
  correctPicks: integer("correct_picks").notNull().default(0),
  lastActiveAt: now("last_active_at"),
  dataConsent: boolean("data_consent").notNull().default(false),
  marketingEmail: boolean("marketing_email").notNull().default(false),
  notifyEmail: boolean("notify_email").notNull().default(true),
  bannedAt: ts("banned_at"),
  /** Direct messages on/off (Settings). Off by default: you can't send DMs or accept message requests until you turn it on. */
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  /** Email groups switched OFF in Settings, e.g. { weekly: false }. Missing = on. "My battles" uses notifyEmail. */
  emailPrefs: jsonb("email_prefs").$type<Partial<Record<"voted" | "weekly" | "tips" | "messages", boolean>>>().notNull().default({}),
  /** Listed in "Voted like you" (to same-side voters) and the taste-twin ranking. Opt-out in Settings. */
  showInVoteMatches: boolean("show_in_vote_matches").notNull().default(true),
  /** When the account first finished (or closed) the Vote tutorial; set = never auto-show it again (replay from Settings / You). */
  tourSeenAt: ts("tour_seen_at"),
  referredById: text("referred_by_id"),
  createdAt: now("created_at"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const devices = pgTable("device", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: now("created_at"),
  // Passive signals (services/passive.ts), from the browser's first real visit; never shown to anyone.
  /** Vercel IP geolocation: country (ISO-2), state/region code, city, ZIP. Metro-level guesses; never overwrite a typed ZIP. */
  ipCountry: text("ip_country"),
  ipRegion: text("ip_region"),
  ipCity: text("ip_city"),
  ipZip: text("ip_zip"),
  /** parseDevice(ua): ios / android / desktop / other, browser, in-app browser (x, instagram, tiktok, …). */
  platform: text("platform"),
  browser: text("browser"),
  inApp: text("in_app"),
  /** Screen "WxH@dpr", Android model from client hints, and deviceTier(): budget / mid / flagship / unknown. */
  screen: text("screen"),
  model: text("model"),
  tier: text("tier"),
  seenAt: ts("seen_at"),
},
  // "Which browsers belong to this account" is asked on nearly every admin number (one person = account + its
  // browsers) and in linkDevice; without this index each ask scanned the whole table (Nov 27).
  (t) => [index("device_user").on(t.userId)],
);

/**
 * About-you cards (services/about.ts): one row per card shown to a person (account or guest browser) and what
 * happened: shown → answered / skipped. Answers from sign-up or Settings are rows with via = signup / settings.
 * A guest's rows move to their account on sign-in (linkDevice).
 */
export const profileAnswers = pgTable(
  "profile_answer",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id"),
    question: text("question").notNull(),
    answer: text("answer"),
    status: text("status").notNull(),
    via: text("via").notNull().default("card"),
    /** The person's vote count when it was asked. */
    atVotes: integer("at_votes").notNull().default(0),
    createdAt: now("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("profile_answer_user").on(t.userId, t.question), index("profile_answer_device").on(t.deviceId, t.question)],
);

/** Census ACS 5-year by ZIP area (ZCTA): median household income (B19013) and share of renter households (B25003). */
export const zipIncome = pgTable("zip_income", {
  zip: text("zip").primaryKey(),
  medianIncome: integer("median_income"),
  renterPct: doublePrecision("renter_pct"),
  year: integer("year").notNull(),
});

/** A/B test groups (services/gate-test.ts). One row per experiment × unit (a browser's device id); never changes. */
export const experimentAssignments = pgTable(
  "experiment_assignment",
  {
    experiment: text("experiment").notNull(),
    unitId: text("unit_id").notNull(),
    arm: text("arm").notNull(),
    createdAt: now("created_at"),
  },
  (t) => [primaryKey({ columns: [t.experiment, t.unitId] }), index("experiment_assignment_created").on(t.experiment, t.createdAt)],
);

// ---------- Battles ----------
export const categories = pgTable("category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  featured: boolean("featured").notNull().default(false),
  sort: integer("sort").notNull(),
});

export const battles = pgTable(
  "battle",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    authorId: text("author_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    context: text("context"),
    categoryId: text("category_id").notNull().references(() => categories.id),
    tags: jsonb("tags").$type<BattleTags>().notNull().default({}),
    visibility: visibilityEnum("visibility").notNull().default("PUBLIC"),
    status: battleStatusEnum("status").notNull().default("OPEN"),
    deadline: ts("deadline").notNull(),
    closedAt: ts("closed_at"),
    boostUntil: ts("boost_until"),
    boostVotesLeft: integer("boost_votes_left").notNull().default(0),
    dataConsent: boolean("data_consent").notNull().default(false),
    votesA: integer("votes_a").notNull().default(0),
    votesB: integer("votes_b").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    reminderCount: integer("reminder_count").notNull().default(0),
    /** Shimon's engagement score (services/engagement.ts): weighted share of real voters who came back 1–3 days later. */
    engagementScore: doublePrecision("engagement_score").notNull().default(0),
    /** Real voters who have had at least a day to come back. */
    engagementVoters: integer("engagement_voters").notNull().default(0),
    /** Weighted returns (day 1 = 1, day 2 = 0.6, day 3 = 0.3). */
    engagementReturns: doublePrecision("engagement_returns").notNull().default(0),
    engagementAt: ts("engagement_at"),
    lastReminderAt: ts("last_reminder_at"),
    createdAt: now("created_at"),
    updatedAt: now("updated_at"),
  },
  (t) => [
    index("battle_status_deadline").on(t.status, t.deadline),
    index("battle_author_status").on(t.authorId, t.status),
    index("battle_cat_status_created").on(t.categoryId, t.status, t.createdAt),
  ],
);

export const options = pgTable(
  "option",
  {
    id: id(),
    battleId: text("battle_id").notNull().references(() => battles.id, { onDelete: "cascade" }),
    side: sideEnum("side").notNull(),
    label: text("label").notNull(),
    /** Optional one-liner shown under the option name. */
    description: text("description"),
    imageUrl: text("image_url"),
    url: text("url"),
    urlTitle: text("url_title"),
    urlImage: text("url_image"),
    priceCents: integer("price_cents"),
    currency: text("currency"),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [uniqueIndex("option_battle_side").on(t.battleId, t.side)],
);

export const votes = pgTable(
  "vote",
  {
    id: id(),
    battleId: text("battle_id").notNull().references(() => battles.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    deviceId: text("device_id"),
    side: sideEnum("side").notNull(),
    reason: text("reason"),
    reasonHidden: boolean("reason_hidden").notNull().default(false),
    dwellMs: integer("dwell_ms"),
    source: text("source"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    /** Voter's correct picks when they voted (snapshot), so the Expert score uses their status at vote time. */
    voterCorrect: integer("voter_correct").notNull().default(0),
    /** Days after this vote (1–3, New York calendar days) that the voter first came back; null = not (yet). Engagement score input. */
    returnedAfterDays: integer("returned_after_days"),
    flagged: boolean("flagged").notNull().default(false),
    changedAt: ts("changed_at"),
    createdAt: now("created_at"),
  },
  (t) => [
    uniqueIndex("vote_battle_user").on(t.battleId, t.userId),
    uniqueIndex("vote_battle_device").on(t.battleId, t.deviceId),
    index("vote_user_created").on(t.userId, t.createdAt),
    index("vote_device_created").on(t.deviceId, t.createdAt),
  ],
);

export const reasonHelpful = pgTable(
  "reason_helpful",
  {
    voteId: text("vote_id").notNull().references(() => votes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    createdAt: now("created_at"),
  },
  (t) => [primaryKey({ columns: [t.voteId, t.userId] })],
);

export const skips = pgTable(
  "skip",
  {
    id: id(),
    battleId: text("battle_id").notNull().references(() => battles.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    deviceId: text("device_id"),
    createdAt: now("created_at"),
  },
  (t) => [
    uniqueIndex("skip_battle_user").on(t.battleId, t.userId),
    uniqueIndex("skip_battle_device").on(t.battleId, t.deviceId),
  ],
);

export const outcomes = pgTable("outcome", {
  id: id(),
  battleId: text("battle_id").notNull().unique().references(() => battles.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  chosen: chosenEnum("chosen").notNull(),
  thumb: thumbEnum("thumb"),
  note: text("note"),
  photoUrl: text("photo_url"),
  reportedAt: now("reported_at"),
  editedAt: ts("edited_at"),
});

// ---------- Priority Queue ----------
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    battleId: text("battle_id"),
    voteId: text("vote_id"),
    idemKey: text("idem_key").unique(),
    createdAt: now("created_at"),
  },
  (t) => [index("ledger_user_created").on(t.userId, t.createdAt)],
);

// ---------- Social ----------
export const follows = pgTable(
  "follow",
  {
    followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: now("created_at"),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })],
);

export const blocks = pgTable(
  "block",
  {
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: now("created_at"),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const reputations = pgTable(
  "reputation",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    correct: integer("correct").notNull().default(0),
    resolved: integer("resolved").notNull().default(0),
    score: doublePrecision("score").notNull().default(0.5),
  },
  (t) => [primaryKey({ columns: [t.userId, t.categoryId] })],
);

export const notifications = pgTable(
  "notification",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts("read_at"),
    createdAt: now("created_at"),
  },
  (t) => [index("notif_user").on(t.userId, t.readAt, t.createdAt)],
);

// ---------- Trust & safety, analytics, config ----------
export const reports = pgTable(
  "report",
  {
    id: id(),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reporterId: text("reporter_id"),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    createdAt: now("created_at"),
    resolvedBy: text("resolved_by"),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("report_status").on(t.status, t.createdAt)],
);

export const consentEvents = pgTable("consent_event", {
  id: id(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  value: boolean("value").notNull(),
  version: text("version").notNull(),
  createdAt: now("created_at"),
});

export const analyticsEvents = pgTable(
  "analytics_event",
  {
    id: id(),
    name: text("name").notNull(),
    userId: text("user_id"),
    deviceId: text("device_id"),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: now("created_at"),
  },
  (t) => [
    index("analytics_name_created").on(t.name, t.createdAt),
    index("analytics_device_created").on(t.deviceId, t.createdAt),
    index("analytics_user_created").on(t.userId, t.createdAt),
  ],
);

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: now("updated_at"),
});

// Direct messages between two users. One conversation per pair; userA < userB (string order).
export const conversations = pgTable(
  "conversation",
  {
    id: id(),
    userA: text("user_a").notNull().references(() => users.id, { onDelete: "cascade" }),
    userB: text("user_b").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** PENDING = a message request the other person hasn't accepted; ACCEPTED = normal chat; DECLINED = request turned down. */
    status: text("status").$type<"PENDING" | "ACCEPTED" | "DECLINED">().notNull().default("PENDING"),
    /** Who sent the request (started the conversation). */
    requestedBy: text("requested_by").references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: now("last_message_at"),
    createdAt: now("created_at"),
  },
  (t) => [uniqueIndex("conversation_pair").on(t.userA, t.userB), index("conversation_a").on(t.userA, t.lastMessageAt), index("conversation_b").on(t.userB, t.lastMessageAt)],
);

export const directMessages = pgTable(
  "direct_message",
  {
    id: id(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** When the recipient opened the conversation after this message arrived. */
    readAt: ts("read_at"),
    createdAt: now("created_at"),
  },
  (t) => [index("dm_conversation_created").on(t.conversationId, t.createdAt)],
);

/**
 * Pickbot (docs/plans/pickbot-prd.html): one thread per question. `classification` is the small model's read of the
 * first question (scope, theme, relevant extended fields); `state` holds the asker's choices (skip questions, general
 * vs tailored, stop quick battles). Phase 2: `battleId` is the anonymous crowd battle made from it, `pickSide` the
 * option Pickbot's pick became, `resultsAt` when the results summary went back to the asker. Private to the owner.
 */
export const pickbotThreads = pgTable(
  "pickbot_thread",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    classification: jsonb("classification").$type<import("@/lib/pickbot").Classification>().notNull(),
    state: jsonb("state").$type<import("@/lib/pickbot").ThreadState>().notNull().default({}),
    battleId: text("battle_id").references(() => battles.id, { onDelete: "set null" }),
    pickSide: sideEnum("pick_side"),
    resultsAt: ts("results_at"),
    createdAt: now("created_at"),
    updatedAt: now("updated_at"),
  },
  (t) => [index("pickbot_thread_user").on(t.userId, t.updatedAt), index("pickbot_thread_battle").on(t.battleId)],
);

/**
 * Messages in a Pickbot thread. role USER | BOT. kind: question (the asker's text + photos), note (a short line,
 * e.g. a profile answer or a bot line), answer (`answer` JSON + model, tokens, cost), draft (crowd battle draft in
 * `data`), results (crowd results summary in `data`). `rating` UP/DOWN on answers.
 */
export const pickbotMessages = pgTable(
  "pickbot_message",
  {
    id: id(),
    threadId: text("thread_id").notNull().references(() => pickbotThreads.id, { onDelete: "cascade" }),
    role: text("role").$type<"USER" | "BOT">().notNull(),
    kind: text("kind").$type<"question" | "note" | "answer" | "draft" | "results">().notNull(),
    text: text("text").notNull().default(""),
    photos: jsonb("photos").$type<string[]>().notNull().default([]),
    answer: jsonb("answer").$type<import("@/lib/pickbot").Answer & { kind: import("@/lib/pickbot").AnswerKind }>(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: doublePrecision("cost_usd"),
    latencyMs: integer("latency_ms"),
    rating: thumbEnum("rating"),
    ratingNote: text("rating_note"),
    createdAt: now("created_at"),
  },
  (t) => [index("pickbot_message_thread").on(t.threadId, t.createdAt)],
);

/** Web push (PRD phase 4): one row per browser that allowed notifications. Removed when the push service says it's gone. */
export const pushSubscriptions = pgTable(
  "push_subscription",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: now("created_at"),
  },
  (t) => [uniqueIndex("push_subscription_endpoint").on(t.endpoint), index("push_subscription_user").on(t.userId)],
);

// "People like you are worried about" questions written by AI for one person (Alex, Nov 27 2026): one row per user
// per New York day, so the deck's refetches don't call the model again. `rounds` = groups of question strings.
export const askingSuggestions = pgTable(
  "asking_suggestion",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    rounds: jsonb("rounds").$type<string[][]>().notNull(),
    model: text("model"),
    costUsd: doublePrecision("cost_usd"),
    createdAt: now("created_at"),
  },
  (t) => [uniqueIndex("asking_suggestion_user_day").on(t.userId, t.day)],
);

// Every lifecycle email we decide about: one row per (user, kind, ref), so nothing sends twice.
// status: QUEUED (waiting for sendAfter, e.g. quiet hours or a batch), SENT, SKIPPED (prefs/caps/budget), FAILED.
export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ref: text("ref").notNull().default(""),
    status: text("status").$type<"QUEUED" | "SENT" | "SKIPPED" | "FAILED">().notNull(),
    reason: text("reason"),
    /** For QUEUED rows: the data needed to build the email later. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    sendAfter: ts("send_after"),
    sentAt: ts("sent_at"),
    providerId: text("provider_id"),
    createdAt: now("created_at"),
  },
  (t) => [
    uniqueIndex("email_log_user_kind_ref").on(t.userId, t.kind, t.ref),
    index("email_log_status_after").on(t.status, t.sendAfter),
    index("email_log_user_sent").on(t.userId, t.sentAt),
  ],
);

// Contact-us form submissions, read in /admin/messages.
export const contactMessages = pgTable(
  "contact_message",
  {
    id: id(),
    name: text("name"),
    email: text("email").notNull(),
    topic: text("topic").notNull(),
    message: text("message").notNull(),
    userId: text("user_id"),
    pageUrl: text("page_url"),
    userAgent: text("user_agent"),
    status: text("status").notNull().default("NEW"), // NEW | HANDLED
    createdAt: now("created_at"),
    handledBy: text("handled_by"),
    handledAt: ts("handled_at"),
  },
  (t) => [index("contact_message_status").on(t.status, t.createdAt)],
);

/** One-time sign-in codes (email → 6-digit code). One live code per email; hashed, short-lived, attempt-limited. */
export const emailCodes = pgTable("email_code", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  /** The code sent just before this one stays valid until it expires (people often type the first email's code). */
  prevCodeHash: text("prev_code_hash"),
  prevExpiresAt: timestamp("prev_expires_at", { mode: "date", withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: now("created_at"),
});

// ---------- Relations ----------
export const battlesRelations = relations(battles, ({ one, many }) => ({
  author: one(users, { fields: [battles.authorId], references: [users.id] }),
  category: one(categories, { fields: [battles.categoryId], references: [categories.id] }),
  options: many(options),
  votes: many(votes),
  outcome: one(outcomes, { fields: [battles.id], references: [outcomes.battleId] }),
}));
export const optionsRelations = relations(options, ({ one }) => ({
  battle: one(battles, { fields: [options.battleId], references: [battles.id] }),
}));
export const votesRelations = relations(votes, ({ one }) => ({
  battle: one(battles, { fields: [votes.battleId], references: [battles.id] }),
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));
export const outcomesRelations = relations(outcomes, ({ one }) => ({
  battle: one(battles, { fields: [outcomes.battleId], references: [battles.id] }),
}));

export type User = typeof users.$inferSelect;
export type Battle = typeof battles.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
