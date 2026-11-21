import { BadgeCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Score = { a: number; b: number; total: number };

/**
 * Result bars on the picked photo: how many picked this side, for everyone and (once there are
 * expert votes) for Expert+ voters, like an audience score next to a critics score.
 */
export function ResultBars({ side, everyone, experts, onPhoto }: { side: "A" | "B"; everyone: Score | null; experts?: Score | null; onPhoto: boolean }) {
  const rows = [
    everyone && { key: "all", title: "Everyone", icon: <Users className="size-3.5" aria-hidden />, s: everyone },
    experts && experts.total > 0 && { key: "pro", title: "Experts", icon: <BadgeCheck className="size-3.5 text-amber-300" aria-hidden />, s: experts },
  ].filter(Boolean) as { key: string; title: string; icon: React.ReactNode; s: Score }[];
  if (!rows.length) return null;
  return (
    <span className="mt-2 flex flex-col gap-2" aria-live="polite">
      {rows.map(({ key, title, icon, s }) => {
        const p = side === "A" ? s.a : s.b;
        return (
          <span key={key} className="block">
            <span className={cn("flex items-baseline gap-1.5 text-[12px] font-medium", onPhoto ? "text-white/85" : "text-zinc-600")}>
              {icon}
              {title}
              <span className="ml-auto font-display text-[26px] leading-none tabular-nums text-current">{p}%</span>
            </span>
            <span className={cn("mt-1 block h-2 overflow-hidden rounded-full", onPhoto ? "bg-white/25" : "bg-black/10")}>
              <span
                className={cn("block h-full rounded-full transition-[width] duration-700 ease-out", side === "A" ? "bg-a" : "bg-b")}
                style={{ width: `${p}%` }}
              />
            </span>
            <span className={cn("mt-0.5 block text-[11px] tabular-nums", onPhoto ? "text-white/70" : "text-zinc-500")}>
              {p}% picked this · {s.total.toLocaleString()} vote{s.total === 1 ? "" : "s"}
            </span>
          </span>
        );
      })}
    </span>
  );
}
