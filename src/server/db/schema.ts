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

export type KidAge = "AGE_0_2" | "AGE_3_4" | "AGE_5_8" | "AGE_9_12" | "AGE_13_17";
export type BattleTags = { kidAge?: KidAge[]; recipient?: string; budget?: string; occasion?: string };

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
  country: text("country"),
  region: text("region"),
  zipCode: text("zip_code"),
  sex: text("sex"),
  ageRange: text("age_range"),
  kidAges: text("kid_ages").array().$type<KidAge[]>().notNull().default([]),
  interests: text("interests").array().notNull().default([]),
  ppBalance: integer("pp_balance").notNull().default(10),
  lastActiveAt: now("last_active_at"),
  dataConsent: boolean("data_consent").notNull().default(false),
  marketingEmail: boolean("marketing_email").notNull().default(false),
  notifyEmail: boolean("notify_email").notNull().default(true),
  bannedAt: ts("banned_at"),
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
});

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
    flagged: boolean("flagged").notNull().default(false),
    changedAt: ts("changed_at"),
    createdAt: now("created_at"),
  },
  (t) => [
    uniqueIndex("vote_battle_user").on(t.battleId, t.userId),
    uniqueIndex("vote_battle_device").on(t.battleId, t.deviceId),
    index("vote_user_created").on(t.userId, t.createdAt),
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
  (t) => [index("analytics_name_created").on(t.name, t.createdAt)],
);

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: now("updated_at"),
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
