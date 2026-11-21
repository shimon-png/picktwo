"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Brand colours (Arcade Night): A cyan, B pink, ⚡/crowd lime. */
export const BRAND = { a: "#2BD2FF", b: "#FF3CAC", lime: "#C6FF3D", night: "#120E26" } as const;

/** Fire this after a vote to make every mark on screen wink (see `.mark` keyframes in globals.css). */
export const WINK_EVENT = "cp:wink";
export function wink() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WINK_EVENT));
}

/**
 * crowdpick mark ("Eyes, refreshed"): cyan A eye and pink B eye, both pupils glancing at the
 * pick, lime crowd dots above. On a vote the B eye winks and a lime spark pops (option C).
 */
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  const [winking, setWinking] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      setWinking((n) => n + 1);
      clearTimeout(t);
      t = setTimeout(() => setWinking(0), 950);
    };
    window.addEventListener(WINK_EVENT, on);
    return () => {
      window.removeEventListener(WINK_EVENT, on);
      clearTimeout(t);
    };
  }, []);
  return (
    <svg
      // Re-keying restarts the animation if votes come quickly.
      key={winking}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("mark", winking > 0 && "winking", className)}
    >
      <circle cx="14" cy="29" r="9.5" stroke={BRAND.a} strokeWidth="3.4" />
      <circle cx="17.5" cy="27" r="3.6" fill={BRAND.a} />
      <g className="mark-eye-b">
        <circle cx="34" cy="29" r="9.5" stroke={BRAND.b} strokeWidth="3.4" />
        <circle cx="37.5" cy="27" r="3.6" fill={BRAND.b} />
      </g>
      <path className="mark-wink" d="M25 30 Q34 21 43 30" stroke={BRAND.b} strokeWidth="3.8" strokeLinecap="round" />
      <g className="mark-dots" fill={BRAND.lime}>
        <circle cx="29" cy="10" r="2.3" />
        <circle cx="34" cy="7.5" r="2.3" />
        <circle cx="39" cy="10" r="2.3" />
      </g>
      <path className="mark-spark" d="M44.5 0.5 l1.4 3.5 3.5 1.4 -3.5 1.4 -1.4 3.5 -1.4 -3.5 -3.5 -1.4 3.5 -1.4z" fill={BRAND.lime} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[19px] font-bold tracking-[-0.01em] text-ink [font-size-adjust:none]", className)}>
      crowdpick<span className="text-a">.ai</span>
    </span>
  );
}

export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5", className)} aria-label="crowdpick.ai home">
      <Mark size={26} />
      <Wordmark />
    </Link>
  );
}
