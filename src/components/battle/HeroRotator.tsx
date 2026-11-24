"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleCard } from "@/server/services/battles";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HeroBattle } from "./HeroBattle";
import { SignupGate } from "@/components/auth/SignupGate";

const DWELL_MS = 4000; // time on each battle before it auto-skips
const AFTER_VOTE_MS = 2600; // time to read the result after voting
const OUT_MS = 380;

/**
 * Homepage hero: cycles through live battles (random order from the server, each shown once). Each card swipes
 * away to the left and the next one slides in. Pauses while the visitor hovers/touches/focuses it and when the tab
 * is hidden. Votes count toward the guest's free votes; once they're used, a tap opens the sign-up sheet.
 */
export function HeroRotator({ battles, guestLeft: initialLeft, guestLimit }: { battles: BattleCard[]; guestLeft: number | null; guestLimit: number }) {
  const [idx, setIdx] = useState(0);
  const [guestLeft, setGuestLeft] = useState(initialLeft);
  const [gate, setGate] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [voted, setVoted] = useState(false);
  const [paused, setPaused] = useState(false);
  const resumeAt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const b = battles[idx];
  const done = idx >= battles.length; // no repeats: after the last battle, point to the Vote page
  const many = battles.length > 1;

  const next = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setIdx((i) => i + 1);
      setVoted(false);
      setLeaving(false);
    }, OUT_MS);
  }, []);

  useEffect(() => {
    if (!many || done || gate || leaving || (paused && !voted)) return;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") next();
    }, voted ? AFTER_VOTE_MS : DWELL_MS);
    return () => clearTimeout(t);
  }, [many, done, gate, leaving, paused, voted, idx, next]);

  // Touch has no "leave": pause on touch, resume a few seconds later.
  function touchPause() {
    setPaused(true);
    if (resumeAt.current) clearTimeout(resumeAt.current);
    resumeAt.current = setTimeout(() => setPaused(false), 5000);
  }
  useEffect(() => () => void (resumeAt.current && clearTimeout(resumeAt.current)), []);

  if (battles.length === 0) return null;
  if (done || !b)
    return (
      <div className="rounded-[22px] bg-white p-6 text-center shadow-lift">
        <p className="text-lg">You’ve seen every live battle here.</p>
        <Link href="/vote" className="btn-primary mt-3 inline-flex">
          Keep voting
        </Link>
      </div>
    );
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
        <HeroBattle
          b={b}
          gated={guestLeft !== null && guestLeft <= 0}
          onGate={() => {
            setGuestLeft(0);
            setGate(true);
          }}
          onVoted={() => {
            setVoted(true);
            setGuestLeft((n) => (n === null ? n : Math.max(0, n - 1)));
          }}
        />
      </div>
      {gate && <SignupGate limit={guestLimit} next="/vote" onClose={() => setGate(false)} />}
      {many && battles.length > 10 && (
        <p className="mt-3 text-center text-xs text-zinc-500" aria-hidden>
          {idx + 1} of {battles.length}
          {guestLeft !== null && guestLeft > 0 && ` · ${guestLeft} free vote${guestLeft === 1 ? "" : "s"} left`}
        </p>
      )}
      {many && battles.length <= 10 && (
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
