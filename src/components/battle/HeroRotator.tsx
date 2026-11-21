"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleCard } from "@/server/services/battles";
import { cn } from "@/lib/utils";
import { HeroBattle } from "./HeroBattle";

const DWELL_MS = 4000; // time on each battle before it auto-skips
const AFTER_VOTE_MS = 2600; // time to read the result after voting
const OUT_MS = 380;

/**
 * Homepage hero: cycles through live battles. Each card swipes away to the left and the next one
 * slides in. Pauses while the visitor hovers/touches/focuses it and when the tab is hidden.
 */
export function HeroRotator({ battles }: { battles: BattleCard[] }) {
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [voted, setVoted] = useState(false);
  const [paused, setPaused] = useState(false);
  const resumeAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b = battles[idx];
  const many = battles.length > 1;

  const next = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setIdx((i) => (i + 1) % battles.length);
      setVoted(false);
      setLeaving(false);
    }, OUT_MS);
  }, [battles.length]);

  useEffect(() => {
    if (!many || leaving || (paused && !voted)) return;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") next();
    }, voted ? AFTER_VOTE_MS : DWELL_MS);
    return () => clearTimeout(t);
  }, [many, leaving, paused, voted, idx, next]);

  // Touch has no "leave": pause on touch, resume a few seconds later.
  function touchPause() {
    setPaused(true);
    if (resumeAt.current) clearTimeout(resumeAt.current);
    resumeAt.current = setTimeout(() => setPaused(false), 5000);
  }
  useEffect(() => () => void (resumeAt.current && clearTimeout(resumeAt.current)), []);

  if (!b) return null;
  const asker = b.authorName?.split(" ")[0] ?? (b.authorHandle ? `@${b.authorHandle}` : null);

  return (
    <div
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onPointerDown={(e) => e.pointerType !== "mouse" && touchPause()}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        key={b.id}
        className={cn("relative", leaving ? "hero-card-out" : "hero-card-in")}
      >
        {asker && (
          <div className="absolute -top-4 left-4 z-10 rounded-full bg-ink px-3 py-1 text-xs text-page shadow-card">{asker} needs a second opinion 👇</div>
        )}
        <HeroBattle b={b} onVoted={() => setVoted(true)} />
      </div>
      {many && (
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {battles.map((x, i) => (
            <span key={x.id} className={cn("h-1.5 overflow-hidden rounded-full bg-ink/15 transition-all duration-300", i === idx ? "w-6" : "w-1.5")}>
              {i === idx && (
                <span
                  key={`${x.id}-${voted}-${paused}`}
                  className="block h-full rounded-full bg-accent"
                  style={
                    paused && !voted
                      ? { width: "100%" }
                      : { animation: `hero-progress ${voted ? AFTER_VOTE_MS : DWELL_MS}ms linear forwards` }
                  }
                />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
