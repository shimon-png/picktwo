/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { ArrowRight, Camera, MessageCircleHeart, Sparkles, ThumbsDown, ThumbsUp, Users, Zap } from "lucide-react";
import { getViewer } from "@/server/viewer";
import { getFeed } from "@/server/services/feed";
import { guestVotesLeft } from "@/server/services/votes";
import { softGateFor } from "@/server/services/gate-test";
import { getEconomy } from "@/server/services/config";
import { battleCards, type BattleCard } from "@/server/services/battles";
import { db } from "@/server/db";
import { battles, outcomes, votes } from "@/server/db/schema";
import { HeroRotator } from "@/components/battle/HeroRotator";
import { KnowYourTaste } from "@/components/home/KnowYourTaste";
import { Mark } from "@/components/layout/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { track } from "@/server/analytics";
import { kidAgeLabel } from "@/lib/constants";
import { cn, pct, timeLeft } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const user = viewer.user;
  if (user && profileIncomplete(user)) redirect(onboardingUrl());
  // Signed in: the Vote stack is home.
  if (user) redirect("/vote");

  track("landing_viewed", {}, { deviceId: viewer.deviceId });
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [feed, stories, [{ weekVotes }], economy, guestLeft, softGate] = await Promise.all([
    getFeed({ user: null, deviceId: viewer.deviceId }, { limit: 200 }),
    battleCards(and(eq(battles.visibility, "PUBLIC"), eq(battles.status, "CLOSED"), isNotNull(outcomes.id)), 20),
    db.select({ weekVotes: sql<number>`count(*)::int` }).from(votes).where(gte(votes.createdAt, weekAgo)),
    getEconomy(),
    guestVotesLeft({ user: null, deviceId: viewer.deviceId }),
    softGateFor({ user: null, deviceId: viewer.deviceId }),
  ]);
  // Skip repeat stories (same question/options posted more than once).
  const seenStories = new Set<string>();
  const uniqueStories = stories.filter((b) => {
    const k = `${b.title}|${b.labelA}|${b.labelB}`.toLowerCase();
    return seenStories.has(k) ? false : (seenStories.add(k), true);
  });
  const live = feed[0];
  // "Deciding now" shows the top of the ranked feed; the hero cycles through every other live battle the visitor
  // hasn't voted on, in random order, with no repeats (Alex, Nov 24). Votes there count toward the free votes.
  // A featured battle (battle.tags.featured) is always the first hero card, and isn't repeated in "Deciding now".
  const featured = feed.filter((b) => b.featured);
  const rest = feed.filter((b) => !b.featured);
  const deciding = rest.slice(0, rest.length > 16 ? 8 : 1);
  const heroBattles = [...featured, ...shuffle(rest.length > 16 ? rest.slice(8) : rest)];

  return (
    <div className="-mx-4 -mt-2 overflow-x-clip">
      {/* ---------- Hero ---------- */}
      <section className="relative px-4 pb-10 pt-8 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_50%_at_20%_10%,oklch(0.93_0.06_258/.9),transparent),radial-gradient(50%_45%_at_90%_25%,oklch(0.94_0.06_350/.8),transparent),radial-gradient(60%_40%_at_50%_80%,oklch(0.96_0.08_98/.7),transparent)]" />
        {weekVotes >= 20 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[13px] text-zinc-700 shadow-ring backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-green" />
            </span>
            {weekVotes.toLocaleString()} votes this week
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[13px] text-pink shadow-ring backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden /> Holiday gift season is here
          </span>
        )}
        <h1 className="display mx-auto mt-5 max-w-md text-[44px] sm:text-[52px]">
          Can’t decide?{" "}
          <em className="text-b">Ask people like you.</em>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[17px] leading-relaxed text-zinc-600">
          Snap two options, get honest votes in minutes — from friends and parents who’ve been there.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 sm:flex-row">
          <Link href="/signin?callbackUrl=/post" data-track="ask_crowd" className="btn-cta flex-1 rounded-full py-3.5 text-base shadow-card">
            Ask the crowd
          </Link>
          <Link href="/vote" data-track="start_voting" className="btn-cta flex-1 rounded-full py-3.5 text-base">
            Start voting
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Free · no account needed to vote</p>

        {live && (
          <div className="relative mx-auto mt-10 max-w-sm text-left">
            {/* fanned cards behind the live one, then a straight full-width card just above it */}
            <div aria-hidden className="absolute inset-x-6 -top-5 h-24 -rotate-6 rounded-[22px] bg-pink-soft shadow-ring" />
            <div aria-hidden className="absolute inset-x-6 -top-5 h-24 rotate-6 rounded-[22px] bg-accent-900 shadow-ring" />
            <div aria-hidden className="absolute inset-x-0 -top-2.5 h-24 rounded-[22px] bg-surface shadow-ring" />
            <div className="relative" data-track="hero_card">
              <HeroRotator battles={heroBattles} guestLeft={guestLeft} guestLimit={economy.guestVoteLimit} softGate={softGate} />
            </div>
          </div>
        )}
      </section>

      {/* ---------- Deciding right now ---------- */}
      {deciding.length > 0 && (
        <section className="pb-10">
          <div className="flex items-end justify-between px-4">
            <h2 className="text-[22px]">Deciding right now</h2>
            <Link href="/vote" data-track="deciding_see_all" className="inline-flex items-center gap-1 text-sm text-accent">
              Vote <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {deciding.map((b) => (
              <li key={b.id} className="w-[230px] shrink-0 snap-start">
                <DecidingCard b={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- How it works ---------- */}
      <section className="px-4 pb-12">
        <h2 className="text-[22px]">Three taps to a decision</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(
            [
              [Camera, "bg-accent-900 text-accent", "Snap two options", "Photos, links or just names — plus a line of context."],
              [Users, "bg-pink-soft text-pink", "The crowd weighs in", "Friends by link, then parents with kids the same age."],
              [MessageCircleHeart, "bg-violet-soft text-violet", "Pick & share how it went", "See the why behind every vote, then close the loop."],
            ] as const
          ).map(([Icon, tone, title, line]) => (
            <div key={title} className="flex items-start gap-3.5 rounded-[18px] bg-surface p-4 sm:flex-col">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", tone)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <div className="text-[16px] font-medium">{title}</div>
                <p className="mt-0.5 text-[14px] text-zinc-600">{line}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Know your taste (about-you + taste profile explainer) ---------- */}
      <KnowYourTaste />

      {/* ---------- How it turned out ---------- */}
      {uniqueStories.length > 0 && (
        <section className="px-4 pb-12">
          <h2 className="text-[22px]">How it turned out</h2>
          <p className="mt-1 text-[14px] text-zinc-600">Real decisions, real follow-ups.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {uniqueStories.slice(0, 4).map((b) => (
              <li key={b.id}>
                <StoryCard b={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- ⚡ band ---------- */}
      <section className="mx-4 mb-10 overflow-hidden rounded-[24px] bg-white p-6 shadow-ring">
        <Zap className="size-8 fill-pp text-pp" aria-hidden />
        <h2 className="mt-3 text-[24px] leading-tight">Help others, get answered first.</h2>
        <p className="mt-2 text-[15px] text-ink/75">Every vote earns ⚡. The more you have, the sooner your next question reaches voters.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-ring">Vote +{economy.votePoints} ⚡</span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-ring">Add a reason +{economy.voteReasonBonus} ⚡</span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-ring">Close the loop +{economy.loopClosedPoints} ⚡</span>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-4 mb-8 rounded-[24px] bg-ink px-6 py-9 text-center text-page">
        <Mark size={40} className="mx-auto" />
        <h2 className="mt-4 text-[26px] leading-tight">Stuck between two?</h2>
        <p className="mx-auto mt-2 max-w-xs text-[15px] text-page/70">Post it in 30 seconds. Most battles get their first votes within minutes.</p>
        <Link href="/signin?callbackUrl=/post" data-track="bottom_ask" className="btn-cta mt-6 rounded-full px-7 py-3.5 text-base">
          Ask the crowd — it’s free
        </Link>
      </section>

      <footer className="flex flex-wrap justify-center gap-4 px-4 pb-6 text-xs text-zinc-400">
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/guidelines">Community guidelines</Link>
        <Link href="/contact">Contact us</Link>
      </footer>
    </div>
  );
}

function Tile({ img, label, side, className }: { img: string | null; label: string; side: "A" | "B"; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden", side === "A" ? "bg-gradient-to-b from-a-soft to-white" : "bg-gradient-to-b from-b-soft to-white", className)}>
      {img ? (
        <img src={img} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("flex size-full items-center justify-center p-2 text-center text-[13px] leading-tight", side === "A" ? "text-a" : "text-b")}>{label}</span>
      )}
    </span>
  );
}

function DecidingCard({ b }: { b: BattleCard }) {
  const total = b.votesA + b.votesB;
  const handle = b.authorHandle ? `@${b.authorHandle}` : (b.authorName ?? "someone");
  return (
    <Link href={`/b/${b.slug}?src=home`} data-track="deciding_card" className="block overflow-hidden rounded-[18px] bg-white shadow-card transition active:scale-[0.98]">
      <span className="relative grid h-[150px] grid-cols-2 gap-px bg-white">
        <Tile img={b.imageA} label={b.labelA} side="A" />
        <Tile img={b.imageB} label={b.labelB} side="B" />
        <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-medium text-zinc-600 shadow-card">
          or
        </span>
      </span>
      <span className="block p-3">
        <span className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug">{b.title}</span>
        <span className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
          <Avatar name={handle} seed={b.authorHandle ?? b.id} src={b.authorImage} size={16} />
          <span className="truncate">{handle}</span>
          <span className="ml-auto shrink-0">{total > 0 ? `${total} votes` : timeLeft(b.deadline)}</span>
        </span>
      </span>
    </Link>
  );
}

function StoryCard({ b }: { b: BattleCard }) {
  const o = b.outcome!;
  const handle = b.authorHandle ? `@${b.authorHandle}` : (b.authorName ?? "Someone");
  const picked = o.chosen === "A" ? b.labelA : o.chosen === "B" ? b.labelB : null;
  const p = pct(b.votesA, b.votesB);
  const crowdSide = p.total ? (p.a >= p.b ? "A" : "B") : null;
  const agreed = picked && crowdSide === o.chosen;
  const parentOf = b.authorKidAges[0] ? `parent of a ${kidAgeLabel(b.authorKidAges[0])} y/o` : null;
  return (
    <Link href={`/b/${b.slug}?src=home`} data-track="story_card" className="flex h-full flex-col rounded-[18px] bg-white p-3.5 shadow-card">
      <span className="flex gap-2">
        {(["A", "B"] as const).map((s) => (
          <span key={s} className={cn("relative block h-20 flex-1 overflow-hidden rounded-xl", o.chosen === s ? "ring-2 ring-accent" : "opacity-60")}>
            <Tile img={s === "A" ? b.imageA : b.imageB} label={s === "A" ? b.labelA : b.labelB} side={s} className="h-full" />
            {o.chosen === s && <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">Picked</span>}
          </span>
        ))}
      </span>
      <span className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
        <Avatar name={handle} seed={b.authorHandle ?? b.id} src={b.authorImage} size={16} />
        {handle}
        {parentOf && ` · ${parentOf}`}
      </span>
      <span className="mt-1 text-[15px] leading-snug">
        {picked ? (
          <>
            Went with <b className="font-medium">{picked}</b>{" "}
            {o.thumb === "UP" ? (
              <span className="inline-flex items-center gap-0.5 text-green">
                <ThumbsUp className="size-3.5" aria-hidden /> loved it
              </span>
            ) : o.thumb === "DOWN" ? (
              <span className="inline-flex items-center gap-0.5 text-zinc-500">
                <ThumbsDown className="size-3.5" aria-hidden /> not great
              </span>
            ) : null}
          </>
        ) : (
          "Went with neither"
        )}
      </span>
      {o.note && <span className="mt-1.5 line-clamp-2 text-[14px] italic text-zinc-600">“{o.note}”</span>}
      {picked && p.total > 0 && (
        <span className="mt-auto pt-3 text-xs text-zinc-500">
          {agreed ? `${Math.max(p.a, p.b)}% of voters called it` : `The crowd leaned the other way (${Math.max(p.a, p.b)}%)`}
        </span>
      )}
    </Link>
  );
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
