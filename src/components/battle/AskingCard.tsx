"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, PenLine } from "lucide-react";
import { ApiError, api, setPP, toast } from "@/lib/client";
import { currentSessionId, logEvent } from "@/lib/events";
import type { LikeYou } from "@/lib/like-you";
import type { AskingItem } from "@/server/services/asking";
import { SignupGate } from "@/components/auth/SignupGate";
import { ResultBars } from "./ResultBars";
import { cn } from "@/lib/utils";
import { PickbotMark, PickbotWord } from "@/components/pickbot/PickbotMark";

type Score = { a: number; b: number; total: number };
type VoteRes = {
  results: Score;
  ppBalance: number | null;
  likeYou?: LikeYou | null;
};

/**
 * "People like you are asking" (lib/asking.ts): three likely worries for this person, shown as a deck card.
 * - mode "pickbot" (signed in with Pickbot): a tap opens Pickbot with the question filled in.
 * - mode "battle" (guests, no Pickbot): a tap opens the question as a real battle; the crowd answers right away, then
 *   a guest gets the prefilled sign-up that lands in Pickbot with this question.
 */
export function AskingCard({
  items,
  mode,
  round,
  picks,
  signedIn,
  onVoted,
  onDone,
}: {
  items: AskingItem[];
  mode: "battle" | "pickbot";
  round: number;
  picks: number;
  signedIn: boolean;
  /** A vote on a preset battle counted (moves the profile bar / free votes like a deck vote). */
  onVoted: (r: { guestVotesLeft?: number | null }) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<AskingItem | null>(null);
  const [voted, setVoted] = useState<"A" | "B" | null>(null);
  const [result, setResult] = useState<Score | null>(null);
  const [likeYou, setLikeYou] = useState<LikeYou | null>(null);
  const [signup, setSignup] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const log = { round, picks, mode };
  // Room for one open slot: at most four suggestions.
  const shownItems = items.slice(0, 4);

  useEffect(() => {
    logEvent("asking_shown", { ...log, ids: shownItems.map((i) => i.id).join(",") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI-written questions (ids "ai_…") have no preset: the question itself goes into Pickbot's box.
  const pickbotUrl = (id: string) => {
    const ai = id.startsWith("ai_") ? items.find((i) => i.id === id) : null;
    return ai ? `/ask?q=${encodeURIComponent(ai.q)}` : `/ask?preset=${encodeURIComponent(id)}`;
  };

  function tap(item: AskingItem, slot: number) {
    logEvent("asking_tap", { ...log, id: item.id, slot });
    if (mode === "pickbot") {
      router.push(pickbotUrl(item.id));
      return;
    }
    setOpen(item);
    setShownAt(Date.now());
  }

  async function vote(side: "A" | "B") {
    if (!open || voted) return;
    setVoted(side);
    try {
      const r = await api<VoteRes & { guestVotesLeft?: number | null }>(`/api/battles/${open.slug}/vote`, {
        body: {
          side,
          source: "asking",
          dwellMs: Date.now() - shownAt,
          meta: { method: "tap", sessionId: currentSessionId() ?? undefined },
        },
      });
      setResult(r.results);
      setLikeYou(r.likeYou ?? null);
      setPP(r.ppBalance);
      onVoted(r);
      logEvent("asking_voted", { ...log, id: open.id, side });
    } catch (e) {
      setVoted(null);
      if (e instanceof ApiError && e.code === "SIGNUP_REQUIRED") {
        setSignup(true);
        return;
      }
      toast((e as Error).message, "error");
    }
  }

  function askPickbot() {
    if (!open) return;
    logEvent("asking_signup_tap", { ...log, id: open.id });
    setSignup(true);
  }

  // The open slot (Alex, Nov 27: "leave one or two open"): their own question, in their own words.
  function own() {
    logEvent("asking_tap", { ...log, id: "own", slot: shownItems.length });
    if (mode === "pickbot") {
      router.push("/ask?mine=1");
      return;
    }
    setSignup(true);
  }

  function close() {
    logEvent("asking_dismissed", {
      ...log,
      id: open?.id ?? null,
      voted: !!voted,
    });
    onDone();
  }

  return (
    <>
      {signup && <SignupGate soft next={open ? pickbotUrl(open.id) : "/ask?mine=1"} place="asking" log={{ preset: open?.id ?? "own" }} onClose={() => setSignup(false)} />}
      <article
        aria-label="People similar to you are worried about"
        className="deck-card animate-pop absolute inset-0 z-40 flex flex-col gap-3 overflow-y-auto rounded-[20px] bg-white p-5 shadow-card"
        data-testid="asking-card"
      >
        {!open ? (
          <>
            <div className="space-y-2">
              <h1 className="leading-tight">
                <span className="block text-[23px] text-green">You’re not alone.</span>
                <span className="mt-1 block text-[16px] text-ink">People similar to you are worried about real day-to-day issues. Are any of these on your mind?</span>
              </h1>
              <p className="flex items-center gap-2.5 text-[16px] font-medium leading-snug text-ink/85">
                {mode === "pickbot" ? (
                  <>
                    <PickbotMark className="size-8" />
                    <span>
                      Tap one, make it your own, and <PickbotWord /> will help you
                    </span>
                  </>
                ) : (
                  "Tap one and see what the crowd says."
                )}
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-1.5">
              {shownItems.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  data-testid="asking-question"
                  onClick={() => tap(it, i)}
                  className="flex items-center gap-2 rounded-[14px] bg-surface px-3.5 py-2.5 text-left shadow-soft ring-1 ring-ink/15 transition active:scale-[.98]"
                >
                  <span className="flex-1 text-[14.5px] font-medium leading-snug text-ink">“{it.q}”</span>
                  <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                data-testid="asking-own"
                onClick={own}
                className="flex items-center gap-2 rounded-[14px] border-2 border-dashed border-a bg-surface px-3.5 py-2 text-left transition active:scale-[.98]"
              >
                <PenLine className="size-5 shrink-0 text-a" aria-hidden />
                <span className="flex-1 text-[14.5px] font-medium leading-snug text-ink">Something else on your mind? Ask in your own words</span>
                <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden />
              </button>
            </div>
            <button type="button" data-testid="asking-keep-voting" className="w-full shrink-0 rounded-full py-3 text-[16px] font-semibold text-ink ring-2 ring-ink/40 transition active:scale-[.98]" onClick={close}>
              Keep voting
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <h1 className="text-[26px] leading-tight">{open.q}</h1>
              {open.context && <p className="text-[14px] text-ink/65">{open.context}</p>}
            </div>
            <div className="grid flex-1 content-center gap-2.5">
              {(["A", "B"] as const).map((s) => {
                const label = s === "A" ? open.a : open.b;
                const mine = voted === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!!voted}
                    onClick={() => vote(s)}
                    data-testid={`asking-option-${s}`}
                    className={cn(
                      "optcard rounded-[16px] px-4 py-4 text-left transition",
                      s === "A" ? "optcard-a" : "optcard-b",
                      voted && !mine && "opacity-60",
                      mine && (s === "A" ? "ring-2 ring-a" : "ring-2 ring-b"),
                      !voted && "active:scale-[.98]",
                    )}
                  >
                    <span className="optcard-label block text-[20px]">{label}</span>
                    {result && <ResultBars side={s} everyone={result} likeYou={mine ? likeYou : null} onPhoto={false} />}
                  </button>
                );
              })}
            </div>
            {result ? (
              <div className="grid gap-2">
                {!signedIn && (
                  <>
                    <p className="flex items-center gap-1.5 text-[13px] text-ink/70">
                      <PickbotMark className="size-6" />
                      <span>
                        Want an answer that fits <i>you</i>? <PickbotWord /> answers this one using your taste.
                      </span>
                    </p>
                    <button type="button" className="btn-primary w-full !py-3 text-[16px]" onClick={askPickbot} data-testid="asking-pickbot">
                      Sign up and ask Pickbot
                    </button>
                  </>
                )}
                <button type="button" className="w-full rounded-full py-3 text-[16px] font-semibold text-ink ring-2 ring-ink/40 transition active:scale-[.98]" onClick={close}>
                  Keep voting
                </button>
              </div>
            ) : (
              <button type="button" className="py-2 text-[14px] text-ink/60" onClick={close}>
                Not now
              </button>
            )}
          </>
        )}
      </article>
    </>
  );
}
