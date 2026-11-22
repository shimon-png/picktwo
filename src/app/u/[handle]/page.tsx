import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { Settings } from "lucide-react";
import { db } from "@/server/db";
import { users, battles, votes, outcomes, follows, reputations } from "@/server/db/schema";
import { getCurrentUser, getDeviceId } from "@/server/viewer";
import { votedIds } from "@/server/services/discover";
import { battleCards, friendIds, visibleStatuses } from "@/server/services/battles";
import { BattleCardRow } from "@/components/battle/BattleCardRow";
import { FollowButton } from "@/components/layout/FollowButton";
import { ReportButton } from "@/components/battle/ReportButton";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { getEconomy } from "@/server/services/config";
import { TIER_LABEL, expertTier } from "@/server/services/expertise";
import { listFollowers, listFollowing } from "@/server/services/social";
import { PersonRow } from "@/components/people/PersonRow";
import { ExpandList } from "@/components/ui/ExpandList";

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

  const [list, [stats], [{ votesCast }], [{ followers }], [{ following }], reps, [iFollow], match, followerList, followingList] = await Promise.all([
    battleCards(and(eq(battles.authorId, u.id), visibleStatuses, visibleTo), 100),
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
    listFollowers(u.id, me?.id ?? null),
    listFollowing(u.id, me?.id ?? null),
  ]);
  // Friends = you follow each other. They follow you when you're in their following list.
  const followsMe = !!me && !isMe && followingList.some((p) => p.id === me.id);
  const relation = !!iFollow && followsMe ? "Friends" : followsMe ? "Follows you" : null;
  // Scores only on battles you voted on (or your own).
  const voted = isMe ? null : await votedIds({ user: me, deviceId: await getDeviceId() }, list.map((b) => b.id));
  const tier = expertTier(u.correctPicks, await getEconomy());
  const loopRate = stats.past ? Math.round((100 * stats.closed) / stats.past) : null;
  const badges: string[] = [];
  // Reputation is still stored per (legacy) category; the badge uses the overall record.
  const repResolved = reps.reduce((n, r) => n + r.resolved, 0);
  const repCorrect = reps.reduce((n, r) => n + r.correct, 0);
  if (repResolved >= 20 && repCorrect / repResolved >= 0.7) badges.push("Top picker");
  if (stats.past >= 5 && loopRate !== null && loopRate >= 90) badges.push("Loop closer");

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="size-16 shrink-0 rounded-full bg-surface object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-a to-b text-2xl font-medium text-white">
            {(u.name || u.handle || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 text-2xl font-medium">
            <span className="truncate">{u.name || `@${u.handle}`}</span>
            <ExpertBadge tier={tier} />
          </h1>
          <p className="text-sm text-zinc-500">
            @{u.handle}
            {tier !== "NONE" && ` · ${TIER_LABEL[tier]} · ${u.correctPicks} correct picks`}
          </p>
          {u.bio && <p className="mt-1 text-[15px]">{u.bio}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href="#followers" className="hover:underline"><b>{followers}</b> followers</a>
            <a href="#following" className="hover:underline"><b>{following}</b> following</a>
            {relation && <span className="rounded-full bg-a-soft px-2 py-0.5 text-xs text-a">{relation}</span>}
          </div>
          {!isMe && me && (
            <div className="mt-3">
              <FollowButton userId={u.id} initial={!!iFollow} followsMe={followsMe} />
            </div>
          )}
          {!me && (
            <Link href={`/signin?callbackUrl=/u/${u.handle}`} className="btn-primary mt-3">
              Follow
            </Link>
          )}
        </div>
        {isMe ? (
          <Link href="/settings" className="btn-outline !px-3" aria-label="Settings">
            <Settings className="size-4" />
          </Link>
        ) : null}
      </header>

      {match !== null && (
        <div className="rounded-[14px] bg-gradient-to-r from-a/10 to-b/10 p-4 text-center">
          <div className=" text-3xl font-medium">{match}%</div>
          <div className="text-sm text-zinc-600">taste match with you{match >= 75 ? " — you two always agree!" : ""}</div>
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
            <span key={b} className="rounded-full bg-pp-soft px-3 py-1 text-sm font-medium text-amber-800">🏅 {b}</span>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-2.5 text-[22px]">Battles</h2>
        <ExpandList
          searchPlaceholder="Search their battles"
          empty={<p className="text-sm text-zinc-500">{isMe ? "You haven't posted a battle yet." : "No battles you can see yet."}</p>}
          items={list.map((b) => ({ key: b.id, text: `${b.title} ${b.context ?? ""} ${b.labelA} ${b.labelB}`, node: <BattleCardRow b={b} showAuthor={false} src="profile" hideResults={!!voted && !voted.has(b.id)} voted={!!voted?.has(b.id)} /> }))}
        />
      </section>

      <PeopleSection id="followers" title="Followers" people={followerList} viewerId={me?.id ?? null} empty="No followers yet." />
      <PeopleSection id="following" title="Following" people={followingList} viewerId={me?.id ?? null} empty="Not following anyone yet." />
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
      <div className=" text-2xl font-medium">{n}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function PeopleSection({ id, title, people, viewerId, empty }: { id: string; title: string; people: Awaited<ReturnType<typeof listFollowers>>; viewerId: string | null; empty: string }) {
  return (
    <section id={id} className="scroll-mt-16">
      <h2 className="mb-2.5 text-[22px]">
        {title} <span className="font-sans text-sm text-zinc-500">{people.length}</span>
      </h2>
      <ExpandList
        searchPlaceholder={`Search ${title.toLowerCase()}`}
        empty={<p className="text-sm text-zinc-500">{empty}</p>}
        items={people.map((p) => ({ key: p.id, text: `${p.name ?? ""} ${p.handle}`, node: <PersonRow p={p} viewerId={viewerId} /> }))}
      />
    </section>
  );
}
