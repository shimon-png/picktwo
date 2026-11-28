import { hashUnit } from "./ranking";
import { meansP, twoProportionP } from "./gate-test-rules";

/**
 * Topics in the Vote deck A/B test, pure rules (Alex, Nov 27 2026; tested in tests/unit/topics-test.test.ts).
 * control = today's deck (everything mixed). topics = the chip row, the "stay on Mix or get more specific?" card,
 * the streak card, topic sign-up nudges and homepage topic tiles (lib/topics.ts).
 * Hypothesis: choosing a topic holds interest longer (votes per visitor) and gets more people to sign up; return
 * visits are measured too.
 */
export type TopicsArm = "control" | "topics";
export const TOPICS_EXPERIMENT = "deck_topics_v1";
export const TOPICS_ARM_LABELS: Record<TopicsArm, string> = { control: "Old deck (all mixed)", topics: "Topics" };

/** Random but stable: the same browser always lands in the same group. pct = share put in "topics". */
export function pickTopicsArm(unitId: string, pct: number): TopicsArm {
  if (pct <= 0) return "control";
  if (pct >= 100) return "topics";
  return hashUnit(`topics:${unitId}`) < pct / 100 ? "topics" : "control";
}

export type TopicsVisitor = {
  day: string;
  arm: TopicsArm;
  votes: number;
  sessions: number;
  /** New York days with any activity in the 7 days from the first visit. */
  activeDays: number;
  signedUp: boolean;
  /** Picked a topic other than Mix at least once (topics group only). */
  choseTopic: boolean;
};

export type TopicsCell = {
  visitors: number;
  voters: number;
  votes: number;
  avgVotes: number;
  votesPerSession: number;
  voteRate: number;
  signups: number;
  signupRate: number;
  returned: number;
  returnRate: number;
  choseTopic: number;
};

export function topicsCell(list: TopicsVisitor[]): TopicsCell {
  const visitors = list.length;
  const votes = list.reduce((t, v) => t + v.votes, 0);
  const sessions = list.reduce((t, v) => t + Math.max(1, v.sessions), 0);
  const voters = list.filter((v) => v.votes > 0).length;
  const signups = list.filter((v) => v.signedUp).length;
  const returned = list.filter((v) => v.activeDays >= 2).length;
  return {
    visitors,
    voters,
    votes,
    avgVotes: visitors ? votes / visitors : 0,
    votesPerSession: sessions ? votes / sessions : 0,
    voteRate: visitors ? voters / visitors : 0,
    signups,
    signupRate: visitors ? signups / visitors : 0,
    returned,
    returnRate: visitors ? returned / visitors : 0,
    choseTopic: list.filter((v) => v.choseTopic).length,
  };
}

const lift = (x: number, y: number) => (x ? (y - x) / x : null);

/** Day-by-day and overall numbers per group, the topics group's lift over control, and p-values. */
export function summarizeTopicsTest(visitors: TopicsVisitor[]) {
  const days = [...new Set(visitors.map((v) => v.day))].sort().reverse();
  const by = (arm: TopicsArm, day?: string) => visitors.filter((v) => v.arm === arm && (!day || v.day === day));
  const daily = days.map((day) => ({ day, control: topicsCell(by("control", day)), topics: topicsCell(by("topics", day)) }));
  const a = by("control");
  const b = by("topics");
  const total = { control: topicsCell(a), topics: topicsCell(b) };
  return {
    daily,
    total,
    votesP: meansP(a.map((v) => v.votes), b.map((v) => v.votes)),
    signupP: twoProportionP(total.control.signups, total.control.visitors, total.topics.signups, total.topics.visitors),
    voteRateP: twoProportionP(total.control.voters, total.control.visitors, total.topics.voters, total.topics.visitors),
    returnP: twoProportionP(total.control.returned, total.control.visitors, total.topics.returned, total.topics.visitors),
    votesLift: lift(total.control.avgVotes, total.topics.avgVotes),
    signupLift: lift(total.control.signupRate, total.topics.signupRate),
    voteRateLift: lift(total.control.voteRate, total.topics.voteRate),
    returnLift: lift(total.control.returnRate, total.topics.returnRate),
  };
}
