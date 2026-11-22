"use client";

import { useState } from "react";
import { rollLine } from "@/lib/streak";

/**
 * "You're on a roll" flashcard that sits on top of the deck after a milestone pick
 * (`isRollMilestone`). Tapping anywhere flicks it away and voting carries on.
 */
export function RollCard({ count, onDone }: { count: number; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 320);
  }
  return (
    <button
      type="button"
      autoFocus
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
      aria-label={`${rollLine(count)} ${count} picks. Tap to keep going.`}
      className="roll-card animate-pop absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[20px] px-6 text-center shadow-card"
      style={
        leaving
          ? { transform: "translateX(120%) rotate(14deg)", opacity: 0, transition: "transform 320ms ease-in, opacity 320ms ease-in" }
          : undefined
      }
    >
      <svg viewBox="0 0 64 96" className="roll-bolt h-40 w-28" aria-hidden>
        <path d="M40 2 L6 54 H28 L20 94 L58 36 H35 L46 2Z" fill="currentColor" strokeLinejoin="round" />
      </svg>
      <p className="display text-[34px] leading-tight text-ink">{rollLine(count)}</p>
      <p className="text-[17px] text-zinc-600">
        <span className="font-semibold text-ink">{count}</span> picks and counting. Keep going!
      </p>
      <span className="btn-primary mt-2 px-8">Tap to keep going</span>
    </button>
  );
}
