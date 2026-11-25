"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { api, toast } from "@/lib/client";
import { logEvent } from "@/lib/events";
import { ABOUT_QUESTIONS, KID_AGE_CHOICES, PREFER_NOT, cardOrder, type AboutQuestionId } from "@/lib/about";
import { cn } from "@/lib/utils";

export type AboutCardPayload = { id: AboutQuestionId; zipGuess?: string | null; cityGuess?: string | null };

/** Slice colours repeat by position, not by answer, so no answer looks like the default. */
const SLICE = [
  "bg-a-soft text-a ring-1 ring-a/35",
  "bg-b-soft text-b ring-1 ring-b/35",
  "bg-green-soft text-green ring-1 ring-green/35",
];

/**
 * An about-you question shown as a deck card (lib/about.ts): same size and taps as a battle. Answers split the card
 * into equal slices in a fresh random order for each showing; the order shown is logged so the Brain can check for
 * position bias. Skip is always there.
 */
export function AboutCard({ card, onDone }: { card: AboutCardPayload; onDone: (answer: string | null) => void }) {
  const q = ABOUT_QUESTIONS[card.id];
  const [order] = useState(() => cardOrder(q.options));
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState(card.zipGuess ?? "");
  const [kidsYes, setKidsYes] = useState(false);
  const [kidAges, setKidAges] = useState<string[]>([]);

  useEffect(() => {
    logEvent("about_card_shown", { question: q.id, order: order.map((o) => o.id).join(","), zipGuess: !!card.zipGuess });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(answer: string | null, ages?: string[]) {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/me/about", { body: { question: q.id, answer, ...(ages ? { kidAges: ages } : {}) } });
      onDone(answer);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  const city = card.cityGuess;
  return (
    <article aria-label={`About you: ${q.title}`} className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-3 rounded-[20px] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-a-soft px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-a">
          About you · {q.kind === "zip" ? "one box" : "1 tap"}
        </span>
        <button type="button" className="px-2 py-1 text-sm text-zinc-500 underline-offset-2 hover:underline" onClick={() => send(null)} disabled={busy}>
          Skip
        </button>
      </div>
      <div>
        <h1 className="text-[26px] leading-tight">{q.kind === "zip" && city ? `Near ${city}?` : q.title}</h1>
        <p className="mt-1 text-[13px] text-zinc-500">{q.kind === "zip" && city ? `Enter your ZIP to see what ${city} picked.` : q.sub}</p>
      </div>

      {q.kind === "zip" ? (
        <form
          className="flex flex-1 flex-col justify-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (zip.trim()) send(zip.trim());
          }}
        >
          <input
            className="input text-center text-2xl tracking-widest"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            placeholder="ZIP code"
            aria-label="ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
          <button className="btn-cta w-full py-3" disabled={busy || !zip.trim()}>
            {city ? `See what ${city} picked` : "See what my area picked"}
          </button>
        </form>
      ) : kidsYes ? (
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm text-zinc-600">How old? Pick all that apply (age ranges only).</p>
          <div className="flex flex-wrap gap-2">
            {KID_AGE_CHOICES.map((k) => (
              <button
                key={k.id}
                type="button"
                className={cn("chip", kidAges.includes(k.id) && "chip-on")}
                aria-pressed={kidAges.includes(k.id)}
                onClick={() => setKidAges((a) => (a.includes(k.id) ? a.filter((x) => x !== k.id) : [...a, k.id]))}
              >
                {k.label}
              </button>
            ))}
          </div>
          <button className="btn-cta mt-auto w-full py-3" disabled={busy} onClick={() => send("YES", kidAges)}>
            Done
          </button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${order.length}, minmax(0, 1fr))` }}>
          {order.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              className={cn(
                "rounded-[14px] px-4 font-display font-semibold leading-tight transition active:scale-[.98]",
                order.length > 5 ? "text-[17px]" : "text-[20px]",
                o.id === PREFER_NOT ? "bg-surface text-[15px] font-medium text-zinc-500 ring-1 ring-ink/10" : SLICE[i % SLICE.length],
              )}
              onClick={() => (q.id === "kids" && o.id === "YES" ? setKidsYes(true) : send(o.id))}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <p className="flex items-center gap-2 rounded-[12px] bg-surface px-3 py-2 text-[12px] text-zinc-600">
        <Lock className="size-3.5 shrink-0 text-green" aria-hidden />
        Never shown on your profile. Only used in group results.
      </p>
    </article>
  );
}
