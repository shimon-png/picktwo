"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { logEvent } from "@/lib/events";
import { cn } from "@/lib/utils";
import { MIX, TOPICS, topicLabel, topicTone, type DeckTopic, type TopicId } from "@/lib/topics";

/**
 * Topics in the Vote deck (Alex, Nov 27 2026; lib/topics.ts). Only the "topics" group of the topics A/B test sees
 * these. Bright candy tiles with dark text (the `qtile-1…6` colours), never lime: lime is for action buttons.
 */

const toneClass = (t: DeckTopic) => (t === MIX ? "bg-[#ffffff]" : `qtile-${topicTone(t)}`);

/** Small topic label on a deck card. */
export function TopicBadge({ topic }: { topic: TopicId }) {
  return (
    <span className={cn("qbadge shrink-0 !px-2 !py-0.5 !text-[9.5px]", toneClass(topic))} data-testid="topic-badge">
      {topicLabel(topic)}
    </span>
  );
}

/** One scrolling row of topic chips above the deck: Mix first, the one you're on filled and ringed. */
export function TopicChips({ current, counts, onPick }: { current: DeckTopic; counts: Partial<Record<TopicId, number>>; onPick: (t: DeckTopic) => void }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEvent("topic_bar_shown", { topic: current });
    // Bring the chosen chip into view (e.g. a deck opened from a ?topic= link).
    row.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chips: DeckTopic[] = [MIX, ...TOPICS.map((t) => t.id)];
  return (
    <div
      ref={row}
      role="toolbar"
      aria-label="Topics"
      // Phones: one scrolling row whose right edge fades out, so a cut-off chip reads as "more this way". Wider
      // screens: the chips wrap so every topic is visible (Alex, Nov 28: "Everyday life is cut off").
      className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 pt-1 [mask-image:linear-gradient(to_right,#000_85%,transparent)] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      data-testid="topic-chips"
    >
      {chips.map((t) => {
        const on = t === current;
        const empty = t !== MIX && counts[t] === 0;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => !on && onPick(t)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-bold text-[#15112b] shadow-[0_2px_0_rgb(0_0_0/0.18)] transition",
              toneClass(t),
              // Full-strength candy colours (Alex, Nov 28: the dimmed chips looked muted); only empty topics fade.
              on ? "scale-105 ring-2 ring-ink ring-offset-2 ring-offset-page" : "hover:brightness-105",
              empty && !on && "opacity-50",
            )}
          >
            {topicLabel(t)}
          </button>
        );
      })}
    </div>
  );
}

/** The grid of topic tiles (Mix + every topic), used by the picker card. */
function TopicGrid({ counts, onPick, current }: { counts: Partial<Record<TopicId, number>>; onPick: (t: DeckTopic) => void; current: DeckTopic }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {([MIX, ...TOPICS.map((t) => t.id)] as DeckTopic[]).map((t) => {
        const n = t === MIX ? null : (counts[t] ?? 0);
        const hook = t === MIX ? "A bit of everything" : TOPICS.find((x) => x.id === t)?.hook;
        return (
          <button
            key={t}
            type="button"
            disabled={n === 0}
            onClick={() => onPick(t)}
            className={cn(
              "qtile !items-start !justify-between flex-col !gap-1 px-3 py-2.5 !text-left",
              toneClass(t),
              t === MIX && "shadow-ring",
              t === current && "ring-2 ring-ink",
              n === 0 && "!bg-none bg-zinc-200 opacity-60",
            )}
          >
            <span className="text-[15px] leading-tight">{topicLabel(t)}</span>
            <span className="text-[11px] font-medium leading-snug opacity-80">{n === 0 ? "Back tomorrow" : hook}</span>
            {n != null && n > 0 && <span className="rounded-full bg-[#ffffff] px-1.5 text-[10.5px] font-bold text-[#15112b] shadow-[0_1px_0_rgb(0_0_0/0.12)]">{n >= 100 ? "99+" : n} new</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "You've been seeing all battles in Mix. Want to stay on Mix or get more specific?" (Alex, Nov 27): once, around
 * the 6th pick (economy topicPickerAt). Picking Mix or skipping keeps the mix.
 */
export function TopicPickerCard({ picks, counts, onPick, onSkip }: { picks: number; counts: Partial<Record<TopicId, number>>; onPick: (t: DeckTopic) => void; onSkip: () => void }) {
  useEffect(() => {
    logEvent("topic_picker_shown", { picks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <article aria-label="Pick a topic" className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-3 overflow-y-auto rounded-[20px] bg-white p-4 shadow-card" data-testid="topic-picker">
      <span className="qbadge qbadge-v self-start">Pick a topic</span>
      <div>
        <h1 className="text-[22px] leading-tight">You’ve been seeing all battles in “Mix”.</h1>
        <p className="mt-1 text-[14px] text-ink/70">Want to stay on Mix or get more specific?</p>
      </div>
      <TopicGrid counts={counts} current={MIX} onPick={onPick} />
      <button type="button" className="mt-auto py-2 text-[14px] font-semibold text-ink/70" onClick={onSkip}>
        Skip, keep the mix
      </button>
    </article>
  );
}

/**
 * "3 Couples battles in a row. Want only Couples for a bit?" Only for people who have used Skip a few times (lib/
 * topics.ts streakTopic), so a run the deck pushed at them by chance doesn't count.
 */
export function TopicStreakCard({ topic, run, onYes, onNo }: { topic: TopicId; run: number; onYes: () => void; onNo: () => void }) {
  useEffect(() => {
    logEvent("topic_streak_shown", { topic, run });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const label = topicLabel(topic);
  return (
    <article
      aria-label={`Only ${label}?`}
      className={cn("deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-4 rounded-[20px] p-6 text-[#15112b] shadow-card", toneClass(topic))}
      data-testid="topic-streak"
    >
      <span className="qbadge self-start bg-[#ffffff]">You’re on a streak</span>
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="text-[30px] leading-tight !text-[#15112b]">
          {run} {label} battles in a row. Want only {label} for a bit?
        </h1>
        <p className="text-[15px] opacity-80">You can switch back any time from the topics up top.</p>
      </div>
      <div className="grid gap-2">
        <button type="button" className="btn-cta w-full !py-3 text-[16px]" onClick={onYes}>
          Yes, only {label}
        </button>
        <button type="button" className="py-2 text-[15px] font-bold" onClick={onNo}>
          Keep the mix
        </button>
      </div>
    </article>
  );
}

/**
 * The end of a topic (Alex, Nov 27): "You've seen every Couples battle. New ones land every day. Want them first?"
 * Guests: the button opens the sign-up page. Signed in: back to the mix, or another topic from the chips.
 */
export function TopicEmpty({ topic, signedIn, onMix }: { topic: TopicId; signedIn: boolean; onMix: () => void }) {
  useEffect(() => {
    logEvent("topic_empty", { topic, signedIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const label = topicLabel(topic);
  return (
    <div className="card mt-2 flex flex-col items-center gap-3 px-6 py-10 text-center" data-testid="topic-empty">
      <span className={cn("size-14 rounded-full", toneClass(topic))} aria-hidden />
      <h1 className="text-[24px] leading-tight">You’ve seen every {label} battle</h1>
      <p className="text-[15px] text-zinc-600">{signedIn ? "New ones land every day. Pick another topic up top, or go back to the mix." : "New ones land every day. Want them first?"}</p>
      {!signedIn && (
        <Link href="/signin?callbackUrl=/vote" className="btn-cta mt-1 w-full max-w-xs !py-3" onClick={() => logEvent("topic_empty_tap", { topic, to: "signup" })}>
          Sign up · tell me when new ones land
        </Link>
      )}
      <button
        type="button"
        className={cn("w-full max-w-xs !py-3", signedIn ? "btn-cta" : "btn-ghost text-ink")}
        onClick={() => {
          logEvent("topic_empty_tap", { topic, to: "mix" });
          onMix();
        }}
      >
        Back to the mix
      </button>
    </div>
  );
}
