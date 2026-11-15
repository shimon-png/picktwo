import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { MessageCircle, ThumbsUp, Zap, Rocket, Clock } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { db } from "@/server/db";
import { pointLedger } from "@/server/db/schema";
import { getEconomy } from "@/server/services/config";
import { awaitingOutcome, countOpenLoops } from "@/server/services/points";
import { priorityTier } from "@/server/services/priority";
import { OpenLoopsList } from "@/components/priority/OpenLoopsList";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Priority" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  STARTER: "Welcome bonus",
  FIRST_BATTLE: "First battle posted",
  VOTE: "Voted on a battle",
  VOTE_REASON: "Added a reason",
  REASON_HELPFUL: "Your reason was helpful",
  LOOP_CLOSED: "Closed the loop",
  LOOP_CLOSED_FAST: "Closed within 48h",
  OUTCOME_NOTE: "Added an outcome note",
  CALLED_IT: "Called it!",
  INVITE: "Friend joined",
  BOOST: "Boosted a battle",
  DECAY: "Inactivity decay",
  ADMIN_ADJUST: "Adjustment",
};

export default async function PriorityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/priority");
  const e = await getEconomy();
  const [ledger, openLoops, awaiting] = await Promise.all([
    db.select().from(pointLedger).where(eq(pointLedger.userId, user.id)).orderBy(desc(pointLedger.createdAt)).limit(50),
    countOpenLoops(user.id, e),
    awaitingOutcome(user.id),
  ]);
  const tier = priorityTier(user.ppBalance, openLoops, e.priorityCap);
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 p-6 text-center dark:from-amber-500/15 dark:to-orange-500/15">
        <Zap className="mx-auto size-10 fill-pp text-pp" />
        <div className="font-display text-5xl font-extrabold tabular-nums">{user.ppBalance}</div>
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">priority points</div>
        <div className="mt-3 inline-block rounded-full bg-white/70 px-3 py-1 text-sm font-semibold dark:bg-zinc-900/60">
          Community priority: {tier.tier}
        </div>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{tier.reason}</p>
      </section>

      {awaiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Open loops ({awaiting.length})</h2>
          <OpenLoopsList items={awaiting.map((a) => ({ ...a, deadline: a.deadline.toISOString() }))} />
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-extrabold">How priority works</h2>
        <Rule icon={<MessageCircle className="size-5 text-a" />} title="Answer questions → earn priority">
          +{e.votePoints} ⚡ per quality vote on someone else’s battle, +{e.voteReasonBonus} more with a reason. +{e.ownerHelpfulPoints} ⚡ when the poster marks your reason helpful. Up to {e.dailyVotePointCap} ⚡/day from votes.
        </Rule>
        <Rule icon={<ThumbsUp className="size-5 text-ok" />} title="Close the loop → earn more">
          Report which option you picked and 👍/👎: +{e.loopClosedPoints} ⚡, +{e.loopClosedFastBonus} if within {e.loopClosedFastHours}h, +{e.outcomeNotePoints} for a note. Voters who called it get +{e.calledItPoints} ⚡.
        </Rule>
        <Rule icon={<Clock className="size-5 text-b" />} title="Open loops cost you reach">
          A battle {e.openLoopGraceHours}h past its deadline with {e.minVotesForLoop}+ votes and no outcome is an open loop. 1 open loop = 60% reach, 2 = 30%, 3+ = 10%. Sharing your link is never limited.
        </Rule>
        <Rule icon={<Rocket className="size-5 text-pp" />} title="Spend priority">
          Your ⚡ ranks your battles in the community feed. Spend {e.boostCost} ⚡ to boost one battle for {e.boostHours}h.
        </Rule>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-extrabold">History</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-zinc-500">No points yet — start voting!</p>
        ) : (
          <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  {LABELS[l.reason] ?? l.reason}
                  <span className="ml-2 text-xs text-zinc-400">{timeAgo(l.createdAt)}</span>
                </span>
                <span className={`font-bold tabular-nums ${l.delta > 0 ? "text-ok" : "text-b"}`}>
                  {l.delta > 0 ? "+" : ""}
                  {l.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
      </div>
    </div>
  );
}
