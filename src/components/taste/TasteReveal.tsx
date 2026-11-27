"use client";
import Link from "next/link";
import { useState } from "react";
import { TasteWheel } from "./TasteWheel";

export type TasteMilestone = {
  milestone: number;
  full: boolean;
  signedIn: boolean;
  name: string | null;
  missing?: string[];
  axes: { id: string; left: string; right: string; score: number; crowd: number; why: string }[];
};

/**
 * Taste profile moments in the deck (About-you plan §2): at tasteFirstAt votes the first two traits, at tasteFullAt
 * the whole wheel and the type name. Sits on the deck like the roll card; tap to keep voting.
 */
export function TasteReveal({ t, onDone }: { t: TasteMilestone; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 300);
  };
  const leans = t.axes.map((a) => (a.score >= 0 ? a.left : a.right));
  return (
    <div
      role="dialog"
      aria-label={t.full ? "Your taste profile is ready" : "Your taste so far"}
      className="animate-pop absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-white px-6 text-center shadow-card"
      style={leaving ? { transform: "translateX(120%) rotate(14deg)", opacity: 0, transition: "transform 300ms ease-in, opacity 300ms ease-in" } : undefined}
    >
      <span className="rounded-full bg-green-soft px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-green">
        {t.full ? "Taste profile unlocked" : `Your taste · ${t.axes.length} of 6 traits`}
      </span>
      {t.full && t.name ? <p className="display text-[32px] leading-tight text-cta">{t.name}</p> : <p className="display text-[26px] leading-tight">{leans.join(" · ")}</p>}
      <div className="text-ink">
        <TasteWheel axes={t.axes} size={210} />
      </div>
      <p className="text-[14px] text-zinc-600">
        {t.full
          ? "Built from your picks. See what each trait means and share it."
          : t.signedIn
            ? `Keep voting: we're still learning ${(t.missing ?? []).slice(0, 3).join(", ").toLowerCase() || "the rest"}.`
            : "Sign up when your free votes run out to save it and unlock all six."}
      </p>
      <div className="flex w-full flex-col gap-2">
        {t.signedIn && (
          <Link href="/you/taste" className="btn-cta w-full py-3">
            {t.full ? "See my taste profile" : "See it in You"}
          </Link>
        )}
        <button type="button" className={t.signedIn ? "btn-outline w-full py-3" : "btn-cta w-full py-3"} onClick={dismiss} autoFocus>
          Keep voting
        </button>
      </div>
    </div>
  );
}
