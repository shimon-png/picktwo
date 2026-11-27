"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AboutQuestionId } from "@/lib/about";
import { progressLine, type ProfileProgress } from "@/lib/profile-progress";
import { logEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

const CORE_LABEL: Partial<Record<AboutQuestionId, string>> = { sex: "Sex", age: "Age range", relationship: "Relationship", zip: "ZIP code" };

/**
 * Profile bar (Pickbot PRD Phase 0): a slim bar toward a complete profile (core about-you answers + `target` battles).
 * Tap it to see what's left and what a complete profile unlocks. In the deck, missing questions open the about-you
 * card (`onAsk`); elsewhere they link to Settings.
 */
export function ProfileBar({
  p,
  place,
  onAsk,
  celebrate = false,
  className,
}: {
  p: ProfileProgress;
  place: "deck" | "you" | "ask";
  onAsk?: (q: AboutQuestionId) => void;
  /** Just completed: show the done state (the deck hides the bar a moment later). */
  celebrate?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    if (!open) logEvent("profile_bar_tap", { place, votes: p.votes, left: p.left, missing: p.missing.length });
    setOpen(!open);
  };
  const pct = Math.round(p.pct * 100);
  return (
    <div className={cn("profile-bar relative rounded-[14px] bg-white shadow-soft", celebrate && "animate-pop", className)} data-testid="profile-bar">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
          {celebrate || p.complete ? "Profile ✓" : `Profile ${Math.min(p.votes, p.target)}/${p.target}`}
        </span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile complete">
          <span className="absolute inset-y-0 left-0 rounded-full bg-green transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </span>
        {p.missing.length > 0 && p.left > 0 && (
          <span className="shrink-0 rounded-full bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet">+{p.missing.length} about you</span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-ink/50 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {!open && <p className="sr-only">{progressLine(p)}</p>}
      {open && (
        <div
          className={cn(
            "space-y-3 px-3 pb-3 pt-2.5 text-[13px]",
            // In the deck it drops down over the card, so the card doesn't jump.
            place === "deck" ? "absolute inset-x-0 top-full z-40 mt-1.5 rounded-[14px] bg-white shadow-lift" : "border-t border-ink/10",
          )}
        >
          <p className="font-medium text-ink">{celebrate ? "Your profile is complete. Nice." : progressLine(p)}</p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2">
              <Tick on={p.left === 0} />
              <span className="flex-1">Battles answered</span>
              <span className="tabular-nums text-ink/60">
                {Math.min(p.votes, p.target)} / {p.target}
              </span>
            </li>
            {(["sex", "age", "relationship", "zip"] as const).map((q) => {
              const missing = p.missing.includes(q);
              return (
                <li key={q} className="flex items-center gap-2">
                  <Tick on={!missing} />
                  <span className="flex-1">{CORE_LABEL[q]}</span>
                  {missing &&
                    (onAsk ? (
                      <button type="button" className="text-accent" onClick={() => (setOpen(false), onAsk(q))}>
                        Answer
                      </button>
                    ) : (
                      <Link href="/settings" className="text-accent">
                        Add
                      </Link>
                    ))}
                </li>
              );
            })}
          </ul>
          <div className="rounded-[10px] bg-surface px-3 py-2 text-ink/80">
            <p className="mb-1 font-medium text-ink">A complete profile unlocks</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>All six taste traits and your taste type</li>
              <li>Sharper “people like you” results on every battle</li>
              <li>Coming soon: answers to your own questions, tailored to you</li>
            </ul>
          </div>
          <p className="text-[12px] text-ink/50">
            Every question is optional and you can skip any. Others only ever see groups, never you.
          </p>
        </div>
      )}
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className={cn("flex size-4 items-center justify-center rounded-full", on ? "bg-green text-white" : "border border-ink/25")}>
      {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
    </span>
  );
}
