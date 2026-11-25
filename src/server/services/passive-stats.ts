import { sql } from "drizzle-orm";
import { db } from "../db";
import { brainScope, WHO_E, WHO_V, type BrainView } from "./brain";
import { groupPeople, incomeBand, type Tier } from "./passive-rules";
export type { GroupRow } from "./passive-rules";

/**
 * Passive demographics for /admin/brain: visitors (people, same scope as the Brain tiles) by IP state, platform,
 * phone tier, in-app browser and estimated income band. Each person's facts come from the browser of their latest
 * visit in the window; ZIP = the account's typed ZIP, else the IP guess.
 */
export async function passiveStats(view: BrainView, days: number) {
  const scope = await brainScope(view, days);
  const { since, ev, vt } = scope;
  const rows = await db.execute<{
    who: string;
    country: string | null;
    region: string | null;
    platform: string | null;
    tier: string | null;
    in_app: string | null;
    median: number | null;
    voted: boolean;
    signed: boolean;
  }>(sql`
    WITH s AS (
      SELECT ${WHO_E} AS who, e.device_id, e.created_at
      FROM analytics_event e LEFT JOIN device d ON d.id = e.device_id
      WHERE e.name = 'session_start' AND e.created_at > ${since} AND ${ev}
    ),
    p AS (SELECT DISTINCT ON (who) who, device_id FROM s WHERE who IS NOT NULL ORDER BY who, created_at DESC),
    vv AS (
      SELECT DISTINCT ${WHO_V} AS who FROM vote v LEFT JOIN device dv ON dv.id = v.device_id
      WHERE v.created_at > ${since} AND NOT v.flagged AND ${vt}
    )
    SELECT p.who, d.ip_country AS country, d.ip_region AS region, d.platform, d.tier, d.in_app,
      zi.median_income AS median,
      p.who IN (SELECT who FROM vv) AS voted,
      (u.onboarded_at IS NOT NULL AND u.email IS NOT NULL) AS signed
    FROM p
    LEFT JOIN device d ON d.id = p.device_id
    LEFT JOIN "user" u ON u.id = p.who
    LEFT JOIN zip_income zi ON zi.zip = left(COALESCE(u.zip_code, d.ip_zip), 5)`);
  const people = [...rows];
  const voted = (p: (typeof people)[number]) => p.voted;
  const signed = (p: (typeof people)[number]) => p.signed;
  const [zipRows] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM zip_income`);
  return {
    total: people.length,
    zipIncomeRows: Number(zipRows?.n ?? 0),
    region: groupPeople(
      people,
      (p) => (p.country === "US" ? (p.region ?? "US, unknown state") : p.country ? `Outside US (${p.country})` : "Unknown"),
      voted,
      signed,
    ),
    platform: groupPeople(people, (p) => p.platform ?? "unknown", voted, signed),
    tier: groupPeople(people, (p) => p.tier ?? "unknown", voted, signed),
    inApp: groupPeople(people, (p) => p.in_app ?? "none (regular browser)", voted, signed),
    income: groupPeople(people, (p) => incomeBand(p.median, p.tier as Tier) ?? "unknown", voted, signed),
  };
}
