import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpertBadge } from "@/components/ui/ExpertBadge";

type Score = { a: number; b: number; total: number } | null;

function lead(s: Score, labelA: string, labelB: string) {
  if (!s || s.total === 0) return null;
  if (s.a === s.b) return { pct: 50, label: "Split", side: null as "A" | "B" | null };
  return s.a > s.b ? { pct: s.a, label: labelA, side: "A" as const } : { pct: s.b, label: labelB, side: "B" as const };
}

/**
 * Two scores side by side, like an audience score and a critics score:
 * Everyone (all votes) and Experts (votes from Expert and Super expert voters).
 */
export function Scores({
  everyone,
  experts,
  labelA,
  labelB,
  compact = false,
}: {
  everyone: Score;
  experts: Score;
  labelA: string;
  labelB: string;
  compact?: boolean;
}) {
  const e = lead(everyone, labelA, labelB);
  const x = lead(experts, labelA, labelB);
  if (compact)
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" aria-hidden />
          Everyone {e ? <b className={cn("font-semibold", e.side === "A" ? "text-a" : e.side === "B" ? "text-b" : "")}>{e.pct}%</b> : "–"}
        </span>
        <span className="inline-flex items-center gap-1">
          <ExpertBadge tier="EXPERT" />
          Experts {x ? <b className={cn("font-semibold", x.side === "A" ? "text-a" : x.side === "B" ? "text-b" : "")}>{x.pct}%</b> : "–"}
        </span>
      </span>
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tile title="Everyone" icon={<Users className="size-4" aria-hidden />} s={e} note="of all voters" empty="No votes yet" />
      <Tile
        title="Experts"
        icon={<ExpertBadge tier="EXPERT" />}
        s={x}
        note={`${experts?.total ?? 0} expert vote${experts?.total === 1 ? "" : "s"}`}
        empty="No expert votes yet"
      />
    </div>
  );
}

function Tile({ title, icon, s, note, empty }: { title: string; icon: React.ReactNode; s: ReturnType<typeof lead>; note: string; empty: string }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {title}
      </div>
      {s ? (
        <>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", s.side === "A" ? "text-a" : s.side === "B" ? "text-b" : "")}>{s.pct}%</div>
          <div className="truncate text-[13px]">{s.label}</div>
          <div className="text-xs text-zinc-500">{note}</div>
        </>
      ) : (
        <div className="mt-1 text-[13px] text-zinc-500">{empty}</div>
      )}
    </div>
  );
}
