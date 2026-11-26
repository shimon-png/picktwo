"use client";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { logEvent } from "@/lib/events";
import { shuffled } from "@/lib/about";
import { MIND_OTHER, MIND_TEXT_MAX, MIND_TOPICS, type MindTopic } from "@/lib/mind";
import type { BattleCard } from "@/server/services/battles";
import { cn } from "@/lib/utils";

const SLICE = [
  "bg-a-soft text-a ring-1 ring-a/35",
  "bg-b-soft text-b ring-1 ring-b/35",
  "bg-green-soft text-green ring-1 ring-green/35",
];

/**
 * "What's on your mind this week?" (lib/mind.ts): one tap, same size as a battle card. The topics come in a fresh
 * random order each showing (logged, to check for position bias); "Other" sits last and opens a short text box
 * (Alex, Nov 26). The answer comes back with the next battles, already steered toward it.
 */
export function MindCard({ onDone }: { onDone: (topic: MindTopic | null, items: BattleCard[]) => void }) {
  const [order] = useState(() => shuffled(MIND_TOPICS));
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    logEvent("mind_card_shown", { order: order.map((o) => o.id).join(",") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(topic: MindTopic | null) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ items: BattleCard[] }>("/api/me/mind", { body: { topic, ...(topic === MIND_OTHER ? { text: text.trim() } : {}) } });
      onDone(topic, r.items);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <article aria-label="What's on your mind this week?" className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-3 rounded-[20px] bg-white p-4 shadow-card" data-testid="mind-card">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-violet-soft px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-[.1em] text-violet">This week · 1 tap</span>
        <button type="button" className="px-2 py-1 text-sm text-zinc-500 underline-offset-2 hover:underline" onClick={() => send(null)} disabled={busy}>
          Skip
        </button>
      </div>
      <div>
        <h1 className="text-[26px] leading-tight">What’s on your mind this week?</h1>
        <p className="mt-1 text-[13px] text-zinc-500">We’ll bring up battles about it next.</p>
      </div>
      {typing ? (
        <form
          className="flex flex-1 flex-col justify-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 2) send(MIND_OTHER);
          }}
        >
          <input
            className="input text-center text-lg"
            autoFocus
            maxLength={MIND_TEXT_MAX}
            placeholder="e.g. my sister’s wedding"
            aria-label="What’s on your mind"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn-cta w-full py-3" disabled={busy || text.trim().length < 2}>
            Show me battles about it
          </button>
          <button type="button" className="py-1 text-sm text-zinc-500" onClick={() => setTyping(false)} disabled={busy}>
            Back
          </button>
        </form>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[repeat(3,minmax(0,1fr))_minmax(0,.6fr)] gap-2">
          {order.map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              className={cn("rounded-[14px] px-3 font-display text-[19px] font-semibold leading-tight transition active:scale-[.98]", SLICE[i % SLICE.length])}
              onClick={() => send(o.id)}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            className="col-span-2 rounded-[14px] bg-surface px-3 font-display text-[17px] font-semibold text-zinc-600 ring-1 ring-ink/10 transition active:scale-[.98]"
            onClick={() => setTyping(true)}
          >
            Other…
          </button>
        </div>
      )}
    </article>
  );
}
