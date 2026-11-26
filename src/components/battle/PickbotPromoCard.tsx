"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { logEvent } from "@/lib/events";

/**
 * The one-time "Ask Pickbot" card in the Vote deck (lib/pickbot-promo.ts). Same size as a battle card. Logs
 * shown / tap / dismissed with its tested position, so the Brain can compare positions.
 */
export function PickbotPromoCard({ at, picks, onDone }: { at: number; picks: number; onDone: () => void }) {
  const router = useRouter();
  useEffect(() => {
    logEvent("pickbot_promo_shown", { at, picks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <article aria-label="Ask Pickbot" className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-4 rounded-[20px] bg-white p-5 shadow-card" data-testid="pickbot-promo">
      <span className="self-start rounded-full bg-violet-soft px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-violet">New · Pickbot</span>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-violet text-white" aria-hidden>
          <Sparkles className="size-7" />
        </span>
        <h1 className="text-[30px] leading-tight">Ask Pickbot your question and get answers from our AI</h1>
        <p className="text-[15px] text-ink/70">
          Stuck on your own choice? Pickbot answers for you, using your taste from the battles you vote on, and the crowd can weigh in too.
        </p>
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          className="btn-primary w-full !py-3 text-[16px]"
          onClick={() => {
            logEvent("pickbot_promo_tap", { at, picks });
            router.push("/ask");
          }}
        >
          Ask Pickbot
        </button>
        <button
          type="button"
          className="py-2 text-[14px] text-ink/60"
          onClick={() => {
            logEvent("pickbot_promo_dismissed", { at, picks });
            onDone();
          }}
        >
          Keep voting
        </button>
      </div>
    </article>
  );
}
