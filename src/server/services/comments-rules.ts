/**
 * Pure math for /admin/comments (Alex, Nov 26 2026): who writes reasons ("Top reasons" on the battle page) and on
 * what. One row per vote; the page compares the share of votes that came with a reason across groups.
 */

/** Who cast the vote. Real people (account with an email, or a guest browser) are kept apart from seed and admin activity. */
export type Commenter = "account" | "guest" | "seed" | "admin";
export const COMMENTER_LABELS: Record<Commenter, string> = {
  account: "Signed-in person",
  guest: "Guest (no account)",
  seed: "Seed / fake account",
  admin: "Admin / tester",
};
export const isReal = (c: Commenter) => c === "account" || c === "guest";

/** The three canned chips the battle page offered until Nov 24 (PR 100); anything else was typed. */
export const OLD_REASON_CHIPS = ["Looks better", "More practical", "Just feels right"];
export const isChipReason = (r: string) => OLD_REASON_CHIPS.includes(r.trim());

export type VoteFact = {
  who: string;
  kind: Commenter;
  sex: string | null;
  age: string | null;
  /** All votes this person has cast (account, or browser plus the account it was linked to). */
  personVotes: number;
  reason: string | null;
  photo: boolean;
  seedBattle: boolean;
  theme: string | null;
};

export function voteBucket(n: number): string {
  if (n <= 4) return "1–4 votes";
  if (n <= 14) return "5–14 votes";
  if (n <= 29) return "15–29 votes";
  if (n <= 99) return "30–99 votes";
  return "100+ votes";
}
const BUCKET_ORDER = ["1–4 votes", "5–14 votes", "15–29 votes", "30–99 votes", "100+ votes"];

export const hasReason = (v: { reason: string | null }) => !!v.reason && v.reason.trim().length > 0;

export type RateRow = {
  group: string;
  votes: number;
  withReason: number;
  /** Share of votes with a reason, 0–1. */
  rate: number;
  people: number;
  commenters: number;
  /** Share of people in the group who wrote at least one reason, 0–1. */
  peopleRate: number;
};

function rateBy(rows: VoteFact[], key: (v: VoteFact) => string, order?: string[]): RateRow[] {
  const g = new Map<string, { votes: number; withReason: number; people: Set<string>; commenters: Set<string> }>();
  for (const v of rows) {
    const k = key(v);
    const e = g.get(k) ?? { votes: 0, withReason: 0, people: new Set(), commenters: new Set() };
    e.votes++;
    e.people.add(v.who);
    if (hasReason(v)) {
      e.withReason++;
      e.commenters.add(v.who);
    }
    g.set(k, e);
  }
  const out = [...g.entries()].map(([group, e]) => ({
    group,
    votes: e.votes,
    withReason: e.withReason,
    rate: e.votes ? e.withReason / e.votes : 0,
    people: e.people.size,
    commenters: e.commenters.size,
    peopleRate: e.people.size ? e.commenters.size / e.people.size : 0,
  }));
  if (order) return out.sort((a, b) => idx(order, a.group) - idx(order, b.group));
  return out.sort((a, b) => b.votes - a.votes);
}
const idx = (order: string[], k: string) => (order.includes(k) ? order.indexOf(k) : order.length);

const SEX: Record<string, string> = { MALE: "Male", FEMALE: "Female", UNDISCLOSED: "Prefer not to say" };
const AGE: Record<string, string> = {
  AGE_18_24: "18–24",
  AGE_25_34: "25–34",
  AGE_35_44: "35–44",
  AGE_45_54: "45–54",
  AGE_55_64: "55–64",
  AGE_65_PLUS: "65+",
};

/** Every "who comments / on what" table for one set of votes. */
export function commentPatterns(rows: VoteFact[]) {
  const all = rows.length;
  const withReason = rows.filter(hasReason);
  const typed = withReason.filter((v) => !isChipReason(v.reason!));
  return {
    totals: {
      votes: all,
      withReason: withReason.length,
      typed: typed.length,
      chips: withReason.length - typed.length,
      people: new Set(rows.map((v) => v.who)).size,
      commenters: new Set(withReason.map((v) => v.who)).size,
    },
    byKind: rateBy(rows, (v) => COMMENTER_LABELS[v.kind], Object.values(COMMENTER_LABELS)),
    bySex: rateBy(rows, (v) => (v.sex ? SEX[v.sex] ?? v.sex : "Unknown"), ["Female", "Male", "Prefer not to say", "Unknown"]),
    byAge: rateBy(rows, (v) => (v.age ? AGE[v.age] ?? v.age : "Unknown"), [...Object.values(AGE), "Unknown"]),
    byVotes: rateBy(rows, (v) => voteBucket(v.personVotes), BUCKET_ORDER),
    byFormat: rateBy(rows, (v) => (v.photo ? "Photo battle" : "Text battle")),
    byPoster: rateBy(rows, (v) => (v.seedBattle ? "Seed battle" : "Posted by a real user")),
    byTheme: rateBy(rows, (v) => v.theme ?? "No AI tag"),
  };
}
