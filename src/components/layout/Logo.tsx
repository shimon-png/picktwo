import Link from "next/link";
import { cn } from "@/lib/utils";

/** crowdpick mark: two option rings (A grey, B picked/blue) with three "crowd" dots above the pick. */
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="7" cy="14.5" r="4.8" stroke="#8A90A2" strokeWidth="1.6" />
      <circle cx="17" cy="14.5" r="4.8" stroke="#3170E8" strokeWidth="1.6" />
      <circle cx="17" cy="14.5" r="1.9" fill="#3170E8" />
      <circle cx="13.6" cy="5.2" r="1.25" fill="#E5484D" />
      <circle cx="17" cy="4" r="1.25" fill="#E5484D" />
      <circle cx="20.4" cy="5.2" r="1.25" fill="#E5484D" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[18px] font-medium tracking-[-0.025em] text-ink", className)}>
      crowdpick<span className="text-accent">.ai</span>
    </span>
  );
}

export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5", className)} aria-label="crowdpick.ai home">
      <Mark size={22} />
      <Wordmark />
    </Link>
  );
}
