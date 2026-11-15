/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { BattleCard } from "@/server/services/battles";
import { categoryById } from "@/lib/constants";
import { cn, pct, timeLeft } from "@/lib/utils";

function Thumb({ img, label, side }: { img: string | null; label: string; side: "A" | "B" }) {
  return (
    <div className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl", side === "A" ? "bg-a-soft dark:bg-a/20" : "bg-b-soft dark:bg-b/20")}>
      {img ? (
        <img src={img} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn("flex size-full items-center justify-center p-1 text-center text-[10px] font-bold leading-tight", side === "A" ? "text-a" : "text-b")}>
          {label.slice(0, 24)}
        </span>
      )}
    </div>
  );
}

export function BattleCardRow({ b, showAuthor = true, src = "home" }: { b: BattleCard; showAuthor?: boolean; src?: string }) {
  const p = pct(b.votesA, b.votesB);
  const cat = categoryById(b.categoryId);
  const closed = b.status !== "OPEN";
  const chosenLabel = b.outcome?.chosen === "A" ? b.labelA : b.outcome?.chosen === "B" ? b.labelB : null;
  return (
    <Link href={`/b/${b.slug}?src=${src}`} className="card flex items-center gap-3 p-3 transition hover:shadow-md">
      <div className="flex -space-x-3">
        <Thumb img={b.imageA} label={b.labelA} side="A" />
        <Thumb img={b.imageB} label={b.labelB} side="B" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{b.title}</div>
        <div className="truncate text-xs text-zinc-500">
          {cat.emoji} {b.labelA} vs {b.labelB}
          {showAuthor && b.authorHandle ? ` · @${b.authorHandle}` : ""}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {b.outcome ? (
            <span className={cn("inline-flex items-center gap-1 font-semibold", b.outcome.thumb === "DOWN" ? "text-zinc-600" : "text-ok")}>
              {b.outcome.thumb === "UP" ? <ThumbsUp className="size-3.5" /> : b.outcome.thumb === "DOWN" ? <ThumbsDown className="size-3.5" /> : null}
              {chosenLabel ? `Picked ${chosenLabel}` : "Picked neither"}
            </span>
          ) : (
            <span className={cn("font-medium", closed ? "text-b" : "text-zinc-500")}>{closed ? "Awaiting report-back" : timeLeft(b.deadline)}</span>
          )}
          <span className="text-zinc-400">· {p.total} votes</span>
        </div>
      </div>
      {p.total > 0 && (
        <div className="w-12 shrink-0 text-right text-xs font-bold tabular-nums">
          <div className="text-a">{p.a}%</div>
          <div className="text-b">{p.b}%</div>
        </div>
      )}
    </Link>
  );
}
