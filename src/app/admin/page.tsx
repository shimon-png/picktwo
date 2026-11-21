import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { AdminSeed } from "@/components/admin/AdminActions";

async function metrics() {
  const [m] = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM "user" WHERE banned_at IS NULL AND email IS NOT NULL) AS users,
      (SELECT count(*)::int FROM battle WHERE created_at > now() - interval '7 days') AS battles_week,
      (SELECT count(*)::int FROM vote WHERE created_at > now() - interval '7 days') AS votes_week,
      (SELECT COALESCE(avg(votes_a + votes_b), 0)::float FROM battle WHERE status = 'CLOSED') AS votes_per_battle,
      (SELECT count(*)::int FROM battle b WHERE b.deadline < now() AND b.status <> 'DELETED') AS past_deadline,
      (SELECT count(*)::int FROM outcome) AS outcomes,
      (SELECT count(*)::int FROM report WHERE status = 'OPEN') AS open_reports,
      (SELECT COALESCE(sum(clicks), 0)::int FROM "option") AS link_clicks,
      (SELECT COALESCE(avg(pp_balance), 0)::float FROM "user" WHERE email IS NOT NULL) AS avg_pp,
      (SELECT count(*)::int FROM battle WHERE boost_until IS NOT NULL) AS boosted
  `);
  const [ttf] = await db.execute<{ median_min: number | null }>(sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY mins)::float AS median_min FROM (
      SELECT EXTRACT(EPOCH FROM (v.created_at - b.created_at)) / 60 AS mins
      FROM battle b
      JOIN LATERAL (SELECT created_at FROM vote WHERE battle_id = b.id ORDER BY created_at OFFSET 9 LIMIT 1) v ON true
      WHERE b.created_at > now() - interval '30 days'
    ) t`);
  const daily = await db.execute<{ day: string; battles: number; votes: number }>(sql`
    SELECT to_char(d, 'MM-DD') AS day,
      (SELECT count(*)::int FROM battle WHERE created_at::date = d) AS battles,
      (SELECT count(*)::int FROM vote WHERE created_at::date = d) AS votes
    FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`);
  return { m, ttf: ttf?.median_min, daily };
}

export default async function AdminHome() {
  const { m, ttf, daily } = await metrics();
  const rate = m.past_deadline ? Math.round((100 * m.outcomes) / m.past_deadline) : 0;
  const tiles: [string, string | number][] = [
    ["Users", m.users],
    ["Battles (7d)", m.battles_week],
    ["Votes (7d)", m.votes_week],
    ["Votes / closed battle", Number(m.votes_per_battle).toFixed(1)],
    ["Outcome report rate", `${rate}%`],
    ["Median time to 10 votes", ttf == null ? "—" : `${Math.round(ttf)} min`],
    ["Open reports", m.open_reports],
    ["Option link clicks", m.link_clicks],
    ["Avg ⚡ balance", Number(m.avg_pp).toFixed(0)],
    ["Battles boosted", m.boosted],
  ];
  const max = Math.max(1, ...daily.map((d) => d.votes));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-xs text-zinc-500">{k}</div>
            <div className=" text-2xl font-medium">{v}</div>
          </div>
        ))}
      </div>
      <section className="card p-4">
        <h2 className="mb-3 font-sans font-medium">Votes per day (14d)</h2>
        <div className="flex h-32 items-end gap-1">
          {daily.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.votes} votes, ${d.battles} battles`}>
              <div className="w-full rounded-t bg-a" style={{ height: `${(d.votes / max) * 100}%`, minHeight: 2 }} />
              <span className="text-[9px] text-zinc-400">{d.day.slice(3)}</span>
            </div>
          ))}
        </div>
      </section>
      <AdminSeed />
    </div>
  );
}
