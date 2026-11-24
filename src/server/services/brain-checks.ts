/**
 * Self-checks for the Brain page (Alex, Nov 24 2026: "do the numbers add up?"). Pure: takes the numbers the page
 * already shows and returns every rule that doesn't hold, so a mismatch shows up on the page instead of going unseen.
 * Tested in tests/unit/brain-checks.test.ts.
 */
export type BrainNumbers = {
  visits: number;
  visitors: number;
  votes: number;
  voters: number;
  signups: number;
  battles: number;
  daily: { visits: number; visitors: number; votes: number; voters: number; signups: number; posts: number }[];
  visitSources: { visits: number; visitors: number }[];
  byKind: { seen: number; voted: number }[];
  /** Every counted vote by place × text/photo ("Where votes were made"). */
  votePlaces?: { place: string; n: number }[];
  rawSources: { sessions: number; visitors: number; voters: number }[];
  /** Sign-ups by source total, only when it covers the same window as the tiles. */
  signupSourcesTotal?: number;
};

export type CheckResult = { rule: string; ok: boolean; detail: string };

export function brainChecks(n: BrainNumbers): CheckResult[] {
  const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
  const out: CheckResult[] = [];
  const eq = (rule: string, a: number, b: number) => out.push({ rule, ok: a === b, detail: `${a} vs ${b}` });
  const le = (rule: string, a: number, b: number) => out.push({ rule, ok: a <= b, detail: `${a} ≤ ${b}` });

  eq("Day-by-day visits add up to the Visits tile", sum(n.daily, (d) => d.visits), n.visits);
  eq("Day-by-day votes add up to the Votes tile", sum(n.daily, (d) => d.votes), n.votes);
  eq("Day-by-day sign-ups add up to the Sign-ups tile", sum(n.daily, (d) => d.signups), n.signups);
  eq("Day-by-day battles add up to the Battles tile", sum(n.daily, (d) => d.posts), n.battles);
  // People can show up on several days, so the daily people columns add up to at least the tile.
  le("Visitors tile ≤ sum of daily visitors", n.visitors, sum(n.daily, (d) => d.visitors));
  le("People who voted tile ≤ sum of daily voters", n.voters, sum(n.daily, (d) => d.voters));
  eq("Visits by source add up to the Visits tile", sum(n.visitSources, (r) => r.visits), n.visits);
  le("Visitors tile ≤ visitors by source (one person can come from 2 sources)", n.visitors, sum(n.visitSources, (r) => r.visitors));
  le("People who voted ≤ Votes", n.voters, n.votes);
  le("Text vs photo: Voted ≤ Votes tile", sum(n.byKind, (k) => k.voted), n.votes);
  for (const k of n.byKind) le("Text vs photo: Voted ≤ Cards seen", k.voted, k.seen);
  if (n.votePlaces) {
    eq("Where votes were made / Text vs photo All votes add up to the Votes tile", sum(n.votePlaces, (r) => r.n), n.votes);
    // Deck votes with a logged view can't exceed all deck votes.
    le("Text vs photo: Seen → voted ≤ votes made in the deck", sum(n.byKind, (k) => k.voted), sum(n.votePlaces.filter((r) => r.place === "Vote deck"), (r) => r.n));
  }
  le("Raw source tags: visits ≤ Visits tile", sum(n.rawSources, (r) => r.sessions), n.visits);
  for (const r of n.rawSources) le("Raw source tags: people who voted ≤ visitors", r.voters, r.visitors);
  if (n.signupSourcesTotal !== undefined) eq("Sign-ups by source total = Sign-ups tile", n.signupSourcesTotal, n.signups);
  return out;
}
