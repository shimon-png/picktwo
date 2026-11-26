"use client";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { logEvent } from "@/lib/events";
import { shuffled } from "@/lib/about";
import { MIND_TOPICS, type MindTopic } from "@/lib/mind";
import type { BattleCard } from "@/server/services/battles";
import { cn } from "@/lib/utils";

/** Bright tiles (globals.css `qtile-*`), one colour each, with an emoji so the grid feels alive (Alex, Nov 26). */
const TILE = ["qtile-1", "qtile-2", "qtile-3", "qtile-4", "qtile-5", "qtile-6"];
const EMOJI: Record<string, string> = { money: "💸", dating: "💘", work: "💼", family: "👨‍👩‍👧", gifts: "🎁", home: "🏡" };

/**
 * "What's on your mind this week?" (lib/mind.ts): one tap, same size as a battle card. The topics come in a fresh
 * random order each showing (logged, to check for position bias). The answer comes back with the next battles,
 * already steered toward it.
 */
export function MindCard({ onDone }: { onDone: (topic: MindTopic | null, items: BattleCard[]) => void }) {
  const [order] = useState(() => shuffled(MIND_TOPICS));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    logEvent("mind_card_shown", { order: order.map((o) => o.id).join(",") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(topic: MindTopic | null) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ items: BattleCard[] }>("/api/me/mind", { body: { topic } });
      onDone(topic, r.items);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <article aria-label="What's on your mind this week?" className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-3 rounded-[20px] bg-white p-4 shadow-card" data-testid="mind-card">
      <div className="flex items-center justify-between">
        <span className="qbadge qbadge-v font-display">This week · 1 tap</span>
        <button type="button" className="px-2 py-1 text-sm text-zinc-500 underline-offset-2 hover:underline" onClick={() => send(null)} disabled={busy}>
          Skip
        </button>
      </div>
      <div>
        <h1 className="text-[26px] leading-tight">What’s on your mind this week?</h1>
        <p className="mt-1 text-[13px] text-zinc-500">We’ll bring up battles about it next.</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2">
        {order.map((o, i) => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            className={cn("qtile flex-col !gap-1 px-3 font-display text-[18px]", TILE[i % TILE.length])}
            onClick={() => send(o.id)}
          >
            <span className="qtile-emoji" aria-hidden>
              {EMOJI[o.id]}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </article>
  );
}
