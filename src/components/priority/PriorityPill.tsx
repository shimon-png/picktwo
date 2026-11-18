"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { pointsTier } from "@/server/services/priority";
import { Bar } from "@/components/ui/Bar";

/** ⚡ count + progress to the next tier. Listens for live balance updates (`pt:pp`). Opens the You tab. */
export function PriorityPill({ initial, openLoops, highAt, topAt }: { initial: number; openLoops: number; highAt: number; topAt: number }) {
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
  const t = pointsTier(pp, highAt, topAt);
  return (
    <Link
      href="/you"
      aria-label={`${pp} priority points, ${t.tier} priority${openLoops ? `, ${openLoops} open loops` : ""}`}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-lg bg-accent-900 px-3 py-1.5 text-sm text-accent ring-1 ring-accent/30 transition",
        bump && "scale-110",
      )}
    >
      <Zap className="size-3.5 fill-pp text-pp" aria-hidden />
      <span className="tabular-nums">{pp}</span>
      <Bar value={t.progress} className="w-10" />
      {openLoops > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-white bg-b" />}
    </Link>
  );
}
