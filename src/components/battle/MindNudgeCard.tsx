"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { logEvent } from "@/lib/events";
import { SignupGate } from "@/components/auth/SignupGate";
import { TasteWheel } from "@/components/taste/TasteWheel";
import type { MindTopic } from "@/lib/mind";

export type MindNudge = { topic: MindTopic; votes: number; axes: { id: string; score: number }[] };

/**
 * After a run of battles picked with their "on your mind" topic in mind, a signed-out person gets this card: their
 * own taste wheel so far, blurred, and sign-up to see it. Sign-up is the one-tap card with everything we know filled
 * in (variant "map": only missing sex / age to tap, ZIP always inferred), then lands on /you/taste.
 */
export function MindNudgeCard({ n, onDone }: { n: MindNudge; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    logEvent("mind_nudge_shown", { topic: n.topic, votes: n.votes, traits: n.axes.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <article aria-label="See your personality map" className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-card" data-testid="mind-nudge">
      <span className="self-start rounded-full bg-green-soft px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-green">
        {n.votes} picks in
      </span>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="text-[30px] leading-tight">We’re starting to really understand you.</h1>
        <p className="text-[15px] text-ink/70">Sign up to see your personality map. We already filled in what we know.</p>
        <div className="relative flex justify-center text-ink" aria-hidden>
          <div className="opacity-90 blur-[3px]">
            <TasteWheel axes={n.axes} size={170} showCrowd={false} />
          </div>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-card">
              <Lock className="size-5 text-green" />
            </span>
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          className="btn-cta w-full py-3 text-[16px]"
          onClick={() => {
            logEvent("mind_nudge_tap", { topic: n.topic, votes: n.votes });
            setOpen(true);
          }}
        >
          See my personality map
        </button>
        <button
          type="button"
          className="py-2 text-[14px] text-ink/60"
          onClick={() => {
            logEvent("mind_nudge_dismissed", { topic: n.topic, votes: n.votes });
            onDone();
          }}
        >
          Keep voting
        </button>
      </div>
      {/* Not logged as a sign-up gate (the gate A/B test counts those); mind_nudge_tap is the open. */}
      {open && createPortal(<SignupGate soft silent variant="map" next="/you/taste" place="mind_nudge" onClose={() => setOpen(false)} />, document.body)}
    </article>
  );
}
