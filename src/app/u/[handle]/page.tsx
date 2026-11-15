import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { Settings } from "lucide-react";
import { db } from "@/server/db";
import { users, battles, votes, outcomes, follows, reputations } from "@/server/db/schema";
import { getCurrentUser } from "@/server/viewer";
import { battleCards, friendIds, visibleStatuses } from "@/server/services/battles";
import { BattleCardRow } from "@/components/battle/BattleCardRow";
import { FollowButton } from "@/components/layout/FollowButton";
import { ReportButton } from "@/components/battle/ReportButton";
import { categoryById } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle}` };
}

async function tasteMatch(a: string, b: string) {
  const [r] = await db.execute<{ shared: number; agree: number }>(sql`
    SELECT count(*)::int AS shared, count(*) FILTER (WHERE v1.side = v2.side)::int AS agree
    FROM vote v1 JOIN vote v2 ON v1.battle_id = v2.battle_id
    JOIN battle bt ON bt.id = v1.battle_id
    WHERE v1.user_id = ${a} AND v2.user_id = ${b} AND (bt.votes_a + bt.votes_b) >= 5`);
  return r && r.shared >= 5 ? Math.round((100 * r.agree) / r.shared) : null;
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [u] = await db.select().from(users).where(eq(users.handle, handle.toLowerCase()));
  if (!u || u.bannedAt) notFound();
  const me = await getCurrentUser();
  const isMe = me?.id === u.id;
  const friends = me ? await friendIds(me.id) : new Set<string>();
  const visibleTo = isMe ? sql`true` : friends.has(u.id) ? inArray(battles.visibility, ["PUBLIC", "FRIENDS"]) : eq(battles.visibility, "PUBLIC");

  const [list, [stats], [{ votesCast }], [{ followers }], [{ following }], reps, [iFollow], match] = await Promise.all([
    battleCards(and(eq(battles.authorId, u.id), visibleStatuses, visibleTo), 30),
    db
      .select({
        total: sql<number>`count(*)::int`,
        past: sql<number>`count(*) FILTER (WHERE ${battles.status} = 'CLOSED')::int`,
        closed: sql<number>`count(${outcomes.id})::int`,
      })
      .from(battles)
      .leftJoin(outcomes, eq(outcomes.battleId, battles.id))
      .where(and(eq(battles.authorId, u.id), visibleStatuses)),
    db.select({ votesCast: sql<number>`count(*)::int` }).from(votes).where(eq(votes.userId, u.id)),
    db.select({ followers: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, u.id)),
    db.select({ following: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, u.id)),
    db.select().from(reputations).where(eq(reputations.userId, u.id)).orderBy(desc(reputations.score)),
    me && !isMe ? db.select().from(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, u.id))) : Promise.resolve([]),
    me && !isMe ? tasteMatch(me.id, u.id) : Promise.resolve(null),
  ]);
  const loopRate = stats.past ? Math.round((100 * stats.closed) / stats.past) : null;
  const badges: string[] = [];
  for (const r of reps) if (r.resolved >= 20 && r.score >= 0.7) badges.push(`Top ${categoryById(r.categoryId).name.toLowerCase()} picker`);
  if (stats.past >= 5 && loopRate !== null && loopRate >= 90) badges.push("Loop closer");

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-a to-b font-display text-2xl font-extrabold text-white">
          {(u.name || u.handle || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold">{u.name || `@${u.handle}`}</h1>
          <p className="text-sm text-zinc-500">@{u.handle}</p>
          {u.bio && <p className="mt-1 text-[15px]">{u.bio}</p>}
          <div className="mt-2 flex gap-4 text-sm">
            <span><b>{followers}</b> followers</span>
            <span><b>{following}</b> following</span>
          </div>
        </div>
        {isMe ? (
          <Link href="/settings" className="btn-outline !px-3" aria-label="Settings">
            <Settings className="size-4" />
          </Link>
        ) : me ? (
          <FollowButton userId={u.id} initial={!!iFollow} />
        ) : null}
      </header>

      {match !== null && (
        <div className="rounded-2xl bg-gradient-to-r from-a/10 to-b/10 p-4 text-center">
          <div className="font-display text-3xl font-extrabold">{match}%</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">taste match with you{match >= 75 ? " — you two always agree!" : ""}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat n={stats.total} label="battles" />
        <Stat n={votesCast} label="votes" />
        <Stat n={loopRate === null ? "—" : `${loopRate}%`} label="loops closed" />
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b} className="rounded-full bg-pp-soft px-3 py-1 text-sm font-semibold text-amber-800">🏅 {b}</span>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-extrabold">Battles</h2>
        {list.length === 0 ? <p className="text-sm text-zinc-500">No public battles yet.</p> : list.map((b) => <BattleCardRow key={b.id} b={b} showAuthor={false} src="profile" />)}
      </section>
      {!isMe && me && (
        <div className="flex justify-end">
          <ReportButton targetType="USER" targetId={u.id} />
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card p-3">
      <div className="font-display text-2xl font-extrabold">{n}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
