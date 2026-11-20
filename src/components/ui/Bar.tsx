import { cn } from "@/lib/utils";

/** Thin progress bar (0–1). */
export function Bar({ value, className, fill = "bg-accent", track = "bg-accent/15" }: { value: number; className?: string; fill?: string; track?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className={cn("block h-1 overflow-hidden rounded-full", track, className)} aria-hidden>
      <span className={cn("block h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
    </span>
  );
}
