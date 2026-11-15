import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { ArrowRight, MessageCircle, Sparkles, ThumbsUp, Zap } from "lucide-react";
import { getViewer } from "@/server/viewer";
import { battleCards, friendIds, visibleStatuses } from "@/server/services/battles";
import { awaitingOutcome, countOpenLoops } from "@/server/services/points";
import { getEconomy } from "@/server/services/config";
import { getFeed } from "@/server/services/feed";
import { battles, outcomes } from "@/server/db/schema";
import { BattleCardRow } from "@/components/battle/BattleCardRow";
import { OpenLoopsList } from "@/components/priority/OpenLoopsList";
import { track } from "@/server/analytics";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const user = viewer.user;
  if (user && !user.onboardedAt) redirect("/onboarding");
  if (!user) return <Landing deviceId={viewer.deviceId} />;

  const economy = await getEconomy();
  const friends = [...(await friendIds(user.id))];
  const [mine, awaiting, openLoops, fromFriends, stories] = await Promise.all([
    battleCards(and(eq(battles.authorId, user.id), visibleStatuses), 30),
    awaitingOutcome(user.id),
    countOpenLoops(user.id, economy),
    friends.length ? battleCards(and(inArray(battles.authorId, friends), visibleStatuses, inArray(battles.visibility, ["PUBLIC", "FRIENDS"])), 10) : Promise.resolve([]),
    battleCards(and(eq(battles.visibility, "PUBLIC"), eq(battles.status, "CLOSED"), isNotNull(outcomes.id)), 6),
  ]);
  const active = mine.filter((b) => b.status === "OPEN");
  const closed = mine.filter((b) => b.status !== "OPEN" && b.outcome);

  return (
    <div className="space-y-8">
      {awaiting.length > 0 && (
        <section className="space-y-3 rounded-2xl border-2 border-b/30 bg-b-soft/50 p-4 dark:bg-b/10">
          <div>
            <h2 className="font-display text-lg font-extrabold">
              You have {awaiting.length} decision{awaiting.length > 1 ? "s" : ""} to close
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {openLoops > 0
                ? "Open loops push your new battles down the feed. Close them to get your next question seen faster."
                : "Tell everyone which you picked — earn +10 ⚡ each and help voters learn."}
            </p>
          </div>
          <OpenLoopsList items={awaiting.map((a) => ({ ...a, deadline: a.deadline.toISOString() }))} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Your battles</h2>
          <Link href="/post" className="text-sm font-semibold text-a">
            + New
          </Link>
        </div>
        {active.length === 0 && closed.length === 0 && awaiting.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <p className="font-semibold">Stuck between two options?</p>
            <p className="text-sm text-zinc-500">Post a battle and get answers from friends and people like you in minutes.</p>
            <Link href="/post" className="btn-primary">
              Post your first battle (+5 ⚡)
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((b) => (
              <BattleCardRow key={b.id} b={b} showAuthor={false} />
            ))}
            {closed.slice(0, 5).map((b) => (
              <BattleCardRow key={b.id} b={b} showAuthor={false} />
            ))}
          </div>
        )}
      </section>

      <Link href="/vote" className="flex items-center justify-between rounded-2xl bg-zinc-900 p-4 text-white dark:bg-white dark:text-zinc-900">
        <span>
          <span className="block font-display text-lg font-extrabold">Help someone decide</span>
          <span className="text-sm opacity-80">Every vote earns ⚡ priority for your own questions</span>
        </span>
        <ArrowRight className="size-6" />
      </Link>

      {fromFriends.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">From friends</h2>
          <div className="space-y-2">
            {fromFriends.map((b) => (
              <BattleCardRow key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">How it turned out</h2>
          <div className="space-y-2">
            {stories.map((b) => (
              <BattleCardRow key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function Landing({ deviceId }: { deviceId: string | null }) {
  track("landing_viewed", {}, { deviceId });
  const [feed, stories] = await Promise.all([
    getFeed({ user: null, deviceId }, { limit: 3 }),
    battleCards(and(eq(battles.visibility, "PUBLIC"), eq(battles.status, "CLOSED"), isNotNull(outcomes.id)), 3),
  ]);
  return (
    <div className="space-y-12 pb-8">
      <section className="space-y-5 pt-6 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-pp-soft px-3 py-1 text-xs font-bold text-amber-800">
          <Sparkles className="size-3.5" /> Holiday gift season is here
        </span>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
          Can’t decide?
          <br />
          <span className="bg-gradient-to-r from-a to-b bg-clip-text text-transparent">Ask people like you.</span>
        </h1>
        <p className="mx-auto max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Post two options. Get votes from friends and parents like you in minutes. Then tell everyone how it turned out.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/signin?callbackUrl=/post" className="btn-primary px-6 py-3 text-base">
            Post a battle
          </Link>
          <Link href="/vote" className="btn-outline px-6 py-3 text-base">
            Start voting
          </Link>
        </div>
        <p className="text-xs text-zinc-400">Free · voting needs no account</p>
      </section>

      {feed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Help someone decide right now</h2>
          <div className="space-y-2">
            {feed.map((b) => (
              <BattleCardRow key={b.id} b={b} src="feed" />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          ["1", "Post a battle", "Two photos, links or names, plus a little context: “Gift for my 6-year-old, loves art, ~$50.”"],
          ["2", "Get votes fast", "Friends first via link, then relevant voters — like parents of kids the same age."],
          ["3", "See the why", "One-line reasons from voters, with the most helpful ones rising to the top."],
          ["4", "Close the loop", "Tell everyone which you picked and 👍 or 👎 how it went. Everyone learns."],
        ].map(([n, t, d]) => (
          <div key={n} className="card p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-zinc-900 font-display font-extrabold text-white dark:bg-white dark:text-zinc-900">{n}</div>
            <div className="font-semibold">{t}</div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{d}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 dark:from-amber-500/10 dark:to-orange-500/10">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="size-6 fill-pp text-pp" />
          <h2 className="font-display text-xl font-extrabold">Help others, get answered first</h2>
        </div>
        <ul className="space-y-2 text-[15px]">
          <li className="flex gap-2">
            <MessageCircle className="mt-0.5 size-5 shrink-0 text-a" /> Vote on other people’s battles to earn ⚡ priority points.
          </li>
          <li className="flex gap-2">
            <ThumbsUp className="mt-0.5 size-5 shrink-0 text-ok" /> Close the loop on your own battles — say which you picked and 👍/👎 — for the biggest reward.
          </li>
          <li className="flex gap-2">
            <Zap className="mt-0.5 size-5 shrink-0 text-pp" /> The more priority you have, the faster your next question gets answered.
          </li>
        </ul>
      </section>

      {stories.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Real decisions, real outcomes</h2>
          <div className="space-y-2">
            {stories.map((b) => (
              <BattleCardRow key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      <footer className="flex flex-wrap justify-center gap-4 text-xs text-zinc-400">
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/guidelines">Community guidelines</Link>
      </footer>
    </div>
  );
}
