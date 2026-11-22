import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { onboardingUrl, profileIncomplete } from "@/lib/profile";
import { myVotedBattles, tasteTwins } from "@/server/services/matches";
import { TASTE_MIN_SHARED } from "@/server/services/taste";
import { PersonRow } from "@/components/people/PersonRow";
import { MessageButton } from "@/components/messages/MessageButton";
import { VoteMatchesNotice } from "@/components/people/VoteMatchesNotice";
import { ExpandList } from "@/components/ui/ExpandList";
import { cn } from "@/lib/utils";

export const metadata = { title: "People who vote like you" };
export const dynamic = "force-dynamic";

export default async function PeopleLikeYouPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?callbackUrl=/people-like-you");
  if (profileIncomplete(user)) redirect(onboardingUrl("/people-like-you"));
  const [twins, voted] = await Promise.all([tasteTwins(user), myVotedBattles(user)]);
  const hidden = !user.showInVoteMatches;

  return (
    <div className="space-y-7">
      <header className="space-y-2 pt-1">
        <h1 className="text-[32px] leading-none">People who vote like you</h1>
        <p className="text-sm text-zinc-600">Ranked by how often you picked the same side on battles you both voted on.</p>
        <VoteMatchesNotice hidden={hidden} />
      </header>

      {!hidden && (
        <section>
          <h2 className="mb-2.5 text-[22px]">Your taste twins</h2>
          <ExpandList
            searchPlaceholder="Search people"
            empty={
              <div className="card p-5 text-sm text-zinc-600">
                Nobody yet. Once you and someone else have voted on {TASTE_MIN_SHARED}+ of the same battles, they show up here.{" "}
                <Link href="/vote" className="text-accent underline">
                  Keep voting
                </Link>
              </div>
            }
            items={twins.map((p, i) => ({
              key: p.id,
              text: `${p.name ?? ""} ${p.handle}`,
              node: (
                <PersonRow
                  p={p}
                  rank={i + 1}
                  viewerId={user.id}
                  detail={
                    <span>
                      <b className="font-medium text-ink">{p.pct}% agree</b> · {p.shared} battles in common
                    </span>
                  }
                  extra={<MessageButton handle={p.handle} small />}
                />
              ),
            }))}
          />
        </section>
      )}

      <section>
        <h2 className="text-[22px]">Battles you voted on</h2>
        <p className="mb-2.5 text-[13px] text-zinc-500">Tap one to see who picked the same as you.</p>
        <ExpandList
          searchPlaceholder="Search your votes"
          empty={<p className="text-sm text-zinc-500">You haven’t voted yet.</p>}
          items={voted.map((b) => {
            const mine = b.mySide === "A" ? b.labelA : b.labelB;
            const total = b.votesA + b.votesB;
            const pct = total ? Math.round((100 * (b.mySide === "A" ? b.votesA : b.votesB)) / total) : 0;
            return {
              key: b.id,
              text: `${b.title} ${b.labelA} ${b.labelB}`,
              node: (
                <Link href={`/b/${b.slug}/like-you`} className="card flex items-center gap-3 p-3 hover:shadow-card">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] leading-snug">{b.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                      <span className={cn("rounded-full px-1.5 py-px text-[11px]", b.mySide === "A" ? "bg-a-soft text-a" : "bg-b-soft text-b")}>You: {mine}</span>
                      {pct}% agreed
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
                </Link>
              ),
            };
          })}
        />
      </section>
    </div>
  );
}
