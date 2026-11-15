"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function PriorityPill({ initial, openLoops }: { initial: number; openLoops: number }) {
  const [pp, setPp] = useState(initial);
  const [bump, setBump] = useState(false);
  useEffect(() => setPp(initial), [initial]);
  useEffect(() => {
    const on = (e: Event) => {
      setPp((e as CustomEvent<number>).detail);
      setBump(true);
      setTimeout(() => setBump(false), 400);
    };
    window.addEventListener("pt:pp", on);
    return () => window.removeEventListener("pt:pp", on);
  }, []);
  return (
    <Link
      href="/priority"
      aria-label={`${pp} priority points${openLoops ? `, ${openLoops} open loops` : ""}`}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full bg-pp-soft px-3 py-1.5 text-sm font-bold text-amber-800 transition dark:bg-amber-500/15 dark:text-amber-300",
        bump && "scale-110",
      )}
    >
      <Zap className="size-4 fill-pp text-pp" />
      <span className="font-display tabular-nums">{pp}</span>
      {openLoops > 0 && <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-b dark:border-zinc-950" />}
    </Link>
  );
}
