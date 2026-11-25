/**
 * Taste profile for You (About-you plan §4, Nov 25 2026). Scores six axes from the person's own picks on
 * AI-tagged battles (pure math in lib/taste-profile.ts), compares them with the average voter, and adds two plain
 * stats: picks against the crowd and agreement with people like them (same sex × age range). Unlocks gradually:
 * 2 axes at `tasteFirstAt` votes, all 6 at `tasteFullAt`. Guests get a preview from their browser's votes.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { User } from "../db/schema";
import { getEconomy } from "./config";
import { scoreAxes, typeName, visibleAxes, axisWhy, TASTE_AXES, type AxisScore, type TastePick } from "@/lib/taste-profile";
import { likeYouLabel } from "@/lib/like-you";

type Viewer = { user: User | null; deviceId: string | null };
type PickRow = { battle_id: string; slug: string; title: string; side: "A" | "B"; ta: string[] | null; tb: string[] | null; votes_a: number; votes_b: number };

const owner = (v: Viewer) =>
  v.user
    ? sql`v.user_id = ${v.user.id}`
    : sql`(v.device_id = ${v.deviceId} OR v.user_id = (SELECT d.user_id FROM device d WHERE d.id = ${v.deviceId}))`;

let crowdCache: { at: number; axes: AxisScore[] } | null = null;

/** The average voter's lean on each axis (all real picks on tagged battles, last 180 days), cached for an hour. */
async function crowdAxes(): Promise<AxisScore[]> {
  if (crowdCache && Date.now() - crowdCache.at < 3600_000) return crowdCache.axes;
  const since = new Date(Date.now() - 180 * 86400_000).toISOString();
  const rows = await db.execute<{ side: "A" | "B"; ta: string[] | null; tb: string[] | null }>(sql`
    SELECT v.side, ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->'a')) AS ta,
      ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->'b')) AS tb
    FROM vote v JOIN battle b ON b.id = v.battle_id
    WHERE v.created_at > ${since} AND NOT v.flagged AND COALESCE(v.source, '') <> 'seed' AND b.tags ? 'brain'
    LIMIT 50000`);
  const axes = scoreAxes([...rows].map((r) => toPick(r.side, r.ta, r.tb)));
  crowdCache = { at: Date.now(), axes };
  return axes;
}

const toPick = (side: "A" | "B", ta: string[] | null, tb: string[] | null): TastePick =>
  side === "A" ? { chosen: ta ?? [], other: tb ?? [] } : { chosen: tb ?? [], other: ta ?? [] };

export async function voteTotal(v: Viewer): Promise<number> {
  if (!v.user && !v.deviceId) return 0;
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM vote v WHERE ${owner(v)} AND NOT v.flagged`);
  return Number(r?.n ?? 0);
}

export async function tasteProfileFor(v: Viewer, opts: { examples?: boolean } = {}) {
  const e = await getEconomy();
  if (!v.user && !v.deviceId) return null;
  const [votes, rows, crowd] = await Promise.all([
    voteTotal(v),
    db.execute<PickRow>(sql`
      SELECT v.battle_id, b.slug, b.title, v.side, b.votes_a, b.votes_b,
        ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->'a')) AS ta,
        ARRAY(SELECT jsonb_array_elements_text(b.tags->'brain'->'b')) AS tb
      FROM vote v JOIN battle b ON b.id = v.battle_id
      WHERE ${owner(v)} AND NOT v.flagged AND b.tags ? 'brain'
      ORDER BY v.created_at DESC LIMIT 2000`),
    crowdAxes(),
  ]);
  const picks = [...rows];
  const axes = scoreAxes(picks.map((r) => toPick(r.side, r.ta, r.tb)));
  const shown = visibleAxes(axes, votes, e.tasteFirstAt, e.tasteFullAt);
  // Against the crowd: picks on the side that is currently the minority (battles with 10+ votes).
  const settled = picks.filter((p) => p.votes_a + p.votes_b >= 10);
  const against = settled.filter((p) => (p.side === "A" ? p.votes_a < p.votes_b : p.votes_b < p.votes_a)).length;

  // Agreement with people like you (accounts with the same sex × age range), on battles with 3+ of them voting.
  let likeYou: { label: string; agree: number; battles: number } | null = null;
  const label = likeYouLabel(v.user?.sex, v.user?.ageRange);
  if (v.user && label && v.user.ageRange) {
    const g = await db.execute<{ mine: "A" | "B"; ga: number; gb: number }>(sql`
      SELECT v.side AS mine, count(*) FILTER (WHERE g.side = 'A')::int AS ga, count(*) FILTER (WHERE g.side = 'B')::int AS gb
      FROM vote v
      JOIN vote g ON g.battle_id = v.battle_id AND g.id <> v.id AND NOT g.flagged
      JOIN "user" gu ON gu.id = g.user_id AND gu.sex = ${v.user.sex} AND gu.age_range = ${v.user.ageRange}
      WHERE v.user_id = ${v.user.id} AND NOT v.flagged
      GROUP BY v.battle_id, v.side HAVING count(*) >= 3`);
    const decided = [...g].filter((r) => r.ga !== r.gb);
    if (decided.length >= 5) {
      const agree = decided.filter((r) => (r.ga > r.gb ? "A" : "B") === r.mine).length;
      likeYou = { label, agree: Math.round((100 * agree) / decided.length), battles: decided.length };
    }
  }

  const crowdById = new Map(crowd.map((c) => [c.id, c.score]));
  const examples = opts.examples
    ? Object.fromEntries(
        TASTE_AXES.map((ax) => [
          ax.id,
          picks
            .filter((p) => {
              const pk = toPick(p.side, p.ta, p.tb);
              return [...pk.chosen, ...pk.other].some((t) => (ax.pos as readonly string[]).includes(t) || (ax.neg as readonly string[]).includes(t));
            })
            .slice(0, 4)
            .map((p) => {
              const pk = toPick(p.side, p.ta, p.tb);
              const left = pk.chosen.some((t) => (ax.pos as readonly string[]).includes(t)) || pk.other.some((t) => (ax.neg as readonly string[]).includes(t));
              return { slug: p.slug, title: p.title, pole: left ? ax.left : ax.right };
            }),
        ]),
      )
    : {};

  return {
    votes,
    tagged: picks.length,
    firstAt: e.tasteFirstAt,
    fullAt: e.tasteFullAt,
    name: shown.length >= 6 ? typeName(axes) : null,
    axes: shown.map((a) => ({ ...a, crowd: crowdById.get(a.id) ?? 0, why: axisWhy(a), examples: (examples as Record<string, unknown[]>)[a.id] ?? [] })),
    against,
    settled: settled.length,
    likeYou,
  };
}

export type TasteProfile = NonNullable<Awaited<ReturnType<typeof tasteProfileFor>>>;
