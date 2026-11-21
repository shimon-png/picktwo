import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ExpertTier } from "@/server/services/expertise";

const BADGE =
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z";

const LABEL: Record<Exclude<ExpertTier, "NONE">, string> = {
  PRO: "Pro",
  EXPERT: "Expert",
  SUPER: "Super expert",
};

/** Verified-style check next to a name: Pro = blue, Expert = gold, Super expert = diamond. Renders nothing for regular users. */
export function ExpertBadge({ tier, className, withLabel = false }: { tier: ExpertTier | undefined | null; className?: string; withLabel?: boolean }) {
  const gid = useId();
  if (!tier || tier === "NONE") return null;
  const fill =
    tier === "PRO" ? (
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4aa3ff" />
        <stop offset="1" stopColor="#1d6fe0" />
      </linearGradient>
    ) : tier === "EXPERT" ? (
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe08a" />
        <stop offset=".5" stopColor="#f5b82e" />
        <stop offset="1" stopColor="#c98a0b" />
      </linearGradient>
    ) : (
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e8fbff" />
        <stop offset=".35" stopColor="#9fe8ff" />
        <stop offset=".65" stopColor="#c7b8ff" />
        <stop offset="1" stopColor="#6fd3f7" />
      </linearGradient>
    );
  const label = LABEL[tier];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 align-[-0.15em]", className)} title={label}>
      <svg viewBox="0 0 24 24" className="size-[1.1em]" role="img" aria-label={label}>
        <defs>{fill}</defs>
        <path d={BADGE} fill={`url(#${gid})`} stroke={tier === "SUPER" ? "#ffffff" : "none"} strokeWidth={tier === "SUPER" ? 0.8 : 0} />
        {tier === "SUPER" && <path d="M7 6.2l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z" fill="#fff" />}
        <path
          d="m16 9-5.5 5.5L8 12"
          fill="none"
          stroke={tier === "SUPER" ? "#3b2a8f" : "#fff"}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withLabel && <span className="text-[0.85em] font-medium">{label}</span>}
    </span>
  );
}
