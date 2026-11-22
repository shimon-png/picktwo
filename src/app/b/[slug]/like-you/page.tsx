import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/viewer";
import { votedLikeYou } from "@/server/services/matches";
import { PersonRow } from "@/components/people/PersonRow";
import { MessageButton } from "@/components/messages/MessageButton";
import { VoteMatchesNotice } from "@/components/people/VoteMatchesNotice";
import { ExpandList } from "@/components/ui/ExpandList";
import { cn } from "@/lib/utils";

export const metadata = { title: "Voted like you" };
export const dynamic = "force-dynamic";

export default async function LikeYouPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?callbackUrl=/b/${slug}/like-you`);
  const data = await votedLikeYou(user, slug);
  // Only people who voted can see who voted like them.
  if (!data) redirect(`/b/${slug}`);
  const { battle, mySide, people, others } = data;
  const mine = mySide === "A" ? battle.labelA : battle.labelB;
  const total = battle.votesA + battle.votesB;
  const samePct = total ? Math.round((100 * (mySide === "A" ? battle.votesA : battle.votesB)) / total) : 0;

  return (
    <div className="space-y-5">
      <div className="-mx-2 flex items-center gap-1 pt-1">
        <Link href={`/b/${slug}`} className="rounded-full p-2 hover:bg-surface" aria-label="Back to the battle">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm text-zinc-500">Back to the battle</span>
      </div>
      <header className="space-y-2">
        <h1 className="text-[26px] leading-tight">Voted like you</h1>
        <p className="text-[15px] leading-snug">{battle.title}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-600">
          <span className={cn("rounded-full px-2 py-0.5 text-xs", mySide === "A" ? "bg-a-soft text-a" : "bg-b-soft text-b")}>You picked {mine}</span>
          {samePct}% of {total} vote{total === 1 ? "" : "s"} agreed
        </p>
        <VoteMatchesNotice hidden={!user.showInVoteMatches} />
      </header>

      {user.showInVoteMatches && (
        <section className="space-y-2">
          <ExpandList
            searchPlaceholder="Search people"
            empty={<p className="card p-5 text-sm text-zinc-600">Nobody listed yet. You’ll see people here as more signed-in voters pick {mine}.</p>}
            items={people.map((p) => ({
              key: p.id,
              text: `${p.name ?? ""} ${p.handle} ${p.reason ?? ""}`,
              node: (
                <div className="space-y-1">
                  <PersonRow
                    p={p}
                    viewerId={user.id}
                    detail={p.pct !== null ? <span><b className="font-medium text-ink">{p.pct}% taste match</b> · {p.shared} in common</span> : "New to you"}
                    extra={<MessageButton handle={p.handle} small />}
                  />
                  {p.reason && <p className="px-3 text-[13px] italic text-zinc-600">“{p.reason}”</p>}
                </div>
              ),
            }))}
          />
          {others > 0 && (
            <p className="text-center text-xs text-zinc-500">
              + {others} more {others === 1 ? "person" : "people"} picked {mine} (guests or private profiles)
            </p>
          )}
        </section>
      )}
    </div>
  );
}
