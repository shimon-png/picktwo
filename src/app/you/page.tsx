/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Bell, ChevronRight, GraduationCap, LifeBuoy, Mail, Lightbulb, MessageSquareText, RefreshCcw, Settings, ThumbsUp, User, Zap } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/server/viewer";
import { unreadContactCount } from "@/server/services/contact";
import { db } from "@/server/db";
import { battles, pointLedger, votes } from "@/server/db/schema";
import { getEconomy } from "@/server/services/config";
import { battleCards, visibleStatuses, type BattleCard } from "@/server/services/battles";
import { countOpenLoops } from "@/server/services/points";
import { unreadCount } from "@/server/services/notifications";
import { pointsTier } from "@/server/services/priority";
import { TONE_CLASSES, type Tone } from "@/lib/constants";
import { TOUR_URL } from "@/lib/tour";
import { cn, timeAgo, timeLeft } from "@/lib/utils";

export const metadata = { title: "You" };
export const dynamic = "force-dynamic";

const LEDGER_LABELS: Record<string, string> = {
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

export default async function YouPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/you");
  if (profileIncomplete(user)) redirect(onboardingUrl("/you"));
  const e = await getEconomy();
  const admin = isAdmin(user);
  const [mine, openLoops, unread, ledger] = await Promise.all([
    battleCards(and(eq(battles.authorId, user.id), visibleStatuses), 30),
    countOpenLoops(user.id, e),
    unreadCount(user.id),
    db.select().from(pointLedger).where(eq(pointLedger.userId, user.id)).orderBy(desc(pointLedger.createdAt)).limit(15),
  ]);
  const newMessages = admin ? await unreadContactCount() : 0;
  const reasonCounts = new Map<string, number>();
  if (mine.length) {
    const rows = await db
      .select({ id: votes.battleId, n: sql<number>`count(*)::int` })
      .from(votes)
      .where(and(inArray(votes.battleId, mine.map((m) => m.id)), isNotNull(votes.reason)))
      .groupBy(votes.battleId);
    for (const r of rows) reasonCounts.set(r.id, r.n);
  }
  const t = pointsTier(user.ppBalance, e.tierHighAt, e.tierTopAt);
  const awaiting = mine.filter((b) => b.status !== "OPEN" && !b.outcome);
  const others = mine.filter((b) => !(b.status !== "OPEN" && !b.outcome));
  const earn: [Tone, React.ComponentType<{ className?: string }>, string, number][] = [
    ["pink", ThumbsUp, "Vote on a battle", e.votePoints],
    ["teal", MessageSquareText, "Add a reason", e.voteReasonBonus],
    ["violet", RefreshCcw, "Close the loop", e.loopClosedPoints],
  ];

  return (
    <div className="space-y-7">
      <section className="-mx-4 bg-gradient-to-b from-section to-section-glow px-4 py-6 sm:mx-0 sm:rounded-[14px]">
        <div className="flex items-center gap-2">
          <Zap className="size-7 fill-pp text-pp" aria-hidden />
          <span className="text-[34px] font-medium leading-none tabular-nums tracking-tight">{user.ppBalance}</span>
        </div>
        <div className="mt-1.5 text-[15px]">{t.tier} priority</div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {(["Normal", "High", "Top"] as const).map((name, i) => (
            <div key={name}>
              <span className="block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(t.segments[i] * 100)}%` }} />
              </span>
              <span className={cn("mt-1 block text-xs", t.tier === name ? "text-ink" : "text-ink/50")}>{name}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink/70">
          {t.next ? `${t.toNext} ⚡ to ${t.next}. ` : "You’re at the top. "}Higher priority = shown to more voters, sooner.
        </p>
        {openLoops > 0 && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[13px] text-b">
            {openLoops} open loop{openLoops > 1 ? "s" : ""} — your new battles reach fewer voters until you close {openLoops > 1 ? "them" : "it"}.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-medium">Earn ⚡</h2>
        <ul className="space-y-1.5">
          {earn.map(([tone, Icon, label, n]) => (
            <li key={label} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5", TONE_CLASSES[tone].soft)}>
              <span className={cn("flex size-7 items-center justify-center rounded-md", TONE_CLASSES[tone].solid)}>
                <Icon className="size-4" />
              </span>
              <span className="flex-1 text-sm text-ink">{label}</span>
              <span className="text-sm">+{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500">
          <Lightbulb className="mt-px size-3.5 shrink-0" aria-hidden /> Bonuses: +{e.loopClosedFastBonus} for closing within {e.loopClosedFastHours}h, +{e.outcomeNotePoints} for an outcome note, +
          {e.ownerHelpfulPoints} when a poster finds your reason helpful, +{e.calledItPoints} when you called it.
        </p>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[15px] font-medium">Your battles</h2>
          <Link href="/post" className="text-[13px] text-accent">
            + New
          </Link>
        </div>
        {mine.length === 0 ? (
          <div className="card p-5 text-center">
            <p className="text-sm text-zinc-600">Stuck between two options? Post a battle and get answers in minutes.</p>
            <Link href="/post" className="btn-primary mt-3">
              Post a battle
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink/8">
            {[...awaiting, ...others].map((b) => (
              <BattleRow key={b.id} b={b} reasons={reasonCounts.get(b.id) ?? 0} awaiting={awaiting.includes(b)} loopPoints={e.loopClosedPoints} />
            ))}
          </ul>
        )}
      </section>

      <section className="card divide-y divide-ink/8 overflow-hidden !bg-white shadow-ring">
        {(
          [
            ["/activity", Bell, "Activity", unread],
            [`/u/${user.handle}`, User, "Public profile", 0],
            ["/settings", Settings, "Settings", 0],
            [TOUR_URL, GraduationCap, "Tutorial", 0],
            ["/contact", LifeBuoy, "Contact us & feedback", 0],
            ...(admin ? ([["/admin/messages", Mail, "Admin · contact messages", newMessages]] as const) : []),
          ] as const
        ).map(([href, Icon, label, badge]) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface">
            <Icon className="size-4 text-zinc-500" aria-hidden />
            <span className="flex-1">{label}</span>
            {badge > 0 && <span className="rounded-full bg-b px-1.5 text-[11px] text-white">{badge}</span>}
            <ChevronRight className="size-4 text-zinc-400" aria-hidden />
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Recent ⚡</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-zinc-500">No points yet — start voting!</p>
        ) : (
          <ul className="card divide-y divide-ink/8">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  {LEDGER_LABELS[l.reason] ?? l.reason}
                  <span className="ml-2 text-xs text-zinc-400">{timeAgo(l.createdAt)}</span>
                </span>
                <span className={cn("tabular-nums", l.delta > 0 ? "text-green" : "text-b")}>
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

function Thumb({ img, label, side }: { img: string | null; label: string; side: "A" | "B" }) {
  return (
    <span className={cn("relative block size-9 shrink-0 overflow-hidden rounded-md", side === "A" ? "bg-a-soft" : "bg-b-soft")}>
      {img ? (
        <img src={img} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("flex size-full items-center justify-center text-[11px]", side === "A" ? "text-a" : "text-b")}>{label.slice(0, 2)}</span>
      )}
    </span>
  );
}

function BattleRow({ b, reasons, awaiting, loopPoints }: { b: BattleCard; reasons: number; awaiting: boolean; loopPoints: number }) {
  const votes = b.votesA + b.votesB;
  const picked = b.outcome ? (b.outcome.chosen === "A" ? b.labelA : b.outcome.chosen === "B" ? b.labelB : "neither") : null;
  const status = picked
    ? `Closed · picked ${picked}`
    : awaiting
      ? "Voting closed · tell people what you picked"
      : `Live · ${votes} vote${votes === 1 ? "" : "s"} · ${reasons} reason${reasons === 1 ? "" : "s"} · ${timeLeft(b.deadline)}`;
  return (
    <li>
      <Link href={awaiting ? `/b/${b.slug}/report` : `/b/${b.slug}`} className="flex items-center gap-3 py-3">
        <span className="flex gap-1">
          <Thumb img={b.imageA} label={b.labelA} side="A" />
          <Thumb img={b.imageB} label={b.labelB} side="B" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{b.title}</span>
          <span className="block truncate text-xs text-zinc-500">{status}</span>
        </span>
        {awaiting && <span className="tag shrink-0 bg-accent-900 text-accent">+{loopPoints} ⚡</span>}
      </Link>
    </li>
  );
}
