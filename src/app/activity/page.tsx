import Link from "next/link";
import { redirect } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import { Bell, CheckCircle2, ChevronDown, Clock, Heart, ThumbsUp, UserPlus, Users, Zap } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { listNotifications } from "@/server/services/notifications";
import { postedBattles, votedBattles, type VotedCard } from "@/server/services/activity";
import { BattleCardRow } from "@/components/battle/BattleCardRow";
import { MarkRead } from "@/components/layout/MarkRead";
import { cn, pct, timeAgo, timeLeft } from "@/lib/utils";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

type P = Record<string, unknown>;

function render(type: string, p: P): { icon: React.ReactNode; text: React.ReactNode; href?: string } {
  const title = String(p.title ?? "");
  const slug = p.slug as string | undefined;
  switch (type) {
    case "VOTES_MILESTONE":
      return { icon: <Users className="size-5 text-a" />, text: <><b>{String(p.votes)}</b> {Number(p.votes) === 1 ? "person has" : "people have"} voted on “{title}”</>, href: `/b/${slug}` };
    case "BATTLE_CLOSED":
      return { icon: <Clock className="size-5 text-b" />, text: <>Voting closed on “{title}” — which did you pick? <b>+10 ⚡</b></>, href: `/b/${slug}/report` };
    case "REMINDER":
      return { icon: <Bell className="size-5 text-b" />, text: <>Reminder: close the loop on “{title}”</>, href: `/b/${slug}/report` };
    case "OUTCOME": {
      const picked = p.chosen === "NEITHER" ? "neither option" : `option ${p.chosen}`;
      return { icon: <CheckCircle2 className="size-5 text-ok" />, text: <>{String(p.poster ?? "Someone")} picked {picked} on “{title}” {p.thumb === "UP" ? "👍" : p.thumb === "DOWN" ? "👎" : ""}</>, href: `/b/${slug}` };
    }
    case "CALLED_IT":
      return { icon: <ThumbsUp className="size-5 text-ok" />, text: <>You called it! {String(p.poster ?? "They")} picked your choice on “{title}” and it worked out. <b>+{String(p.points)} ⚡</b></>, href: `/b/${slug}` };
    case "HELPFUL":
      return { icon: <Heart className="size-5 text-b" />, text: <>The poster found your reason helpful. <b>+{String(p.points)} ⚡</b></> };
    case "FOLLOW":
      return { icon: <UserPlus className="size-5 text-a" />, text: <><b>{String(p.name || `@${p.handle}`)}</b> followed you</>, href: p.handle ? `/u/${p.handle}` : undefined };
    default:
      return { icon: <Zap className="size-5 text-pp" />, text: <>{type}</> };
  }
}

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/activity");
  const [items, posted, voted] = await Promise.all([listNotifications(user.id), postedBattles(user.id), votedBattles(user.id)]);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium">Activity</h1>
      {unread > 0 && <MarkRead />}

      <Section title="Battles posted" count={posted.length}>
        {posted.length === 0 ? (
          <Empty>
            You haven’t posted a battle yet.{" "}
            <Link href="/post" className="text-accent underline-offset-2 hover:underline">
              Post one
            </Link>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {posted.map((b) => (
              <li key={b.id}>
                <BattleCardRow b={b} showAuthor={false} src="activity" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Votes" count={voted.length}>
        {voted.length === 0 ? (
          <Empty>
            No votes yet.{" "}
            <Link href="/vote" className="text-accent underline-offset-2 hover:underline">
              Start voting
            </Link>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {voted.map((b) => (
              <li key={b.id}>
                <VoteRow b={b} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Updates" count={unread} countLabel="new" open>
        {items.length === 0 ? (
          <Empty>Nothing yet. You’ll see votes on your battles, results and new followers here.</Empty>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const r = render(n.type, n.payload);
              const inner = (
                <div className={`card flex items-start gap-3 p-3 ${!n.readAt ? "border-a/40 bg-a-soft/30" : ""}`}>
                  <span className="mt-0.5">{r.icon}</span>
                  <div className="flex-1 text-[15px]">
                    {r.text}
                    <div className="text-xs text-zinc-400">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              );
              return <li key={n.id}>{r.href ? <Link href={r.href}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Collapsible group: tap the header (caret) to expand / collapse. Native <details>, so no client JS. */
function Section({ title, count, countLabel, open, children }: { title: string; count: number; countLabel?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group card overflow-hidden !bg-white shadow-ring" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-sans text-[15px] font-medium">{title}</span>
        {count > 0 && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-zinc-600">
            {count}
            {countLabel ? ` ${countLabel}` : ""}
          </span>
        )}
        <ChevronDown className="size-5 text-zinc-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-ink/8 p-3">{children}</div>
    </details>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-sm text-zinc-500">{children}</p>;
}

function Thumb({ img, label, side, mine }: { img: string | null; label: string; side: "A" | "B"; mine: boolean }) {
  return (
    <span
      className={cn(
        "relative block size-12 shrink-0 overflow-hidden rounded-lg",
        side === "A" ? "bg-a-soft" : "bg-b-soft",
        mine ? (side === "A" ? "ring-2 ring-a" : "ring-2 ring-b") : "opacity-50",
      )}
    >
      {img ? (
        <img src={img} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("flex size-full items-center justify-center p-1 text-center text-[10px] leading-tight", side === "A" ? "text-a" : "text-b")}>{label.slice(0, 20)}</span>
      )}
    </span>
  );
}

function VoteRow({ b }: { b: VotedCard }) {
  const p = pct(b.votesA, b.votesB);
  const myLabel = b.mySide === "A" ? b.labelA : b.labelB;
  const agree = b.mySide === "A" ? p.a : p.b;
  const posterPicked = b.outcome ? (b.outcome.chosen === "A" ? b.labelA : b.outcome.chosen === "B" ? b.labelB : "neither") : null;
  const calledIt = b.outcome?.chosen === b.mySide;
  return (
    <Link href={`/b/${b.slug}?src=activity`} className="flex items-center gap-3 rounded-[12px] p-1.5 transition hover:bg-surface">
      <span className="flex gap-1">
        <Thumb img={b.imageA} label={b.labelA} side="A" mine={b.mySide === "A"} />
        <Thumb img={b.imageB} label={b.labelB} side="B" mine={b.mySide === "B"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{b.title}</span>
        <span className="block truncate text-xs">
          You picked <b className={cn("font-medium", b.mySide === "A" ? "text-a" : "text-b")}>{myLabel}</b>
          <span className="text-zinc-500"> · {p.total > 1 ? `${agree}% agree` : "first vote"}</span>
        </span>
        <span className="block truncate text-xs text-zinc-500">
          {posterPicked ? (
            <span className={calledIt ? "text-ok" : undefined}>
              {calledIt ? "You called it! " : ""}
              {b.authorHandle ? `@${b.authorHandle}` : "They"} picked {posterPicked}
            </span>
          ) : b.status === "OPEN" ? (
            `${p.total} vote${p.total === 1 ? "" : "s"} · ${timeLeft(b.deadline)}`
          ) : (
            `${p.total} vote${p.total === 1 ? "" : "s"} · voting closed`
          )}
          {" · "}
          {timeAgo(b.votedAt)}
        </span>
      </span>
    </Link>
  );
}
