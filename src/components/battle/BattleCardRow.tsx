/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { BattleCard } from "@/server/services/battles";
import { cn, pct, timeLeft } from "@/lib/utils";
import { ExpertBadge } from "@/components/ui/ExpertBadge";
import { Scores } from "./Scores";

function Thumb({ img, label, side }: { img: string | null; label: string; side: "A" | "B" }) {
  return (
    <div className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl", side === "A" ? "bg-a-soft" : "bg-b-soft")}>
      {img ? (
        <img src={img} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("flex size-full items-center justify-center p-1 text-center text-[10px] font-medium leading-tight", side === "A" ? "text-a" : "text-b")}>
          {label.slice(0, 24)}
        </span>
      )}
    </div>
  );
}

/**
 * A battle in a list. The whole card opens the battle; the poster's name opens their profile.
 * `hideResults` hides the split (Discover: open battles you haven't voted on, so votes stay unbiased).
 */
export function BattleCardRow({ b, showAuthor = true, src = "home", hideResults = false }: { b: BattleCard; showAuthor?: boolean; src?: string; hideResults?: boolean }) {
  const p = pct(b.votesA, b.votesB);
  const closed = b.status !== "OPEN";
  const chosenLabel = b.outcome?.chosen === "A" ? b.labelA : b.outcome?.chosen === "B" ? b.labelB : null;
  const results = p.total > 0 && !hideResults;
  return (
    <div className="card relative flex items-center gap-3 p-3 transition hover:shadow-md">
      <div className="flex -space-x-3">
        <Thumb img={b.imageA} label={b.labelA} side="A" />
        <Thumb img={b.imageB} label={b.labelB} side="B" />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/b/${b.slug}?src=${src}`} className="block truncate font-medium after:absolute after:inset-0 after:rounded-[inherit] after:content-['']">
          {b.title}
        </Link>
        <div className="truncate text-xs text-zinc-500">
          {b.labelA} vs {b.labelB}
          {showAuthor && b.authorHandle && (
            <>
              {" · "}
              <Link href={`/u/${b.authorHandle}`} className="relative z-10 hover:underline">
                @{b.authorHandle}
              </Link>
              <ExpertBadge tier={b.authorTier} className="ml-1" />
            </>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {b.outcome ? (
            <span className={cn("inline-flex items-center gap-1 font-medium", b.outcome.thumb === "DOWN" ? "text-zinc-600" : "text-ok")}>
              {b.outcome.thumb === "UP" ? <ThumbsUp className="size-3.5" /> : b.outcome.thumb === "DOWN" ? <ThumbsDown className="size-3.5" /> : null}
              {chosenLabel ? `Picked ${chosenLabel}` : "Picked neither"}
            </span>
          ) : (
            <span className={cn("font-medium", closed ? "text-b" : "text-zinc-500")}>{closed ? "Awaiting report-back" : timeLeft(b.deadline)}</span>
          )}
          <span className="text-zinc-400">· {p.total} votes</span>
          {hideResults && <span className="text-zinc-400">· vote to see results</span>}
        </div>
        {results && (
          <div className="mt-1 text-xs text-zinc-500">
            <Scores compact everyone={p} experts={b.expert} labelA={b.labelA} labelB={b.labelB} />
          </div>
        )}
      </div>
      {results && (
        <div className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">
          <div className="text-a">{p.a}%</div>
          <div className="text-b">{p.b}%</div>
        </div>
      )}
    </div>
  );
}
